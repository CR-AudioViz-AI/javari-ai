import { NextResponse } from "next/server";
import {
  loadRoadmap,
  loadRoadmapTemplate,
  getAvailableTemplates,
  RoadmapItem,
} from "@/lib/roadmap/roadmap-loader";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tasks, template } = body;

    console.log("[load-roadmap] Request received");

    // Load from template
    if (template) {
      console.log("[load-roadmap] Loading template:", template);

      const result = loadRoadmapTemplate(template);

      return NextResponse.json({
        ok: result.success,
        tasksLoaded: result.tasksLoaded,
        tasks: result.tasks,
        queueStats: result.queueStats,
        errors: result.errors,
        template,
      });
    }

    // Load from provided tasks
    if (tasks && Array.isArray(tasks)) {
      console.log("[load-roadmap] Loading", tasks.length, "tasks");

      // Validate tasks
      if (tasks.length === 0) {
        return NextResponse.json(
          { ok: false, error: "No tasks provided" },
          { status: 400 }
        );
      }

      const result = loadRoadmap(tasks as RoadmapItem[]);

      return NextResponse.json({
        ok: result.success,
        tasksLoaded: result.tasksLoaded,
        tasks: result.tasks,
        queueStats: result.queueStats,
        errors: result.errors,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Either 'tasks' array or 'template' name required" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[load-roadmap] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to load roadmap",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to list available templates
export async function GET() {
  const templates = getAvailableTemplates();

  return NextResponse.json({
    ok: true,
    templates,
    message: "Available roadmap templates",
  });
}
