// lib/chat/router.ts
// Purpose: Multi-AI Chat Router — single-model fast path + multi-AI collaboration mode
//          with model routing, tool hooks, streaming, cost estimation, guardrail checks
// Date: 2026-03-07

import { ChatMessage, RouterConfig, ProviderResponse, MultiAIResult, StreamChunk } from "./types";
import { callAnthropic, streamAnthropic, ANTHROPIC_MODELS } from "./providers/anthropic";
import { callOpenAI, streamOpenAI, OPENAI_MODELS } from "./providers/openai";

export const ROUTER_VERSION = "1.0.0";

// ─── Provider registry ────────────────────────────────────────────────────────
// Detects which providers are available based on API key presence.
export function detectAvailableProviders(): Record<string, { available: boolean; models: string[] }> {
  return {
    anthropic: {
      available: !!process.env.ANTHROPIC_API_KEY,
      models: Object.values(ANTHROPIC_MODELS),
    },
    openai: {
      available: !!process.env.OPENAI_API_KEY,
      models: Object.values(OPENAI_MODELS),
    },
  };
}

// ─── Cost ceiling check ───────────────────────────────────────────────────────
function checkCostGuardrail(estimatedCost: number, maxCost: number): boolean {
  return estimatedCost <= maxCost;
}

// ─── Model routing ────────────────────────────────────────────────────────────
// Selects the best provider + model based on strategy and availability.
export function routeToModel(
  strategy: RouterConfig["strategy"],
  providers: ReturnType<typeof detectAvailableProviders>
): { provider: string; model: string } {
  const hasAnthropic = providers.anthropic.available;
  const hasOpenAI    = providers.openai.available;

  switch (strategy) {
    case "cheapest":
      if (hasOpenAI)    return { provider: "openai",    model: OPENAI_MODELS.GPT4O_MINI };
      if (hasAnthropic) return { provider: "anthropic", model: ANTHROPIC_MODELS.HAIKU };
      break;
    case "highest_quality":
      if (hasAnthropic) return { provider: "anthropic", model: ANTHROPIC_MODELS.SONNET };
      if (hasOpenAI)    return { provider: "openai",    model: OPENAI_MODELS.GPT4O };
      break;
    case "fastest":
      if (hasOpenAI)    return { provider: "openai",    model: OPENAI_MODELS.GPT4O_MINI };
      if (hasAnthropic) return { provider: "anthropic", model: ANTHROPIC_MODELS.HAIKU };
      break;
    case "balanced":
    default:
      if (hasAnthropic) return { provider: "anthropic", model: ANTHROPIC_MODELS.SONNET };
      if (hasOpenAI)    return { provider: "openai",    model: OPENAI_MODELS.GPT4O_MINI };
  }

  throw new Error("No AI providers available — check ANTHROPIC_API_KEY and OPENAI_API_KEY");
}

// ─── Single-model execution ───────────────────────────────────────────────────
async function executeSingle(
  messages: ChatMessage[],
  config: RouterConfig
): Promise<ProviderResponse> {
  const providers = detectAvailableProviders();
  const route = routeToModel(config.strategy ?? "balanced", providers);
  const provider = config.primaryProvider ?? route.provider;
  const model = route.model;

  const providerConfig = {
    model,
    maxTokens: 2048,
    timeoutMs: config.timeoutMs ?? 30000,
  };

  if (provider === "anthropic") {
    return callAnthropic(messages, providerConfig);
  }
  if (provider === "openai") {
    return callOpenAI(messages, providerConfig);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ─── Multi-AI collaboration ───────────────────────────────────────────────────
// Runs the same query through multiple providers in parallel and synthesizes results.
async function executeMulti(
  messages: ChatMessage[],
  config: RouterConfig
): Promise<MultiAIResult> {
  const providers = detectAvailableProviders();
  const available = Object.entries(providers)
    .filter(([, v]) => v.available)
    .map(([k]) => k);

  if (available.length === 0) {
    throw new Error("No providers available for multi-AI mode");
  }

  const startTime = Date.now();

  // Execute in parallel across available providers
  const calls: Promise<ProviderResponse>[] = [];

  if (providers.anthropic.available) {
    calls.push(callAnthropic(messages, {
      model: ANTHROPIC_MODELS.SONNET,
      maxTokens: 1024,
      timeoutMs: config.timeoutMs ?? 30000,
    }));
  }

  if (providers.openai.available) {
    calls.push(callOpenAI(messages, {
      model: OPENAI_MODELS.GPT4O_MINI,
      maxTokens: 1024,
      timeoutMs: config.timeoutMs ?? 30000,
    }));
  }

  // Settle all — collect successes, log failures
  const settled = await Promise.allSettled(calls);
  const responses: ProviderResponse[] = [];
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      responses.push(result.value);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      console.error("[router] Provider failed in multi mode:", result.reason);
    }
  }

  if (responses.length === 0) {
    throw new Error(`All providers failed in multi mode: ${errors.join("; ")}`);
  }

  const totalCost = responses.reduce((sum, r) => sum + r.estimatedCost, 0);
  const totalLatencyMs = Date.now() - startTime;

  // Cost guardrail
  const maxCost = config.maxCost ?? 1.0;
  const guardrailsPassed = checkCostGuardrail(totalCost, maxCost);

  if (!guardrailsPassed) {
    console.warn(`[router] Cost guardrail: $${totalCost.toFixed(4)} > $${maxCost.toFixed(2)}`);
  }

  // Synthesize: if multiple responses, use Anthropic to merge them
  let synthesized: string | undefined;
  if (responses.length > 1 && providers.anthropic.available) {
    try {
      const synthMessages: ChatMessage[] = [
        {
          role: "user",
          content: `You have received responses from multiple AI models. Synthesize them into one unified, high-quality answer.

Original question: ${messages[messages.length - 1]?.content ?? ""}

Responses:
${responses.map((r, i) => `[${r.provider}/${r.model}]:\n${r.content}`).join("\n\n---\n\n")}

Provide a single synthesized response that captures the best insights from all models.`,
        },
      ];

      const synthResult = await callAnthropic(synthMessages, {
        model: ANTHROPIC_MODELS.HAIKU, // cheap synthesis
        maxTokens: 1024,
        timeoutMs: 15000,
      });
      synthesized = synthResult.content;
    } catch (err) {
      console.warn("[router] Synthesis failed (non-fatal):", (err as Error).message);
      synthesized = responses[0].content; // fallback to first response
    }
  } else {
    synthesized = responses[0].content;
  }

  return {
    mode: "multi",
    responses,
    synthesized,
    totalCost,
    totalLatencyMs,
    providersUsed: responses.map(r => `${r.provider}/${r.model}`),
    guardrailsPassed,
  };
}

// ─── Streaming router ─────────────────────────────────────────────────────────
export async function* streamRouter(
  messages: ChatMessage[],
  config: RouterConfig
): AsyncGenerator<StreamChunk> {
  const providers = detectAvailableProviders();
  const route = routeToModel(config.strategy ?? "balanced", providers);
  const provider = config.primaryProvider ?? route.provider;
  const model = route.model;

  const providerConfig = {
    model,
    maxTokens: 2048,
    timeoutMs: config.timeoutMs ?? 30000,
  };

  if (provider === "anthropic") {
    yield* streamAnthropic(messages, providerConfig);
  } else if (provider === "openai") {
    yield* streamOpenAI(messages, providerConfig);
  } else {
    yield { type: "error", error: `Unknown provider: ${provider}` };
  }
}

// ─── Main router entry point ──────────────────────────────────────────────────
export async function route(
  messages: ChatMessage[],
  config: RouterConfig
): Promise<ProviderResponse | MultiAIResult> {
  const providers = detectAvailableProviders();

  console.log(`[router] mode=${config.mode} strategy=${config.strategy ?? "balanced"}`);
  console.log(`[router] providers: ${JSON.stringify(
    Object.entries(providers).filter(([,v]) => v.available).map(([k]) => k)
  )}`);

  // Auto mode: use multi if multiple providers available, else single
  const effectiveMode = config.mode === "auto"
    ? (Object.values(providers).filter(p => p.available).length > 1 ? "multi" : "single")
    : config.mode;

  if (effectiveMode === "multi") {
    return executeMulti(messages, config);
  }

  return executeSingle(messages, config);
}

export { detectAvailableProviders as getProviders };
