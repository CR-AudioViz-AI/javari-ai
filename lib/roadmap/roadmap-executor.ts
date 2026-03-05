/**
 * Javari Roadmap Execution Engine
 * Executes roadmap tasks using the 4-role multi-agent system with self-repair
 */

import { executeGateway } from "@/lib/execution/gateway";
import { storeExecutionResult } from "./execution-memory";
import { analyzeAndRepair, shouldRetry, getRetryDelay } from "./self-repair";

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

    task.status = "completed";
    task.output = gatewayResponse.output;
    task.estimatedCost = gatewayResponse.estimatedCost;
    task.rolesExecuted = (gatewayResponse as any).rolesExecuted || ["architect", "builder", "validator", "documenter"];
    task.completedAt = new Date();

    // Store in execution memory
    console.log("[roadmap-executor] Storing result in execution memory...");
    await storeExecutionResult(task.id, task.title, {
      success: true,
      output: gatewayResponse.output,
      estimatedCost: gatewayResponse.estimatedCost,
      rolesExecuted: task.rolesExecuted,
    }, currentRetryCount);

    console.log("[roadmap-executor] ✅ Task completed successfully");

    return {
      success: true,
      task,
      output: gatewayResponse.output,
      estimatedCost: gatewayResponse.estimatedCost,
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

    return {
      success: false,
      task,
      error: error.message,
      repairAttempted: false,
    };
  }
}

/**
 * Execute multiple roadmap tasks sequentially
 */
export async function executeRoadmapTasks(
  tasks: RoadmapTask[],
  userId: string = "system"
): Promise<RoadmapExecutionResult[]> {
  console.log("[roadmap-executor] Executing", tasks.length, "tasks sequentially");

  const results: RoadmapExecutionResult[] = [];

  for (const task of tasks) {
    const result = await executeRoadmapTask(task, userId);
    results.push(result);

    if (!result.success) {
      console.warn("[roadmap-executor] Task failed, continuing with remaining tasks");
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log("[roadmap-executor] ✅ Completed", successCount, "/", tasks.length, "tasks successfully");

  return results;
}
