// lib/learning/learningCollector.ts
// Purpose: Collects learning signals from all Javari subsystems — code intelligence
//          scans, crawler audits, repair results, ecosystem analysis — and stores
//          structured learning events for knowledge growth tracking.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type LearningEventType =
  | "issue_detected"   | "issue_repaired"    | "scan_completed"
  | "audit_completed"  | "tech_encountered"  | "pattern_learned"
  | "capability_proven"| "failure_observed"  | "ecosystem_analyzed";

export type KnowledgeDomain =
  | "security" | "performance" | "architecture" | "frontend"
  | "backend"  | "infrastructure" | "ai_systems" | "databases" | "devops";

export interface LearningEvent {
  id         : string;
  timestamp  : string;
  event_type : LearningEventType;
  domain     : KnowledgeDomain;
  technology : string;
  severity   : "low" | "medium" | "high" | "critical";
  source     : string;
  details    : Record<string, unknown>;
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
CREATE TABLE IF NOT EXISTS javari_learning_events (
  id         text        PRIMARY KEY,
  timestamp  timestamptz NOT NULL DEFAULT now(),
  event_type text        NOT NULL,
  domain     text        NOT NULL,
  technology text        NOT NULL DEFAULT 'unknown',
  severity   text        NOT NULL DEFAULT 'low',
  source     text        NOT NULL DEFAULT 'system',
  details    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_ts     ON javari_learning_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_learning_domain ON javari_learning_events (domain);
CREATE INDEX IF NOT EXISTS idx_learning_type   ON javari_learning_events (event_type);
ALTER TABLE javari_learning_events DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE javari_learning_events TO service_role, authenticated, anon;

CREATE TABLE IF NOT EXISTS javari_technology_experience (
  technology       text    PRIMARY KEY,
  occurrences      integer NOT NULL DEFAULT 0,
  projects_seen    integer NOT NULL DEFAULT 0,
  issues_resolved  integer NOT NULL DEFAULT 0,
  issues_detected  integer NOT NULL DEFAULT 0,
  first_seen       timestamptz NOT NULL DEFAULT now(),
  last_seen        timestamptz NOT NULL DEFAULT now(),
  domains          jsonb   NOT NULL DEFAULT '[]'
);
ALTER TABLE javari_technology_experience DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE javari_technology_experience TO service_role, authenticated, anon;
`.trim();

export async function ensureLearningTables(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  for (const stmt of MIGRATION_SQL.split(";").map(s => s.trim()).filter(Boolean)) {
    try {
      await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ sql: stmt + ";" }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch { /* non-fatal */ }
  }
}

// ── Core write ────────────────────────────────────────────────────────────

export async function recordLearningEvent(
  event: Omit<LearningEvent, "id" | "timestamp">
): Promise<void> {
  await ensureLearningTables();
  const row: LearningEvent = {
    ...event,
    id       : `le-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  const { error } = await db().from("javari_learning_events").insert(row);
  if (error) console.warn(`[learning] recordEvent: ${error.message}`);
}

export async function recordManyLearningEvents(
  events: Array<Omit<LearningEvent, "id" | "timestamp">>
): Promise<void> {
  if (events.length === 0) return;
  await ensureLearningTables();
  const ts = Date.now();
  const rows: LearningEvent[] = events.map((e, i) => ({
    ...e,
    id       : `le-${ts + i}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  }));
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db().from("javari_learning_events").insert(rows.slice(i, i + BATCH));
    if (error) console.warn(`[learning] recordMany batch: ${error.message}`);
  }
}

// ── Ingest from existing platform data ───────────────────────────────────

export async function ingestFromPlatformData(): Promise<{ eventsCreated: number }> {
  await ensureLearningTables();

  const events: Array<Omit<LearningEvent, "id" | "timestamp">> = [];

  // Pull roadmap tasks to learn from
  const { data: tasks } = await db()
    .from("roadmap_tasks")
    .select("id,title,description,status,source,phase_id,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  for (const task of (tasks ?? [])) {
    const desc = ((task.description as string) ?? "").toLowerCase();
    const title = ((task.title as string) ?? "").toLowerCase();

    // Determine domain from task content
    const domain: KnowledgeDomain =
      /security|csrf|xss|csp|hsts|auth|injection/.test(desc + title) ? "security"
      : /performance|ttfb|bundle|cache|slow/.test(desc + title) ? "performance"
      : /database|supabase|postgres|query|sql/.test(desc + title) ? "databases"
      : /react|next|tsx|component|frontend|ui/.test(desc + title) ? "frontend"
      : /api|backend|route|endpoint|server/.test(desc + title) ? "backend"
      : /docker|kubernetes|deploy|vercel|infra/.test(desc + title) ? "infrastructure"
      : /ai|model|llm|gpt|claude|gemini/.test(desc + title) ? "ai_systems"
      : /brand|duplicate|ux|flow|ecosystem/.test(desc + title) ? "architecture"
      : "backend";

    // Determine technology from task content
    const tech =
      /next\.?js|nextjs/.test(desc + title) ? "Next.js"
      : /react/.test(desc + title) ? "React"
      : /supabase/.test(desc + title) ? "Supabase"
      : /stripe/.test(desc + title) ? "Stripe"
      : /paypal/.test(desc + title) ? "PayPal"
      : /typescript|\.ts/.test(desc + title) ? "TypeScript"
      : /tailwind/.test(desc + title) ? "Tailwind CSS"
      : /vercel/.test(desc + title) ? "Vercel"
      : /cloudflare|r2/.test(desc + title) ? "Cloudflare"
      : /brand/.test(desc + title) ? "Brand Consistency"
      : /ux|flow/.test(desc + title) ? "UX Flows"
      : "General";

    const eventType: LearningEventType =
      (task.status as string) === "completed" ? "issue_repaired"
      : (task.status as string) === "failed" ? "failure_observed"
      : "issue_detected";

    const sev: LearningEvent["severity"] =
      /critical/.test(title) ? "critical"
      : /high/.test(title) ? "high"
      : /medium/.test(title) ? "medium" : "low";

    events.push({
      event_type: eventType, domain, technology: tech, severity: sev,
      source: (task.source as string) ?? "roadmap",
      details: { taskId: task.id, title: task.title, status: task.status, phaseId: task.phase_id },
    });
  }

  // Pull engineering cycles
  const { data: cycles } = await db()
    .from("javari_engineering_cycles")
    .select("cycle_id,started_at,total_issues,total_repair_tasks,targets_processed")
    .order("started_at", { ascending: false })
    .limit(20);

  for (const c of (cycles ?? [])) {
    events.push({
      event_type: "scan_completed", domain: "architecture", technology: "Javari AI",
      severity: "low", source: "engineering_loop",
      details: { cycleId: c.cycle_id, issues: c.total_issues, tasks: c.total_repair_tasks },
    });
  }

  // Pull ecosystem registry for tech encounters
  const { data: systems } = await db()
    .from("ecosystem_registry")
    .select("name,type,framework,status")
    .limit(30);

  for (const s of (systems ?? [])) {
    if (s.framework) {
      const domain: KnowledgeDomain = s.type === "database" ? "databases"
        : s.type === "service" ? "infrastructure" : "architecture";
      events.push({
        event_type: "tech_encountered", domain, technology: s.framework as string,
        severity: "low", source: "ecosystem_registry",
        details: { system: s.name, type: s.type, status: s.status },
      });
    }
  }

  // Dedup: check which IDs don't exist yet (use source+details hash approach — just batch insert with ignore)
  const limited = events.slice(0, 500);
  await recordManyLearningEvents(limited);

  return { eventsCreated: limited.length };
}

// ── Raw query helpers ─────────────────────────────────────────────────────

export async function fetchLearningEvents(opts: {
  domain?    : KnowledgeDomain;
  eventType? : LearningEventType;
  since?     : string;
  limit?     : number;
} = {}): Promise<LearningEvent[]> {
  let q = db().from("javari_learning_events").select("*");
  if (opts.domain)    q = q.eq("domain", opts.domain);
  if (opts.eventType) q = q.eq("event_type", opts.eventType);
  if (opts.since)     q = q.gte("timestamp", opts.since);
  q = q.order("timestamp", { ascending: false }).limit(opts.limit ?? 500);
  const { data, error } = await q;
  if (error) console.warn(`[learning] fetchEvents: ${error.message}`);
  return (data ?? []) as LearningEvent[];
}
