// lib/ecosystem/architectureRegistry.ts
// Purpose: Canonical ecosystem architecture registry — registers and tracks all
//          apps, services, APIs, databases, domains, and deployments.
//          Maintains a live graph of dependencies and system health.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type SystemType = "app" | "service" | "api" | "database" | "tool" | "domain" | "deployment";
export type SystemStatus = "active" | "deprecated" | "planned" | "error" | "archived";

export interface EcosystemSystem {
  id          : string;
  name        : string;
  type        : SystemType;
  repo?       : string;
  domain?     : string;
  framework?  : string;
  deployment? : string;
  dependencies: string[];        // array of system IDs
  status      : SystemStatus;
  metadata?   : Record<string, unknown>;
  last_updated: string;
  created_at  : string;
}

export interface DependencyGraph {
  nodes: Array<{ id: string; label: string; type: SystemType; status: SystemStatus }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

export interface RegistryResult {
  ok      : boolean;
  system? : EcosystemSystem;
  error?  : string;
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Migration ─────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS ecosystem_registry (
  id           text        PRIMARY KEY,
  name         text        NOT NULL,
  type         text        NOT NULL,
  repo         text,
  domain       text,
  framework    text,
  deployment   text,
  dependencies jsonb       NOT NULL DEFAULT '[]',
  status       text        NOT NULL DEFAULT 'active',
  metadata     jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ecosystem_type   ON ecosystem_registry (type);
CREATE INDEX IF NOT EXISTS idx_ecosystem_status ON ecosystem_registry (status);
ALTER TABLE ecosystem_registry DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE ecosystem_registry TO service_role, authenticated, anon;
`.trim();

export async function ensureRegistryTable(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  for (const stmt of MIGRATION_SQL.split(";").map(s => s.trim()).filter(Boolean)) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method : "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body   : JSON.stringify({ sql: stmt + ";" }),
        signal : AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const t = await res.text();
        if (!t.includes("already exists")) {
          console.warn(`[architectureRegistry] migration stmt warn: ${t.slice(0, 100)}`);
        }
      }
    } catch (e) {
      console.warn(`[architectureRegistry] migration error: ${(e as Error).message}`);
    }
  }
}

// ── Seed: CR AudioViz AI canonical systems ────────────────────────────────

export const CANONICAL_SYSTEMS: Omit<EcosystemSystem, "last_updated" | "created_at">[] = [
  {
    id: "sys-javari-ai-platform", name: "Javari AI Platform", type: "app",
    repo: "CR-AudioViz-AI/javari-ai", domain: "javariai.com",
    framework: "Next.js 14", deployment: "Vercel",
    dependencies: ["sys-supabase-db", "sys-stripe", "sys-paypal", "sys-r2-storage"],
    status: "active", metadata: { priority: "critical", arRevenue: 2400000 },
  },
  {
    id: "sys-craudiovizai-web", name: "CR AudioViz AI Website", type: "app",
    repo: "CR-AudioViz-AI/craudiovizai-web", domain: "craudiovizai.com",
    framework: "Next.js", deployment: "Vercel",
    dependencies: ["sys-javari-ai-platform"],
    status: "active", metadata: { purpose: "marketing" },
  },
  {
    id: "sys-supabase-db", name: "Supabase PostgreSQL Database", type: "database",
    domain: "kteobfyferrukqeolofj.supabase.co",
    deployment: "Supabase Cloud",
    dependencies: [],
    status: "active", metadata: { tables: 33, rls: true, projectRef: "kteobfyferrukqeolofj" },
  },
  {
    id: "sys-stripe", name: "Stripe Payments", type: "service",
    domain: "api.stripe.com", dependencies: [],
    status: "active", metadata: { mode: "live" },
  },
  {
    id: "sys-paypal", name: "PayPal Payments", type: "service",
    domain: "api.paypal.com", dependencies: [],
    status: "active", metadata: { mode: "live" },
  },
  {
    id: "sys-r2-storage", name: "Cloudflare R2 Storage", type: "service",
    domain: "f288716efbe7a56c02cbcaede6583752.r2.cloudflarestorage.com",
    dependencies: [],
    status: "active", metadata: { buckets: 6, canonicalBucket: "cold-storage" },
  },
  {
    id: "sys-javari-spirits", name: "Javari Spirits", type: "app",
    repo: "CR-AudioViz-AI/javari-spirits",
    dependencies: ["sys-javari-ai-platform"],
    status: "planned", metadata: { formerly: "CravBarrels" },
  },
  {
    id: "sys-javari-cards", name: "Javari Cards", type: "app",
    repo: "CR-AudioViz-AI/javari-cards",
    dependencies: ["sys-javari-ai-platform"],
    status: "planned", metadata: { formerly: "CravCards" },
  },
  {
    id: "sys-craiverse", name: "CRAIverse Virtual World", type: "app",
    repo: "CR-AudioViz-AI/craiverse",
    dependencies: ["sys-javari-ai-platform", "sys-supabase-db"],
    status: "planned", metadata: { phase: 3 },
  },
];

// ── Core functions ─────────────────────────────────────────────────────────

export async function registerSystem(
  system: Omit<EcosystemSystem, "last_updated" | "created_at">
): Promise<RegistryResult> {
  await ensureRegistryTable();

  const row: EcosystemSystem = {
    ...system,
    last_updated: new Date().toISOString(),
    created_at  : new Date().toISOString(),
  };

  const { data, error } = await db()
    .from("ecosystem_registry")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, system: data as EcosystemSystem };
}

export async function updateSystem(
  id    : string,
  patch : Partial<Omit<EcosystemSystem, "id" | "created_at">>
): Promise<RegistryResult> {
  const { data, error } = await db()
    .from("ecosystem_registry")
    .update({ ...patch, last_updated: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, system: data as EcosystemSystem };
}

export async function getSystemMap(): Promise<EcosystemSystem[]> {
  await ensureRegistryTable();

  const { data, error } = await db()
    .from("ecosystem_registry")
    .select("*")
    .order("type")
    .order("name");

  if (error) {
    console.error(`[architectureRegistry] getSystemMap: ${error.message}`);
    return [];
  }
  return (data ?? []) as EcosystemSystem[];
}

export async function getDependencies(systemId: string): Promise<EcosystemSystem[]> {
  const system = await db()
    .from("ecosystem_registry")
    .select("*")
    .eq("id", systemId)
    .single();

  if (system.error || !system.data) return [];

  const deps = (system.data as EcosystemSystem).dependencies ?? [];
  if (deps.length === 0) return [];

  const { data, error } = await db()
    .from("ecosystem_registry")
    .select("*")
    .in("id", deps);

  if (error) return [];
  return (data ?? []) as EcosystemSystem[];
}

export async function buildDependencyGraph(): Promise<DependencyGraph> {
  const systems = await getSystemMap();

  const nodes = systems.map(s => ({
    id    : s.id,
    label : s.name,
    type  : s.type,
    status: s.status,
  }));

  const edges: DependencyGraph["edges"] = [];
  for (const s of systems) {
    for (const dep of s.dependencies) {
      edges.push({ from: s.id, to: dep, label: "depends_on" });
    }
  }

  return { nodes, edges };
}

export async function seedCanonicalSystems(): Promise<{ seeded: number; errors: string[] }> {
  await ensureRegistryTable();
  let seeded = 0;
  const errors: string[] = [];

  // Check which IDs already exist
  const { data: existing } = await db()
    .from("ecosystem_registry")
    .select("id")
    .in("id", CANONICAL_SYSTEMS.map(s => s.id));

  const existingSet = new Set((existing ?? []).map((r: { id: string }) => r.id));

  for (const system of CANONICAL_SYSTEMS) {
    if (existingSet.has(system.id)) continue;
    const result = await registerSystem(system);
    if (result.ok) seeded++;
    else errors.push(`${system.id}: ${result.error}`);
  }

  return { seeded, errors };
}
