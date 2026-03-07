// lib/execution/taskExecutor.ts
// Purpose: Type-aware task executor — dispatches roadmap tasks by task.type,
//          records proof artifacts, then sets status=verifying (NOT completed).
//          Completion is gated through /api/javari/verify-task only.
// Date: 2026-03-07 — updated with verification gate

import {
  commitFileChange,
  triggerVercelDeploy,
  runSupabaseSQL,
  CommitResult,
  DeployResult,
  SQLResult,
} from "./devopsExecutor";
import { executeGateway } from "./gateway";
import { recordArtifact, recordArtifacts } from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskType =
  | "build_module"
  | "create_api"
  | "update_schema"
  | "deploy_feature"
  | "ai_task"
  | string;

export interface ExecutableTask {
  id          : string;
  title       : string;
  description : string;
  type?       : TaskType;
  metadata?   : {
    repo?       : string;
    filePath?   : string;
    fileContent?: string;
    sql?        : string;
    project?    : string;
  };
}

export interface TaskExecutionResult {
  ok           : boolean;
  taskId       : string;
  type         : TaskType;
  output?      : string;
  actions?     : ActionRecord[];
  artifactIds? : string[];   // IDs of recorded proof artifacts
  error?       : string;
  durationMs?  : number;
}

export interface ActionRecord {
  action  : string;
  ok      : boolean;
  detail? : string;
  error?  : string;
}

const DEFAULT_REPO    = "CR-AudioViz-AI/javari-ai";
const DEFAULT_PROJECT = "javari-ai";

const PREVIEW_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

// ── Action logger ──────────────────────────────────────────────────────────

function record(
  action : string,
  result : CommitResult | DeployResult | SQLResult
): ActionRecord {
  return {
    action,
    ok    : result.ok,
    detail: result.ok
      ? JSON.stringify(
          Object.fromEntries(Object.entries(result).filter(([k]) => k !== "ok"))
        ).slice(0, 200)
      : undefined,
    error : result.ok ? undefined : result.error,
  };
}

// ── AI fallback ────────────────────────────────────────────────────────────

async function runAIFallback(task: ExecutableTask, userId: string): Promise<string> {
  const result = await executeGateway({
    input          : `Execute roadmap task:\nTitle: ${task.title}\n\n${task.description}`,
    mode           : "auto",
    userId,
    routingPriority: "quality",
  });
  return typeof result.output === "string" ? result.output : JSON.stringify(result.output);
}

// ── Task handlers (each records artifacts before returning) ────────────────

async function handleBuildModule(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];

  try {
    const repo    = task.metadata?.repo        ?? DEFAULT_REPO;
    const path    = task.metadata?.filePath    ?? `app/modules/${task.id}/module.ts`;
    let   content = task.metadata?.fileContent ?? "";

    if (!content.trim()) content = await runAIFallback(task, userId);

    const commitResult = await commitFileChange(
      repo, path, content,
      `[javari] build_module: ${task.title} (task ${task.id})`
    );
    actions.push(record("github_commit", commitResult));

    // Record artifact
    const artifactIds: string[] = [];
    if (commitResult.ok && commitResult.sha) {
      const ar = await recordArtifact({
        task_id          : task.id,
        artifact_type    : "commit",
        artifact_location: commitResult.sha,
        artifact_data    : { repo, path, sha: commitResult.sha },
      });
      if (ar.id) artifactIds.push(ar.id);
    }

    return {
      ok        : commitResult.ok,
      taskId    : task.id,
      type      : "build_module",
      output    : commitResult.ok
                    ? `Module committed to ${path} (SHA: ${commitResult.sha?.slice(0, 8)})`
                    : `Commit failed: ${commitResult.error}`,
      actions,
      artifactIds,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "build_module",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

async function handleCreateAPI(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];
  const artifactIds: string[] = [];

  try {
    const repo    = task.metadata?.repo        ?? DEFAULT_REPO;
    const path    = task.metadata?.filePath    ?? `app/api/${task.id}/route.ts`;
    let   content = task.metadata?.fileContent ?? "";
    const project = task.metadata?.project     ?? DEFAULT_PROJECT;

    if (!content.trim()) content = await runAIFallback(task, userId);

    // Commit
    const commitResult = await commitFileChange(
      repo, path, content,
      `[javari] create_api: ${task.title} (task ${task.id})`
    );
    actions.push(record("github_commit", commitResult));

    if (commitResult.ok && commitResult.sha) {
      const ar = await recordArtifact({
        task_id          : task.id,
        artifact_type    : "commit",
        artifact_location: commitResult.sha,
        artifact_data    : { repo, path, sha: commitResult.sha },
      });
      if (ar.id) artifactIds.push(ar.id);
    }

    if (!commitResult.ok) {
      return { ok: false, taskId: task.id, type: "create_api",
               error: `Commit failed: ${commitResult.error}`, actions, artifactIds,
               durationMs: Date.now() - start };
    }

    // Deploy
    const deployResult = await triggerVercelDeploy(project);
    actions.push(record("vercel_deploy", deployResult));

    if (deployResult.ok && deployResult.url) {
      // Also attempt HTTP check
      try {
        const checkRes = await fetch(deployResult.url, { method: "GET" });
        const httpAr = await recordArtifact({
          task_id          : task.id,
          artifact_type    : "http_check",
          artifact_location: deployResult.url,
          artifact_data    : { status: checkRes.status, url: deployResult.url },
        });
        if (httpAr.id) artifactIds.push(httpAr.id);
      } catch { /* best-effort */ }

      const deployAr = await recordArtifact({
        task_id          : task.id,
        artifact_type    : "deploy",
        artifact_location: deployResult.url,
        artifact_data    : { deploymentId: deployResult.deploymentId, state: deployResult.state },
      });
      if (deployAr.id) artifactIds.push(deployAr.id);
    }

    return {
      ok        : commitResult.ok && deployResult.ok,
      taskId    : task.id,
      type      : "create_api",
      output    : `API route created at ${path}. Deploy: ${deployResult.url ?? "n/a"} (${deployResult.state ?? "?"})`,
      actions,
      artifactIds,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "create_api",
             error: String(err), actions, artifactIds, durationMs: Date.now() - start };
  }
}

async function handleUpdateSchema(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];
  const artifactIds: string[] = [];

  try {
    let sql = task.metadata?.sql ?? "";

    if (!sql.trim()) {
      const aiResult = await executeGateway({
        input: `Generate a Supabase PostgreSQL migration SQL for:\nTask: ${task.title}\nDescription: ${task.description}\nReturn ONLY valid SQL — no markdown, no explanation.`,
        mode: "auto", userId, routingPriority: "quality",
      });
      sql = typeof aiResult.output === "string" ? aiResult.output : "";
    }

    if (!sql.trim()) {
      return { ok: false, taskId: task.id, type: "update_schema",
               error: "No SQL generated", actions, durationMs: Date.now() - start };
    }

    const sqlResult = await runSupabaseSQL(sql);
    actions.push(record("supabase_sql", sqlResult));

    if (sqlResult.ok) {
      const ar = await recordArtifact({
        task_id          : task.id,
        artifact_type    : "sql_migration",
        artifact_location: `supabase:${task.id}`,
        artifact_data    : {
          rows_affected: sqlResult.count ?? 0,
          sql_preview  : sql.slice(0, 200),
        },
      });
      if (ar.id) artifactIds.push(ar.id);
    }

    return {
      ok        : sqlResult.ok,
      taskId    : task.id,
      type      : "update_schema",
      output    : sqlResult.ok
                    ? `Migration applied. Rows: ${sqlResult.count ?? 0}`
                    : `Migration failed: ${sqlResult.error}`,
      actions,
      artifactIds,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "update_schema",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

async function handleDeployFeature(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];
  const artifactIds: string[] = [];

  try {
    const project = task.metadata?.project ?? DEFAULT_PROJECT;
    const repo    = task.metadata?.repo    ?? DEFAULT_REPO;

    if (task.metadata?.filePath && task.metadata?.fileContent) {
      const commitResult = await commitFileChange(
        repo, task.metadata.filePath, task.metadata.fileContent,
        `[javari] deploy_feature: ${task.title} (task ${task.id})`
      );
      actions.push(record("github_commit", commitResult));

      if (commitResult.ok && commitResult.sha) {
        const ar = await recordArtifact({
          task_id          : task.id,
          artifact_type    : "commit",
          artifact_location: commitResult.sha,
          artifact_data    : { repo, path: task.metadata.filePath },
        });
        if (ar.id) artifactIds.push(ar.id);
      }
    }

    const deployResult = await triggerVercelDeploy(project);
    actions.push(record("vercel_deploy", deployResult));

    if (deployResult.ok && deployResult.url) {
      const ar = await recordArtifact({
        task_id          : task.id,
        artifact_type    : "deploy",
        artifact_location: deployResult.url,
        artifact_data    : {
          deploymentId: deployResult.deploymentId,
          state       : deployResult.state,
        },
      });
      if (ar.id) artifactIds.push(ar.id);
    }

    return {
      ok        : deployResult.ok,
      taskId    : task.id,
      type      : "deploy_feature",
      output    : deployResult.ok
                    ? `Deploy triggered: ${deployResult.url} | ${deployResult.state}`
                    : `Deploy failed: ${deployResult.error}`,
      actions,
      artifactIds,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "deploy_feature",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────

/**
 * executeTask
 *
 * Executes a task and records proof artifacts.
 * Does NOT write status=completed — that is the exclusive domain of
 * /api/javari/verify-task after artifact verification passes.
 */
export async function executeTask(
  task   : ExecutableTask,
  userId : string = "system"
): Promise<TaskExecutionResult> {
  const type = (task.type ?? "ai_task") as TaskType;
  console.log(`[taskExecutor] ▶ ${task.id} | type=${type} | ${task.title}`);

  switch (type) {
    case "build_module"  : return handleBuildModule(task, userId);
    case "create_api"    : return handleCreateAPI(task, userId);
    case "update_schema" : return handleUpdateSchema(task, userId);
    case "deploy_feature": return handleDeployFeature(task, userId);

    default: {
      // ai_task — run AI and record output as artifact
      const start = Date.now();
      try {
        const output = await runAIFallback(task, userId);
        const artifactIds: string[] = [];

        const ar = await recordArtifact({
          task_id          : task.id,
          artifact_type    : "ai_output",
          artifact_location: `ai:${task.id}:${Date.now()}`,
          artifact_data    : { output_preview: output.slice(0, 500), model: "gateway" },
        });
        if (ar.id) artifactIds.push(ar.id);

        return {
          ok        : true,
          taskId    : task.id,
          type      : "ai_task",
          output,
          actions   : [{ action: "ai_gateway", ok: true }],
          artifactIds,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return { ok: false, taskId: task.id, type, error: String(err),
                 durationMs: Date.now() - start };
      }
    }
  }
}
