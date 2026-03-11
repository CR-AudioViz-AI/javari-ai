// app/api/javari/orchestrator/run/route.ts
// Purpose: Orchestrator API — single cycle or continuous autonomous execution.
//          Called by Vercel cron every minute. Safe for concurrent invocations.
//
// GET  → one cycle: moduleFactory + appFactory + planner + worker
// POST → { mode: "continuous", intervalSeconds: 30, maxCycles: 4 }
//      → { action: "status" } — health check
//      → { action: "app-factory", dryRun: true } — manual app factory trigger
//
// maxDuration = 300s (4 cycles × ~60s each)
// Date: 2026-03-11

import { NextRequest, NextResponse }      from "next/server";
import { runOrchestratorCycle,
         runOrchestrator,
         getOrchestratorStatus }          from "@/lib/javari/orchestrator";
import { runAppFactory, getAppMetrics }   from "@/lib/javari/appFactory";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// GET — single cycle (cron entry point)
export async function GET(): Promise<NextResponse> {
  const cycle = await runOrchestratorCycle();
  return NextResponse.json({
    ok               : true,
    mode             : "single",
    cycleId          : cycle.cycleId,
    pendingAtStart   : cycle.pendingAtStart,
    factoryTasksAdded: cycle.factoryTasksAdded,
    appTasksAdded    : cycle.appTasksAdded,
    plannerTasksAdded: cycle.plannerTasksAdded,
    workerTasksRun   : cycle.workerTasksRun,
    workerTasksDone  : cycle.workerTasksDone,
    modulesGenerated : cycle.modulesGenerated,
    appsGenerated    : cycle.appsGenerated,
    costUsd          : cycle.costUsd,
    watchdogRetries  : cycle.watchdogRetries,
    durationMs       : cycle.durationMs,
    errors           : cycle.errors,
    timestamp        : cycle.cycleEnd ?? new Date().toISOString(),
  });
}

// POST — continuous, status, or app-factory
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = status query */ }

  // Status query
  if (body.action === "status") {
    const [status, appMetrics] = await Promise.all([
      getOrchestratorStatus(),
      getAppMetrics(),
    ]);
    return NextResponse.json({
      ok: true, ...status, apps: appMetrics,
      timestamp: new Date().toISOString(),
    });
  }

  // Manual app factory trigger
  if (body.action === "app-factory") {
    const result = await runAppFactory({
      maxAppsToQueue : typeof body.maxApps === "number" ? body.maxApps : 3,
      dryRun         : body.dryRun === true,
      forcedCategories: Array.isArray(body.categories) ? body.categories as string[] : undefined,
    });
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  }

  // Continuous execution
  const mode            = (body.mode as string | undefined) ?? "single";
  const intervalSeconds = typeof body.intervalSeconds === "number" ? body.intervalSeconds : 30;
  const maxCycles       = typeof body.maxCycles === "number" ? Math.min(body.maxCycles, 8) : 4;

  if (mode === "continuous") {
    const result = await runOrchestrator({ intervalSeconds, maxCycles });
    return NextResponse.json({
      ok              : result.ok,
      mode            : "continuous",
      cyclesRun       : result.cyclesRun,
      totalTasksDone  : result.totalTasksDone,
      totalCostUsd    : result.totalCostUsd,
      durationMs      : result.durationMs,
      cycles          : result.cycles.map(c => ({
        cycleId          : c.cycleId,
        factoryTasksAdded: c.factoryTasksAdded,
        appTasksAdded    : c.appTasksAdded,
        plannerTasksAdded: c.plannerTasksAdded,
        workerTasksDone  : c.workerTasksDone,
        modulesGenerated : c.modulesGenerated,
        appsGenerated    : c.appsGenerated,
        costUsd          : c.costUsd,
        watchdogRetries  : c.watchdogRetries,
        durationMs       : c.durationMs,
        errors           : c.errors,
      })),
      errors          : result.errors,
      timestamp       : new Date().toISOString(),
    });
  }

  // Default: single cycle
  const cycle = await runOrchestratorCycle();
  return NextResponse.json({
    ok               : true,
    mode             : "single",
    cycleId          : cycle.cycleId,
    factoryTasksAdded: cycle.factoryTasksAdded,
    appTasksAdded    : cycle.appTasksAdded,
    plannerTasksAdded: cycle.plannerTasksAdded,
    workerTasksRun   : cycle.workerTasksRun,
    workerTasksDone  : cycle.workerTasksDone,
    modulesGenerated : cycle.modulesGenerated,
    appsGenerated    : cycle.appsGenerated,
    costUsd          : cycle.costUsd,
    watchdogRetries  : cycle.watchdogRetries,
    durationMs       : cycle.durationMs,
    errors           : cycle.errors,
    timestamp        : cycle.cycleEnd ?? new Date().toISOString(),
  });
}
