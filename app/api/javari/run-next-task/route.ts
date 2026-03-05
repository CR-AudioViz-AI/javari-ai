import { NextResponse } from "next/server";
import { runNextTask, isTaskRunning } from "@/lib/roadmap/task-runner";
import { getQueueStats } from "@/lib/roadmap/task-queue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    console.log("[run-next-task] API request received");

    // Check if task is already running
    if (isTaskRunning()) {
      return NextResponse.json({
        ok: false,
        error: "A task is already running",
        isRunning: true,
      });
    }

    // Get queue stats before execution
    const statsBefore = getQueueStats();
    console.log("[run-next-task] Queue stats:", statsBefore);

    // Run next task
    const result = await runNextTask(userId || "anonymous");

    // Get queue stats after execution
    const statsAfter = getQueueStats();

    return NextResponse.json({
      ok: result.success,
      task: result.task,
      output: result.output,
      error: result.error,
      queueStats: statsAfter,
    });
  } catch (err: any) {
    console.error("[run-next-task] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to run task",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check queue status
export async function GET() {
  const stats = getQueueStats();
  const running = isTaskRunning();

  return NextResponse.json({
    queueStats: stats,
    isRunning: running,
  });
}
