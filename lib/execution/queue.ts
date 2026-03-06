/**
 * Javari Execution Queue
 * Sequential task execution with dependency resolution
 */

import { createClient } from "@supabase/supabase-js";
import { executeGateway } from "./gateway";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "retry" | "failed";
  depends_on: string[] | null;
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
  status: "success" | "failed" | "retry";
  error_message?: string;
  timestamp: string;
}

/**
 * Get all pending tasks with satisfied dependencies
 */
async function getExecutableTasks(): Promise<Task[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get all tasks
  const { data: allTasks, error: tasksError } = await supabase
    .from("roadmap_tasks")
    .select("*")
    .order("updated_at", { ascending: true });

  if (tasksError) {
    console.error("[queue] Error fetching tasks:", tasksError.message);
    return [];
  }

  if (!allTasks || allTasks.length === 0) {
    return [];
  }

  // Build a map of completed task IDs
  const completedTaskIds = new Set(
    allTasks.filter(t => t.status === "completed").map(t => t.id)
  );

  // Filter for executable tasks
  const executableTasks = allTasks.filter(task => {
    // Must be pending or retry
    if (task.status !== "pending" && task.status !== "retry") {
      return false;
    }

    // All dependencies must be completed
    const dependencies = task.depends_on ?? [];
    const allDependenciesMet = dependencies.every(depId => 
      completedTaskIds.has(depId)
    );

    return allDependenciesMet;
  });

  console.log(`[queue] Found ${executableTasks.length} executable tasks out of ${allTasks.length} total`);
  
  return executableTasks;
}

/**
 * Update task status
 */
async function updateTaskStatus(
  taskId: string,
  status: Task["status"]
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from("roadmap_tasks")
    .update({ status, updated_at: Math.floor(Date.now() / 1000) })
    .eq("id", taskId);

  if (error) {
    console.error(`[queue] Error updating task ${taskId}:`, error.message);
    return false;
  }

  console.log(`[queue] ✅ Task ${taskId} status → ${status}`);
  return true;
}

/**
 * Log task execution
 */
async function logExecution(log: ExecutionLog): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  console.log(`[queue] 📊 Logged execution ${log.execution_id}`);
  return true;
}

/**
 * Execute a single task
 */
async function executeTask(task: Task, userId: string = "queue-executor"): Promise<{
  success: boolean;
  log: ExecutionLog;
}> {
  const executionId = `exec-${Date.now()}`;
  const startTime = Date.now();

  console.log(`[queue] ====== EXECUTING TASK ======`);
  console.log(`[queue] Execution ID: ${executionId}`);
  console.log(`[queue] Task: ${task.title}`);

  try {
    // Mark task as in progress
    await updateTaskStatus(task.id, "in_progress");

    // Build execution prompt
    const prompt = `
TASK EXECUTION REQUEST

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

    // Execute via builder agent (using cheap tier by default)
    const response = await executeGateway({
      input: prompt,
      mode: "auto",
      userId,
      taskId: task.id,
    }) as any;

    const executionTime = Date.now() - startTime;

    // Parse response
    let parsedResult: any;
    try {
      if (typeof response.output === "object") {
        parsedResult = response.output;
      } else {
        parsedResult = JSON.parse(response.output);
      }
    } catch (e) {
      parsedResult = { status: "completed", result: response.output };
    }

    // Determine final status
    const finalStatus = parsedResult.status === "needs_retry" ? "retry" : "completed";

    // Update task status
    await updateTaskStatus(task.id, finalStatus);

    // Create execution log
    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: response.model || "unknown",
      cost: response.estimatedCost || 0,
      tokens_in: response.usage?.prompt_tokens || 0,
      tokens_out: response.usage?.completion_tokens || 0,
      execution_time: executionTime,
      status: finalStatus === "completed" ? "success" : "retry",
      timestamp: new Date().toISOString(),
    };

    await logExecution(log);

    console.log(`[queue] ✅ Task executed: ${finalStatus}`);
    console.log(`[queue] Time: ${executionTime}ms | Cost: $${log.cost.toFixed(4)}`);

    return { success: true, log };

  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    console.error(`[queue] ❌ Task execution failed:`, error.message);

    // Mark as failed
    await updateTaskStatus(task.id, "failed");

    // Log failure
    const log: ExecutionLog = {
      execution_id: executionId,
      task_id: task.id,
      model_used: "unknown",
      cost: 0,
      tokens_in: 0,
      tokens_out: 0,
      execution_time: executionTime,
      status: "failed",
      error_message: error.message,
      timestamp: new Date().toISOString(),
    };

    await logExecution(log);

    return { success: false, log };
  }
}

/**
 * Process the execution queue
 * Returns number of tasks executed
 */
export async function processQueue(
  maxTasks: number = 5,
  userId: string = "queue-executor"
): Promise<{
  executed: number;
  succeeded: number;
  failed: number;
  logs: ExecutionLog[];
}> {
  console.log("[queue] ====== PROCESSING EXECUTION QUEUE ======");
  console.log("[queue] Max tasks:", maxTasks);

  const executableTasks = await getExecutableTasks();

  if (executableTasks.length === 0) {
    console.log("[queue] No executable tasks found");
    return { executed: 0, succeeded: 0, failed: 0, logs: [] };
  }

  // Limit to maxTasks
  const tasksToExecute = executableTasks.slice(0, maxTasks);
  console.log(`[queue] Executing ${tasksToExecute.length} tasks`);

  const logs: ExecutionLog[] = [];
  let succeeded = 0;
  let failed = 0;

  // Execute tasks sequentially
  for (const task of tasksToExecute) {
    const result = await executeTask(task, userId);
    logs.push(result.log);

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(`[queue] ✅ Queue processing complete`);
  console.log(`[queue] Executed: ${tasksToExecute.length} | Succeeded: ${succeeded} | Failed: ${failed}`);

  return {
    executed: tasksToExecute.length,
    succeeded,
    failed,
    logs,
  };
}

/**
 * Get execution statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  retry: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: tasks, error } = await supabase
    .from("roadmap_tasks")
    .select("status");

  if (error || !tasks) {
    return {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      retry: 0,
    };
  }

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    failed: tasks.filter(t => t.status === "failed").length,
    retry: tasks.filter(t => t.status === "retry").length,
  };

  return stats;
}
