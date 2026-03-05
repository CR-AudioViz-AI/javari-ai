/**
 * Javari Strategic Planning Engine ("Javari Brain")
 * Generates comprehensive roadmaps from high-level goals using multi-agent system
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
 * 
 * Uses 4-role multi-agent system:
 * - Architect: Breaks goal into strategic phases
 * - Builder: Converts phases into actionable tasks
 * - Validator: Verifies task feasibility and completeness
 * - Documenter: Produces final structured roadmap
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

INSTRUCTIONS FOR MULTI-AGENT TEAM:

ARCHITECT:
- Break down the goal into logical phases
- Identify key milestones and dependencies
- Define success criteria for each phase
- Assign priority levels (1-10, higher = more urgent)

BUILDER:
- Convert each phase into specific, actionable tasks
- Ensure tasks are atomic and executable
- Include technical details and requirements
- Define clear deliverables for each task

VALIDATOR:
- Verify task feasibility and completeness
- Check for missing dependencies or gaps
- Ensure proper sequencing and priorities
- Validate that tasks will achieve the goal

DOCUMENTER:
- Produce a final structured roadmap in JSON format
- Each task must include: id, title, description, priority
- Use format: phase{N}-task{M} for task IDs
- Ensure tasks are ordered by priority and dependency

OUTPUT FORMAT (REQUIRED):
Return ONLY a valid JSON array with this exact structure:
[
  {
    "id": "phase1-task1",
    "title": "Clear, concise task title",
    "description": "Detailed description of what needs to be done, including specific requirements and expected outcomes",
    "priority": 10
  }
]

CRITICAL: Return ONLY the JSON array, no additional text, markdown, or explanation.
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
    });

    console.log("[strategic-planner] ✅ Planning complete");
    console.log("[strategic-planner] Cost: $", (planningResponse.estimatedCost ?? 0).toFixed(4));

    // Extract JSON from output
    const output = planningResponse.output;
    console.log("[strategic-planner] Parsing roadmap from output...");

    // Try to extract JSON array from the output
    let tasks: RoadmapItem[] = [];
    
    // Look for JSON array in the output
    const jsonMatch = output.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (Array.isArray(parsed)) {
          tasks = parsed.map((task: any) => ({
            id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: task.title || "Untitled task",
            description: task.description || "",
            priority: task.priority || 5,
          }));
          
          console.log("[strategic-planner] ✅ Parsed", tasks.length, "tasks from roadmap");
        }
      } catch (parseError: any) {
        console.error("[strategic-planner] JSON parse error:", parseError.message);
        return {
          success: false,
          error: `Failed to parse roadmap JSON: ${parseError.message}`,
        };
      }
    } else {
      console.warn("[strategic-planner] No JSON array found in output, attempting fallback parsing...");
      
      // Fallback: Try to create tasks from the text output
      // This is a simple fallback - in production would be more sophisticated
      const sections = output.split(/===\s*\w+\s*===/);
      
      if (sections.length > 1) {
        // Take the documenter's section (usually last)
        const documenterSection = sections[sections.length - 1];
        const jsonMatch2 = documenterSection.match(/\[\s*\{[\s\S]*\}\s*\]/);
        
        if (jsonMatch2) {
          try {
            const parsed = JSON.parse(jsonMatch2[0]);
            if (Array.isArray(parsed)) {
              tasks = parsed.map((task: any) => ({
                id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: task.title || "Untitled task",
                description: task.description || "",
                priority: task.priority || 5,
              }));
              
              console.log("[strategic-planner] ✅ Fallback parsing succeeded:", tasks.length, "tasks");
            }
          } catch {}
        }
      }
    }

    if (tasks.length === 0) {
      console.error("[strategic-planner] Failed to extract tasks from output");
      return {
        success: false,
        error: "AI team did not produce valid roadmap JSON. Please try again with a clearer goal.",
        analysis: output,
      };
    }

    console.log("[strategic-planner] ✅ Roadmap generation complete");
    console.log("[strategic-planner] Generated tasks:", tasks.length);

    return {
      success: true,
      tasks,
      analysis: output,
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
