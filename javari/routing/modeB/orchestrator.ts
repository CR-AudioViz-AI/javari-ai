/**
 * Mode B: Multi-provider orchestration with role-based assignments
 * 
 * Now integrated with cost model AND historical priors for intelligent provider selection
 */

import { scoreProvidersForSubtask } from "../providers/costModel";
import type { ProviderCostEstimate } from "../providers/costModel";
import { getProviderPrior } from "../learning/providerPriors";

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

  // Apply learned priors (Step 89)
  const estimatesWithPriors = estimates.map(est => {
    const prior = getProviderPrior(est.providerId as any);
    const adjustedScore = est.totalScore / prior;
    return { ...est, totalScore: adjustedScore };
  });

  estimatesWithPriors.sort((a, b) => a.totalScore - b.totalScore);
  
  const winner = estimatesWithPriors[0];

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
