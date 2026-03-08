// app/api/javari/autonomy/metrics/route.ts
// Purpose: Autonomy observability dashboard endpoint.
//          Returns 24h cycle metrics, repair rates, model usage, learning growth.
// Date: 2026-03-09

import { NextResponse }            from "next/server";
import { buildAutonomyDashboard }  from "@/lib/observability/autonomyMetrics";
import { getSchedulerStatus }      from "@/lib/javari/autonomy/autonomousScheduler";
import { getGuardrailStats }       from "@/lib/javari/autonomy/autonomyGuardrails";
import { getVaultStatus }          from "@/lib/security/vaultClient";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const [dashboard, schedulerStatus, guardrailStats, vaultStatus] = await Promise.all([
      buildAutonomyDashboard(),
      getSchedulerStatus(),
      Promise.resolve(getGuardrailStats()),
      getVaultStatus(),
    ]);

    return NextResponse.json({
      ok       : true,
      dashboard,
      scheduler: schedulerStatus,
      guardrails: guardrailStats,
      vault    : vaultStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
