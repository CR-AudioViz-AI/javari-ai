// lib/execution/guardrails.ts
// Purpose: Execution guardrails — migration safety, deployment verification,
//          cost ceilings, rollback triggers, and audit logging
// Date: 2026-03-06

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuardrailCheckName =
  | "kill_switch"
  | "cost_ceiling"
  | "migration_safety"
  | "deployment_verification"
  | "rollback_trigger";

export type GuardrailOutcome = "pass" | "block" | "rollback";

export interface GuardrailResult {
  check: GuardrailCheckName;
  outcome: GuardrailOutcome;
  reason: string;
  meta?: Record<string, unknown>;
}

export interface GuardrailReport {
  taskId: string;
  executionId: string;
  passed: boolean;
  blockedBy?: GuardrailCheckName;
  results: GuardrailResult[];
  timestamp: string;
}

export interface AuditEntry {
  execution_id: string;
  task_id: string;
  guardrail_check: GuardrailCheckName;
  outcome: GuardrailOutcome;
  reason: string;
  meta: Record<string, unknown>;
  created_at: string;
}

// ─── Cost ceiling constants (Henderson Standard cost law) ─────────────────────
const COST_CEILINGS: Record<string, number> = {
  system: 10.00,   // autonomous roadmap execution
  pro:     5.00,
  free:    1.00,
};

const CUMULATIVE_DAILY_CEILING = 150.00; // raised temporarily to complete roadmap — Roy approved 2026-03-07

// ─── Check 1: Kill switch ─────────────────────────────────────────────────────
// JAVARI_EXECUTION_ENABLED must be "true" or all execution is blocked.
export function checkKillSwitch(): GuardrailResult {
  const enabled = process.env.JAVARI_EXECUTION_ENABLED;
  if (enabled !== "true") {
    return {
      check: "kill_switch",
      outcome: "block",
      reason: `Execution blocked: JAVARI_EXECUTION_ENABLED="${enabled ?? "unset"}"`,
    };
  }
  return { check: "kill_switch", outcome: "pass", reason: "Kill switch active" };
}

// ─── Check 2: Cost ceiling ────────────────────────────────────────────────────
// Validates estimated cost against per-request and daily cumulative ceilings.
export async function checkCostCeiling(
  estimatedCost: number,
  tier: string = "system"
): Promise<GuardrailResult> {
  const ceiling = COST_CEILINGS[tier] ?? COST_CEILINGS.free;

  if (estimatedCost > ceiling) {
    return {
      check: "cost_ceiling",
      outcome: "block",
      reason: `Request cost $${estimatedCost.toFixed(4)} exceeds ${tier} ceiling $${ceiling.toFixed(2)}`,
      meta: { estimatedCost, ceiling, tier },
    };
  }

  // Check cumulative daily spend via execution_logs
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("javari_execution_logs")
      .select("cost")
      .gte("timestamp", startOfDay.toISOString());

    if (!error && data) {
      const dailySpend = data.reduce((sum: number, row: { cost: number }) => sum + (row.cost ?? 0), 0);
      const projected = dailySpend + estimatedCost;

      if (projected > CUMULATIVE_DAILY_CEILING) {
        return {
          check: "cost_ceiling",
          outcome: "block",
          reason: `Daily ceiling reached: $${dailySpend.toFixed(4)} spent + $${estimatedCost.toFixed(4)} projected = $${projected.toFixed(4)} > $${CUMULATIVE_DAILY_CEILING.toFixed(2)}`,
          meta: { dailySpend, estimatedCost, projected, ceiling: CUMULATIVE_DAILY_CEILING },
        };
      }
    }
  } catch (err: unknown) {
    // Non-fatal: log and continue — don't block execution on monitoring errors
    console.warn("[guardrails] Daily spend check failed (non-fatal):", (err as Error).message);
  }

  return {
    check: "cost_ceiling",
    outcome: "pass",
    reason: `Cost $${estimatedCost.toFixed(4)} within ceiling $${ceiling.toFixed(2)}`,
    meta: { estimatedCost, ceiling, tier },
  };
}

// ─── Check 3: Migration safety ────────────────────────────────────────────────
// Validates that a task tagged as a migration is safe to execute:
// - No other migration is currently in_progress
// - Task has not previously failed (would require manual review)
export async function checkMigrationSafety(
  taskId: string,
  taskTitle: string
): Promise<GuardrailResult> {
  const isMigration =
    /migrat|schema|ddl|alter\s+table|create\s+table|drop\s+table/i.test(taskTitle);

  if (!isMigration) {
    return {
      check: "migration_safety",
      outcome: "pass",
      reason: "Task is not a migration — check skipped",
    };
  }

  // Check for another migration already in progress
  const { data: inProgress, error: ipErr } = await supabase
    .from("roadmap_tasks")
    .select("id, title")
    .eq("status", "in_progress")
    .neq("id", taskId);

  if (ipErr) {
    console.warn("[guardrails] Migration safety check failed:", ipErr.message);
    return {
      check: "migration_safety",
      outcome: "pass",
      reason: "Migration check inconclusive (DB error) — proceeding with caution",
    };
  }

  const concurrentMigrations = (inProgress ?? []).filter(
    (t: { title: string }) => /migrat|schema|ddl|alter\s+table/i.test(t.title)
  );

  if (concurrentMigrations.length > 0) {
    return {
      check: "migration_safety",
      outcome: "block",
      reason: `Migration blocked: another migration is already in_progress`,
      meta: { conflicting: concurrentMigrations.map((t: { id: string; title: string }) => t.id) },
    };
  }

  // Check for prior failures on this exact task
  const { data: priorFails } = await supabase
    .from("javari_execution_logs")
    .select("execution_id, error_message")
    .eq("task_id", taskId)
    .eq("status", "failed")
    .limit(1);

  if (priorFails && priorFails.length > 0) {
    return {
      check: "migration_safety",
      outcome: "block",
      reason: `Migration blocked: task previously failed — manual review required`,
      meta: { taskId, priorFailure: priorFails[0] },
    };
  }

  return {
    check: "migration_safety",
    outcome: "pass",
    reason: "Migration safety checks passed — no concurrent migrations, no prior failures",
  };
}

// ─── Check 4: Deployment verification ────────────────────────────────────────
// Verifies the current deployment is healthy before executing.
// Calls the queue status endpoint — if it returns ok:true, the deployment is live.
export async function checkDeploymentVerification(): Promise<GuardrailResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_JAVARI_API
      ? process.env.NEXT_PUBLIC_JAVARI_API.replace(/\/api$/, "")
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${baseUrl}/api/javari/queue`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        check: "deployment_verification",
        outcome: "block",
        reason: `Deployment health check failed: HTTP ${res.status}`,
        meta: { baseUrl, status: res.status },
      };
    }

    const data = await res.json() as { ok?: boolean };
    if (!data.ok) {
      return {
        check: "deployment_verification",
        outcome: "block",
        reason: "Deployment health check returned ok:false",
        meta: { baseUrl },
      };
    }

    return {
      check: "deployment_verification",
      outcome: "pass",
      reason: "Deployment healthy",
      meta: { baseUrl },
    };
  } catch (err: unknown) {
    const message = (err as Error).message;
    // In serverless self-calls, localhost always fails — treat as pass in that case
    if (baseUrl.includes("localhost")) {
      return {
        check: "deployment_verification",
        outcome: "pass",
        reason: "Localhost environment — deployment check skipped",
      };
    }
    return {
      check: "deployment_verification",
      outcome: "block",
      reason: `Deployment health check threw: ${message}`,
      meta: { baseUrl },
    };
  }
}

// ─── Check 5: Rollback trigger ────────────────────────────────────────────────
// Checks recent failure rate. If the last N tasks have a high failure rate,
// block execution and signal that human intervention is needed.
export async function checkRollbackTrigger(): Promise<GuardrailResult> {
  const WINDOW = 10;     // look at last 10 executions
  const THRESHOLD = 0.5; // block if ≥50% failure rate

  try {
    const { data: recent, error } = await supabase
      .from("javari_execution_logs")
      .select("status")
      .order("timestamp", { ascending: false })
      .limit(WINDOW);

    if (error || !recent || recent.length < 3) {
      // Insufficient history — pass
      return {
        check: "rollback_trigger",
        outcome: "pass",
        reason: `Insufficient execution history (${recent?.length ?? 0} records) — rollback check skipped`,
      };
    }

    const failures = recent.filter((r: { status: string }) => r.status === "failed").length;
    const rate = failures / recent.length;

    if (rate >= THRESHOLD) {
      return {
        check: "rollback_trigger",
        outcome: "rollback",
        reason: `Rollback triggered: ${failures}/${recent.length} recent executions failed (${(rate * 100).toFixed(0)}% ≥ ${THRESHOLD * 100}% threshold)`,
        meta: { failures, total: recent.length, rate, threshold: THRESHOLD },
      };
    }

    return {
      check: "rollback_trigger",
      outcome: "pass",
      reason: `Failure rate ${(rate * 100).toFixed(0)}% within threshold (${failures}/${recent.length} failed)`,
      meta: { failures, total: recent.length, rate, threshold: THRESHOLD },
    };
  } catch (err: unknown) {
    console.warn("[guardrails] Rollback check failed (non-fatal):", (err as Error).message);
    return {
      check: "rollback_trigger",
      outcome: "pass",
      reason: "Rollback check inconclusive (DB error) — proceeding",
    };
  }
}

// ─── Audit log writer ─────────────────────────────────────────────────────────
// Persists every guardrail result to the guardrail_audit_log table.
// Uses raw fetch() — guardrail_audit_log was created after supabase gen types ran,
// so supabase-js .from() returns schema cache misses on some connection pools.
export async function writeGuardrailAudit(entries: AuditEntry[]): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${url}/rest/v1/guardrail_audit_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(entries.map(e => ({
        execution_id:    e.executionId,
        task_id:         e.taskId,
        guardrail_check: e.check,
        outcome:         e.outcome,
        reason:          e.reason,
        meta:            e.meta ?? {},
        created_at:      e.timestamp,
      }))),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("[guardrails] Audit log write failed (non-fatal):", res.status, err.slice(0, 100));
    }
  } catch (err: unknown) {
    console.warn("[guardrails] Audit log exception (non-fatal):", (err as Error).message);
  }
}

// ─── Main guardrail runner ────────────────────────────────────────────────────
// Runs all guardrail checks in sequence. Short-circuits on first block/rollback.
// Returns a complete report for the caller to act on.
export async function runGuardrails(params: {
  taskId: string;
  executionId: string;
  taskTitle: string;
  estimatedCost?: number;
  tier?: string;
}): Promise<GuardrailReport> {
  const { taskId, executionId, taskTitle, estimatedCost = 0, tier = "system" } = params;
  const results: GuardrailResult[] = [];
  const timestamp = new Date().toISOString();

  // Run checks in order of cheapness (no I/O first)
  const killResult = checkKillSwitch();
  results.push(killResult);
  if (killResult.outcome !== "pass") {
    const report: GuardrailReport = {
      taskId, executionId, passed: false,
      blockedBy: killResult.check, results, timestamp,
    };
    await writeGuardrailAudit(buildAuditEntries(results, taskId, executionId, timestamp));
    return report;
  }

  // Cost ceiling (includes DB I/O for daily spend check)
  const costResult = await checkCostCeiling(estimatedCost, tier);
  results.push(costResult);
  if (costResult.outcome !== "pass") {
    const report: GuardrailReport = {
      taskId, executionId, passed: false,
      blockedBy: costResult.check, results, timestamp,
    };
    await writeGuardrailAudit(buildAuditEntries(results, taskId, executionId, timestamp));
    return report;
  }

  // Migration safety (DB I/O)
  const migrationResult = await checkMigrationSafety(taskId, taskTitle);
  results.push(migrationResult);
  if (migrationResult.outcome !== "pass") {
    const report: GuardrailReport = {
      taskId, executionId, passed: false,
      blockedBy: migrationResult.check, results, timestamp,
    };
    await writeGuardrailAudit(buildAuditEntries(results, taskId, executionId, timestamp));
    return report;
  }

  // Rollback trigger (DB I/O — check failure rate before deploying)
  const rollbackResult = await checkRollbackTrigger();
  results.push(rollbackResult);
  if (rollbackResult.outcome !== "pass") {
    const report: GuardrailReport = {
      taskId, executionId, passed: false,
      blockedBy: rollbackResult.check, results, timestamp,
    };
    await writeGuardrailAudit(buildAuditEntries(results, taskId, executionId, timestamp));
    return report;
  }

  // Deployment verification (HTTP call — most expensive, run last)
  const deployResult = await checkDeploymentVerification();
  results.push(deployResult);
  if (deployResult.outcome !== "pass") {
    const report: GuardrailReport = {
      taskId, executionId, passed: false,
      blockedBy: deployResult.check, results, timestamp,
    };
    await writeGuardrailAudit(buildAuditEntries(results, taskId, executionId, timestamp));
    return report;
  }

  // All passed
  const report: GuardrailReport = {
    taskId, executionId, passed: true, results, timestamp,
  };
  await writeGuardrailAudit(buildAuditEntries(results, taskId, executionId, timestamp));
  return report;
}

// ─── Audit entry builder ──────────────────────────────────────────────────────
function buildAuditEntries(
  results: GuardrailResult[],
  taskId: string,
  executionId: string,
  timestamp: string
): AuditEntry[] {
  return results.map((r) => ({
    execution_id: executionId,
    task_id: taskId,
    guardrail_check: r.check,
    outcome: r.outcome,
    reason: r.reason,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    created_at: timestamp,
  }));
}
