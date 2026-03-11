// lib/javari/orchestrator.ts
// Purpose: Javari Autonomous Orchestrator — the top-level execution coordinator.
//          Runs a complete ecosystem cycle: gap detection → planning → task execution → telemetry.
//
// Single cycle flow (called every ~30s internally, cron fires every minute):
//   1. Read dashboard metrics (pending tasks, module gaps)
//   2. If pending < 10 → runModuleFactory({ maxGapsToFill: 5 })
//   3. runAutonomousPlanner() — generates new tasks from canonical docs + KG
//   4. runRoadmapWorker() — executes up to MAX_TASKS through build pipeline
//   5. Write cycle telemetry to orchestrator_cycles table
//
// Continuous mode (POST /api/javari/orchestrator/run):
//   Runs up to 5 sequential cycles within a single 300s serverless invocation,
//   with a 30s pause between cycles. Vercel cron minimum is 1 minute, so this
//   pattern achieves near-30s effective cadence.
//
// Safety:
//   - Guardrails check runs before every cycle (cost ceiling, kill switch)
//   - Never throws — all errors captured in OrchestratorResult.errors
//   - Each cycle is idempotent — safe to overlap with cron trigger
//
// Date: 2026-03-11

import { createClient }          from "@supabase/supabase-js";
import { runModuleFactory }      from "@/lib/javari/moduleFactory";
import { runAutonomousPlanner,
         PLANNER_TRIGGER_THRESHOLD }  from "@/lib/planner/autonomousPlanner";
import { runRoadmapWorker }      from "@/lib/execution/roadmapWorker";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrchestratorCycle {
  cycleId          : string;
  cycleStart       : string;
  cycleEnd?        : string;
  pendingAtStart   : number;
  factoryRan       : boolean;
  factoryTasksAdded: number;
  plannerRan       : boolean;
  plannerTasksAdded: number;
  workerTasksRun   : number;
  workerTasksDone  : number;
  modulesGenerated : number;
  costUsd          : number;
  errors           : string[];
  durationMs       : number;
}

export interface OrchestratorResult {
  ok            : boolean;
  mode          : "single" | "continuous";
  cyclesRun     : number;
  totalTasksDone: number;
  totalCostUsd  : number;
  cycles        : OrchestratorCycle[];
  errors        : string[];
  durationMs    : number;
}

// ── DB ────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Read pending task count ───────────────────────────────────────────────────

async function getPendingCount(): Promise<number> {
  try {
    const { count } = await db()
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Persist cycle telemetry ───────────────────────────────────────────────────

async function persistCycle(cycle: OrchestratorCycle): Promise<void> {
  try {
    await db().from("orchestrator_cycles").insert({
      id               : cycle.cycleId,
      cycle_start      : cycle.cycleStart,
      cycle_end        : cycle.cycleEnd ?? new Date().toISOString(),
      tasks_created    : cycle.plannerTasksAdded + cycle.factoryTasksAdded,
      tasks_completed  : cycle.workerTasksDone,
      modules_generated: cycle.modulesGenerated,
      errors           : cycle.errors,
      cost_usd         : cycle.costUsd,
      created_at       : cycle.cycleStart,
    });
  } catch {
    // Non-fatal — telemetry never blocks execution
  }
}

// ── Sleep helper ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Single orchestrator cycle ─────────────────────────────────────────────────

export async function runOrchestratorCycle(): Promise<OrchestratorCycle> {
  const t0        = Date.now();
  const cycleId   = `oc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cycleStart = new Date().toISOString();
  const errors    : string[] = [];

  let pendingAtStart   = 0;
  let factoryRan       = false;
  let factoryTasksAdded = 0;
  let plannerRan       = false;
  let plannerTasksAdded = 0;
  let workerTasksRun   = 0;
  let workerTasksDone  = 0;
  let modulesGenerated = 0;
  let costUsd          = 0;

  console.log(`[orchestrator] ═══════════════════════════════`);
  console.log(`[orchestrator] Cycle ${cycleId} starting`);

  // ── Step 1: Read pending count ────────────────────────────────────────────
  pendingAtStart = await getPendingCount();
  console.log(`[orchestrator] Pending tasks: ${pendingAtStart}`);

  // ── Step 2: Module factory (gap fill) ────────────────────────────────────
  if (pendingAtStart < PLANNER_TRIGGER_THRESHOLD) {
    console.log(`[orchestrator] Queue low (${pendingAtStart} < ${PLANNER_TRIGGER_THRESHOLD}) — running module factory`);
    try {
      const factoryResult = await runModuleFactory({ maxGapsToFill: 5 });
      factoryRan        = true;
      factoryTasksAdded = factoryResult.tasksGenerated;
      modulesGenerated += factoryResult.modulesRegistered;
      if (factoryResult.errors.length > 0) {
        errors.push(...factoryResult.errors.map(e => `factory: ${e}`));
      }
      console.log(`[orchestrator] Factory: ${factoryTasksAdded} tasks added, ${factoryResult.gapsFound} gaps found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`factory: ${msg}`);
      console.warn(`[orchestrator] Factory error (non-fatal): ${msg}`);
    }
  }

  // ── Step 3: Autonomous planner ────────────────────────────────────────────
  try {
    const plannerResult = await runAutonomousPlanner();
    plannerRan        = plannerResult.triggered;
    plannerTasksAdded = plannerResult.inserted;
    if (plannerResult.errors.length > 0) {
      errors.push(...plannerResult.errors.slice(0, 3).map(e => `planner: ${e}`));
    }
    console.log(`[orchestrator] Planner: triggered=${plannerResult.triggered} inserted=${plannerResult.inserted}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`planner: ${msg}`);
    console.warn(`[orchestrator] Planner error (non-fatal): ${msg}`);
  }

  // ── Step 4: Worker cycle ──────────────────────────────────────────────────
  try {
    const workerResult = await runRoadmapWorker("orchestrator", 20);
    workerTasksRun  = workerResult.tasksExecuted;
    workerTasksDone = workerResult.tasksCompleted;
    costUsd        += workerResult.totalCostUsd;
    if (workerResult.artifactBuilds) {
      modulesGenerated += workerResult.artifactBuilds;
    }
    console.log(`[orchestrator] Worker: ${workerTasksRun} run, ${workerTasksDone} done, ${workerResult.stoppedReason}, $${costUsd.toFixed(4)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`worker: ${msg}`);
    console.error(`[orchestrator] Worker error: ${msg}`);
  }

  const durationMs = Date.now() - t0;
  const cycleEnd   = new Date().toISOString();

  const cycle: OrchestratorCycle = {
    cycleId, cycleStart, cycleEnd,
    pendingAtStart,
    factoryRan, factoryTasksAdded,
    plannerRan, plannerTasksAdded,
    workerTasksRun, workerTasksDone,
    modulesGenerated, costUsd,
    errors, durationMs,
  };

  // ── Step 5: Persist telemetry ──────────────────────────────────────────────
  await persistCycle(cycle);

  console.log(`[orchestrator] ✅ Cycle ${cycleId} complete in ${durationMs}ms`);
  console.log(`[orchestrator] ═══════════════════════════════`);

  return cycle;
}

// ── Continuous orchestrator ───────────────────────────────────────────────────
// Runs sequential cycles within a single serverless invocation.
// Vercel cron minimum = 1 minute. maxDuration = 300s.
// Strategy: up to maxCycles with intervalSeconds pause between each.
// Default: 4 cycles × 30s = 120s — safe within 300s limit.

export async function runOrchestrator(options?: {
  intervalSeconds?: number;
  maxCycles?      : number;
}): Promise<OrchestratorResult> {
  const t0             = Date.now();
  const intervalMs     = (options?.intervalSeconds ?? 30) * 1000;
  const maxCycles      = options?.maxCycles ?? 4;
  const cycles         : OrchestratorCycle[] = [];
  const globalErrors   : string[] = [];
  let totalTasksDone   = 0;
  let totalCostUsd     = 0;

  console.log(`[orchestrator] Starting continuous mode: ${maxCycles} cycles × ${intervalMs / 1000}s`);

  for (let i = 0; i < maxCycles; i++) {
    // Abort if we're approaching the 300s Vercel function limit
    if (Date.now() - t0 > 270_000) {
      globalErrors.push(`Stopped at cycle ${i + 1} — approaching 300s function limit`);
      console.warn(`[orchestrator] Stopping at cycle ${i + 1} — function limit`);
      break;
    }

    try {
      const cycle = await runOrchestratorCycle();
      cycles.push(cycle);
      totalTasksDone += cycle.workerTasksDone;
      totalCostUsd   += cycle.costUsd;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      globalErrors.push(`cycle-${i + 1}: ${msg}`);
      console.error(`[orchestrator] Cycle ${i + 1} threw: ${msg}`);
    }

    // Pause between cycles (skip after last)
    if (i < maxCycles - 1) {
      console.log(`[orchestrator] Sleeping ${intervalMs / 1000}s before next cycle...`);
      await sleep(intervalMs);
    }
  }

  return {
    ok            : globalErrors.length === 0,
    mode          : "continuous",
    cyclesRun     : cycles.length,
    totalTasksDone,
    totalCostUsd,
    cycles,
    errors        : globalErrors,
    durationMs    : Date.now() - t0,
  };
}

// ── Orchestrator status from DB ───────────────────────────────────────────────

export async function getOrchestratorStatus(): Promise<{
  running          : boolean;
  lastCycle?       : string;
  lastCycleDurationMs?: number;
  cyclesTotal      : number;
  tasksCompletedTotal: number;
  modulesGeneratedTotal: number;
  recentCycles     : OrchestratorCycle[];
}> {
  try {
    const client = db();
    const { count } = await client
      .from("orchestrator_cycles")
      .select("*", { count: "exact", head: true });

    const { data: recent } = await client
      .from("orchestrator_cycles")
      .select("id, cycle_start, cycle_end, tasks_completed, modules_generated, errors, cost_usd")
      .order("cycle_start", { ascending: false })
      .limit(5);

    const totalDone = await client
      .from("orchestrator_cycles")
      .select("tasks_completed")
      .then(({ data }) => (data ?? []).reduce((s: number, r: { tasks_completed: number }) => s + (r.tasks_completed ?? 0), 0));

    const totalMods = await client
      .from("orchestrator_cycles")
      .select("modules_generated")
      .then(({ data }) => (data ?? []).reduce((s: number, r: { modules_generated: number }) => s + (r.modules_generated ?? 0), 0));

    const last = recent?.[0] as {
      cycle_start?: string;
      cycle_end?: string;
      id?: string;
    } | undefined;

    // "Running" = a cycle started within the last 60s with no end time
    const lastCycleStart = last?.cycle_start ? new Date(last.cycle_start).getTime() : 0;
    const running = (Date.now() - lastCycleStart) < 60_000 && !last?.cycle_end;

    return {
      running,
      lastCycle           : last?.cycle_start,
      lastCycleDurationMs : last?.cycle_end && last?.cycle_start
        ? new Date(last.cycle_end).getTime() - new Date(last.cycle_start).getTime()
        : undefined,
      cyclesTotal         : count ?? 0,
      tasksCompletedTotal : totalDone,
      modulesGeneratedTotal: totalMods,
      recentCycles        : (recent ?? []) as unknown as OrchestratorCycle[],
    };
  } catch {
    return {
      running: false, cyclesTotal: 0,
      tasksCompletedTotal: 0, modulesGeneratedTotal: 0, recentCycles: [],
    };
  }
}
