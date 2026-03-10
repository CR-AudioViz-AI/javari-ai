// lib/planner/autonomousPlanner.ts
// Purpose: Javari Autonomous Planner — generates its own roadmap tasks without human input.
//          Triggered automatically by runRoadmapWorker when pending tasks drop below
//          PLANNER_TRIGGER_THRESHOLD (10). Calls Anthropic API to produce 50 contextually
//          relevant tasks based on completed work, platform goals, and category coverage gaps.
//
// Schema contract:
//   id          : "ap-{phase}-{slug}-{index}" — planner-generated IDs
//   source      : "planner"  (distinct from "roadmap" used by manual ingests)
//   status      : "pending"
//   depends_on  : []         (no cross-task deps — planner tasks are always self-contained)
//
// Safety:
//   - Duplicate title check before every insert (exact match against existing titles)
//   - Max 50 tasks per planner run to prevent runaway inserts
//   - Structured JSON output required from AI — parse failure returns [] (no partial inserts)
//   - Full logging on every code path
//   - Never throws — all errors returned in PlannerResult.errors
//
// Date: 2026-03-10

import { createClient } from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const PLANNER_TRIGGER_THRESHOLD = 10;   // run planner when pending < this
export const PLANNER_BATCH_SIZE        = 50;   // tasks to generate per run
const        PLANNER_MAX_TASKS         = 50;   // hard cap — never insert more than this

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
}

export interface PlannerResult {
  ok:           boolean;
  triggered:    boolean;       // false = threshold not met, planner skipped
  pendingCount: number;        // pending tasks at time of check
  generated:    number;        // tasks AI produced
  inserted:     number;        // tasks actually written to DB
  skipped:      number;        // duplicates skipped
  errors:       string[];
  durationMs:   number;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slug(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-")
    .slice(0, 48);
}

function plannerTaskId(phase: string, title: string, idx: number): string {
  return `ap-${phase.slice(0, 12)}-${slug(title)}-${String(idx).padStart(2, "0")}`;
}

// ── Context builder ───────────────────────────────────────────────────────────
// Summarises what has already been completed so the AI can generate
// genuinely new tasks rather than repeating prior work.

async function buildContext(): Promise<{
  completedTitles:  string[];
  completedByPhase: Record<string, number>;
  pendingTitles:    string[];
  allTitles:        Set<string>;
}> {
  const client = db();

  const { data: completed } = await client
    .from("roadmap_tasks")
    .select("title, phase_id")
    .eq("status", "completed");

  const { data: pending } = await client
    .from("roadmap_tasks")
    .select("title")
    .eq("status", "pending");

  const completedRows = (completed ?? []) as { title: string; phase_id: string }[];
  const pendingRows   = (pending   ?? []) as { title: string }[];

  const completedByPhase: Record<string, number> = {};
  for (const r of completedRows) {
    completedByPhase[r.phase_id] = (completedByPhase[r.phase_id] ?? 0) + 1;
  }

  const completedTitles = completedRows.map(r => r.title);
  const pendingTitles   = pendingRows.map(r => r.title);
  const allTitles       = new Set([...completedTitles, ...pendingTitles]);

  return { completedTitles, completedByPhase, pendingTitles, allTitles };
}

// ── AI task generation ────────────────────────────────────────────────────────

interface AITaskDraft {
  phase_id:    string;
  title:       string;
  description: string;
}

async function generateTasksViaAI(
  completedByPhase: Record<string, number>,
  completedTitles:  string[],
  pendingTitles:    string[],
  targetCount:      number,
  log:              (m: string) => void,
): Promise<AITaskDraft[]> {

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log("[planner] ⚠️  ANTHROPIC_API_KEY not set — cannot call AI");
    return [];
  }

  // Build a compact context summary (keep prompt size reasonable)
  const completedSample = completedTitles.slice(-60).join("\n");
  const pendingSample   = pendingTitles.slice(0, 20).join("\n");

  const phaseBreakdown = CATEGORIES.map(c =>
    `  ${c}: ${completedByPhase[c] ?? 0} completed`
  ).join("\n");

  const systemPrompt = `You are the Javari Autonomous Planner for CR AudioViz AI — a Fortune 50-quality AI platform serving creators, businesses, veterans, first responders, faith communities, and animal rescues.

Your job: generate exactly ${targetCount} NEW roadmap tasks that advance the platform in meaningful, buildable ways.

PLATFORM MISSION: "Your Story. Our Design." — the definitive AI-powered creative ecosystem.

RULES:
1. Return ONLY valid JSON — an array of exactly ${targetCount} task objects. No markdown, no commentary, no backticks.
2. Every task must have: phase_id, title, description
3. phase_id must be one of: ${CATEGORIES.join(", ")}
4. title must be unique — never duplicate any completed or pending title listed below
5. description must be 2-4 sentences, technically specific, actionable, and production-quality
6. Distribute tasks across ALL 10 categories (aim for ~5 per category)
7. Build on completed work — advance each category to the next logical level
8. No vague tasks. Every task must produce a concrete deliverable.

JSON FORMAT (array of objects):
[
  {
    "phase_id": "ai_marketplace",
    "title": "Build AI Agent Performance Leaderboard",
    "description": "Create a public leaderboard ranking all marketplace agents by quality score..."
  }
]`;

  const userPrompt = `COMPLETED TASKS BY CATEGORY:
${phaseBreakdown}

RECENT COMPLETED TITLES (last 60, avoid repeating these):
${completedSample}

CURRENTLY PENDING (do not duplicate):
${pendingSample}

Generate exactly ${targetCount} new tasks as a JSON array. Return ONLY the JSON array. No other text.`;

  log(`[planner] Calling Anthropic API — requesting ${targetCount} tasks`);

  let raw = "";
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
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

    const tokens = data.usage;
    log(`[planner] API response — input=${tokens?.input_tokens ?? "?"} output=${tokens?.output_tokens ?? "?"} tokens`);

    raw = data.content
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("")
      .trim();

  } catch (err) {
    log(`[planner] Anthropic fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  // Parse JSON — strip accidental markdown fences
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
    log(`[planner] Raw response (first 500 chars): ${raw.slice(0, 500)}`);
    return [];
  }

  // Validate structure — drop malformed entries
  const valid = parsed.filter(t => {
    if (!t.phase_id || !t.title || !t.description) {
      log(`[planner] Dropping malformed task: ${JSON.stringify(t).slice(0, 100)}`);
      return false;
    }
    if (!CATEGORIES.includes(t.phase_id as Category)) {
      log(`[planner] Dropping task with invalid phase_id="${t.phase_id}": ${t.title}`);
      return false;
    }
    return true;
  });

  log(`[planner] Valid tasks after structure check: ${valid.length}`);
  return valid;
}

// ── Main planner entry point ──────────────────────────────────────────────────

/**
 * runAutonomousPlanner
 *
 * Called by runRoadmapWorker when pending task count drops below
 * PLANNER_TRIGGER_THRESHOLD. Generates PLANNER_BATCH_SIZE new tasks
 * using the Anthropic API, deduplicates against all existing titles,
 * and inserts the survivors into roadmap_tasks.
 *
 * Never throws. All errors captured in result.errors.
 */
export async function runAutonomousPlanner(): Promise<PlannerResult> {
  const t0     = Date.now();
  const errors: string[] = [];
  const log    = (m: string) => { console.log(m); };

  log("[planner] ══════════════════════════════════");
  log("[planner] Autonomous Planner starting");

  // ── Step 1: Count pending tasks ───────────────────────────────────────────
  const client = db();
  const { data: pendingRows, error: countErr } = await client
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "pending");

  if (countErr) {
    const msg = `[planner] DB count error: ${countErr.message}`;
    log(msg);
    errors.push(msg);
    return { ok: false, triggered: false, pendingCount: -1, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  const pendingCount = pendingRows?.length ?? 0;
  log(`[planner] Pending tasks: ${pendingCount} | Threshold: ${PLANNER_TRIGGER_THRESHOLD}`);

  if (pendingCount >= PLANNER_TRIGGER_THRESHOLD) {
    log(`[planner] Threshold not met — planner skipped`);
    return { ok: true, triggered: false, pendingCount, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  log(`[planner] ⚡ Threshold met (${pendingCount} < ${PLANNER_TRIGGER_THRESHOLD}) — generating ${PLANNER_BATCH_SIZE} tasks`);

  // ── Step 2: Build context ─────────────────────────────────────────────────
  let context: Awaited<ReturnType<typeof buildContext>>;
  try {
    context = await buildContext();
    log(`[planner] Context: ${context.completedTitles.length} completed, ${context.pendingTitles.length} pending, ${context.allTitles.size} total titles`);
    for (const [cat, count] of Object.entries(context.completedByPhase).sort()) {
      log(`[planner]   ${cat}: ${count} completed`);
    }
  } catch (err) {
    const msg = `[planner] Context build failed: ${err instanceof Error ? err.message : String(err)}`;
    log(msg);
    errors.push(msg);
    return { ok: false, triggered: true, pendingCount, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  // ── Step 3: Generate tasks via AI ─────────────────────────────────────────
  const drafts = await generateTasksViaAI(
    context.completedByPhase,
    context.completedTitles,
    context.pendingTitles,
    Math.min(PLANNER_BATCH_SIZE, PLANNER_MAX_TASKS),
    log,
  );

  if (drafts.length === 0) {
    const msg = "[planner] AI returned 0 valid tasks — aborting insert";
    log(msg);
    errors.push(msg);
    return { ok: false, triggered: true, pendingCount, generated: 0, inserted: 0, skipped: 0, errors, durationMs: Date.now() - t0 };
  }

  // ── Step 4: Deduplicate ───────────────────────────────────────────────────
  // Re-fetch all titles right before insert (another cycle may have run)
  const { data: freshRows } = await client
    .from("roadmap_tasks")
    .select("title");
  const freshTitles = new Set((freshRows ?? []).map((r: { title: string }) => r.title));

  // Also deduplicate within the drafts themselves (AI may repeat)
  const seenTitles = new Set<string>();
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

    toInsert.push({
      id:         plannerTaskId(phase, draft.title, idx),
      roadmap_id: null,
      phase_id:   phase,
      title:      draft.title,
      description: draft.description,
      depends_on: [],
      status:     "pending",
      source:     "planner",
      updated_at: Math.floor(Date.now() / 1000),
    });
  }

  const skipped = drafts.length - toInsert.length;
  log(`[planner] After dedup: ${toInsert.length} to insert, ${skipped} skipped`);

  if (toInsert.length === 0) {
    const msg = "[planner] All generated tasks were duplicates — nothing inserted";
    log(msg);
    errors.push(msg);
    return { ok: false, triggered: true, pendingCount, generated: drafts.length, inserted: 0, skipped, errors, durationMs: Date.now() - t0 };
  }

  // ── Step 5: Insert in batches of 25 ──────────────────────────────────────
  let inserted = 0;
  const BATCH = 25;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error: insErr } = await client.from("roadmap_tasks").insert(batch);

    if (insErr) {
      if (insErr.code === "23505" || insErr.message.includes("duplicate")) {
        // Batch had a stale duplicate — insert one-by-one
        for (const row of batch) {
          const { error: e2 } = await client.from("roadmap_tasks").insert(row);
          if (e2) {
            if (e2.code === "23505" || e2.message.includes("duplicate")) {
              log(`[planner] SKIP (race-condition dup): ${row.title.slice(0, 60)}`);
            } else {
              const msg = `[planner] INSERT FAIL: ${row.title.slice(0, 60)} — ${e2.message}`;
              log(msg);
              errors.push(msg);
            }
          } else {
            log(`[planner] ✅ [${row.phase_id}] ${row.title.slice(0, 60)}`);
            inserted++;
          }
        }
      } else {
        const msg = `[planner] BATCH FAIL rows ${i}–${i + BATCH}: ${insErr.message}`;
        log(msg);
        errors.push(msg);
      }
    } else {
      for (const row of batch) {
        log(`[planner] ✅ [${row.phase_id}] ${row.title.slice(0, 60)}`);
      }
      inserted += batch.length;
    }
  }

  // ── Step 6: Summary ───────────────────────────────────────────────────────
  const durationMs = Date.now() - t0;
  log(`[planner] ══ Run complete ══`);
  log(`[planner]   triggered:  ${pendingCount} pending < ${PLANNER_TRIGGER_THRESHOLD}`);
  log(`[planner]   generated:  ${drafts.length}`);
  log(`[planner]   inserted:   ${inserted}`);
  log(`[planner]   skipped:    ${skipped}`);
  log(`[planner]   errors:     ${errors.length}`);
  log(`[planner]   duration:   ${durationMs}ms`);

  return {
    ok:           errors.length === 0 && inserted > 0,
    triggered:    true,
    pendingCount,
    generated:    drafts.length,
    inserted,
    skipped,
    errors,
    durationMs,
  };
}
