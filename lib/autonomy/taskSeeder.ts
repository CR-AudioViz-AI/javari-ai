// lib/autonomy/taskSeeder.ts
// Purpose: Task seeder — converts CodeIssue[] from the intelligence engine into
//          properly formatted roadmap_tasks with embedded JSON issue payloads
//          for the repair_code executor. Deduplicates against existing tasks.
// Date: 2026-03-07
import { createClient }      from "@supabase/supabase-js";
import type { CodeIssue }    from "@/lib/intelligence/codeAnalyzer";
import type { JavariTarget } from "./targetRegistry";
// ── Types ──────────────────────────────────────────────════════════════════
export interface SeededTask {
export interface SeedResult {
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Issue grouping — one task per file for manageability ───────────────────
// ── Task row builder ───────────────────────────────────────────────────────
  // Minimal CodeIssue[] serialised as JSON block inside description
  // The repair_code executor parses this to drive actual repairs
// ── Main seeder ────────────────────────────────────────────────────────────
  // Filter by minimum severity
  // Group by file — one task per file
  // Deduplicate
export default {}
