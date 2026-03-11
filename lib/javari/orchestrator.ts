// lib/javari/orchestrator.ts
// Purpose: Javari Autonomous Orchestrator — top-level execution coordinator with self-healing.
//
// Single cycle (runOrchestratorCycle):
//   1. Read dashboard metrics
//   2. If pending < 10 → runModuleFactory (gap fill, priority: critical→high→medium)
//   3. runAppFactory (detect app opportunities, inject build_app tasks)
//   4. runAutonomousPlanner (generate 50 tasks from canonical docs + KG)
//   5. runRoadmapWorker (execute up to 20 tasks through build pipeline)
//   6. Persist OrchestratorCycle telemetry
//
// Self-healing watchdog:
//   Every subsystem call is wrapped in withWatchdog().
//   On failure: logs error + retries once with exponential backoff.
//   Never halts — errors captured in cycle.errors, execution continues.
//
// Continuous mode (runOrchestrator):
//   Up to 4 sequential cycles × 30s interval within a 300s serverless invocation.
//   Hard abort at 270s to stay within Vercel function limit.
//   Idempotent — safe to run concurrently with cron triggers.
//
// Date: 2026-03-11

import { createClient }             from "@supabase/supabase-js";
import { runModuleFactory }         from "@/lib/javari/moduleFactory";
import { runAppFactory }            from "@/lib/javari/appFactory";
import { runAutonomousPlanner,
         PLANNER_TRIGGER_THRESHOLD } from "@/lib/planner/autonomousPlanner";
import { runRoadmapWorker }         from "@/lib/execution/roadmapWorker";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrchestratorCycle {
  cycleId              : string;
  cycleStart           : string;
  cycleEnd?            : string;
  pendingAtStart       : number;
  factoryRan           : boolean;
  factoryTasksAdded    : number;
  appFactoryRan        : boolean;
  appTasksAdded        : number;
  plannerRan           : boolean;
  plannerTasksAdded    : number;
  workerTasksRun       : number;
  workerTasksDone      : number;
  modulesGenerated     : number;
  appsGenerated        : number;
  costUsd              : number;
  errors               : string[];
  watchdogRetries      : number;
  durationMs           : number;
}

export interface OrchestratorResult {
  ok             : boolean;
  mode           : "single" | "continuous";
  cyclesRun      : number;
  totalTasksDone : number;
  totalCostUsd   : number;
  cycles         : OrchestratorCycle[];
  errors         : string[];
  durationMs     : number;
}

// ── DB ────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Self-healing watchdog ─────────────────────────────────────────────────────
// Wraps any async subsystem call. On failure: waits backoffMs, retries once.
// Returns { result, error, retried } — never throws.

async function withWatchdog<T>(
  label    : string,
  fn       : () => Promise<T>,
  backoffMs: number = 3000,
): Promise<{ result: T | null; error: string | null; retried: boolean }> {
  // Attempt 1
  try {
    const result = await fn();
    return { result, error: null, retried: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[watchdog] ${label} failed: ${msg} — retrying in ${backoffMs}ms`);
    await sleep(backoffMs);
  }

  // Attempt 2 (retry)
  try {
    const result = await fn();
    console.log(`[watchdog] ${label} recovered on retry`);
    return { result, error: null, retried: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[watchdog] ${label} failed after retry: ${msg}`);
    return { result: null, error: `${label}: ${msg}`, retried: true };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function persistCycle(cycle: OrchestratorCycle): Promise<void> {
  try {
    await db().from("orchestrator_cycles").insert({
      id               : cycle.cycleId,
      cycle_start      : cycle.cycleStart,
      cycle_end        : cycle.cycleEnd ?? new Date().toISOString(),
      tasks_created    : cycle.plannerTasksAdded + cycle.factoryTasksAdded + cycle.appTasksAdded,
      tasks_completed  : cycle.workerTasksDone,
      modules_generated: cycle.modulesGenerated,
      apps_generated   : cycle.appsGenerated,
      errors           : cycle.errors,
      cost_usd         : cycle.costUsd,
      created_at       : cycle.cycleStart,
    });
  } catch {
    // Non-fatal — table may not exist yet (run /api/javari/run-migration)
  }
}

// ── Single orchestrator cycle ─────────────────────────────────────────────────

export async function runOrchestratorCycle(): Promise<OrchestratorCycle> {
  const t0         = Date.now();
  const cycleId    = `oc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cycleStart = new Date().toISOString();
  const errors     : string[] = [];
  let watchdogRetries = 0;

  let pendingAtStart    = 0;
  let factoryRan        = false;
  let factoryTasksAdded = 0;
  let appFactoryRan     = false;
  let appTasksAdded     = 0;
  let plannerRan        = false;
  let plannerTasksAdded = 0;
  let workerTasksRun    = 0;
  let workerTasksDone   = 0;
  let modulesGenerated  = 0;
  let appsGenerated     = 0;
  let costUsd           = 0;

  console.log(`[orchestrator] ═══════════════ Cycle ${cycleId} ═══════════════`);

  // ── Step 1: Read pending count ─────────────────────────────────────────────
  pendingAtStart = await getPendingCount();
  console.log(`[orchestrator] Pending: ${pendingAtStart} | Threshold: ${PLANNER_TRIGGER_THRESHOLD}`);

  // ── Step 2: Module factory (gap fill) — watchdog protected ────────────────
  if (pendingAtStart < PLANNER_TRIGGER_THRESHOLD) {
    const wd = await withWatchdog("moduleFactory", () =>
      runModuleFactory({ maxGapsToFill: 5 })
    );
    if (wd.result) {
      factoryRan        = true;
      factoryTasksAdded = wd.result.tasksGenerated;
      modulesGenerated += wd.result.modulesRegistered;
      if (wd.result.errors.length > 0) errors.push(...wd.result.errors.map(e => `factory: ${e}`));
    }
    if (wd.error) errors.push(wd.error);
    if (wd.retried) watchdogRetries++;
    console.log(`[orchestrator] Factory: ran=${factoryRan} tasks=${factoryTasksAdded} retried=${wd.retried}`);
  }

  // ── Step 3: App factory (ecosystem app generation) — watchdog protected ───
  if (pendingAtStart < PLANNER_TRIGGER_THRESHOLD) {
    const wd = await withWatchdog("appFactory", () =>
      runAppFactory({ maxAppsToQueue: 3 })
    );
    if (wd.result) {
      appFactoryRan  = true;
      appTasksAdded  = wd.result.tasksGenerated;
      appsGenerated += wd.result.appsRegistered;
      if (wd.result.errors.length > 0) errors.push(...wd.result.errors.map(e => `appFactory: ${e}`));
    }
    if (wd.error) errors.push(wd.error);
    if (wd.retried) watchdogRetries++;
    console.log(`[orchestrator] AppFactory: ran=${appFactoryRan} tasks=${appTasksAdded} retried=${wd.retried}`);
  }

  // ── Step 4: Autonomous planner — watchdog protected ───────────────────────
  const wdPlanner = await withWatchdog("planner", () => runAutonomousPlanner());
  if (wdPlanner.result) {
    plannerRan        = wdPlanner.result.triggered;
    plannerTasksAdded = wdPlanner.result.inserted;
    if (wdPlanner.result.errors.length > 0) {
      errors.push(...wdPlanner.result.errors.slice(0, 3).map(e => `planner: ${e}`));
    }
  }
  if (wdPlanner.error) errors.push(wdPlanner.error);
  if (wdPlanner.retried) watchdogRetries++;
  console.log(`[orchestrator] Planner: triggered=${plannerRan} inserted=${plannerTasksAdded}`);

  // ── Step 5: Worker cycle — watchdog protected ──────────────────────────────
  const wdWorker = await withWatchdog("worker", () => runRoadmapWorker("orchestrator", 20));
  if (wdWorker.result) {
    workerTasksRun  = wdWorker.result.tasksExecuted;
    workerTasksDone = wdWorker.result.tasksCompleted;
    costUsd        += wdWorker.result.totalCostUsd;
    if (wdWorker.result.artifactBuilds) modulesGenerated += wdWorker.result.artifactBuilds;
  }
  if (wdWorker.error) errors.push(wdWorker.error);
  if (wdWorker.retried) watchdogRetries++;
  console.log(`[orchestrator] Worker: run=${workerTasksRun} done=${workerTasksDone} cost=$${costUsd.toFixed(4)}`);

  const durationMs = Date.now() - t0;
  const cycleEnd   = new Date().toISOString();

  const cycle: OrchestratorCycle = {
    cycleId, cycleStart, cycleEnd,
    pendingAtStart,
    factoryRan, factoryTasksAdded,
    appFactoryRan, appTasksAdded,
    plannerRan, plannerTasksAdded,
    workerTasksRun, workerTasksDone,
    modulesGenerated, appsGenerated,
    costUsd, errors, watchdogRetries, durationMs,
  };

  await persistCycle(cycle);

  console.log(`[orchestrator] ✅ Done in ${durationMs}ms | watchdogRetries=${watchdogRetries} | errors=${errors.length}`);
  console.log(`[orchestrator] ═══════════════════════════════════════════════`);

  return cycle;
}

// ── Continuous orchestrator ───────────────────────────────────────────────────

export async function runOrchestrator(options?: {
  intervalSeconds?: number;
  maxCycles?      : number;
}): Promise<OrchestratorResult> {
  const t0           = Date.now();
  const intervalMs   = (options?.intervalSeconds ?? 30) * 1000;
  const maxCycles    = options?.maxCycles ?? 4;
  const cycles       : OrchestratorCycle[] = [];
  const globalErrors : string[] = [];
  let totalTasksDone = 0;
  let totalCostUsd   = 0;

  console.log(`[orchestrator] Continuous mode: ${maxCycles} cycles × ${intervalMs / 1000}s`);

  for (let i = 0; i < maxCycles; i++) {
    if (Date.now() - t0 > 270_000) {
      globalErrors.push(`Stopped at cycle ${i + 1} — approaching 300s function limit`);
      console.warn(`[orchestrator] Hard stop at cycle ${i + 1} — 270s limit`);
      break;
    }

    const wd = await withWatchdog(`cycle-${i + 1}`, () => runOrchestratorCycle());
    if (wd.result) {
      cycles.push(wd.result);
      totalTasksDone += wd.result.workerTasksDone;
      totalCostUsd   += wd.result.costUsd;
    }
    if (wd.error) globalErrors.push(wd.error);

    if (i < maxCycles - 1) {
      console.log(`[orchestrator] Sleeping ${intervalMs / 1000}s...`);
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

// ── Status ────────────────────────────────────────────────────────────────────

export async function getOrchestratorStatus(): Promise<{
  running               : boolean;
  lastCycle?            : string;
  lastCycleDurationMs?  : number;
  cyclesTotal           : number;
  tasksCompletedTotal   : number;
  modulesGeneratedTotal : number;
  appsGeneratedTotal    : number;
  recentCycles          : OrchestratorCycle[];
}> {
  try {
    const client = db();
    const { count } = await client
      .from("orchestrator_cycles")
      .select("*", { count: "exact", head: true });

    const { data: recent } = await client
      .from("orchestrator_cycles")
      .select("id, cycle_start, cycle_end, tasks_completed, modules_generated, apps_generated, errors, cost_usd")
      .order("cycle_start", { ascending: false })
      .limit(5);

    const totalDone = ((await client.from("orchestrator_cycles").select("tasks_completed")).data ?? [])
      .reduce((s: number, r: { tasks_completed: number }) => s + (r.tasks_completed ?? 0), 0);

    const totalMods = ((await client.from("orchestrator_cycles").select("modules_generated")).data ?? [])
      .reduce((s: number, r: { modules_generated: number }) => s + (r.modules_generated ?? 0), 0);

    const totalApps = ((await client.from("orchestrator_cycles").select("apps_generated")).data ?? [])
      .reduce((s: number, r: { apps_generated: number }) => s + (r.apps_generated ?? 0), 0);

    const last = recent?.[0] as { cycle_start?: string; cycle_end?: string } | undefined;
    const lastCycleStart = last?.cycle_start ? new Date(last.cycle_start).getTime() : 0;
    const running = (Date.now() - lastCycleStart) < 60_000 && !last?.cycle_end;

    return {
      running,
      lastCycle           : last?.cycle_start,
      lastCycleDurationMs : last?.cycle_end && last?.cycle_start
        ? new Date(last.cycle_end).getTime() - new Date(last.cycle_start).getTime()
        : undefined,
      cyclesTotal           : count ?? 0,
      tasksCompletedTotal   : totalDone,
      modulesGeneratedTotal : totalMods,
      appsGeneratedTotal    : totalApps,
      recentCycles          : (recent ?? []) as unknown as OrchestratorCycle[],
    };
  } catch {
    return {
      running: false, cyclesTotal: 0,
      tasksCompletedTotal: 0, modulesGeneratedTotal: 0, appsGeneratedTotal: 0, recentCycles: [],
    };
  }
}
