// app/api/javari/add-metadata-column/route.ts
// Purpose: Adds the `metadata` JSONB column to roadmap_tasks table.
//          Required for the autonomous planner to store artifact type/module/artifacts metadata.
//          Safe to call multiple times — uses ALTER TABLE IF NOT EXISTS semantics.
// Date: 2026-03-11

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSecret }    from "@/lib/platform-secrets/getSecret";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "kteobfyferrukqeolofj";

const ALTER_SQL = `
DO $$ BEGIN
  ALTER TABLE roadmap_tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Column may already exist: %', SQLERRM;
END $$;
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_metadata_type
  ON roadmap_tasks USING GIN ((metadata -> 'type'));
`;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

async function columnExists(): Promise<boolean> {
  try {
    // Try to select metadata — if column doesn't exist, this will error
    const { error } = await db()
      .from("roadmap_tasks")
      .select("metadata")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function tryManagementApi(sql: string): Promise<{ ok: boolean; error?: string }> {
  const pat = await getSecret("SUPABASE_ACCESS_TOKEN").catch(() => "")
           || process.env.SUPABASE_ACCESS_TOKEN
           || "";
  if (!pat) return { ok: false, error: "SUPABASE_ACCESS_TOKEN not available" };

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method : "POST",
        headers: {
          Authorization: `Bearer ${pat}`,
          "Content-Type": "application/json",
        },
        body  : JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (res.ok) return { ok: true };
    const txt = await res.text().catch(() => "unknown");
    return { ok: false, error: `Management API ${res.status}: ${txt.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function GET() {
  const t0 = Date.now();

  // Fast path — column already exists
  if (await columnExists()) {
    return NextResponse.json({
      ok     : true,
      message: "roadmap_tasks.metadata column already exists",
      queryMs: Date.now() - t0,
    });
  }

  // Run via Management API
  const mgmt = await tryManagementApi(ALTER_SQL);
  if (mgmt.ok && await columnExists()) {
    return NextResponse.json({
      ok     : true,
      method : "management_api",
      message: "roadmap_tasks.metadata JSONB column added successfully",
      queryMs: Date.now() - t0,
    });
  }

  // Return manual SQL for Supabase SQL Editor
  return NextResponse.json({
    ok                : false,
    managementApiError: mgmt.error,
    message           : "Run manualSql in Supabase SQL Editor to add metadata column",
    manualSql         : ALTER_SQL,
    supabaseSqlEditorUrl: `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`,
    queryMs           : Date.now() - t0,
  });
}

export async function POST() { return GET(); }
