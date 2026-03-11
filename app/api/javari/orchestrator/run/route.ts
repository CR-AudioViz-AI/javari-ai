// app/api/javari/orchestrator/run/route.ts
// Purpose: Orchestrator API — trigger single or continuous autonomous execution cycles.
//          Called by Vercel cron every minute. Also available for manual triggers.
//
// GET  → one orchestrator cycle (planner check + module factory + worker)
// POST → continuous mode: up to 4 cycles × 30s within one serverless invocation
//        Body: { "mode": "continuous", "intervalSeconds": 30 }
//
// maxDuration = 300s to support continuous mode (4 cycles × ~60s each = ~240s)
//
// Date: 2026-03-11

import { NextRequest, NextResponse }        from "next/server";
import { runOrchestratorCycle, runOrchestrator, getOrchestratorStatus } from "@/lib/javari/orchestrator";

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
    plannerTasksAdded: cycle.plannerTasksAdded,
    workerTasksRun   : cycle.workerTasksRun,
    workerTasksDone  : cycle.workerTasksDone,
    modulesGenerated : cycle.modulesGenerated,
    costUsd          : cycle.costUsd,
    durationMs       : cycle.durationMs,
    errors           : cycle.errors,
    timestamp        : cycle.cycleEnd ?? new Date().toISOString(),
  });
}

// POST — continuous mode or status query
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = status query */ }

  // Status query
  if (body.action === "status") {
    const status = await getOrchestratorStatus();
    return NextResponse.json({ ok: true, ...status, timestamp: new Date().toISOString() });
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
        cycleId         : c.cycleId,
        factoryTasksAdded: c.factoryTasksAdded,
        plannerTasksAdded: c.plannerTasksAdded,
        workerTasksDone : c.workerTasksDone,
        modulesGenerated: c.modulesGenerated,
        costUsd         : c.costUsd,
        durationMs      : c.durationMs,
        errors          : c.errors,
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
    pendingAtStart   : cycle.pendingAtStart,
    factoryTasksAdded: cycle.factoryTasksAdded,
    plannerTasksAdded: cycle.plannerTasksAdded,
    workerTasksRun   : cycle.workerTasksRun,
    workerTasksDone  : cycle.workerTasksDone,
    modulesGenerated : cycle.modulesGenerated,
    costUsd          : cycle.costUsd,
    durationMs       : cycle.durationMs,
    errors           : cycle.errors,
    timestamp        : cycle.cycleEnd ?? new Date().toISOString(),
  });
}
