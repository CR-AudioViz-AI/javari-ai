// app/api/javari/operations/status/route.ts
// Purpose: Operations Center status API — full real-time report.
//          Top-level fields: health_score, pending_tasks, active_tasks, completed_tasks,
//          failed_tasks, repairs_completed, repair_success_rate, total_cycles, avg_repair_time.
// Date: 2026-03-08

import { NextRequest, NextResponse } from "next/server";
import { buildDashboardData }        from "@/lib/operations/dashboardDataBuilder";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const record = req.nextUrl.searchParams.get("record") === "true";
  try {
    const data = await buildDashboardData(record);

    // Flatten key metrics to top level for easy dashboard consumption
    const health = data.systemHealth ?? {};
    const tq     = data.taskQueue    ?? {};
    const rep    = data.repairs      ?? {};

    return NextResponse.json({
      ok                 : true,
      // ── Top-level summary fields (Phase 7) ──
      health_score       : (health as { overallScore?: number }).overallScore      ?? 0,
      health_grade       : (health as { grade?: string }).grade                    ?? "F",
      active_targets     : data.activeTargets?.length                              ?? 0,
      pending_tasks      : tq.pending     ?? 0,
      running_tasks      : tq.running     ?? 0,
      completed_tasks    : tq.complete    ?? 0,
      failed_tasks       : tq.failed      ?? 0,
      total_tasks        : tq.total       ?? 0,
      repairs_completed  : (rep as { totalRepairs?: number }).totalRepairs         ?? 0,
      repair_success_rate: (rep as { successRate?: number }).successRate           ?? 0,
      avg_repair_time_ms : (rep as { avgRepairTimeMs?: number }).avgRepairTimeMs   ?? 0,
      total_cycles       : data.recentCycles?.length                               ?? 0,
      // ── Full nested data ──
      ...data,
    });
  } catch (err) {
    console.error(`[operations/status] Error: ${err}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const data = await buildDashboardData(true);
    const health = data.systemHealth ?? {};
    const tq     = data.taskQueue    ?? {};
    const rep    = data.repairs      ?? {};
    return NextResponse.json({
      ok                 : true,
      health_score       : (health as { overallScore?: number }).overallScore  ?? 0,
      health_grade       : (health as { grade?: string }).grade                ?? "F",
      pending_tasks      : tq.pending     ?? 0,
      completed_tasks    : tq.complete    ?? 0,
      failed_tasks       : tq.failed      ?? 0,
      repairs_completed  : (rep as { totalRepairs?: number }).totalRepairs     ?? 0,
      repair_success_rate: (rep as { successRate?: number }).successRate       ?? 0,
      ...data,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
