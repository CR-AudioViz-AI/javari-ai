/**
 * Integrated Build-Validate Workflow
 * Combines builder and validator agents
 */

import { buildTaskWithRetry, BuilderRequest, BuilderResult } from "./builder";
import { validateTaskWithRetry, ValidationRequest, ValidationResult } from "./validator";

export interface WorkflowResult {
  success: boolean;
  buildResult: BuilderResult;
  validationResult?: ValidationResult;
  finalDeliverable?: any;
  totalCost: number;
  attempts: number;
}

/**
 * Execute full build-validate workflow
 */
export async function executeBuildValidateWorkflow(
  taskId: string,
  taskTitle: string,
  taskDescription: string,
  dependencies?: string[],
  userId?: string
): Promise<WorkflowResult> {
  console.log("[workflow] ====== BUILD-VALIDATE WORKFLOW ======");
  console.log("[workflow] Task:", taskTitle);

  let totalCost = 0;
  let attempts = 0;

  // Step 1: Build
  console.log("[workflow] Step 1: Building deliverable...");
  const buildResult = await buildTaskWithRetry({
    taskId,
    taskTitle,
    taskDescription,
    dependencies,
    userId,
  });

  totalCost += buildResult.cost || 0;
  attempts++;

  if (!buildResult.success) {
    console.log("[workflow] ❌ Build failed after retries");
    return {
      success: false,
      buildResult,
      totalCost,
      attempts,
    };
  }

  console.log("[workflow] ✅ Build successful");

  // Step 2: Validate
  console.log("[workflow] Step 2: Validating deliverable...");
  const validationResult = await validateTaskWithRetry({
    taskId,
    taskTitle,
    taskDescription,
    deliverable: buildResult.deliverable,
    code: buildResult.code,
    documentation: buildResult.documentation,
  });

  totalCost += validationResult.cost || 0;
  attempts++;

  if (!validationResult.success || !validationResult.valid) {
    console.log("[workflow] ⚠️ Validation failed");
    console.log("[workflow] Feedback:", validationResult.feedback);
    console.log("[workflow] Issues:", validationResult.issues);
  } else {
    console.log("[workflow] ✅ Validation passed");
    console.log("[workflow] Score:", validationResult.score);
  }

  console.log("[workflow] Total cost: $", totalCost.toFixed(4));
  console.log("[workflow] Total attempts:", attempts);

  return {
    success: buildResult.success && (validationResult.valid || false),
    buildResult,
    validationResult,
    finalDeliverable: buildResult.deliverable,
    totalCost,
    attempts,
  };
}
