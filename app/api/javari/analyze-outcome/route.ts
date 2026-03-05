import { NextResponse } from "next/server";
import { analyzeOutcome } from "@/lib/roadmap/outcome-intelligence";
import { RoadmapItem } from "@/lib/roadmap/roadmap-loader";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { goal, roadmap, userId } = body;

    console.log("[analyze-outcome] Request received");
    console.log("[analyze-outcome] Goal:", goal);
    console.log("[analyze-outcome] Roadmap tasks:", roadmap?.length || 0);

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Goal is required" },
        { status: 400 }
      );
    }

    if (!roadmap || !Array.isArray(roadmap)) {
      return NextResponse.json(
        { ok: false, error: "Roadmap array is required" },
        { status: 400 }
      );
    }

    console.log("[analyze-outcome] Starting outcome intelligence analysis...");

    const result = await analyzeOutcome(goal, roadmap as RoadmapItem[], userId);

    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: result.error,
      });
    }

    console.log("[analyze-outcome] ✅ Analysis complete");
    console.log("[analyze-outcome] True objective:", result.trueObjective);
    console.log("[analyze-outcome] Added tasks:", result.addedTasks.length);

    return NextResponse.json({
      ok: true,
      trueObjective: result.trueObjective,
      businessContext: result.businessContext,
      successCriteria: result.successCriteria,
      missingCapabilities: result.missingCapabilities,
      addedTasks: result.addedTasks,
      risks: result.risks,
      recommendations: result.recommendations,
      complianceIssues: result.complianceIssues,
      scalabilityConcerns: result.scalabilityConcerns,
      analysis: result.analysis,
      estimatedCost: result.estimatedCost,
      summary: {
        successCriteriaCount: result.successCriteria.length,
        missingCapabilitiesCount: result.missingCapabilities.length,
        addedTasksCount: result.addedTasks.length,
        risksCount: result.risks.length,
        complianceIssuesCount: result.complianceIssues.length,
      },
    });
  } catch (err: any) {
    console.error("[analyze-outcome] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Outcome analysis failed",
      },
      { status: 500 }
    );
  }
}
