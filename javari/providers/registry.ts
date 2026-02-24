import type { ProviderAdapter } from "./types";
import { claudeAdapter } from "./vendor/adapterClaude";
import { openaiAdapter } from "./vendor/adapterOpenAI";
import { llamaAdapter } from "./vendor/adapterLlama";
import { mistralAdapter } from "./vendor/adapterMistral";
import { grokAdapter } from "./vendor/adapterGrok";

// Registry map
const REGISTRY: Record<string, ProviderAdapter> = {
  [claudeAdapter.providerId]: claudeAdapter,
  [openaiAdapter.providerId]: openaiAdapter,
  [llamaAdapter.providerId]: llamaAdapter,
  [mistralAdapter.providerId]: mistralAdapter,
  [grokAdapter.providerId]: grokAdapter,
};

export function resolveProvider(modelId: string): ProviderAdapter {
  // In future: alias resolution, version matching, fallback policies
  if (REGISTRY[modelId]) return REGISTRY[modelId];
  throw new Error(`Provider not registered for modelId: ${modelId}`);
}
