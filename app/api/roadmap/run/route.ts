import { NextResponse } from "next/server";
import { RoadmapExecutionEngine } from "@/lib/roadmap/execution-engine";
import { loadRoadmap, saveRoadmap } from "@/lib/roadmap/persistence";
import type { Roadmap } from "@/lib/roadmap/types";
export async function POST(req: Request) {
  const incoming = (await req.json()) as Roadmap;
  const existing = await loadRoadmap(incoming.id);
  const roadmap = existing ?? incoming;
  if (!existing) {
    await saveRoadmap(roadmap);
  }
  const engine = new RoadmapExecutionEngine(roadmap);
  const updated = await engine.run();
  return NextResponse.json({ ok: true, roadmap: updated });
}
