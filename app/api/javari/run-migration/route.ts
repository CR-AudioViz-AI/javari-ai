// app/api/javari/run-migration/route.ts
// Purpose: Run database migrations and verify all ecosystem tables exist.
//          Uses Supabase service-role + pg_query RPC to execute DDL directly.
//          GET  → verify table health
//          POST → create any missing tables then re-verify
// Date: 2026-03-11

import { NextResponse }  from "next/server";
import { createClient }  from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── All tables the platform depends on ───────────────────────────────────────

const TABLES_TO_CHECK = [
  "roadmap_tasks",
  "build_artifacts",
  "exec_logs",
  "worker_cycle_logs",
  "canonical_docs",
  "knowledge_graph_nodes",
  "knowledge_graph_edges",
  "ai_router_logs",
  "chat_sessions",
  "module_registry",
  "orchestrator_cycles",
  "app_registry",
];

// Some tables use non-standard PK names
const TABLE_PK: Record<string, string> = {
  build_artifacts: "artifact_id",
};

async function checkTables(): Promise<Record<string, boolean>> {
  const client  = db();
  const results : Record<string, boolean> = {};
  for (const table of TABLES_TO_CHECK) {
    const pk = TABLE_PK[table] ?? "id";
    try {
      const { error } = await client.from(table).select(pk, { head: true, count: "exact" }).limit(1);
      results[table] = !error;
    } catch {
      results[table] = false;
    }
  }
  return results;
}

// ── DDL for each missing table ────────────────────────────────────────────────

const TABLE_DDL: Record<string, string> = {
  ai_router_logs: `
    CREATE TABLE IF NOT EXISTS ai_router_logs (
      id           text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_type    text        NOT NULL,
      provider     text        NOT NULL,
      model        text        NOT NULL,
      prompt_tokens integer    DEFAULT 0,
      completion_tokens integer DEFAULT 0,
      cost_usd     numeric(10,6) DEFAULT 0,
      latency_ms   integer    DEFAULT 0,
      success      boolean    DEFAULT true,
      error        text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ai_router_logs_created_idx ON ai_router_logs (created_at DESC);
    ALTER TABLE ai_router_logs ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='ai_router_logs' AND policyname='Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON ai_router_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `,
  chat_sessions: `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id           text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id      text,
      intent       text,
      mode         text        DEFAULT 'single',
      message      text,
      reply        text,
      provider     text,
      model        text,
      cost_usd     numeric(10,6) DEFAULT 0,
      latency_ms   integer    DEFAULT 0,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON chat_sessions (user_id, created_at DESC);
    ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='chat_sessions' AND policyname='Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON chat_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `,
  module_registry: `
    CREATE TABLE IF NOT EXISTS module_registry (
      id           text        PRIMARY KEY,
      name         text        NOT NULL,
      capability   text        NOT NULL,
      status       text        NOT NULL DEFAULT 'planned',
      priority     text        NOT NULL DEFAULT 'medium',
      task_id      text,
      description  text,
      metadata     jsonb       DEFAULT '{}',
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS module_registry_capability_idx ON module_registry (capability);
    CREATE INDEX IF NOT EXISTS module_registry_status_idx ON module_registry (status);
    ALTER TABLE module_registry ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='module_registry' AND policyname='Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON module_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `,
  orchestrator_cycles: `
    CREATE TABLE IF NOT EXISTS orchestrator_cycles (
      id                  text        PRIMARY KEY,
      cycle_start         timestamptz NOT NULL DEFAULT now(),
      cycle_end           timestamptz,
      tasks_created       integer     NOT NULL DEFAULT 0,
      tasks_completed     integer     NOT NULL DEFAULT 0,
      modules_generated   integer     NOT NULL DEFAULT 0,
      apps_generated      integer     NOT NULL DEFAULT 0,
      errors              text[]      DEFAULT '{}',
      cost_usd            numeric(10,6) DEFAULT 0,
      created_at          timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS orchestrator_cycles_start_idx ON orchestrator_cycles (cycle_start DESC);
    ALTER TABLE orchestrator_cycles ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='orchestrator_cycles' AND policyname='Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON orchestrator_cycles FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `,
  app_registry: `
    CREATE TABLE IF NOT EXISTS app_registry (
      id           text        PRIMARY KEY,
      name         text        NOT NULL,
      category     text        NOT NULL,
      status       text        NOT NULL DEFAULT 'planned',
      task_id      text,
      description  text,
      repo_url     text,
      deploy_url   text,
      metadata     jsonb       DEFAULT '{}',
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS app_registry_category_idx ON app_registry (category);
    CREATE INDEX IF NOT EXISTS app_registry_status_idx ON app_registry (status);
    ALTER TABLE app_registry ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='app_registry' AND policyname='Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON app_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `,
};

// ── Execute DDL via Supabase RPC ──────────────────────────────────────────────
// Supabase REST API doesn't expose raw DDL. We use a stored function that
// the service role can call. If pg_query_exec RPC doesn't exist, we fall
// back to a direct insert probe to signal readiness.

async function runDDL(sql: string): Promise<{ ok: boolean; error?: string }> {
  const client = db();

  // Try pg_query_exec RPC (must exist in Supabase as a SECURITY DEFINER function)
  const { error } = await client.rpc("pg_query_exec", { query: sql });
  if (!error) return { ok: true };

  // If RPC doesn't exist (code PGRST202 = not found), signal needs-manual
  if (error.code === "PGRST202" || error.message?.includes("not found")) {
    return {
      ok: false,
      error: `RPC pg_query_exec not available. Run SQL manually in Supabase dashboard.`,
    };
  }
  return { ok: false, error: error.message };
}

// ── GET — verify table health ─────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const tables    = await checkTables();
  const missing   = Object.entries(tables).filter(([, v]) => !v).map(([k]) => k);
  const allOk     = missing.length === 0;

  return NextResponse.json({
    ok        : allOk,
    tables,
    missing,
    message   : allOk
      ? "All ecosystem tables verified. System ready."
      : `Missing tables: ${missing.join(", ")}. POST to this endpoint to auto-create.`,
    timestamp : new Date().toISOString(),
  });
}

// ── POST — create missing tables then re-verify ───────────────────────────────

export async function POST(): Promise<NextResponse> {
  const t0        = Date.now();
  const ops       : Array<{ table: string; action: string; ok: boolean; error?: string }> = [];

  // Step 1: check what exists
  const before = await checkTables();
  const missing = Object.entries(before).filter(([, v]) => !v).map(([k]) => k);

  // Step 2: attempt DDL for each missing table that has a definition
  for (const table of missing) {
    const ddl = TABLE_DDL[table];
    if (!ddl) {
      ops.push({ table, action: "skip — no DDL defined", ok: false });
      continue;
    }
    const result = await runDDL(ddl);
    ops.push({ table, action: "CREATE TABLE IF NOT EXISTS", ok: result.ok, error: result.error });
  }

  // Step 3: re-verify
  const after     = await checkTables();
  const stillMissing = Object.entries(after).filter(([, v]) => !v).map(([k]) => k);
  const allOk     = stillMissing.length === 0;

  // Step 4: build migration SQL for manual fallback
  const manualSql = missing
    .filter(t => TABLE_DDL[t])
    .map(t => `-- ${t}\n${TABLE_DDL[t].trim()}`)
    .join("\n\n");

  return NextResponse.json({
    ok              : allOk,
    tablesBeforeMigration: before,
    tablesAfterMigration : after,
    ops,
    stillMissing,
    message         : allOk
      ? "All tables created and verified. Ecosystem ready."
      : `${stillMissing.length} tables could not be auto-created. The pg_query_exec RPC may not exist in your Supabase project. See manualSql below.`,
    manualSql       : stillMissing.length > 0 ? manualSql : undefined,
    supabaseDashboard: "https://supabase.com/dashboard/project/kteobfyferrukqeolofj/editor",
    durationMs      : Date.now() - t0,
    timestamp       : new Date().toISOString(),
  });
}
