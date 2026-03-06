import { NextRequest, NextResponse } from "next/server";
import { decomposeTask, getSubtasks } from "@/lib/roadmap/decompose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/javari/decompose
 * Decompose a roadmap task into subtasks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, taskTitle, taskDescription, userId } = body;

    if (!taskId || !taskTitle) {
      return NextResponse.json(
        { ok: false, error: "taskId and taskTitle are required" },
        { status: 400 }
      );
    }

    const result = await decomposeTask(
      taskId,
      taskTitle,
      taskDescription || "",
      userId || "decomposer"
    );

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      subtasks: result.subtasks,
      subtaskCount: result.subtasks?.length || 0,
      originalTaskId: result.originalTaskId,
    });

  } catch (error: any) {
    console.error("[decompose-api] Error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/decompose?taskId=xxx
 * Retrieve subtasks for a task
 */
export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId parameter required" },
        { status: 400 }
      );
    }

    const subtasks = await getSubtasks(taskId);

    return NextResponse.json({
      ok: true,
      subtasks,
      subtaskCount: subtasks.length,
      taskId,
    });

  } catch (error: any) {
    console.error("[decompose-api] Error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
