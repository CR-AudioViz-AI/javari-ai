/**
 * Execution adapter - executes collaboration plans with approved tokens
 * 
 * Now integrated with simulated provider responses AND live provider scaffolding
 */

import type { PlanApproval } from '../approval/approvePlan';
import type { ExecutionToken } from './token';
import { simulateProviderResponse } from "../providers/simulate";
import { claudeAdapter, openaiAdapter, llamaAdapter, mistralAdapter, grokAdapter } from "../providers/live";
import { recordProviderHealth } from "../providers/health";
import { addHistoryRecord } from "../learning/history";

// Live provider lookup registry
const LIVE_PROVIDERS: Record<string, any> = {
  "anthropic-claude-sonnet": claudeAdapter,
  "openai-gpt4-turbo": openaiAdapter,
  "meta-llama-3-8b": llamaAdapter,
  "mistral-mixtral-8x7b": mistralAdapter,
  "xai-grok-beta": grokAdapter,
};

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

  const providerId = plan.primaryModel || plan.selectedProvider?.id || "anthropic-claude-sonnet";

  // LIVE PROVIDER MODE (if enabled via env var)
  if (process.env.JAVARI_LIVE_PROVIDERS_ENABLED === "true") {
    const provider = LIVE_PROVIDERS[providerId];
    if (provider) {
      const liveResult = await provider.executeLive({
        providerId,
        input: plan.input || plan.payload || plan,
        tokens: plan.estimatedTokens ?? 500,
        requestId: plan.planId || approval.planId,
      });

      const end = Date.now();
      const completedAt = new Date().toISOString();

      // Update provider health (Step 87)
      recordProviderHealth(
        providerId,
        liveResult.ok,
        liveResult.latencyMs || end - start
      );

      // Add to learning history (Step 89)
      addHistoryRecord({
        timestamp: Date.now(),
        providerId,
        ok: liveResult.ok,
        latencyMs: liveResult.latencyMs || end - start,
        tokensUsed: liveResult.tokensUsed || 0,
        capability: plan.capability || null,
      });

      return {
        success: liveResult.ok,
        ok: liveResult.ok,
        planId: approval.planId,
        tokenId: token.tokenId,
        providerId,
        startedAt,
        completedAt,
        rawOutput: liveResult.rawOutput,
        costCents: 0, // Will be calculated from tokensUsed in future
        latencyMs: 0,
        totalExecutionMs: end - start,
        reasoning: `Live provider execution: ${providerId}`,
        outputs: {
          message: liveResult.rawOutput,
          tokensUsed: liveResult.tokensUsed,
        },
      };
    }
  }

  // SIMULATED PROVIDER MODE (default)
  const result = await simulateProviderResponse({
    providerId,
    input: plan.input || plan.payload || plan,
    tokens: plan.estimatedTokens ?? 500,
    requestId: plan.planId || approval.planId,
  });

  // Include latency + execution timing
  const end = Date.now();
  const completedAt = new Date().toISOString();

  // Update provider health (Step 87)
  recordProviderHealth(
    providerId,
    true, // Simulated executions always succeed
    result.latencyMs
  );

  // Add to learning history (Step 89)
  addHistoryRecord({
    timestamp: Date.now(),
    providerId,
    ok: true,
    latencyMs: result.latencyMs,
    tokensUsed: plan.estimatedTokens ?? 500,
    capability: plan.capability || null,
  });

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
