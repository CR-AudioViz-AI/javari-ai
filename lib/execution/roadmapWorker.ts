// lib/execution/roadmapWorker.ts
// Purpose: Autonomous roadmap worker — one verified cycle per invocation.
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

  // Pull up to 10 candidates (pending or retry) ordered by age
  const { data, error } = await client
    .from("roadmap_tasks")
    .select("id, title, description, source, depends_on")
    .in("status", ["pending", "retry"])
    .order("updated_at", { ascending: true })
    .limit(10);

  if (error || !data?.length) return null;

  // Resolve dependencies — only execute tasks whose deps are all completed
  const { data: done } = await client
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "completed");

  const doneSet = new Set((done ?? []).map((r: { id: string }) => r.id));

  for (const row of data as Array<{
    id: string; title: string; description: string;
    source?: string; depends_on?: string[] | null;
  }>) {
    const deps = row.depends_on ?? [];
    if (deps.every((d: string) => doneSet.has(d))) {
      const typeTag = row.description?.match(/\[type:([^\]]+)\]/)?.[1] ?? "ai_task";
      return { id: row.id, title: row.title, description: row.description, type: typeTag };
    }
  }
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

  console.log(`[worker] ▶ Cycle ${cycleId} | cap=${cap}`);

  while (executed < cap) {
    // Safety: stop cycle on consecutive failure threshold
    if (consecutiveFails >= MAX_CONSEC) {
      console.warn(`[worker] ⛔ ${MAX_CONSEC} consecutive verification failures — stopping`);
      const result: WorkerCycleResult = {
        ok: false, cycleId, tasksExecuted: executed, tasksCompleted: completed,
        tasksRetried: retried, tasksBlocked: blocked, totalCostUsd: totalCost,
        consecutiveFails, telemetry, stoppedReason: "consecutive_failures",
        durationMs: Date.now() - cycleStart,
      };
      await writeCycleLog(cycleId, result);
      return result;
    }

    // Fetch next task with dependency resolution
    const task = await fetchNext();
    if (!task) break;  // no pending work

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
  };

  console.log(
    `[worker] ▶ Cycle done ${cycleId} | ` +
    `executed=${executed} completed=${completed} retried=${retried} ` +
    `blocked=${blocked} | $${totalCost.toFixed(4)} | ${result.durationMs}ms`
  );

  await writeCycleLog(cycleId, result);
  return result;
}
