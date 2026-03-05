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
 * Extract and clean JSON from AI response
 */
function extractJSON(text: string): any[] | null {
  console.log("[strategic-planner] Extracting JSON from response...");
  
  // Try multiple extraction strategies
  
  // Strategy 1: Look for JSON array in the text
  const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrayMatch) {
    try {
      const cleaned = arrayMatch[0]
        .replace(/\\n/g, '')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      
      console.log("[strategic-planner] Strategy 1: Found JSON array, attempting parse...");
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn("[strategic-planner] Strategy 1 parse failed, trying next...");
    }
  }
  
  // Strategy 2: Look for content field with escaped JSON
  const contentMatch = text.match(/"content"\s*:\s*"([\s\S]*?)"/);
  if (contentMatch) {
    try {
      // Unescape the content
      let content = contentMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      
      console.log("[strategic-planner] Strategy 2: Found content field...");
      console.log("[strategic-planner] Content preview:", content.substring(0, 200));
      
      // Now extract array from unescaped content
      const innerArrayMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (innerArrayMatch) {
        return JSON.parse(innerArrayMatch[0]);
      }
    } catch (e) {
      console.warn("[strategic-planner] Strategy 2 parse failed, trying next...");
    }
  }
  
  // Strategy 3: Look for "tasks" field
  const tasksMatch = text.match(/"tasks"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/);
  if (tasksMatch) {
    try {
      console.log("[strategic-planner] Strategy 3: Found tasks field...");
      return JSON.parse(tasksMatch[1]);
    } catch (e) {
      console.warn("[strategic-planner] Strategy 3 parse failed...");
    }
  }
  
  // Strategy 4: Try to extract from DOCUMENTER section
  const documenterMatch = text.match(/===\s*DOCUMENTER\s*===[\s\S]*?(\[\s*\{[\s\S]*?\}\s*\])/);
  if (documenterMatch) {
    try {
      console.log("[strategic-planner] Strategy 4: Found in DOCUMENTER section...");
      const cleaned = documenterMatch[1]
        .replace(/\\n/g, '')
        .replace(/\\"/g, '"');
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn("[strategic-planner] Strategy 4 parse failed...");
    }
  }
  
  console.error("[strategic-planner] All JSON extraction strategies failed");
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
    console.log("[strategic-planner] Response preview:", output.substring(0, 300));

    // Extract JSON using robust strategies
    const extractedTasks = extractJSON(output);
    
    if (!extractedTasks || !Array.isArray(extractedTasks) || extractedTasks.length === 0) {
      console.error("[strategic-planner] ❌ JSON extraction failed");
      console.error("[strategic-planner] Full response:", output);
      
      return {
        success: false,
        error: "Failed to extract valid roadmap from AI response. The AI team generated content but it could not be parsed.",
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
