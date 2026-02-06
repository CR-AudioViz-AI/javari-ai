/**
 * Mode B: Multi-provider orchestration with role-based assignments
 * 
 * Now integrated with cost model for intelligent provider selection
 */

import { scoreProvidersForSubtask } from "../providers/costModel";
import type { ProviderCostEstimate } from "../providers/costModel";

export interface ModeBDecision {
  plan: {
    planId?: string;
    assignments: Array<{
      role: string;
      providerId: string;
      providerName: string;
      estimatedCostCents?: number;
      estimatedLatencyMs?: number;
      costModel?: ProviderCostEstimate;
    }>;
  };
  reason: string;
}

export function orchestrate(payload: any, priors: any[]): ModeBDecision {
  const planId = `plan-${Date.now()}`;
  
  // Cost model scoring for provider selection
  const estimatedTokens = 500; // placeholder
  const allProviders = [
    "anthropic-claude-sonnet",
    "openai-gpt4-turbo",
    "meta-llama-3-8b",
    "mistral-mixtral-8x7b",
    "xai-grok-beta",
  ];

  const estimates = scoreProvidersForSubtask(
    allProviders,
    estimatedTokens,
    payload.capability || "general",
    planId
  );

  estimates.sort((a, b) => a.totalScore - b.totalScore);
  
  const winner = estimates[0];

  return {
    plan: {
      planId,
      assignments: [
        {
          role: 'executor',
          providerId: winner.providerId,
          providerName: winner.providerId,
          estimatedCostCents: winner.costCents,
          estimatedLatencyMs: winner.latencyMs,
          costModel: winner,
        },
      ],
    },
    reason: `Selected ${winner.providerId} via cost model: ${winner.costCents}¢, ${winner.latencyMs}ms`,
  };
}
