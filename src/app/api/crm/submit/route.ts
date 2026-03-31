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

  // ── Log intake (replace with real CRM call) ────────────────────────────
  console.log("[crm] New submission", {
    sessionId: payload.sessionId,
    submittedAt: payload.submittedAt,
    contact: payload.contact,
    topService: payload.services?.top_match ?? "unknown",
    offerTier: payload.offer?.tier ?? "unknown",
  });

  // Full payload logged at debug level — contains brief + offer text
  console.debug("[crm] Full payload", JSON.stringify(payload, null, 2));

  return Response.json({ ok: true });
}
