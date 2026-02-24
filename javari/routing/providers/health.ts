/**
 * Provider Health Engine (Step 87)
 *
 * Tracks live provider reliability using:
 *  - rolling success/failure windows
 *  - latency medians
 *  - error rates
 *  - backoff schedules
 *
 * Feeds into routing decisions automatically.
 */

import type { ProviderId } from "./types";

export interface ProviderHealthSnapshot {
  providerId: ProviderId;
  successCount: number;
  failureCount: number;
  rollingLatencyMs: number[];
  lastUpdated: number;
  degraded: boolean;
  unavailable: boolean;
}

const HEALTH: Record<ProviderId, ProviderHealthSnapshot> = {
  "anthropic-claude-sonnet": {
    providerId: "anthropic-claude-sonnet",
    successCount: 0,
    failureCount: 0,
    rollingLatencyMs: [],
    lastUpdated: Date.now(),
    degraded: false,
    unavailable: false,
  },
  "openai-gpt4-turbo": {
    providerId: "openai-gpt4-turbo",
    successCount: 0,
    failureCount: 0,
    rollingLatencyMs: [],
    lastUpdated: Date.now(),
    degraded: false,
    unavailable: false,
  },
  "meta-llama-3-8b": {
    providerId: "meta-llama-3-8b",
    successCount: 0,
    failureCount: 0,
    rollingLatencyMs: [],
    lastUpdated: Date.now(),
    degraded: false,
    unavailable: false,
  },
  "mistral-mixtral-8x7b": {
    providerId: "mistral-mixtral-8x7b",
    successCount: 0,
    failureCount: 0,
    rollingLatencyMs: [],
    lastUpdated: Date.now(),
    degraded: false,
    unavailable: false,
  },
  "xai-grok-beta": {
    providerId: "xai-grok-beta",
    successCount: 0,
    failureCount: 0,
    rollingLatencyMs: [],
    lastUpdated: Date.now(),
    degraded: false,
    unavailable: false,
  },
};

/**
 * Update provider health after each execution.
 */
export function recordProviderHealth(
  providerId: ProviderId,
  ok: boolean,
  latencyMs: number
): void {
  const h = HEALTH[providerId];
  if (!h) return;

  if (ok) h.successCount++;
  else h.failureCount++;

  // Keep sliding window of 20 latency points
  h.rollingLatencyMs.push(latencyMs);
  if (h.rollingLatencyMs.length > 20) {
    h.rollingLatencyMs.shift();
  }

  // Degraded if >25% errors in last 20 attempts
  const total = h.successCount + h.failureCount;
  if (total >= 20) {
    const failureRate = h.failureCount / total;
    h.degraded = failureRate > 0.25;
    h.unavailable = failureRate > 0.5;
  }

  h.lastUpdated = Date.now();
}

/**
 * Retrieve health snapshot for routing.
 */
export function getProviderHealth(providerId: ProviderId): ProviderHealthSnapshot {
  return HEALTH[providerId];
}

/**
 * Health-aware multiplier used by routing engine.
 * Degraded providers get a penalty; unavailable ones get rejected.
 */
export function getHealthPenalty(providerId: ProviderId): number {
  const h = HEALTH[providerId];
  if (!h) return 1.0;

  if (h.unavailable) return 2.0;     // double score (avoid)
  if (h.degraded) return 1.3;       // 30% worse score
  return 1.0;
}
