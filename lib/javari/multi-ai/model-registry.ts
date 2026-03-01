// lib/javari/multi-ai/model-registry.ts
// Capability-based Model Registry — static, in-memory, zero I/O
// 2026-03-01
//
// Every model is defined with a capability vector and cost metadata.
// Routing decisions are driven by capability scores, not provider names.
// The registry is the single source of truth for model selection.

export const MODEL_REGISTRY_VERSION = "v1.0";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ModelCapabilities {
  reasoning: number;       // 1-5: logical depth, multi-step analysis, planning
  json_reliability: number; // 1-5: structured output accuracy, schema adherence
  code_quality: number;    // 1-5: code generation, debugging, refactoring
  multimodal: number;      // 1-5: image/audio understanding (0 = text only)
  streaming: number;       // 1-5: streaming response quality and latency
  tools: number;           // 1-5: function/tool calling reliability
}

export type LatencyClass = "fast" | "medium" | "slow";

export interface ModelDefinition {
  id: string;              // Unique: "provider:model_id"
  provider: string;        // groq, openai, anthropic, mistral, openrouter, xai, perplexity
  model_id: string;        // API model identifier
  display_name: string;    // Human-readable name
  capabilities: ModelCapabilities;
  cost_per_1k_tokens: number;  // USD per 1K tokens (blended input/output)
  latency_class: LatencyClass;
  max_tokens: number;      // Max output tokens
  context_window: number;  // Max context window
  active: boolean;         // Whether this model is currently available
}

// ═══════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════

export const MODEL_REGISTRY: ModelDefinition[] = [
  // ── Groq (ultra-fast inference, free/low cost) ───────────────
  {
    id: "groq:llama-3.3-70b-versatile",
    provider: "groq",
    model_id: "llama-3.3-70b-versatile",
    display_name: "Llama 3.3 70B (Groq)",
    capabilities: { reasoning: 3, json_reliability: 3, code_quality: 3, multimodal: 0, streaming: 5, tools: 2 },
    cost_per_1k_tokens: 0.0,
    latency_class: "fast",
    max_tokens: 8192,
    context_window: 131072,
    active: true,
  },
  {
    id: "groq:llama-3.1-8b-instant",
    provider: "groq",
    model_id: "llama-3.1-8b-instant",
    display_name: "Llama 3.1 8B Instant (Groq)",
    capabilities: { reasoning: 2, json_reliability: 2, code_quality: 2, multimodal: 0, streaming: 5, tools: 1 },
    cost_per_1k_tokens: 0.0,
    latency_class: "fast",
    max_tokens: 8192,
    context_window: 131072,
    active: true,
  },

  // ── OpenAI (reasoning + tools powerhouse) ────────────────────
  {
    id: "openai:gpt-4o-mini",
    provider: "openai",
    model_id: "gpt-4o-mini",
    display_name: "GPT-4o Mini",
    capabilities: { reasoning: 3, json_reliability: 4, code_quality: 3, multimodal: 4, streaming: 4, tools: 5 },
    cost_per_1k_tokens: 0.0015,
    latency_class: "medium",
    max_tokens: 16384,
    context_window: 128000,
    active: true,
  },
  {
    id: "openai:o4-mini",
    provider: "openai",
    model_id: "o4-mini",
    display_name: "o4-mini (Reasoning)",
    capabilities: { reasoning: 5, json_reliability: 4, code_quality: 5, multimodal: 3, streaming: 3, tools: 4 },
    cost_per_1k_tokens: 0.011,
    latency_class: "slow",
    max_tokens: 65536,
    context_window: 200000,
    active: true,
  },
  {
    id: "openai:o3",
    provider: "openai",
    model_id: "o3",
    display_name: "o3 (Deep Reasoning)",
    capabilities: { reasoning: 5, json_reliability: 4, code_quality: 5, multimodal: 3, streaming: 2, tools: 4 },
    cost_per_1k_tokens: 0.10,
    latency_class: "slow",
    max_tokens: 100000,
    context_window: 200000,
    active: true,
  },

  // ── Anthropic (reasoning + safety) ───────────────────────────
  {
    id: "anthropic:claude-sonnet-4-20250514",
    provider: "anthropic",
    model_id: "claude-sonnet-4-20250514",
    display_name: "Claude Sonnet 4",
    capabilities: { reasoning: 5, json_reliability: 4, code_quality: 5, multimodal: 4, streaming: 4, tools: 5 },
    cost_per_1k_tokens: 0.009,
    latency_class: "medium",
    max_tokens: 8192,
    context_window: 200000,
    active: true,
  },

  // ── Mistral (JSON specialist) ────────────────────────────────
  {
    id: "mistral:mistral-small-latest",
    provider: "mistral",
    model_id: "mistral-small-latest",
    display_name: "Mistral Small",
    capabilities: { reasoning: 3, json_reliability: 5, code_quality: 3, multimodal: 0, streaming: 4, tools: 4 },
    cost_per_1k_tokens: 0.001,
    latency_class: "medium",
    max_tokens: 8192,
    context_window: 32000,
    active: true,
  },
  {
    id: "mistral:mistral-large-latest",
    provider: "mistral",
    model_id: "mistral-large-latest",
    display_name: "Mistral Large",
    capabilities: { reasoning: 4, json_reliability: 5, code_quality: 4, multimodal: 0, streaming: 4, tools: 5 },
    cost_per_1k_tokens: 0.006,
    latency_class: "medium",
    max_tokens: 8192,
    context_window: 128000,
    active: true,
  },

  // ── OpenRouter (Llama variants, fallback) ────────────────────
  {
    id: "openrouter:meta-llama/llama-3.3-70b-instruct",
    provider: "openrouter",
    model_id: "meta-llama/llama-3.3-70b-instruct",
    display_name: "Llama 3.3 70B (OpenRouter)",
    capabilities: { reasoning: 3, json_reliability: 3, code_quality: 3, multimodal: 0, streaming: 4, tools: 2 },
    cost_per_1k_tokens: 0.0008,
    latency_class: "medium",
    max_tokens: 8192,
    context_window: 131072,
    active: true,
  },

  // ── xAI (Grok) ──────────────────────────────────────────────
  {
    id: "xai:grok-2",
    provider: "xai",
    model_id: "grok-2",
    display_name: "Grok 2",
    capabilities: { reasoning: 3, json_reliability: 3, code_quality: 3, multimodal: 3, streaming: 4, tools: 3 },
    cost_per_1k_tokens: 0.005,
    latency_class: "medium",
    max_tokens: 8192,
    context_window: 131072,
    active: true,
  },

  // ── Perplexity (search-augmented) ────────────────────────────
  {
    id: "perplexity:llama-3.1-sonar-large-128k-online",
    provider: "perplexity",
    model_id: "llama-3.1-sonar-large-128k-online",
    display_name: "Sonar Large (Perplexity)",
    capabilities: { reasoning: 3, json_reliability: 2, code_quality: 2, multimodal: 0, streaming: 4, tools: 1 },
    cost_per_1k_tokens: 0.005,
    latency_class: "medium",
    max_tokens: 4096,
    context_window: 127072,
    active: true,
  },
];

// ═══════════════════════════════════════════════════════════════
// QUERY API (all pure functions, zero I/O)
// ═══════════════════════════════════════════════════════════════

/** Get all active models */
export function getActiveModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.active);
}

/** Get models for a specific provider */
export function getModelsByProvider(provider: string): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.active && m.provider === provider);
}

/** Get the best model for a capability requirement */
export function getBestModelForCapability(
  capability: keyof ModelCapabilities,
  minScore: number = 4,
): ModelDefinition[] {
  return MODEL_REGISTRY
    .filter((m) => m.active && m.capabilities[capability] >= minScore)
    .sort((a, b) => b.capabilities[capability] - a.capabilities[capability] || a.cost_per_1k_tokens - b.cost_per_1k_tokens);
}

/**
 * Build a capability-filtered provider chain.
 * Returns unique providers ordered by best model score for the given capability,
 * with cost as tiebreaker.
 */
export function buildCapabilityChain(
  capability: keyof ModelCapabilities,
  minScore: number,
): string[] {
  const models = getBestModelForCapability(capability, minScore);
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const m of models) {
    if (!seen.has(m.provider)) {
      seen.add(m.provider);
      chain.push(m.provider);
    }
  }
  return chain;
}

/**
 * Build a full fallback chain from all active providers,
 * ordered by cost (cheapest first), then alphabetical.
 */
export function buildDefaultChain(): string[] {
  const providers = new Map<string, number>(); // provider → lowest cost
  for (const m of MODEL_REGISTRY) {
    if (!m.active) continue;
    const existing = providers.get(m.provider);
    if (existing === undefined || m.cost_per_1k_tokens < existing) {
      providers.set(m.provider, m.cost_per_1k_tokens);
    }
  }
  return [...providers.entries()]
    .sort(([aP, aC], [bP, bC]) => aC - bC || aP.localeCompare(bP))
    .map(([p]) => p);
}

/**
 * Get the recommended model for a provider + capability combination.
 * Returns the best model from that provider for the given capability.
 */
export function getRecommendedModel(
  provider: string,
  capability?: keyof ModelCapabilities,
): ModelDefinition | undefined {
  const models = getModelsByProvider(provider);
  if (models.length === 0) return undefined;
  if (!capability) return models[0]; // Return first active model
  return models.sort((a, b) => b.capabilities[capability] - a.capabilities[capability])[0];
}

/**
 * Get model cost per 1K tokens for a provider (uses cheapest model).
 * Used by health ranking composite score.
 */
export function getProviderCost(provider: string): number {
  const models = getModelsByProvider(provider);
  if (models.length === 0) return 0.002; // Unknown provider fallback
  return Math.min(...models.map((m) => m.cost_per_1k_tokens));
}

/** Total count of active models in the registry */
export function getActiveModelCount(): number {
  return MODEL_REGISTRY.filter((m) => m.active).length;
}
