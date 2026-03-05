import { NextResponse } from "next/server";
import { executeRoadmapTask, RoadmapTask } from "@/lib/roadmap/roadmap-executor";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, title, description, userId } = body;

    console.log("[execute-roadmap-task] Request received:", { taskId, title, userId });

    if (!taskId || !title || !description) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: taskId, title, description" },
        { status: 400 }
      );
    }

    // Create task object
    const task: RoadmapTask = {
      id: taskId,
      title,
      description,
      status: "pending",
    };

    console.log("[execute-roadmap-task] Executing task:", task.id);

    // Execute task through roadmap executor
    const result = await executeRoadmapTask(task, userId || "anonymous");

    console.log("[execute-roadmap-task] Execution result:", {
      success: result.success,
      status: result.task.status,
      cost: result.estimatedCost,
    });

    return NextResponse.json({
      ok: result.success,
      task: result.task,
      output: result.output,
      estimatedCost: result.estimatedCost,
      rolesExecuted: result.rolesExecuted,
      error: result.error,
    });
  } catch (err: any) {
    console.error("[execute-roadmap-task] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Task execution failed",
      },
      { status: 500 }
    );
  }
}
