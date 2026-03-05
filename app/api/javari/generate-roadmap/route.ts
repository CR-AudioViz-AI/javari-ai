import { NextResponse } from "next/server";
import { generateAndQueueRoadmap } from "@/lib/roadmap/strategic-planner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { goal, autoQueue, userId } = body;

    console.log("[generate-roadmap] Request received");
    console.log("[generate-roadmap] Goal:", goal);
    console.log("[generate-roadmap] Auto-queue:", autoQueue);

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Goal is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    console.log("[generate-roadmap] Starting strategic planning...");

    const result = await generateAndQueueRoadmap(
      goal.trim(),
      autoQueue === true,
      userId || "api-user"
    );

    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        analysis: result.analysis,
      });
    }

    console.log("[generate-roadmap] ✅ Roadmap generated");
    console.log("[generate-roadmap] Tasks:", result.tasks?.length);
    if (result.tasksQueued !== undefined) {
      console.log("[generate-roadmap] Tasks queued:", result.tasksQueued);
    }

    return NextResponse.json({
      ok: true,
      tasks: result.tasks,
      tasksGenerated: result.tasks?.length || 0,
      tasksQueued: result.tasksQueued,
      estimatedCost: result.estimatedCost,
      autoQueued: autoQueue === true,
    });
  } catch (err: any) {
    console.error("[generate-roadmap] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Roadmap generation failed",
      },
      { status: 500 }
    );
  }
}
