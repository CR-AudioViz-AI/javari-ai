export type ModelCapability = "light" | "standard" | "high";
export interface ModelDefinition {
  id: string;
  provider: string;
  capability: ModelCapability;
  costPer1k: number; // USD per 1k tokens (approximate)
  reasoningScore: number; // 1–10
  reliabilityScore: number; // 1–10
  latencyScore: number; // 1–10 (lower latency = higher score)
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
export interface RoutingRequest {
  requiredCapability: ModelCapability;
}
export function selectBestModel(req: RoutingRequest): ModelDefinition {
  const candidates = MODEL_REGISTRY.filter(
    (m) => m.capability === req.requiredCapability
  );
  if (candidates.length === 0) {
    throw new Error("No models available for required capability");
  }
  // Score = reliability + reasoning + latency - costPenalty
  const scored = candidates.map((m) => {
    const costPenalty = m.costPer1k;
    const score =
      m.reliabilityScore +
      m.reasoningScore +
      m.latencyScore -
      costPenalty;
    return { model: m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}
