// lib/execution/queue.ts
// Purpose: Execution queue — sequential task execution with guardrails, dependency
//          resolution, audit logging, roadmap-only enforcement, and persistence
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";
import { executeGateway } from "./gateway";
import { runGuardrails, GuardrailReport } from "./guardrails";
import {
  acquireTaskLock,
  releaseTaskLock,
  writeCheckpoint,
  startHeartbeat,
  recoverStalledTasks,
} from "./persistence";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Fresh client factory — called per-operation to avoid stale PostgREST schema cache.
// Module-level supabase-js clients cache schema on init; tables created after startup
// may be invisible until the process restarts. Per-call clients bypass this.
function freshClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "retry" | "failed";
  depends_on: string[] | null;
  source?: string;
  created_at?: string;
}

export interface ExecutionLog {
  execution_id: string;
  task_id: string;
  model_used: string;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  execution_time: number;
  status: "success" | "failed" | "retry" | "blocked";
  error_message?: string;
  guardrail_report?: GuardrailReport;
  timestamp: string;
}

// ─── Roadmap-only enforcement ─────────────────────────────────────────────────
// The planner will never generate discovery tasks, but this is a defense-in-depth
// check at the executor level. Any non-roadmap task is quarantined immediately.
function enforceRoadmapOnly(task: Task): void {
  if (task.source && task.source !== "roadmap") {
    throw new Error(
      `GUARDRAIL VIOLATION: Task "${task.id}" has source="${task.source}". ` +
      `Only source="roadmap" tasks are permitted in autonomous execution. ` +
      `Task quarantined — will not execute.`
    );
  }
}

// ─── Fetch executable tasks ───────────────────────────────────────────────────
async function getExecutableTasks(): Promise<Task[]> {
  const supabase = freshClient();

  const { data: allTasks, error: tasksError } = await supabase
    .from("roadmap_tasks")
    .select("*")
    .order("updated_at", { ascending: true });

  if (tasksError) {
    console.error("[queue] Error fetching tasks:", tasksError.message);
    return [];
  }

  if (!allTasks || allTasks.length === 0) return [];

  const completedIds = new Set(
    allTasks.filter((t: Task) => t.status === "completed").map((t: Task) => t.id)
  );

  return allTasks.filter((task: Task) => {
    if (task.status !== "pending" && task.status !== "retry") return false;
    const deps = task.depends_on ?? [];
    return deps.every((depId: string) => completedIds.has(depId));
  });
}

// ─── Status update ────────────────────────────────────────────────────────────
async function updateTaskStatus(taskId: string, status: Task["status"]): Promise<boolean> {
  const supabase = freshClient();
  const { error } = await supabase
    .from("roadmap_tasks")
    .update({ status, updated_at: Math.floor(Date.now() / 1000) })
    .eq("id", taskId);

  if (error) {
    console.error(`[queue] Error updating task ${taskId}:`, error.message);
    return false;
  }
  console.log(`[queue] Task ${taskId} status → ${status}`);
  return true;
}

// ─── Log execution ────────────────────────────────────────────────────────────
async function logExecution(log: ExecutionLog): Promise<boolean> {
  const supabase = freshClient();
  const { error } = await supabase
    .from("execution_logs")
    .insert([{
      execution_id: log.execution_id,
      task_id: log.task_id,
      model_used: log.model_used,
      cost: log.cost,
      tokens_in: log.tokens_in,
      tokens_out: log.tokens_out,
      execution_time: log.execution_time,
      status: log.status,
      error_message: log.error_message,
      timestamp: log.timestamp,
    }]);

  if (error) {
    console.error("[queue] Error logging execution:", error.message);
    return false;
  }
  return true;
}

// ─── Execute single task ──────────────────────────────────────────────────────
async function executeTask(
  task: Task,
  userId: string = "queue-executor"
): Promise<{ success: boolean; log: ExecutionLog }> {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startTime = Date.now();

  console.log(`[queue] ====== EXECUTING TASK ======`);
  console.log(`[queue] Execution ID: ${executionId}`);
  console.log(`[queue] Task: ${task.id} — ${task.title}`);
  console.log(`[queue] Source: ${task.source ?? "unknown"}`);

  // ── Persistence: acquire execution lock (atomic, prevents duplicate runs) ──
  const lockAcquired = await acquireTaskLock(task.id, executionId);
  if (!lockAcquired) {
    // Task was picked up by a concurrent executor — skip gracefully (not a failure)
    console.log(`[queue] Task ${task.id} already locked by concurrent executor — skipping`);
    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: "none",
      cost: 0, tokens_in: 0, tokens_out: 0,
      execution_time: 0,
      status: "blocked",
      error_message: "Task locked by concurrent executor — skipped, not failed",
      timestamp: new Date().toISOString(),
    };
    return { success: false, log };
  }

  // Start heartbeat to keep lock alive during long-running execution
  const stopHeartbeat = startHeartbeat(task.id);
  let heartbeatStopped = false;
  const safeStopHeartbeat = () => { if (!heartbeatStopped) { heartbeatStopped = true; stopHeartbeat(); } };

  // ── Guardrail: roadmap-only enforcement ────────────────────────────────────
  try {
    enforceRoadmapOnly(task);
  } catch (err: unknown) {
    const message = (err as Error).message;
    console.error(`[queue] GUARDRAIL BLOCK (roadmap-only):`, message);
    await updateTaskStatus(task.id, "failed");
    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: "none",
      cost: 0,
      tokens_in: 0,
      tokens_out: 0,
      execution_time: Date.now() - startTime,
      status: "blocked",
      error_message: message,
      timestamp: new Date().toISOString(),
    };
    await logExecution(log);
    return { success: false, log };
  }

  // Mark as in_progress before running guardrails (so migration check can detect it)
  await updateTaskStatus(task.id, "in_progress");

  // ── Run all guardrails ─────────────────────────────────────────────────────
  const guardrailReport = await runGuardrails({
    taskId: task.id,
    executionId,
    taskTitle: task.title,
    estimatedCost: 0.005,   // conservative pre-execution estimate
    tier: userId === "system" ? "system" : "free",
  });

  if (!guardrailReport.passed) {
    const blockedBy = guardrailReport.blockedBy ?? "unknown";
    const reason = guardrailReport.results.find(r => r.check === blockedBy)?.reason ?? "Guardrail blocked";

    console.error(`[queue] GUARDRAIL BLOCK (${blockedBy}): ${reason}`);

    // Revert to pending if rollback — retry later; failed if hard block
    const revertStatus = blockedBy === "rollback_trigger" ? "pending" : "failed";
    await updateTaskStatus(task.id, revertStatus);

    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: "none",
      cost: 0,
      tokens_in: 0,
      tokens_out: 0,
      execution_time: Date.now() - startTime,
      status: "blocked",
      error_message: `Guardrail [${blockedBy}]: ${reason}`,
      guardrail_report: guardrailReport,
      timestamp: new Date().toISOString(),
    };
    await logExecution(log);
    return { success: false, log };
  }

  console.log(`[queue] All guardrails passed for task ${task.id}`);

  // ── Execute via gateway ────────────────────────────────────────────────────
  try {
    const prompt = `
TASK EXECUTION REQUEST

Task ID: ${task.id}
Task: ${task.title}
Description: ${task.description}

Your job is to execute this task and provide detailed results.

OUTPUT FORMAT:
Return a JSON object with:
{
  "status": "completed" or "needs_retry",
  "result": "What was accomplished",
  "validation": "Validation results",
  "next_steps": "Optional recommendations"
}
    `.trim();

    const response = await executeGateway({
      input: prompt,
      mode: "auto",
      userId,
      taskId: task.id,
    }) as { output: unknown; model?: string; estimatedCost?: number; usage?: { prompt_tokens?: number; completion_tokens?: number } };

    const executionTime = Date.now() - startTime;

    let parsedResult: { status?: string; result?: string };
    try {
      if (typeof response.output === "object") {
        parsedResult = response.output as { status?: string };
      } else {
        parsedResult = JSON.parse(response.output as string) as { status?: string };
      }
    } catch {
      parsedResult = { status: "completed", result: String(response.output) };
    }

    const finalStatus: Task["status"] = parsedResult.status === "needs_retry" ? "retry" : "completed";
    await updateTaskStatus(task.id, finalStatus);

    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: response.model ?? "unknown",
      cost: response.estimatedCost ?? 0,
      tokens_in: response.usage?.prompt_tokens ?? 0,
      tokens_out: response.usage?.completion_tokens ?? 0,
      execution_time: executionTime,
      status: finalStatus === "completed" ? "success" : "retry",
      guardrail_report: guardrailReport,
      timestamp: new Date().toISOString(),
    };

    await logExecution(log);

    console.log(`[queue] Task ${task.id} → ${finalStatus} | ${executionTime}ms | $${(log.cost).toFixed(4)}`);
    return { success: true, log };

  } catch (error: unknown) {
    const message = (error as Error).message;
    console.error(`[queue] Task ${task.id} execution failed:`, message);
    await updateTaskStatus(task.id, "failed");

    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: "unknown",
      cost: 0,
      tokens_in: 0,
      tokens_out: 0,
      execution_time: Date.now() - startTime,
      status: "failed",
      error_message: message,
      guardrail_report: guardrailReport,
      timestamp: new Date().toISOString(),
    };
    await logExecution(log);
    return { success: false, log };
  }
}

// ─── Process queue ─────────────────────────────────────────────────────────────
export async function processQueue(
  maxTasks: number = 5,
  userId: string = "queue-executor"
): Promise<{
  executed: number;
  succeeded: number;
  failed: number;
  blocked: number;
  logs: ExecutionLog[];
}> {
  console.log("[queue] ====== PROCESSING EXECUTION QUEUE ======");
  console.log("[queue] Max tasks:", maxTasks);

  const executableTasks = await getExecutableTasks();

  if (executableTasks.length === 0) {
    console.log("[queue] No executable tasks found");
    return { executed: 0, succeeded: 0, failed: 0, blocked: 0, logs: [] };
  }

  const tasksToExecute = executableTasks.slice(0, maxTasks);
  console.log(`[queue] Executing ${tasksToExecute.length} task(s)`);

  const logs: ExecutionLog[] = [];
  let succeeded = 0;
  let failed = 0;
  let blocked = 0;

  for (const task of tasksToExecute) {
    const result = await executeTask(task, userId);
    logs.push(result.log);

    if (result.log.status === "blocked") {
      blocked++;
    } else if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(`[queue] Complete — executed: ${tasksToExecute.length} | succeeded: ${succeeded} | failed: ${failed} | blocked: ${blocked}`);

  return { executed: tasksToExecute.length, succeeded, failed, blocked, logs };
}

// ─── Queue stats ──────────────────────────────────────────────────────────────
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  retry: number;
}> {
  const supabase = freshClient();
  const { data: tasks, error } = await supabase.from("roadmap_tasks").select("status");

  if (error || !tasks) {
    return { total: 0, pending: 0, inProgress: 0, completed: 0, failed: 0, retry: 0 };
  }

  return {
    total:      tasks.length,
    pending:    tasks.filter((t: { status: string }) => t.status === "pending").length,
    inProgress: tasks.filter((t: { status: string }) => t.status === "in_progress").length,
    completed:  tasks.filter((t: { status: string }) => t.status === "completed").length,
    failed:     tasks.filter((t: { status: string }) => t.status === "failed").length,
    retry:      tasks.filter((t: { status: string }) => t.status === "retry").length,
  };
}
