import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
const db = createAdminClient();
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing roadmap id" }, { status: 400 });
  }
  const { data } = await db
    .from("roadmap_costs")
    .select("*")
    .eq("roadmap_id", id);
  if (!data) {
    return NextResponse.json({ ok: true, totalCost: 0, breakdown: [] });
  }
  const totalCost = data.reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);
  const breakdown: Record<string, number> = {};
  for (const row of data) {
    const key = row.model || "unknown";
    breakdown[key] = (breakdown[key] || 0) + Number(row.estimated_cost || 0);
  }
  return NextResponse.json({
    ok: true,
    totalCost,
    breakdown,
  });
}
