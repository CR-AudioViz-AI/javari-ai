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
  getQueueStats,
} from "./task-queue";

// Execution lock to prevent concurrent task execution
let isRunning = false;

// Autonomous mode safety limit
const MAX_TASKS_PER_RUN = 5;
const TASK_DELAY_MS = 3000; // 3 seconds between tasks

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
 * Run autonomous execution loop
 * Executes tasks continuously until queue is empty or max limit reached
 * 
 * Safety controls:
 * - Max tasks per run: 5
 * - 3 second delay between tasks
 * - Stops on empty queue
 */
export async function runAutonomousLoop(
  userId: string = "system"
): Promise<{
  success: boolean;
  tasksExecuted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  results: any[];
  stoppedReason: string;
}> {
  console.log("[task-runner] ====== AUTONOMOUS MODE START ======");
  console.log("[task-runner] User:", userId);
  console.log("[task-runner] Max tasks per run:", MAX_TASKS_PER_RUN);

  const results: any[] = [];
  let tasksExecuted = 0;
  let tasksSucceeded = 0;
  let tasksFailed = 0;

  // Check initial queue status
  const initialStats = getQueueStats();
  console.log("[task-runner] Initial queue stats:", initialStats);

  if (initialStats.pending === 0) {
    console.log("[task-runner] No pending tasks - autonomous mode stopping");
    return {
      success: true,
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      results: [],
      stoppedReason: "No pending tasks in queue",
    };
  }

  // Execute tasks up to maximum
  for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
    console.log(`[task-runner] Autonomous iteration ${i + 1}/${MAX_TASKS_PER_RUN}`);

    // Check if there are pending tasks
    const nextTask = getNextTask();
    
    if (!nextTask) {
      console.log("[task-runner] Queue empty - stopping autonomous mode");
      return {
        success: true,
        tasksExecuted,
        tasksSucceeded,
        tasksFailed,
        results,
        stoppedReason: "Queue exhausted - all tasks completed",
      };
    }

    // Execute next task
    const result = await runNextTask(userId);
    results.push(result);
    tasksExecuted++;

    if (result.success) {
      tasksSucceeded++;
      console.log(`[task-runner] ✅ Task ${i + 1} succeeded`);
    } else {
      tasksFailed++;
      console.error(`[task-runner] ❌ Task ${i + 1} failed:`, result.error);
    }

    // Delay before next task (unless this was the last iteration)
    if (i < MAX_TASKS_PER_RUN - 1) {
      console.log(`[task-runner] Waiting ${TASK_DELAY_MS}ms before next task...`);
      await new Promise(resolve => setTimeout(resolve, TASK_DELAY_MS));
    }
  }

  console.log("[task-runner] ====== AUTONOMOUS MODE COMPLETE ======");
  console.log("[task-runner] Tasks executed:", tasksExecuted);
  console.log("[task-runner] Succeeded:", tasksSucceeded);
  console.log("[task-runner] Failed:", tasksFailed);

  return {
    success: true,
    tasksExecuted,
    tasksSucceeded,
    tasksFailed,
    results,
    stoppedReason: `Maximum task limit reached (${MAX_TASKS_PER_RUN})`,
  };
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
