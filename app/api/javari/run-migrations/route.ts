// app/api/javari/run-migrations/route.ts
// Purpose: Self-executing DDL runner — creates execution_logs and guardrail_audit_log
//          via Supabase session pooler (reachable from Vercel serverless). Idempotent.
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

// Build pooler connection URL from Supabase project ref + password
// Falls back to DATABASE_URL if already in pooler format
function buildConnectionUrl(): string | null {
  // If DATABASE_URL is set and uses the pooler host, use it directly
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.includes("pooler.supabase.com")) {
    return dbUrl;
  }

  // Build pooler URL from SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pass = process.env.SUPABASE_DB_PASSWORD;
  if (ref && pass) {
    // Session pooler — compatible with prepared statements, reachable from Vercel
    return `postgresql://postgres.${ref}:${pass}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
  }

  return null;
}

export async function POST() {
  // First try: use pg with pooler URL
  const connUrl = buildConnectionUrl();

  if (connUrl) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require("pg") as typeof import("pg");
    const client = new Client({
      connectionString: connUrl,
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
          results.push({ name: migration.name, ok: false, error: (err as Error).message });
          console.error(`[run-migrations] ❌ ${migration.name}:`, (err as Error).message);
        }
      }
      return NextResponse.json({ ok: results.every(r => r.ok), method: "pg_pooler", migrations: results });
    } catch (err: unknown) {
      console.error("[run-migrations] pg connection failed:", (err as Error).message);
      // Fall through to Supabase REST fallback
    } finally {
      try { await client.end(); } catch { /* ignore */ }
    }
  }

  // Fallback: use Supabase REST to verify table access
  // (Cannot run arbitrary DDL via REST, but can confirm what exists)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const checks: Record<string, unknown> = {};
  for (const table of ["execution_logs", "guardrail_audit_log"]) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    checks[table] = error
      ? { accessible: false, error: error.message }
      : { accessible: true, count: count ?? 0 };
  }

  const missing: string[] = [];
  const requiredSql: Record<string, string> = {};
  for (const m of MIGRATIONS) {
    const check = checks[m.name.replace("create_", "").replace("recreate_", "")] as { accessible?: boolean } | undefined;
    if (!check?.accessible) {
      missing.push(m.name);
      requiredSql[m.name] = m.sql;
    }
  }

  return NextResponse.json({
    ok: missing.length === 0,
    method: "rest_fallback",
    tables: checks,
    missing,
    connection_hint: connUrl
      ? "pg connection failed — run DDL manually in Supabase SQL Editor"
      : "SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD not set — add to Vercel env vars",
    required_sql: missing.length > 0 ? requiredSql : undefined,
  });
}

export async function GET() {
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
  return NextResponse.json({
    ok: Object.values(checks).every(c => c.accessible),
    tables: checks,
    connection_info: {
      has_project_ref: !!process.env.SUPABASE_PROJECT_REF,
      has_db_password: !!process.env.SUPABASE_DB_PASSWORD,
      has_db_url: !!process.env.DATABASE_URL,
      db_url_type: (process.env.DATABASE_URL ?? "").includes("pooler") ? "pooler" : "direct",
    },
  });
}

// PATCH: Send NOTIFY pgrst, 'reload schema' to force PostgREST cache refresh
// Used when tables are created via direct SQL and PostgREST hasn't picked them up yet.
export async function PATCH() {
  const connUrl = buildConnectionUrl();
  if (!connUrl) {
    return NextResponse.json({
      ok: false,
      error: "SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD not configured — cannot send NOTIFY",
    }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require("pg") as typeof import("pg");
  const client = new Client({
    connectionString: connUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema'");
    await client.end();
    console.log("[run-migrations] PostgREST schema cache reload notified");
    return NextResponse.json({
      ok: true,
      action: "schema_reload",
      message: "NOTIFY pgrst, 'reload schema' sent — PostgREST will reload within ~1s",
    });
  } catch (err: unknown) {
    try { await client.end(); } catch { /* ignore */ }
    return NextResponse.json({
      ok: false,
      error: `NOTIFY failed: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

