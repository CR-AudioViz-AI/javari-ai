// app/api/javari/guardrails/route.ts
// Purpose: Guardrail status endpoint — audit log query and live system check
// Date: 2026-03-06

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkKillSwitch, checkRollbackTrigger } from "@/lib/execution/guardrails";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Live checks (no task context needed)
    const killResult  = checkKillSwitch();
    const rollback    = await checkRollbackTrigger();

    // Recent audit entries
    let recentAudit: unknown[] = [];
    try {
      const { data } = await supabase
        .from("guardrail_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      recentAudit = data ?? [];
    } catch {
      recentAudit = [];
    }

    // Summary counts from execution_logs
    const { data: logs } = await supabase
      .from("execution_logs")
      .select("status")
      .order("timestamp", { ascending: false })
      .limit(50);

    const blocked  = (logs ?? []).filter((l: { status: string }) => l.status === "blocked").length;
    const failed   = (logs ?? []).filter((l: { status: string }) => l.status === "failed").length;
    const success  = (logs ?? []).filter((l: { status: string }) => l.status === "success").length;

    return NextResponse.json({
      ok: true,
      guardrails_active: true,
      planner_mode: "ecosystem",
      live_checks: {
        kill_switch:     { outcome: killResult.outcome,  reason: killResult.reason },
        rollback_trigger: { outcome: rollback.outcome,  reason: rollback.reason,  meta: rollback.meta },
      },
      execution_summary: {
        last_50_executions: { success, failed, blocked },
      },
      recent_audit: recentAudit,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
