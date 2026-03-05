/**
 * Javari Roadmap Execution Engine
 * Executes roadmap tasks using the 4-role multi-agent system
 */

import { executeGateway } from "@/lib/execution/gateway";

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
 * 
 * Workflow:
 * 1. Architect - Design task plan and approach
 * 2. Builder - Implement the solution
 * 3. Validator - Verify correctness and quality
 * 4. Documenter - Create structured documentation
 */
export async function executeRoadmapTask(
  task: RoadmapTask,
  userId: string = "system"
): Promise<RoadmapExecutionResult> {
  console.log("[roadmap-executor] ====== TASK EXECUTION START ======");
  console.log("[roadmap-executor] Task ID:", task.id);
  console.log("[roadmap-executor] Title:", task.title);
  console.log("[roadmap-executor] User:", userId);

  // Update task status to running
  task.status = "running";
  task.executedAt = new Date();

  try {
    // Prepare comprehensive prompt for multi-agent execution
    const prompt = `
ROADMAP TASK EXECUTION

Task ID: ${task.id}
Title: ${task.title}

Description:
${task.description}

Please analyze, implement, validate, and document this task comprehensively.
    `.trim();

    console.log("[roadmap-executor] Executing via multi-agent gateway...");

    // Execute through gateway with 4-role system
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

    // Update task with results
    task.status = "completed";
    task.output = gatewayResponse.output;
    task.estimatedCost = gatewayResponse.estimatedCost;
    task.rolesExecuted = (gatewayResponse as any).rolesExecuted || ["architect", "builder", "validator", "documenter"];
    task.completedAt = new Date();

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

    // Update task status to failed
    task.status = "failed";
    task.error = error.message;
    task.completedAt = new Date();

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

    // Stop on first failure if desired (can be made configurable)
    if (!result.success) {
      console.warn("[roadmap-executor] Task failed, continuing with remaining tasks");
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log("[roadmap-executor] ✅ Completed", successCount, "/", tasks.length, "tasks successfully");

  return results;
}
