import { Resend } from "resend";
import type { CRMPayload } from "@/lib/agents/crmPackager";

const resend = new Resend(process.env.RESEND_API_KEY);

const TEAM_EMAIL = process.env.PIXEL_TEAM_EMAIL ?? "team@pixelsite.ai";
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL ?? "PixelMate <noreply@pixelsite.ai>";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// ── HTML helpers ───────────────────────────────────────────────────────────

function section(title: string, content: string): string {
  return `
    <tr>
      <td style="padding:0 0 28px;">
        <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;
                  text-transform:uppercase;color:#888;">${title}</p>
        <div style="font-size:14px;color:#333;line-height:1.6;">${content}</div>
      </td>
    </tr>`;
}

function pill(label: string, color = "#1a1a1a", bg = "#f0f0f0"): string {
  return `<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 10px;
    border-radius:100px;font-size:12px;font-weight:600;background:${bg};color:${color};">${label}</span>`;
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return "#16a34a"; // green
  if (c >= 0.4) return "#d97706"; // amber
  return "#dc2626";               // red
}

function buildHtml(payload: CRMPayload, leadId: string): string {
  const { lead, diagnosis, service_match, ai_outputs, session_id } = payload;

  // ── Lead pills ─────────────────────────────────────────────────────────
  const leadRows = [
    lead.company_name && `<strong>${lead.company_name}</strong>`,
    lead.role && `Role: ${lead.role}`,
    `Email: <a href="mailto:${lead.email}" style="color:#2563eb;">${lead.email}</a>`,
    lead.phone_or_messenger && `Phone/Messenger: ${lead.phone_or_messenger}`,
    lead.website &&
      `Website: <a href="${lead.website}" style="color:#2563eb;">${lead.website}</a>`,
  ]
    .filter(Boolean)
    .map((r) => `<p style="margin:2px 0;">${r}</p>`)
    .join("");

  // ── Service match rows ─────────────────────────────────────────────────
  const serviceRows = service_match
    .slice(0, 5)
    .map((m) => {
      const pct = Math.round(m.confidence * 100);
      const color = confidenceColor(m.confidence);
      return `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
            <span style="font-weight:600;font-size:13px;">${m.service.replace(/_/g, " ")}</span>
            <span style="margin-left:8px;font-size:12px;font-weight:700;color:${color};">${pct}%</span>
            <br>
            <span style="font-size:12px;color:#666;">${m.why_it_matches}</span>
          </td>
        </tr>`;
    })
    .join("");

  // ── Supabase deep-link ─────────────────────────────────────────────────
  const supabaseLink = SUPABASE_URL
    ? `${SUPABASE_URL.replace(/\/$/, "")}/project/default/editor`
    : null;

  const viewLink = supabaseLink
    ? `<a href="${supabaseLink}" style="color:#2563eb;font-size:13px;">
        View in Supabase →
       </a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0c;padding:24px 32px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;
                      text-transform:uppercase;color:#c8f560;">PIXEL · PixelMate</p>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">
              New lead: ${lead.name}
            </h1>
            <p style="margin:4px 0 0;font-size:13px;color:#9a9590;">
              ${lead.company_name}${diagnosis.primary_request ? " · " + diagnosis.primary_request.replace(/_/g, " ") : ""}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <table width="100%" cellpadding="0" cellspacing="0">

            ${section("Contact", leadRows)}

            ${section(
              "What they need",
              `<p style="margin:0 0 6px;">${diagnosis.problem_statement || "—"}</p>
               <p style="margin:0;"><strong>Goal:</strong> ${diagnosis.desired_outcome || "—"}</p>
               ${diagnosis.urgency !== "unknown" ? `<p style="margin:4px 0 0;"><strong>Urgency:</strong> ${diagnosis.urgency}</p>` : ""}`
            )}

            ${section(
              "Matched services",
              `<table width="100%" cellpadding="0" cellspacing="0">${serviceRows}</table>`
            )}

            ${
              ai_outputs.conversation_summary
                ? section(
                    "Conversation summary",
                    `<p style="margin:0;color:#555;font-style:italic;">"${ai_outputs.conversation_summary}"</p>`
                  )
                : ""
            }

            ${section(
              "Draft offer",
              `<pre style="margin:0;white-space:pre-wrap;font-family:inherit;
                           font-size:13px;color:#333;background:#f9f9f9;
                           border:1px solid #e5e5e5;border-radius:8px;
                           padding:16px;">${ai_outputs.draft_offer || "Deferred — team follow-up required."}</pre>`
            )}

            ${
              ai_outputs.recommended_next_step
                ? section(
                    "Recommended next step",
                    `<p style="margin:0;font-weight:600;color:#1a1a1a;">${ai_outputs.recommended_next_step}</p>`
                  )
                : ""
            }

            ${
              ai_outputs.handoff_required
                ? section(
                    "Action required",
                    pill("⚠ Human handoff required", "#fff", "#d97706")
                  )
                : ""
            }

            <!-- Footer links -->
            <tr>
              <td style="padding-top:8px;border-top:1px solid #e5e5e5;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#aaa;">
                      Lead ID: ${leadId}<br>
                      Session: ${session_id}
                    </td>
                    <td align="right">${viewLink}</td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Input type ─────────────────────────────────────────────────────────────

type NotifyInput = {
  payload: CRMPayload;
  leadId: string;
};

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: NotifyInput;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.payload || !body.leadId) {
    return Response.json(
      { error: "Missing required fields: payload, leadId" },
      { status: 400 }
    );
  }

  const { payload, leadId } = body;
  const { lead, diagnosis } = payload;

  const serviceLabel =
    payload.service_match[0]?.service.replace(/_/g, " ") ?? "request";
  const subject = `New PixelMate lead: ${lead.company_name} — ${serviceLabel}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: TEAM_EMAIL,
    subject,
    html: buildHtml(payload, leadId),
  });

  if (error) {
    console.error("[notify] Resend error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
