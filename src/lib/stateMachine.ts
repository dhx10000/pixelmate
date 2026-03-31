// ── States ─────────────────────────────────────────────────────────────────

export type ConversationState =
  | "WELCOME"
  | "INTENT_CAPTURE"
  | "BUSINESS_CONTEXT"
  | "PROBLEM_DISCOVERY"
  | "GOAL_DISCOVERY"
  | "ASSET_COLLECTION"
  | "FILE_REVIEW"
  | "SERVICE_MATCH"
  | "SUMMARY_REVIEW"
  | "CONTACT_CAPTURE"
  | "OFFER_DRAFT"
  | "CASE_RECOMMENDATION"
  | "HUMAN_HANDOFF"
  | "DONE";

// ── Transition map ─────────────────────────────────────────────────────────
//
// Values are the states that are reachable from each key.
// HUMAN_HANDOFF is always implicitly reachable from any state (see canTransitionTo).

export const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  WELCOME:            ["INTENT_CAPTURE"],
  INTENT_CAPTURE:     ["BUSINESS_CONTEXT", "ASSET_COLLECTION"],
  BUSINESS_CONTEXT:   ["PROBLEM_DISCOVERY"],
  PROBLEM_DISCOVERY:  ["GOAL_DISCOVERY"],
  GOAL_DISCOVERY:     ["SERVICE_MATCH"],
  ASSET_COLLECTION:   ["FILE_REVIEW"],
  FILE_REVIEW:        ["SERVICE_MATCH"],
  SERVICE_MATCH:      ["SUMMARY_REVIEW"],
  SUMMARY_REVIEW:     ["CONTACT_CAPTURE"],
  CONTACT_CAPTURE:    ["OFFER_DRAFT"],
  OFFER_DRAFT:        ["CASE_RECOMMENDATION", "HUMAN_HANDOFF", "DONE"],
  CASE_RECOMMENDATION:["DONE", "HUMAN_HANDOFF"],
  HUMAN_HANDOFF:      ["DONE"],
  DONE:               [],
};

// ── Context ────────────────────────────────────────────────────────────────
//
// Signals derived from the conversation that drive transition decisions.
// All fields are optional — missing signals are treated as false/absent.

export type ConversationContext = {
  /** User mentioned uploading or sharing files / existing assets */
  hasAssets?: boolean;
  /** Files have been uploaded and are ready for review */
  filesUploaded?: boolean;
  /** Contact information (name, email, etc.) has been captured */
  contactCaptured?: boolean;
  /** The agent cannot determine a path forward and should defer to a human */
  needsHumanHandoff?: boolean;
  /** Enough context has been collected to draft a concrete offer */
  offerReady?: boolean;
  /** A specific service has been matched to the user's need */
  serviceMatched?: boolean;
  /** The conversation has reached a natural conclusion */
  conversationComplete?: boolean;
};

// ── Guards ─────────────────────────────────────────────────────────────────

/**
 * Returns true if transitioning from `from` to `to` is structurally valid.
 * HUMAN_HANDOFF is always a valid target from any non-terminal state.
 */
export function canTransitionTo(
  from: ConversationState,
  to: ConversationState
): boolean {
  if (from === "DONE") return false;
  if (to === "HUMAN_HANDOFF") return true;
  return TRANSITIONS[from].includes(to);
}

// ── Transition function ────────────────────────────────────────────────────

/**
 * Given the current state and a snapshot of conversation signals, returns
 * the most appropriate next state.
 *
 * The function is deterministic and pure — it does not mutate state or
 * produce side effects. Callers are responsible for persisting the result.
 */
export function getNextState(
  current: ConversationState,
  context: ConversationContext
): ConversationState {
  // Hard exits — check these first regardless of current state
  if (context.needsHumanHandoff && current !== "HUMAN_HANDOFF" && current !== "DONE") {
    return "HUMAN_HANDOFF";
  }

  switch (current) {
    case "WELCOME":
      return "INTENT_CAPTURE";

    case "INTENT_CAPTURE":
      // Route through asset collection if the user has files to share
      return context.hasAssets ? "ASSET_COLLECTION" : "BUSINESS_CONTEXT";

    case "BUSINESS_CONTEXT":
      return "PROBLEM_DISCOVERY";

    case "PROBLEM_DISCOVERY":
      return "GOAL_DISCOVERY";

    case "GOAL_DISCOVERY":
      return "SERVICE_MATCH";

    case "ASSET_COLLECTION":
      // Wait here until files are actually uploaded; stay put otherwise
      return context.filesUploaded ? "FILE_REVIEW" : "ASSET_COLLECTION";

    case "FILE_REVIEW":
      return "SERVICE_MATCH";

    case "SERVICE_MATCH":
      return context.serviceMatched ? "SUMMARY_REVIEW" : "SERVICE_MATCH";

    case "SUMMARY_REVIEW":
      return "CONTACT_CAPTURE";

    case "CONTACT_CAPTURE":
      return context.contactCaptured ? "OFFER_DRAFT" : "CONTACT_CAPTURE";

    case "OFFER_DRAFT":
      if (context.conversationComplete) return "DONE";
      if (context.offerReady) return "CASE_RECOMMENDATION";
      return "HUMAN_HANDOFF";

    case "CASE_RECOMMENDATION":
      return context.conversationComplete ? "DONE" : "HUMAN_HANDOFF";

    case "HUMAN_HANDOFF":
      return "DONE";

    case "DONE":
      return "DONE";
  }
}

// ── Metadata ───────────────────────────────────────────────────────────────
//
// Human-readable labels and descriptions for each state.
// Useful for logging, debugging, and building progress indicators.

export const STATE_META: Record<
  ConversationState,
  { label: string; description: string }
> = {
  WELCOME: {
    label: "Welcome",
    description: "Initial greeting — orient the user.",
  },
  INTENT_CAPTURE: {
    label: "Intent Capture",
    description: "Understand what the user is trying to achieve.",
  },
  BUSINESS_CONTEXT: {
    label: "Business Context",
    description: "Learn about their business, industry, and audience.",
  },
  PROBLEM_DISCOVERY: {
    label: "Problem Discovery",
    description: "Identify the core challenge or pain point.",
  },
  GOAL_DISCOVERY: {
    label: "Goal Discovery",
    description: "Define what success looks like for them.",
  },
  ASSET_COLLECTION: {
    label: "Asset Collection",
    description: "Prompt the user to upload relevant files or links.",
  },
  FILE_REVIEW: {
    label: "File Review",
    description: "Review uploaded materials to inform recommendations.",
  },
  SERVICE_MATCH: {
    label: "Service Match",
    description: "Match the user's need to a PIXEL service or offering.",
  },
  SUMMARY_REVIEW: {
    label: "Summary Review",
    description: "Confirm the brief with the user before capturing contact.",
  },
  CONTACT_CAPTURE: {
    label: "Contact Capture",
    description: "Collect name, email, and any follow-up preferences.",
  },
  OFFER_DRAFT: {
    label: "Offer Draft",
    description: "Draft a concrete proposal or next-step offer.",
  },
  CASE_RECOMMENDATION: {
    label: "Case Recommendation",
    description: "Recommend a tailored case study or past project.",
  },
  HUMAN_HANDOFF: {
    label: "Human Handoff",
    description: "Defer to the PIXEL team for review or follow-up.",
  },
  DONE: {
    label: "Done",
    description: "Conversation complete.",
  },
};
