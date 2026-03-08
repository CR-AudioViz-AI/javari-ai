// app/api/javari/autonomy/loop/route.ts
// Purpose: HTTP interface for the Javari Autonomous Loop.
//          GET  → status + last cycle summary
//          POST → trigger one cycle (cron or manual)
// Date: 2026-03-09

import { NextRequest, NextResponse }          from "next/server";
import { runAutonomousLoop, DEFAULT_LOOP_CONFIG } from "@/lib/javari/autonomy/autonomousLoop";
import type { LoopConfig }                    from "@/lib/javari/autonomy/autonomousLoop";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300; // 5 min max

// Module-level state (per serverless instance)
let _running      = false;
let _lastCycleId  = "";
let _lastCycleAt  = "";
let _lastResult: unknown = null;

interface PostBody {
  dryRun?           : boolean;
  maxTasksPerCycle? : number;
  maxCostUsdPerCycle?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (_running) {
    return NextResponse.json(
      { ok: false, message: "Loop cycle already in progress", lastCycleId: _lastCycleId },
      { status: 409 }
    );
  }

  let body: PostBody = {};
  try { body = await req.json() as PostBody; } catch { /* no body = use defaults */ }

  const config: Partial<LoopConfig> = {
    dryRun            : body.dryRun === true,
    maxTasksPerCycle  : body.maxTasksPerCycle  ?? DEFAULT_LOOP_CONFIG.maxTasksPerCycle,
    maxCostUsdPerCycle: body.maxCostUsdPerCycle ?? DEFAULT_LOOP_CONFIG.maxCostUsdPerCycle,
  };

  _running = true;
  try {
    const result = await runAutonomousLoop(config);
    _lastCycleId = result.cycleId;
    _lastCycleAt = result.completedAt;
    _lastResult  = result;

    return NextResponse.json({
      ok    : true,
      isCron,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    _running = false;
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok         : true,
    name       : "Javari Autonomous Loop",
    version    : "1.0.0",
    running    : _running,
    lastCycleId: _lastCycleId  || null,
    lastCycleAt: _lastCycleAt  || null,
    lastResult : _lastResult   || null,
    config     : DEFAULT_LOOP_CONFIG,
    usage      : {
      POST: {
        dryRun           : "boolean — analyze only, no mutations (default false)",
        maxTasksPerCycle : `number — default ${DEFAULT_LOOP_CONFIG.maxTasksPerCycle}`,
        maxCostUsdPerCycle: `number — default $${DEFAULT_LOOP_CONFIG.maxCostUsdPerCycle}`,
      },
    },
  });
}
