import type { BusinessBrief } from "./businessAnalyst";
import type { ServiceMatchResult } from "./serviceMatcher";
import type { ValidationResult } from "./validator";

/**
 * Accumulated agent outputs that travel with the session.
 * Passed from frontend → route on every request, updated by the route,
 * returned via SSE, and stored back in the frontend context.
 */
export type AgentOutputs = {
  brief?: BusinessBrief;
  services?: ServiceMatchResult;
  validation?: ValidationResult;
};
