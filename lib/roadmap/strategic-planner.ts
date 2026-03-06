/**
 * Javari Strategic Planning Engine
 * Consumes strict JSON task schema from multi-agent gateway
 */

import { executeGateway } from "@/lib/execution/gateway";
import { RoadmapItem, loadRoadmap } from "./roadmap-loader";

export interface StrategicPlanResult {
  success: boolean;
  tasks?: RoadmapItem[];
  analysis?: string;
  error?: string;
  estimatedCost?: number;
}

/**
 * Generate a comprehensive roadmap from a high-level goal
 */
export async function generateRoadmap(
  goal: string,
  userId: string = "strategic-planner"
): Promise<StrategicPlanResult> {
  console.log("[strategic-planner] ====== ROADMAP GENERATION ======");
  console.log("[strategic-planner] Goal:", goal);

  try {
    const planningResponse = await executeGateway({
      input: goal,
      mode: "multi",
      userId,
      roles: {
        architect: "gpt-4o",
        builder: "claude-sonnet-4-20250514",
        validator: "gpt-4o",
        documenter: "gpt-4o-mini",
      },
    }) as any;

    console.log("[strategic-planner] ✅ Planning complete");
    console.log("[strategic-planner] Cost: $", (planningResponse.estimatedCost ?? 0).toFixed(4));

    // Gateway now returns validated tasks array directly
    const tasks = planningResponse.tasks;
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      console.error("[strategic-planner] ❌ No tasks returned from gateway");
      
      return {
        success: false,
        error: "Gateway did not return valid tasks array",
      };
    }

    console.log(`[strategic-planner] ✅ Received ${tasks.length} validated tasks`);

    // Convert to RoadmapItem format
    const roadmapTasks: RoadmapItem[] = tasks.map((task: any, i: number) => ({
      id: `task-${Date.now()}-${i}`,
      title: task.title || "Untitled task",
      description: task.description || "",
      priority: task.priority === "high" ? 10 : task.priority === "medium" ? 5 : 3,
    }));

    console.log("[strategic-planner] ✅ Successfully generated", roadmapTasks.length, "tasks");

    return {
      success: true,
      tasks: roadmapTasks,
      analysis: `Generated ${roadmapTasks.length} tasks from multi-agent team`,
      estimatedCost: planningResponse.estimatedCost,
    };
  } catch (error: any) {
    console.error("[strategic-planner] ❌ Planning failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate roadmap and optionally load into queue
 */
export async function generateAndQueueRoadmap(
  goal: string,
  autoQueue: boolean = false,
  userId: string = "strategic-planner"
): Promise<StrategicPlanResult & { tasksQueued?: number }> {
  console.log("[strategic-planner] Generate and queue:", { goal, autoQueue });

  const result = await generateRoadmap(goal, userId);

  if (!result.success || !result.tasks) {
    return result;
  }

  if (autoQueue && result.tasks.length > 0) {
    console.log("[strategic-planner] Auto-queueing", result.tasks.length, "tasks...");
    
    const loadResult = loadRoadmap(result.tasks);
    
    console.log("[strategic-planner] ✅ Queued", loadResult.tasksLoaded, "tasks");

    return {
      ...result,
      tasksQueued: loadResult.tasksLoaded,
    };
  }

  return result;
}
