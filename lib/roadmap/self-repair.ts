/**
 * Javari Self-Repair System
 * Automatically analyzes and repairs failed tasks
 */

import { executeGateway } from "@/lib/execution/gateway";

export const MAX_RETRIES = 2;

export interface RepairResult {
  success: boolean;
  analysis?: string;
  repairedDescription?: string;
  error?: string;
}

/**
 * Analyze failure and generate repair strategy
 */
export async function analyzeAndRepair(
  taskId: string,
  title: string,
  description: string,
  error: string,
  retryCount: number
): Promise<RepairResult> {
  console.log("[self-repair] ====== FAILURE ANALYSIS ======");
  console.log("[self-repair] Task:", taskId);
  console.log("[self-repair] Retry count:", retryCount);
  console.log("[self-repair] Error:", error);

  if (retryCount >= MAX_RETRIES) {
    console.log("[self-repair] Max retries reached - task abandoned");
    return {
      success: false,
      error: `Maximum retry attempts (${MAX_RETRIES}) exceeded`,
    };
  }

  try {
    const repairPrompt = `
TASK FAILURE ANALYSIS AND REPAIR

Task ID: ${taskId}
Title: ${title}
Original Description: ${description}

FAILURE DETAILS:
${error}

Retry Attempt: ${retryCount + 1}/${MAX_RETRIES}

INSTRUCTIONS:
1. VALIDATOR: Analyze the failure and identify root cause
2. BUILDER: Propose a repair strategy and modified approach
3. ARCHITECT: Create revised task description that addresses the failure
4. DOCUMENTER: Provide clear guidance for retry execution

Focus on:
- Root cause of failure
- What needs to change
- Specific repair actions
- Clear success criteria
    `.trim();

    console.log("[self-repair] Sending to repair team...");

    const repairResponse = await executeGateway({
      input: repairPrompt,
      mode: "multi",
      userId: "self-repair-system",
      roles: {
        validator: "gpt-4o",
        builder: "claude-sonnet-4-20250514",
        architect: "gpt-4o-mini",
        documenter: "gpt-4o-mini",
      },
    });

    console.log("[self-repair] ✅ Repair analysis complete");
    console.log("[self-repair] Cost: $", (repairResponse.estimatedCost ?? 0).toFixed(4));

    // Extract repaired description (simplified - in production would parse the output)
    const repairedDescription = `
${description}

REPAIR NOTES (Attempt ${retryCount + 1}):
Previous failure: ${error}

Repair strategy from AI team:
${repairResponse.output}
    `.trim();

    return {
      success: true,
      analysis: repairResponse.output,
      repairedDescription,
    };
  } catch (err: any) {
    console.error("[self-repair] Repair analysis failed:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Check if task should be retried
 */
export function shouldRetry(retryCount: number): boolean {
  return retryCount < MAX_RETRIES;
}

/**
 * Get retry delay (exponential backoff)
 */
export function getRetryDelay(retryCount: number): number {
  // 5 seconds, 10 seconds, etc.
  return Math.min(5000 * Math.pow(2, retryCount), 30000);
}
