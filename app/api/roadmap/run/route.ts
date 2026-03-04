import { NextResponse } from "next/server";
import { RoadmapExecutionEngine } from "@/lib/roadmap/execution-engine";
import type { Roadmap } from "@/lib/roadmap/types";
export async function POST(req: Request) {
  const roadmap = (await req.json()) as Roadmap;
  const engine = new RoadmapExecutionEngine(roadmap);
  const updated = await engine.run();
  return NextResponse.json({ ok: true, roadmap: updated });
}
