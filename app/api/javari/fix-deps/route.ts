// app/api/javari/fix-deps/route.ts
// Purpose: One-shot dependency ID repair — fixes truncated/mismatched IDs in roadmap_tasks
//          Idempotent. Run once after ingest to correct any slug truncation mismatches.
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Known dependency ID mismatches: wrong_id → correct_id
// Discovered via /api/javari/queue/diagnose showing exists:false on dependency IDs
const DEP_CORRECTIONS: Record<string, string> = {
  // multi_ai_chat chain
  "rm-multi_ai_chat-build-shared-memory-buffer-for-multi-agent-sessions-17":
    "rm-multi_ai_chat-build-shared-memory-buffer-for-multi-agent-sessi-17",
  // creator_tools chain
  "rm-creator_tools-build-creatos-unified-dashboard-25":
    "rm-creator_tools-build-creatoros-unified-dashboard-25",
  "rm-creator_tools-build-avatatos-face-and-voice-generation-28":
    "rm-creator_tools-build-avataros-face-and-voice-generation-28",
  // payments chain
  "rm-payments-complete-creditos-global-billing-currency-layer-21":
    "rm-payments-complete-creditsos-global-billing-currency-layer-21",
};

export async function POST() {
  // Fetch all tasks with dependencies
  const { data: tasks, error } = await supabase
    .from("roadmap_tasks")
    .select("id, depends_on")
    .not("depends_on", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const fixes: Array<{ task_id: string; old_dep: string; new_dep: string }> = [];
  const errors: string[] = [];

  for (const task of (tasks ?? []) as { id: string; depends_on: string[] | null }[]) {
    if (!task.depends_on || task.depends_on.length === 0) continue;

    let changed = false;
    const corrected = task.depends_on.map((depId: string) => {
      if (DEP_CORRECTIONS[depId]) {
        fixes.push({ task_id: task.id, old_dep: depId, new_dep: DEP_CORRECTIONS[depId] });
        changed = true;
        return DEP_CORRECTIONS[depId];
      }
      return depId;
    });

    if (changed) {
      const { error: updateErr } = await supabase
        .from("roadmap_tasks")
        .update({ depends_on: corrected })
        .eq("id", task.id);

      if (updateErr) {
        errors.push(`${task.id}: ${updateErr.message}`);
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    fixes_applied: fixes.length,
    fixes,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export async function GET() {
  // Preview: show which tasks have broken dependency IDs without fixing
  const { data: tasks } = await supabase
    .from("roadmap_tasks")
    .select("id, depends_on")
    .not("depends_on", "is", null);

  const broken: Array<{ task_id: string; bad_dep: string; correct_dep: string }> = [];

  for (const task of (tasks ?? []) as { id: string; depends_on: string[] | null }[]) {
    if (!task.depends_on) continue;
    for (const depId of task.depends_on) {
      if (DEP_CORRECTIONS[depId]) {
        broken.push({ task_id: task.id, bad_dep: depId, correct_dep: DEP_CORRECTIONS[depId] });
      }
    }
  }

  // Also verify: check all dependency IDs actually exist
  const { data: allIds } = await supabase
    .from("roadmap_tasks")
    .select("id");
  const existingIds = new Set((allIds ?? []).map((t: { id: string }) => t.id));

  const missing: Array<{ task_id: string; missing_dep: string }> = [];
  for (const task of (tasks ?? []) as { id: string; depends_on: string[] | null }[]) {
    if (!task.depends_on) continue;
    for (const depId of task.depends_on) {
      if (!existingIds.has(depId)) {
        missing.push({ task_id: task.id, missing_dep: depId });
      }
    }
  }

  return NextResponse.json({
    ok: broken.length === 0 && missing.length === 0,
    known_corrections: broken.length,
    unknown_missing: missing.length,
    broken,
    missing,
  });
}
