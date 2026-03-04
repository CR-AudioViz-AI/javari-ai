import { NextResponse } from "next/server";
import { RoadmapExecutionEngine } from "@/lib/roadmap/execution-engine";
import { enforceRoadmapBudget } from "@/lib/billing/enforcement";
export async function POST(req: Request) {
  const body = await req.json();
  const { roadmap, planTier } = body;
  const allowedBudget = enforceRoadmapBudget(
    planTier ?? "free",
    roadmap.maxBudget ?? 0
  );
  roadmap.maxBudget = allowedBudget;
  const engine = new RoadmapExecutionEngine(roadmap);
  const result = await engine.run();
  return NextResponse.json({
    ok: true,
    roadmap: result,
    enforcedBudget: allowedBudget,
  });
}
