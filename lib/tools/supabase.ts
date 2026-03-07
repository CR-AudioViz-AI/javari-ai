// lib/tools/supabase.ts
// Purpose: Supabase Infrastructure Tool — safe database operations with rollback
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";
import { ToolCallResult, ToolRequest, RollbackRecord, ToolCapability } from "./types";

// Fresh client per call — avoids supabase-js module-level schema cache misses
// when tables are created after the process started.
function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "public" },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

// ─── Capabilities ──────────────────────────────────────────────────────────
export const SUPABASE_CAPABILITIES: ToolCapability[] = [
  {
    tool: "supabase", action: "ping",
    description: "Check database connectivity (SELECT NOW())",
    riskLevel: "read",
    params: {},
  },
  {
    tool: "supabase", action: "select",
    description: "Read rows from a table with optional filters",
    riskLevel: "read",
    params: {
      table:   { type: "string", required: true,  description: "Table name" },
      columns: { type: "string", required: false, description: "Columns to select (default: *)" },
      limit:   { type: "number", required: false, description: "Max rows (default: 10, max: 100)" },
      filters: { type: "object", required: false, description: "Key-value equality filters" },
    },
  },
  {
    tool: "supabase", action: "insert",
    description: "Insert rows into a table",
    riskLevel: "write",
    params: {
      table: { type: "string", required: true, description: "Table name" },
      rows:  { type: "array",  required: true, description: "Array of row objects to insert" },
    },
  },
  {
    tool: "supabase", action: "update",
    description: "Update rows matching a filter",
    riskLevel: "write",
    params: {
      table:  { type: "string", required: true, description: "Table name" },
      values: { type: "object", required: true, description: "Column values to set" },
      match:  { type: "object", required: true, description: "Equality filter to identify rows" },
    },
  },
  {
    tool: "supabase", action: "list_tables",
    description: "List accessible tables in the public schema",
    riskLevel: "read",
    params: {},
  },
];

// ─── Implementations ───────────────────────────────────────────────────────

async function ping(): Promise<ToolCallResult> {
  const start = Date.now();
  const supabase = getClient();

  // Use a lightweight query that always works — count a known table
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("id", { count: "exact", head: true });

  if (error) {
    return { ok: false, tool: "supabase", action: "ping", error: error.message, latencyMs: Date.now() - start, riskLevel: "read" };
  }

  return {
    ok: true, tool: "supabase", action: "ping",
    data: { status: "connected", timestamp: new Date().toISOString(), latencyMs: Date.now() - start },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function selectRows(params: {
  table: string; columns?: string; limit?: number; filters?: Record<string, unknown>;
}): Promise<ToolCallResult> {
  const start = Date.now();
  const supabase = getClient();
  const limit = Math.min(params.limit ?? 10, 100);
  const columns = params.columns ?? "*";

  let query = supabase.from(params.table).select(columns).limit(limit);
  if (params.filters) {
    for (const [col, val] of Object.entries(params.filters)) {
      query = query.eq(col, val as string);
    }
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, tool: "supabase", action: "select", error: error.message, latencyMs: Date.now() - start, riskLevel: "read" };
  }

  return {
    ok: true, tool: "supabase", action: "select",
    data: { table: params.table, rows: data ?? [], count: data?.length ?? 0 },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

async function insertRows(
  params: { table: string; rows: Record<string, unknown>[] },
  rollbacks: Map<string, RollbackRecord>
): Promise<ToolCallResult> {
  const start = Date.now();
  const supabase = getClient();

  const { data, error } = await supabase.from(params.table).insert(params.rows).select("id");
  if (error) {
    return { ok: false, tool: "supabase", action: "insert", error: error.message, latencyMs: Date.now() - start, riskLevel: "write" };
  }

  // Rollback: delete the inserted rows by ID
  const insertedIds = (data ?? []).map((r: { id: unknown }) => r.id).filter(Boolean);
  const rollbackId = `rb-sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  rollbacks.set(rollbackId, {
    id: rollbackId, tool: "supabase", action: "insert",
    reversalPayload: { table: params.table, deleteIds: insertedIds },
    createdAt: new Date().toISOString(), ttlMs: 3600_000, used: false,
  });

  return {
    ok: true, tool: "supabase", action: "insert",
    data: { table: params.table, inserted: insertedIds.length, ids: insertedIds },
    latencyMs: Date.now() - start, riskLevel: "write", rollbackId,
  };
}

async function updateRows(
  params: { table: string; values: Record<string, unknown>; match: Record<string, unknown> },
  rollbacks: Map<string, RollbackRecord>
): Promise<ToolCallResult> {
  const start = Date.now();
  const supabase = getClient();

  // Read existing values for rollback
  let existingQuery = supabase.from(params.table).select("*");
  for (const [col, val] of Object.entries(params.match)) {
    existingQuery = existingQuery.eq(col, val as string);
  }
  const { data: existing } = await existingQuery.limit(50);

  // Execute update
  let updateQuery = supabase.from(params.table).update(params.values);
  for (const [col, val] of Object.entries(params.match)) {
    updateQuery = updateQuery.eq(col, val as string);
  }
  const { error, count } = await updateQuery;

  if (error) {
    return { ok: false, tool: "supabase", action: "update", error: error.message, latencyMs: Date.now() - start, riskLevel: "write" };
  }

  // Store rollback (restore original values)
  const rollbackId = `rb-sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  rollbacks.set(rollbackId, {
    id: rollbackId, tool: "supabase", action: "update",
    reversalPayload: { table: params.table, restoreRows: existing ?? [] },
    createdAt: new Date().toISOString(), ttlMs: 3600_000, used: false,
  });

  return {
    ok: true, tool: "supabase", action: "update",
    data: { table: params.table, updated: count ?? 0 },
    latencyMs: Date.now() - start, riskLevel: "write", rollbackId,
  };
}

async function listTables(): Promise<ToolCallResult> {
  const start = Date.now();
  const supabase = getClient();

  // Query information_schema via a known working pattern
  // Supabase doesn't expose information_schema via REST, so we probe known tables
  const knownTables = [
    "roadmap_tasks", "javari_execution_logs", "guardrail_audit_log", "task_checkpoints",
    "profiles", "credits", "subscriptions", "platform_secrets",
    "user_cost_settings", "telemetry_logs",
  ];

  const results: Array<{ table: string; accessible: boolean; rowCount?: number }> = [];

  await Promise.allSettled(
    knownTables.map(async (table) => {
      const { count, error } = await supabase
        .from(table).select("*", { count: "exact", head: true });
      results.push({ table, accessible: !error, rowCount: error ? undefined : (count ?? 0) });
    })
  );

  return {
    ok: true, tool: "supabase", action: "list_tables",
    data: {
      tables: results.filter(r => r.accessible),
      inaccessible: results.filter(r => !r.accessible).map(r => r.table),
    },
    latencyMs: Date.now() - start, riskLevel: "read",
  };
}

// ─── Main execute ──────────────────────────────────────────────────────────
export async function executeSupabase(
  req: ToolRequest,
  rollbacks: Map<string, RollbackRecord>
): Promise<ToolCallResult> {
  switch (req.action) {
    case "ping":        return ping();
    case "select":      return selectRows(req.params as { table: string; columns?: string; limit?: number; filters?: Record<string, unknown> });
    case "insert":      return insertRows(req.params as { table: string; rows: Record<string, unknown>[] }, rollbacks);
    case "update":      return updateRows(req.params as { table: string; values: Record<string, unknown>; match: Record<string, unknown> }, rollbacks);
    case "list_tables": return listTables();
    default:
      return { ok: false, tool: "supabase", action: req.action, error: `Unknown action: ${req.action}`, latencyMs: 0, riskLevel: "read" };
  }
}
