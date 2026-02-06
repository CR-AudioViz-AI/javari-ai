/**
 * Execution adapter - executes collaboration plans with approved tokens
 * 
 * Now integrated with simulated provider responses
 */

import type { PlanApproval } from '../approval/approvePlan';
import type { ExecutionToken } from './token';
import { simulateProviderResponse } from "../providers/simulate";

export interface ExecutionResult {
  success: boolean;
  planId: string;
  tokenId: string;
  startedAt: string;
  completedAt: string;
  outputs?: any;
  error?: string;
  ok?: boolean;
  providerId?: string;
  rawOutput?: string;
  costCents?: number;
  latencyMs?: number;
  totalExecutionMs?: number;
  reasoning?: string;
}

export async function executeCollaborationPlan(
  plan: any,
  approval: PlanApproval,
  token: ExecutionToken,
  executionConfig: any
): Promise<ExecutionResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  // Simulated provider execution
  const result = await simulateProviderResponse({
    providerId: plan.primaryModel || plan.selectedProvider?.id || "anthropic-claude-sonnet",
    input: plan.input || plan.payload || plan,
    tokens: plan.estimatedTokens ?? 500,
    requestId: plan.planId || approval.planId,
  });

  // Include latency + execution timing
  const end = Date.now();
  const completedAt = new Date().toISOString();

  return {
    success: true,
    ok: true,
    planId: approval.planId,
    tokenId: token.tokenId,
    providerId: plan.primaryModel || plan.selectedProvider?.id,
    startedAt,
    completedAt,
    rawOutput: result.output,
    costCents: result.costCents,
    latencyMs: result.latencyMs,
    totalExecutionMs: end - start,
    reasoning: result.reasoning,
    outputs: {
      message: result.output,
      cost: result.costCents,
      latency: result.latencyMs,
    },
  };
}
