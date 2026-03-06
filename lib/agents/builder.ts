/**
 * Javari Builder Agent
 * Generates deliverables for roadmap tasks
 */

import { executeWithRouting } from "@/lib/router/executeWithRouting";

export interface BuilderRequest {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  dependencies?: string[];
  userId?: string;
}

export interface BuilderResult {
  success: boolean;
  deliverable?: any;
  code?: string;
  documentation?: string;
  error?: string;
  model?: string;
  cost?: number;
  retryCount?: number;
}

/**
 * Builder Agent - Generate task deliverables
 */
export async function buildTask(
  request: BuilderRequest,
  model: string = "gpt-4o-mini", // Default to cheap model
  retryCount: number = 0
): Promise<BuilderResult> {
  console.log("[builder] ====== BUILDING TASK ======");
  console.log("[builder] Task:", request.taskTitle);
  console.log("[builder] Model:", model);
  console.log("[builder] Retry:", retryCount);

  try {
    const buildPrompt = `
TASK EXECUTION - BUILDER AGENT

Task ID: ${request.taskId}
Task: ${request.taskTitle}
Description: ${request.taskDescription}

${request.dependencies && request.dependencies.length > 0 ? `
Dependencies Completed:
${request.dependencies.join("\n")}
` : ""}

Your job is to BUILD the deliverable for this task.

OUTPUT REQUIREMENTS:
1. If this is a coding task, provide complete, working code
2. If this is a design task, provide detailed specifications
3. If this is a documentation task, provide comprehensive docs
4. Always include validation criteria

Return your output in JSON format:
{
  "deliverable": "The main output (code, design, documentation, etc.)",
  "code": "Any code files (if applicable)",
  "documentation": "Explanation of what was built",
  "validation_criteria": "How to verify this is correct"
}

CRITICAL: Return ONLY valid JSON. No markdown, no explanations outside the JSON.
    `.trim();

    const response = await executeWithRouting(buildPrompt, model, true);

    // Parse response
    let parsedResult: any;
    
    if (typeof response.output === "object") {
      parsedResult = response.output;
    } else if (typeof response.output === "string") {
      try {
        parsedResult = JSON.parse(response.output);
      } catch (e) {
        // Try to extract JSON
        const jsonMatch = response.output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Builder did not return valid JSON");
        }
      }
    }

    if (!parsedResult || typeof parsedResult !== "object") {
      throw new Error("Builder response invalid format");
    }

    console.log("[builder] ✅ Build complete");
    console.log("[builder] Cost: $", (response.estimatedCost || 0).toFixed(4));

    return {
      success: true,
      deliverable: parsedResult.deliverable || parsedResult,
      code: parsedResult.code,
      documentation: parsedResult.documentation || parsedResult.deliverable,
      model: response.model,
      cost: response.estimatedCost,
      retryCount,
    };

  } catch (error: any) {
    console.error("[builder] ❌ Build failed:", error.message);

    return {
      success: false,
      error: error.message,
      model,
      retryCount,
    };
  }
}

/**
 * Build with automatic retry and escalation
 */
export async function buildTaskWithRetry(
  request: BuilderRequest
): Promise<BuilderResult> {
  console.log("[builder] Starting build with retry support");

  // Try with cheap model first
  let result = await buildTask(request, "gpt-4o-mini", 0);

  if (result.success) {
    return result;
  }

  // Retry once with same model
  console.log("[builder] 🔄 Retrying with same model...");
  result = await buildTask(request, "gpt-4o-mini", 1);

  if (result.success) {
    return result;
  }

  // Escalate to premium model
  console.log("[builder] 🔼 Escalating to premium model...");
  result = await buildTask(request, "gpt-4o", 2);

  return result;
}
