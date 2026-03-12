// lib/autonomy-core/planner/roadmap-planner.ts
// CR AudioViz AI — Autonomous Roadmap Planning Engine
// 2026-02-22 — Step 13: Autonomous Roadmap Engine
// Reads the active roadmap from Supabase, resolves task dependencies,
// enriches each task with canonical platform context, and executes
// ready tasks in dependency order.
// Integration point: called from cycle.ts STAGE 0 (before crawl).
// Runs autonomously — no human input required per cycle.
// Architecture:
//   1. Load active roadmap(s) from javari_roadmaps
//   2. Load all pending/in-progress tasks
//   3. Resolve dependency order (topological sort)
//   4. Execute first ready batch (respects maxTasksPerCycle ceiling)
//   5. Return PlanningResult for inclusion in cycle report
import { resolveDependencies }  from "./dependency-resolver";
import type { JavariTask }      from "./dependency-resolver";
import { executeTask }          from "./task-executor";
import type { TaskExecutionResult } from "./task-executor";
import { createLogger }         from "@/lib/observability/logger";
import { writeAuditEvent }      from "@/lib/enterprise/audit";
import { validateRoadmap, formatValidationResult } from "./roadmap-validator";
import type { ValidationResult } from "./roadmap-validator";
export interface PlanningResult {
// ── Supabase helpers ──────────────────────────────────────────────────────────
// ── Types for DB rows ─────────────────────────────────────────────────────────
// ── Main planner ──────────────────────────────────────────────────────────────
  // ── 1. Load active roadmap ──────────────────────────────────────────────
  // ── 2. Load tasks ───────────────────────────────────────────────────────
  // ── 3. Resolve dependency order ─────────────────────────────────────────
  // ── 3.5. VALIDATION LAYER (FS-3) ────────────────────────────────────────
  // Run full roadmap validation BEFORE selecting tasks
      // Convert tasks to validator format
      // Determine validation status
      // Log validation event
      // If CRITICAL issues exist, abort task execution
    // Continue execution on validation failure (fail-open)
  // ── 4. Pick first batch (up to maxTasksPerCycle) ────────────────────────
      // Mark roadmap complete
  // ── 5. Execute tasks concurrently ───────────────────────────────────────
  // ── 6. Update roadmap progress ──────────────────────────────────────────
export default {}
