// lib/planner/autonomousPlanner.ts
// Purpose: Javari Autonomous Planner — generates roadmap tasks without human input.
//          Phase 6 upgrade: tasks include full artifact metadata (type, module, artifacts[]).
//          Workers use metadata to route tasks to the correct pipeline.
//          Triggered automatically by runRoadmapWorker when pending tasks drop below
//          PLANNER_TRIGGER_THRESHOLD (10). Calls Anthropic API to produce 50 contextually
//          relevant tasks based on completed work, canonical docs, and knowledge graph.
//
// Schema contract:
//   id          : "ap-{phase}-{slug}-{index}" — planner-generated IDs
//   source      : "planner"
//   status      : "pending"
//   depends_on  : []  (planner tasks are self-contained)
//   metadata    : { type, module, artifacts, description }
//
// Safety:
//   - Duplicate title check before every insert
//   - Max 50 tasks per run
//   - Structured JSON output required — parse failure returns [] (no partial inserts)
//   - Never throws — all errors in PlannerResult.errors
//
// Date: 2026-03-10

import { createClient } from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const PLANNER_TRIGGER_THRESHOLD = 10;
export const PLANNER_BATCH_SIZE        = 50;
const        PLANNER_MAX_TASKS         = 50;

const CATEGORIES = [
  "ai_marketplace",
  "creator_monetization",
  "multi_ai_team_mode",
  "craiverse_modules",
  "enterprise_integrations",
  "community_systems",
  "autonomous_deployment",
  "platform_scaling",
  "security_infrastructure",
  "global_payments",
] as const;

type Category = typeof CATEGORIES[number];

// Artifact types the engineer can build — used in task metadata
const ARTIFACT_TYPES = [
  "build_module",
  "generate_api",
  "create_service",
  "create_database_migration",
  "deploy_microservice",
  "generate_ui_component",
  "generate_documentation",
  "generate_tests",
] as const;

type ArtifactTypeEnum = typeof ARTIFACT_TYPES[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlannedTask {
  id:          string;
  roadmap_id:  null;
  phase_id:    Category;
  title:       string;
  description: string;
  depends_on:  string[];
  status:      "pending";
  source:      "planner";
  updated_at:  number;
  metadata:    {
    type       : ArtifactTypeEnum;
    module     : string;
    artifacts  : string[];
    phase_id   : Category;
    description: string;
  };
}

export interface PlannerResult {
  ok:           boolean;
  triggered:    boolean;
  pendingCount: number;
  generated:    number;
  inserted:     number;
  skipped:      number;
  errors:       string[];
  durationMs:   number;
  canonicalContext?: {
    docsRead:  number;
    nodesRead: number;
  };
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-")
    .slice(0, 48);
}

function plannerTaskId(phase: string, title: string, idx: number): string {
  return `ap-${phase.slice(0, 12)}-${slug(title)}-${String(idx).padStart(2, "0")}`;
}

// Infer the best artifact type from the task title and description
function inferArtifactType(title: string, description: string): ArtifactTypeEnum {
  const combined = `${title} ${description}`.toLowerCase();
  if (/migration|schema|table|database|sql/.test(combined)) return "create_database_migration";
  if (/api route|create.api|endpoint|route/.test(combined))  return "generate_api";
  if (/ui component|react|component|frontend/.test(combined)) return "generate_ui_component";
  if (/test|spec|coverage|jest/.test(combined))               return "generate_tests";
  if (/document|readme|wiki|doc/.test(combined))              return "generate_documentation";
  if (/service|worker|daemon/.test(combined))                 return "create_service";
  if (/deploy|microservice|release/.test(combined))           return "deploy_microservice";
  return "build_module";
}

// ── Context builder ───────────────────────────────────────────────────────────

interface PlannerContext {
  completedTitles:  string[];
  completedByPhase: Record<string, number>;
  pendingTitles:    string[];
  allTitles:        Set<string>;
  canonicalDocs:    Array<{ title: string; content: string }>;
  knowledgeNodes:   Array<{ label: string; node_type: string; description?: string }>;
}

async function buildContext(): Promise<PlannerContext> {
  const client = db();

  const [completedRes, pendingRes, canonicalRes, nodesRes] = await Promise.all([
    client.from("roadmap_tasks").select("title, phase_id").eq("status", "completed"),
    client.from("roadmap_tasks").select("title").eq("status", "pending"),
    client.from("canonical_docs").select("title, content").limit(15),
    client.from("knowledge_graph_nodes").select("label, node_type, description").limit(40),
  ]);

  const completedRows  = (completedRes.data  ?? []) as { title: string; phase_id: string }[];
  const pendingRows    = (pendingRes.data    ?? []) as { title: string }[];
  const canonicalDocs  = (canonicalRes.data  ?? []) as { title: string; content: string }[];
  const knowledgeNodes = (nodesRes.data      ?? []) as { label: string; node_type: string; description?: string }[];

  const completedByPhase: Record<string, number> = {};
  for (const r of completedRows) {
    completedByPhase[r.phase_id] = (completedByPhase[r.phase_id] ?? 0) + 1;
  }

  const completedTitles = completedRows.map(r => r.title);
  const pendingTitles   = pendingRows.map(r => r.title);
  const allTitles       = new Set([...completedTitles, ...pendingTitles]);

  return { completedTitles, completedByPhase, pendingTitles, allTitles, canonicalDocs, knowledgeNodes };
}

// ── AI task generation ────────────────────────────────────────────────────────

interface AITaskDraft {
  phase_id   : string;
  type       : string;
  module     : string;
  title      : string;
  description: string;
  artifacts  : string[];
}

async function generateTasksViaAI(
  context    : PlannerContext,
  targetCount: number,
  log        : (m: string) => void,
): Promise<AITaskDraft[]> {

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log("[planner] ⚠️  ANTHROPIC_API_KEY not set — cannot call AI");
    return [];
  }

  const completedSample = context.completedTitles.slice(-60).join("\n");
  const pendingSample   = context.pendingTitles.slice(0, 20).join("\n");

  const phaseBreakdown = CATEGORIES.map(c =>
    `  ${c}: ${context.completedByPhase[c] ?? 0} completed`
  ).join("\n");

  const canonicalSection = context.canonicalDocs.length > 0
    ? `\nCANONICAL DOCUMENTATION (derive tasks directly from these):\n` +
      context.canonicalDocs.map(d => `[${d.title}]: ${(d.content ?? "").slice(0, 250)}`).join("\n\n")
    : "";

  const knowledgeSection = context.knowledgeNodes.length > 0
    ? `\nKNOWLEDGE GRAPH NODES:\n` +
      context.knowledgeNodes.map(n => `${n.node_type}: ${n.label}${n.description ? ` — ${n.description.slice(0, 80)}` : ""}`).join("\n")
    : "";

  const systemPrompt = `You are the Javari Autonomous Planner for CR AudioViz AI — Fortune 50-quality AI ecosystem.
Mission: "Your Story. Our Design."

Your job: generate exactly ${targetCount} NEW roadmap tasks that produce real, deployable platform artifacts.

PLATFORM CATEGORIES (use as phase_id):
${CATEGORIES.join(", ")}

ARTIFACT TYPES (use as type — determines which builder runs):
build_module, generate_api, create_service, create_database_migration,
deploy_microservice, generate_ui_component, generate_documentation, generate_tests

RULES:
1. Return ONLY valid JSON — an array of exactly ${targetCount} objects. No markdown, no backticks.
2. Every task MUST have: phase_id, type, module, title, description, artifacts
3. phase_id must be one of the platform categories above
4. type must be one of the artifact types above
5. module = short name of the platform module being built (e.g. "creator_tools", "javari_chat")
6. artifacts = array of deliverable names (e.g. ["api", "ui", "tests"] or ["migration", "api"])
7. title must be unique — never duplicate completed or pending titles
8. description: 2-3 sentences, technically specific, references canonical docs when available
9. Distribute across ALL 10 categories (5 tasks each)
10. Every task must produce a concrete, committed, deployable artifact

JSON FORMAT:
[
  {
    "phase_id": "ai_marketplace",
    "type": "generate_api",
    "module": "agent_marketplace",
    "title": "Build Agent Performance Leaderboard API",
    "description": "Create a Next.js 14 API route that queries the marketplace agents table, calculates quality scores from execution_logs, and returns paginated rankings. Supports filtering by category and time range.",
    "artifacts": ["api", "tests"]
  }
]`;

  const userPrompt = `COMPLETED TASKS BY CATEGORY:
${phaseBreakdown}
${canonicalSection}
${knowledgeSection}

RECENT COMPLETED (avoid duplicating):
${completedSample}

CURRENTLY PENDING (do not duplicate):
${pendingSample}

Generate exactly ${targetCount} new artifact tasks as a JSON array. Return ONLY the JSON array.`;

  log(`[planner] Calling Anthropic API — ${targetCount} artifact tasks (canonical=${context.canonicalDocs.length}, nodes=${context.knowledgeNodes.length})`);

  let raw = "";
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method : "POST",
      headers: {
        "Content-Type"     : "application/json",
        "x-api-key"        : apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model     : "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system    : systemPrompt,
        messages  : [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      log(`[planner] Anthropic API error ${response.status}: ${errText.slice(0, 200)}`);
      return [];
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    log(`[planner] API response — in=${data.usage?.input_tokens ?? "?"} out=${data.usage?.output_tokens ?? "?"} tokens`);

    raw = data.content
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("")
      .trim();

  } catch (err) {
    log(`[planner] Anthropic fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  let parsed: AITaskDraft[] = [];
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned) as AITaskDraft[];
    if (!Array.isArray(parsed)) throw new Error("Response is not an array");
    log(`[planner] AI produced ${parsed.length} task drafts`);
  } catch (err) {
    log(`[planner] JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    log(`[planner] Raw[0:400]: ${raw.slice(0, 400)}`);
    return [];
  }

  // Validate structure
  const valid = parsed.filter(t => {
    if (!t.phase_id || !t.title || !t.description) {
      log(`[planner] Dropping malformed task: ${JSON.stringify(t).slice(0, 80)}`);
      return false;
    }
    if (!CATEGORIES.includes(t.phase_id as Category)) {
      // Attempt to fix — use closest match or default
      t.phase_id = "autonomous_deployment";
    }
    if (!ARTIFACT_TYPES.includes(t.type as ArtifactTypeEnum)) {
      // Infer from title/description
      t.type = inferArtifactType(t.title, t.description);
    }
    return true;
  });

  log(`[planner] Valid tasks after structure check: ${valid.length}`);
  return valid;
}

// ── Main planner entry point ──────────────────────────────────────────────────

export async function runAutonomousPlanner(): Promise<PlannerResult> {
  const t0     = Date.now();
  const errors: string[] = [];
  const log    = (m: string) => { console.log(m); };

  log("[planner] ══════════════════════════════════");
  log("[planner] Autonomous Planner starting (ecosystem mode with artifact metadata)");

  const client = db();

  // ── Step 1: Count pending tasks ───────────────────────────────────────────
  const { data: pendingRows, error: countErr } = await client
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "pending");

  if (countErr) {
    const msg = `[planner] DB count error: ${countErr.message}`;
    log(msg); errors.push(msg);
    return { ok: false, triggered: false, pendingCount: -1, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  const pendingCount = pendingRows?.length ?? 0;
  log(`[planner] Pending tasks: ${pendingCount} | Threshold: ${PLANNER_TRIGGER_THRESHOLD}`);

  if (pendingCount >= PLANNER_TRIGGER_THRESHOLD) {
    log("[planner] Threshold not met — planner skipped");
    return { ok: true, triggered: false, pendingCount, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  log(`[planner] ⚡ Threshold met (${pendingCount} < ${PLANNER_TRIGGER_THRESHOLD}) — generating ${PLANNER_BATCH_SIZE} artifact tasks`);

  // ── Step 2: Build context ─────────────────────────────────────────────────
  let context: PlannerContext;
  try {
    context = await buildContext();
    log(`[planner] Context: ${context.completedTitles.length} completed, ${context.pendingTitles.length} pending`);
    log(`[planner] Canonical: ${context.canonicalDocs.length} docs, ${context.knowledgeNodes.length} KG nodes`);
  } catch (err) {
    const msg = `[planner] Context build failed: ${err instanceof Error ? err.message : String(err)}`;
    log(msg); errors.push(msg);
    return { ok: false, triggered: true, pendingCount, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  // ── Step 3: Generate tasks via AI ─────────────────────────────────────────
  const drafts = await generateTasksViaAI(
    context,
    Math.min(PLANNER_BATCH_SIZE, PLANNER_MAX_TASKS),
    log,
  );

  if (drafts.length === 0) {
    const msg = "[planner] AI returned 0 valid tasks — aborting insert";
    log(msg); errors.push(msg);
    return {
      ok: false, triggered: true, pendingCount, generated: 0, inserted: 0, skipped: 0, errors,
      durationMs: Date.now() - t0,
      canonicalContext: { docsRead: context.canonicalDocs.length, nodesRead: context.knowledgeNodes.length },
    };
  }

  // ── Step 4: Deduplicate ───────────────────────────────────────────────────
  const { data: freshRows } = await client.from("roadmap_tasks").select("title");
  const freshTitles = new Set((freshRows ?? []).map((r: { title: string }) => r.title));

  const seenTitles    = new Set<string>();
  const toInsert: PlannedTask[] = [];
  const phaseCounters: Record<string, number> = {};

  for (const draft of drafts) {
    if (freshTitles.has(draft.title) || seenTitles.has(draft.title)) {
      log(`[planner] SKIP duplicate: "${draft.title.slice(0, 60)}"`);
      continue;
    }
    seenTitles.add(draft.title);

    const phase = draft.phase_id as Category;
    const idx   = phaseCounters[phase] ?? 0;
    phaseCounters[phase] = idx + 1;

    const artifactType = (ARTIFACT_TYPES.includes(draft.type as ArtifactTypeEnum)
      ? draft.type
      : inferArtifactType(draft.title, draft.description)) as ArtifactTypeEnum;

    toInsert.push({
      id:          plannerTaskId(phase, draft.title, idx),
      roadmap_id:  null,
      phase_id:    phase,
      title:       draft.title,
      description: `[type:${artifactType}] ${draft.description}`,
      depends_on:  [],
      status:      "pending",
      source:      "planner",
      updated_at:  Math.floor(Date.now() / 1000),
      metadata: {
        type       : artifactType,
        module     : draft.module || phase,
        artifacts  : Array.isArray(draft.artifacts) ? draft.artifacts : ["artifact"],
        phase_id   : phase,
        description: draft.description,
      },
    });
  }

  const skipped = drafts.length - toInsert.length;
  log(`[planner] After dedup: ${toInsert.length} to insert, ${skipped} skipped`);

  if (toInsert.length === 0) {
    const msg = "[planner] All generated tasks were duplicates — nothing inserted";
    log(msg); errors.push(msg);
    return {
      ok: false, triggered: true, pendingCount, generated: drafts.length, inserted: 0, skipped, errors,
      durationMs: Date.now() - t0,
      canonicalContext: { docsRead: context.canonicalDocs.length, nodesRead: context.knowledgeNodes.length },
    };
  }

  // ── Step 5: Insert in batches of 25 ──────────────────────────────────────
  let inserted = 0;
  const BATCH  = 25;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error: insErr } = await client.from("roadmap_tasks").insert(batch);

    if (insErr) {
      if (insErr.code === "23505" || insErr.message.includes("duplicate")) {
        for (const row of batch) {
          const { error: e2 } = await client.from("roadmap_tasks").insert(row);
          if (!e2) {
            log(`[planner] ✅ [${row.phase_id}|${row.metadata.type}] ${row.title.slice(0, 55)}`);
            inserted++;
          }
        }
      } else {
        const msg = `[planner] BATCH FAIL ${i}–${i + BATCH}: ${insErr.message}`;
        log(msg); errors.push(msg);
      }
    } else {
      for (const row of batch) {
        log(`[planner] ✅ [${row.phase_id}|${row.metadata.type}] ${row.title.slice(0, 55)}`);
      }
      inserted += batch.length;
    }
  }

  const durationMs = Date.now() - t0;
  log(`[planner] ══ Run complete ══`);
  log(`[planner]   mode:        ecosystem (artifact metadata)`);
  log(`[planner]   generated:   ${drafts.length}`);
  log(`[planner]   inserted:    ${inserted}`);
  log(`[planner]   skipped:     ${skipped}`);
  log(`[planner]   errors:      ${errors.length}`);
  log(`[planner]   duration:    ${durationMs}ms`);

  return {
    ok:           errors.length === 0 && inserted > 0,
    triggered:    true,
    pendingCount,
    generated:    drafts.length,
    inserted,
    skipped,
    errors,
    durationMs,
    canonicalContext: { docsRead: context.canonicalDocs.length, nodesRead: context.knowledgeNodes.length },
  };
}
