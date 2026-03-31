import Anthropic from "@anthropic-ai/sdk";
import {
  type ConversationState,
  type ConversationContext,
  getNextState,
  STATE_META,
} from "@/lib/stateMachine";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BASE_SYSTEM_PROMPT = `You are PixelMate, the user-facing AI assistant for PIXEL. You act as a business analyst and pre-sales guide in a simple, calm, human way. Your goal is to understand the user's business need and help prepare a useful brief for the PIXEL team.

Tone: clear, calm, respectful, concise, non-pushy, easy for non-experts.

Rules: Ask short, simple questions. Usually ask one question at a time. Use buttons/options when helpful. Stay only within PIXEL-related topics: branding, websites, landing pages, digital products, AI assistants, automation, offer clarity, customer experience, and related strategy. If the user asks for something outside scope, gently redirect. Do not invent answers. If information is missing, say so clearly. If a precise answer requires human review, say that the PIXEL team will prepare it. After enough context is collected, summarize what you understood and ask for contact details.`;

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// ── Context derivation ─────────────────────────────────────────────────────
//
// Extracts signals from the conversation history to drive state transitions.
// Uses pattern matching — no extra API call needed.

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
    // No file upload UI yet — always false until that feature ships
    filesUploaded: false,
    contactCaptured:
      /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(allText),
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
//
// Appends the current stage so the model knows where it is in the flow.

function buildSystemPrompt(state: ConversationState): string {
  const meta = STATE_META[state];
  return (
    BASE_SYSTEM_PROMPT +
    `\n\nCurrent conversation stage: ${meta.label} — ${meta.description} ` +
    `Adjust your questions and depth accordingly.`
  );
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let messages: ChatMessage[];
  let currentState: ConversationState;

  try {
    const body = await request.json();
    messages = body.messages;
    currentState = (body.currentState as ConversationState) ?? "WELCOME";

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      );
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Determine next state before streaming starts
  const context = deriveContext(messages, currentState);
  const nextState = getNextState(currentState, context);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      try {
        const anthropicStream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: buildSystemPrompt(nextState),
          messages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(JSON.stringify({ text: event.delta.text }));
          }
        }

        // Send the resolved next state as the final payload before [DONE]
        send(JSON.stringify({ state: nextState }));
        send("[DONE]");
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? err.message
            : "An unexpected error occurred";
        send(JSON.stringify({ error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
