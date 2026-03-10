// app/api/javari/migrate-build-artifacts/route.ts
// Purpose: One-time migration to create build_artifacts table.
//          Safe to call multiple times — all statements are idempotent.
//          Auto-runs on GET request from worker or admin.
// Date: 2026-03-10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 30;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// Split into individual idempotent statements
const STATEMENTS = [
  // Core table
  `CREATE TABLE IF NOT EXISTS build_artifacts (
    artifact_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id          text         NOT NULL,
    artifact_type    text         NOT NULL,
    repo             text         NOT NULL DEFAULT 'CR-AudioViz-AI/javari-ai',
    branch           text         NOT NULL DEFAULT 'main',
    commit_sha       text,
    deployment_url   text,
    status           text         NOT NULL DEFAULT 'pending',
    file_path        text,
    documentation    text,
    validation_notes text,
    created_at       timestamptz  NOT NULL DEFAULT now()
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_build_artifacts_task_id       ON build_artifacts (task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_build_artifacts_status        ON build_artifacts (status)`,
  `CREATE INDEX IF NOT EXISTS idx_build_artifacts_artifact_type ON build_artifacts (artifact_type)`,
  `CREATE INDEX IF NOT EXISTS idx_build_artifacts_created_at    ON build_artifacts (created_at DESC)`,

  // RLS
  `ALTER TABLE build_artifacts ENABLE ROW LEVEL SECURITY`,
];

async function runSQL(client: ReturnType<typeof db>, sql: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // Try RPC exec_sql first
  try {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method : "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
  } catch { /* fall through */ }

  // Try Supabase client select as a probe (won't run DDL but confirms table exists)
  return { ok: false, error: "Direct DDL not available via REST — use Supabase SQL Editor" };
}

// Verify table exists by attempting a SELECT
async function tableExists(client: ReturnType<typeof db>): Promise<boolean> {
  try {
    const { error } = await client.from("build_artifacts").select("artifact_id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function GET() {
  const t0 = Date.now();
  const client = db();
  const results: Array<{ stmt: string; ok: boolean; error?: string }> = [];

  // Check if already exists
  const exists = await tableExists(client);
  if (exists) {
    return NextResponse.json({
      ok      : true,
      message : "build_artifacts table already exists",
      queryMs : Date.now() - t0,
    });
  }

  // Run each statement
  for (const stmt of STATEMENTS) {
    const result = await runSQL(client, stmt.trim());
    results.push({ stmt: stmt.slice(0, 60) + "...", ...result });
    if (!result.ok) {
      console.warn(`[migrate-build-artifacts] Statement failed: ${result.error}`);
    }
  }

  // Final verification
  const created = await tableExists(client);

  return NextResponse.json({
    ok        : created,
    tableReady: created,
    results,
    message   : created
      ? "build_artifacts table ready"
      : "Migration may need manual SQL Editor run — see migration file in docs/migrations/",
    migrationSql: created ? null : STATEMENTS.join(";\n"),
    queryMs   : Date.now() - t0,
  });
}

export async function POST() {
  return GET();
}
