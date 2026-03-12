// lib/operations/dashboardDataBuilder.ts
// Purpose: Aggregates all operations data into a single structured payload
//          for the Operations Center dashboard.
// Date: 2026-03-08 — fixed "complete" → "completed" status bug, health score realism
import { collectOperationsData, ensureOperationsTables } from "./operationsCollector";
import { analyzeSystemHealth }                           from "./systemHealthAnalyzer";
import { aggregateScanMetrics }                          from "./scanMetricsTracker";
import { aggregateRepairMetrics }                        from "./repairMetricsTracker";
import { aggregateCustomerAudits }                       from "./customerAuditTracker";
import { recordArtifact }                                from "@/lib/roadmap/artifactRecorder";
// ── Types ──────────────────────────────────────────────────────────────────
export interface OperationsDashboardData {
// ── Main builder ───────────────────────────────────────────────────────────
  // Task queue breakdown — use correct status values from roadmap_tasks
  // Count completed tasks (status = "completed") + also count "complete" for backwards compat
export default {}
