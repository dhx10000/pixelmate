import Anthropic from "@anthropic-ai/sdk";
import type { BusinessBrief } from "./businessAnalyst";
import type { ServiceMatchResult } from "./serviceMatcher";

// ── Schema ─────────────────────────────────────────────────────────────────

export type ValidationResult = {
  /** True only when every material claim is grounded in the conversation */
  supported: boolean;
  /** Claims present in the package that have no basis in the conversation */
  unsupported_claims: string[];
  /** Direct conflicts between statements in the package */
  contradictions: string[];
  /** Fields required for a usable brief that are still UNKNOWN or empty */
  missing_required_fields: string[];
  /** Safe to render a summary or offer to the end user */
  safe_to_send_to_user: boolean;
  /** Safe to write to a CRM, Notion, or PIXEL team intake system */
  safe_to_write_to_crm: boolean;
};

// ── Sentinel ───────────────────────────────────────────────────────────────
//
// Returned on any failure — maximally conservative so a broken validation
// never silently allows bad data through.

export const BLOCKED_RESULT: ValidationResult = {
  supported: false,
  unsupported_claims: ["Validation could not be completed."],
  contradictions: [],
  missing_required_fields: ["Unknown — validation failed."],
  safe_to_send_to_user: false,
  safe_to_write_to_crm: false,
};

// ── Input type ─────────────────────────────────────────────────────────────

export type ValidationInput = {
  brief: BusinessBrief;
  serviceMatches: ServiceMatchResult;
  fileSummaries: string[];
  conversationExcerpt: string;
};

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "Check the final package for hallucinations and unsupported claims. " +
  "Return: supported (true/false), unsupported_claims (string[]), " +
  "contradictions (string[]), missing_required_fields (string[]), " +
  "safe_to_send_to_user (true/false), safe_to_write_to_crm (true/false). " +
  "Rules: A claim is unsupported if it cannot be traced to a specific user statement. " +
  "safe_to_send_to_user requires: supported=true AND no critical missing fields. " +
  "safe_to_write_to_crm requires: safe_to_send_to_user=true AND contact details present. " +
  "Be strict — err on the side of flagging. Output valid JSON only. No markdown.";

// ── Validation ─────────────────────────────────────────────────────────────

function isValidResult(obj: unknown): obj is ValidationResult {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.supported === "boolean" &&
    Array.isArray(r.unsupported_claims) &&
    Array.isArray(r.contradictions) &&
    Array.isArray(r.missing_required_fields) &&
    typeof r.safe_to_send_to_user === "boolean" &&
    typeof r.safe_to_write_to_crm === "boolean"
  );
}

// ── Main function ──────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * MUST run before showing any summary or offer to the user, or writing
 * to any external system.
 *
 * Never throws — returns BLOCKED_RESULT on any failure so that downstream
 * code can gate safely on `safe_to_send_to_user`.
 */
export async function validatePackage(
  input: ValidationInput
): Promise<ValidationResult> {
  const { brief, serviceMatches, fileSummaries, conversationExcerpt } = input;

  const packageJson = JSON.stringify(
    {
      business_brief: brief,
      service_matches: serviceMatches.matches,
      top_match: serviceMatches.top_match,
      file_summaries: fileSummaries,
    },
    null,
    2
  );

  const prompt =
    "Below is the full package assembled for this user session. " +
    "Cross-reference every claim in the package against the conversation excerpt " +
    "and flag anything that is invented, over-stated, or contradicted.\n\n" +
    "---\n\n" +
    "## Assembled Package\n\n" +
    `\`\`\`json\n${packageJson}\n\`\`\`\n\n` +
    "---\n\n" +
    "## Conversation Excerpt (source of truth)\n\n" +
    conversationExcerpt;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
        ?.text ?? "";

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (!isValidResult(parsed)) {
      console.warn("[validator] Invalid result shape:", parsed);
      return BLOCKED_RESULT;
    }

    // Enforce logical consistency regardless of what Claude returned:
    // safe_to_write_to_crm can never be true if safe_to_send_to_user is false.
    if (!parsed.safe_to_send_to_user && parsed.safe_to_write_to_crm) {
      parsed.safe_to_write_to_crm = false;
      parsed.unsupported_claims.push(
        "safe_to_write_to_crm overridden: cannot write to CRM when safe_to_send_to_user is false."
      );
    }

    return parsed;
  } catch (err) {
    console.error("[validator] Failed to validate package:", err);
    return BLOCKED_RESULT;
  }
}
