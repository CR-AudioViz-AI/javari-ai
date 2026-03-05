/**
 * Javari Task Runner
 * Automatically executes tasks from the queue
 */

import { executeRoadmapTask, RoadmapTask } from "./roadmap-executor";
import {
  getNextTask,
  markRunning,
  markCompleted,
  markFailed,
  QueueTask,
} from "./task-queue";

// Execution lock to prevent concurrent task execution
let isRunning = false;

/**
 * Run the next pending task from the queue
 * Safety: Only one task can run at a time
 */
export async function runNextTask(userId: string = "system"): Promise<{
  success: boolean;
  task?: QueueTask;
  output?: string;
  error?: string;
}> {
  console.log("[task-runner] ====== RUN NEXT TASK ======");

  // Check if another task is already running
  if (isRunning) {
    console.warn("[task-runner] ⚠️  A task is already running - blocking concurrent execution");
    return {
      success: false,
      error: "A task is already running. Only one task can execute at a time.",
    };
  }

  // Get next pending task
  const queueTask = getNextTask();

  if (!queueTask) {
    console.log("[task-runner] No pending tasks in queue");
    return {
      success: false,
      error: "No pending tasks in queue",
    };
  }

  // Acquire execution lock
  isRunning = true;
  console.log("[task-runner] 🔒 Lock acquired - starting task:", queueTask.id);

  try {
    // Mark task as running
    markRunning(queueTask.id);

    // Convert QueueTask to RoadmapTask
    const roadmapTask: RoadmapTask = {
      id: queueTask.id,
      title: queueTask.title,
      description: queueTask.description,
      status: "running",
    };

    console.log("[task-runner] Executing task:", queueTask.id);
    console.log("[task-runner] Title:", queueTask.title);

    // Execute task through roadmap executor
    const result = await executeRoadmapTask(roadmapTask, userId);

    if (result.success) {
      // Mark as completed
      markCompleted(
        queueTask.id,
        result.output || "",
        result.estimatedCost
      );

      console.log("[task-runner] ✅ Task completed successfully");

      return {
        success: true,
        task: queueTask,
        output: result.output,
      };
    } else {
      // Mark as failed
      markFailed(queueTask.id, result.error || "Unknown error");

      console.error("[task-runner] ❌ Task failed:", result.error);

      return {
        success: false,
        task: queueTask,
        error: result.error,
      };
    }
  } catch (error: any) {
    console.error("[task-runner] ❌ Unexpected error:", error.message);

    // Mark as failed
    markFailed(queueTask.id, error.message);

    return {
      success: false,
      task: queueTask,
      error: error.message,
    };
  } finally {
    // Release execution lock
    isRunning = false;
    console.log("[task-runner] 🔓 Lock released");
  }
}

/**
 * Check if a task is currently running
 */
export function isTaskRunning(): boolean {
  return isRunning;
}

/**
 * Get current execution status
 */
export function getExecutionStatus() {
  return {
    isRunning,
    message: isRunning ? "A task is currently executing" : "No tasks running",
  };
}
