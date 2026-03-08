// lib/autonomy/targetRegistry.ts
// Purpose: Target Registry — manages the list of systems Javari monitors and
//          repairs. Targets are persisted in javari_targets table. Includes
//          idempotent table migration, CRUD operations, and seed data for the
//          primary CR AudioViz AI platform.
// Date: 2026-03-07

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type TargetType   = "repo" | "website" | "api" | "service";
export type TargetStatus = "active" | "paused" | "error" | "archived";

export interface JavariTarget {
  id          : string;
  name        : string;
  type        : TargetType;
  location    : string;        // repo: "owner/repo" | website/api: URL | service: identifier
  branch?     : string;        // for repo targets
  lastScan?   : string;        // ISO timestamp
  status      : TargetStatus;
  scanInterval: number;        // minutes between scans
  metadata?   : Record<string, unknown>;
  createdAt   : string;
  updatedAt   : string;
}

export interface TargetUpsert {
  id?          : string;
  name         : string;
  type         : TargetType;
  location     : string;
  branch?      : string;
  status?      : TargetStatus;
  scanInterval?: number;
  metadata?    : Record<string, unknown>;
}

// ── Default scan intervals (minutes) ──────────────────────────────────────

export const SCAN_INTERVALS: Record<TargetType, number> = {
  repo   : 720,   // 12 hours
  website: 360,   //  6 hours
  api    : 60,    //  1 hour
  service: 60,    //  1 hour
};

// ── Migration SQL ──────────────────────────────────────────────────────────

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS javari_targets (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  type          text        NOT NULL CHECK (type IN ('repo','website','api','service')),
  location      text        NOT NULL,
  branch        text        DEFAULT 'main',
  last_scan     timestamptz,
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','archived')),
  scan_interval integer     NOT NULL DEFAULT 720,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_javari_targets_status   ON javari_targets (status);
CREATE INDEX IF NOT EXISTS idx_javari_targets_type     ON javari_targets (type);
CREATE INDEX IF NOT EXISTS idx_javari_targets_last_scan ON javari_targets (last_scan);
ALTER TABLE javari_targets DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE javari_targets TO service_role, authenticated, anon;
`.trim();

// ── Default seed targets ───────────────────────────────────────────────────

const SEED_TARGETS: TargetUpsert[] = [
  {
    id          : "target-javari-ai-main",
    name        : "Javari AI Platform",
    type        : "repo",
    location    : "CR-AudioViz-AI/javari-ai",
    branch      : "main",
    status      : "active",
    scanInterval: 720,
    metadata    : { priority: "critical", owner: "system" },
  },
  {
    id          : "target-craudiovizai-web",
    name        : "CR AudioViz AI Website",
    type        : "website",
    location    : "https://craudiovizai.com",
    status      : "active",
    scanInterval: 360,
    metadata    : { priority: "high" },
  },
  {
    id          : "target-javariai-web",
    name        : "Javari AI Website",
    type        : "website",
    location    : "https://javariai.com",
    status      : "active",
    scanInterval: 360,
    metadata    : { priority: "high" },
  },
  {
    id          : "target-javari-api",
    name        : "Javari AI API",
    type        : "api",
    location    : "https://javariai.com/api/javari/health",
    status      : "active",
    scanInterval: 60,
    metadata    : { priority: "critical" },
  },
];

// ── Supabase client ────────────────────────────────────────────────────────

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL   ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY  ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Migration runner ───────────────────────────────────────────────────────

export async function ensureTargetsTable(): Promise<{ ok: boolean; message: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL   ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY  ?? "";

  // Try via rpc/exec_sql — same pattern as auto-migrate
  for (const rpcPath of ["/rest/v1/rpc/exec_sql", "/rest/v1/rpc/query"]) {
    try {
      const res = await fetch(`${url}${rpcPath}`, {
        method : "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body   : JSON.stringify({ query: MIGRATION_SQL }),
        signal : AbortSignal.timeout(15_000),
      });
      if (res.ok) return { ok: true, message: `Migration applied via ${rpcPath}` };
    } catch { /* try next */ }
  }

  // If RPC unavailable, check if table already exists by querying it
  try {
    const { error } = await db().from("javari_targets").select("id").limit(1);
    if (!error) return { ok: true, message: "Table already exists" };
    return { ok: false, message: `Migration failed and table query error: ${error.message}` };
  } catch (e) {
    return { ok: false, message: `Cannot verify table: ${String(e)}` };
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getAllTargets(statusFilter?: TargetStatus): Promise<JavariTarget[]> {
  let q = db().from("javari_targets").select("*");
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data, error } = await q.order("created_at");
  if (error) throw new Error(`getAllTargets: ${error.message}`);
  return (data ?? []).map(rowToTarget);
}

export async function getActiveTargets(): Promise<JavariTarget[]> {
  return getAllTargets("active");
}

export async function getTargetsDueForScan(): Promise<JavariTarget[]> {
  const { data, error } = await db()
    .from("javari_targets")
    .select("*")
    .eq("status", "active")
    .or(`last_scan.is.null,last_scan.lt.${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`);
  if (error) throw new Error(`getTargetsDueForScan: ${error.message}`);

  // Filter by each target's individual scan interval
  const now = Date.now();
  return (data ?? []).map(rowToTarget).filter(t => {
    if (!t.lastScan) return true;
    const elapsed = (now - new Date(t.lastScan).getTime()) / 60_000; // minutes
    return elapsed >= t.scanInterval;
  });
}

export async function upsertTarget(t: TargetUpsert): Promise<JavariTarget> {
  const now  = new Date().toISOString();
  const id   = t.id ?? `target-${t.type}-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Date.now()}`;
  const row  = {
    id,
    name         : t.name,
    type         : t.type,
    location     : t.location,
    branch       : t.branch ?? "main",
    status       : t.status ?? "active",
    scan_interval: t.scanInterval ?? SCAN_INTERVALS[t.type],
    metadata     : t.metadata ?? {},
    created_at   : now,
    updated_at   : now,
  };
  const { data, error } = await db()
    .from("javari_targets")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(`upsertTarget: ${error.message}`);
  return rowToTarget(data);
}

export async function updateLastScan(id: string): Promise<void> {
  const { error } = await db()
    .from("javari_targets")
    .update({ last_scan: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error(`[targetRegistry] updateLastScan failed: ${error.message}`);
}

export async function seedDefaultTargets(): Promise<number> {
  let seeded = 0;
  for (const t of SEED_TARGETS) {
    try {
      await upsertTarget(t);
      seeded++;
    } catch { /* skip if already exists */ }
  }
  return seeded;
}

// ── Row mapper ─────────────────────────────────────────────────────────────

function rowToTarget(row: Record<string, unknown>): JavariTarget {
  return {
    id          : String(row.id),
    name        : String(row.name),
    type        : row.type as TargetType,
    location    : String(row.location),
    branch      : row.branch ? String(row.branch) : "main",
    lastScan    : row.last_scan ? String(row.last_scan) : undefined,
    status      : row.status as TargetStatus,
    scanInterval: Number(row.scan_interval ?? 720),
    metadata    : (row.metadata as Record<string, unknown>) ?? {},
    createdAt   : String(row.created_at),
    updatedAt   : String(row.updated_at),
  };
}
