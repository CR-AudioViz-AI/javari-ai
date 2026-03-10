// app/api/javari/canonical-schema/route.ts
// Purpose: Create canonical_documents, knowledge_graph_nodes, knowledge_graph_edges,
//          canonical_ingest_runs tables if they don't exist.
//          Idempotent — safe to call multiple times.
//          GET or POST to execute.
// Date: 2026-03-10

import { NextResponse } from "next/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const MIGRATIONS = [
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
  `ALTER TABLE IF EXISTS canonical_documents DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE canonical_documents TO service_role`,
  `GRANT ALL ON TABLE canonical_documents TO authenticated`,
  `GRANT ALL ON TABLE canonical_documents TO anon`,
  `CREATE INDEX IF NOT EXISTS idx_canonical_docs_source ON canonical_documents(source)`,
  `CREATE INDEX IF NOT EXISTS idx_canonical_docs_title  ON canonical_documents(title)`,

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
  `ALTER TABLE IF EXISTS knowledge_graph_nodes DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE knowledge_graph_nodes TO service_role`,
  `GRANT ALL ON TABLE knowledge_graph_nodes TO authenticated`,
  `GRANT ALL ON TABLE knowledge_graph_nodes TO anon`,

  `CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id UUID        NOT NULL,
    to_node_id   UUID        NOT NULL,
    relationship TEXT        NOT NULL,
    weight       FLOAT       DEFAULT 1.0,
    metadata     JSONB       DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS knowledge_graph_edges DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE knowledge_graph_edges TO service_role`,
  `GRANT ALL ON TABLE knowledge_graph_edges TO authenticated`,
  `GRANT ALL ON TABLE knowledge_graph_edges TO anon`,

  `CREATE TABLE IF NOT EXISTS canonical_ingest_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type        TEXT        NOT NULL DEFAULT 'r2_full',
    docs_found      INTEGER     DEFAULT 0,
    docs_ingested   INTEGER     DEFAULT 0,
    chunks_created  INTEGER     DEFAULT 0,
    nodes_created   INTEGER     DEFAULT 0,
    tasks_generated INTEGER     DEFAULT 0,
    status          TEXT        DEFAULT 'running',
    error           TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
  )`,
  `ALTER TABLE IF EXISTS canonical_ingest_runs DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE canonical_ingest_runs TO service_role`,
  `GRANT ALL ON TABLE canonical_ingest_runs TO authenticated`,
  `GRANT ALL ON TABLE canonical_ingest_runs TO anon`,
];

async function runSQL(url: string, key: string, sql: string): Promise<{ ok: boolean; error?: string }> {
  const hdrs = {
    "Content-Type":  "application/json",
    "apikey":        key,
    "Authorization": `Bearer ${key}`,
  };

  for (const [endpoint, body] of [
    [`${url}/rest/v1/rpc/query`,    JSON.stringify({ query: sql })],
    [`${url}/rest/v1/rpc/exec_sql`, JSON.stringify({ sql })],
    [`${url}/rest/v1/rpc/exec`,     JSON.stringify({ query: sql })],
  ] as [string, string][]) {
    try {
      const r = await fetch(endpoint, {
        method: "POST", headers: hdrs, body,
        signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) return { ok: true };
    } catch { /* try next */ }
  }

  return { ok: false, error: "all SQL endpoints failed" };
}

async function handler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase bootstrap vars missing" }, { status: 500 });
  }

  const results: Array<{ sql: string; ok: boolean; error?: string }> = [];

  for (const sql of MIGRATIONS) {
    const r = await runSQL(url, key, sql);
    results.push({ sql: sql.trim().slice(0, 80), ok: r.ok, error: r.error });
  }

  const okCount    = results.filter(r => r.ok).length;
  const failCount  = results.filter(r => !r.ok).length;

  // Verify tables by querying
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const tableChecks: Record<string, boolean> = {};
  for (const tbl of ["canonical_documents","knowledge_graph_nodes","knowledge_graph_edges","canonical_ingest_runs"]) {
    const { error } = await db.from(tbl).select("id").limit(1);
    tableChecks[tbl] = !error;
  }

  return NextResponse.json({ ok: true, migrations: { ok: okCount, failed: failCount }, results, tables: tableChecks });
}

export const GET  = handler;
export const POST = handler;
