export type ModelCapability = "light" | "standard" | "high";

export interface ModelDefinition {
  id: string;
  provider: string;
  capability: ModelCapability;
  costPer1k: number;
  reasoningScore: number;
  reliabilityScore: number;
  latencyScore: number;
}

// Guaranteed fallback model - always available
const FALLBACK_MODEL_ID = "gpt-4o-mini";

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: "mistral-small",
    provider: "mistral",
    capability: "light",
    costPer1k: 0.2,
    reasoningScore: 5,
    reliabilityScore: 7,
    latencyScore: 9,
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    capability: "standard",
    costPer1k: 0.5,
    reasoningScore: 7,
    reliabilityScore: 8,
    latencyScore: 8,
  },
  {
    id: "gpt-4o",
    provider: "openai",
    capability: "high",
    costPer1k: 2.5,
    reasoningScore: 9,
    reliabilityScore: 9,
    latencyScore: 7,
  },
  {
    id: "claude-3-sonnet",
    provider: "anthropic",
    capability: "high",
    costPer1k: 3.0,
    reasoningScore: 9,
    reliabilityScore: 9,
    latencyScore: 7,
  },
  {
    id: "claude-sonnet-4-20250514",
    provider: "anthropic",
    capability: "high",
    costPer1k: 3.0,
    reasoningScore: 10,
    reliabilityScore: 10,
    latencyScore: 7,
  },
  // ── Builder-tier model: cheapest capable model for roadmap task execution ──
  // gemini-2.0-flash: $0.075/1k tokens — ~40x cheaper than Sonnet 4
  // Capable of structured JSON output, fast, reliable for planning tasks
  {
    id: "gemini-2.0-flash-exp",
    provider: "google",
    capability: "standard",
    costPer1k: 0.075,
    reasoningScore: 7,
    reliabilityScore: 8,
    latencyScore: 9,
  },
];

// ── Role-based model constants (Henderson Standard routing) ───────────────────
// builder_model: cheapest capable model — used for roadmap task execution
// validator_model: highest reasoning model — used for validation passes
export const BUILDER_MODEL_ID = "gemini-2.0-flash-exp";
export const VALIDATOR_MODEL_ID = "claude-sonnet-4-20250514";

export interface RoutingPreferences {
  allowedModels?: string[];
  excludedModels?: string[];
  routingPriority?: "cost" | "quality" | "latency";
}

export function selectBestModel(
  capability: ModelCapability,
  preferences?: RoutingPreferences
): ModelDefinition {
  let candidates = MODEL_REGISTRY.filter(
    (m) => m.capability === capability || capability === "light"
  );

  if (preferences?.allowedModels) {
    candidates = candidates.filter((m) =>
      preferences.allowedModels!.includes(m.id)
    );
  }

  if (preferences?.excludedModels) {
    candidates = candidates.filter(
      (m) => !preferences.excludedModels!.includes(m.id)
    );
  }

  // GUARANTEED FALLBACK: If no models after filtering, use fallback
  if (candidates.length === 0) {
    console.warn("[selectBestModel] No models available after filtering - using guaranteed fallback:", FALLBACK_MODEL_ID);
    const fallback = MODEL_REGISTRY.find(m => m.id === FALLBACK_MODEL_ID);
    
    if (!fallback) {
      console.error("[selectBestModel] CRITICAL: Fallback model not in registry! Using first available model");
      return MODEL_REGISTRY[0];
    }
    
    return fallback;
  }

  const priority = preferences?.routingPriority ?? "quality";

  if (priority === "cost") {
    return candidates.sort((a, b) => a.costPer1k - b.costPer1k)[0];
  }

  if (priority === "quality") {
    return candidates.sort(
      (a, b) => b.reasoningScore - a.reasoningScore
    )[0];
  }

  if (priority === "latency") {
    return candidates.sort((a, b) => b.latencyScore - a.latencyScore)[0];
  }

  return candidates[0];
}

// Helper function to get fallback model
export function getFallbackModel(): ModelDefinition {
  const fallback = MODEL_REGISTRY.find(m => m.id === FALLBACK_MODEL_ID);
  if (!fallback) {
    console.error("[getFallbackModel] CRITICAL: Fallback model missing from registry!");
    return MODEL_REGISTRY[0];
  }
  return fallback;
}
