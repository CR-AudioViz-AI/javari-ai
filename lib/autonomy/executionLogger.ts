// lib/autonomy/executionLogger.ts
// Purpose: Write structured execution records to autonomy_execution_log.
//          Tracks every AI call made by autonomous execution for cost accounting,
//          debugging, and performance analysis.
// Date: 2026-03-09
//
// Table schema (create if not exists — see SQL below):
//   autonomy_execution_log (
//     id              uuid primary key default gen_random_uuid(),
//     task_id         text not null,
//     model_used      text not null,
//     cost_estimate   numeric(10,6) default 0,
//     execution_time  integer not null,  -- ms
//     status          text not null,     -- 'success' | 'failed' | 'skipped'
//     error_message   text,
//     tokens_in       integer default 0,
//     tokens_out      integer default 0,
//     provider        text,
//     task_type       text,
//     cycle_id        text,
//     logged_at       timestamptz default now()
//   )

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExecutionLogEntry {
  task_id        : string;
  model_used     : string;
  cost_estimate  : number;
  execution_time : number;   // ms
  status         : "success" | "failed" | "skipped";
  error_message? : string;
  tokens_in?     : number;
  tokens_out?    : number;
  provider?      : string;
  task_type?     : string;
  cycle_id?      : string;
}

// ── Write ──────────────────────────────────────────────────────────────────

/**
 * logExecution — write a single execution record.
 * Fire-and-forget: never throws, always resolves.
 */
export async function logExecution(entry: ExecutionLogEntry): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/autonomy_execution_log`, {
      method : "POST",
      headers: {
        apikey        : key,
        Authorization : `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer        : "return=minimal",
      },
      body: JSON.stringify({
        task_id       : entry.task_id,
        model_used    : entry.model_used,
        cost_estimate : entry.cost_estimate,
        execution_time: entry.execution_time,
        status        : entry.status,
        error_message : entry.error_message ?? null,
        tokens_in     : entry.tokens_in     ?? 0,
        tokens_out    : entry.tokens_out    ?? 0,
        provider      : entry.provider      ?? null,
        task_type     : entry.task_type     ?? null,
        cycle_id      : entry.cycle_id      ?? null,
        logged_at     : new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    /* fire-and-forget — never block execution on logging failure */
  }
}

/**
 * logExecutionTimed — convenience wrapper that measures execution time.
 * Usage:
 *   const done = logExecutionTimed({ task_id, model_used, ... });
 *   const result = await someAICall();
 *   await done("success", result.cost, result.tokens_in, result.tokens_out);
 */
export function logExecutionTimed(
  base: Omit<ExecutionLogEntry, "execution_time" | "status" | "cost_estimate">
): (
  status: ExecutionLogEntry["status"],
  costEstimate?: number,
  tokensIn?    : number,
  tokensOut?   : number,
  error?       : string
) => Promise<void> {
  const startMs = Date.now();
  return (status, costEstimate = 0, tokensIn = 0, tokensOut = 0, error) =>
    logExecution({
      ...base,
      execution_time: Date.now() - startMs,
      status,
      cost_estimate : costEstimate,
      tokens_in     : tokensIn,
      tokens_out    : tokensOut,
      error_message : error,
    });
}

// ── Read helpers ───────────────────────────────────────────────────────────

export interface ExecutionLogSummary {
  totalExecutions  : number;
  successRate      : number;
  totalCostUsd     : number;
  avgExecutionMs   : number;
  topModels        : Array<{ model: string; calls: number; successRate: number }>;
  last24hExecutions: number;
}

export async function getExecutionLogSummary(): Promise<ExecutionLogSummary> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { totalExecutions: 0, successRate: 0, totalCostUsd: 0, avgExecutionMs: 0, topModels: [], last24hExecutions: 0 };
  }

  try {
    const since24h = new Date(Date.now() - 86_400_000).toISOString();

    const [allRes, recentRes] = await Promise.all([
      fetch(`${url}/rest/v1/autonomy_execution_log?select=model_used,cost_estimate,execution_time,status`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal : AbortSignal.timeout(8_000),
      }),
      fetch(`${url}/rest/v1/autonomy_execution_log?select=id&logged_at=gte.${since24h}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal : AbortSignal.timeout(8_000),
      }),
    ]);

    const rows: Array<{ model_used: string; cost_estimate: number; execution_time: number; status: string }> =
      allRes.ok ? await allRes.json() : [];
    const recentRows: Array<{ id: string }> = recentRes.ok ? await recentRes.json() : [];

    if (!rows.length) {
      return { totalExecutions: 0, successRate: 0, totalCostUsd: 0, avgExecutionMs: 0, topModels: [], last24hExecutions: 0 };
    }

    const succeeded    = rows.filter(r => r.status === "success").length;
    const totalCost    = rows.reduce((s, r) => s + Number(r.cost_estimate ?? 0), 0);
    const avgMs        = rows.reduce((s, r) => s + Number(r.execution_time ?? 0), 0) / rows.length;

    // Top models by call count
    const modelMap = new Map<string, { calls: number; succeeded: number }>();
    for (const r of rows) {
      const existing = modelMap.get(r.model_used) ?? { calls: 0, succeeded: 0 };
      modelMap.set(r.model_used, {
        calls    : existing.calls + 1,
        succeeded: existing.succeeded + (r.status === "success" ? 1 : 0),
      });
    }
    const topModels = Array.from(modelMap.entries())
      .sort((a, b) => b[1].calls - a[1].calls)
      .slice(0, 5)
      .map(([model, stats]) => ({
        model,
        calls      : stats.calls,
        successRate: Math.round(stats.succeeded / stats.calls * 100),
      }));

    return {
      totalExecutions  : rows.length,
      successRate      : Math.round(succeeded / rows.length * 100),
      totalCostUsd     : Math.round(totalCost * 10000) / 10000,
      avgExecutionMs   : Math.round(avgMs),
      topModels,
      last24hExecutions: recentRows.length,
    };
  } catch {
    return { totalExecutions: 0, successRate: 0, totalCostUsd: 0, avgExecutionMs: 0, topModels: [], last24hExecutions: 0 };
  }
}

// ── DDL (run once in Supabase SQL editor) ──────────────────────────────────
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS autonomy_execution_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        TEXT        NOT NULL,
  model_used     TEXT        NOT NULL,
  cost_estimate  NUMERIC(10,6) DEFAULT 0,
  execution_time INTEGER     NOT NULL,
  status         TEXT        NOT NULL CHECK (status IN ('success','failed','skipped')),
  error_message  TEXT,
  tokens_in      INTEGER     DEFAULT 0,
  tokens_out     INTEGER     DEFAULT 0,
  provider       TEXT,
  task_type      TEXT,
  cycle_id       TEXT,
  logged_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ael_task_id  ON autonomy_execution_log (task_id);
CREATE INDEX IF NOT EXISTS idx_ael_logged   ON autonomy_execution_log (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_ael_status   ON autonomy_execution_log (status);
`;
