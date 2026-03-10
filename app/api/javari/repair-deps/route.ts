// app/api/javari/repair-deps/route.ts
// Purpose: One-shot repair — clear depends_on arrays that reference nonexistent task IDs.
//          Phase 2 tasks were inserted with incorrect dep ID suffixes (global taskIndex bug).
//          This route identifies all such orphaned references and sets depends_on = []
//          so the worker can execute tasks in natural order.
//          Safe to run multiple times (idempotent).
// Date: 2026-03-10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 30;

export async function POST(): Promise<NextResponse> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );

  const log: string[] = [];
  const emit = (m: string) => { log.push(m); console.log(m); };

  emit("=== repair-deps: starting ===");

  // 1. Get all pending tasks that have depends_on
  const { data: pending, error: pendErr } = await db
    .from("roadmap_tasks")
    .select("id, title, depends_on, phase_id")
    .eq("status", "pending");

  if (pendErr) {
    return NextResponse.json({ ok: false, error: pendErr.message, log }, { status: 500 });
  }

  const withDeps = (pending ?? []).filter(
    (t: { depends_on: string[] | null }) => (t.depends_on ?? []).length > 0
  );
  emit(`Pending tasks with depends_on: ${withDeps.length}`);

  if (withDeps.length === 0) {
    emit("Nothing to repair.");
    return NextResponse.json({ ok: true, repaired: 0, log });
  }

  // 2. Get ALL task IDs in the table (any status)
  const { data: allRows, error: allErr } = await db
    .from("roadmap_tasks")
    .select("id");

  if (allErr) {
    return NextResponse.json({ ok: false, error: allErr.message, log }, { status: 500 });
  }

  const allIds = new Set((allRows ?? []).map((r: { id: string }) => r.id));
  emit(`Total tasks in DB: ${allIds.size}`);

  // 3. Find tasks with orphaned dep references
  const toRepair: Array<{ id: string; title: string; orphaned: string[] }> = [];

  for (const task of withDeps as Array<{
    id: string; title: string; depends_on: string[]; phase_id: string;
  }>) {
    const deps = task.depends_on ?? [];
    const orphaned = deps.filter((d: string) => !allIds.has(d));
    if (orphaned.length > 0) {
      toRepair.push({ id: task.id, title: task.title, orphaned });
      emit(`  🔴 ${task.id}: ${orphaned.length} orphaned dep(s): ${orphaned.join(", ")}`);
    } else {
      emit(`  ✅ ${task.id}: all deps exist in DB`);
    }
  }

  emit(`\nTasks to repair: ${toRepair.length}`);

  if (toRepair.length === 0) {
    emit("No orphaned deps found — nothing to repair.");
    return NextResponse.json({ ok: true, repaired: 0, log });
  }

  // 4. Clear depends_on on tasks with orphaned references
  let repaired = 0;
  const failed: string[] = [];

  for (const task of toRepair) {
    const { error: updErr } = await db
      .from("roadmap_tasks")
      .update({ depends_on: [] })
      .eq("id", task.id)
      .eq("status", "pending");  // safety: only touch pending tasks

    if (updErr) {
      emit(`  ❌ FAIL ${task.id}: ${updErr.message}`);
      failed.push(task.id);
    } else {
      emit(`  ✅ REPAIRED ${task.id} — depends_on cleared`);
      repaired++;
    }
  }

  // 5. Verification: re-check executable count
  const { data: recheck } = await db
    .from("roadmap_tasks")
    .select("id, depends_on")
    .eq("status", "pending");

  const { data: completed } = await db
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "completed");

  const completedSet = new Set((completed ?? []).map((r: { id: string }) => r.id));

  let executable = 0;
  for (const t of (recheck ?? []) as Array<{ id: string; depends_on: string[] | null }>) {
    const deps = (t.depends_on ?? []).filter((d: string) => allIds.has(d));
    const unmet = deps.filter((d: string) => !completedSet.has(d));
    if (unmet.length === 0) executable++;
  }

  emit(`\n=== repair-deps complete ===`);
  emit(`  Repaired: ${repaired}`);
  emit(`  Failed:   ${failed.length}`);
  emit(`  Executable tasks after repair: ${executable} / ${recheck?.length ?? 0} pending`);

  return NextResponse.json({
    ok:         failed.length === 0,
    repaired,
    failed:     failed.length,
    executable_after: executable,
    total_pending: recheck?.length ?? 0,
    log,
  });
}
