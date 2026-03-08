// app/api/javari/learning/status/route.ts
// Purpose: Learning Intelligence System API — returns full learning report
//          including domain proficiency, technology experience, capability map,
//          and learning timeline.
// Date: 2026-03-07

import { NextRequest, NextResponse }  from "next/server";
import { buildLearningReport }        from "@/lib/learning/learningReportBuilder";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const record = req.nextUrl.searchParams.get("record") === "true";
  const ingest = req.nextUrl.searchParams.get("ingest") !== "false";

  try {
    const report = await buildLearningReport({ ingest, persist: true, record });
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error(`[learning/status] Error: ${err}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  // POST = cron trigger — ingest + record
  try {
    const report = await buildLearningReport({ ingest: true, persist: true, record: true });
    return NextResponse.json({ ok: true, reportId: report.reportId, summary: report.summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
