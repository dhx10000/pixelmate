import Anthropic from "@anthropic-ai/sdk";
import type { BusinessBrief } from "./businessAnalyst";

// ── Catalog ────────────────────────────────────────────────────────────────

export const SERVICE_CATALOG = [
  "brand_identity",
  "website_landing",
  "ai_assistant",
  "business_automation",
  "offer_messaging",
  "audit_strategy",
  "custom_digital_solution",
] as const;

export type ServiceCategory = (typeof SERVICE_CATALOG)[number];

// ── Schema ─────────────────────────────────────────────────────────────────

export type ServiceMatch = {
  /** One of the allowed service categories */
  service: ServiceCategory;
  /** Specific reason this service fits, grounded in the brief */
  why_it_matches: string;
  /** 0.0 = speculative, 1.0 = certain */
  confidence: number;
  /** Information that would raise confidence before recommending */
  what_is_missing: string;
};

export type ServiceMatchResult = {
  matches: ServiceMatch[];
  /** Highest-confidence match, or null if no match clears the threshold */
  top_match: ServiceCategory | null;
};

// ── Sentinel ───────────────────────────────────────────────────────────────

export const EMPTY_MATCH_RESULT: ServiceMatchResult = {
  matches: [],
  top_match: null,
};

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You match the user's need to PIXEL services. " +
  "Allowed service categories: brand_identity, website_landing, ai_assistant, " +
  "business_automation, offer_messaging, audit_strategy, custom_digital_solution. " +
  "For each suggested service return: service, why_it_matches, confidence (0.0–1.0), " +
  "what_is_missing. " +
  "Rules: Do not recommend a service without evidence from the brief. " +
  "Do not output services outside the allowed catalog. " +
  "Only include matches with confidence >= 0.2 — skip speculative noise. " +
  "Output valid JSON only — a single object with a 'matches' array. No markdown.";

// ── Validation ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<string>(SERVICE_CATALOG);

function isValidMatch(obj: unknown): obj is ServiceMatch {
  if (!obj || typeof obj !== "object") return false;
  const m = obj as Record<string, unknown>;
  return (
    typeof m.service === "string" &&
    VALID_CATEGORIES.has(m.service) &&
    typeof m.why_it_matches === "string" &&
    typeof m.confidence === "number" &&
    m.confidence >= 0 &&
    m.confidence <= 1 &&
    typeof m.what_is_missing === "string"
  );
}

function isValidResult(obj: unknown): obj is { matches: ServiceMatch[] } {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Record<string, unknown>;
  return Array.isArray(r.matches) && r.matches.every(isValidMatch);
}

// ── Main function ──────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Matches a BusinessBrief to PIXEL's service catalog.
 * Runs silently — never shown directly to the user.
 * Never throws — returns EMPTY_MATCH_RESULT on any failure.
 */
export async function matchServices(
  brief: BusinessBrief
): Promise<ServiceMatchResult> {
  // Skip if the brief is entirely unresolved
  if (
    brief.current_problem === "UNKNOWN" &&
    brief.desired_outcome === "UNKNOWN" &&
    brief.business_type === "UNKNOWN"
  ) {
    return EMPTY_MATCH_RESULT;
  }

  const briefJson = JSON.stringify(brief, null, 2);
  const prompt =
    "Here is the structured business brief extracted from the conversation:\n\n" +
    `\`\`\`json\n${briefJson}\n\`\`\`\n\n` +
    "Based on this brief, which PIXEL services are a strong match? " +
    "Return only services supported by evidence in the brief.";

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
      console.warn("[serviceMatcher] Invalid result shape:", parsed);
      return EMPTY_MATCH_RESULT;
    }

    // Sort by confidence descending
    const sorted = [...parsed.matches].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0]?.service ?? null;

    return { matches: sorted, top_match: top };
  } catch (err) {
    console.error("[serviceMatcher] Failed to match services:", err);
    return EMPTY_MATCH_RESULT;
  }
}
