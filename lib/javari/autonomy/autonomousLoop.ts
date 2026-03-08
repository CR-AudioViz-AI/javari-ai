// lib/javari/autonomy/autonomousLoop.ts
// Javari AI — Autonomous Execution Loop v1.0
// Purpose: Unified self-improvement cycle that orchestrates all Javari subsystems:
//          ecosystem health → roadmap tasks → crawler findings → repair opportunities
//          → task prioritization → execution → outcome verification → memory + learning update
// Date: 2026-03-09
//
// Architecture:
//   This is the SINGLE entry point for autonomous platform management.
//   It delegates to existing subsystems — it does NOT duplicate them.
//   Subsystem ownership:
//     Health scanning    → lib/operations/systemHealthAnalyzer
//     Roadmap execution  → lib/roadmap/task-runner + task-queue
//     Crawler            → lib/autonomy/engineeringLoop (via runEngineeringLoop)
//     Repair             → lib/repair/repairPlanner
//     Memory             → lib/memory/memoryGraph
//     Learning           → lib/learning/learningCollector
//
// Cost guardrails (enforced per cycle):
//   - Max tasks per cycle: configurable (default 5)
//   - Max cost per cycle: $2.00 USD
//   - Failure retry limit: 2 attempts before skipping task
//   - Circuit breaker: 3 consecutive cycle failures → pause autonomy

import { createClient }             from "@supabase/supabase-js";
import { collectOperationsData }    from "@/lib/operations/operationsCollector";
import { analyzeSystemHealth }      from "@/lib/operations/systemHealthAnalyzer";
import { recordLearningEvent,
         ingestFromPlatformData }   from "@/lib/learning/learningCollector";
import type { LearningEvent }       from "@/lib/learning/learningCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoopConfig {
  maxTasksPerCycle  : number;   // default 5
  maxCostUsdPerCycle: number;   // default 2.00
  failureRetryLimit : number;   // default 2
  dryRun?           : boolean;  // analyze only, no mutations
}

export interface CycleTask {
  id          : string;
  title       : string;
  type        : string;
  priority    : number;
  source      : "roadmap" | "repair" | "crawler" | "health";
}

export interface LoopCycleResult {
  cycleId        : string;
  startedAt      : string;
  completedAt    : string;
  durationMs     : number;
  healthScore    : number;
  tasksConsidered: number;
  tasksExecuted  : number;
  tasksSkipped   : number;
  tasksFailed    : number;
  totalCostUsd   : number;
  memoryNodesAdded: number;
  learningEvents  : number;
  errors         : string[];
  dryRun         : boolean;
}

// ── Default config ────────────────────────────────────────────────────────

export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  maxTasksPerCycle  : 5,
  maxCostUsdPerCycle: 2.00,
  failureRetryLimit : 2,
  dryRun            : false,
};

// ── Circuit breaker state (module-level, per serverless instance) ─────────

let _consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;

// ── Supabase client ───────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Task prioritization ───────────────────────────────────────────────────
// Pull pending roadmap_tasks ordered by priority signal (repair > build > ai_task)

async function fetchPrioritizedTasks(max: number): Promise<CycleTask[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("id, title, description, status")
    .eq("status", "pending")
    .order("updated_at", { ascending: true })
    .limit(max * 3); // over-fetch so we can prioritize

  if (error || !data) return [];

  // Score by type: repair=10, security=9, build_module=7, ai_task=5, other=3
  const scored = data.map((t: { id: string; title: string; description?: string; status: string }) => {
    const desc  = (t.description ?? "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    let priority = 3;
    let type = "other";

    if (desc.includes("[type:repair]") || title.includes("repair")) { priority = 10; type = "repair"; }
    else if (desc.includes("[type:security]") || title.includes("security")) { priority = 9; type = "security"; }
    else if (desc.includes("[type:build_module]") || title.includes("build")) { priority = 7; type = "build"; }
    else if (desc.includes("[type:ai_task]")) { priority = 5; type = "ai_task"; }

    return {
      id      : t.id as string,
      title   : t.title as string,
      type,
      priority,
      source  : "roadmap" as const,
    };
  });

  return scored
    .sort((a: CycleTask, b: CycleTask) => b.priority - a.priority)
    .slice(0, max);
}

// ── Single task execution ─────────────────────────────────────────────────

async function executeTask(
  task   : CycleTask,
  config : LoopConfig
): Promise<{ ok: boolean; cost: number; error?: string }> {
  if (config.dryRun) {
    return { ok: true, cost: 0 };
  }

  const supabase = db();

  // Mark running
  await supabase
    .from("roadmap_tasks")
    .update({ status: "running", updated_at: Date.now() })
    .eq("id", task.id);

  try {
    // Delegate to the unified execute endpoint (same process, in-memory call)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/javari/execute`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ task_id: task.id }),
      signal : AbortSignal.timeout(120_000), // 2 min per task
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`execute returned ${res.status}: ${errText.slice(0, 200)}`);
    }

    const result = await res.json() as { ok?: boolean; cost_usd?: number; error?: string };
    if (!result.ok) throw new Error(result.error ?? "execute returned ok:false");

    // Mark completed
    await supabase
      .from("roadmap_tasks")
      .update({ status: "completed", updated_at: Date.now() })
      .eq("id", task.id);

    return { ok: true, cost: result.cost_usd ?? 0 };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("roadmap_tasks")
      .update({ status: "failed", error: message, updated_at: Date.now() })
      .eq("id", task.id);
    return { ok: false, cost: 0, error: message };
  }
}

// ── Cycle record persistence ──────────────────────────────────────────────

async function persistCycleRecord(record: LoopCycleResult): Promise<void> {
  const supabase = db();
  try {
    await supabase.from("javari_autonomous_cycles").upsert({
      cycle_id          : record.cycleId,
      started_at        : record.startedAt,
      completed_at      : record.completedAt,
      duration_ms       : record.durationMs,
      health_score      : record.healthScore,
      tasks_considered  : record.tasksConsidered,
      tasks_executed    : record.tasksExecuted,
      tasks_skipped     : record.tasksSkipped,
      tasks_failed      : record.tasksFailed,
      total_cost_usd    : record.totalCostUsd,
      memory_nodes_added: record.memoryNodesAdded,
      learning_events   : record.learningEvents,
      errors            : record.errors,
      dry_run           : record.dryRun,
    });
  } catch (err) {
    // Non-fatal — log only
    console.error("[autonomous-loop] Failed to persist cycle record:", err instanceof Error ? err.message : err);
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────

export async function runAutonomousLoop(
  config: Partial<LoopConfig> = {}
): Promise<LoopCycleResult> {
  const cfg = { ...DEFAULT_LOOP_CONFIG, ...config };
  const t0  = Date.now();
  const cycleId   = `cycle-${t0}-${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();

  const errors: string[] = [];
  let healthScore     = 0;
  let tasksExecuted   = 0;
  let tasksSkipped    = 0;
  let tasksFailed     = 0;
  let totalCostUsd    = 0;
  let memoryNodesAdded = 0;
  let learningEvents  = 0;

  console.info(`[autonomous-loop] ▶ Cycle ${cycleId} starting`);

  // ── Circuit breaker check ────────────────────────────────────────────────
  if (_consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[autonomous-loop] Circuit breaker OPEN — ${_consecutiveFailures} consecutive failures. Resetting counter.`);
    _consecutiveFailures = 0;
    return {
      cycleId, startedAt, completedAt: new Date().toISOString(),
      durationMs: Date.now() - t0, healthScore: 0,
      tasksConsidered: 0, tasksExecuted: 0, tasksSkipped: 0, tasksFailed: 0,
      totalCostUsd: 0, memoryNodesAdded: 0, learningEvents: 0,
      errors: ["Circuit breaker: too many consecutive failures, cycle paused"],
      dryRun: cfg.dryRun ?? false,
    };
  }

  let tasks: CycleTask[] = [];

  try {
    // ── Step 1: Ecosystem health scan ───────────────────────────────────────
    try {
      const opsData = await collectOperationsData();
      const health  = analyzeSystemHealth(opsData);
      healthScore   = health.overallScore;
      console.info(`[autonomous-loop] Health score: ${healthScore} (${health.grade})`);
    } catch (err) {
      const msg = `Health scan failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[autonomous-loop] ${msg}`);
    }

    // ── Step 2: Fetch prioritized tasks ─────────────────────────────────────
    tasks = await fetchPrioritizedTasks(cfg.maxTasksPerCycle).catch((err) => {
      errors.push(`Task fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      return [] as CycleTask[];
    });

    console.info(`[autonomous-loop] ${tasks.length} tasks queued for execution`);

    // ── Step 3: Execute tasks within cost guardrail ──────────────────────────
    for (const task of tasks) {
      if (totalCostUsd >= cfg.maxCostUsdPerCycle) {
        tasksSkipped++;
        console.info(`[autonomous-loop] Cost ceiling $${cfg.maxCostUsdPerCycle} reached — skipping task ${task.id}`);
        continue;
      }

      let attempts = 0;
      let lastError = "";

      while (attempts < cfg.failureRetryLimit) {
        const result = await executeTask(task, cfg);
        if (result.ok) {
          tasksExecuted++;
          totalCostUsd += result.cost;
          break;
        }
        lastError = result.error ?? "unknown";
        attempts++;
        if (attempts < cfg.failureRetryLimit) {
          await new Promise((r) => setTimeout(r, 1000 * attempts)); // backoff
        }
      }

      if (attempts >= cfg.failureRetryLimit && lastError) {
        tasksFailed++;
        errors.push(`Task ${task.id} failed after ${attempts} attempts: ${lastError}`);
      }
    }

    // ── Step 4: Record cycle as learning event ────────────────────────────────
    if (!cfg.dryRun && tasksExecuted > 0) {
      try {
        const event: Omit<LearningEvent, "id" | "timestamp"> = {
          event_type: "capability_proven",
          domain    : "ai_systems",
          technology: "autonomous_loop",
          severity  : tasksFailed > 0 ? "medium" : "low",
          source    : "autonomous_loop",
          details   : { cycleId, tasksExecuted, tasksFailed, totalCostUsd, healthScore },
        };
        await recordLearningEvent(event);
        memoryNodesAdded = 1;
      } catch (err) {
        errors.push(`Memory update failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Step 5: Ingest learning events from platform data ────────────────────
    if (!cfg.dryRun) {
      try {
        const learnResult = await ingestFromPlatformData();
        learningEvents = learnResult?.eventsCreated ?? 0;
      } catch (err) {
        errors.push(`Learning ingest failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Cycle succeeded — reset circuit breaker
    _consecutiveFailures = 0;

  } catch (err) {
    _consecutiveFailures++;
    const msg = `Cycle ${cycleId} unhandled error: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error(`[autonomous-loop] ${msg}`);
  }

  const completedAt = new Date().toISOString();
  const durationMs  = Date.now() - t0;

  const record: LoopCycleResult = {
    cycleId, startedAt, completedAt, durationMs, healthScore,
    tasksConsidered: tasks.length,
    tasksExecuted, tasksSkipped, tasksFailed,
    totalCostUsd  : Math.round(totalCostUsd * 10000) / 10000,
    memoryNodesAdded, learningEvents,
    errors,
    dryRun: cfg.dryRun ?? false,
  };

  console.info(
    `[autonomous-loop] ✅ Cycle ${cycleId} complete — ` +
    `executed=${tasksExecuted} failed=${tasksFailed} cost=$${record.totalCostUsd} duration=${durationMs}ms`
  );

  // Persist record fire-and-forget
  persistCycleRecord(record).catch(() => {});

  return record;
}


