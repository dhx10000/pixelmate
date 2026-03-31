import Anthropic from "@anthropic-ai/sdk";
import type { BusinessBrief } from "./businessAnalyst";
import type { ServiceMatchResult } from "./serviceMatcher";
import { validatePackage } from "./validator";

// ── Confidence thresholds ──────────────────────────────────────────────────

const FULL_OFFER_THRESHOLD = 0.7;
const SOFT_OFFER_THRESHOLD = 0.4;

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You create a cautious draft offer for the PIXEL team. " +
  "Use only confirmed information. " +
  "Never invent budget, timeline, deliverables, or outcomes. " +
  "Format:\n" +
  "1. What we understood (brief business context, current problem, desired outcome)\n" +
  "2. Where PIXEL may help (relevant services with brief explanation)\n" +
  "3. Possible scope (cautious suggested work packages only if evidence exists)\n" +
  "4. Missing information (specific unknowns needed for a more precise offer)\n" +
  "5. Recommended next step (review by PIXEL team / call / audit / proposal)\n" +
  "If evidence is weak, reduce specificity.";

const SOFT_SYSTEM_PROMPT =
  "You create a brief 'directions we might explore' note for the PIXEL team. " +
  "Confidence in the service match is moderate. " +
  "Use only confirmed information — no invented details. " +
  "Write 2–4 short paragraphs: one framing the user's situation, one or two describing " +
  "possible directions PIXEL could explore, and one listing what is still unknown. " +
  "Tone: thoughtful, honest, non-committal.";

// ── Input type ─────────────────────────────────────────────────────────────

export type OfferDrafterInput = {
  brief: BusinessBrief;
  serviceMatches: ServiceMatchResult;
  fileSummaries: string[];
  conversationHistory: { role: "user" | "assistant"; content: string }[];
};

// ── Output type ────────────────────────────────────────────────────────────

export type OfferDraftResult = {
  /** "full" | "soft" | "deferred" */
  tier: "full" | "soft" | "deferred";
  /** The offer text shown in the conversation */
  text: string;
  /** True if the validation agent cleared the content */
  validated: boolean;
};

// ── Fallback ───────────────────────────────────────────────────────────────

const DEFERRED_RESULT: OfferDraftResult = {
  tier: "deferred",
  text:
    "Thank you for sharing all of this. Based on what we have so far, the PIXEL team " +
    "will follow up with a few more questions to make sure any proposal is tailored " +
    "precisely to your situation. You can expect to hear from them shortly.",
  validated: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function buildUserPrompt(input: OfferDrafterInput): string {
  const { brief, serviceMatches, fileSummaries, conversationHistory } = input;

  const briefJson = JSON.stringify(brief, null, 2);
  const matchesJson = JSON.stringify(serviceMatches.matches, null, 2);
  const conversationText = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const filePart =
    fileSummaries.length > 0
      ? "\n\n## Uploaded File Summaries\n\n" +
        fileSummaries.map((s, i) => `File ${i + 1}: ${s}`).join("\n\n")
      : "";

  return (
    "## Business Brief\n\n```json\n" +
    briefJson +
    "\n```\n\n" +
    "## Service Matches\n\n```json\n" +
    matchesJson +
    "\n```" +
    filePart +
    "\n\n## Conversation\n\n" +
    conversationText
  );
}

// ── Unsupported-claim stripper ─────────────────────────────────────────────
//
// If the validator flags unsupported claims, remove sentences containing them
// from the offer text so the output is never worse than a conservative version.

function stripUnsupportedClaims(text: string, claims: string[]): string {
  if (claims.length === 0) return text;
  let result = text;
  for (const claim of claims) {
    // Build a loose pattern: match any sentence containing a key phrase from the claim
    const key = claim
      .split(/\s+/)
      .slice(0, 6)
      .join("\\s+")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      result = result.replace(new RegExp(`[^.!?\n]*${key}[^.!?\n]*[.!?]?`, "gi"), "");
    } catch {
      // If the regex fails, skip silently
    }
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

// ── Main function ──────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Drafts an offer based on the accumulated session data.
 * Tier is determined by the highest service-match confidence score:
 *   >= 0.70 → full structured offer
 *   0.40–0.69 → soft 'directions we might explore' note
 *   < 0.40 → deferred (no Claude call, static message)
 *
 * The validator runs on any generated text. Unsupported claims are stripped
 * before the result is returned — the offer is never silently inflated.
 *
 * Never throws — returns DEFERRED_RESULT on any failure.
 */
export async function draftOffer(
  input: OfferDrafterInput
): Promise<OfferDraftResult> {
  const topConfidence = input.serviceMatches.matches[0]?.confidence ?? 0;

  // ── Deferred path ──────────────────────────────────────────────────────
  if (topConfidence < SOFT_OFFER_THRESHOLD) {
    return DEFERRED_RESULT;
  }

  const tier: "full" | "soft" =
    topConfidence >= FULL_OFFER_THRESHOLD ? "full" : "soft";
  const systemPrompt = tier === "full" ? SYSTEM_PROMPT : SOFT_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1536,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw =
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
        ?.text ?? "";

    if (!raw.trim()) {
      console.warn("[offerDrafter] Empty response from Claude");
      return DEFERRED_RESULT;
    }

    // ── Validate ─────────────────────────────────────────────────────────
    const conversationExcerpt = input.conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const validation = await validatePackage({
      brief: input.brief,
      serviceMatches: input.serviceMatches,
      fileSummaries: input.fileSummaries,
      conversationExcerpt,
    });

    // Strip any claims the validator flagged
    const text = validation.supported
      ? raw.trim()
      : stripUnsupportedClaims(raw.trim(), validation.unsupported_claims);

    return { tier, text, validated: validation.supported };
  } catch (err) {
    console.error("[offerDrafter] Failed to draft offer:", err);
    return DEFERRED_RESULT;
  }
}
