// app/api/javari/worker-cycle/route.ts
// Purpose: Dedicated cron endpoint for Javari autonomous execution.
//          Called every 60 seconds by Vercel cron scheduler.
//          Delegates entirely to runRoadmapWorker() — no logic lives here.
//
//          Worker behavior per cycle:
//            0. QUEUE RECOVERY (new) — runs before everything else:
//               a. Dead task detection: running/verifying/in_progress tasks
//                  older than 10 minutes → moved to retry
//               b. Auto-requeue: if pending count = 0, convert retry → pending
//               c. Dep timeout release: blocked tasks with dependency timeout
//                  older than 5 minutes → moved to pending
//            1. Count pending tasks
//            2. If pending < PLANNER_TRIGGER_THRESHOLD (10) → run Autonomous Planner (generates 50 tasks)
//            3. Execute up to MAX_TASKS roadmap tasks with full verify-gate lifecycle
//            4. Return results and exit
//
//          This is the single authoritative scheduler entry point.
//          Manual triggers (orchestrator/run, queue) remain available for
//          on-demand execution but are not required for autonomous operation.
//
// Date: 2026-03-10

import { NextResponse }      from "next/server";
import { createClient }      from "@supabase/supabase-js";
import { runRoadmapWorker }  from "@/lib/execution/roadmapWorker";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;   // 5 min — worker cycle must complete well within this

// ── Supabase ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Queue Recovery ────────────────────────────────────────────────────────────
// Runs at the start of every cycle. Zero manual SQL required.
// Returns a summary for logging.

interface RecoveryResult {
  deadTasksRecovered  : number;   // running/verifying/in_progress → retry
  retryTasksRequeued  : number;   // retry → pending (when pending = 0)
  blockedTasksReleased: number;   // blocked → pending (dep timeout > 5 min)
  durationMs          : number;
}

async function runQueueRecovery(): Promise<RecoveryResult> {
  const start  = Date.now();
  const client = db();

  const DEAD_TASK_TIMEOUT_MS   = 10 * 60 * 1000;   // 10 minutes
  const BLOCKED_TIMEOUT_MS     =  5 * 60 * 1000;   //  5 minutes
  const now                    = new Date().toISOString();
  const deadCutoff             = new Date(Date.now() - DEAD_TASK_TIMEOUT_MS).toISOString();
  const blockedCutoff          = new Date(Date.now() - BLOCKED_TIMEOUT_MS).toISOString();

  let deadTasksRecovered   = 0;
  let retryTasksRequeued   = 0;
  let blockedTasksReleased = 0;

  // ── 1. Dead task detection ─────────────────────────────────────────────────
  // Tasks stuck in running / verifying / in_progress for > 10 minutes are
  // presumed dead (executor crashed, function timed out, heartbeat lost).
  // Move them to retry so they re-enter the execution queue.
  const DEAD_STATUSES = ["running", "verifying", "in_progress"] as const;

  for (const status of DEAD_STATUSES) {
    const { data: deadTasks, error: fetchErr } = await client
      .from("roadmap_tasks")
      .select("id, title, updated_at")
      .eq("status", status)
      .lt("updated_at", deadCutoff);

    if (fetchErr) {
      console.warn(`[queue-recovery] dead-task fetch error (${status}): ${fetchErr.message}`);
      continue;
    }

    if (!deadTasks?.length) continue;

    const ids = deadTasks.map((t: { id: string }) => t.id);

    const { error: updateErr } = await client
      .from("roadmap_tasks")
      .update({
        status    : "retry",
        error     : `Auto-recovered from dead ${status} state (>10 min timeout) at ${now}`,
        updated_at: now,
      })
      .in("id", ids);

    if (updateErr) {
      console.warn(`[queue-recovery] dead-task update error (${status}): ${updateErr.message}`);
    } else {
      deadTasksRecovered += ids.length;
      console.log(`[queue-recovery] ♻️  Dead ${status}: recovered ${ids.length} task(s) → retry`);
      for (const t of deadTasks as Array<{ id: string; title: string; updated_at: string }>) {
        console.log(`[queue-recovery]   • ${t.id} | ${t.title?.slice(0, 60)} | last updated: ${t.updated_at}`);
      }
    }
  }

  // ── 2. Retry → Pending requeue ─────────────────────────────────────────────
  // If no pending tasks exist, convert all retry tasks back to pending.
  // This allows workers to resume without any manual SQL.
  const { data: pendingCheck, error: pendingErr } = await client
    .from("roadmap_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (pendingErr) {
    console.warn(`[queue-recovery] pending count error: ${pendingErr.message}`);
  } else {
    const pendingCount = (pendingCheck as unknown as { count: number } | null)?.count ?? 0;

    if (pendingCount === 0) {
      const { data: retryTasks, error: retryFetchErr } = await client
        .from("roadmap_tasks")
        .select("id")
        .eq("status", "retry");

      if (retryFetchErr) {
        console.warn(`[queue-recovery] retry fetch error: ${retryFetchErr.message}`);
      } else if (retryTasks?.length) {
        const retryIds = retryTasks.map((t: { id: string }) => t.id);

        const { error: requeueErr } = await client
          .from("roadmap_tasks")
          .update({
            status    : "pending",
            error     : null,
            updated_at: now,
          })
          .in("id", retryIds);

        if (requeueErr) {
          console.warn(`[queue-recovery] retry requeue error: ${requeueErr.message}`);
        } else {
          retryTasksRequeued = retryIds.length;
          console.log(`[queue-recovery] 🔄 No pending tasks — requeued ${retryIds.length} retry → pending`);
        }
      } else {
        console.log("[queue-recovery] No pending and no retry tasks — queue is empty");
      }
    }
  }

  // ── 3. Blocked task dep-timeout release ───────────────────────────────────
  // Tasks in blocked state whose updated_at is > 5 minutes old are assumed
  // to have a dependency that will never complete (or timed out).
  // Release them back to pending so they can be attempted again.
  const { data: blockedTasks, error: blockedErr } = await client
    .from("roadmap_tasks")
    .select("id, title, updated_at")
    .eq("status", "blocked")
    .lt("updated_at", blockedCutoff);

  if (blockedErr) {
    console.warn(`[queue-recovery] blocked fetch error: ${blockedErr.message}`);
  } else if (blockedTasks?.length) {
    const blockedIds = blockedTasks.map((t: { id: string }) => t.id);

    const { error: releaseErr } = await client
      .from("roadmap_tasks")
      .update({
        status    : "pending",
        error     : null,
        updated_at: now,
      })
      .in("id", blockedIds);

    if (releaseErr) {
      console.warn(`[queue-recovery] blocked release error: ${releaseErr.message}`);
    } else {
      blockedTasksReleased = blockedIds.length;
      console.log(`[queue-recovery] 🔓 Released ${blockedIds.length} blocked task(s) → pending (dep timeout > 5 min)`);
      for (const t of blockedTasks as Array<{ id: string; title: string; updated_at: string }>) {
        console.log(`[queue-recovery]   • ${t.id} | ${t.title?.slice(0, 60)} | blocked since: ${t.updated_at}`);
      }
    }
  }

  const durationMs = Date.now() - start;
  console.log(
    `[queue-recovery] ✅ Complete — ` +
    `dead=${deadTasksRecovered} requeued=${retryTasksRequeued} released=${blockedTasksReleased} ` +
    `${durationMs}ms`
  );

  return { deadTasksRecovered, retryTasksRequeued, blockedTasksReleased, durationMs };
}

// ── GET — Vercel cron invokes routes via GET ──────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const cycleStart = Date.now();

  console.log("Javari autonomous cycle executed");
  console.log(`[worker-cycle] ▶ Cron tick at ${new Date().toISOString()}`);

  // ── Queue Recovery — runs before planner and task execution ──────────────
  let recovery: RecoveryResult | null = null;
  try {
    recovery = await runQueueRecovery();
  } catch (recErr) {
    // Non-fatal — log and continue. Worker cycle must not be blocked by recovery errors.
    console.error(
      `[worker-cycle] ⚠️ Queue recovery threw (non-fatal): ` +
      `${recErr instanceof Error ? recErr.message : String(recErr)}`
    );
  }

  let result;
  try {
    result = await runRoadmapWorker("cron", 20);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker-cycle] ❌ runRoadmapWorker threw: ${message}`);
    return NextResponse.json(
      {
        ok:        false,
        error:     message,
        recovery,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - cycleStart,
      },
      { status: 500 }
    );
  }

  console.log(
    `[worker-cycle] ▶ Cycle complete — ` +
    `executed=${result.tasksExecuted} completed=${result.tasksCompleted} ` +
    `retried=${result.tasksRetried} blocked=${result.tasksBlocked} ` +
    `stopped=${result.stoppedReason} cost=$${result.totalCostUsd.toFixed(4)} ` +
    `duration=${result.durationMs}ms`
  );

  if (result.planner) {
    const p = result.planner;
    console.log(
      `[worker-cycle] 🧠 Planner — ` +
      `triggered=${p.triggered} inserted=${p.inserted} ` +
      `generated=${p.generated} ok=${p.ok} duration=${p.durationMs}ms`
    );
  }

  return NextResponse.json({
    ok:             result.ok,
    timestamp:      new Date().toISOString(),
    cycleId:        result.cycleId,
    tasksExecuted:  result.tasksExecuted,
    tasksCompleted: result.tasksCompleted,
    tasksRetried:   result.tasksRetried,
    tasksBlocked:   result.tasksBlocked,
    stoppedReason:  result.stoppedReason,
    costUsd:        result.totalCostUsd,
    durationMs:     result.durationMs,
    planner:        result.planner ?? null,
    recovery:       recovery ?? null,
  });
}

// ── POST — allow manual trigger for testing / on-demand execution ─────────────

export async function POST(): Promise<NextResponse> {
  return GET();
}
