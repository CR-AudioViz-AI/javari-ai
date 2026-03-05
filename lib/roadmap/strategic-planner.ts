/**
 * Javari Strategic Planning Engine ("Javari Brain")
 * Uses structured multi-agent responses
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
 * Extract tasks from structured role output
 */
function extractTasksFromRoleOutput(output: any): RoadmapItem[] | null {
  console.log("[strategic-planner] Extracting tasks from role output...");
  console.log("[strategic-planner] Output type:", typeof output);
  
  // If already an array, return it
  if (Array.isArray(output)) {
    console.log("[strategic-planner] ✅ Output is already an array");
    return output;
  }
  
  // If it's a string, try to parse it
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        console.log("[strategic-planner] ✅ Parsed string to array");
        return parsed;
      }
    } catch (e) {
      console.warn("[strategic-planner] String is not valid JSON");
    }
  }
  
  // If it's an object with tasks property
  if (output && typeof output === "object" && output.tasks) {
    if (Array.isArray(output.tasks)) {
      console.log("[strategic-planner] ✅ Found tasks property");
      return output.tasks;
    }
  }
  
  console.error("[strategic-planner] Could not extract tasks from output");
  return null;
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
    const planningPrompt = `
STRATEGIC ROADMAP GENERATION

HIGH-LEVEL GOAL:
${goal}

OUTPUT FORMAT - CRITICAL:
Return a JSON array of tasks. Each task must have:
- id (string): Use format "phase{N}-task{M}"
- title (string): Clear, concise task title
- description (string): Detailed description
- priority (number): 1-10, higher = more urgent

Example:
[
  {
    "id": "phase1-task1",
    "title": "Task title",
    "description": "Detailed description",
    "priority": 10
  }
]

Return ONLY the JSON array. No markdown, no code blocks, no extra text.
    `.trim();

    console.log("[strategic-planner] Sending to planning team...");

    const planningResponse = await executeGateway({
      input: planningPrompt,
      mode: "multi",
      userId,
      roles: {
        architect: "gpt-4o",
        builder: "claude-sonnet-4-20250514",
        validator: "gpt-4o",
        documenter: "gpt-4o-mini",
      },
    }) as any; // Cast to access roles property

    console.log("[strategic-planner] ✅ Planning complete");
    console.log("[strategic-planner] Cost: $", (planningResponse.estimatedCost ?? 0).toFixed(4));

    // Check if we have structured role outputs
    if (!planningResponse.roles) {
      console.error("[strategic-planner] No structured role outputs in response");
      return {
        success: false,
        error: "Gateway did not return structured role outputs",
        analysis: planningResponse.output,
      };
    }

    console.log("[strategic-planner] Available roles:", Object.keys(planningResponse.roles));

    // Try each role in order of preference: documenter > builder > architect > validator
    const roleOrder = ["documenter", "builder", "architect", "validator"];
    
    let tasks: RoadmapItem[] | null = null;
    
    for (const role of roleOrder) {
      if (planningResponse.roles[role]) {
        console.log(`[strategic-planner] Trying ${role} output...`);
        tasks = extractTasksFromRoleOutput(planningResponse.roles[role]);
        
        if (tasks && tasks.length > 0) {
          console.log(`[strategic-planner] ✅ Successfully extracted from ${role}`);
          break;
        }
      }
    }

    if (!tasks || tasks.length === 0) {
      console.error("[strategic-planner] Failed to extract tasks from any role");
      console.error("[strategic-planner] Role outputs:", JSON.stringify(planningResponse.roles, null, 2).substring(0, 500));
      
      return {
        success: false,
        error: "Could not extract valid task array from any role output",
        analysis: planningResponse.output,
      };
    }

    // Convert to RoadmapItem format
    const roadmapTasks: RoadmapItem[] = tasks.map((task: any, i: number) => ({
      id: task.id || `task-${Date.now()}-${i}`,
      title: task.title || "Untitled task",
      description: task.description || "",
      priority: task.priority || 5,
    }));

    console.log("[strategic-planner] ✅ Successfully generated", roadmapTasks.length, "tasks");

    return {
      success: true,
      tasks: roadmapTasks,
      analysis: planningResponse.output,
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
