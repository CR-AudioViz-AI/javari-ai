// app/api/javari/migrate/route.ts
// Purpose: One-shot DDL runner — adds source column to roadmap_tasks
// Date: 2026-03-06

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const steps: Array<{ sql: string; ok: boolean; error?: string }> = [];

  const ddl = [
    "ALTER TABLE roadmap_tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL",
    "CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_source ON roadmap_tasks (source) WHERE source IS NOT NULL",
  ];

  for (const sql of ddl) {
    const { error } = await supabase.rpc("exec_sql", { sql }) as { error: { message: string } | null };
    steps.push({ sql: sql.slice(0, 80), ok: !error, error: error?.message });
  }

  // Verify column now accessible
  const { error: verifyErr } = await supabase
    .from("roadmap_tasks")
    .select("source")
    .limit(1);

  return NextResponse.json({
    ok: !verifyErr,
    column_accessible: !verifyErr,
    verify_error: verifyErr?.message ?? null,
    steps,
  });
}
