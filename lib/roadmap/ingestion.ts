/**
 * Roadmap Ingestion Engine
 * Converts various roadmap formats into standardized RoadmapItem format
 */

import { RoadmapItem } from "./roadmap-loader";

export interface IngestionResult {
  success: boolean;
  tasks: RoadmapItem[];
  error?: string;
  tasksIngested: number;
}

/**
 * Ingest roadmap from various formats
 */
export function ingestRoadmap(
  source: any,
  format: "json" | "markdown" | "csv" | "auto" = "auto"
): IngestionResult {
  console.log("[ingestion] Starting roadmap ingestion");
  console.log("[ingestion] Format:", format);

  try {
    if (format === "json" || (format === "auto" && Array.isArray(source))) {
      return ingestFromJSON(source);
    }

    if (format === "markdown" || (format === "auto" && typeof source === "string")) {
      return ingestFromMarkdown(source);
    }

    return {
      success: false,
      tasks: [],
      error: "Unsupported format",
      tasksIngested: 0,
    };

  } catch (error: any) {
    console.error("[ingestion] Error:", error.message);
    return {
      success: false,
      tasks: [],
      error: error.message,
      tasksIngested: 0,
    };
  }
}

/**
 * Ingest from JSON array
 */
function ingestFromJSON(tasks: any[]): IngestionResult {
  if (!Array.isArray(tasks)) {
    return {
      success: false,
      tasks: [],
      error: "Expected array of tasks",
      tasksIngested: 0,
    };
  }

  const roadmapTasks: RoadmapItem[] = tasks.map((task, index) => ({
    id: task.id || task.task_id || `task-${Date.now()}-${index}`,
    title: task.title || task.name || `Task ${index + 1}`,
    description: task.description || task.desc || "",
    priority: task.priority || 5,
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
  }));

  return {
    success: true,
    tasks: roadmapTasks,
    tasksIngested: roadmapTasks.length,
  };
}

/**
 * Ingest from Markdown format
 */
function ingestFromMarkdown(markdown: string): IngestionResult {
  const tasks: RoadmapItem[] = [];
  const lines = markdown.split("\n");
  
  let currentTask: Partial<RoadmapItem> | null = null;
  let taskCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Task title (starts with ## or -)
    if (trimmed.startsWith("##") || trimmed.match(/^-\s+\*\*/)) {
      // Save previous task
      if (currentTask && currentTask.title) {
        tasks.push({
          id: currentTask.id || `task-${Date.now()}-${taskCounter++}`,
          title: currentTask.title,
          description: currentTask.description || "",
          priority: currentTask.priority || 5,
          dependencies: currentTask.dependencies || [],
        });
      }

      // Start new task
      const title = trimmed
        .replace(/^##\s*/, "")
        .replace(/^-\s+\*\*/, "")
        .replace(/\*\*$/, "")
        .trim();

      currentTask = {
        title,
        description: "",
        priority: 5,
        dependencies: [],
      };
    }
    // Description
    else if (currentTask && trimmed.length > 0 && !trimmed.startsWith("#")) {
      currentTask.description = (currentTask.description || "") + trimmed + " ";
    }
  }

  // Save last task
  if (currentTask && currentTask.title) {
    tasks.push({
      id: currentTask.id || `task-${Date.now()}-${taskCounter++}`,
      title: currentTask.title,
      description: currentTask.description?.trim() || "",
      priority: currentTask.priority || 5,
      dependencies: currentTask.dependencies || [],
    });
  }

  return {
    success: true,
    tasks,
    tasksIngested: tasks.length,
  };
}
