/**
 * Javari Roadmap Loader
 * Loads roadmap items into the task queue for execution
 */

import { addTask, getQueueStats, QueueTask } from "./task-queue";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  priority: number;
}

export interface LoadRoadmapResult {
  success: boolean;
  tasksLoaded: number;
  tasks: QueueTask[];
  queueStats: ReturnType<typeof getQueueStats>;
  errors?: string[];
}

/**
 * Load multiple roadmap items into the task queue
 * 
 * @param items - Array of roadmap items to load
 * @returns Result with number of tasks loaded and queue statistics
 */
export function loadRoadmap(items: RoadmapItem[]): LoadRoadmapResult {
  console.log("[roadmap-loader] ====== LOADING ROADMAP ======");
  console.log("[roadmap-loader] Items to load:", items.length);

  const loadedTasks: QueueTask[] = [];
  const errors: string[] = [];

  for (const item of items) {
    try {
      console.log("[roadmap-loader] Loading task:", item.id, "| Priority:", item.priority);

      // Validate item
      if (!item.id || !item.title || !item.description) {
        const error = `Invalid item: ${item.id || "unknown"} - missing required fields`;
        console.error("[roadmap-loader]", error);
        errors.push(error);
        continue;
      }

      // Add to queue
      const task = addTask({
        id: item.id,
        title: item.title,
        description: item.description,
        priority: item.priority,
      });

      loadedTasks.push(task);
      console.log("[roadmap-loader] ✓ Task added:", task.id);
    } catch (error: any) {
      const errorMsg = `Failed to load ${item.id}: ${error.message}`;
      console.error("[roadmap-loader]", errorMsg);
      errors.push(errorMsg);
    }
  }

  const queueStats = getQueueStats();

  console.log("[roadmap-loader] ✅ Roadmap loaded");
  console.log("[roadmap-loader] Tasks loaded:", loadedTasks.length);
  console.log("[roadmap-loader] Errors:", errors.length);
  console.log("[roadmap-loader] Queue stats:", queueStats);

  return {
    success: loadedTasks.length > 0,
    tasksLoaded: loadedTasks.length,
    tasks: loadedTasks,
    queueStats,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Load roadmap from a predefined template
 */
export function loadRoadmapTemplate(templateName: string): LoadRoadmapResult {
  console.log("[roadmap-loader] Loading template:", templateName);

  // Template roadmaps (can be extended)
  const templates: Record<string, RoadmapItem[]> = {
    "basic-auth": [
      {
        id: "auth-1",
        title: "Design authentication architecture",
        description: "Design JWT-based authentication system with email/password login, token refresh, and secure session management",
        priority: 10,
      },
      {
        id: "auth-2",
        title: "Implement user registration",
        description: "Create API endpoint for user registration with email validation, password hashing, and account activation",
        priority: 9,
      },
      {
        id: "auth-3",
        title: "Implement login endpoint",
        description: "Build login endpoint with JWT token generation, refresh tokens, and rate limiting",
        priority: 8,
      },
      {
        id: "auth-4",
        title: "Add password reset flow",
        description: "Implement forgot password and reset password functionality with secure token generation",
        priority: 7,
      },
    ],
    "api-backend": [
      {
        id: "api-1",
        title: "Design API architecture",
        description: "Design RESTful API structure with proper routing, middleware, and error handling",
        priority: 10,
      },
      {
        id: "api-2",
        title: "Implement database schema",
        description: "Create database schema with proper relationships, indexes, and constraints",
        priority: 9,
      },
      {
        id: "api-3",
        title: "Build CRUD endpoints",
        description: "Implement Create, Read, Update, Delete endpoints for core resources",
        priority: 8,
      },
      {
        id: "api-4",
        title: "Add API documentation",
        description: "Generate comprehensive API documentation with examples and integration guide",
        priority: 6,
      },
    ],
  };

  const template = templates[templateName];

  if (!template) {
    console.error("[roadmap-loader] Template not found:", templateName);
    return {
      success: false,
      tasksLoaded: 0,
      tasks: [],
      queueStats: getQueueStats(),
      errors: [`Template '${templateName}' not found`],
    };
  }

  return loadRoadmap(template);
}

/**
 * Get available roadmap templates
 */
export function getAvailableTemplates(): string[] {
  return ["basic-auth", "api-backend"];
}
