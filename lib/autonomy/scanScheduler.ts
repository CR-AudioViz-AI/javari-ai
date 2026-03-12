// lib/autonomy/scanScheduler.ts
// Purpose: Scan scheduler — evaluates active targets against their scan interval,
//          creates discover_system / analyze_code / repair_code tasks in
//          roadmap_tasks for any target that is due for a scan cycle.
// Date: 2026-03-07
import { createClient }           from "@supabase/supabase-js";
import { getTargetsDueForScan, JavariTarget } from "./targetRegistry";
// ── Types ──────────────────────────────────────────────────────────────────
export interface ScheduleResult {
export type ScanTaskType = "discover_system" | "analyze_code" | "repair_code";
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Existing scan check ────────────────────────────────────────────────────
// ── Task row builder ───────────────────────────────────────────────────────
// ── Main scheduler ─────────────────────────────────────────────────────────
    // Skip if already has pending scans for this target
    // Only create scan tasks for repo targets (websites/APIs use discovery engine differently)
      // website / api / service — just a discover task
    // Check for existing IDs
export default {}
