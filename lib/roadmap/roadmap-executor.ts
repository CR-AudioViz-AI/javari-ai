/**
 * Javari Roadmap Execution Engine
 * Executes roadmap tasks using the 4-role multi-agent system with self-repair
 */

import { executeGateway } from "@/lib/execution/gateway";
import { storeExecutionResult } from "./execution-memory";
import { analyzeAndRepair, shouldRetry, getRetryDelay } from "./self-repair";
import { logExecution } from "@/lib/autonomy/executionLogger";

export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
  error?: string;
  estimatedCost?: number;
  rolesExecuted?: string[];
  executedAt?: Date;
  completedAt?: Date;
  retryCount?: number;
}

export interface RoadmapExecutionResult {
  success: boolean;
  task: RoadmapTask;
  output?: string;
  estimatedCost?: number;
  rolesExecuted?: string[];
  error?: string;
  repairAttempted?: boolean;
  repairedDescription?: string;
}

/**
 * Execute a roadmap task using the multi-agent system with self-repair
 */
export async function executeRoadmapTask(
  task: RoadmapTask,
  userId: string = "system"
): Promise<RoadmapExecutionResult> {
  console.log("[roadmap-executor] ====== TASK EXECUTION START ======");
  console.log("[roadmap-executor] Task ID:", task.id);
  console.log("[roadmap-executor] Title:", task.title);
  console.log("[roadmap-executor] Retry count:", task.retryCount || 0);
  console.log("[roadmap-executor] User:", userId);

  task.status = "running";
  task.executedAt = new Date();
  const currentRetryCount = task.retryCount || 0;

  try {
    const prompt = `
ROADMAP TASK EXECUTION

Task ID: ${task.id}
Title: ${task.title}
Retry Attempt: ${currentRetryCount + 1}

Description:
${task.description}

Please analyze, implement, validate, and document this task comprehensively.
    `.trim();

    console.log("[roadmap-executor] Executing via multi-agent gateway...");

    const gatewayResponse = await executeGateway({
      input: prompt,
      mode: "multi",
      userId,
      roles: {
        architect: "gpt-4o-mini",
        builder: "claude-sonnet-4-20250514",
        validator: "gpt-4o",
        documenter: "gpt-4o-mini",
      },
    });

    console.log("[roadmap-executor] Execution complete");
    console.log("[roadmap-executor] Cost: $", (gatewayResponse.estimatedCost ?? 0).toFixed(4));

    const gw = gatewayResponse as any;

    task.status = "completed";
    task.output = gw.output;
    task.estimatedCost = gw.estimatedCost;
    task.rolesExecuted = gw.rolesExecuted || ["architect", "builder", "validator", "documenter"];
    task.completedAt = new Date();

    // Store in execution memory
    console.log("[roadmap-executor] Storing result in execution memory...");
    await storeExecutionResult(task.id, task.title, {
      success: true,
      output: gw.output,
      estimatedCost: gw.estimatedCost,
      rolesExecuted: task.rolesExecuted,
    }, currentRetryCount);

    console.log("[roadmap-executor] ✅ Task completed successfully");

    // Log execution to autonomy_execution_log
    void logExecution({
      task_id       : task.id,
      model_used    : gw.model ?? "unknown",
      cost_estimate : gw.estimatedCost ?? 0,
      execution_time: task.completedAt && task.executedAt
        ? task.completedAt.getTime() - task.executedAt.getTime()
        : 0,
      status        : "success",
      provider      : gw.provider ?? undefined,
      task_type     : "roadmap_task",
    });

    return {
      success: true,
      task,
      output: gw.output,
      estimatedCost: gw.estimatedCost,
      rolesExecuted: task.rolesExecuted,
    };
  } catch (error: any) {
    console.error("[roadmap-executor] ❌ Task execution failed:", error.message);

    task.status = "failed";
    task.error = error.message;
    task.completedAt = new Date();

    // Check if we should attempt self-repair
    if (shouldRetry(currentRetryCount)) {
      console.log("[roadmap-executor] 🔧 Attempting self-repair...");

      const repairResult = await analyzeAndRepair(
        task.id,
        task.title,
        task.description,
        error.message,
        currentRetryCount
      );

      if (repairResult.success && repairResult.repairedDescription) {
        console.log("[roadmap-executor] ✅ Repair strategy generated");
        
        // Store failure with repair attempt
        await storeExecutionResult(task.id, task.title, {
          success: false,
          error: `${error.message} (repair attempted)`,
        }, currentRetryCount);

        // Update task for retry
        task.description = repairResult.repairedDescription;
        task.retryCount = currentRetryCount + 1;
        task.status = "pending"; // Re-queue for retry

        console.log("[roadmap-executor] Task re-queued for retry");

        return {
          success: false,
          task,
          error: error.message,
          repairAttempted: true,
          repairedDescription: repairResult.repairedDescription,
        };
      }
    }

    // Store failure without retry
    console.log("[roadmap-executor] Storing failure in execution memory...");
    await storeExecutionResult(task.id, task.title, {
      success: false,
      error: error.message,
    }, currentRetryCount);

    // Log failure to autonomy_execution_log
    void logExecution({
      task_id       : task.id,
      model_used    : "unknown",
      cost_estimate : 0,
      execution_time: task.executedAt ? Date.now() - task.executedAt.getTime() : 0,
      status        : "failed",
      error_message : error.message,
      task_type     : "roadmap_task",
    });

    return {
      success: false,
      task,
      error: error.message,
      repairAttempted: false,
    };
  }
}

/**
 * Execute multiple roadmap tasks in batches to prevent runaway costs.
 * maxTasksPerBatch = 5, delayBetweenBatches = 10 seconds.
 */
export async function executeRoadmapTasks(
  tasks: RoadmapTask[],
  userId: string = "system"
): Promise<RoadmapExecutionResult[]> {
  const MAX_TASKS_PER_BATCH   = 5;
  const DELAY_BETWEEN_BATCHES = 10_000; // 10 seconds

  console.log("[roadmap-executor] Executing", tasks.length, "tasks in batches of", MAX_TASKS_PER_BATCH);

  const results: RoadmapExecutionResult[] = [];

  // Slice tasks into batches
  for (let batchIndex = 0; batchIndex < tasks.length; batchIndex += MAX_TASKS_PER_BATCH) {
    const batch     = tasks.slice(batchIndex, batchIndex + MAX_TASKS_PER_BATCH);
    const batchNum  = Math.floor(batchIndex / MAX_TASKS_PER_BATCH) + 1;
    const totalBatches = Math.ceil(tasks.length / MAX_TASKS_PER_BATCH);

    console.log(`[roadmap-executor] ▶ Batch ${batchNum}/${totalBatches} — ${batch.length} tasks`);

    for (const task of batch) {
      const result = await executeRoadmapTask(task, userId);
      results.push(result);

      if (!result.success) {
        console.warn("[roadmap-executor] Task failed, continuing with remaining tasks");
      }
    }

    // Delay between batches (not after the last batch)
    if (batchIndex + MAX_TASKS_PER_BATCH < tasks.length) {
      console.log(`[roadmap-executor] ⏱ Batch ${batchNum} complete — waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch`);
      await new Promise<void>((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log("[roadmap-executor] ✅ Completed", successCount, "/", tasks.length, "tasks successfully");

  return results;
}
