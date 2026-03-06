/**
 * Javari Strategic Planning Engine ("Javari Brain")
 * Consumes structured multi-agent gateway responses
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
    }) as any;

    console.log("[strategic-planner] ✅ Planning complete");
    console.log("[strategic-planner] Cost: $", (planningResponse.estimatedCost ?? 0).toFixed(4));

    // NEW: Read structured role outputs instead of parsing concatenated text
    const roles = planningResponse.roles;
    
    if (!roles) {
      console.error("[strategic-planner] ❌ Gateway did not return structured role outputs");
      console.error("[strategic-planner] Response keys:", Object.keys(planningResponse));
      
      // Fallback: try legacy output field
      if (planningResponse.output) {
        console.warn("[strategic-planner] Falling back to legacy output parsing");
        return {
          success: false,
          error: "Gateway returned legacy format instead of structured roles",
          analysis: planningResponse.output,
        };
      }
      
      return {
        success: false,
        error: "Gateway did not return structured role outputs",
      };
    }

    console.log("[strategic-planner] ✅ Structured roles received:", Object.keys(roles));

    // Try each role in order of preference: documenter > builder > architect > validator
    const roleOrder = ["documenter", "builder", "architect", "validator"];
    
    let tasks: any = null;
    let sourceRole = "";
    
    for (const role of roleOrder) {
      if (roles[role]) {
        console.log(`[strategic-planner] Trying ${role} output...`);
        const roleOutput = roles[role];
        
        // If it's already an array, use it
        if (Array.isArray(roleOutput)) {
          tasks = roleOutput;
          sourceRole = role;
          break;
        }
        
        // If it's a string, try to parse it
        if (typeof roleOutput === "string") {
          try {
            const parsed = JSON.parse(roleOutput);
            if (Array.isArray(parsed)) {
              tasks = parsed;
              sourceRole = role;
              break;
            }
          } catch (e) {
            console.warn(`[strategic-planner] ${role} output is not valid JSON`);
          }
        }
        
        // If it's an object with tasks property
        if (roleOutput && typeof roleOutput === "object" && roleOutput.tasks) {
          if (Array.isArray(roleOutput.tasks)) {
            tasks = roleOutput.tasks;
            sourceRole = role;
            break;
          }
        }
      }
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      console.error("[strategic-planner] ❌ Could not extract task array from any role");
      console.error("[strategic-planner] Available roles:", Object.keys(roles));
      
      return {
        success: false,
        error: "Could not extract valid task array from role outputs",
        analysis: JSON.stringify(roles, null, 2),
      };
    }

    console.log(`[strategic-planner] ✅ Extracted ${tasks.length} tasks from ${sourceRole}`);

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
      analysis: `Generated from ${sourceRole} role`,
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
