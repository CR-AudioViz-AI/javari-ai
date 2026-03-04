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
    id: "claude-3-sonnet",
    provider: "anthropic",
    capability: "high",
    costPer1k: 3.0,
    reasoningScore: 9,
    reliabilityScore: 9,
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
    (m) => m.capability === capability
  );

  // Apply allowed filter
  if (preferences?.allowedModels?.length) {
    candidates = candidates.filter((m) =>
      preferences.allowedModels!.includes(m.id)
    );
  }

  // Apply excluded filter
  if (preferences?.excludedModels?.length) {
    candidates = candidates.filter(
      (m) => !preferences.excludedModels!.includes(m.id)
    );
  }

  if (!candidates.length) {
    throw new Error("No models available after applying preferences.");
  }

  const scored = candidates.map((m) => {
    let score =
      m.reliabilityScore +
      m.reasoningScore +
      m.latencyScore -
      m.costPer1k;

    if (preferences?.routingPriority === "cost") {
      score += 10 - m.costPer1k * 2;
    }

    if (preferences?.routingPriority === "quality") {
      score += m.reasoningScore * 2;
    }

    if (preferences?.routingPriority === "latency") {
      score += m.latencyScore * 2;
    }

    return { model: m, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0].model;
}
