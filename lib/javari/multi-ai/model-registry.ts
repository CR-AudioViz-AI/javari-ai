// lib/javari/multi-ai/model-registry.ts
// Externalized Model Registry — DB-backed with in-memory cache
// 2026-03-01
//
// Cold start: fetches enabled models from model_registry table.
// Hot path: reads from in-memory cache (zero DB queries).
// Refresh: every 30s in background.
// DB table: model_registry (created via migration)
// Fallback: embedded static snapshot if DB unavailable.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ModelCapabilities {
  reasoning: number;        // 1-5
  json_reliability: number; // 1-5
  code_quality: number;     // 1-5
  multimodal: boolean;
  streaming: boolean;
  tools: boolean;
}

export type LatencyClass = "fast" | "medium" | "slow";

export interface ModelDefinition {
  id: string;               // "provider:model"
  provider: string;
  model_id: string;
  display_name: string;
  capabilities: ModelCapabilities;
  cost_per_1k_tokens: number; // Blended (avg of input+output)
  latency_class: LatencyClass;
  max_tokens: number;
  context_window: number;
  active: boolean;
  registry_version: string;
}

// ═══════════════════════════════════════════════════════════════
// STATIC FALLBACK (used when DB is unavailable)
// ═══════════════════════════════════════════════════════════════

const STATIC_REGISTRY_VERSION = "v1.0-static";

const STATIC_MODELS: ModelDefinition[] = [
  // Anthropic
  { id:"anthropic:claude-sonnet-4-20250514", provider:"anthropic", model_id:"claude-sonnet-4-20250514", display_name:"Claude Sonnet 4", capabilities:{reasoning:5,json_reliability:5,code_quality:5,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.009, latency_class:"fast", max_tokens:8192, context_window:200000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  { id:"anthropic:claude-3-5-sonnet-20241022", provider:"anthropic", model_id:"claude-3-5-sonnet-20241022", display_name:"Claude 3.5 Sonnet", capabilities:{reasoning:5,json_reliability:5,code_quality:5,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.009, latency_class:"fast", max_tokens:8192, context_window:200000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  { id:"anthropic:claude-3-5-haiku-20241022", provider:"anthropic", model_id:"claude-3-5-haiku-20241022", display_name:"Claude 3.5 Haiku", capabilities:{reasoning:3,json_reliability:4,code_quality:3,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.003, latency_class:"fast", max_tokens:8192, context_window:200000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  // OpenAI
  { id:"openai:gpt-4o", provider:"openai", model_id:"gpt-4o", display_name:"GPT-4o", capabilities:{reasoning:5,json_reliability:5,code_quality:4,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.00625, latency_class:"fast", max_tokens:16384, context_window:128000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  { id:"openai:gpt-4o-mini", provider:"openai", model_id:"gpt-4o-mini", display_name:"GPT-4o Mini", capabilities:{reasoning:3,json_reliability:4,code_quality:3,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.000375, latency_class:"fast", max_tokens:16384, context_window:128000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  // Google
  { id:"google:gemini-2.0-flash-exp", provider:"google", model_id:"gemini-2.0-flash-exp", display_name:"Gemini 2.0 Flash (Exp)", capabilities:{reasoning:4,json_reliability:4,code_quality:4,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0, latency_class:"fast", max_tokens:8192, context_window:1000000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  { id:"google:gemini-1.5-pro", provider:"google", model_id:"gemini-1.5-pro", display_name:"Gemini 1.5 Pro", capabilities:{reasoning:4,json_reliability:4,code_quality:4,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.003125, latency_class:"medium", max_tokens:8192, context_window:2000000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  // OpenRouter
  { id:"openrouter:anthropic/claude-sonnet-4", provider:"openrouter", model_id:"anthropic/claude-sonnet-4", display_name:"Claude Sonnet 4 (OpenRouter)", capabilities:{reasoning:5,json_reliability:5,code_quality:5,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0.009, latency_class:"fast", max_tokens:8192, context_window:200000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  { id:"openrouter:google/gemini-2.0-flash-exp:free", provider:"openrouter", model_id:"google/gemini-2.0-flash-exp:free", display_name:"Gemini 2.0 Flash Free (OpenRouter)", capabilities:{reasoning:4,json_reliability:4,code_quality:4,multimodal:true,streaming:true,tools:true}, cost_per_1k_tokens:0, latency_class:"fast", max_tokens:8192, context_window:1000000, active:true, registry_version:STATIC_REGISTRY_VERSION },
  // Perplexity
  { id:"perplexity:sonar-pro", provider:"perplexity", model_id:"sonar-pro", display_name:"Sonar Pro", capabilities:{reasoning:4,json_reliability:3,code_quality:3,multimodal:false,streaming:true,tools:false}, cost_per_1k_tokens:0.009, latency_class:"medium", max_tokens:4096, context_window:127072, active:true, registry_version:STATIC_REGISTRY_VERSION },
  { id:"perplexity:sonar", provider:"perplexity", model_id:"sonar", display_name:"Sonar", capabilities:{reasoning:3,json_reliability:3,code_quality:2,multimodal:false,streaming:true,tools:false}, cost_per_1k_tokens:0.001, latency_class:"fast", max_tokens:4096, context_window:127072, active:true, registry_version:STATIC_REGISTRY_VERSION },
];

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY CACHE
// ═══════════════════════════════════════════════════════════════

let _cache: ModelDefinition[] = [...STATIC_MODELS];
let _registryVersion = STATIC_REGISTRY_VERSION;
let _initialized = false;
let _initPromise: Promise<void> | null = null;
let _lastSync = 0;
const SYNC_INTERVAL_MS = 30_000;

// ═══════════════════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════════════════

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key);
  return _sb;
}

// ═══════════════════════════════════════════════════════════════
// DB → ModelDefinition mapping
// ═══════════════════════════════════════════════════════════════

function _rowToModel(row: any): ModelDefinition {
  const costInput = Number(row.cost_input ?? 0);
  const costOutput = Number(row.cost_output ?? 0);
  return {
    id: `${row.provider}:${row.model}`,
    provider: row.provider,
    model_id: row.model,
    display_name: `${row.model} (${row.provider})`,
    capabilities: {
      reasoning: row.reasoning ?? 3,
      json_reliability: row.json_reliability ?? 3,
      code_quality: row.code_quality ?? 3,
      multimodal: row.multimodal ?? false,
      streaming: row.streaming ?? true,
      tools: row.tools ?? false,
    },
    cost_per_1k_tokens: (costInput + costOutput) / 2,
    latency_class: (row.latency_class as LatencyClass) ?? "medium",
    max_tokens: 8192,
    context_window: 128000,
    active: row.enabled !== false,
    registry_version: row.registry_version ?? STATIC_REGISTRY_VERSION,
  };
}

async function _syncFromDb(): Promise<boolean> {
  try {
    const client = sb();
    if (!client) return false;
    const { data, error } = await client
      .from("model_registry")
      .select("*")
      .eq("enabled", true)
      .order("provider", { ascending: true });
    if (error || !data || data.length === 0) return false;
    _cache = data.map(_rowToModel);
    // Use the max registry_version from rows
    const versions = data.map((r: any) => r.registry_version).filter(Boolean);
    _registryVersion = versions.length > 0 ? versions.sort().pop()! : STATIC_REGISTRY_VERSION;
    _lastSync = Date.now();
    return true;
  } catch {
    return false;
  }
}

async function _ensureInit(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const ok = await _syncFromDb();
    if (!ok) {
      // DB unavailable → keep static fallback
      _cache = [...STATIC_MODELS];
      _registryVersion = STATIC_REGISTRY_VERSION;
    }
    _initialized = true;
  })();
  await _initPromise;
}

function _maybeSyncBackground(): void {
  if (Date.now() - _lastSync > SYNC_INTERVAL_MS) {
    _syncFromDb().catch(() => {}); // fire-and-forget
  }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — synchronous hot-path functions
// ═══════════════════════════════════════════════════════════════

/** Current registry version (from DB or static fallback) */
export function getRegistryVersion(): string {
  return _registryVersion;
}

/** Synchronous snapshot — returns cached models. Zero I/O. */
export function getRegistrySnapshot(): ModelDefinition[] {
  _maybeSyncBackground();
  return _cache;
}

/** Async init — call once at startup or first request */
export async function initRegistry(): Promise<void> {
  await _ensureInit();
}

/** Get all active models */
export function getActiveModels(): ModelDefinition[] {
  _maybeSyncBackground();
  return _cache.filter((m) => m.active);
}

/** Get models for a specific provider */
export function getModelsByProvider(provider: string): ModelDefinition[] {
  return _cache.filter((m) => m.active && m.provider === provider);
}

/** Best models for a numeric capability (reasoning, json_reliability, code_quality) */
export function getBestModelForCapability(
  capability: "reasoning" | "json_reliability" | "code_quality",
  minScore: number = 4,
): ModelDefinition[] {
  return _cache
    .filter((m) => m.active && m.capabilities[capability] >= minScore)
    .sort((a, b) => b.capabilities[capability] - a.capabilities[capability] || a.cost_per_1k_tokens - b.cost_per_1k_tokens);
}

/** Build a capability-filtered provider chain (unique providers) */
export function buildCapabilityChain(
  capability: "reasoning" | "json_reliability" | "code_quality",
  minScore: number,
): string[] {
  const models = getBestModelForCapability(capability, minScore);
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const m of models) {
    if (!seen.has(m.provider)) { seen.add(m.provider); chain.push(m.provider); }
  }
  return chain;
}

/** Build default chain ordered by cost (cheapest first) */
export function buildDefaultChain(): string[] {
  const providers = new Map<string, number>();
  for (const m of _cache) {
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

/** Get recommended model for a provider + optional capability */
export function getRecommendedModel(
  provider: string,
  capability?: "reasoning" | "json_reliability" | "code_quality",
): ModelDefinition | undefined {
  const models = getModelsByProvider(provider);
  if (models.length === 0) return undefined;
  if (!capability) return models[0];
  return models.sort((a, b) => b.capabilities[capability] - a.capabilities[capability])[0];
}

/** Get provider's lowest cost per 1K tokens */
export function getProviderCost(provider: string): number {
  const models = getModelsByProvider(provider);
  if (models.length === 0) return 0.002;
  return Math.min(...models.map((m) => m.cost_per_1k_tokens));
}

/** Total active models */
export function getActiveModelCount(): number {
  return _cache.filter((m) => m.active).length;
}

// Re-export version constant for backward compat
export const MODEL_REGISTRY_VERSION = STATIC_REGISTRY_VERSION;

// Keep direct access to static array for backward compat (legacy consumers)
export const MODEL_REGISTRY = STATIC_MODELS;

// ═══════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY (router.ts legacy API)
// ═══════════════════════════════════════════════════════════════

export interface ModelMetadata {
  id: string;
  provider: string;
  name: string;
  speed: "ultra-fast" | "fast" | "medium" | "slow";
  cost: "free" | "low" | "medium" | "high" | "premium";
  reliability: number;
  capabilities: { reasoning: number; coding: number; analysis: number; speed: number; };
  limits: { rpm: number; tpm: number; contextWindow: number; };
  pricing: { inputPerMillion: number; outputPerMillion: number; };
  available: boolean;
  fallbackPriority: number;
}

function _toMetadata(m: ModelDefinition): ModelMetadata {
  const costBucket = m.cost_per_1k_tokens <= 0 ? "free"
    : m.cost_per_1k_tokens <= 0.002 ? "low"
    : m.cost_per_1k_tokens <= 0.01 ? "medium"
    : m.cost_per_1k_tokens <= 0.05 ? "high" : "premium";
  return {
    id: m.model_id, provider: m.provider, name: m.display_name,
    speed: m.latency_class === "fast" ? "fast" : m.latency_class === "medium" ? "medium" : "slow",
    cost: costBucket, reliability: 0.95,
    capabilities: { reasoning: m.capabilities.reasoning*2, coding: m.capabilities.code_quality*2, analysis: m.capabilities.reasoning*2, speed: m.capabilities.streaming ? 8 : 4 },
    limits: { rpm: 1000, tpm: 200000, contextWindow: m.context_window },
    pricing: { inputPerMillion: m.cost_per_1k_tokens*1000, outputPerMillion: m.cost_per_1k_tokens*3000 },
    available: m.active,
    fallbackPriority: Math.round(m.cost_per_1k_tokens*1000) + (m.latency_class === "slow" ? 5 : 0),
  };
}

export function getModel(modelId: string): ModelMetadata | null {
  const m = _cache.find((r) => r.model_id === modelId || r.id === modelId || r.id.endsWith(":" + modelId));
  return m ? _toMetadata(m) : null;
}

export function getFallbackModel(): ModelMetadata {
  const cheapest = _cache.filter((m) => m.active).sort((a, b) => a.cost_per_1k_tokens - b.cost_per_1k_tokens)[0];
  return _toMetadata(cheapest ?? STATIC_MODELS[0]);
}

export function selectModelByTask(task: { needsReasoning?: boolean; needsSpeed?: boolean; needsCoding?: boolean; maxCost?: "free"|"low"|"medium"|"high"|"premium"; }): ModelMetadata {
  const costOrder = { free:0, low:1, medium:2, high:3, premium:4 };
  const maxCostLevel = task.maxCost ? costOrder[task.maxCost] : 4;
  const available = _cache.filter((m) => m.active).map((m) => ({model:m, meta:_toMetadata(m)})).filter(({meta}) => costOrder[meta.cost] <= maxCostLevel);
  if (available.length === 0) return getFallbackModel();
  const scored = available.map(({model,meta}) => {
    let score = 0;
    if (task.needsReasoning) score += model.capabilities.reasoning * 2;
    if (task.needsCoding) score += model.capabilities.code_quality * 2;
    if (task.needsSpeed) score += (model.capabilities.streaming ? 10 : 2);
    score += (5 - model.cost_per_1k_tokens * 100);
    return {meta, score};
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].meta;
}

export function getAvailableModels(): ModelMetadata[] {
  return _cache.filter((m) => m.active).map(_toMetadata);
}

export function getFreeModels(): ModelMetadata[] {
  return _cache.filter((m) => m.active && m.cost_per_1k_tokens === 0).map(_toMetadata);
}
