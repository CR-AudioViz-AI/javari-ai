// lib/operations/repairMetricsTracker.ts
// Purpose: Tracks repair engine outcomes — success rates, durations, commits,
//          and PR merges. Synthesizes from roadmap_tasks and repair artifacts
//          when javari_repair_metrics table is empty.
// Date: 2026-03-07

import type { RawOperationsData, RepairMetricRow } from "./operationsCollector";
import { recordRepairMetric } from "./operationsCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RepairMetricsSummary {
  totalRepairs       : number;
  successfulRepairs  : number;
  failedRepairs      : number;
  successRate        : number;     // 0–100
  avgRepairMs        : number;
  commitsCreated     : number;
  prsCreated         : number;
  last24hRepairs     : number;
  last24hSuccess     : number;
  bySource           : Record<string, { total: number; success: number; rate: number }>;
  trend              : "improving" | "stable" | "degrading";
}

// ── Aggregator ─────────────────────────────────────────────────────────────

export function aggregateRepairMetrics(data: RawOperationsData): RepairMetricsSummary {
  const repairRows = data.repairMetrics;
  const tasks      = data.roadmapTasks;

  // If no explicit repair metrics, synthesize from roadmap_tasks
  if (repairRows.length === 0) {
    const repairTasks = tasks.filter(t =>
      t.source === "discovery" || t.source === "intelligence" ||
      t.source === "web_audit"  || t.source === "brand_engine" ||
      t.source === "ux_analyzer"
    );
    const completed = repairTasks.filter(t => t.status === "completed").length;
    const failed    = repairTasks.filter(t => t.status === "failed").length;
    const total     = repairTasks.length;
    const rate      = total > 0 ? Math.round(completed / total * 100) : 0;

    const now     = Date.now();
    const dayAgo  = now - 24 * 60 * 60 * 1000;
    const recent  = repairTasks.filter(t => t.updated_at > dayAgo);
    const recentSuccess = recent.filter(t => t.status === "completed").length;

    return {
      totalRepairs    : total,
      successfulRepairs: completed,
      failedRepairs   : failed,
      successRate     : rate,
      avgRepairMs     : 0,
      commitsCreated  : 0,
      prsCreated      : 0,
      last24hRepairs  : recent.length,
      last24hSuccess  : recentSuccess,
      bySource        : {},
      trend           : "stable",
    };
  }

  const total       = repairRows.length;
  const successful  = repairRows.filter(r => r.success).length;
  const failed      = repairRows.filter(r => !r.success).length;
  const rate        = total > 0 ? Math.round(successful / total * 100) : 0;

  const dayAgo     = Date.now() - 24 * 60 * 60 * 1000;
  const recent24   = repairRows.filter(r => new Date(r.repair_date).getTime() > dayAgo);

  const avg = (arr: number[]) => arr.length > 0
    ? Math.round(arr.reduce((a,b) => a+b, 0) / arr.length) : 0;

  const commitsCreated = repairRows.reduce((s, r) => s + (r.commits_created ?? 0), 0);
  const prsCreated     = repairRows.filter(r => r.pr_created).length;

  // Trend
  const sorted   = [...repairRows].sort((a,b) =>
    new Date(b.repair_date).getTime() - new Date(a.repair_date).getTime()
  );
  const rLast10  = sorted.slice(0, 10).filter(r => r.success).length / Math.min(10, sorted.length);
  const rPrev10  = sorted.slice(10, 20).filter(r => r.success).length / Math.min(10, sorted.slice(10).length || 1);
  const trend: RepairMetricsSummary["trend"] =
    sorted.length < 20 ? "stable"
    : rLast10 > rPrev10 * 1.05 ? "improving"
    : rLast10 < rPrev10 * 0.95 ? "degrading"
    : "stable";

  return {
    totalRepairs    : total,
    successfulRepairs: successful,
    failedRepairs   : failed,
    successRate     : rate,
    avgRepairMs     : avg(repairRows.map(r => r.duration_ms ?? 0)),
    commitsCreated,
    prsCreated,
    last24hRepairs  : recent24.length,
    last24hSuccess  : recent24.filter(r => r.success).length,
    bySource        : {},
    trend,
  };
}

// ── Record a repair outcome ────────────────────────────────────────────────

export async function trackRepair(params: {
  taskId         : string;
  success        : boolean;
  durationMs     : number;
  commitsCreated : number;
  prCreated      : boolean;
  error?         : string;
}): Promise<void> {
  const metric: Omit<RepairMetricRow, "created_at"> = {
    id              : `repair-${Date.now()}-${params.taskId.slice(-8)}`,
    task_id         : params.taskId,
    repair_date     : new Date().toISOString(),
    success         : params.success,
    duration_ms     : params.durationMs,
    commits_created : params.commitsCreated,
    pr_created      : params.prCreated,
    error           : params.error,
  };
  await recordRepairMetric(metric);
}
