// javari/routing/execution/adapter.ts
// Adapter selection for different AI providers

import { claudeAdapter, openaiAdapter, mistralAdapter } from "../providers/live";
import type { ProviderAdapter } from "../providers/live/types";

export const adapters: Record<string, ProviderAdapter> = {
  claude: claudeAdapter,
  openai: openaiAdapter,
  mistral: mistralAdapter,
  // Removed adapters (missing dependencies):
  // llama: llamaAdapter,
  // grok: grokAdapter,
};

export function getAdapter(provider: string): ProviderAdapter | null {
  return adapters[provider] || null;
}
