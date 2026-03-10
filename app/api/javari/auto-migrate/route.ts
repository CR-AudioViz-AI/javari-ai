// app/api/javari/auto-migrate/route.ts
// Purpose: Self-healing migration runner — ensures roadmap_task_artifacts has
//          correct permissions without requiring Roy to run SQL manually.
//          Idempotent. Safe to call at any time.
// Date: 2026-03-07

import { NextResponse } from "next/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const MIGRATIONS = [
  // Ensure table exists
  `CREATE TABLE IF NOT EXISTS roadmap_task_artifacts (
    id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           text    NOT NULL,
    artifact_type     text    NOT NULL,
    artifact_location text,
    artifact_data     jsonb,
    created_at        bigint  NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rta_task_id
     ON roadmap_task_artifacts (task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rta_type
     ON roadmap_task_artifacts (artifact_type)`,
  // Grant access — service role must be able to read/write artifacts
  `GRANT ALL ON TABLE roadmap_task_artifacts TO service_role`,
  `GRANT ALL ON TABLE roadmap_task_artifacts TO authenticated`,
  `GRANT ALL ON TABLE roadmap_task_artifacts TO anon`,
  // ── javari_targets table ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS javari_targets (
    id            text        PRIMARY KEY,
    name          text        NOT NULL,
    type          text        NOT NULL,
    location      text        NOT NULL,
    branch        text        DEFAULT 'main',
    last_scan     timestamptz,
    status        text        NOT NULL DEFAULT 'active',
    scan_interval integer     NOT NULL DEFAULT 720,
    metadata      jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_javari_targets_status ON javari_targets (status)`,
  `ALTER TABLE javari_targets DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE javari_targets TO service_role`,
  `GRANT ALL ON TABLE javari_targets TO authenticated`,
  `GRANT ALL ON TABLE javari_targets TO anon`,
  // ── javari_engineering_cycles table ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS javari_engineering_cycles (
    cycle_id           text        PRIMARY KEY,
    started_at         timestamptz NOT NULL,
    completed_at       timestamptz,
    targets_processed  integer     DEFAULT 0,
    total_issues       integer     DEFAULT 0,
    total_repair_tasks integer     DEFAULT 0,
    gate_results       integer     DEFAULT 0,
    errors             jsonb       DEFAULT '[]',
    target_results     jsonb       DEFAULT '[]',
    duration_ms        integer,
    created_at         timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_jec_started_at ON javari_engineering_cycles (started_at DESC)`,
  `ALTER TABLE javari_engineering_cycles DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE javari_engineering_cycles TO service_role`,
  `GRANT ALL ON TABLE javari_engineering_cycles TO authenticated`,
  `GRANT ALL ON TABLE javari_engineering_cycles TO anon`,
  // Disable RLS so service_role has full access
  `ALTER TABLE roadmap_task_artifacts DISABLE ROW LEVEL SECURITY`,

  // ── autonomy_execution_log ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS autonomy_execution_log (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id    text        NOT NULL,
    event_type  text        NOT NULL,
    payload     jsonb       DEFAULT '{}',
    logged_at   timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ael_cycle_id  ON autonomy_execution_log (cycle_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ael_logged_at ON autonomy_execution_log (logged_at DESC)`,
  `ALTER TABLE autonomy_execution_log DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE autonomy_execution_log TO service_role`,
  `GRANT ALL ON TABLE autonomy_execution_log TO authenticated`,

  // ── javari_scheduler_lock ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS javari_scheduler_lock (
    lock_key    TEXT PRIMARY KEY,
    cycle_id    TEXT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    holder      TEXT NOT NULL DEFAULT 'unknown'
  )`,
  `ALTER TABLE javari_scheduler_lock DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE javari_scheduler_lock TO service_role`,
  `GRANT ALL ON TABLE javari_scheduler_lock TO authenticated`,

  // ── javari_security_events ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS javari_security_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  text        NOT NULL,
    severity    text        NOT NULL DEFAULT 'info',
    payload     jsonb       DEFAULT '{}',
    logged_at   timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE javari_security_events DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE javari_security_events TO service_role`,
  `GRANT ALL ON TABLE javari_security_events TO authenticated`,

  // ── javari_model_usage_metrics ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS javari_model_usage_metrics (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id      text        NOT NULL,
    provider      text        NOT NULL,
    input_tokens  integer     DEFAULT 0,
    output_tokens integer     DEFAULT 0,
    cost_usd      numeric(10,6) DEFAULT 0,
    recorded_at   timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE javari_model_usage_metrics DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE javari_model_usage_metrics TO service_role`,
  `GRANT ALL ON TABLE javari_model_usage_metrics TO authenticated`,

  // ── Clear any stuck scheduler lock (expired or orphaned) ──────────────
  // Safe: only deletes rows where expires_at is in the past
  `DELETE FROM javari_scheduler_lock WHERE expires_at < NOW()`,

  // ── canonical_documents ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS canonical_documents (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    source      TEXT        NOT NULL,
    chunk_index INTEGER     NOT NULL DEFAULT 0,
    content     TEXT        NOT NULL,
    content_hash TEXT       NOT NULL DEFAULT '',
    embedding   JSONB,
    doc_type    TEXT        DEFAULT 'markdown',
    token_count INTEGER     DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, chunk_index)
  )`,
  `ALTER TABLE canonical_documents DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE canonical_documents TO service_role`,
  `GRANT ALL ON TABLE canonical_documents TO authenticated`,

  // ── knowledge_graph_nodes ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type   TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    description TEXT,
    source_doc  TEXT,
    metadata    JSONB       DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_type, name)
  )`,
  `ALTER TABLE knowledge_graph_nodes DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE knowledge_graph_nodes TO service_role`,
  `GRANT ALL ON TABLE knowledge_graph_nodes TO authenticated`,

  // ── knowledge_graph_edges ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id UUID        NOT NULL,
    to_node_id   UUID        NOT NULL,
    relationship TEXT        NOT NULL,
    weight       FLOAT       DEFAULT 1.0,
    metadata     JSONB       DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE knowledge_graph_edges DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE knowledge_graph_edges TO service_role`,
  `GRANT ALL ON TABLE knowledge_graph_edges TO authenticated`,

  // ── canonical_ingest_runs ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS canonical_ingest_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type        TEXT        NOT NULL DEFAULT 'r2_full',
    docs_ingested   INTEGER     DEFAULT 0,
    chunks_created  INTEGER     DEFAULT 0,
    nodes_created   INTEGER     DEFAULT 0,
    tasks_generated INTEGER     DEFAULT 0,
    status          TEXT        DEFAULT 'running',
    error           TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
  )`,
  `ALTER TABLE canonical_ingest_runs DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE canonical_ingest_runs TO service_role`,
  `GRANT ALL ON TABLE canonical_ingest_runs TO authenticated`
];

type MigrationResult = { sql: string; ok: boolean; error?: string };

export async function GET(): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase bootstrap vars missing" }, { status: 500 });
  }

  const results: MigrationResult[] = [];

  for (const sql of MIGRATIONS) {
    // Use PostgREST RPC if available, fall back to direct SQL
    let ok = false;
    let errMsg = "";

    // Attempt 1: PostgREST rpc/query
    try {
      const res = await fetch(`${url}/rest/v1/rpc/query`, {
        method : "POST",
        headers: {
          "Content-Type" : "application/json",
          "apikey"       : key,
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok || res.status === 200) {
        ok = true;
      } else {
        const t = await res.text();
        errMsg = `rpc/query ${res.status}: ${t.slice(0, 100)}`;
      }
    } catch (e) {
      errMsg = `rpc/query exception: ${(e as Error).message}`;
    }

    // Attempt 2: PostgREST rpc/exec_sql
    if (!ok) {
      try {
        const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method : "POST",
          headers: {
            "Content-Type" : "application/json",
            "apikey"       : key,
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify({ sql }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) ok = true;
        else {
          const t = await res.text();
          errMsg = `exec_sql ${res.status}: ${t.slice(0, 100)}`;
        }
      } catch (e) {
        errMsg = `exec_sql exception: ${(e as Error).message}`;
      }
    }

    results.push({ sql: sql.slice(0, 60).replace(/\s+/g, " "), ok, error: ok ? undefined : errMsg });
  }

  const allOk = results.every(r => r.ok);

  // Return manual SQL if RPC not available — Roy can paste in Supabase
  const manualSql = allOk ? undefined :
    MIGRATIONS.join(";\n\n") + ";";

  return NextResponse.json({
    ok: allOk,
    results,
    message: allOk
      ? "All migrations applied successfully."
      : "RPC unavailable — manual SQL included below.",
    ...(manualSql ? { manualSql } : {}),
  });
}
