// lib/operations/systemHealthAnalyzer.ts
// Purpose: Computes a 0–100 health score for the Javari autonomous platform
//          by analyzing targets, cycles, task throughput, repair success,
//          guardrail results, and execution cost efficiency.
// Date: 2026-03-07

import type { RawOperationsData } from "./operationsCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HealthDimension {
  name       : string;
  score      : number;     // 0–100
  weight     : number;     // contribution weight
  status     : "healthy" | "degraded" | "critical";
  detail     : string;
  metric?    : string;     // human-readable metric
}

export interface SystemHealthReport {
  overallScore    : number;
  grade           : "A" | "B" | "C" | "D" | "F";
  status          : "healthy" | "degraded" | "critical";
  dimensions      : HealthDimension[];
  activeTargets   : number;
  issuesDiscovered: number;
  repairsCreated  : number;
  repairsCompleted: number;
  verificationFails: number;
  deploySuccessRate: number;
  lastCycleAge    : number;    // minutes since last cycle
  todayCycles     : number;
  computedAt      : string;
  alerts          : string[];
}

// ── Dimension calculators ──────────────────────────────────────────────────

function targetHealthDimension(data: RawOperationsData): HealthDimension {
  const total  = data.targets.length;
  const active = data.targets.filter(t => t.status === "active").length;
  const errored = data.targets.filter(t => t.status === "error").length;

  if (total === 0) return { name: "Targets", score: 50, weight: 15, status: "degraded",
    detail: "No targets registered", metric: "0 targets" };

  const score = total > 0
    ? Math.round(((active / total) * 100) - (errored * 20))
    : 0;

  return {
    name  : "Targets",
    score : Math.max(0, Math.min(100, score)),
    weight: 15,
    status: errored > 0 ? "critical" : active === total ? "healthy" : "degraded",
    detail: `${active}/${total} active${errored > 0 ? `, ${errored} in error` : ""}`,
    metric: `${active} active targets`,
  };
}

function cycleHealthDimension(data: RawOperationsData): HealthDimension {
  const cycles = data.engineeringCycles;
  if (cycles.length === 0) return { name: "Autonomous Cycles", score: 30, weight: 20,
    status: "degraded", detail: "No cycles recorded", metric: "0 cycles" };

  const latest  = cycles[0];
  const ageMs   = latest?.started_at
    ? Date.now() - new Date(latest.started_at).getTime()
    : Infinity;
  const ageMin  = Math.round(ageMs / 60_000);

  // Expected: a cycle every 5 minutes — degraded if >15 min, critical if >60 min
  const ageScore = ageMin < 10 ? 100 : ageMin < 20 ? 80 : ageMin < 60 ? 50 : 20;

  // Last 24h cycle count
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const todayCycles = cycles.filter(c => new Date(c.started_at).getTime() > dayAgo).length;
  const throughputScore = todayCycles >= 100 ? 100 : Math.round((todayCycles / 288) * 100);

  const score = Math.round(ageScore * 0.6 + throughputScore * 0.4);

  return {
    name  : "Autonomous Cycles",
    score : Math.min(100, score),
    weight: 20,
    status: ageMin > 60 ? "critical" : ageMin > 20 ? "degraded" : "healthy",
    detail: `Last cycle ${ageMin}m ago. ${todayCycles} cycles in last 24h`,
    metric: `${todayCycles} cycles/24h`,
  };
}

function taskThroughputDimension(data: RawOperationsData): HealthDimension {
  const tasks     = data.roadmapTasks;
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const failed    = tasks.filter(t => t.status === "failed").length;
  const pending   = tasks.filter(t => t.status === "pending").length;
  const blocked   = tasks.filter(t => t.status === "blocked").length;

  if (total === 0) return { name: "Task Throughput", score: 50, weight: 20,
    status: "degraded", detail: "No tasks in queue", metric: "0 tasks" };

  const successRate  = completed > 0 ? (completed / (completed + failed)) * 100 : 50;
  const backlogRatio = pending / Math.max(total, 1);
  const backlogScore = backlogRatio < 0.3 ? 100 : backlogRatio < 0.6 ? 70 : 40;
  const score = Math.round(successRate * 0.6 + backlogScore * 0.4);

  return {
    name  : "Task Throughput",
    score : Math.min(100, score),
    weight: 20,
    status: failed > 10 || blocked > 5 ? "critical" : score < 50 ? "degraded" : "healthy",
    detail: `${completed} completed, ${failed} failed, ${pending} pending, ${blocked} blocked`,
    metric: `${Math.round(successRate)}% success rate`,
  };
}

function repairSuccessDimension(data: RawOperationsData): HealthDimension {
  const repairs  = data.repairMetrics;
  if (repairs.length === 0) return { name: "Repair Engine", score: 70, weight: 20,
    status: "healthy", detail: "No repairs recorded yet", metric: "0 repairs" };

  const successful = repairs.filter(r => r.success).length;
  const rate = Math.round((successful / repairs.length) * 100);

  return {
    name  : "Repair Engine",
    score : rate,
    weight: 20,
    status: rate >= 70 ? "healthy" : rate >= 40 ? "degraded" : "critical",
    detail: `${successful}/${repairs.length} repairs succeeded`,
    metric: `${rate}% repair success`,
  };
}

function guardrailDimension(data: RawOperationsData): HealthDimension {
  const checks  = data.guardrailAudits;
  if (checks.length === 0) return { name: "Guardrails", score: 80, weight: 15,
    status: "healthy", detail: "No guardrail events", metric: "0 checks" };

  const violations = checks.filter(g =>
    g.result === "BLOCKED" || g.result === "ROLLBACK_REQUIRED"
  ).length;

  const score = Math.max(0, 100 - (violations * 5));
  return {
    name  : "Guardrails",
    score,
    weight: 15,
    status: violations > 10 ? "critical" : violations > 3 ? "degraded" : "healthy",
    detail: `${violations} violations in last ${checks.length} checks`,
    metric: `${violations} violations`,
  };
}

function costEfficiencyDimension(data: RawOperationsData): HealthDimension {
  const logs = data.executionLogs;
  if (logs.length === 0) return { name: "Cost Efficiency", score: 90, weight: 10,
    status: "healthy", detail: "No execution data", metric: "$0.00" };

  const totalCost = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
  const dayLogs   = logs.filter(l => {
    // execution_id is typically a timestamp-based ID — use last 100 as proxy for recency
    return true;
  }).slice(0, 100);
  const dayCost = dayLogs.reduce((s, l) => s + (l.cost ?? 0), 0);

  // Score based on daily cost: <$5 = excellent, <$20 = good, <$50 = degraded, >$50 = critical
  const score = dayCost < 1 ? 100 : dayCost < 5 ? 90 : dayCost < 20 ? 75 : dayCost < 50 ? 50 : 20;

  return {
    name  : "Cost Efficiency",
    score,
    weight: 10,
    status: dayCost > 50 ? "critical" : dayCost > 20 ? "degraded" : "healthy",
    detail: `$${dayCost.toFixed(4)} estimated in tracked logs`,
    metric: `$${totalCost.toFixed(4)} total tracked`,
  };
}

// ── Main analyzer ──────────────────────────────────────────────────────────

export function analyzeSystemHealth(data: RawOperationsData): SystemHealthReport {
  const dimensions: HealthDimension[] = [
    targetHealthDimension(data),
    cycleHealthDimension(data),
    taskThroughputDimension(data),
    repairSuccessDimension(data),
    guardrailDimension(data),
    costEfficiencyDimension(data),
  ];

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
  );

  const grade: SystemHealthReport["grade"] =
    overallScore >= 90 ? "A" : overallScore >= 75 ? "B" :
    overallScore >= 60 ? "C" : overallScore >= 40 ? "D" : "F";

  const hasCritical = dimensions.some(d => d.status === "critical");
  const hasDegraded = dimensions.some(d => d.status === "degraded");
  const status: SystemHealthReport["status"] =
    hasCritical ? "critical" : hasDegraded ? "degraded" : "healthy";

  // Derived metrics
  const tasks          = data.roadmapTasks;
  const repairTasks    = tasks.filter(t => t.source === "discovery" || t.source === "intelligence");
  const dayAgo         = Date.now() - 24 * 60 * 60 * 1000;
  const todayTasks     = tasks.filter(t => t.updated_at > dayAgo);
  const issuesToday    = todayTasks.filter(t => t.status === "pending").length;
  const completedToday = todayTasks.filter(t => t.status === "completed").length;
  const verifyFails    = data.guardrailAudits.filter(g => g.result === "ROLLBACK_REQUIRED").length;

  const cycles       = data.engineeringCycles;
  const latestCycle  = cycles[0];
  const lastCycleAge = latestCycle
    ? Math.round((Date.now() - new Date(latestCycle.started_at).getTime()) / 60_000)
    : 9999;
  const todayCycles  = cycles.filter(c => new Date(c.started_at).getTime() > dayAgo).length;

  const execLogs       = data.executionLogs;
  const deployLogs     = execLogs.filter(l => l.status === "success" || l.status === "failed");
  const deploySuccRate = deployLogs.length > 0
    ? Math.round(deployLogs.filter(l => l.status === "success").length / deployLogs.length * 100)
    : 100;

  const alerts: string[] = [];
  if (lastCycleAge > 60)  alerts.push(`⚠️ No autonomous cycle in ${lastCycleAge} minutes`);
  if (hasCritical)        alerts.push("🔴 One or more health dimensions are CRITICAL");
  const failedCount = tasks.filter(t => t.status === "failed").length;
  if (failedCount > 10)   alerts.push(`⚠️ ${failedCount} failed tasks in queue`);

  return {
    overallScore, grade, status, dimensions,
    activeTargets    : data.targets.filter(t => t.status === "active").length,
    issuesDiscovered : issuesToday,
    repairsCreated   : repairTasks.length,
    repairsCompleted : completedToday,
    verificationFails: verifyFails,
    deploySuccessRate: deploySuccRate,
    lastCycleAge,
    todayCycles,
    computedAt: new Date().toISOString(),
    alerts,
  };
}
