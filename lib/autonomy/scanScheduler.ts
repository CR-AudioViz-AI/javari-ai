// lib/autonomy/scanScheduler.ts
// Purpose: Scan scheduler — evaluates active targets against their scan interval,
//          creates discover_system / analyze_code / repair_code tasks in
//          roadmap_tasks for any target that is due for a scan cycle.
// Date: 2026-03-07

import { createClient }           from "@supabase/supabase-js";
import { getTargetsDueForScan, JavariTarget } from "./targetRegistry";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScheduleResult {
  targetsEvaluated: number;
  targetsDue      : number;
  tasksCreated    : number;
  taskIds         : string[];
  skipped         : string[];
}

export type ScanTaskType = "discover_system" | "analyze_code" | "repair_code";

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Existing scan check ────────────────────────────────────────────────────

async function hasPendingScansForTarget(targetId: string): Promise<boolean> {
  const { data } = await db()
    .from("roadmap_tasks")
    .select("id")
    .in("status", ["pending", "in_progress"])
    .like("description", `%target:${targetId}%`)
    .limit(1);
  return (data ?? []).length > 0;
}

// ── Task row builder ───────────────────────────────────────────────────────

function buildScanTask(
  target  : JavariTarget,
  taskType: ScanTaskType,
  phase   : string,
  deps    : string[]
): Record<string, unknown> {
  const ts  = Date.now();
  const slug = target.id.slice(0, 30);
  const id   = `scan-${taskType}-${slug}-${ts}`.slice(0, 80);

  const descriptionsByType: Record<ScanTaskType, string> = {
    discover_system: `[type:ai_task] Autonomous discovery scan for target: ${target.name}\n` +
      `target:${target.id}\n` +
      `targetType:${target.type}\n` +
      `location:${target.location}\n` +
      `branch:${target.branch ?? "main"}\n` +
      `Scan the target using the discovery engine and report architecture findings.`,

    analyze_code: `[type:ai_task] Code intelligence analysis for target: ${target.name}\n` +
      `target:${target.id}\n` +
      `targetType:${target.type}\n` +
      `location:${target.location}\n` +
      `branch:${target.branch ?? "main"}\n` +
      `Run the code intelligence engine and identify security, performance, and quality issues.`,

    repair_code: `[type:ai_task] executor:repair_code\n` +
      `Repair issues found in target: ${target.name}\n` +
      `target:${target.id}\n` +
      `targetType:${target.type}\n` +
      `location:${target.location}\n` +
      `issues:[]`,
  };

  return {
    id,
    phase_id   : phase,
    title      : `[${taskType.toUpperCase()}] ${target.name}`,
    description: descriptionsByType[taskType],
    depends_on : deps,
    status     : "pending",
    source     : "scheduler",
    updated_at : ts,
  };
}

// ── Main scheduler ─────────────────────────────────────────────────────────

export async function runScheduler(
  allTargets?: JavariTarget[]
): Promise<ScheduleResult> {
  const targets = allTargets ?? await getTargetsDueForScan();
  const taskIds : string[] = [];
  const skipped : string[] = [];
  let   tasksCreated = 0;

  for (const target of targets) {
    // Skip if already has pending scans for this target
    const hasPending = await hasPendingScansForTarget(target.id);
    if (hasPending) {
      skipped.push(`${target.id} (scan already queued)`);
      continue;
    }

    // Only create scan tasks for repo targets (websites/APIs use discovery engine differently)
    const rows: Record<string, unknown>[] = [];
    const ts = Date.now();

    if (target.type === "repo") {
      const discoverTask = buildScanTask(target, "discover_system", "autonomy", []);
      const analyzeTask  = buildScanTask(target, "analyze_code",   "autonomy", [String(discoverTask.id)]);
      rows.push(discoverTask, analyzeTask);
    } else {
      // website / api / service — just a discover task
      const discoverTask = buildScanTask(target, "discover_system", "autonomy", []);
      rows.push(discoverTask);
    }

    // Check for existing IDs
    const newIds    = rows.map(r => String(r.id));
    const { data: existing } = await db()
      .from("roadmap_tasks")
      .select("id")
      .in("id", newIds);
    const existingSet = new Set((existing ?? []).map((r: {id: string}) => r.id));
    const toInsert = rows.filter(r => !existingSet.has(String(r.id)));

    if (toInsert.length > 0) {
      const { error } = await db().from("roadmap_tasks").insert(toInsert);
      if (!error) {
        tasksCreated += toInsert.length;
        taskIds.push(...toInsert.map(r => String(r.id)));
        console.log(`[scanScheduler] Queued ${toInsert.length} tasks for ${target.name}`);
      } else {
        console.error(`[scanScheduler] Insert failed for ${target.id}: ${error.message}`);
        skipped.push(`${target.id} (insert error: ${error.message})`);
      }
    }
  }

  return {
    targetsEvaluated: targets.length,
    targetsDue      : targets.length - skipped.filter(s => s.includes("already")).length,
    tasksCreated,
    taskIds,
    skipped,
  };
}
