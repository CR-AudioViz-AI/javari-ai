// lib/autonomy/engineeringLoop.ts
// Purpose: Javari Autonomous Engineering Loop — orchestrates continuous
//          discovery → analysis → task seeding → verification across all
//          registered targets. This is Javari's core self-improvement engine.
// Date: 2026-03-07
//
// Cycle flow per target:
//   1. ensureTargetsTable   — idempotent migration
//   2. getActiveTargets     — load targets from javari_targets
//   3. crawlSystem          — discovery engine (architecture map)
//   4. analyzeRepo          — code intelligence (issues)
//   5. seedRepairTasks      — inject repair tasks into roadmap_tasks
//   6. runVerificationGate  — verify recently completed repair tasks
//   7. updateLastScan       — record cycle completion timestamp
//   8. persist LoopCycleRecord to javari_engineering_cycles

import { createClient }              from "@supabase/supabase-js";
import { ensureTargetsTable,
         getActiveTargets,
         updateLastScan,
         seedDefaultTargets,
         JavariTarget }              from "./targetRegistry";
import { runScheduler }              from "./scanScheduler";
import { seedRepairTasks }           from "./taskSeeder";
import { runGateForRecentRepairs }   from "./verificationGate";
import { crawlSystem }               from "@/lib/discovery/systemCrawler";
import { analyzeRepo }               from "@/lib/intelligence/codeAnalyzer";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoopOptions {
  maxTargets?       : number;   // default: all active
  maxFilesPerTarget?: number;   // default 80 (stay under cold-start budget)
  injectRepairs?    : boolean;  // default true
  runGate?          : boolean;  // default true
  userId?           : string;
  dryRun?           : boolean;  // if true — analyze only, no DB writes
}

export interface TargetCycleResult {
  targetId         : string;
  targetName       : string;
  targetType       : string;
  discoveryOk      : boolean;
  analysisOk       : boolean;
  issuesFound      : number;
  repairTasksSeeded: number;
  gateResultsCount : number;
  errorMessage?    : string;
  durationMs       : number;
}

export interface LoopCycleRecord {
  cycleId         : string;
  startedAt       : string;
  completedAt     : string;
  targetsProcessed: number;
  totalIssues     : number;
  totalRepairTasks: number;
  gateResults     : number;
  errors          : string[];
  targetResults   : TargetCycleResult[];
  durationMs      : number;
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Cycle record persistence ───────────────────────────────────────────────

async function ensureCyclesTable(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const sql = `
    CREATE TABLE IF NOT EXISTS javari_engineering_cycles (
      cycle_id          text        PRIMARY KEY,
      started_at        timestamptz NOT NULL,
      completed_at      timestamptz,
      targets_processed integer     DEFAULT 0,
      total_issues      integer     DEFAULT 0,
      total_repair_tasks integer    DEFAULT 0,
      gate_results      integer     DEFAULT 0,
      errors            jsonb       DEFAULT '[]',
      target_results    jsonb       DEFAULT '[]',
      duration_ms       integer,
      created_at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_jec_started_at ON javari_engineering_cycles (started_at DESC);
    ALTER TABLE javari_engineering_cycles DISABLE ROW LEVEL SECURITY;
    GRANT ALL ON TABLE javari_engineering_cycles TO service_role, authenticated, anon;
  `.trim();

  for (const rpc of ["/rest/v1/rpc/exec_sql", "/rest/v1/rpc/query"]) {
    try {
      const r = await fetch(`${url}${rpc}`, {
        method : "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body   : JSON.stringify({ query: sql }),
        signal : AbortSignal.timeout(10_000),
      });
      if (r.ok) return;
    } catch { /* try next */ }
  }
}

async function persistCycleRecord(record: LoopCycleRecord): Promise<void> {
  try {
    await db().from("javari_engineering_cycles").upsert({
      cycle_id          : record.cycleId,
      started_at        : record.startedAt,
      completed_at      : record.completedAt,
      targets_processed : record.targetsProcessed,
      total_issues      : record.totalIssues,
      total_repair_tasks: record.totalRepairTasks,
      gate_results      : record.gateResults,
      errors            : record.errors,
      target_results    : record.targetResults,
      duration_ms       : record.durationMs,
    }, { onConflict: "cycle_id" });
  } catch (e) {
    console.error("[engineeringLoop] Failed to persist cycle record:", String(e));
  }
}

// ── Per-target processor ───────────────────────────────────────────────────

async function processTarget(
  target : JavariTarget,
  options: LoopOptions,
  cycleId: string
): Promise<TargetCycleResult> {
  const t0 = Date.now();
  const result: TargetCycleResult = {
    targetId : target.id, targetName: target.name, targetType: target.type,
    discoveryOk: false, analysisOk: false,
    issuesFound: 0, repairTasksSeeded: 0, gateResultsCount: 0,
    durationMs: 0,
  };

  try {
    console.log(`[engineeringLoop] ▶ Processing ${target.name} (${target.type})`);

    // ── Phase 1: Discovery ─────────────────────────────────────────────────
    if (target.type === "repo" || target.type === "service") {
      const crawlInput = target.type === "repo"
        ? { target: "repo" as const, repo: target.location, branch: target.branch ?? "main", injectTasks: !options.dryRun }
        : { target: "url" as const, url: target.location, injectTasks: !options.dryRun };

      const crawlResult = await crawlSystem(crawlInput);
      result.discoveryOk = crawlResult.ok;
      if (!crawlResult.ok) {
        result.errorMessage = `Discovery failed: ${crawlResult.error}`;
        console.warn(`[engineeringLoop] Discovery failed for ${target.name}: ${crawlResult.error}`);
      } else {
        console.log(`[engineeringLoop] Discovery ok: ${crawlResult.report?.fileCount ?? 0} files`);
      }
    } else {
      // website / api — use URL crawl
      const crawlResult = await crawlSystem({
        target: "url", url: target.location, injectTasks: !options.dryRun,
      });
      result.discoveryOk = crawlResult.ok;
    }

    // ── Phase 2: Code Intelligence (repo targets only) ─────────────────────
    if (target.type === "repo") {
      const analysisResult = await analyzeRepo({
        repo        : target.location,
        branch      : target.branch ?? "main",
        maxFiles    : options.maxFilesPerTarget ?? 80,
        injectTasks : false,  // we seed manually below for better control
        userId      : options.userId ?? "system",
      });

      result.analysisOk  = true;
      result.issuesFound = analysisResult.summary.total;

      console.log(`[engineeringLoop] Analysis: ${analysisResult.summary.total} issues (${analysisResult.summary.critical} critical, ${analysisResult.summary.high} high)`);

      // ── Phase 3: Seed repair tasks ────────────────────────────────────
      if (options.injectRepairs !== false && !options.dryRun && analysisResult.issues.length > 0) {
        const seedResult = await seedRepairTasks(
          analysisResult.issues, target, cycleId,
          { minSeverity: "high", maxTasksPerCycle: 10 }
        );
        result.repairTasksSeeded = seedResult.tasksCreated;
        console.log(`[engineeringLoop] Seeded ${seedResult.tasksCreated} repair tasks`);
      }
    }

    // ── Phase 4: Verification gate on recent completions ──────────────────
    if (options.runGate !== false && !options.dryRun) {
      const gateResults = await runGateForRecentRepairs(60); // last 60 min
      result.gateResultsCount = gateResults.length;
      const failed = gateResults.filter(g => g.status === "rollback_queued").length;
      if (failed > 0) {
        console.warn(`[engineeringLoop] ${failed} repair(s) failed gate — rollback tasks created`);
      }
    }

    // ── Phase 5: Update last scan ──────────────────────────────────────────
    if (!options.dryRun) {
      await updateLastScan(target.id);
    }

  } catch (err) {
    result.errorMessage = String(err);
    console.error(`[engineeringLoop] Target ${target.id} error: ${err}`);
  }

  result.durationMs = Date.now() - t0;
  return result;
}

// ── Main loop ──────────────────────────────────────────────────────────────

export async function runEngineeringLoop(
  options: LoopOptions = {}
): Promise<LoopCycleRecord> {
  const t0      = Date.now();
  const cycleId = `cycle-${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log(`[engineeringLoop] ═══ Starting cycle ${cycleId} ═══`);

  // Bootstrap
  await ensureCyclesTable();
  const migResult = await ensureTargetsTable();
  console.log(`[engineeringLoop] Table migration: ${migResult.message}`);

  // Seed default targets if none exist
  const seeded = await seedDefaultTargets();
  if (seeded > 0) console.log(`[engineeringLoop] Seeded ${seeded} default targets`);

  // Load targets
  const allTargets = await getActiveTargets();
  const targets    = allTargets.slice(0, options.maxTargets ?? allTargets.length);
  console.log(`[engineeringLoop] ${targets.length} active targets`);

  // Also run scheduler to queue any due scans
  if (!options.dryRun) {
    const schedResult = await runScheduler(
      allTargets.filter(t => t.type === "repo")
    );
    console.log(`[engineeringLoop] Scheduler: ${schedResult.tasksCreated} scan tasks queued`);
  }

  // Process each target
  const targetResults: TargetCycleResult[] = [];
  const errors: string[] = [];

  for (const target of targets) {
    const result = await processTarget(target, options, cycleId);
    targetResults.push(result);
    if (result.errorMessage) errors.push(`${target.id}: ${result.errorMessage}`);
  }

  const record: LoopCycleRecord = {
    cycleId,
    startedAt,
    completedAt     : new Date().toISOString(),
    targetsProcessed: targetResults.length,
    totalIssues     : targetResults.reduce((s, r) => s + r.issuesFound, 0),
    totalRepairTasks: targetResults.reduce((s, r) => s + r.repairTasksSeeded, 0),
    gateResults     : targetResults.reduce((s, r) => s + r.gateResultsCount, 0),
    errors,
    targetResults,
    durationMs      : Date.now() - t0,
  };

  await persistCycleRecord(record);

  console.log(`[engineeringLoop] ═══ Cycle complete: ${record.targetsProcessed} targets, ${record.totalIssues} issues, ${record.totalRepairTasks} repair tasks, ${record.durationMs}ms ═══`);

  return record;
}
