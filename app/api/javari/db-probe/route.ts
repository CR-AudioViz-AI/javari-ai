// app/api/javari/db-probe/route.ts
// Purpose: One-shot DB table existence and row count probe for guardrail verification
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probeTable(table: string): Promise<{
  exists: boolean;
  count: number;
  error?: string;
  sample?: unknown[];
}> {
  try {
    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact" })
      .order("created_at" as string, { ascending: false })
      .limit(3);

    if (error) {
      return { exists: false, count: 0, error: error.message };
    }
    return { exists: true, count: count ?? 0, sample: data ?? [] };
  } catch (e: unknown) {
    return { exists: false, count: 0, error: (e as Error).message };
  }
}

async function probeExecutionLogs(): Promise<{
  exists: boolean;
  count: number;
  error?: string;
  sample?: unknown[];
}> {
  try {
    const { data, error, count } = await supabase
      .from("javari_execution_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false })
      .limit(3);

    if (error) {
      return { exists: false, count: 0, error: error.message };
    }
    return { exists: true, count: count ?? 0, sample: data ?? [] };
  } catch (e: unknown) {
    return { exists: false, count: 0, error: (e as Error).message };
  }
}

export async function GET() {
  const [auditLog, execLogs] = await Promise.all([
    probeTable("guardrail_audit_log"),
    probeExecutionLogs(),
  ]);

  // Also get roadmap_tasks breakdown by source
  const { data: sourceCounts } = await supabase
    .from("roadmap_tasks")
    .select("source, status");

  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const row of (sourceCounts ?? []) as { source: string | null; status: string }[]) {
    const src = row.source ?? "null";
    bySource[src] = (bySource[src] ?? 0) + 1;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    tables: {
      guardrail_audit_log: auditLog,
      execution_logs: execLogs,
    },
    roadmap_tasks: {
      by_source: bySource,
      by_status: byStatus,
      total: sourceCounts?.length ?? 0,
    },
  });
}
