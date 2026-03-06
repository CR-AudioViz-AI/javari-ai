/**
 * Javari Task Decomposition Engine
 * Breaks large roadmap items into executable subtasks
 */

import { executeGateway } from "@/lib/execution/gateway";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface SubTask {
  subtask_id: string;
  task_id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  dependencies: string[];
  created_at: string;
}

export interface DecompositionResult {
  success: boolean;
  subtasks?: SubTask[];
  error?: string;
  originalTaskId?: string;
}

/**
 * Decompose a large roadmap task into smaller executable subtasks
 */
export async function decomposeTask(
  taskId: string,
  taskTitle: string,
  taskDescription: string,
  userId: string = "decomposer"
): Promise<DecompositionResult> {
  console.log("[decompose] ====== TASK DECOMPOSITION ======");
  console.log("[decompose] Task ID:", taskId);
  console.log("[decompose] Title:", taskTitle);

  try {
    const decompositionPrompt = `
TASK DECOMPOSITION REQUEST

Parent Task: ${taskTitle}
Description: ${taskDescription}

Your job is to break this task into smaller, executable subtasks.

RULES:
1. Each subtask should be completable in 1-4 hours
2. Subtasks must be in dependency order (prerequisites first)
3. Include clear acceptance criteria
4. Identify dependencies between subtasks

OUTPUT FORMAT (MANDATORY):
Return ONLY valid JSON:

{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "What needs to be done and acceptance criteria",
      "dependencies": []
    },
    {
      "title": "Next subtask",
      "description": "Depends on previous subtask",
      "dependencies": ["subtask-1"]
    }
  ]
}

Return ONLY the JSON. No markdown, no explanations.
    `.trim();

    console.log("[decompose] Sending to decomposition agent...");

    const response = await executeGateway({
      input: decompositionPrompt,
      mode: "auto",
      userId,
    }) as any;

    console.log("[decompose] ✅ Decomposition complete");

    // Parse the response
    let parsedResponse: any;
    
    if (typeof response.output === "object") {
      parsedResponse = response.output;
    } else if (typeof response.output === "string") {
      try {
        parsedResponse = JSON.parse(response.output);
      } catch (e) {
        // Try to extract JSON from markdown
        const jsonMatch = response.output.match(/\{[\s\S]*"subtasks"[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not parse decomposition response");
        }
      }
    }

    if (!parsedResponse?.subtasks || !Array.isArray(parsedResponse.subtasks)) {
      throw new Error("Invalid decomposition response format");
    }

    console.log(`[decompose] ✅ Generated ${parsedResponse.subtasks.length} subtasks`);

    // Create subtask objects with proper IDs
    const timestamp = Date.now();
    const subtasks: SubTask[] = parsedResponse.subtasks.map((st: any, index: number) => ({
      subtask_id: `subtask-${timestamp}-${index}`,
      task_id: taskId,
      title: st.title || "Untitled subtask",
      description: st.description || "",
      status: "pending" as const,
      dependencies: Array.isArray(st.dependencies) ? st.dependencies : [],
      created_at: new Date().toISOString(),
    }));

    // Save to database
    const saveResult = await saveSubtasksToDatabase(subtasks);
    
    if (!saveResult.success) {
      console.warn("[decompose] ⚠️ Failed to save to database:", saveResult.error);
      // Continue anyway, return subtasks even if DB save failed
    } else {
      console.log(`[decompose] ✅ Saved ${subtasks.length} subtasks to database`);
    }

    return {
      success: true,
      subtasks,
      originalTaskId: taskId,
    };

  } catch (error: any) {
    console.error("[decompose] ❌ Decomposition failed:", error.message);
    return {
      success: false,
      error: error.message,
      originalTaskId: taskId,
    };
  }
}

/**
 * Save subtasks to database
 */
async function saveSubtasksToDatabase(subtasks: SubTask[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("roadmap_subtasks")
      .insert(subtasks.map(st => ({
        subtask_id: st.subtask_id,
        task_id: st.task_id,
        title: st.title,
        description: st.description,
        status: st.status,
        dependencies: st.dependencies,
        created_at: st.created_at,
      })));

    if (error) {
      console.error("[decompose] Database error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error: any) {
    console.error("[decompose] Database save failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all subtasks for a parent task
 */
export async function getSubtasks(taskId: string): Promise<SubTask[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("roadmap_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[decompose] Error fetching subtasks:", error.message);
      return [];
    }

    return data || [];

  } catch (error: any) {
    console.error("[decompose] Failed to fetch subtasks:", error.message);
    return [];
  }
}

/**
 * Update subtask status
 */
export async function updateSubtaskStatus(
  subtaskId: string,
  status: SubTask["status"]
): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("roadmap_subtasks")
      .update({ status })
      .eq("subtask_id", subtaskId);

    if (error) {
      console.error("[decompose] Error updating subtask:", error.message);
      return false;
    }

    console.log(`[decompose] ✅ Updated subtask ${subtaskId} to ${status}`);
    return true;

  } catch (error: any) {
    console.error("[decompose] Failed to update subtask:", error.message);
    return false;
  }
}
