// lib/operations/operationsCollector.ts
// Purpose: Central data collector for the Javari Operations Center.
//          Pulls live data from Supabase tables that all other engines write to.
//          Single source of truth for the operations dashboard.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RawOperationsData {
  targets          : TargetRow[];
  engineeringCycles: CycleRow[];
  roadmapTasks     : TaskRow[];
  executionLogs    : ExecLogRow[];
  guardrailAudits  : GuardrailRow[];
  customerAudits   : CustomerAuditRow[];
  scanMetrics      : ScanMetricRow[];
  repairMetrics    : RepairMetricRow[];
  collectedAt      : string;
  durationMs       : number;
}

export interface TargetRow {
  id            : string;
  name          : string;
  type          : string;
  location      : string;
  status        : string;
  last_scan?    : string;
  scan_interval : number;
  metadata?     : Record<string, unknown>;
}

export interface CycleRow {
  cycle_id          : string;
  started_at        : string;
  completed_at?     : string;
  targets_processed : number;
  total_issues      : number;
  total_repair_tasks: number;
  errors?           : unknown;
  duration_ms       : number;
}

export interface TaskRow {
  id         : string;
  title      : string;
  status     : string;
  phase_id   : string;
  source?    : string;
  updated_at : number;
  error?     : string;
  cost?      : number;
}

export interface ExecLogRow {
  execution_id  : string;
  task_id       : string;
  model_used    : string;
  cost          : number;
  tokens_in     : number;
  tokens_out    : number;
  execution_time: number;
  status        : string;
  error_message?: string;
}

export interface GuardrailRow {
  id         : string;
  check_name : string;
  result     : string;
  task_id?   : string;
  created_at : string;
}

export interface CustomerAuditRow {
  id               : string;
  domain           : string;
  scan_date        : string;
  pages_crawled    : number;
  issues_found     : number;
  security_score   : number;
  performance_score: number;
  report_id        : string;
  tasks_created    : number;
  metadata?        : Record<string, unknown>;
}

export interface ScanMetricRow {
  id            : string;
  target_id     : string;
  scan_date     : string;
  duration_ms   : number;
  pages_crawled : number;
  files_analyzed: number;
  issues_found  : number;
  cycle_id?     : string;
}

export interface RepairMetricRow {
  id            : string;
  task_id       : string;
  repair_date   : string;
  success       : boolean;
  duration_ms   : number;
  commits_created: number;
  pr_created    : boolean;
  error?        : string;
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

async function safeQuery<T>(
  table  : string,
  select : string = "*",
  options: { order?: string; orderAsc?: boolean; limit?: number; gte?: { col: string; val: string } } = {}
): Promise<T[]> {
  try {
    let q = db().from(table).select(select);
    if (options.gte) q = (q as ReturnType<typeof db>["from"] extends (...args: unknown[]) => infer R ? R : never).gte(options.gte.col, options.gte.val) as typeof q;
    if (options.order) q = q.order(options.order, { ascending: options.orderAsc ?? false });
    if (options.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) { console.warn(`[opsCollector] ${table}: ${error.message}`); return []; }
    return (data ?? []) as T[];
  } catch (e) {
    console.warn(`[opsCollector] ${table} failed: ${(e as Error).message}`);
    return [];
  }
}

// ── Main collector ─────────────────────────────────────────────────────────

export async function collectOperationsData(): Promise<RawOperationsData> {
  const t0  = Date.now();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const lastWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [targets, cycles, tasks, execLogs, guardrails, customerAudits, scanMetrics, repairMetrics] =
    await Promise.all([
      safeQuery<TargetRow>("javari_targets", "*", { order: "last_scan", limit: 50 }),
      safeQuery<CycleRow>("javari_engineering_cycles", "*", { order: "started_at", limit: 20 }),
      safeQuery<TaskRow>("roadmap_tasks", "id,title,status,phase_id,source,updated_at,error,cost", { order: "updated_at", limit: 200 }),
      safeQuery<ExecLogRow>("javari_execution_logs", "*", { order: "execution_id", limit: 100 }),
      safeQuery<GuardrailRow>("guardrail_audit_log", "*", { order: "created_at", limit: 50 }),
      safeQuery<CustomerAuditRow>("javari_customer_audits", "*", { order: "scan_date", limit: 30 }),
      safeQuery<ScanMetricRow>("javari_scan_metrics", "*", { order: "scan_date", limit: 50 }),
      safeQuery<RepairMetricRow>("javari_repair_metrics", "*", { order: "repair_date", limit: 50 }),
    ]);

  return {
    targets, engineeringCycles: cycles, roadmapTasks: tasks,
    executionLogs: execLogs, guardrailAudits: guardrails,
    customerAudits, scanMetrics, repairMetrics,
    collectedAt: new Date().toISOString(),
    durationMs : Date.now() - t0,
  };
}

// ── Ensure tables ──────────────────────────────────────────────────────────

const TABLE_MIGRATIONS: Record<string, string> = {
  javari_scan_metrics: `
    CREATE TABLE IF NOT EXISTS javari_scan_metrics (
      id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      target_id      text NOT NULL,
      scan_date      timestamptz NOT NULL DEFAULT now(),
      duration_ms    integer NOT NULL DEFAULT 0,
      pages_crawled  integer NOT NULL DEFAULT 0,
      files_analyzed integer NOT NULL DEFAULT 0,
      issues_found   integer NOT NULL DEFAULT 0,
      cycle_id       text,
      created_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_scan_metrics_date ON javari_scan_metrics (scan_date DESC);
    ALTER TABLE javari_scan_metrics DISABLE ROW LEVEL SECURITY;
  `,
  javari_repair_metrics: `
    CREATE TABLE IF NOT EXISTS javari_repair_metrics (
      id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_id         text NOT NULL,
      repair_date     timestamptz NOT NULL DEFAULT now(),
      success         boolean NOT NULL DEFAULT false,
      duration_ms     integer NOT NULL DEFAULT 0,
      commits_created integer NOT NULL DEFAULT 0,
      pr_created      boolean NOT NULL DEFAULT false,
      error           text,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_repair_metrics_date ON javari_repair_metrics (repair_date DESC);
    ALTER TABLE javari_repair_metrics DISABLE ROW LEVEL SECURITY;
  `,
  javari_customer_audits: `
    CREATE TABLE IF NOT EXISTS javari_customer_audits (
      id                text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      domain            text NOT NULL,
      scan_date         timestamptz NOT NULL DEFAULT now(),
      pages_crawled     integer NOT NULL DEFAULT 0,
      issues_found      integer NOT NULL DEFAULT 0,
      security_score    integer NOT NULL DEFAULT 0,
      performance_score integer NOT NULL DEFAULT 0,
      report_id         text NOT NULL DEFAULT '',
      tasks_created     integer NOT NULL DEFAULT 0,
      metadata          jsonb,
      created_at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_customer_audits_date ON javari_customer_audits (scan_date DESC);
    ALTER TABLE javari_customer_audits DISABLE ROW LEVEL SECURITY;
  `,
};

export async function ensureOperationsTables(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  for (const [, sql] of Object.entries(TABLE_MIGRATIONS)) {
    for (const stmt of sql.split(";").map(s => s.trim()).filter(Boolean)) {
      try {
        await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method : "POST",
          headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
          body   : JSON.stringify({ sql: stmt + ";" }),
          signal : AbortSignal.timeout(12_000),
        });
      } catch { /* non-fatal */ }
    }
  }
}

// ── Write helpers used by other engines ───────────────────────────────────

export async function recordCustomerAudit(audit: Omit<CustomerAuditRow, "created_at">): Promise<void> {
  await ensureOperationsTables();
  const { error } = await db().from("javari_customer_audits").upsert(audit, { onConflict: "id" });
  if (error) console.warn(`[opsCollector] recordCustomerAudit: ${error.message}`);
}

export async function recordScanMetric(metric: Omit<ScanMetricRow, "created_at">): Promise<void> {
  await ensureOperationsTables();
  const { error } = await db().from("javari_scan_metrics").insert(metric);
  if (error) console.warn(`[opsCollector] recordScanMetric: ${error.message}`);
}

export async function recordRepairMetric(metric: Omit<RepairMetricRow, "created_at">): Promise<void> {
  await ensureOperationsTables();
  const { error } = await db().from("javari_repair_metrics").insert(metric);
  if (error) console.warn(`[opsCollector] recordRepairMetric: ${error.message}`);
}
