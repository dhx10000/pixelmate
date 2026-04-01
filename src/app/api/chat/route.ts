import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;
import {
  type ConversationState,
  type ConversationContext,
  getNextState,
  STATE_META,
} from "@/lib/stateMachine";
import { extractBusinessBrief } from "@/lib/agents/businessAnalyst";
import { matchServices } from "@/lib/agents/serviceMatcher";
import { validatePackage } from "@/lib/agents/validator";
import { draftOffer } from "@/lib/agents/offerDrafter";
import type { AgentOutputs } from "@/lib/agents/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Base system prompt ─────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT =
  `You are PixelMate, the user-facing AI assistant for PIXEL. You act as a ` +
  `business analyst and pre-sales guide in a simple, calm, human way. Your goal ` +
  `is to understand the user's business need and help prepare a useful brief for ` +
  `the PIXEL team.\n\n` +
  `Tone: clear, calm, respectful, concise, non-pushy, easy for non-experts.\n\n` +
  `Rules: Ask short, simple questions. Usually ask one question at a time. Use ` +
  `buttons/options when helpful. Stay only within PIXEL-related topics: branding, ` +
  `websites, landing pages, digital products, AI assistants, automation, offer ` +
  `clarity, customer experience, and related strategy. If the user asks for ` +
  `something outside scope, gently redirect. Do not invent answers. If information ` +
  `is missing, say so clearly. If a precise answer requires human review, say that ` +
  `the PIXEL team will prepare it. After enough context is collected, summarize ` +
  `what you understood and ask for contact details.`;

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// ── Context derivation ─────────────────────────────────────────────────────

function deriveContext(
  messages: ChatMessage[],
  currentState: ConversationState
): ConversationContext {
  const allText = messages.map((m) => m.content).join(" ");
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const TERMINAL_STATES: ConversationState[] = [
    "SERVICE_MATCH",
    "SUMMARY_REVIEW",
    "CONTACT_CAPTURE",
    "OFFER_DRAFT",
    "CASE_RECOMMENDATION",
    "DONE",
  ];

  return {
    hasAssets:
      /\b(file|upload|attachment|pdf|doc|image|logo|website|url|link|existing|brand|material)\b/i.test(
        allText
      ),
    filesUploaded: false,
    contactCaptured: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(allText),
    needsHumanHandoff:
      /\b(speak to (a |someone|a human|the team)|real person|escalate|can'?t help|cannot help)\b/i.test(
        lastUserMsg
      ),
    serviceMatched: TERMINAL_STATES.includes(currentState),
    offerReady: currentState === "OFFER_DRAFT",
    conversationComplete:
      messages.length > 6 &&
      /\b(thank|thanks|done|that'?s all|bye|goodbye|perfect|great)\b/i.test(
        lastUserMsg
      ),
  };
}

// ── System prompt builder ──────────────────────────────────────────────────

function buildSystemPrompt(
  state: ConversationState,
  agents: AgentOutputs
): string {
  const meta = STATE_META[state];
  const stageLine =
    `\n\nCurrent conversation stage: ${meta.label} — ${meta.description} ` +
    `Adjust your questions and depth accordingly.`;

  const sections: string[] = [];

  if (agents.brief && agents.brief.current_problem !== "UNKNOWN") {
    const b = agents.brief;
    sections.push(
      `### Business Analysis\n` +
        `Business type: ${b.business_type}\n` +
        `Problem: ${b.current_problem}\n` +
        `Desired outcome: ${b.desired_outcome}\n` +
        `Audience: ${b.target_audience}\n` +
        `Urgency: ${b.urgency}\n` +
        `Assets on hand: ${b.current_assets.join(", ") || "none mentioned"}\n` +
        `Constraints: ${b.constraints.join(", ") || "none mentioned"}\n` +
        `Still unknown: ${b.unknowns.join(", ") || "none"}`
    );
  }

  if (agents.services?.top_match) {
    const top = agents.services.matches[0];
    sections.push(
      `### Recommended Service\n` +
        `Match: ${agents.services.top_match}\n` +
        `Rationale: ${top.why_it_matches}\n` +
        `Confidence: ${(top.confidence * 100).toFixed(0)}%\n` +
        `Still needed to confirm: ${top.what_is_missing}`
    );
  }

  if (agents.validation) {
    const v = agents.validation;
    const safeLabel = v.safe_to_send_to_user
      ? "YES — you may present the summary"
      : "NO — continue gathering information before summarising";
    const missing =
      v.missing_required_fields.length > 0
        ? `\nMissing required fields: ${v.missing_required_fields.join(", ")}`
        : "";
    const flagged =
      v.unsupported_claims.length > 0
        ? `\nClaims to avoid (unsupported): ${v.unsupported_claims.join("; ")}`
        : "";
    sections.push(
      `### Validation Status\nSafe to summarise: ${safeLabel}${missing}${flagged}`
    );
  }

  if (agents.offer) {
    const o = agents.offer;
    const tierLabel =
      o.tier === "full"
        ? "Full draft offer (high confidence)"
        : o.tier === "soft"
          ? "Soft directions note (moderate confidence)"
          : "Deferred — team follow-up";
    sections.push(
      `### Draft Offer\n` +
        `Tier: ${tierLabel}\n` +
        `Validated: ${o.validated ? "yes" : "no — unsupported claims stripped"}\n\n` +
        `The full offer has been displayed to the user in a formatted card below your message. ` +
        `Write a warm 1–2 sentence introduction only (e.g. "Based on everything you've shared, ` +
        `I've put together a draft brief for the PIXEL team."). ` +
        `Do not repeat, summarise, or quote any part of the offer content — the card covers it. ` +
        `After your intro, invite them to review the brief and hit 'Send to PIXEL team' when ready.`
    );
  }

  const intelligenceBlock =
    sections.length > 0
      ? "\n\n---\n\n" +
        "## Agent Intelligence (internal reference — do not read aloud or quote directly)\n\n" +
        sections.join("\n\n")
      : "";

  return BASE_SYSTEM_PROMPT + stageLine + intelligenceBlock;
}

// ── Agent orchestration ────────────────────────────────────────────────────

async function runAgents(
  nextState: ConversationState,
  messages: ChatMessage[],
  fileSummaries: string[],
  existing: AgentOutputs
): Promise<AgentOutputs> {
  const updated: AgentOutputs = { ...existing };

  if (nextState === "SERVICE_MATCH") {
    const brief = await extractBusinessBrief(messages, fileSummaries);
    const services = await matchServices(brief);
    updated.brief = brief;
    updated.services = services;
    updated.validation = undefined;
    updated.offer = undefined;
  }

  if (nextState === "SUMMARY_REVIEW" && updated.brief && updated.services) {
    const conversationExcerpt = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const validation = await validatePackage({
      brief: updated.brief,
      serviceMatches: updated.services,
      fileSummaries,
      conversationExcerpt,
    });
    updated.validation = validation;
  }

  if (nextState === "OFFER_DRAFT" && updated.brief && updated.services) {
    const offer = await draftOffer({
      brief: updated.brief,
      serviceMatches: updated.services,
      fileSummaries,
      conversationHistory: messages,
    });
    updated.offer = offer;
  }

  return updated;
}

// ── SSE error helper ───────────────────────────────────────────────────────
//
// Returns a minimal SSE stream containing one error event then closes.
// Used when we can't open the main stream (e.g. agent orchestration failed).

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function sseErrorResponse(
  message: string,
  errorType: "timeout" | "api"
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ error: message, errorType })}\n\n`
        )
      );
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let messages: ChatMessage[];
  let currentState: ConversationState;
  let incomingAgents: AgentOutputs;
  let fileSummaries: string[];
  let sessionId: string;

  try {
    const body = await request.json();
    messages = body.messages;
    currentState = (body.currentState as ConversationState) ?? "WELCOME";
    incomingAgents = (body.agentOutputs as AgentOutputs) ?? {};
    fileSummaries = Array.isArray(body.fileSummaries) ? body.fileSummaries : [];
    sessionId = typeof body.sessionId === "string" ? body.sessionId : crypto.randomUUID();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      );
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const context = deriveContext(messages, currentState);
  const nextState = getNextState(currentState, context);

  // Run agents before streaming — failures here return a proper SSE error
  // so the client always receives a well-formed event stream.
  let agentOutputs: AgentOutputs;
  try {
    agentOutputs = await runAgents(
      nextState,
      messages,
      fileSummaries,
      incomingAgents
    );
  } catch (err) {
    console.error("[chat] agent orchestration failed:", err);
    return sseErrorResponse("Something went wrong. Please try again.", "api");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      let botReply = "";

      // 30-second timeout on the Claude API call specifically.
      // runAgents already completed; this guards the streaming phase only.
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 30_000);

      try {
        const anthropicStream = client.messages.stream(
          {
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: buildSystemPrompt(nextState, agentOutputs),
            messages,
          },
          { signal: abortCtrl.signal }
        );

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            botReply += event.delta.text;
            send(JSON.stringify({ text: event.delta.text }));
          }
        }

        clearTimeout(timeoutId);

        // Emit state and agent outputs as the final frames before [DONE]
        send(JSON.stringify({ state: nextState }));
        send(JSON.stringify({ agents: agentOutputs }));
        send("[DONE]");

        // Upsert session — fire-and-forget, never blocks the response.
        const fullHistory: ChatMessage[] = [
          ...messages,
          { role: "assistant", content: botReply },
        ];
        supabase
          .from("sessions")
          .upsert(
            {
              id: sessionId,
              current_state: nextState,
              conversation_history: fullHistory,
              agent_outputs: agentOutputs,
              file_summaries: fileSummaries,
            },
            { onConflict: "id" }
          )
          .then(({ error }) => {
            if (error) console.error("[chat] session upsert failed:", error.message);
          });
      } catch (err) {
        clearTimeout(timeoutId);

        const isTimeout =
          abortCtrl.signal.aborted ||
          (err instanceof Error && err.name === "AbortError");

        const errorType = isTimeout ? "timeout" : "api";
        const errorMsg = isTimeout
          ? "This is taking longer than expected. Please try again."
          : "Something went wrong. Please try again.";

        send(JSON.stringify({ error: errorMsg, errorType }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
