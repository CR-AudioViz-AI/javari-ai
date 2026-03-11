// lib/execution/roadmapWorker.ts
// Purpose: Autonomous roadmap worker — one verified cycle per invocation.
//          UPGRADED: Phase 8 — uses artifactExecutor for artifact-generating tasks.
//          Tasks classified as build artifacts go through the AI Build Team pipeline
//          (architect → engineer → validator → documenter → GitHub commit → Vercel deploy).
//          All other tasks continue through the existing runTypedTask path.
//
// Lifecycle per task:
//   pending/retry → in_progress → [artifact pipeline OR typed executor] → verifying → completed | retry | blocked
//   ONLY the verifier may write status=completed. No exceptions.
//
// Safety limits per cycle:
//   MAX_TASKS       = 20  cap per invocation
//   MAX_CONSEC_FAILS = 3  stop cycle if 3 tasks in a row fail verification
//
// Date: 2026-03-10

import { createClient }   from "@supabase/supabase-js";
import { executeTask as runTypedTask, ExecutableTask } from "./taskExecutor";
import { executeArtifact, type ArtifactTask }          from "./artifactExecutor";
import { verifyTask }     from "@/lib/roadmap/verifyTask";
import { runGuardrails }  from "./guardrails";
import { acquireTaskLock, startHeartbeat } from "./persistence";
import { runAutonomousPlanner, PLANNER_TRIGGER_THRESHOLD, type PlannerResult } from "@/lib/planner/autonomousPlanner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TaskTelemetry {
  taskId        : string;
  taskTitle     : string;
  taskType      : string;
  routingHint   : "quality" | "cost";
  executionMs   : number;
  artifactCount : number;
  verdict       : "completed" | "retry" | "blocked";
  failReason?   : string;
  checks        : Array<{ name: string; pass: boolean }>;
  estimatedCost : number;
  // artifact pipeline fields
  usedArtifactPipeline? : boolean;
  commitSha?            : string;
  deploymentUrl?        : string;
  buildArtifactId?      : string;
}

export interface WorkerCycleResult {
  ok              : boolean;
  cycleId         : string;
  tasksExecuted   : number;
  tasksCompleted  : number;
  tasksRetried    : number;
  tasksBlocked    : number;
  totalCostUsd    : number;
  consecutiveFails: number;
  telemetry       : TaskTelemetry[];
  stoppedReason   : "no_pending" | "max_tasks" | "consecutive_failures" | "guardrail";
  durationMs      : number;
  planner?        : PlannerResult;
  artifactBuilds? : number;   // tasks handled by artifact pipeline this cycle
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_TASKS    = 20;
const MAX_CONSEC   = 3;
const PREVIEW_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

// Artifact pipeline task types — these go through the AI Build Team
const ARTIFACT_TYPES = new Set([
  "build_module",
  "generate_api",
  "create_service",
  "create_database_migration",
  "deploy_microservice",
  "generate_ui_component",
  "generate_documentation",
  "generate_tests",
  // App builder — full Next.js service generation
  "build_app",
  // Default fallback — ALL tasks produce artifacts in ecosystem mode
  "ai_task",
  // planner-generated artifact metadata tags
  "build_module_artifact",
  "generate_api_artifact",
  "ecosystem_artifact",
]);

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Task type resolver ─────────────────────────────────────────────────────
// Extract task type from task description metadata tag or title keywords.

function resolveTaskType(task: { type?: string; title: string; description: string }): string {
  // Explicit type field from planner metadata
  if (task.type && task.type !== "ai_task") return task.type;

  // Metadata tag embedded in description by autonomousPlanner
  const tagMatch = task.description?.match(/\[type:([^\]]+)\]/);
  if (tagMatch) return tagMatch[1].trim();

  // Keyword-based classification from title + description
  const combined = `${task.title} ${task.description}`.toLowerCase();
  if (/migration|schema|create.table|database/.test(combined)) return "create_database_migration";
  if (/api route|route\.ts|generate.api|endpoint/.test(combined))  return "generate_api";
  if (/ui component|react component|\.tsx|frontend/.test(combined)) return "generate_ui_component";
  if (/test|spec|jest|coverage/.test(combined))                     return "generate_tests";
  if (/documentation|readme|\.md|wiki/.test(combined))              return "generate_documentation";
  if (/microservice|deploy.service/.test(combined))                 return "deploy_microservice";
  if (/service|worker|daemon/.test(combined))                       return "create_service";
  if (/build|create|develop|design|implement|launch|establish|deploy|add|enable/.test(combined)) return "build_module";
  return "build_module"; // Default: ALL ecosystem tasks produce a build_module artifact
}

// ── Routing: task type → model priority ──────────────────────────────────

function routingHint(type: string): "quality" | "cost" {
  switch (type) {
    case "build_module":
    case "create_api":
    case "generate_api":
    case "update_schema":
    case "create_database_migration":
    case "deploy_feature":
    case "deploy_microservice":
    case "generate_ui_component":
    case "create_service":
      return "quality";
    default:
      return "cost";
  }
}

// ── Fetch next executable task ────────────────────────────────────────────

async function fetchNext(): Promise<ExecutableTask | null> {
  const client = db();

  const { data, error } = await client
    .from("roadmap_tasks")
    .select("id, title, description, source, depends_on, metadata")
    .eq("status", "pending")
    .limit(25);

  if (error) {
    console.error(`[worker] fetchNext DB error: ${error.message}`);
    return null;
  }
  if (!data?.length) {
    console.log("[worker] fetchNext: 0 pending tasks in DB");
    return null;
  }

  console.log(`[worker] fetchNext: ${data.length} pending candidates`);

  const { data: done } = await client.from("roadmap_tasks").select("id").eq("status", "completed");
  const { data: allIds } = await client.from("roadmap_tasks").select("id");

  const doneSet  = new Set((done ?? []).map((r: { id: string }) => r.id));
  const allIdSet = new Set((allIds ?? []).map((r: { id: string }) => r.id));

  for (const row of data as Array<{
    id: string; title: string; description: string;
    source?: string; depends_on?: string[] | null; metadata?: Record<string, unknown>;
  }>) {
    const deps = row.depends_on ?? [];
    const realDeps  = deps.filter((d: string) => allIdSet.has(d));
    const unmetReal = realDeps.filter((d: string) => !doneSet.has(d));

    if (deps.length > 0 && deps.length !== realDeps.length) {
      const orphaned = deps.filter((d: string) => !allIdSet.has(d));
      console.log(`[worker] ${row.id}: ${orphaned.length} orphaned dep(s) ignored`);
    }

    if (unmetReal.length === 0) {
      const resolvedType = resolveTaskType({
        type: (row.metadata as Record<string, unknown>)?.type as string,
        title: row.title,
        description: row.description,
      });
      console.log(`[worker] fetchNext: selected ${row.id} | type=${resolvedType} | ${row.title.slice(0,60)}`);
      return {
        id         : row.id,
        title      : row.title,
        description: row.description,
        type       : resolvedType,
        metadata   : row.metadata as ExecutableTask["metadata"],
      };
    }
  }

  console.log("[worker] fetchNext: all candidates blocked by unmet deps");
  return null;
}

// ── Status helpers ─────────────────────────────────────────────────────────

async function setStatus(
  id    : string,
  status: "in_progress" | "verifying" | "completed" | "retry" | "blocked",
  extra?: { result?: string; error?: string }
): Promise<void> {
  const upd: Record<string, unknown> = { status, updated_at: Date.now() };
  if (extra?.result) upd.result = extra.result;
  if (extra?.error)  upd.error  = extra.error;
  await db().from("roadmap_tasks").update(upd).eq("id", id);
}

// ── Cycle telemetry writer ─────────────────────────────────────────────────

async function writeCycleLog(cycleId: string, result: WorkerCycleResult): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    await fetch(`${url}/rest/v1/javari_execution_logs`, {
      method : "POST",
      headers: {
        "Content-Type" : "application/json",
        "apikey"       : key,
        "Authorization": `Bearer ${key}`,
        "Prefer"       : "return=minimal",
      },
      body: JSON.stringify({
        execution_id  : cycleId,
        task_id       : `cycle:${cycleId}`,
        model_used    : "roadmap_worker_v2",
        cost          : result.totalCostUsd,
        tokens_in     : 0,
        tokens_out    : 0,
        execution_time: result.durationMs,
        status        : result.ok ? "success" : "failed",
        error_message : result.stoppedReason === "consecutive_failures"
          ? `Stopped: ${MAX_CONSEC} consecutive failures`
          : null,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-blocking */ }
}

// ══════════════════════════════════════════════════════════════════
// runRoadmapWorker — one complete autonomous cycle
// ══════════════════════════════════════════════════════════════════

export async function runRoadmapWorker(
  userId  : string = "worker",
  maxTasks: number = MAX_TASKS
): Promise<WorkerCycleResult> {
  const cycleStart = Date.now();
  const cycleId    = `wc-${cycleStart}-${Math.random().toString(36).slice(2, 6)}`;
  const cap        = Math.min(maxTasks, MAX_TASKS);

  let executed = 0, completed = 0, retried = 0, blocked = 0, artifactBuilds = 0;
  let consecutiveFails = 0;
  let totalCost = 0;
  const telemetry: TaskTelemetry[] = [];

  console.log(`[worker] ▶ Cycle ${cycleId} | cap=${cap} | userId=${userId} | ecosystem mode`);

  // ── Autonomous Planner gate ────────────────────────────────────────────
  let plannerResult: PlannerResult | undefined;
  try {
    const { data: pendingSnap } = await db()
      .from("roadmap_tasks")
      .select("id")
      .eq("status", "pending");

    const pendingNow = pendingSnap?.length ?? 0;
    console.log(`[worker] DB pending count at cycle start: ${pendingNow}`);

    if (pendingNow < PLANNER_TRIGGER_THRESHOLD) {
      console.log(`[worker] 🧠 Planner trigger: ${pendingNow} pending < ${PLANNER_TRIGGER_THRESHOLD}`);
      plannerResult = await runAutonomousPlanner();
      console.log(
        `[worker] 🧠 Planner done — ` +
        `triggered=${plannerResult.triggered} inserted=${plannerResult.inserted} ` +
        `generated=${plannerResult.generated} ok=${plannerResult.ok} ${plannerResult.durationMs}ms`
      );
      if (!plannerResult.ok && plannerResult.errors.length > 0) {
        console.warn(`[worker] Planner errors: ${plannerResult.errors.join("; ")}`);
      }
    } else {
      console.log(`[worker] Planner gate: ${pendingNow} pending ≥ ${PLANNER_TRIGGER_THRESHOLD} — skipped`);
    }
  } catch (planErr) {
    console.error(`[worker] Planner gate exception (non-fatal): ${planErr instanceof Error ? planErr.message : String(planErr)}`);
  }

  while (executed < cap) {
    if (consecutiveFails >= MAX_CONSEC) {
      console.warn(`[worker] ⛔ ${MAX_CONSEC} consecutive verification failures — stopping`);
      const result: WorkerCycleResult = {
        ok: false, cycleId, tasksExecuted: executed, tasksCompleted: completed,
        tasksRetried: retried, tasksBlocked: blocked, totalCostUsd: totalCost,
        consecutiveFails, telemetry, stoppedReason: "consecutive_failures",
        durationMs: Date.now() - cycleStart, planner: plannerResult, artifactBuilds,
      };
      await writeCycleLog(cycleId, result);
      return result;
    }

    const task = await fetchNext();
    if (!task) {
      console.log(`[worker] fetchNext returned null — stopping cycle (executed=${executed})`);
      break;
    }

    executed++;
    const taskStart = Date.now();
    const taskType  = task.type ?? "ai_task";
    const hint      = routingHint(taskType);
    const useArtifactPipeline = ARTIFACT_TYPES.has(taskType);

    console.log(
      `[worker] [${executed}/${cap}] ${task.id} | type=${taskType} | ` +
      `pipeline=${useArtifactPipeline ? "ARTIFACT" : "typed"} | ${task.title.slice(0, 50)}`
    );

    // ── Lock ──────────────────────────────────────────────────────────────
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const locked = await acquireTaskLock(task.id, executionId).catch(() => false);
    if (!locked) {
      console.log(`[worker] ${task.id} locked by concurrent executor — skipping`);
      executed--;
      continue;
    }
    const stopHeartbeat = startHeartbeat(task.id);

    try {
      // ── Guardrails ───────────────────────────────────────────────────────
      const guardrail = await runGuardrails({
        taskId: task.id, executionId,
        taskTitle: task.title,
        estimatedCost: useArtifactPipeline ? 0.02 : 0.005,
        tier: "system",
      });

      if (!guardrail.passed) {
        const reason = guardrail.results.find(r => r.check === guardrail.blockedBy)?.reason ?? "guardrail_block";
        console.error(`[worker] GUARDRAIL BLOCK ${task.id}: ${reason}`);
        await setStatus(task.id, "blocked", { result: reason });
        telemetry.push({
          taskId: task.id, taskTitle: task.title.slice(0, 60), taskType, routingHint: hint,
          executionMs: Date.now() - taskStart, artifactCount: 0,
          verdict: "blocked", failReason: reason, checks: [], estimatedCost: 0,
        });
        blocked++; consecutiveFails++;
        continue;
      }

      // ── Mark in_progress ─────────────────────────────────────────────────
      await setStatus(task.id, "in_progress");

      let execOutput    : string;
      let artifactIds   : string[] = [];
      let commitSha     : string | undefined;
      let deploymentUrl : string | undefined;
      let buildArtifactId: string | undefined;
      const estCost     : number = useArtifactPipeline ? 0.02 : 0.005;

      // ── Execute via correct pipeline ──────────────────────────────────────
      if (useArtifactPipeline) {
        // ── ARTIFACT PIPELINE: AI Build Team ──────────────────────────────
        console.log(`[worker] 🏗️  Artifact pipeline: ${task.id}`);
        const artifactTask: ArtifactTask = {
          id         : task.id,
          title      : task.title,
          description: task.description,
          type       : taskType,
          phase_id   : (task.metadata as Record<string, unknown>)?.phase_id as string ?? "general",
          source     : (task.metadata as Record<string, unknown>)?.source as string,
          metadata   : task.metadata as Record<string, unknown>,
        };

        const artResult = await executeArtifact(artifactTask, userId);

        execOutput     = artResult.output;
        commitSha      = artResult.commitSha;
        deploymentUrl  = artResult.deploymentUrl;
        buildArtifactId = artResult.buildArtifactId;
        artifactBuilds++;

        if (artResult.ok) {
          console.log(
            `[worker] 🏗️  Artifact built — ` +
            `commit=${commitSha?.slice(0, 8) ?? "none"} ` +
            `deploy=${deploymentUrl ?? "none"} ` +
            `type=${artResult.artifactType}`
          );
        } else {
          console.warn(`[worker] 🏗️  Artifact pipeline failed: ${artResult.error}`);
        }

      } else {
        // ── TYPED EXECUTOR (existing path) ────────────────────────────────
        const execResult = await runTypedTask(task as ExecutableTask, userId);
        execOutput = execResult.output ?? (execResult.ok ? "executed" : execResult.error ?? "");
        artifactIds = execResult.artifactIds ?? [];
      }

      totalCost += estCost;

      // ── Mark verifying ────────────────────────────────────────────────────
      await setStatus(task.id, "verifying", { result: execOutput.slice(0, 500) });

      // ── Verify via gate ───────────────────────────────────────────────────
      const vRes = await fetch(`${PREVIEW_BASE}/api/javari/verify-task`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ task_id: task.id }),
        signal : AbortSignal.timeout(30_000),
      });
      const vData = await vRes.json().catch(() => ({})) as Record<string, unknown>;
      const verdict = (vData.verdict as string) ?? "retry";

      if (verdict === "completed") {
        completed++; consecutiveFails = 0;
        console.log(`[worker] ✅ ${task.id} → completed${commitSha ? ` | commit=${commitSha.slice(0, 8)}` : ""}`);
      } else if (verdict === "blocked") {
        blocked++; consecutiveFails++;
        console.warn(`[worker] 🔴 ${task.id} → blocked`);
      } else {
        retried++; consecutiveFails++;
        console.warn(`[worker] ⚠️ ${task.id} → ${verdict}`);
      }

      telemetry.push({
        taskId               : task.id,
        taskTitle            : task.title.slice(0, 60),
        taskType,
        routingHint          : hint,
        executionMs          : Date.now() - taskStart,
        artifactCount        : artifactIds.length + (commitSha ? 1 : 0),
        verdict              : verdict === "completed" ? "completed" : verdict === "blocked" ? "blocked" : "retry",
        failReason           : verdict !== "completed" ? (vData.failReason as string) : undefined,
        checks               : (vData.checks as Array<{ name: string; pass: boolean }>) ?? [],
        estimatedCost        : estCost,
        usedArtifactPipeline : useArtifactPipeline,
        commitSha,
        deploymentUrl,
        buildArtifactId,
      });

    } finally {
      stopHeartbeat();
    }
  }

  const result: WorkerCycleResult = {
    ok             : completed > 0 || executed === 0,
    cycleId,
    tasksExecuted  : executed,
    tasksCompleted : completed,
    tasksRetried   : retried,
    tasksBlocked   : blocked,
    totalCostUsd   : totalCost,
    consecutiveFails,
    telemetry,
    stoppedReason  : executed === 0
      ? "no_pending"
      : executed >= cap
        ? "max_tasks"
        : "no_pending",
    durationMs  : Date.now() - cycleStart,
    planner     : plannerResult,
    artifactBuilds,
  };

  console.log(
    `[worker] ▶ Cycle done ${cycleId} | ` +
    `executed=${executed} completed=${completed} artifacts=${artifactBuilds} ` +
    `retried=${retried} blocked=${blocked} | $${totalCost.toFixed(4)} | ${result.durationMs}ms`
  );

  await writeCycleLog(cycleId, result);
  return result;
}
