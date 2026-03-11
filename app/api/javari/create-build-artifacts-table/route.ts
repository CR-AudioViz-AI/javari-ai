// app/api/javari/create-build-artifacts-table/route.ts
// Purpose: Creates the build_artifacts table via Supabase Management API.
//          Uses SUPABASE_ACCESS_TOKEN (personal access token) + project ref.
//          Falls back to exec_sql RPC if PAT not available.
//          Safe to call multiple times — CREATE TABLE IF NOT EXISTS is idempotent.
// Date: 2026-03-11

import { NextResponse }  from "next/server";
import { createClient }  from "@supabase/supabase-js";
import { getSecret }     from "@/lib/platform-secrets/getSecret";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "kteobfyferrukqeolofj";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS build_artifacts (
  artifact_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          TEXT         NOT NULL,
  artifact_type    TEXT         NOT NULL,
  repo             TEXT         NOT NULL DEFAULT 'CR-AudioViz-AI/javari-ai',
  branch           TEXT         NOT NULL DEFAULT 'main',
  commit_sha       TEXT,
  deployment_url   TEXT,
  status           TEXT         NOT NULL DEFAULT 'pending',
  file_path        TEXT,
  documentation    TEXT,
  validation_notes TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_task_id       ON build_artifacts (task_id);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_status        ON build_artifacts (status);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_artifact_type ON build_artifacts (artifact_type);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_created_at    ON build_artifacts (created_at DESC);
ALTER TABLE build_artifacts ENABLE ROW LEVEL SECURITY;
DO $pol$ BEGIN
  CREATE POLICY "service_role_all" ON build_artifacts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $pol$;
GRANT ALL ON build_artifacts TO service_role;
`;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

async function tableExists(): Promise<boolean> {
  try {
    const { error } = await db().from("build_artifacts").select("artifact_id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

// Strategy 1: Supabase Management API (requires SUPABASE_ACCESS_TOKEN personal access token)
async function tryManagementApi(): Promise<{ ok: boolean; error?: string }> {
  const pat = await getSecret("SUPABASE_ACCESS_TOKEN").catch(() => "")
           || process.env.SUPABASE_ACCESS_TOKEN
           || "";
  if (!pat) return { ok: false, error: "SUPABASE_ACCESS_TOKEN not available in vault or env" };

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method : "POST",
        headers: {
          Authorization: `Bearer ${pat}`,
          "Content-Type": "application/json",
        },
        body  : JSON.stringify({ query: CREATE_SQL }),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "unknown");
    return { ok: false, error: `Management API ${res.status}: ${txt.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Strategy 2: Supabase service-role exec_sql RPC (requires custom function installed)
async function tryExecSqlRpc(): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return { ok: false, error: "Supabase env vars missing" };

  try {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method : "POST",
      headers: {
        apikey        : key,
        Authorization : `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body  : JSON.stringify({ sql: CREATE_SQL }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "unknown");
    return { ok: false, error: `exec_sql RPC ${res.status}: ${txt.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function GET() {
  const t0 = Date.now();

  // Fast path — already exists
  if (await tableExists()) {
    return NextResponse.json({
      ok     : true,
      message: "build_artifacts table already exists — no action needed",
      queryMs: Date.now() - t0,
    });
  }

  // Try Management API first
  const mgmt = await tryManagementApi();
  if (mgmt.ok && await tableExists()) {
    return NextResponse.json({
      ok     : true,
      method : "management_api",
      message: "build_artifacts table created via Supabase Management API",
      queryMs: Date.now() - t0,
    });
  }

  // Try exec_sql RPC fallback
  const rpc = await tryExecSqlRpc();
  if (rpc.ok && await tableExists()) {
    return NextResponse.json({
      ok     : true,
      method : "exec_sql_rpc",
      message: "build_artifacts table created via exec_sql RPC",
      queryMs: Date.now() - t0,
    });
  }

  // All automated paths failed — return SQL for manual execution in Supabase SQL Editor
  return NextResponse.json({
    ok                : false,
    managementApiError: mgmt.error,
    execSqlError      : rpc.error,
    message           : "Automated DDL unavailable — run manualSql in Supabase SQL Editor (takes 30 seconds)",
    manualSql         : CREATE_SQL,
    supabaseSqlEditorUrl: `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`,
    queryMs           : Date.now() - t0,
  }, { status: 200 }); // 200 so caller can read the SQL
}

export async function POST() { return GET(); }
