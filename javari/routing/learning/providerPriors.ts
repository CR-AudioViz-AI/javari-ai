/**
 * Provider Priors Engine (Step 89)
 * 
 * Combines historical performance data with baseline priors
 * to generate learned preferences for routing decisions.
 */

import { aggregateHistory } from "./history";
import type { ProviderId } from "../providers/types";

// Baseline priors (could be learned from broader data)
const BASELINE_PRIORS: Record<ProviderId, number> = {
  "anthropic-claude-sonnet": 0.95,
  "openai-gpt4-turbo": 0.90,
  "meta-llama-3-8b": 0.75,
  "mistral-mixtral-8x7b": 0.80,
  "xai-grok-beta": 0.70,
};

/**
 * Clamp value to range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute learned prior for a provider based on historical performance
 */
export function getProviderPrior(providerId: ProviderId, windowSize: number = 50): number {
  const baseline = BASELINE_PRIORS[providerId] || 0.70;
  
  const aggregate = aggregateHistory(providerId, windowSize);
  
  // No history yet → return baseline
  if (aggregate.windowSize === 0) {
    return baseline;
  }
  
  // Normalized latency score: 0 (slow) → 1 (fast)
  const normalizedLatencyScore = 1 - clamp(aggregate.avgLatencyMs / 2000, 0, 1);
  
  // Weighted combination of baseline, success rate, and latency
  const learnedPrior = 
    (0.5 * baseline) +
    (0.3 * aggregate.successRate) +
    (0.2 * normalizedLatencyScore);
  
  // Bound to [0.3, 1.0] to prevent extreme values
  return clamp(learnedPrior, 0.3, 1.0);
}

/**
 * Get all provider priors
 */
export function getAllProviderPriors(windowSize: number = 50): Record<ProviderId, number> {
  return {
    "anthropic-claude-sonnet": getProviderPrior("anthropic-claude-sonnet", windowSize),
    "openai-gpt4-turbo": getProviderPrior("openai-gpt4-turbo", windowSize),
    "meta-llama-3-8b": getProviderPrior("meta-llama-3-8b", windowSize),
    "mistral-mixtral-8x7b": getProviderPrior("mistral-mixtral-8x7b", windowSize),
    "xai-grok-beta": getProviderPrior("xai-grok-beta", windowSize),
  };
}
