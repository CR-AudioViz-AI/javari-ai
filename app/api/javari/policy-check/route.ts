import { NextResponse } from "next/server";
import { evaluateTasks, getPolicySummary } from "@/lib/governance/policy-engine";
import { RoadmapItem } from "@/lib/roadmap/roadmap-loader";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tasks } = body;

    console.log("[policy-check] Request received");
    console.log("[policy-check] Tasks to evaluate:", tasks?.length || 0);

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Tasks array is required" },
        { status: 400 }
      );
    }

    console.log("[policy-check] Starting policy evaluation...");

    const evaluation = await evaluateTasks(tasks as RoadmapItem[]);

    console.log("[policy-check] ✅ Evaluation complete");
    console.log("[policy-check] Approved:", evaluation.approvedTasks.length);
    console.log("[policy-check] Blocked:", evaluation.blockedTasks.length);
    console.log("[policy-check] Warnings:", evaluation.warnings.length);

    return NextResponse.json({
      ok: true,
      success: evaluation.success,
      approvedTasks: evaluation.approvedTasks,
      blockedTasks: evaluation.blockedTasks,
      warnings: evaluation.warnings,
      policyViolations: evaluation.policyViolations,
      summary: evaluation.summary,
    });
  } catch (err: any) {
    console.error("[policy-check] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Policy check failed",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for policy information
export async function GET() {
  const summary = getPolicySummary();
  
  return NextResponse.json({
    ok: true,
    ...summary,
  });
}
