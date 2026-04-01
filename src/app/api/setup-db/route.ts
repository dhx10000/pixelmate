import { supabase } from "@/lib/supabase";

// ── DDL statements ─────────────────────────────────────────────────────────
//
// Executed in dependency order:
//   sessions (no deps) → leads, crm_payloads, files (all reference sessions)
//
// Each statement is wrapped in IF NOT EXISTS / DO NOTHING guards so the
// route is safe to call multiple times without destroying existing data.

const DDL_STATEMENTS = [
  // ── sessions ──────────────────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ NOT NULL    DEFAULT now(),
    language            TEXT,
    current_state       TEXT,
    conversation_history JSONB,
    agent_outputs       JSONB,
    file_summaries      JSONB
  );
  `,

  // ── leads ─────────────────────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS leads (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        REFERENCES sessions (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL    DEFAULT now(),
    name                TEXT        NOT NULL,
    company_name        TEXT        NOT NULL,
    role                TEXT,
    email               TEXT        NOT NULL,
    phone_or_messenger  TEXT,
    website             TEXT,
    market_geography    TEXT
  );
  `,

  // ── crm_payloads ──────────────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS crm_payloads (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        REFERENCES sessions (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL    DEFAULT now(),
    payload             JSONB       NOT NULL,
    validation_passed   BOOLEAN
  );
  `,

  // ── files ─────────────────────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS files (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        REFERENCES sessions (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL    DEFAULT now(),
    filename            TEXT,
    file_type           TEXT,
    summary             TEXT,
    storage_path        TEXT
  );
  `,
];

// ── Route handler ──────────────────────────────────────────────────────────
//
// Intended for one-time setup or CI. Guard this route in production:
// add a secret header check, or remove it after first run.

export async function POST() {
  const errors: { statement: string; error: string }[] = [];

  for (const sql of DDL_STATEMENTS) {
    const { error } = await supabase.rpc("exec_sql", { sql: sql.trim() });

    if (error) {
      // Fall back to direct query if the exec_sql helper isn't installed
      // (Supabase projects don't have it by default — we use the REST DDL path instead)
      errors.push({ statement: sql.trim().split("\n")[0], error: error.message });
    }
  }

  if (errors.length > 0) {
    return Response.json(
      {
        ok: false,
        message:
          "Some statements failed. " +
          "If you see 'function exec_sql does not exist', run the DDL " +
          "manually in the Supabase SQL editor — see the response body for the statements.",
        errors,
        ddl: DDL_STATEMENTS.map((s) => s.trim()),
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    message: "All tables created (or already exist).",
    tables: ["sessions", "leads", "crm_payloads", "files"],
  });
}

// GET — returns the raw DDL so you can run it manually in the SQL editor
export async function GET() {
  return Response.json({
    message:
      "POST to this endpoint to run setup, or copy the DDL below into " +
      "the Supabase SQL Editor (Dashboard → SQL Editor → New query).",
    ddl: DDL_STATEMENTS.map((s) => s.trim()),
  });
}
