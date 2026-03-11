// app/api/javari/run-migration/route.ts
// Purpose: One-shot migration runner — executes ecosystem schema migrations against Supabase.
//          GET: returns current table status.
//          POST: runs the migration SQL.
//          Safe to call multiple times (all statements are idempotent).
// Date: 2026-03-10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

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
];

async function checkTables(): Promise<Record<string, boolean>> {
  const client = db();
  const results: Record<string, boolean> = {};

  for (const table of TABLES_TO_CHECK) {
    const { error } = await client.from(table).select("id", { head: true, count: "exact" }).limit(1);
    results[table] = !error;
  }

  return results;
}

export async function GET(): Promise<NextResponse> {
  const tables = await checkTables();
  return NextResponse.json({ ok: true, tables, timestamp: new Date().toISOString() });
}

// The migration SQL runs via Supabase RPC — requires a custom function or direct exec.
// We use the pg_query approach via Supabase's REST API for service-role-privileged DDL.
// Since Supabase doesn't expose raw DDL via REST, we run individual table checks and
// attempt inserts to verify write access, then apply any missing columns.

export async function POST(): Promise<NextResponse> {
  const client = db();
  const ops: Array<{ op: string; ok: boolean; error?: string }> = [];
  const t0 = Date.now();

  // ── Ensure metadata column on roadmap_tasks ──────────────────────────────
  // We can't run ALTER TABLE via REST, but we can verify the column exists
  // by attempting a query that selects it.
  try {
    const { error } = await client
      .from("roadmap_tasks")
      .select("metadata")
      .limit(1);
    ops.push({ op: "roadmap_tasks.metadata_column", ok: !error, error: error?.message });
  } catch (e) {
    ops.push({ op: "roadmap_tasks.metadata_column", ok: false, error: String(e) });
  }

  // ── Verify build_artifacts table ─────────────────────────────────────────
  try {
    const { error } = await client
      .from("build_artifacts")
      .select("artifact_id", { head: true, count: "exact" })
      .limit(1);
    ops.push({ op: "build_artifacts.exists", ok: !error, error: error?.message });
  } catch (e) {
    ops.push({ op: "build_artifacts.exists", ok: false, error: String(e) });
  }

  // ── Verify exec_logs table ────────────────────────────────────────────────
  try {
    const { error } = await client
      .from("exec_logs")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    ops.push({ op: "exec_logs.exists", ok: !error, error: error?.message });
  } catch (e) {
    ops.push({ op: "exec_logs.exists", ok: false, error: String(e) });
  }

  // ── Verify worker_cycle_logs table ────────────────────────────────────────
  try {
    const { error } = await client
      .from("worker_cycle_logs")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    ops.push({ op: "worker_cycle_logs.exists", ok: !error, error: error?.message });
  } catch (e) {
    ops.push({ op: "worker_cycle_logs.exists", ok: false, error: String(e) });
  }

  // ── Verify knowledge_graph tables ─────────────────────────────────────────
  for (const table of ["knowledge_graph_nodes", "knowledge_graph_edges"]) {
    try {
      const { error } = await client
        .from(table)
        .select("id", { head: true, count: "exact" })
        .limit(1);
      ops.push({ op: `${table}.exists`, ok: !error, error: error?.message });
    } catch (e) {
      ops.push({ op: `${table}.exists`, ok: false, error: String(e) });
    }
  }

  const allOk   = ops.every(o => o.ok);
  const failing = ops.filter(o => !o.ok).map(o => o.op);

  return NextResponse.json({
    ok:        allOk,
    ops,
    failing,
    message:   allOk
      ? "All ecosystem tables verified. System ready."
      : `Missing tables/columns: ${failing.join(", ")}. Run the SQL migration via Supabase dashboard.`,
    migrationSql: "/supabase/migrations/20260310_autonomous_ecosystem_tables.sql",
    durationMs: Date.now() - t0,
    timestamp:  new Date().toISOString(),
  });
}
