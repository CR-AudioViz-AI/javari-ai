// lib/execution/taskExecutor.ts
// Purpose: Type-aware task executor — dispatches roadmap tasks by task.type to
//          the appropriate DevOps action via devopsExecutor.
//          Task types: build_module | create_api | update_schema | deploy_feature | ai_task (default)
// Date: 2026-03-07

import {
  commitFileChange,
  triggerVercelDeploy,
  runSupabaseSQL,
  CommitResult,
  DeployResult,
  SQLResult,
} from "./devopsExecutor";
import { executeGateway } from "./gateway";

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskType =
  | "build_module"
  | "create_api"
  | "update_schema"
  | "deploy_feature"
  | "ai_task"
  | string; // allow future types without breaking type safety

export interface ExecutableTask {
  id          : string;
  title       : string;
  description : string;
  type?       : TaskType;
  // Optional structured metadata for DevOps tasks
  metadata?   : {
    repo?       : string;
    filePath?   : string;
    fileContent?: string;
    sql?        : string;
    project?    : string;
  };
}

export interface TaskExecutionResult {
  ok          : boolean;
  taskId      : string;
  type        : TaskType;
  output?     : string;
  actions?    : ActionRecord[];
  error?      : string;
  durationMs? : number;
}

export interface ActionRecord {
  action  : string;
  ok      : boolean;
  detail? : string;
  error?  : string;
}

const DEFAULT_REPO    = "CR-AudioViz-AI/javari-ai";
const DEFAULT_PROJECT = "javari-ai";

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
          Object.fromEntries(
            Object.entries(result).filter(([k]) => k !== "ok")
          )
        ).slice(0, 200)
      : undefined,
    error : result.ok ? undefined : result.error,
  };
}

// ── AI fallback — used when no structured metadata supplied ───────────────

async function runAIFallback(task: ExecutableTask, userId: string): Promise<string> {
  const result = await executeGateway({
    input          : `Execute roadmap task:\nTitle: ${task.title}\n\n${task.description}`,
    mode           : "auto",
    userId,
    routingPriority: "quality",
  });
  return typeof result.output === "string" ? result.output : JSON.stringify(result.output);
}

// ── Task handlers ──────────────────────────────────────────────────────────

/**
 * build_module — generate module code and commit it to GitHub.
 * If metadata.filePath and metadata.fileContent are provided, commits directly.
 * Otherwise uses AI to generate the module then commits the output.
 */
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

    // If no pre-generated content, use AI to write it
    if (!content.trim()) {
      content = await runAIFallback(task, userId);
    }

    const commitResult = await commitFileChange(
      repo,
      path,
      content,
      `[javari] build_module: ${task.title} (task ${task.id})`
    );
    actions.push(record("github_commit", commitResult));

    return {
      ok        : commitResult.ok,
      taskId    : task.id,
      type      : "build_module",
      output    : commitResult.ok
                    ? `Module committed to ${path} (SHA: ${commitResult.sha?.slice(0, 8)})`
                    : `Commit failed: ${commitResult.error}`,
      actions,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "build_module",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

/**
 * create_api — generate an API route file, commit it, and trigger a preview deploy.
 */
async function handleCreateAPI(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];

  try {
    const repo    = task.metadata?.repo        ?? DEFAULT_REPO;
    const path    = task.metadata?.filePath    ?? `app/api/${task.id}/route.ts`;
    let   content = task.metadata?.fileContent ?? "";
    const project = task.metadata?.project     ?? DEFAULT_PROJECT;

    if (!content.trim()) {
      content = await runAIFallback(task, userId);
    }

    // Step 1: commit the route file
    const commitResult = await commitFileChange(
      repo,
      path,
      content,
      `[javari] create_api: ${task.title} (task ${task.id})`
    );
    actions.push(record("github_commit", commitResult));

    if (!commitResult.ok) {
      return { ok: false, taskId: task.id, type: "create_api",
               error: `Commit failed: ${commitResult.error}`, actions,
               durationMs: Date.now() - start };
    }

    // Step 2: trigger preview deploy
    const deployResult = await triggerVercelDeploy(project);
    actions.push(record("vercel_deploy", deployResult));

    const ok = commitResult.ok && deployResult.ok;
    return {
      ok,
      taskId    : task.id,
      type      : "create_api",
      output    : ok
                    ? `API route created at ${path}. Deploy: ${deployResult.url} (${deployResult.state})`
                    : `Partial: commit=${commitResult.ok} deploy=${deployResult.ok}`,
      actions,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "create_api",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

/**
 * update_schema — run a Supabase SQL migration.
 * Requires metadata.sql or derives migration from task description via AI.
 */
async function handleUpdateSchema(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];

  try {
    let sql = task.metadata?.sql ?? "";

    // If no SQL provided, ask AI to generate it from description
    if (!sql.trim()) {
      const aiResult = await executeGateway({
        input: `Generate a Supabase PostgreSQL migration SQL for the following task.
Return ONLY valid SQL statements — no markdown, no explanation.

Task: ${task.title}
Description: ${task.description}`,
        mode           : "auto",
        userId,
        routingPriority: "quality",
      });
      sql = typeof aiResult.output === "string" ? aiResult.output : "";
    }

    if (!sql.trim()) {
      return { ok: false, taskId: task.id, type: "update_schema",
               error: "No SQL generated or provided", actions,
               durationMs: Date.now() - start };
    }

    const sqlResult = await runSupabaseSQL(sql);
    actions.push(record("supabase_sql", sqlResult));

    return {
      ok        : sqlResult.ok,
      taskId    : task.id,
      type      : "update_schema",
      output    : sqlResult.ok
                    ? `Schema migration applied. Rows affected: ${sqlResult.count ?? 0}`
                    : `Migration failed: ${sqlResult.error}`,
      actions,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "update_schema",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

/**
 * deploy_feature — commit feature files and trigger a Vercel preview deploy.
 * Covers the case where code already exists and only needs a deploy trigger.
 */
async function handleDeployFeature(
  task   : ExecutableTask,
  userId : string
): Promise<TaskExecutionResult> {
  const start   = Date.now();
  const actions : ActionRecord[] = [];

  try {
    const project = task.metadata?.project ?? DEFAULT_PROJECT;
    const repo    = task.metadata?.repo    ?? DEFAULT_REPO;

    // If file content provided, commit it first
    if (task.metadata?.filePath && task.metadata?.fileContent) {
      const commitResult = await commitFileChange(
        repo,
        task.metadata.filePath,
        task.metadata.fileContent,
        `[javari] deploy_feature: ${task.title} (task ${task.id})`
      );
      actions.push(record("github_commit", commitResult));

      if (!commitResult.ok) {
        return { ok: false, taskId: task.id, type: "deploy_feature",
                 error: `Commit failed: ${commitResult.error}`, actions,
                 durationMs: Date.now() - start };
      }
    }

    // Trigger deploy
    const deployResult = await triggerVercelDeploy(project);
    actions.push(record("vercel_deploy", deployResult));

    return {
      ok        : deployResult.ok,
      taskId    : task.id,
      type      : "deploy_feature",
      output    : deployResult.ok
                    ? `Deploy triggered: ${deployResult.url} | state: ${deployResult.state}`
                    : `Deploy failed: ${deployResult.error}`,
      actions,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, taskId: task.id, type: "deploy_feature",
             error: String(err), actions, durationMs: Date.now() - start };
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────

/**
 * executeTask — routes a task to the correct handler based on task.type.
 * Falls back to AI execution for unknown / untyped tasks.
 */
export async function executeTask(
  task   : ExecutableTask,
  userId : string = "system"
): Promise<TaskExecutionResult> {
  const type = (task.type ?? "ai_task") as TaskType;

  console.log(`[taskExecutor] ▶ ${task.id} | type=${type} | ${task.title}`);

  switch (type) {
    case "build_module":
      return handleBuildModule(task, userId);

    case "create_api":
      return handleCreateAPI(task, userId);

    case "update_schema":
      return handleUpdateSchema(task, userId);

    case "deploy_feature":
      return handleDeployFeature(task, userId);

    default:
      // ai_task or unrecognised type — use AI gateway
      try {
        const start  = Date.now();
        const output = await runAIFallback(task, userId);
        return {
          ok        : true,
          taskId    : task.id,
          type      : "ai_task",
          output,
          actions   : [{ action: "ai_gateway", ok: true }],
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return { ok: false, taskId: task.id, type, error: String(err) };
      }
  }
}
