// app/api/javari/autonomy/start/route.ts
// Purpose: Autonomous Engineering Loop start endpoint — triggers one full cycle
//          of discovery → analysis → repair seeding → verification gate across
//          all active registered targets.
// Date: 2026-03-07
//
// POST /api/javari/autonomy/start
// GET  /api/javari/autonomy/start  — returns last cycle summary

import { NextRequest, NextResponse }  from "next/server";
import { runEngineeringLoop, LoopOptions } from "@/lib/autonomy/engineeringLoop";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 300;   // 5 min — covers multi-target analysis

// Lightweight lock: track in-progress cycle via module-level state
// (works within a single serverless instance; cron prevents overlap)
let _cycleRunning = false;
let _lastCycleAt  = "";
let _lastCycleId  = "";

interface StartBody {
  maxTargets?       : number;
  maxFilesPerTarget?: number;
  injectRepairs?    : boolean;
  runGate?          : boolean;
  dryRun?           : boolean;
  userId?           : string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (_cycleRunning) {
    return NextResponse.json({
      ok      : false,
      message : "Cycle already in progress",
      lastCycle: _lastCycleId,
    }, { status: 409 });
  }

  let body: StartBody = {};
  try { body = await req.json() as StartBody; } catch { /* no body = default options */ }

  const options: LoopOptions = {
    maxTargets       : body.maxTargets,
    maxFilesPerTarget: body.maxFilesPerTarget ?? 80,
    injectRepairs    : body.injectRepairs !== false,
    runGate          : body.runGate !== false,
    dryRun           : body.dryRun === true,
    userId           : body.userId ?? "system",
  };

  _cycleRunning = true;
  try {
    console.log(`[autonomy/start] ▶ Starting engineering loop`);
    const record = await runEngineeringLoop(options);
    _lastCycleAt = record.completedAt;
    _lastCycleId = record.cycleId;

    return NextResponse.json({
      ok              : true,
      cycleId         : record.cycleId,
      startedAt       : record.startedAt,
      completedAt     : record.completedAt,
      durationMs      : record.durationMs,
      targetsProcessed: record.targetsProcessed,
      totalIssues     : record.totalIssues,
      totalRepairTasks: record.totalRepairTasks,
      gateResults     : record.gateResults,
      errors          : record.errors,
      targetResults   : record.targetResults,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    _cycleRunning = false;
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok         : true,
    name       : "Javari Autonomous Engineering Loop",
    version    : "1.0.0",
    cycleRunning: _cycleRunning,
    lastCycleAt : _lastCycleAt || null,
    lastCycleId : _lastCycleId || null,
    usage       : {
      method : "POST",
      body   : {
        maxTargets       : "number — limit targets per cycle",
        maxFilesPerTarget: "80 (default)",
        injectRepairs    : "true (default)",
        runGate          : "true (default)",
        dryRun           : "false (default) — analyze only, no DB writes",
        userId           : '"system" (default)',
      },
      cron   : "Runs automatically every 5 minutes via /api/javari/autonomy/start cron",
    },
  });
}
