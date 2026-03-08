// lib/operations/dashboardDataBuilder.ts
// Purpose: Aggregates all operations data into a single structured payload
//          for the Operations Center dashboard. Single call returns everything
//          the UI needs.
// Date: 2026-03-07

import { collectOperationsData, ensureOperationsTables } from "./operationsCollector";
import { analyzeSystemHealth }                           from "./systemHealthAnalyzer";
import { aggregateScanMetrics }                          from "./scanMetricsTracker";
import { aggregateRepairMetrics }                        from "./repairMetricsTracker";
import { aggregateCustomerAudits }                       from "./customerAuditTracker";
import { recordArtifact }                                from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OperationsDashboardData {
  collectedAt     : string;
  durationMs      : number;
  systemHealth    : ReturnType<typeof analyzeSystemHealth>;
  scans           : ReturnType<typeof aggregateScanMetrics>;
  repairs         : ReturnType<typeof aggregateRepairMetrics>;
  customers       : ReturnType<typeof aggregateCustomerAudits>;
  recentCycles    : Array<{
    cycle_id          : string;
    started_at        : string;
    duration_ms       : number;
    targets_processed : number;
    total_issues      : number;
    total_repair_tasks: number;
  }>;
  activeTargets   : Array<{
    id          : string;
    name        : string;
    type        : string;
    status      : string;
    last_scan?  : string;
    location    : string;
  }>;
  taskQueue       : {
    pending  : number;
    running  : number;
    complete : number;
    failed   : number;
    blocked  : number;
    retry    : number;
    total    : number;
    recentComplete: Array<{ id: string; title: string; updated_at: number }>;
    recentFailed  : Array<{ id: string; title: string; error?: string }>;
  };
}

// ── Main builder ───────────────────────────────────────────────────────────

export async function buildDashboardData(
  recordArtifactFlag: boolean = false
): Promise<OperationsDashboardData> {
  const t0 = Date.now();

  await ensureOperationsTables();
  const raw = await collectOperationsData();

  const systemHealth = analyzeSystemHealth(raw);
  const scans        = aggregateScanMetrics(raw);
  const repairs      = aggregateRepairMetrics(raw);
  const customers    = aggregateCustomerAudits(raw);

  // Task queue breakdown
  const tasks     = raw.roadmapTasks;
  const byStatus  = (s: string) => tasks.filter(t => t.status === s).length;
  const taskQueue = {
    pending  : byStatus("pending"),
    running  : byStatus("running"),
    complete : byStatus("complete"),
    failed   : byStatus("failed"),
    blocked  : byStatus("blocked"),
    retry    : byStatus("retry"),
    total    : tasks.length,
    recentComplete: tasks
      .filter(t => t.status === "complete")
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, 5)
      .map(t => ({ id: t.id, title: t.title, updated_at: t.updated_at })),
    recentFailed: tasks
      .filter(t => t.status === "failed")
      .slice(0, 5)
      .map(t => ({ id: t.id, title: t.title, error: t.error })),
  };

  const recentCycles = raw.engineeringCycles.slice(0, 10).map(c => ({
    cycle_id          : c.cycle_id,
    started_at        : c.started_at,
    duration_ms       : c.duration_ms,
    targets_processed : c.targets_processed,
    total_issues      : c.total_issues,
    total_repair_tasks: c.total_repair_tasks,
  }));

  const activeTargets = raw.targets.map(t => ({
    id: t.id, name: t.name, type: t.type,
    status: t.status, last_scan: t.last_scan, location: t.location,
  }));

  const durationMs = Date.now() - t0;

  const result: OperationsDashboardData = {
    collectedAt: new Date().toISOString(),
    durationMs,
    systemHealth, scans, repairs, customers,
    recentCycles, activeTargets, taskQueue,
  };

  if (recordArtifactFlag) {
    await recordArtifact({
      task_id         : `ops-report-${Date.now()}`,
      artifact_type   : "operations_report" as never,
      artifact_location: "supabase/roadmap_task_artifacts",
      artifact_data   : {
        score        : systemHealth.overallScore,
        grade        : systemHealth.grade,
        activeTargets: activeTargets.length,
        taskQueue    : { pending: taskQueue.pending, failed: taskQueue.failed },
        durationMs,
      },
    });
  }

  return result;
}
