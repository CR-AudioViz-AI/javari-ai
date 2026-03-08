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
