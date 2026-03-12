// lib/repair/repairPlanner.ts
// Purpose: Repair planner — converts CodeIssue findings from the intelligence
//          engine into structured RepairPlan objects with strategies, risk levels,
//          and sequenced steps. Each plan drives one patch generation cycle.
// Date: 2026-03-07
import type { CodeIssue, Severity } from "@/lib/intelligence/codeAnalyzer";
// ── Types ──────────────────────────────────────────────────────────────────
export type RepairStrategy =
export interface RepairStep {
export interface RepairPlan {
// ── Strategy selector ──────────────────────────────────────────────────────
      // Fall back by issue type
// ── Main planner ───────────────────────────────────────────────────────────
    // Only high-risk or critical issues require PRs; safe/low go direct
// Priority sort: critical first, then by strategy risk
export default {}
