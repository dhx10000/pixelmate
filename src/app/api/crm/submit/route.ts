import type { BusinessBrief } from "@/lib/agents/businessAnalyst";
import type { ServiceMatchResult } from "@/lib/agents/serviceMatcher";
import type { OfferDraftResult } from "@/lib/agents/offerDrafter";
import type { ContactData } from "@/context/ChatContext";

// ── Types ──────────────────────────────────────────────────────────────────

type CRMPayload = {
  sessionId: string;
  submittedAt: string;
  contact: ContactData;
  brief: BusinessBrief;
  services: ServiceMatchResult;
  offer: OfferDraftResult;
};

// ── Route handler ──────────────────────────────────────────────────────────
//
// Stub — logs the full payload so it can be piped to a real CRM
// (Notion, HubSpot, Airtable, etc.) without changing the client contract.

export async function POST(request: Request) {
  let payload: CRMPayload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.contact?.email || !payload.sessionId) {
    return Response.json(
      { error: "Missing required fields: sessionId, contact.email" },
      { status: 400 }
    );
  }

  // TODO: Replace with a real CRM call (Notion, HubSpot, Airtable, etc.)
  // The payload contains: sessionId, submittedAt, contact, brief, services, offer

  return Response.json({ ok: true });
}
