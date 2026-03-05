/**
 * Javari Task Queue System
 * Manages pending, running, and completed roadmap tasks
 */

export interface QueueTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  priority: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
  estimatedCost?: number;
}

// In-memory task queue (production would use database)
let taskQueue: QueueTask[] = [];

/**
 * Add task to queue
 */
export function addTask(task: Omit<QueueTask, "status" | "createdAt">): QueueTask {
  const queueTask: QueueTask = {
    ...task,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  taskQueue.push(queueTask);
  console.log("[task-queue] Task added:", queueTask.id, "| Priority:", queueTask.priority);

  // Sort by priority (higher priority first)
  taskQueue.sort((a, b) => b.priority - a.priority);

  return queueTask;
}

/**
 * Get next pending task (highest priority)
 */
export function getNextTask(): QueueTask | null {
  const nextTask = taskQueue.find(t => t.status === "pending");
  
  if (nextTask) {
    console.log("[task-queue] Next task:", nextTask.id, "| Priority:", nextTask.priority);
  } else {
    console.log("[task-queue] No pending tasks in queue");
  }

  return nextTask || null;
}

/**
 * Mark task as running
 */
export function markRunning(taskId: string): boolean {
  const task = taskQueue.find(t => t.id === taskId);
  
  if (!task) {
    console.warn("[task-queue] Task not found:", taskId);
    return false;
  }

  if (task.status !== "pending") {
    console.warn("[task-queue] Task is not pending:", taskId, "| Status:", task.status);
    return false;
  }

  task.status = "running";
  task.startedAt = new Date().toISOString();
  console.log("[task-queue] Task marked running:", taskId);

  return true;
}

/**
 * Mark task as completed
 */
export function markCompleted(
  taskId: string,
  output: string,
  estimatedCost?: number
): boolean {
  const task = taskQueue.find(t => t.id === taskId);
  
  if (!task) {
    console.warn("[task-queue] Task not found:", taskId);
    return false;
  }

  task.status = "completed";
  task.completedAt = new Date().toISOString();
  task.output = output;
  task.estimatedCost = estimatedCost;
  console.log("[task-queue] Task completed:", taskId, "| Cost: $", (estimatedCost || 0).toFixed(4));

  return true;
}

/**
 * Mark task as failed
 */
export function markFailed(taskId: string, error: string): boolean {
  const task = taskQueue.find(t => t.id === taskId);
  
  if (!task) {
    console.warn("[task-queue] Task not found:", taskId);
    return false;
  }

  task.status = "failed";
  task.completedAt = new Date().toISOString();
  task.error = error;
  console.error("[task-queue] Task failed:", taskId, "| Error:", error);

  return true;
}

/**
 * Get all tasks
 */
export function getAllTasks(): QueueTask[] {
  return [...taskQueue];
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(status: QueueTask["status"]): QueueTask[] {
  return taskQueue.filter(t => t.status === status);
}

/**
 * Get task by ID
 */
export function getTaskById(taskId: string): QueueTask | null {
  return taskQueue.find(t => t.id === taskId) || null;
}

/**
 * Clear completed tasks
 */
export function clearCompleted(): number {
  const completedCount = taskQueue.filter(t => t.status === "completed").length;
  taskQueue = taskQueue.filter(t => t.status !== "completed");
  console.log("[task-queue] Cleared", completedCount, "completed tasks");
  return completedCount;
}

/**
 * Get queue statistics
 */
export function getQueueStats() {
  return {
    total: taskQueue.length,
    pending: taskQueue.filter(t => t.status === "pending").length,
    running: taskQueue.filter(t => t.status === "running").length,
    completed: taskQueue.filter(t => t.status === "completed").length,
    failed: taskQueue.filter(t => t.status === "failed").length,
  };
}
