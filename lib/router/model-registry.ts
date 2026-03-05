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
];

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

  // FALLBACK: If no models after filtering, use gpt-4o-mini
  if (candidates.length === 0) {
    console.warn("[selectBestModel] No models available after filtering - using fallback");
    const fallback = MODEL_REGISTRY.find(m => m.id === "gpt-4o-mini");
    if (fallback) return fallback;
    return MODEL_REGISTRY[0]; // Last resort
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
