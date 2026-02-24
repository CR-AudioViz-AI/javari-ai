/**
 * Provider Benchmark Engine (Step 88)
 *
 * Runs controlled benchmark queries across all providers
 * to compute baseline performance profiles:
 *   - latency
 *   - token throughput
 *   - cost accuracy
 *   - reliability (success/fail)
 *
 * Results feed into:
 *   - routing intelligence
 *   - learning system (later steps)
 *   - provider score dashboards (future UI)
 */

import type { ProviderId } from "./types";
import { simulateProviderResponse } from "./simulate";
import { recordProviderHealth } from "./health";
import { claudeAdapter, openaiAdapter, llamaAdapter, mistralAdapter, grokAdapter } from "./live";

// Live provider registry
const LIVE_PROVIDERS: Record<string, any> = {
  "anthropic-claude-sonnet": claudeAdapter,
  "openai-gpt4-turbo": openaiAdapter,
  "meta-llama-3-8b": llamaAdapter,
  "mistral-mixtral-8x7b": mistralAdapter,
  "xai-grok-beta": grokAdapter,
};

export interface ProviderBenchmarkResult {
  providerId: ProviderId;
  ok: boolean;
  latencyMs: number;
  tokensUsed: number;
  rawOutput: string;
  timestamp: number;
}

export async function runSingleBenchmark(
  providerId: ProviderId,
  prompt: string
): Promise<ProviderBenchmarkResult> {
  const now = Date.now();

  // If live mode enabled try real provider
  if (
    process.env.JAVARI_LIVE_PROVIDERS_ENABLED === "true" &&
    LIVE_PROVIDERS[providerId]
  ) {
    try {
      const result = await LIVE_PROVIDERS[providerId].executeLive({
        input: prompt,
        providerId,
        tokens: 500,
        requestId: `benchmark-${now}`,
      });

      recordProviderHealth(providerId, result.ok, result.latencyMs || 0);

      return {
        providerId,
        ok: result.ok,
        latencyMs: result.latencyMs || 0,
        tokensUsed: result.tokensUsed || 0,
        rawOutput: result.rawOutput || "",
        timestamp: now,
      };
    } catch (err: any) {
      recordProviderHealth(providerId, false, 0);
      return {
        providerId,
        ok: false,
        latencyMs: 0,
        tokensUsed: 0,
        rawOutput: `Benchmark failed: ${err.message}`,
        timestamp: now,
      };
    }
  }

  // Otherwise simulate provider for safe-mode
  const simulated = await simulateProviderResponse({
    providerId,
    input: prompt,
    tokens: 500,
    requestId: `benchmark-${now}`,
  });

  recordProviderHealth(providerId, true, simulated.latencyMs || 0);

  return {
    providerId,
    ok: true,
    latencyMs: simulated.latencyMs || 0,
    tokensUsed: 500,
    rawOutput: simulated.output || "",
    timestamp: now,
  };
}

/**
 * Run benchmark across ALL providers.
 */
export async function runFullBenchmark(prompt: string) {
  const providers: ProviderId[] = [
    "anthropic-claude-sonnet",
    "openai-gpt4-turbo",
    "meta-llama-3-8b",
    "mistral-mixtral-8x7b",
    "xai-grok-beta",
  ];

  const results: ProviderBenchmarkResult[] = [];

  for (const p of providers) {
    const res = await runSingleBenchmark(p, prompt);
    results.push(res);
  }

  return results;
}

/**
 * Background benchmark job runner
 * (will be called by dashboard or CRON task in later steps)
 */
export async function runBenchmarkSuite() {
  const SUITE = [
    "Summarize the following paragraph: The quick brown fox jumps over the lazy dog.",
    "Translate to Spanish: 'The weather is beautiful today.'",
    "Explain quantum computing in simple terms.",
  ];

  const allResults = [];

  for (const prompt of SUITE) {
    const r = await runFullBenchmark(prompt);
    allResults.push({ prompt, results: r });
  }

  return allResults;
}
