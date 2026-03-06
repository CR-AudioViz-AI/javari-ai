/**
 * Javari Validator Agent
 * Verifies task output quality and correctness
 */

import { executeWithRouting } from "@/lib/router/executeWithRouting";

export interface ValidationRequest {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  deliverable: any;
  code?: string;
  documentation?: string;
}

export interface ValidationResult {
  success: boolean;
  valid: boolean;
  score?: number;
  feedback?: string;
  issues?: string[];
  recommendations?: string[];
  error?: string;
  model?: string;
  cost?: number;
  retryCount?: number;
}

/**
 * Validator Agent - Verify task output quality
 */
export async function validateTask(
  request: ValidationRequest,
  model: string = "claude-sonnet-4-20250514",
  retryCount: number = 0
): Promise<ValidationResult> {
  console.log("[validator] ====== VALIDATING TASK ======");
  console.log("[validator] Task:", request.taskTitle);
  console.log("[validator] Model:", model);
  console.log("[validator] Retry:", retryCount);

  try {
    const validationPrompt = `
TASK VALIDATION - VALIDATOR AGENT

Task: ${request.taskTitle}
Description: ${request.taskDescription}

DELIVERABLE TO VALIDATE:
${JSON.stringify(request.deliverable, null, 2)}

${request.code ? `
CODE:
${request.code}
` : ""}

${request.documentation ? `
DOCUMENTATION:
${request.documentation}
` : ""}

Your job is to VALIDATE this deliverable against quality standards.

VALIDATION RULES:
1. Code Correctness: Does the code work as intended?
2. Architecture Alignment: Does it follow best practices?
3. JSON Schema Compliance: Is the structure correct?
4. Completeness: Are all requirements met?
5. Quality: Is it production-ready?

SCORING:
- 90-100: Excellent, production-ready
- 70-89: Good, minor improvements needed
- 50-69: Acceptable, significant improvements needed
- 0-49: Failed, major issues

Return your validation in JSON format:
{
  "valid": true or false,
  "score": 0-100,
  "feedback": "Overall assessment",
  "issues": ["List of problems found"],
  "recommendations": ["Suggested improvements"]
}

CRITICAL: Return ONLY valid JSON. No markdown, no explanations outside the JSON.
    `.trim();

    const response = await executeWithRouting(validationPrompt, model, true);

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
          throw new Error("Validator did not return valid JSON");
        }
      }
    }

    if (!parsedResult || typeof parsedResult !== "object") {
      throw new Error("Validator response invalid format");
    }

    const isValid = parsedResult.valid === true || parsedResult.score >= 70;

    console.log("[validator] ✅ Validation complete");
    console.log("[validator] Valid:", isValid);
    console.log("[validator] Score:", parsedResult.score || "N/A");
    console.log("[validator] Cost: $", (response.estimatedCost || 0).toFixed(4));

    return {
      success: true,
      valid: isValid,
      score: parsedResult.score,
      feedback: parsedResult.feedback,
      issues: parsedResult.issues || [],
      recommendations: parsedResult.recommendations || [],
      model: response.model,
      cost: response.estimatedCost,
      retryCount,
    };

  } catch (error: any) {
    console.error("[validator] ❌ Validation failed:", error.message);

    return {
      success: false,
      valid: false,
      error: error.message,
      model,
      retryCount,
    };
  }
}

/**
 * Validate with automatic retry and escalation
 */
export async function validateTaskWithRetry(
  request: ValidationRequest
): Promise<ValidationResult> {
  console.log("[validator] Starting validation with retry support");

  // Try with Claude Sonnet first
  let result = await validateTask(request, "claude-sonnet-4-20250514", 0);

  if (result.success && result.valid) {
    return result;
  }

  // Retry once with same model
  console.log("[validator] 🔄 Retrying validation...");
  result = await validateTask(request, "claude-sonnet-4-20250514", 1);

  if (result.success && result.valid) {
    return result;
  }

  // Escalate to GPT-4o for second opinion
  console.log("[validator] 🔼 Escalating to premium model for validation...");
  result = await validateTask(request, "gpt-4o", 2);

  return result;
}
