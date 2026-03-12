// lib/operations/scanMetricsTracker.ts
// Purpose: Tracks and aggregates scan metrics per cycle and per target.
//          Stores results in javari_scan_metrics. Provides trend analysis.
// Date: 2026-03-07
import type { RawOperationsData, ScanMetricRow } from "./operationsCollector";
import { recordScanMetric } from "./operationsCollector";
// ── Types ──────────────────────────────────────────────────────────────────
export interface ScanMetricsSummary {
export interface TargetScanSummary {
// ── Aggregator ─────────────────────────────────────────────────────────────
    // Synthesize from cycle data if scan_metrics table is empty
  // Use actual scan metrics if available
  // Trend: compare last 10 scans avg issues vs 10 before
  // Peak issue day
// ── Record a new scan (called from engineeringLoop.ts) ─────────────────────
export default {}
