import { NextResponse } from "next/server";
import { enhanceRoadmap } from "@/lib/roadmap/roadmap-intelligence";
import { RoadmapItem } from "@/lib/roadmap/roadmap-loader";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tasks, userId } = body;

    console.log("[enhance-roadmap] Request received");
    console.log("[enhance-roadmap] Tasks to analyze:", tasks?.length || 0);

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Tasks array is required and must not be empty" },
        { status: 400 }
      );
    }

    console.log("[enhance-roadmap] Starting roadmap analysis...");

    const result = await enhanceRoadmap(tasks as RoadmapItem[], userId);

    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: result.error,
      });
    }

    console.log("[enhance-roadmap] ✅ Analysis complete");
    console.log("[enhance-roadmap] Risks found:", result.risks.length);
    console.log("[enhance-roadmap] Recommendations:", result.recommendations.length);
    console.log("[enhance-roadmap] Tasks added:", result.addedTasks.length);

    return NextResponse.json({
      ok: true,
      originalTasks: result.originalTasks,
      addedTasks: result.addedTasks,
      risks: result.risks,
      recommendations: result.recommendations,
      analysis: result.analysis,
      estimatedCost: result.estimatedCost,
      summary: {
        originalTaskCount: result.originalTasks.length,
        addedTaskCount: result.addedTasks.length,
        totalTaskCount: result.originalTasks.length + result.addedTasks.length,
        riskCount: result.risks.length,
        recommendationCount: result.recommendations.length,
      },
    });
  } catch (err: any) {
    console.error("[enhance-roadmap] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Roadmap enhancement failed",
      },
      { status: 500 }
    );
  }
}
