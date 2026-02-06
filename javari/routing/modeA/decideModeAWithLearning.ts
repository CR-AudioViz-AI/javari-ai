/**
 * Mode A: Single-provider decision with optional learning integration
 * 
 * Now integrated with cost model for intelligent provider selection
 */

import { scoreProvidersForSubtask } from "../providers/costModel";
import type { ProviderCostEstimate } from "../providers/costModel";

export interface ModeADecision {
  selectedProvider: {
    id: string;
    name: string;
  };
  reason: string;
  confidence: number;
  requestId?: string;
  costEstimate?: ProviderCostEstimate;
}

export function decideModeAWithLearning(payload: any, priors: any[]): ModeADecision {
  const requestId = payload.requestId || `req-${Date.now()}`;
  
  // Cost model scoring
  const estimatedTokens = 500; // temporary placeholder until tokenizer added
  const providers = [
    "anthropic-claude-sonnet",
    "openai-gpt4-turbo",
    "meta-llama-3-8b",
    "mistral-mixtral-8x7b",
    "xai-grok-beta",
  ];

  const estimates = scoreProvidersForSubtask(
    providers,
    estimatedTokens,
    payload.taskType || "general",
    requestId
  );

  // Choose winner by lowest total score
  estimates.sort((a, b) => a.totalScore - b.totalScore);

  const winner = estimates[0];

  return {
    selectedProvider: {
      id: winner.providerId,
      name: winner.providerId,
    },
    reason: `Selected via cost model: ${winner.costCents}¢, ${winner.latencyMs}ms, ${Math.round(winner.reliability * 100)}% reliability`,
    confidence: winner.reliability,
    requestId,
    costEstimate: winner,
  };
}
