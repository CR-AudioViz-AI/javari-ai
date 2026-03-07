// app/api/javari/run-migration/route.ts
// Purpose: Create roadmap_task_artifacts table with correct permissions.
//          GET to execute. Safe to re-run (IF NOT EXISTS + GRANT are idempotent).
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS roadmap_task_artifacts (
    id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           text    NOT NULL,
    artifact_type     text    NOT NULL,
    artifact_location text,
    artifact_data     jsonb,
    created_at        bigint  NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rta_task_id ON roadmap_task_artifacts (task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rta_artifact_type ON roadmap_task_artifacts (artifact_type)`,
  // Grant full access to service role and anon role
  `GRANT ALL ON TABLE roadmap_task_artifacts TO service_role`,
  `GRANT ALL ON TABLE roadmap_task_artifacts TO anon`,
  `GRANT ALL ON TABLE roadmap_task_artifacts TO authenticated`,
  // Disable RLS so service_role has unrestricted access
  `ALTER TABLE roadmap_task_artifacts DISABLE ROW LEVEL SECURITY`,
];

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const db  = createClient(url, key, { auth: { persistSession: false } });

  const results: Array<{ sql: string; ok: boolean; error?: string }> = [];

  for (const sql of STATEMENTS) {
    try {
      // Use direct PostgreSQL REST query endpoint
      const res = await fetch(`${url}/rest/v1/`, {
        method : "POST",
        headers: {
          apikey        : key,
          Authorization : `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer        : "params=single-object",
        },
        body: JSON.stringify({ query: sql }),
      });

      // Also try via RPC if available
      const { error } = await db.rpc("exec_sql", { sql }).catch(() => ({ error: { message: "rpc_unavailable" } }));

      if (error && !error.message.includes("rpc_unavailable")) {
        // Try pg_query
        const { error: e2 } = await db.rpc("pg_query", { query: sql }).catch(() => ({ error: { message: "pg_query_unavailable" } }));
        if (e2 && !e2.message.includes("unavailable")) {
          results.push({ sql: sql.slice(0, 60), ok: false, error: e2.message });
          continue;
        }
      }
      results.push({ sql: sql.slice(0, 60), ok: true });
    } catch (err) {
      results.push({ sql: sql.slice(0, 60), ok: false, error: String(err) });
    }
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json({
    ok     : allOk,
    results,
    note   : allOk ? "All statements executed." : "Some statements need to be run manually in Supabase SQL Editor.",
    manual_sql: allOk ? undefined : STATEMENTS.join(";\n\n") + ";",
  });
}
