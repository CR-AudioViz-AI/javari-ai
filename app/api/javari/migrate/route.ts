// app/api/javari/migrate/route.ts
// Purpose: DDL runner + test seeder for hybrid planner
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── Seed a test roadmap task ───────────────────────────────────────────────
  if (action === "seed-roadmap-test") {
    const now = Math.floor(Date.now() / 1000);
    const { error } = await supabase
      .from("roadmap_tasks")
      .upsert({
        id: "roadmap-test-seed-001",
        phase_id: "planner",
        title: "Seed test: Human-authored roadmap task",
        description: "This task was seeded to verify the hybrid planner roadmap path works correctly.",
        depends_on: [],
        source: "roadmap",
        status: "pending",
        updated_at: now,
      }, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }
    return NextResponse.json({ ok: true, seeded: "roadmap-test-seed-001" });
  }

  // ── Mark roadmap test task complete (cleanup) ─────────────────────────────
  if (action === "cleanup-roadmap-test") {
    const { error } = await supabase
      .from("roadmap_tasks")
      .update({ status: "completed" })
      .eq("id", "roadmap-test-seed-001");

    return NextResponse.json({ ok: !error, error: error?.message });
  }

  // ── Default: apply DDL ─────────────────────────────────────────────────────
  const steps: Array<{ sql: string; ok: boolean; error?: string }> = [];
  const ddl = [
    "ALTER TABLE roadmap_tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL",
    "CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_source ON roadmap_tasks (source) WHERE source IS NOT NULL",
  ];

  for (const sql of ddl) {
    const { error } = await supabase.rpc("exec_sql", { sql }) as { error: { message: string } | null };
    steps.push({ sql: sql.slice(0, 80), ok: !error, error: error?.message });
  }

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
