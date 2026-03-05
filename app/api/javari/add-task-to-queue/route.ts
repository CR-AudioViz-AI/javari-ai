import { NextResponse } from "next/server";
import { addTask } from "@/lib/roadmap/task-queue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, description, priority } = body;

    console.log("[add-task-to-queue] Request received:", { id, title, priority });

    if (!id || !title || !description) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: id, title, description" },
        { status: 400 }
      );
    }

    const task = addTask({
      id,
      title,
      description,
      priority: priority ?? 1,
    });

    console.log("[add-task-to-queue] Task added to queue:", task.id);

    return NextResponse.json({
      ok: true,
      task,
      message: "Task added to queue",
    });
  } catch (err: any) {
    console.error("[add-task-to-queue] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to add task",
      },
      { status: 500 }
    );
  }
}
