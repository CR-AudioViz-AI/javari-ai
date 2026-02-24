// lib/autonomy-core/planner/roadmap-planner.ts
// CR AudioViz AI — Autonomous Roadmap Planning Engine
// 2026-02-22 — Step 13: Autonomous Roadmap Engine
//
// Reads the active roadmap from Supabase, resolves task dependencies,
// enriches each task with canonical platform context, and executes
// ready tasks in dependency order.
//
// Integration point: called from cycle.ts STAGE 0 (before crawl).
// Runs autonomously — no human input required per cycle.
//
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

const log = createLogger("autonomy");

export interface PlanningResult {
  roadmapId:        string;
  roadmapTitle:     string;
  tasksFound:       number;
  tasksReady:       number;
  tasksExecuted:    number;
  tasksComplete:    number;
  tasksFailed:      number;
  executionResults: TaskExecutionResult[];
  cycleDetected:    boolean;
  blockedTasks:     string[];
  durationMs:       number;
  skipped:          boolean;   // true if no active roadmap or no pending tasks
  skipReason?:      string;
  validation?:      Record<string, any>;  // Validation results from roadmap-validator
  validationStatus?: 'passed' | 'blocked' | 'warned';
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function sbGet<T>(path: string): Promise<T[]> {
  const url = SB_URL(); const key = SB_KEY();
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    return await res.json() as T[];
  } catch { return []; }
}

async function sbPatch(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  const url = SB_URL(); const key = SB_KEY();
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method:  "PATCH",
    headers: {
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(data),
  });
}

// ── Types for DB rows ─────────────────────────────────────────────────────────

interface RoadmapRow {
  id:          string;
  title:       string;
  status:      string;
  task_count:  number;
  completed_count: number;
  progress:    number;
}

interface TaskRow {
  id:           string;
  roadmap_id:   string;
  title:        string;
  description:  string;
  phase_id:     string;
  phase_order:  number;
  task_order:   number;
  status:       string;
  priority:     string;
  dependencies: string[] | null;
  subtasks:     unknown[] | null;
  estimated_hours: number;
  verification_criteria: unknown;
  tags:         string[] | null;
  provider:     string | null;
  model:        string | null;
  result:       string | null;
  error:        string | null;
  retry_count:  number;
  max_retries:  number;
}

function toJavariTask(row: TaskRow): JavariTask {
  return {
    id:           row.id,
    roadmap_id:   row.roadmap_id,
    title:        row.title,
    description:  row.description ?? "",
    phase_id:     row.phase_id,
    phase_order:  row.phase_order ?? 0,
    task_order:   row.task_order ?? 0,
    status:       row.status as JavariTask["status"],
    priority:     row.priority ?? "medium",
    dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
    subtasks:     Array.isArray(row.subtasks) ? row.subtasks : [],
    estimated_hours: row.estimated_hours ?? 1,
    verification_criteria: row.verification_criteria ?? null,
    tags:         Array.isArray(row.tags) ? row.tags : [],
    provider:     row.provider ?? undefined,
    model:        row.model ?? undefined,
    result:       row.result ?? undefined,
    error:        row.error ?? undefined,
    retry_count:  row.retry_count ?? 0,
    max_retries:  row.max_retries ?? 3,
  };
}

// ── Main planner ──────────────────────────────────────────────────────────────

export async function runRoadmapPlanner(opts: {
  cycleId:         string;
  maxTasksPerCycle?: number;
  dryRun?:         boolean;
  baseUrl?:        string;
  adminSecret?:    string;
}): Promise<PlanningResult> {
  const start = Date.now();
  const maxTasks = opts.maxTasksPerCycle ?? 2; // conservative default per cycle

  // ── 1. Load active roadmap ──────────────────────────────────────────────
  const roadmaps = await sbGet<RoadmapRow>("javari_roadmaps?status=eq.executing&limit=1");

  if (!roadmaps.length) {
    log.info(`[${opts.cycleId}] No active roadmap — planner skipped`);
    return {
      roadmapId: "", roadmapTitle: "", tasksFound: 0, tasksReady: 0,
      tasksExecuted: 0, tasksComplete: 0, tasksFailed: 0,
      executionResults: [], cycleDetected: false, blockedTasks: [],
      durationMs: Date.now() - start, skipped: true,
      skipReason: "No roadmap in executing status",
    };
  }

  const roadmap = roadmaps[0];
  log.info(`[${opts.cycleId}] Active roadmap: ${roadmap.id} — ${roadmap.title}`);

  // ── 2. Load tasks ───────────────────────────────────────────────────────
  const taskRows = await sbGet<TaskRow>(
    `javari_tasks?roadmap_id=eq.${encodeURIComponent(roadmap.id)}&order=task_order.asc`
  );

  if (!taskRows.length) {
    return {
      roadmapId: roadmap.id, roadmapTitle: roadmap.title,
      tasksFound: 0, tasksReady: 0, tasksExecuted: 0,
      tasksComplete: 0, tasksFailed: 0, executionResults: [],
      cycleDetected: false, blockedTasks: [],
      durationMs: Date.now() - start, skipped: true,
      skipReason: "No tasks found for roadmap",
    };
  }

  const tasks = taskRows.map(toJavariTask);

  // ── 3. Resolve dependency order ─────────────────────────────────────────
  const resolution = resolveDependencies(tasks);

  log.info(`[${opts.cycleId}] Dependency resolution: ${resolution.readyCount} ready, ${resolution.skippedTasks.length} done, cycleDetected=${resolution.cycleDetected}`);

  if (resolution.cycleDetected) {
    await writeAuditEvent({
      action:   "module.generated",
      metadata: { system: "autonomy-core-planner", event: "cycle_detected", cycleMembers: resolution.cycleMembers, cycleId: opts.cycleId },
      severity: "warn",
    });
  }

  // ── 3.5. VALIDATION LAYER (FS-3) ────────────────────────────────────────
  // Run full roadmap validation BEFORE selecting tasks
  let validationResult: ValidationResult | null = null;
  let validationStatus: 'passed' | 'blocked' | 'warned' = 'passed';

  try {
    const supabaseUrl = SB_URL();
    const supabaseKey = SB_KEY();

    if (supabaseUrl && supabaseKey) {
      // Convert tasks to validator format
      const roadmapForValidation = {
        id: roadmap.id,
        name: roadmap.title,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority === 'high' ? 3 : t.priority === 'medium' ? 2 : 1,
          requiredSecrets: (t.metadata as any)?.requiredSecrets,
          prerequisites: t.dependencies,
          estimatedCost: (t.metadata as any)?.estimatedCost,
          safetyRisk: (t.metadata as any)?.safetyRisk,
        })),
      };

      validationResult = await validateRoadmap(roadmapForValidation, supabaseUrl, supabaseKey);

      const formattedValidation = formatValidationResult(validationResult);

      // Determine validation status
      if (!validationResult.valid) {
        const hasCritical = validationResult.blockers.some(i => i.severity === 'CRITICAL');
        if (hasCritical) {
          validationStatus = 'blocked';
          log.warn(`[${opts.cycleId}] VALIDATION BLOCKED: ${validationResult.blockers.length} critical/high issues found`);
        } else {
          validationStatus = 'warned';
          log.warn(`[${opts.cycleId}] VALIDATION WARNINGS: ${validationResult.blockers.length} high-priority issues found`);
        }
      } else {
        log.info(`[${opts.cycleId}] Validation passed: ${validationResult.warnings.length} warnings, ${validationResult.info.length} info`);
      }

      // Log validation event
      await writeAuditEvent({
        action: "module.generated",
        metadata: {
          system: "autonomy-core-planner",
          event: "validation_completed",
          cycleId: opts.cycleId,
          validationStatus,
          validation: formattedValidation,
        },
        severity: validationStatus === 'blocked' ? 'error' : validationStatus === 'warned' ? 'warn' : 'info',
      });

      // If CRITICAL issues exist, abort task execution
      if (validationStatus === 'blocked') {
        return {
          roadmapId: roadmap.id,
          roadmapTitle: roadmap.title,
          tasksFound: tasks.length,
          tasksReady: resolution.readyCount,
          tasksExecuted: 0,
          tasksComplete: tasks.filter(t => t.status === 'complete').length,
          tasksFailed: 0,
          executionResults: [],
          cycleDetected: resolution.cycleDetected,
          blockedTasks: resolution.blockedTasks,
          durationMs: Date.now() - start,
          skipped: true,
          skipReason: 'blocked_by_validation',
          validation: formattedValidation,
          validationStatus,
        };
      }
    }
  } catch (err) {
    log.error(`[${opts.cycleId}] Validation error: ${err instanceof Error ? err.message : 'Unknown'}`);
    // Continue execution on validation failure (fail-open)
  }

  // ── 4. Pick first batch (up to maxTasksPerCycle) ────────────────────────
  const firstBatch  = resolution.batches[0] ?? [];
  const toExecute   = firstBatch.slice(0, maxTasks);

  if (!toExecute.length) {
    const allDone = tasks.every((t) => t.status === "complete" || t.status === "skipped");
    if (allDone) {
      // Mark roadmap complete
      await sbPatch("javari_roadmaps", roadmap.id, {
        status:       "complete",
        completed_at: new Date().toISOString(),
        progress:     100,
        updated_at:   new Date().toISOString(),
      });
      log.info(`[${opts.cycleId}] Roadmap ${roadmap.id} marked COMPLETE`);
    }
    return {
      roadmapId: roadmap.id, roadmapTitle: roadmap.title,
      tasksFound: tasks.length, tasksReady: 0, tasksExecuted: 0,
      tasksComplete: tasks.filter((t) => t.status === "complete").length,
      tasksFailed: tasks.filter((t) => t.status === "failed").length,
      executionResults: [], cycleDetected: resolution.cycleDetected,
      blockedTasks: resolution.blockedTasks,
      durationMs: Date.now() - start, skipped: true,
      skipReason: allDone ? "All tasks complete" : "No tasks ready in first batch",
    };
  }

  log.info(`[${opts.cycleId}] Executing ${toExecute.length} tasks: ${toExecute.map((t) => t.id).join(", ")}`);

  // ── 5. Execute tasks concurrently ───────────────────────────────────────
  const executionResults = await Promise.all(
    toExecute.map((task) =>
      executeTask(task, {
        dryRun:      opts.dryRun,
        cycleId:     opts.cycleId,
        baseUrl:     opts.baseUrl,
        adminSecret: opts.adminSecret,
      })
    )
  );

  // ── 6. Update roadmap progress ──────────────────────────────────────────
  const completedCount = tasks.filter((t) => t.status === "complete").length
    + executionResults.filter((r) => r.status === "complete").length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  await sbPatch("javari_roadmaps", roadmap.id, {
    completed_count: completedCount,
    progress,
    updated_at: new Date().toISOString(),
  });

  const tasksComplete = executionResults.filter((r) => r.status === "complete").length;
  const tasksFailed   = executionResults.filter((r) => r.status === "failed").length;

  log.info(`[${opts.cycleId}] Planning pass complete: executed=${toExecute.length} complete=${tasksComplete} failed=${tasksFailed} progress=${progress}%`);

  await writeAuditEvent({
    action:   "module.generated",
    metadata: {
      system:       "autonomy-core-planner",
      event:        "planning_pass_complete",
      cycleId:      opts.cycleId,
      roadmapId:    roadmap.id,
      tasksExecuted: toExecute.length,
      tasksComplete,
      tasksFailed,
      progress,
    },
    severity: "info",
  });

  return {
    roadmapId:     roadmap.id,
    roadmapTitle:  roadmap.title,
    tasksFound:    tasks.length,
    tasksReady:    firstBatch.length,
    tasksExecuted: toExecute.length,
    tasksComplete,
    tasksFailed,
    executionResults,
    cycleDetected: resolution.cycleDetected,
    blockedTasks:  resolution.blockedTasks,
    durationMs:    Date.now() - start,
    skipped:       false,
    validation:    validationResult ? formatValidationResult(validationResult) : undefined,
    validationStatus,
  };
}
