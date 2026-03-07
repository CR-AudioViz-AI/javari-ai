// app/api/javari/schema-fix/route.ts
// Purpose: One-shot schema repair — create execution_logs, fix guardrail_audit_log permissions
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Try inserting a test row to verify write access
async function verifyTableWrite(table: string, row: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { error } = await supabase.from(table).insert([row]);
  if (error) return { ok: false, error: error.message };
  // Clean up test row
  await supabase.from(table).delete().eq("execution_id", row.execution_id as string);
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const results: Record<string, unknown> = {};

  // ── Action: create-execution-logs ─────────────────────────────────────────
  if (action === "create-execution-logs" || action === "full-repair") {
    // Try creating execution_logs via Supabase's REST insert (no DDL needed —
    // Supabase auto-creates tables on insert is NOT a thing, so we need to check
    // if the table already exists via a different approach).
    //
    // The correct approach: attempt an insert with a probe row.
    // If it fails with "does not exist", the table needs DDL via Supabase dashboard.
    // If it succeeds, the table exists and we just delete the probe row.

    const probeRow = {
      execution_id: "probe-" + Date.now(),
      task_id: "probe",
      model_used: "probe",
      cost: 0,
      tokens_in: 0,
      tokens_out: 0,
      execution_time: 0,
      status: "success",
      timestamp: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from("execution_logs").insert([probeRow]);

    if (!insertErr) {
      // Table exists and is writable — clean up probe
      await supabase.from("execution_logs").delete().eq("execution_id", probeRow.execution_id);
      results["execution_logs"] = { status: "exists_and_writable" };
    } else if (insertErr.message.includes("schema cache") || insertErr.message.includes("does not exist")) {
      results["execution_logs"] = {
        status: "missing",
        action_required: "manual",
        sql: `
CREATE TABLE IF NOT EXISTS execution_logs (
  id             BIGSERIAL    PRIMARY KEY,
  execution_id   TEXT         NOT NULL,
  task_id        TEXT         NOT NULL,
  model_used     TEXT         NOT NULL DEFAULT 'unknown',
  cost           NUMERIC      NOT NULL DEFAULT 0,
  tokens_in      INTEGER      NOT NULL DEFAULT 0,
  tokens_out     INTEGER      NOT NULL DEFAULT 0,
  execution_time INTEGER      NOT NULL DEFAULT 0,
  status         TEXT         NOT NULL CHECK (status IN ('success','failed','retry','blocked')),
  error_message  TEXT,
  timestamp      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_execution_logs_task_id ON execution_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status  ON execution_logs (status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs (timestamp DESC);
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
        `.trim(),
        error: insertErr.message,
      };
    } else {
      results["execution_logs"] = { status: "error", error: insertErr.message };
    }
  }

  // ── Action: fix-guardrail-permissions ─────────────────────────────────────
  if (action === "fix-guardrail-permissions" || action === "full-repair") {
    const auditProbe = {
      execution_id: "probe-" + Date.now(),
      task_id: "probe",
      guardrail_check: "kill_switch",
      outcome: "pass",
      reason: "probe",
      meta: {},
      created_at: new Date().toISOString(),
    };

    const { error: auditErr } = await supabase.from("guardrail_audit_log").insert([auditProbe]);

    if (!auditErr) {
      await supabase.from("guardrail_audit_log").delete().eq("execution_id", auditProbe.execution_id);
      results["guardrail_audit_log"] = { status: "exists_and_writable" };
    } else if (auditErr.message.includes("permission denied")) {
      results["guardrail_audit_log"] = {
        status: "permission_denied",
        action_required: "manual",
        sql: `
-- Run these in Supabase SQL Editor (guardrail_audit_log already exists):
ALTER TABLE guardrail_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_all" ON guardrail_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON guardrail_audit_log TO service_role;
GRANT USAGE ON SEQUENCE guardrail_audit_log_id_seq TO service_role;
        `.trim(),
        error: auditErr.message,
      };
    } else {
      results["guardrail_audit_log"] = { status: "error", error: auditErr.message };
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  // Quick table health check
  const checks: Record<string, unknown> = {};

  for (const table of ["execution_logs", "guardrail_audit_log"]) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    checks[table] = error
      ? { accessible: false, error: error.message }
      : { accessible: true };
  }

  return NextResponse.json({ ok: true, tables: checks });
}
