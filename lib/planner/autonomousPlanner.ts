// lib/planner/autonomousPlanner.ts
// Purpose: Javari Autonomous Planner — generates roadmap tasks without human input.
//          Phase 6 upgrade: tasks include full artifact metadata (type, module, artifacts[]).
//          Workers use metadata to route tasks to the correct pipeline.
//          Triggered automatically by runRoadmapWorker when pending tasks drop below
//          PLANNER_TRIGGER_THRESHOLD (10). Calls Anthropic API to produce 50 contextually
//          relevant tasks based on completed work, canonical docs, and knowledge graph.
// Schema contract:
//   id          : "ap-{phase}-{slug}-{index}" — planner-generated IDs
//   source      : "planner"
//   status      : "pending"
//   depends_on  : []  (planner tasks are self-contained)
//   metadata    : { type, module, artifacts, description }
// Safety:
//   - Duplicate title check before every insert
//   - Max 50 tasks per run
//   - Structured JSON output required — parse failure returns [] (no partial inserts)
//   - Never throws — all errors in PlannerResult.errors
// Date: 2026-03-11 — Phase 12: Module gap detection via runModuleFactory()
import { JavariRouter }    from "@/lib/javari/router";
import { createClient }    from "@supabase/supabase-js";
import { runModuleFactory } from "@/lib/javari/moduleFactory";
// ── Constants ─────────────────────────────────────────────────────────────────
// Artifact types the engineer can build — used in task metadata
// ── Types ─────────────────────────────────────────────────────────────────────
export interface PlannedTask {
export interface PlannerResult {
// ── Supabase ──────────────────────────────────────────────────────────────────
// ── Helpers ───────────────────────────────────────────────────────────────────
// Infer the best artifact type from the task title and description
// ── Context builder ───────────────────────────────────────────────────────────
// ── AI task generation ────────────────────────────────────────────────────────
    // Route planner through JavariRouter — reasoning_task for strategic planning
  // Validate structure
      // Attempt to fix — use closest match or default
      // Infer from title/description
// ── Main planner entry point ──────────────────────────────────────────────────
  // ── Step 1: Count pending tasks ───────────────────────────────────────────
  // ── Step 1b: Module gap detection — fills critical capability gaps first ──
  // Runs BEFORE AI planner so infrastructure modules (auth, payments) get
  // queued immediately without waiting for AI task generation.
    // Non-fatal — planner continues without factory if it errors
  // ── Step 2: Build context ─────────────────────────────────────────────────
  // ── Step 3: Generate tasks via AI ─────────────────────────────────────────
  // ── Step 4: Deduplicate ───────────────────────────────────────────────────
  // ── Step 5: Insert in batches of 25 ──────────────────────────────────────
// Additional named exports
export type PlannerResult = Record<string, unknown>
export default {}
