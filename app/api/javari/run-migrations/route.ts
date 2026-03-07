// app/api/javari/run-migrations/route.ts
// Purpose: Self-executing DDL runner — creates execution_logs and guardrail_audit_log
//          using direct pg connection (DATABASE_URL). Idempotent — safe to run repeatedly.
// Date: 2026-03-07

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "create_execution_logs",
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
      CREATE INDEX IF NOT EXISTS idx_execution_logs_task_id
        ON execution_logs (task_id);
      CREATE INDEX IF NOT EXISTS idx_execution_logs_status
        ON execution_logs (status);
      CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp
        ON execution_logs (timestamp DESC);
      ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        CREATE POLICY "service_role_all" ON execution_logs
          FOR ALL TO service_role USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      GRANT ALL ON execution_logs TO service_role;
      GRANT USAGE ON SEQUENCE execution_logs_id_seq TO service_role;
    `.trim(),
  },
  {
    name: "recreate_guardrail_audit_log",
    sql: `
      DROP TABLE IF EXISTS guardrail_audit_log;
      CREATE TABLE guardrail_audit_log (
        id              BIGSERIAL    PRIMARY KEY,
        execution_id    TEXT         NOT NULL,
        task_id         TEXT         NOT NULL,
        guardrail_check TEXT         NOT NULL,
        outcome         TEXT         NOT NULL CHECK (outcome IN ('pass','block','rollback')),
        reason          TEXT         NOT NULL,
        meta            JSONB        NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_guardrail_audit_task_id
        ON guardrail_audit_log (task_id);
      CREATE INDEX IF NOT EXISTS idx_guardrail_audit_execution_id
        ON guardrail_audit_log (execution_id);
      CREATE INDEX IF NOT EXISTS idx_guardrail_audit_outcome
        ON guardrail_audit_log (outcome);
      ALTER TABLE guardrail_audit_log ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        CREATE POLICY "service_role_all" ON guardrail_audit_log
          FOR ALL TO service_role USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      GRANT ALL ON guardrail_audit_log TO service_role;
      GRANT USAGE ON SEQUENCE guardrail_audit_log_id_seq TO service_role;
    `.trim(),
  },
];

export async function POST() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({
      ok: false,
      error: "DATABASE_URL not set in Vercel environment",
      hint: "Add DATABASE_URL to Vercel project settings — format: postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    }, { status: 500 });
  }

  // Dynamic import — pg is available (^8.11.3 in package.json)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require("pg") as typeof import("pg");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });

  const results: Array<{ name: string; ok: boolean; error?: string }> = [];

  try {
    await client.connect();

    for (const migration of MIGRATIONS) {
      try {
        await client.query(migration.sql);
        results.push({ name: migration.name, ok: true });
        console.log(`[run-migrations] ✅ ${migration.name}`);
      } catch (err: unknown) {
        const message = (err as Error).message;
        results.push({ name: migration.name, ok: false, error: message });
        console.error(`[run-migrations] ❌ ${migration.name}: ${message}`);
      }
    }

    return NextResponse.json({
      ok: results.every(r => r.ok),
      migrations: results,
    });

  } catch (err: unknown) {
    const message = (err as Error).message;
    console.error("[run-migrations] Connection failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

export async function GET() {
  // Verify both tables are accessible via Supabase REST (post-migration check)
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const checks: Record<string, { accessible: boolean; count?: number; error?: string }> = {};

  for (const table of ["execution_logs", "guardrail_audit_log"]) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    checks[table] = error
      ? { accessible: false, error: error.message }
      : { accessible: true, count: count ?? 0 };
  }

  const allOk = Object.values(checks).every(c => c.accessible);
  return NextResponse.json({ ok: allOk, tables: checks });
}
