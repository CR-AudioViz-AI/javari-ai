/**
 * Javari Strategic Planning Engine ("Javari Brain")
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
 * Extract JSON from multi-agent response with proper unescaping
 */
function extractJSON(text: string): any[] | null {
  console.log("[strategic-planner] Extracting JSON from response...");
  
  // The response format is: {"success":true,"content":"[...]"}
  // The content is triple-escaped, so we need to unescape it properly
  
  // Strategy 1: Extract from content field in success wrapper
  const contentPattern = /"content"\s*:\s*"([\s\S]*?)"\s*,?\s*"provider"/;
  const match = text.match(contentPattern);
  
  if (match) {
    try {
      let content = match[1];
      console.log("[strategic-planner] Found content field, length:", content.length);
      
      // Unescape: \\\" -> \" and \\n -> \n
      content = content
        .replace(/\\\\n/g, '\n')           // \\n -> \n
        .replace(/\\\\\"/g, '"')           // \\" -> "
        .replace(/\\\\/g, '\\');           // \\ -> \
      
      console.log("[strategic-planner] After first unescape, preview:", content.substring(0, 200));
      
      // Parse to get the actual JSON array
      const parsed = JSON.parse(content);
      
      if (Array.isArray(parsed)) {
        console.log("[strategic-planner] ✅ Successfully extracted", parsed.length, "tasks");
        return parsed;
      }
    } catch (e: any) {
      console.error("[strategic-planner] Strategy 1 failed:", e.message);
    }
  }
  
  // Strategy 2: Direct array extraction (fallback)
  const arrayPattern = /\[\s*\{[\s\S]*?\}\s*\]/;
  const arrayMatch = text.match(arrayPattern);
  
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        console.log("[strategic-planner] ✅ Fallback extraction successful:", parsed.length, "tasks");
        return parsed;
      }
    } catch (e: any) {
      console.error("[strategic-planner] Strategy 2 failed:", e.message);
    }
  }
  
  console.error("[strategic-planner] ❌ All extraction strategies failed");
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

OUTPUT FORMAT (CRITICAL):
Return a valid JSON array with NO markdown, NO code blocks, NO extra text.
Just the raw JSON array starting with [ and ending with ]:

[
  {
    "id": "phase1-task1",
    "title": "Clear task title",
    "description": "Detailed description of what needs to be done",
    "priority": 10
  },
  {
    "id": "phase1-task2",
    "title": "Another task",
    "description": "Another description",
    "priority": 9
  }
]

CRITICAL: Output ONLY the JSON array. No markdown formatting, no explanation, no code blocks.
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

    const output = planningResponse.output;
    console.log("[strategic-planner] Response length:", output.length);

    // Extract JSON using robust strategies
    const extractedTasks = extractJSON(output);
    
    if (!extractedTasks || !Array.isArray(extractedTasks) || extractedTasks.length === 0) {
      console.error("[strategic-planner] ❌ JSON extraction failed");
      console.error("[strategic-planner] Response preview:", output.substring(0, 500));
      
      return {
        success: false,
        error: "Failed to extract valid roadmap from AI response",
        analysis: output,
      };
    }

    // Convert to RoadmapItem format
    const tasks: RoadmapItem[] = extractedTasks.map((task: any, i: number) => ({
      id: task.id || `task-${Date.now()}-${i}`,
      title: task.title || "Untitled task",
      description: task.description || "",
      priority: task.priority || 5,
    }));

    console.log("[strategic-planner] ✅ Successfully parsed", tasks.length, "tasks");

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
