// app/api/javari/run-migration/route.ts
// Purpose: One-time migration — create roadmap_task_artifacts table.
//          GET to execute. DELETE this file after confirming table exists.
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const SQL = `
CREATE TABLE IF NOT EXISTS roadmap_task_artifacts (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           text    NOT NULL,
  artifact_type     text    NOT NULL,
  artifact_location text,
  artifact_data     jsonb,
  created_at        bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rta_task_id
  ON roadmap_task_artifacts (task_id);

CREATE INDEX IF NOT EXISTS idx_rta_artifact_type
  ON roadmap_task_artifacts (artifact_type);

COMMENT ON TABLE roadmap_task_artifacts IS
  'Proof artifacts for roadmap task verification gate. Required before any task may reach completed status.';
`;

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const db  = createClient(url, key, { auth: { persistSession: false } });

    // Run via RPC to bypass PostgREST DDL restrictions
    const { error } = await db.rpc("exec_sql", { sql: SQL });

    // Fallback: try direct REST if RPC not available
    if (error && error.message.includes("exec_sql")) {
      // Use the Supabase management API pattern instead
      const res = await fetch(`${url}/rest/v1/rpc/run_sql`, {
        method : "POST",
        headers: {
          apikey        : key,
          Authorization : `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: SQL }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({
          ok   : false,
          error: `RPC fallback failed: ${text.slice(0, 300)}`,
          note : "Run this SQL manually in Supabase SQL Editor",
          sql  : SQL,
        });
      }
      return NextResponse.json({ ok: true, method: "rpc_fallback", message: "Table created." });
    }

    if (error) {
      return NextResponse.json({
        ok   : false,
        error: error.message,
        note : "Run this SQL manually in Supabase SQL Editor if needed",
        sql  : SQL,
      });
    }

    return NextResponse.json({ ok: true, method: "rpc", message: "roadmap_task_artifacts table created." });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
