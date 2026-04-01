import { supabase } from "@/lib/supabase";
import { assembleCRMPayload, type CRMPackagerInput } from "@/lib/agents/crmPackager";
import { validatePackage } from "@/lib/agents/validator";

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let input: CRMPackagerInput;

  // ── Parse body ─────────────────────────────────────────────────────────
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Minimal presence check ─────────────────────────────────────────────
  if (
    !input.sessionId ||
    !input.contact?.email ||
    !input.brief ||
    !input.serviceMatches ||
    !input.offer
  ) {
    return Response.json(
      {
        error:
          "Missing required fields: sessionId, contact.email, brief, serviceMatches, offer",
      },
      { status: 400 }
    );
  }

  // ── Re-run validation as the final gate ────────────────────────────────
  //
  // The payload assembled by crmPackager is validated fresh here —
  // we don't trust the validation that arrived from the client since
  // it may be stale (e.g. user went back and changed something).
  const conversationExcerpt = (input.conversationHistory ?? [])
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  let validation;
  try {
    validation = await validatePackage({
      brief: input.brief,
      serviceMatches: input.serviceMatches,
      fileSummaries: input.fileSummaries ?? [],
      conversationExcerpt,
    });
  } catch {
    return Response.json(
      { error: "Validation agent failed — cannot write to CRM" },
      { status: 500 }
    );
  }

  if (!validation.safe_to_write_to_crm) {
    return Response.json(
      {
        error: "Validation did not pass — data is not safe to write to CRM",
        missing_required_fields: validation.missing_required_fields,
        unsupported_claims: validation.unsupported_claims,
      },
      { status: 422 }
    );
  }

  // ── Assemble the full CRM payload ──────────────────────────────────────
  const payload = assembleCRMPayload({ ...input, validation });

  // ── Write: leads ───────────────────────────────────────────────────────
  const { data: leadRow, error: leadError } = await supabase
    .from("leads")
    .insert({
      session_id: payload.session_id,
      name: payload.lead.name,
      company_name: payload.lead.company_name,
      role: payload.lead.role || null,
      email: payload.lead.email,
      phone_or_messenger: payload.lead.phone_or_messenger || null,
      website: payload.lead.website || null,
      market_geography: payload.lead.market_geography || null,
    })
    .select("id")
    .single();

  if (leadError) {
    console.error("[crm/write] leads insert failed:", leadError);
    return Response.json(
      { error: "Failed to save lead data", detail: leadError.message },
      { status: 500 }
    );
  }

  const leadId: string = leadRow.id;

  // ── Write: crm_payloads ────────────────────────────────────────────────
  const { error: payloadError } = await supabase.from("crm_payloads").insert({
    session_id: payload.session_id,
    payload,
    validation_passed: validation.safe_to_write_to_crm,
  });

  if (payloadError) {
    console.error("[crm/write] crm_payloads insert failed:", payloadError);
    // Lead was already written — log and continue rather than leave things
    // half-done from the user's perspective.
    console.warn(
      "[crm/write] Lead saved (id=%s) but CRM payload write failed",
      leadId
    );
  }

  // ── Write: sessions (upsert current state to DONE) ─────────────────────
  const { error: sessionError } = await supabase.from("sessions").upsert(
    {
      id: payload.session_id,
      current_state: "DONE",
      conversation_history: input.conversationHistory ?? [],
      agent_outputs: {
        brief: input.brief,
        services: input.serviceMatches,
        validation,
        offer: input.offer,
      },
      file_summaries: input.fileSummaries ?? [],
      language: payload.language,
    },
    { onConflict: "id" }
  );

  if (sessionError) {
    console.error("[crm/write] sessions upsert failed:", sessionError);
    // Non-fatal — the lead and payload are the critical records.
  }

  return Response.json({ ok: true, lead_id: leadId });
}
