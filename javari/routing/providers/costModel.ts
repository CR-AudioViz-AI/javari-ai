import { ProviderId } from "./types";
import { getHealthPenalty } from "./health";
import { aggregateHistory } from "../learning/history";

// Base cost per 1K tokens in USD cents (simulated)
export const BASE_COST: Record<ProviderId, number> = {
  "anthropic-claude-sonnet": 150,
  "openai-gpt4-turbo":       100,
  "meta-llama-3-8b":          10,
  "mistral-mixtral-8x7b":     15,
  "xai-grok-beta":            60,
};

// Latency presets (ms)
export const BASE_LATENCY: Record<ProviderId, number> = {
  "anthropic-claude-sonnet": 420,
  "openai-gpt4-turbo":       300,
  "meta-llama-3-8b":         180,
  "mistral-mixtral-8x7b":    240,
  "xai-grok-beta":           350,
};

// Reliability factor 0.0 → 1.0
export const BASE_RELIABILITY: Record<ProviderId, number> = {
  "anthropic-claude-sonnet": 0.98,
  "openai-gpt4-turbo":       0.95,
  "meta-llama-3-8b":         0.92,
  "mistral-mixtral-8x7b":    0.94,
  "xai-grok-beta":           0.90,
};

// Deterministic hashing
import { createHash } from "crypto";
function hashNum(input: string, min: number, max: number): number {
  const h = createHash("sha256").update(input).digest("hex");
  const val = parseInt(h.substring(0, 8), 16);
  return min + (val % (max - min + 1));
}

export interface ProviderCostEstimate {
  providerId: ProviderId;
  tokens: number;
  costCents: number;
  latencyMs: number;
  reliability: number;
  totalScore: number; // cost + reliability + latency weighted
}

export function estimateProviderCost(
  providerId: ProviderId,
  tokens: number,
  capability: string,
  requestId: string
): ProviderCostEstimate {

  const baseCost = BASE_COST[providerId];
  const baseLatency = BASE_LATENCY[providerId];
  const baseRel = BASE_RELIABILITY[providerId];

  const costCents = Math.round((tokens / 1000) * baseCost);

  const simulatedLatency =
    baseLatency +
    hashNum(requestId + providerId + capability, -50, 50);

  const reliability = baseRel;

  const baseScore =
    costCents * 0.6 +
    simulatedLatency * 0.2 +
    (1 - reliability) * 200; // reliability penalty

  // Apply health penalty multiplier (Step 87)
  const healthPenalty = getHealthPenalty(providerId);
  
  // Apply history-based penalty (Step 89)
  const aggregate = aggregateHistory(providerId, 50);
  let historyPenalty = 1.0;
  
  if (aggregate.windowSize > 0) {
    if (aggregate.successRate < 0.40) {
      historyPenalty = 1.50;
    } else if (aggregate.successRate < 0.60) {
      historyPenalty = 1.25;
    } else if (aggregate.successRate < 0.80) {
      historyPenalty = 1.10;
    }
  }
  
  const totalScore = baseScore * healthPenalty * historyPenalty;

  return {
    providerId,
    tokens,
    costCents,
    latencyMs: simulatedLatency,
    reliability,
    totalScore,
  };
}

// Batch scoring for Mode B
export function scoreProvidersForSubtask(
  providers: ProviderId[],
  tokens: number,
  capability: string,
  requestId: string
): ProviderCostEstimate[] {
  return providers.map((p) =>
    estimateProviderCost(p, tokens, capability, requestId)
  );
}

export type { ProviderCostEstimate };
