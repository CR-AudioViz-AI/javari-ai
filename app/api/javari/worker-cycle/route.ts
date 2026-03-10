// app/api/javari/worker-cycle/route.ts
// Purpose: Dedicated cron endpoint for Javari autonomous execution.
//          Called every 60 seconds by Vercel cron scheduler.
//          Delegates entirely to runRoadmapWorker() — no logic lives here.
//
//          Worker behavior per cycle:
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
import { runRoadmapWorker }  from "@/lib/execution/roadmapWorker";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;   // 5 min — worker cycle must complete well within this

// ── GET — Vercel cron invokes routes via GET ──────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const cycleStart = Date.now();

  console.log("Javari autonomous cycle executed");
  console.log(`[worker-cycle] ▶ Cron tick at ${new Date().toISOString()}`);

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
  });
}

// ── POST — allow manual trigger for testing / on-demand execution ─────────────

export async function POST(): Promise<NextResponse> {
  return GET();
}
