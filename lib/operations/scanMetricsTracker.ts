// lib/operations/scanMetricsTracker.ts
// Purpose: Tracks and aggregates scan metrics per cycle and per target.
//          Stores results in javari_scan_metrics. Provides trend analysis.
// Date: 2026-03-07

import type { RawOperationsData, ScanMetricRow } from "./operationsCollector";
import { recordScanMetric } from "./operationsCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScanMetricsSummary {
  totalScans         : number;
  avgDurationMs      : number;
  avgPagesPerScan    : number;
  avgFilesPerScan    : number;
  avgIssuesPerScan   : number;
  totalIssuesFound   : number;
  last7DaysScans     : number;
  last7DaysIssues    : number;
  byTarget           : Record<string, TargetScanSummary>;
  trend              : "improving" | "stable" | "degrading";
  peakIssueDay       : string;
}

export interface TargetScanSummary {
  targetId     : string;
  scans        : number;
  lastScan?    : string;
  avgIssues    : number;
  totalIssues  : number;
}

// ── Aggregator ─────────────────────────────────────────────────────────────

export function aggregateScanMetrics(data: RawOperationsData): ScanMetricsSummary {
  const metrics  = data.scanMetrics;
  const cycles   = data.engineeringCycles;

  if (metrics.length === 0 && cycles.length === 0) {
    // Synthesize from cycle data if scan_metrics table is empty
    const totalIssues = cycles.reduce((s, c) => s + (c.total_issues ?? 0), 0);
    const avgIssues   = cycles.length > 0 ? Math.round(totalIssues / cycles.length) : 0;
    return {
      totalScans: cycles.length, avgDurationMs: 0, avgPagesPerScan: 0,
      avgFilesPerScan: 0, avgIssuesPerScan: avgIssues, totalIssuesFound: totalIssues,
      last7DaysScans: cycles.length, last7DaysIssues: totalIssues,
      byTarget: {}, trend: "stable", peakIssueDay: "",
    };
  }

  // Use actual scan metrics if available
  const now     = Date.now();
  const week    = 7 * 24 * 60 * 60 * 1000;
  const recent  = metrics.filter(m => now - new Date(m.scan_date).getTime() < week);

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a,b) => a+b, 0) / arr.length) : 0;
  const sum = (arr: number[]) => arr.reduce((a,b) => a+b, 0);

  const byTarget: Record<string, TargetScanSummary> = {};
  for (const m of metrics) {
    if (!byTarget[m.target_id]) {
      byTarget[m.target_id] = { targetId: m.target_id, scans: 0, avgIssues: 0, totalIssues: 0 };
    }
    byTarget[m.target_id].scans++;
    byTarget[m.target_id].totalIssues += m.issues_found ?? 0;
    byTarget[m.target_id].lastScan = m.scan_date;
  }
  for (const t of Object.values(byTarget)) {
    t.avgIssues = t.scans > 0 ? Math.round(t.totalIssues / t.scans) : 0;
  }

  // Trend: compare last 10 scans avg issues vs 10 before
  const sortedRecent = [...metrics].sort((a, b) =>
    new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
  );
  const last10  = sortedRecent.slice(0, 10).map(m => m.issues_found ?? 0);
  const prev10  = sortedRecent.slice(10, 20).map(m => m.issues_found ?? 0);
  const avgLast = avg(last10);
  const avgPrev = avg(prev10);
  const trend: ScanMetricsSummary["trend"] =
    prev10.length === 0 ? "stable"
    : avgLast < avgPrev * 0.9 ? "improving"
    : avgLast > avgPrev * 1.1 ? "degrading"
    : "stable";

  // Peak issue day
  const dayGroups: Record<string, number> = {};
  for (const m of metrics) {
    const day = m.scan_date.slice(0, 10);
    dayGroups[day] = (dayGroups[day] ?? 0) + (m.issues_found ?? 0);
  }
  const peakIssueDay = Object.entries(dayGroups)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  return {
    totalScans      : metrics.length,
    avgDurationMs   : avg(metrics.map(m => m.duration_ms ?? 0)),
    avgPagesPerScan : avg(metrics.map(m => m.pages_crawled ?? 0)),
    avgFilesPerScan : avg(metrics.map(m => m.files_analyzed ?? 0)),
    avgIssuesPerScan: avg(metrics.map(m => m.issues_found ?? 0)),
    totalIssuesFound: sum(metrics.map(m => m.issues_found ?? 0)),
    last7DaysScans  : recent.length,
    last7DaysIssues : sum(recent.map(m => m.issues_found ?? 0)),
    byTarget, trend, peakIssueDay,
  };
}

// ── Record a new scan (called from engineeringLoop.ts) ─────────────────────

export async function trackScan(params: {
  targetId      : string;
  durationMs    : number;
  pagesCrawled  : number;
  filesAnalyzed : number;
  issuesFound   : number;
  cycleId?      : string;
}): Promise<void> {
  const metric: Omit<ScanMetricRow, "created_at"> = {
    id            : `scan-${Date.now()}-${params.targetId.slice(-8)}`,
    target_id     : params.targetId,
    scan_date     : new Date().toISOString(),
    duration_ms   : params.durationMs,
    pages_crawled : params.pagesCrawled,
    files_analyzed: params.filesAnalyzed,
    issues_found  : params.issuesFound,
    cycle_id      : params.cycleId,
  };
  await recordScanMetric(metric);
}
