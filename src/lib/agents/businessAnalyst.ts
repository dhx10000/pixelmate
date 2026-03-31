import Anthropic from "@anthropic-ai/sdk";

// ── Schema ─────────────────────────────────────────────────────────────────
//
// All fields are grounded — missing data is represented explicitly rather
// than inferred. The agent never speculates.

export type BusinessBrief = {
  /** One-paragraph summary of the user's overall business situation */
  business_summary: string;
  /** e.g. "e-commerce", "SaaS", "professional services", "UNKNOWN" */
  business_type: string;
  /** Who the business serves, e.g. "B2B mid-market retailers" or "UNKNOWN" */
  target_audience: string;
  /** The core problem the user wants to solve, or "UNKNOWN" */
  current_problem: string;
  /** What success looks like for the user, or "UNKNOWN" */
  desired_outcome: string;
  /** "low" | "medium" | "high" | "unknown" */
  urgency: "low" | "medium" | "high" | "unknown";
  /** Files, URLs, brands, copy — anything the user already has */
  current_assets: string[];
  /** Budget limits, tech constraints, internal stakeholder issues, etc. */
  constraints: string[];
  /** Information still needed to complete the brief */
  unknowns: string[];
};

// ── Sentinel value ─────────────────────────────────────────────────────────
//
// Returned when the conversation is too sparse to produce a meaningful brief.

export const EMPTY_BRIEF: BusinessBrief = {
  business_summary: "Insufficient information collected yet.",
  business_type: "UNKNOWN",
  target_audience: "UNKNOWN",
  current_problem: "UNKNOWN",
  desired_outcome: "UNKNOWN",
  urgency: "unknown",
  current_assets: [],
  constraints: [],
  unknowns: ["All fields require further conversation."],
};

// ── Types ──────────────────────────────────────────────────────────────────

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You analyze the conversation and extract only grounded business facts. " +
  "Return: business_summary, business_type, target_audience, current_problem, " +
  "desired_outcome, urgency, current_assets, constraints, unknowns. " +
  "Rules: Use only grounded information. Mark missing data explicitly as the " +
  'string "UNKNOWN" for string fields or an empty array for array fields. ' +
  "Do not speculate. Output valid JSON only — no markdown fences, no commentary.";

// ── Validation ─────────────────────────────────────────────────────────────
//
// Lightweight runtime check — ensures Claude's output conforms before we
// hand it to callers. We don't use Zod to keep dependencies minimal.

function isValidBrief(obj: unknown): obj is BusinessBrief {
  if (!obj || typeof obj !== "object") return false;
  const b = obj as Record<string, unknown>;

  const stringFields: (keyof BusinessBrief)[] = [
    "business_summary",
    "business_type",
    "target_audience",
    "current_problem",
    "desired_outcome",
    "urgency",
  ];
  for (const f of stringFields) {
    if (typeof b[f] !== "string") return false;
  }

  const arrayFields: (keyof BusinessBrief)[] = [
    "current_assets",
    "constraints",
    "unknowns",
  ];
  for (const f of arrayFields) {
    if (!Array.isArray(b[f])) return false;
  }

  const validUrgency = new Set(["low", "medium", "high", "unknown"]);
  if (!validUrgency.has(b.urgency as string)) return false;

  return true;
}

// ── Main function ──────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Runs silently against the conversation history and any file summaries.
 * Returns a structured BusinessBrief. Never throws — returns EMPTY_BRIEF
 * if the model output is missing or malformed.
 *
 * Not intended for direct user display — this feeds downstream automation
 * (offer drafting, CRM entries, PIXEL team briefs).
 */
export async function extractBusinessBrief(
  messages: ConversationMessage[],
  fileSummaries: string[] = []
): Promise<BusinessBrief> {
  // Need at least one user message to extract anything meaningful
  if (!messages.some((m) => m.role === "user")) {
    return EMPTY_BRIEF;
  }

  // Attach file summaries as context after the conversation
  const analysisMessages: ConversationMessage[] = [...messages];
  if (fileSummaries.length > 0) {
    const context =
      "Additional context from uploaded files:\n\n" +
      fileSummaries.map((s, i) => `File ${i + 1}: ${s}`).join("\n\n");
    analysisMessages.push({ role: "user", content: context });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: analysisMessages,
    });

    const raw =
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
        ?.text ?? "";

    // Strip any accidental markdown fences before parsing
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (!isValidBrief(parsed)) {
      console.warn("[businessAnalyst] Invalid brief shape:", parsed);
      return EMPTY_BRIEF;
    }

    return parsed;
  } catch (err) {
    console.error("[businessAnalyst] Failed to extract brief:", err);
    return EMPTY_BRIEF;
  }
}
