// lib/observability/autonomyMetrics.ts
// CR AudioViz AI — Autonomy Telemetry
// Purpose: Structured observability for all autonomous operations.
//          Tracks cycle performance, model usage, repair success rates,
//          learning growth, and cost efficiency over time.
// Date: 2026-03-09

import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CycleMetric {
  cycleId        : string;
  startedAt      : string;
  completedAt    : string;
  durationMs     : number;
  healthScore    : number;
  tasksExecuted  : number;
  tasksFailed    : number;
  costUsd        : number;
  learningEvents : number;
  schedulerState : string;
}

export interface RepairMetric {
  repairId     : string;
  timestamp    : string;
  issueType    : string;
  targetRepo   : string;
  targetFile   : string;
  strategy     : string;
  success      : boolean;
  durationMs   : number;
  commitSha?   : string;
}

export interface ModelUsageMetric {
  timestamp    : string;
  provider     : string;
  model        : string;
  taskType     : string;
  tokensIn     : number;
  tokensOut    : number;
  latencyMs    : number;
  costUsd      : number;
  success      : boolean;
}

export interface LearningGrowthMetric {
  timestamp    : string;
  domain       : string;
  eventsTotal  : number;
  issuesSolved : number;
  skillScore   : number;
}

export interface AutonomyDashboard {
  generatedAt      : string;
  cyclesLast24h    : number;
  avgCycleDurationMs: number;
  avgHealthScore   : number;
  totalTasksRun    : number;
  taskSuccessRate  : number;
  totalCost24h     : number;
  repairsAttempted : number;
  repairSuccessRate: number;
  topModelsUsed    : Array<{ provider: string; model: string; calls: number; avgCostUsd: number }>;
  learningGrowth   : Array<{ domain: string; events: number; skillScore: number }>;
  recentCycles     : CycleMetric[];
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Write metrics ─────────────────────────────────────────────────────────

export async function recordCycleMetric(metric: CycleMetric): Promise<void> {
  try {
    await db().from("javari_autonomous_cycles").upsert({
      cycle_id        : metric.cycleId,
      started_at      : metric.startedAt,
      completed_at    : metric.completedAt,
      duration_ms     : metric.durationMs,
      health_score    : metric.healthScore,
      tasks_executed  : metric.tasksExecuted,
      tasks_failed    : metric.tasksFailed,
      total_cost_usd  : metric.costUsd,
      learning_events : metric.learningEvents,
      scheduler_state : metric.schedulerState,
    });
  } catch (err) {
    console.warn("[autonomy-metrics] Failed to record cycle:", err instanceof Error ? err.message : String(err));
  }
}

export async function recordModelUsage(metric: ModelUsageMetric): Promise<void> {
  try {
    await db().from("javari_model_usage_metrics").insert({
      id          : `mu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      occurred_at : metric.timestamp,
      provider    : metric.provider,
      model       : metric.model,
      task_type   : metric.taskType,
      tokens_in   : metric.tokensIn,
      tokens_out  : metric.tokensOut,
      latency_ms  : metric.latencyMs,
      cost_usd    : metric.costUsd,
      success     : metric.success,
    });
  } catch { /* non-fatal */ }
}

// ── Read metrics ──────────────────────────────────────────────────────────

async function getCycles24h(): Promise<CycleMetric[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await db()
      .from("javari_autonomous_cycles")
      .select("*")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row: Record<string, unknown>) => ({
      cycleId        : String(row.cycle_id   ?? ""),
      startedAt      : String(row.started_at ?? ""),
      completedAt    : String(row.completed_at ?? ""),
      durationMs     : Number(row.duration_ms ?? 0),
      healthScore    : Number(row.health_score ?? 0),
      tasksExecuted  : Number(row.tasks_executed ?? 0),
      tasksFailed    : Number(row.tasks_failed ?? 0),
      costUsd        : Number(row.total_cost_usd ?? 0),
      learningEvents : Number(row.learning_events ?? 0),
      schedulerState : String(row.scheduler_state ?? "unknown"),
    }));
  } catch {
    return [];
  }
}

async function getModelUsage24h(): Promise<ModelUsageMetric[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await db()
      .from("javari_model_usage_metrics")
      .select("*")
      .gte("occurred_at", since)
      .limit(500);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      timestamp  : String(row.occurred_at ?? ""),
      provider   : String(row.provider ?? ""),
      model      : String(row.model ?? ""),
      taskType   : String(row.task_type ?? ""),
      tokensIn   : Number(row.tokens_in ?? 0),
      tokensOut  : Number(row.tokens_out ?? 0),
      latencyMs  : Number(row.latency_ms ?? 0),
      costUsd    : Number(row.cost_usd ?? 0),
      success    : Boolean(row.success),
    }));
  } catch {
    return [];
  }
}

async function getRepairMetrics24h(): Promise<{ attempted: number; succeeded: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await db()
      .from("javari_repair_metrics")
      .select("repair_success")
      .gte("scan_timestamp", since);
    const rows = (data ?? []) as Array<{ repair_success: boolean }>;
    return {
      attempted: rows.length,
      succeeded: rows.filter((r) => r.repair_success).length,
    };
  } catch {
    return { attempted: 0, succeeded: 0 };
  }
}

async function getLearningGrowth(): Promise<LearningGrowthMetric[]> {
  try {
    const { data } = await db()
      .from("javari_technology_experience")
      .select("domain, times_encountered, times_succeeded, skill_score")
      .order("skill_score", { ascending: false })
      .limit(10);

    return (data ?? []).map((row: Record<string, unknown>) => ({
      timestamp  : new Date().toISOString(),
      domain     : String(row.domain ?? ""),
      eventsTotal: Number(row.times_encountered ?? 0),
      issuesSolved: Number(row.times_succeeded ?? 0),
      skillScore : Number(row.skill_score ?? 0),
    }));
  } catch {
    return [];
  }
}

// ── Dashboard aggregator ──────────────────────────────────────────────────

export async function buildAutonomyDashboard(): Promise<AutonomyDashboard> {
  const [cycles, modelUsage, repairs, learning] = await Promise.all([
    getCycles24h(),
    getModelUsage24h(),
    getRepairMetrics24h(),
    getLearningGrowth(),
  ]);

  const totalTasks = cycles.reduce((s, c) => s + c.tasksExecuted, 0);
  const failedTasks = cycles.reduce((s, c) => s + c.tasksFailed, 0);
  const totalCost = cycles.reduce((s, c) => s + c.costUsd, 0);
  const avgHealth = cycles.length
    ? cycles.reduce((s, c) => s + c.healthScore, 0) / cycles.length
    : 0;
  const avgDuration = cycles.length
    ? cycles.reduce((s, c) => s + c.durationMs, 0) / cycles.length
    : 0;

  // Top models by call count
  const modelMap = new Map<string, { calls: number; totalCost: number }>();
  for (const m of modelUsage) {
    const key = `${m.provider}:${m.model}`;
    const existing = modelMap.get(key) ?? { calls: 0, totalCost: 0 };
    modelMap.set(key, { calls: existing.calls + 1, totalCost: existing.totalCost + m.costUsd });
  }
  const topModels = Array.from(modelMap.entries())
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 5)
    .map(([key, stats]) => {
      const [provider, ...modelParts] = key.split(":");
      return {
        provider,
        model       : modelParts.join(":"),
        calls       : stats.calls,
        avgCostUsd  : stats.calls > 0 ? Math.round(stats.totalCost / stats.calls * 10000) / 10000 : 0,
      };
    });

  return {
    generatedAt      : new Date().toISOString(),
    cyclesLast24h    : cycles.length,
    avgCycleDurationMs: Math.round(avgDuration),
    avgHealthScore   : Math.round(avgHealth * 10) / 10,
    totalTasksRun    : totalTasks,
    taskSuccessRate  : totalTasks > 0
      ? Math.round((totalTasks - failedTasks) / totalTasks * 1000) / 10
      : 0,
    totalCost24h     : Math.round(totalCost * 10000) / 10000,
    repairsAttempted : repairs.attempted,
    repairSuccessRate: repairs.attempted > 0
      ? Math.round(repairs.succeeded / repairs.attempted * 1000) / 10
      : 0,
    topModelsUsed    : topModels,
    learningGrowth   : learning.map((l) => ({ domain: l.domain, events: l.eventsTotal, skillScore: l.skillScore })),
    recentCycles     : cycles.slice(0, 10),
  };
}
