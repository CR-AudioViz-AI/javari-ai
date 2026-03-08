// app/api/javari/operations/status/route.ts
// Purpose: Operations Center status API — returns full real-time operations
//          report including health score, scan/repair metrics, task queue,
//          and customer audits.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import { buildDashboardData }        from "@/lib/operations/dashboardDataBuilder";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const record = req.nextUrl.searchParams.get("record") === "true";

  try {
    const data = await buildDashboardData(record);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error(`[operations/status] Error: ${err}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  // POST triggers a recorded snapshot (for cron)
  try {
    const data = await buildDashboardData(true);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
