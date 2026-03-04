import { NextResponse } from "next/server";
import { loadRoadmap } from "@/lib/roadmap/persistence";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing roadmap id" }, { status: 400 });
  }
  const roadmap = await loadRoadmap(id);
  if (!roadmap) {
    return NextResponse.json({ ok: false, error: "Roadmap not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, roadmap });
}
