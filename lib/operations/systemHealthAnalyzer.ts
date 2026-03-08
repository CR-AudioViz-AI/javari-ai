// lib/operations/systemHealthAnalyzer.ts
// Purpose: Computes a 0–100 health score for the Javari autonomous platform.
//          Dimensions: Targets, Cycles, Task Throughput, Repair Engine, Guardrails, Cost.
//          Cycle scoring now accounts for task-completion state (no penalty when queue is clean).
// Date: 2026-03-08

import type { RawOperationsData } from "./operationsCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HealthDimension {
  name       : string;
  score      : number;     // 0–100
  weight     : number;
  status     : "healthy" | "degraded" | "critical";
  detail     : string;
  metric?    : string;
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
  lastCycleAge    : number;
  todayCycles     : number;
  computedAt      : string;
  alerts          : string[];
}

// ── Dimension calculators ──────────────────────────────────────────────────

function targetHealthDimension(data: RawOperationsData): HealthDimension {
  const total   = data.targets.length;
  const active  = data.targets.filter(t => t.status === "active").length;
  const errored = data.targets.filter(t => t.status === "error").length;

  if (total === 0) return { name: "Targets", score: 60, weight: 15, status: "degraded",
    detail: "No targets registered", metric: "0 targets" };

  const score = Math.max(0, Math.min(100, Math.round(((active / total) * 100) - (errored * 15))));
  return {
    name: "Targets", score, weight: 15,
    status: errored > 0 ? "critical" : active === total ? "healthy" : "degraded",
    detail: `${active}/${total} active${errored > 0 ? `, ${errored} in error` : ""}`,
    metric: `${active} active targets`,
  };
}

function cycleHealthDimension(data: RawOperationsData): HealthDimension {
  const cycles = data.engineeringCycles;
  const tasks  = data.roadmapTasks;

  // If all tasks are completed and queue is clean, cycles being infrequent is acceptable
  const pending   = tasks.filter(t => t.status === "pending").length;
  const failed    = tasks.filter(t => t.status === "failed").length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const queueClean = pending === 0 && failed === 0 && completed > 0;

  if (cycles.length === 0) {
    // No cycles yet — neutral if queue clean, degraded otherwise
    const score = queueClean ? 70 : 30;
    return { name: "Autonomous Cycles", score, weight: 20,
      status: queueClean ? "degraded" : "critical",
      detail: "No cycles recorded — queue " + (queueClean ? "complete" : "pending"),
      metric: "0 cycles" };
  }

  const latest   = cycles[0];
  const ageMs    = latest?.started_at
    ? Date.now() - new Date(latest.started_at).getTime()
    : Infinity;
  const ageMin   = Math.round(ageMs / 60_000);
  const ageHours = ageMin / 60;

  // If queue is clean, a cycle that ran recently is fine — don't penalize idle time
  let ageScore: number;
  if (queueClean) {
    // Clean queue: scored on whether any cycle ran today
    ageScore = ageHours < 24 ? 90 : ageHours < 72 ? 75 : 60;
  } else {
    // Active work pending: penalize heavily for slow cycles
    ageScore = ageMin < 10 ? 100 : ageMin < 20 ? 80 : ageMin < 60 ? 50 : 20;
  }

  const dayAgo       = Date.now() - 24 * 60 * 60 * 1000;
  const todayCycles  = cycles.filter(c => new Date(c.started_at).getTime() > dayAgo).length;

  // Realistic throughput scoring: any cycle today = good, 5+ = excellent
  const throughputScore = todayCycles >= 10 ? 100 : todayCycles >= 5 ? 90 : todayCycles >= 1 ? 75 : 40;

  const score = Math.round(ageScore * 0.6 + throughputScore * 0.4);
  const status: HealthDimension["status"] = score >= 70 ? "healthy" : score >= 50 ? "degraded" : "critical";

  return {
    name: "Autonomous Cycles", score: Math.min(100, score), weight: 20, status,
    detail: `Last cycle ${ageMin < 60 ? ageMin + "m" : Math.round(ageHours) + "h"} ago. ${todayCycles} cycles today${queueClean ? " (queue clean)" : ""}`,
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

  if (total === 0) return { name: "Task Throughput", score: 60, weight: 20,
    status: "degraded", detail: "No tasks in queue", metric: "0 tasks" };

  // If all tasks completed: maximum throughput score
  if (completed === total) {
    return { name: "Task Throughput", score: 100, weight: 20, status: "healthy",
      detail: `${completed}/${total} tasks completed (100%)`, metric: "100% complete" };
  }

  const successRate  = completed > 0 ? (completed / (completed + Math.max(failed, 0.001))) * 100 : 50;
  const backlogRatio = pending / Math.max(total, 1);
  const backlogScore = backlogRatio < 0.1 ? 100 : backlogRatio < 0.3 ? 80 : backlogRatio < 0.6 ? 60 : 40;
  const score = Math.round(successRate * 0.6 + backlogScore * 0.4);

  return {
    name: "Task Throughput", score: Math.min(100, score), weight: 20,
    status: failed > 10 || blocked > 5 ? "critical" : score < 50 ? "degraded" : "healthy",
    detail: `${completed}/${total} completed (${Math.round((completed/total)*100)}%), ${failed} failed, ${pending} pending`,
    metric: `${Math.round(successRate)}% success`,
  };
}

function repairSuccessDimension(data: RawOperationsData): HealthDimension {
  const repairs = data.repairMetrics;
  if (repairs.length === 0) return { name: "Repair Engine", score: 75, weight: 20,
    status: "healthy", detail: "No repairs recorded yet", metric: "0 repairs" };

  const successful = repairs.filter(r => r.success).length;
  const rate       = Math.round((successful / repairs.length) * 100);

  return {
    name: "Repair Engine", score: rate, weight: 20,
    status: rate >= 70 ? "healthy" : rate >= 40 ? "degraded" : "critical",
    detail: `${successful}/${repairs.length} repairs succeeded`,
    metric: `${rate}% repair success`,
  };
}

function guardrailDimension(data: RawOperationsData): HealthDimension {
  const checks = data.guardrailAudits;
  if (checks.length === 0) return { name: "Guardrails", score: 85, weight: 10,
    status: "healthy", detail: "No guardrail events recorded", metric: "0 checks" };

  const violations = checks.filter(g =>
    g.result === "BLOCKED" || g.result === "ROLLBACK_REQUIRED"
  ).length;

  const score = Math.max(0, 100 - (violations * 5));
  return {
    name: "Guardrails", score, weight: 10,
    status: violations > 10 ? "critical" : violations > 3 ? "degraded" : "healthy",
    detail: `${violations} violations in ${checks.length} checks`,
    metric: `${violations} violations`,
  };
}

function costEfficiencyDimension(data: RawOperationsData): HealthDimension {
  const logs = data.executionLogs;
  if (logs.length === 0) return { name: "Cost Efficiency", score: 95, weight: 15,
    status: "healthy", detail: "No execution cost data", metric: "$0.00" };

  const recent100 = logs.slice(0, 100);
  const dayCost   = recent100.reduce((s, l) => s + (l.cost ?? 0), 0);
  const totalCost = logs.reduce((s, l) => s + (l.cost ?? 0), 0);

  const score = dayCost < 1 ? 100 : dayCost < 5 ? 90 : dayCost < 20 ? 75 : dayCost < 50 ? 50 : 20;

  return {
    name: "Cost Efficiency", score, weight: 15,
    status: dayCost > 50 ? "critical" : dayCost > 20 ? "degraded" : "healthy",
    detail: `$${dayCost.toFixed(4)} in recent ${recent100.length} executions`,
    metric: `$${totalCost.toFixed(4)} total`,
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

  const totalWeight  = dimensions.reduce((s, d) => s + d.weight, 0);
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

  const tasks          = data.roadmapTasks;
  const repairTasks    = tasks.filter(t =>
    t.source === "discovery" || t.source === "intelligence" || t.source === "repair"
  );
  const dayAgo         = Date.now() - 24 * 60 * 60 * 1000;
  const todayTasks     = tasks.filter(t => (t.updated_at ?? 0) > dayAgo / 1000);
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
  const failedCount = tasks.filter(t => t.status === "failed").length;
  if (failedCount > 10) alerts.push(`⚠️ ${failedCount} failed tasks in queue`);
  if (hasCritical)      alerts.push("🔴 One or more health dimensions are CRITICAL");
  if (overallScore < 60) alerts.push(`⚠️ System health below 60: ${overallScore}/100`);

  return {
    overallScore, grade, status, dimensions,
    activeTargets    : data.targets.filter(t => t.status === "active").length,
    issuesDiscovered : issuesToday,
    repairsCreated   : repairTasks.length,
    repairsCompleted : completedToday,
    verificationFails: verifyFails,
    deploySuccessRate: deploySuccRate,
    lastCycleAge, todayCycles,
    computedAt: new Date().toISOString(),
    alerts,
  };
}
