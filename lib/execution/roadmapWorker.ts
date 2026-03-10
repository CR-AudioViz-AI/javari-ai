// lib/execution/roadmapWorker.ts
// Purpose: Autonomous roadmap worker — one verified cycle per invocation.
//          Integrated with Autonomous Planner: when pending tasks < PLANNER_TRIGGER_THRESHOLD,
//          the planner is invoked BEFORE execution to generate 50 new tasks automatically.
//          This enables continuous autonomous operation without human input.
//          Continuous execution is provided by the Vercel cron hitting
//          /api/javari/queue every minute. Each cron fires one cycle.
//          No infinite loop — serverless functions have hard timeouts.
//
// Lifecycle per task:
//   pending/retry → in_progress → verifying → completed | retry | blocked
//   ONLY the verifier may write status=completed. No exceptions.
//
// Safety limits per cycle:
//   MAX_TASKS     = 5   cap per invocation
//   MAX_CONSEC_FAILS = 3   stop cycle if 3 tasks in a row fail verification
//
// Routing: build_module | create_api | update_schema | deploy_feature → quality (Claude Sonnet)
//          ai_task → cost (cheapest available)
//
// Date: 2026-03-07

import { createClient }   from "@supabase/supabase-js";
import { executeTask as runTypedTask, ExecutableTask } from "./taskExecutor";
import { verifyTask }     from "@/lib/roadmap/verifyTask";
import { runGuardrails }  from "./guardrails";
import { acquireTaskLock, startHeartbeat } from "./persistence";
import { runAutonomousPlanner, PLANNER_TRIGGER_THRESHOLD, type PlannerResult } from "@/lib/planner/autonomousPlanner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TaskTelemetry {
  taskId        : string;
  taskTitle     : string;
  taskType      : string;
  routingHint   : "quality" | "cost";
  executionMs   : number;
  artifactCount : number;
  verdict       : "completed" | "retry" | "blocked";
  failReason?   : string;
  checks        : Array<{ name: string; pass: boolean }>;
  estimatedCost : number;
}

export interface WorkerCycleResult {
  ok              : boolean;
  cycleId         : string;
  tasksExecuted   : number;
  tasksCompleted  : number;
  tasksRetried    : number;
  tasksBlocked    : number;
  totalCostUsd    : number;
  consecutiveFails: number;
  telemetry       : TaskTelemetry[];
  stoppedReason   : "no_pending" | "max_tasks" | "consecutive_failures" | "guardrail";
  durationMs      : number;
  planner?        : PlannerResult;   // present when planner was evaluated this cycle
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_TASKS      = 20;
const MAX_CONSEC     = 3;
const PREVIEW_BASE   =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Routing: task type → model priority ──────────────────────────────────

function routingHint(type: string): "quality" | "cost" {
  switch (type) {
    case "build_module":
    case "create_api":
    case "update_schema":
    case "deploy_feature":
      return "quality";   // Claude Sonnet — structured code work
    default:
      return "cost";       // cheapest available — narrative / ai_task
  }
}

// ── Fetch next executable task ────────────────────────────────────────────

async function fetchNext(): Promise<ExecutableTask | null> {
  const client = db();

  // Pull up to 25 pending tasks — enough to find executable ones past dep-blocked rows.
  // LIMIT 3 was insufficient: blocked tasks can occupy the first N slots.
  const { data, error } = await client
    .from("roadmap_tasks")
    .select("id, title, description, source, depends_on")
    .eq("status", "pending")
    .limit(25);

  if (error) {
    console.error(`[worker] fetchNext DB error: ${error.message}`);
    return null;
  }
  if (!data?.length) {
    console.log("[worker] fetchNext: 0 pending tasks in DB");
    return null;
  }

  console.log(`[worker] fetchNext: ${data.length} pending candidates`);

  // Resolve dependencies — only execute tasks whose deps are all completed.
  // Tasks with depends_on referencing nonexistent IDs are treated as unblocked
  // (the dep ID simply doesn't exist — it was never inserted or already cleaned up).
  // This prevents orphaned dep references from permanently blocking execution.
  const { data: done, error: doneErr } = await client
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "completed");

  if (doneErr) {
    console.warn(`[worker] fetchNext: completed-set query failed: ${doneErr.message} — treating all deps as met`);
  }

  const doneSet = new Set((done ?? []).map((r: { id: string }) => r.id));

  // Also fetch ALL task IDs (any status) to distinguish "dep exists but not done"
  // from "dep ID doesn't exist at all" (orphaned reference)
  const { data: allIds } = await client
    .from("roadmap_tasks")
    .select("id");
  const allIdSet = new Set((allIds ?? []).map((r: { id: string }) => r.id));

  for (const row of data as Array<{
    id: string; title: string; description: string;
    source?: string; depends_on?: string[] | null;
  }>) {
    const deps = row.depends_on ?? [];

    // Filter to only deps that actually exist in the table
    // Orphaned dep IDs (not in allIdSet) are ignored — they can never be met
    const realDeps = deps.filter((d: string) => allIdSet.has(d));
    const unmetReal = realDeps.filter((d: string) => !doneSet.has(d));

    if (deps.length > 0 && deps.length !== realDeps.length) {
      const orphaned = deps.filter((d: string) => !allIdSet.has(d));
      console.log(`[worker] ${row.id}: ${orphaned.length} orphaned dep(s) ignored: ${orphaned.join(", ")}`);
    }

    if (unmetReal.length === 0) {
      const typeTag = row.description?.match(/\[type:([^\]]+)\]/)?.[1] ?? "ai_task";
      console.log(`[worker] fetchNext: selected ${row.id} | deps=${deps.length} real=${realDeps.length} unmet=${unmetReal.length} | ${row.title.slice(0,60)}`);
      return { id: row.id, title: row.title, description: row.description, type: typeTag };
    } else {
      console.log(`[worker] fetchNext: skip ${row.id} — ${unmetReal.length} unmet dep(s): ${unmetReal.join(", ")}`);
    }
  }

  console.log("[worker] fetchNext: all candidates blocked by unmet deps");
  return null;
}

// ── Status helpers ─────────────────────────────────────────────────────────

async function setStatus(
  id    : string,
  status: "in_progress" | "verifying" | "completed" | "retry" | "blocked",
  extra?: { result?: string; error?: string }
): Promise<void> {
  const upd: Record<string, unknown> = { status, updated_at: Date.now() };
  if (extra?.result) upd.result = extra.result;
  if (extra?.error)  upd.error  = extra.error;
  await db().from("roadmap_tasks").update(upd).eq("id", id);
}

// ── Write telemetry log ────────────────────────────────────────────────────

async function writeCycleLog(cycleId: string, result: WorkerCycleResult): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    await fetch(`${url}/rest/v1/javari_execution_logs`, {
      method : "POST",
      headers: {
        "Content-Type" : "application/json",
        "apikey"       : key,
        "Authorization": `Bearer ${key}`,
        "Prefer"       : "return=minimal",
      },
      body: JSON.stringify({
        execution_id  : cycleId,
        task_id       : `cycle:${cycleId}`,
        model_used    : "roadmap_worker",
        cost          : result.totalCostUsd,
        tokens_in     : 0,
        tokens_out    : 0,
        execution_time: result.durationMs,
        status        : result.ok ? "success" : "failed",
        error_message : result.stoppedReason === "consecutive_failures"
                          ? `Stopped: ${MAX_CONSEC} consecutive failures`
                          : null,
        timestamp     : new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-blocking */ }
}

// ══════════════════════════════════════════════════════════════════
// runRoadmapWorker — one complete autonomous cycle
// ══════════════════════════════════════════════════════════════════

export async function runRoadmapWorker(
  userId    : string = "worker",
  maxTasks  : number = MAX_TASKS
): Promise<WorkerCycleResult> {
  const cycleStart = Date.now();
  const cycleId    = `wc-${cycleStart}-${Math.random().toString(36).slice(2, 6)}`;
  const cap        = Math.min(maxTasks, MAX_TASKS);

  let executed = 0, completed = 0, retried = 0, blocked = 0;
  let consecutiveFails = 0;
  let totalCost = 0;
  const telemetry: TaskTelemetry[] = [];

  console.log(`[worker] ▶ Cycle ${cycleId} | cap=${cap} | userId=${userId}`);

  // ── Autonomous Planner gate ────────────────────────────────────────────
  // Count pending tasks. If below PLANNER_TRIGGER_THRESHOLD, run the planner
  // to generate 50 new tasks before executing any more work.
  let plannerResult: PlannerResult | undefined;
  try {
    const { data: pendingSnap, error: snapErr } = await db()
      .from("roadmap_tasks")
      .select("id")
      .eq("status", "pending");

    const pendingNow = pendingSnap?.length ?? 0;
    console.log(`[worker] DB pending count at cycle start: ${pendingNow}`);

    if (pendingNow < PLANNER_TRIGGER_THRESHOLD) {
      console.log(`[worker] 🧠 Planner trigger: ${pendingNow} pending < ${PLANNER_TRIGGER_THRESHOLD} — running Autonomous Planner`);
      plannerResult = await runAutonomousPlanner();
      console.log(
        `[worker] 🧠 Planner done — ` +
        `triggered=${plannerResult.triggered} inserted=${plannerResult.inserted} ` +
        `generated=${plannerResult.generated} skipped=${plannerResult.skipped} ` +
        `ok=${plannerResult.ok} duration=${plannerResult.durationMs}ms`
      );
      if (!plannerResult.ok && plannerResult.errors.length > 0) {
        console.warn(`[worker] Planner errors: ${plannerResult.errors.join("; ")}`);
      }
    } else {
      console.log(`[worker] Planner gate: ${pendingNow} pending ≥ ${PLANNER_TRIGGER_THRESHOLD} — planner not needed`);
    }
  } catch (planErr) {
    console.error(`[worker] Planner gate exception (non-fatal): ${planErr instanceof Error ? planErr.message : String(planErr)}`);
  }

  while (executed < cap) {
    // Safety: stop cycle on consecutive failure threshold
    if (consecutiveFails >= MAX_CONSEC) {
      console.warn(`[worker] ⛔ ${MAX_CONSEC} consecutive verification failures — stopping`);
      const result: WorkerCycleResult = {
        ok: false, cycleId, tasksExecuted: executed, tasksCompleted: completed,
        tasksRetried: retried, tasksBlocked: blocked, totalCostUsd: totalCost,
        consecutiveFails, telemetry, stoppedReason: "consecutive_failures",
        durationMs: Date.now() - cycleStart,
        planner: plannerResult,
      };
      await writeCycleLog(cycleId, result);
      return result;
    }

    // Fetch next task with dependency resolution
    const task = await fetchNext();
    if (!task) {
      console.log(`[worker] fetchNext returned null — stopping cycle (executed=${executed})`);
      break;  // no pending work or all blocked
    }

    executed++;
    const taskStart = Date.now();
    const hint = routingHint(task.type ?? "ai_task");
    console.log(`[worker] [${executed}/${cap}] ${task.id} | type=${task.type} | hint=${hint} | ${task.title}`);

    // ── STEP 1: acquire lock (prevent duplicate concurrent execution) ──
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const locked = await acquireTaskLock(task.id, executionId).catch(() => false);
    if (!locked) {
      console.log(`[worker] ${task.id} locked by concurrent executor — skipping`);
      executed--;  // don't count as a real execution
      continue;
    }
    const stopHeartbeat = startHeartbeat(task.id);

    try {
      // ── STEP 2: guardrails ──────────────────────────────────────────
      const guardrail = await runGuardrails({
        taskId: task.id, executionId,
        taskTitle: task.title,
        estimatedCost: 0.005,
        tier: "system",
      });

      if (!guardrail.passed) {
        const reason = guardrail.results.find(r => r.check === guardrail.blockedBy)?.reason ?? "guardrail_block";
        console.error(`[worker] GUARDRAIL BLOCK ${task.id}: ${reason}`);
        await setStatus(task.id, "blocked", { result: reason });
        telemetry.push({
          taskId: task.id, taskTitle: task.title.slice(0,60),
          taskType: task.type ?? "ai_task", routingHint: hint,
          executionMs: Date.now() - taskStart, artifactCount: 0,
          verdict: "blocked", failReason: reason, checks: [],
          estimatedCost: 0,
        });
        blocked++; consecutiveFails++;
        continue;
      }

      // ── STEP 3: mark in_progress ────────────────────────────────────
      await setStatus(task.id, "in_progress");

      // ── STEP 4: execute (records artifacts internally) ──────────────
      const execResult = await runTypedTask(task as ExecutableTask, userId);
      const estCost = 0.005;  // gateway cost tracking via estimatedCost in response
      totalCost += estCost;

      // ── STEP 5: mark verifying ──────────────────────────────────────
      await setStatus(task.id, "verifying", {
        result: execResult.output ?? (execResult.ok ? "executed" : execResult.error),
      });

      // ── STEP 6: verify via gate ──────────────────────────────────────
      // Call the verify-task API endpoint — it owns the completed write
      const vRes = await fetch(`${PREVIEW_BASE}/api/javari/verify-task`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ task_id: task.id }),
      });
      const vData = await vRes.json().catch(() => ({})) as Record<string, unknown>;
      const verdict = (vData.verdict as string) ?? "retry";

      if (verdict === "completed") {
        completed++; consecutiveFails = 0;
        console.log(`[worker] ✅ ${task.id} → completed`);
      } else if (verdict === "blocked") {
        blocked++; consecutiveFails++;
        console.warn(`[worker] 🔴 ${task.id} → blocked`);
      } else {
        retried++; consecutiveFails++;
        console.warn(`[worker] ⚠️ ${task.id} → ${verdict} | ${vData.failReason ?? "unknown"}`);
      }

      telemetry.push({
        taskId       : task.id,
        taskTitle    : task.title.slice(0, 60),
        taskType     : task.type ?? "ai_task",
        routingHint  : hint,
        executionMs  : Date.now() - taskStart,
        artifactCount: execResult.artifactIds?.length ?? 0,
        verdict      : verdict === "completed" ? "completed" : verdict === "blocked" ? "blocked" : "retry",
        failReason   : verdict !== "completed" ? (vData.failReason as string) : undefined,
        checks       : (vData.checks as Array<{ name: string; pass: boolean }>) ?? [],
        estimatedCost: estCost,
      });

    } finally {
      stopHeartbeat();
    }
  }

  const result: WorkerCycleResult = {
    ok             : completed > 0 || executed === 0,
    cycleId,
    tasksExecuted  : executed,
    tasksCompleted : completed,
    tasksRetried   : retried,
    tasksBlocked   : blocked,
    totalCostUsd   : totalCost,
    consecutiveFails,
    telemetry,
    stoppedReason  : executed === 0
      ? "no_pending"
      : executed >= cap
        ? "max_tasks"
        : "no_pending",
    durationMs: Date.now() - cycleStart,
    planner: plannerResult,
  };

  console.log(
    `[worker] ▶ Cycle done ${cycleId} | ` +
    `executed=${executed} completed=${completed} retried=${retried} ` +
    `blocked=${blocked} | $${totalCost.toFixed(4)} | ${result.durationMs}ms`
  );

  await writeCycleLog(cycleId, result);
  return result;
}
