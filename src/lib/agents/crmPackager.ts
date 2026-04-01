import type { BusinessBrief } from "./businessAnalyst";
import type { ServiceMatchResult } from "./serviceMatcher";
import type { ValidationResult } from "./validator";
import type { OfferDraftResult } from "./offerDrafter";
import type { ContactData } from "@/context/ChatContext";

// ── Input ──────────────────────────────────────────────────────────────────

export type CRMPackagerInput = {
  sessionId: string;
  language?: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  contact: ContactData;
  /** Structured file summaries from the analyzeFiles flow */
  fileSummaries: string[];
  brief: BusinessBrief;
  serviceMatches: ServiceMatchResult;
  validation: ValidationResult;
  offer: OfferDraftResult;
};

// ── Output — exact CRM schema ──────────────────────────────────────────────

export type CRMFile = {
  file_id: string | null;
  type: string | null;
  title: string;
  summary: string;
};

export type CRMServiceMatch = {
  service: string;
  why_it_matches: string;
  confidence: number;
  what_is_missing: string[];
};

export type CRMPayload = {
  source: "pixelmate_landing";
  session_id: string;
  created_at: string;
  language: string;
  lead: {
    name: string;
    company_name: string;
    role: string;
    email: string;
    phone_or_messenger: string;
    website: string;
    market_geography: string;
  };
  business_context: {
    industry: string;
    business_model: string;
    target_audience: string[];
    business_stage: string;
    team_size: string;
    current_assets: string[];
    current_tools: string[];
  };
  diagnosis: {
    primary_request: string;
    problem_statement: string;
    desired_outcome: string;
    urgency: string;
    timeline: string;
    budget_range_optional: string;
    blockers: string[];
    missing_information: string[];
  };
  files: CRMFile[];
  service_match: CRMServiceMatch[];
  ai_outputs: {
    conversation_summary: string;
    structured_brief_json: BusinessBrief;
    draft_offer: string;
    case_studies_recommended: string[];
    recommended_next_step: string;
    handoff_required: boolean;
  };
  validation: {
    supported: boolean;
    unsupported_claims: string[];
    contradictions: string[];
    missing_required_fields: string[];
    safe_to_write_to_crm: boolean;
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Splits a comma/semicolon-separated string into a trimmed array.
 * Returns an empty array for "UNKNOWN" or blank values.
 */
function splitToArray(value: string): string[] {
  if (!value || value.toUpperCase() === "UNKNOWN") return [];
  return value
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the value unchanged, or an empty string if "UNKNOWN".
 */
function orEmpty(value: string): string {
  return value && value.toUpperCase() !== "UNKNOWN" ? value : "";
}

/**
 * Parses structured file summaries from the analyzeFiles flow.
 *
 * Each entry is produced by ChatContext.analyzeFiles as:
 *   "filename: summary text"
 * We split on the first colon to recover title + summary.
 * file_id and type are not available at this point so they are null / inferred.
 */
function parseFileSummaries(summaries: string[]): CRMFile[] {
  return summaries.map((entry) => {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) {
      return { file_id: null, type: null, title: entry, summary: "" };
    }
    const title = entry.slice(0, colonIdx).trim();
    const summary = entry.slice(colonIdx + 1).trim();
    const ext = title.split(".").pop()?.toLowerCase() ?? "";
    const type =
      ["pdf"].includes(ext)
        ? "pdf"
        : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
          ? "image"
          : ["doc", "docx"].includes(ext)
            ? "document"
            : ext || null;
    return { file_id: null, type, title, summary };
  });
}

/**
 * Extracts the recommended next step from the offer text.
 * Looks for a line that starts with "5." (the last structured section).
 * Falls back to an empty string if the section isn't found.
 */
function extractNextStep(offerText: string): string {
  const lines = offerText.split("\n");
  const idx = lines.findIndex((l) => /^5\.\s/i.test(l.trim()));
  if (idx === -1) return "";
  // Collect lines after the heading until the next numbered section or end
  const body: string[] = [];
  for (const line of lines.slice(idx + 1)) {
    if (/^\d+\.\s/.test(line.trim()) && body.length > 0) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

/**
 * Produces a short conversation summary: last two user messages joined.
 * The full history is preserved separately in structured_brief_json / draft_offer.
 */
function buildConversationSummary(
  history: { role: "user" | "assistant"; content: string }[]
): string {
  const userMessages = history
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  if (userMessages.length === 0) return "";
  const tail = userMessages.slice(-2);
  return tail.join(" … ");
}

// ── Main function ──────────────────────────────────────────────────────────

/**
 * Assembles the full CRM payload from session data.
 *
 * Pure function — no side effects, no I/O.
 * The caller (API route) is responsible for writing the result to the database.
 */
export function assembleCRMPayload(input: CRMPackagerInput): CRMPayload {
  const {
    sessionId,
    language = "en",
    conversationHistory,
    contact,
    fileSummaries,
    brief,
    serviceMatches,
    validation,
    offer,
  } = input;

  return {
    source: "pixelmate_landing",
    session_id: sessionId,
    created_at: new Date().toISOString(),
    language,

    // ── Lead ────────────────────────────────────────────────────────────────
    lead: {
      name: contact.name,
      company_name: contact.company_name,
      role: contact.role ?? "",
      email: contact.email,
      phone_or_messenger: contact.phone_or_messenger ?? "",
      website: contact.website ?? "",
      market_geography: "", // not collected in current flow — left for manual enrichment
    },

    // ── Business context ─────────────────────────────────────────────────────
    // BusinessBrief has a flat structure; we map to the richer CRM schema:
    //   business_type → industry (the closest equivalent)
    //   target_audience (string) → target_audience (string[]) via split
    //   constraints → blockers in diagnosis; current_tools inferred from assets
    business_context: {
      industry: orEmpty(brief.business_type),
      business_model: "",                          // not captured in current brief schema
      target_audience: splitToArray(brief.target_audience),
      business_stage: "",                          // not captured
      team_size: "",                               // not captured
      current_assets: brief.current_assets,
      current_tools: brief.constraints
        .filter((c) => /tool|platform|software|system|crm|cms|app/i.test(c)),
    },

    // ── Diagnosis ───────────────────────────────────────────────────────────
    diagnosis: {
      primary_request: serviceMatches.top_match ?? "",
      problem_statement: orEmpty(brief.current_problem),
      desired_outcome: orEmpty(brief.desired_outcome),
      urgency: brief.urgency,
      timeline: "",                                // not captured in current brief schema
      budget_range_optional: brief.constraints
        .filter((c) => /budget|cost|price|\$|€|£/i.test(c))
        .join("; "),
      blockers: brief.constraints.filter(
        (c) => !/tool|platform|software|system|crm|cms|app|budget|cost|price|\$|€|£/i.test(c)
      ),
      missing_information: brief.unknowns,
    },

    // ── Files ────────────────────────────────────────────────────────────────
    files: parseFileSummaries(fileSummaries),

    // ── Service match ────────────────────────────────────────────────────────
    // ServiceMatch.what_is_missing is a plain string from the agent;
    // we split it into an array for the CRM schema.
    service_match: serviceMatches.matches.map((m) => ({
      service: m.service,
      why_it_matches: m.why_it_matches,
      confidence: m.confidence,
      what_is_missing: splitToArray(m.what_is_missing),
    })),

    // ── AI outputs ───────────────────────────────────────────────────────────
    ai_outputs: {
      conversation_summary: buildConversationSummary(conversationHistory),
      structured_brief_json: brief,
      draft_offer: offer.text,
      case_studies_recommended: [],                // reserved for future case-rec agent
      recommended_next_step: extractNextStep(offer.text),
      handoff_required: offer.tier === "deferred" || !validation.safe_to_write_to_crm,
    },

    // ── Validation ───────────────────────────────────────────────────────────
    validation: {
      supported: validation.supported,
      unsupported_claims: validation.unsupported_claims,
      contradictions: validation.contradictions,
      missing_required_fields: validation.missing_required_fields,
      safe_to_write_to_crm: validation.safe_to_write_to_crm,
    },
  };
}
