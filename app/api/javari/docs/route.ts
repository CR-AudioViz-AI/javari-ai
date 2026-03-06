import { NextRequest, NextResponse } from "next/server";
import { generateDocumentation, generateRoadmapDocumentation } from "@/lib/docs/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/javari/docs
 * Generate documentation for a completed task
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      taskId,
      taskTitle,
      taskDescription,
      deliverable,
      buildCost,
      validationScore,
      executionTime,
      userId,
      mode = "single", // "single" or "roadmap"
      tasks, // for roadmap mode
      roadmapTitle, // for roadmap mode
    } = body;

    if (mode === "roadmap") {
      // Generate roadmap documentation
      if (!roadmapTitle || !tasks || !Array.isArray(tasks)) {
        return NextResponse.json(
          { ok: false, error: "roadmapTitle and tasks array required for roadmap mode" },
          { status: 400 }
        );
      }

      const result = await generateRoadmapDocumentation(roadmapTitle, tasks);

      if (!result.success) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        markdown: result.markdown,
        cost: result.cost,
      });
    }

    // Generate single task documentation
    if (!taskId || !taskTitle || !deliverable) {
      return NextResponse.json(
        { ok: false, error: "taskId, taskTitle, and deliverable are required" },
        { status: 400 }
      );
    }

    const result = await generateDocumentation({
      taskId,
      taskTitle,
      taskDescription: taskDescription || "",
      deliverable,
      buildCost,
      validationScore,
      executionTime,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      documentation: result.documentation,
      markdown: result.markdown,
      cost: result.cost,
    });

  } catch (error: any) {
    console.error("[docs-api] Error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
