// app/api/javari/router/keys.ts
// Vault-integrated key resolver for the Javari multi-AI router.
// ALL keys flow through vault — no direct process.env access.
// Timestamp: 2026-02-19 09:40 EST

import { vault, type ProviderName } from '@/lib/javari/secrets/vault';

// Maps model string prefixes/keywords to vault ProviderName
const MODEL_TO_PROVIDER: Array<{ test: (m: string) => boolean; provider: ProviderName }> = [
  { test: m => m.startsWith('openai') || m.startsWith('gpt'),                    provider: 'openai' },
  { test: m => m.startsWith('anthropic') || m.startsWith('claude'),              provider: 'anthropic' },
  { test: m => m.startsWith('mistral') || m.includes('mixtral'),                  provider: 'mistral' },
  { test: m => m.startsWith('xai') || m.includes('grok'),                        provider: 'xai' },
  { test: m => m.startsWith('groq') || m.includes('llama') || m.includes('qwen'), provider: 'groq' },
  { test: m => m.startsWith('together') || m.includes('together'),               provider: 'together' },
  { test: m => m.startsWith('perplexity') || m.includes('sonar'),                provider: 'perplexity' },
  { test: m => m.startsWith('cohere') || m.startsWith('command'),                provider: 'cohere' },
  { test: m => m.startsWith('huggingface') || m.includes('hf/'),                 provider: 'huggingface' },
  { test: m => m.includes('openrouter') || m.includes('or/'),                    provider: 'openrouter' },
  { test: m => m.startsWith('fireworks') || m.includes('fw/'),                   provider: 'fireworks' },
  { test: m => m.startsWith('gemini') || m.includes('google'),                   provider: 'gemini' },
];

/**
 * Resolve the API key for a given model string.
 * Returns '' if provider not found — router fallback chain handles it.
 */
export function resolveKey(model: string): string {
  const lower = model.toLowerCase();
  for (const { test, provider } of MODEL_TO_PROVIDER) {
    if (test(lower)) {
      return vault.get(provider) ?? '';
    }
  }
  console.warn(`[RouterKeys] No provider mapping for model "${model}"`);
  return '';
}

/**
 * Resolve API key directly by provider name.
 */
export function resolveKeyByProvider(provider: ProviderName): string {
  return vault.get(provider) ?? '';
}
