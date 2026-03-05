import { NextResponse } from "next/server";
import { runAutonomousLoop, isTaskRunning } from "@/lib/roadmap/task-runner";
import { getQueueStats } from "@/lib/roadmap/task-queue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    console.log("[run-autonomous] API request received");
    console.log("[run-autonomous] User:", userId);

    // Safety check: Don't start if already running
    if (isTaskRunning()) {
      return NextResponse.json({
        ok: false,
        error: "A task is already running. Wait for completion before starting autonomous mode.",
      });
    }

    // Check queue before starting
    const queueStats = getQueueStats();
    console.log("[run-autonomous] Queue stats before execution:", queueStats);

    if (queueStats.pending === 0) {
      return NextResponse.json({
        ok: false,
        error: "No pending tasks in queue",
        queueStats,
      });
    }

    console.log("[run-autonomous] Starting autonomous execution...");

    // Run autonomous loop
    const result = await runAutonomousLoop(userId || "anonymous");

    console.log("[run-autonomous] Autonomous execution complete");
    console.log("[run-autonomous] Tasks executed:", result.tasksExecuted);
    console.log("[run-autonomous] Succeeded:", result.tasksSucceeded);
    console.log("[run-autonomous] Failed:", result.tasksFailed);

    // Get final queue stats
    const finalStats = getQueueStats();

    return NextResponse.json({
      ok: result.success,
      tasksExecuted: result.tasksExecuted,
      tasksSucceeded: result.tasksSucceeded,
      tasksFailed: result.tasksFailed,
      stoppedReason: result.stoppedReason,
      queueStats: finalStats,
      results: result.results.map(r => ({
        taskId: r.task?.id,
        title: r.task?.title,
        success: r.success,
        error: r.error,
      })),
    });
  } catch (err: any) {
    console.error("[run-autonomous] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Autonomous execution failed",
      },
      { status: 500 }
    );
  }
}
