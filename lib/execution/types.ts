export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  status: string;
  depends_on?: string[] | null;
}

// Helper functions for queue.ts to implement
export async function fetchPendingTasks(): Promise<RoadmapTask[]> {
  // This will be implemented by queue.ts
  return [];
}

export async function markTaskRunning(task: RoadmapTask): Promise<void> {
  // This will be implemented by queue.ts
}

export async function markTaskComplete(
  task: RoadmapTask,
  result: any
): Promise<void> {
  // This will be implemented by queue.ts
}

export async function markTaskFailed(
  task: RoadmapTask,
  error: string
): Promise<void> {
  // This will be implemented by queue.ts
}
