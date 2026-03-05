/**
 * Javari Roadmap Execution Engine
 * Executes roadmap tasks using the 4-role multi-agent system
 */

import { executeGateway } from "@/lib/execution/gateway";
import { storeExecutionResult } from "./execution-memory";

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
}

export interface RoadmapExecutionResult {
  success: boolean;
  task: RoadmapTask;
  output?: string;
  estimatedCost?: number;
  rolesExecuted?: string[];
  error?: string;
}

/**
 * Execute a roadmap task using the multi-agent system
 */
export async function executeRoadmapTask(
  task: RoadmapTask,
  userId: string = "system"
): Promise<RoadmapExecutionResult> {
  console.log("[roadmap-executor] ====== TASK EXECUTION START ======");
  console.log("[roadmap-executor] Task ID:", task.id);
  console.log("[roadmap-executor] Title:", task.title);
  console.log("[roadmap-executor] User:", userId);

  task.status = "running";
  task.executedAt = new Date();

  try {
    const prompt = `
ROADMAP TASK EXECUTION

Task ID: ${task.id}
Title: ${task.title}

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
    });

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

    // Store failure in execution memory
    console.log("[roadmap-executor] Storing failure in execution memory...");
    await storeExecutionResult(task.id, task.title, {
      success: false,
      error: error.message,
    });

    return {
      success: false,
      task,
      error: error.message,
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
