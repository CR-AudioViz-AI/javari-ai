// lib/javari/providers/index.ts
/**
 * JAVARI AI PROVIDER REGISTRY
 * Master registry for all AI providers in the Javari ecosystem.
 *
 * KEY RESOLUTION: All API keys flow through vault.getProviderKey()
 * with a direct process.env fallback for cold-start safety.
 *
 * SELF-HEALING: getProviderApiKey() never throws — it returns '' for
 * unknown/missing keys. BaseProvider catches that at stream time and the
 * router fallback chain tries the next provider.
 *
 * TIMEOUT CHAIN: provider(20s) < router(23s) < chat(25s)
 * Timestamp: 2026-02-19 09:40 EST — vault-integrated v2
 */

import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { PerplexityProvider } from './PerplexityProvider';
import { MistralProvider } from './MistralProvider';
import { GroqProvider } from './GroqProvider';
import { XAIProvider } from './XAIProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { CohereProvider } from './CohereProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { AIProvider } from '../router/types';
import { vault } from '@/lib/javari/secrets/vault';

// Re-export all providers
export {
  BaseProvider,
  OpenAIProvider,
  AnthropicProvider,
  PerplexityProvider,
  MistralProvider,
  GroqProvider,
  XAIProvider,
  DeepSeekProvider,
  CohereProvider,
  OpenRouterProvider,
};

/**
 * Provider factory — creates instance with resolved API key.
 */
export function getProvider(provider: AIProvider, apiKey: string): BaseProvider {
  switch (provider) {
    case 'openai':      return new OpenAIProvider(apiKey);
    case 'anthropic':   return new AnthropicProvider(apiKey);
    case 'perplexity':  return new PerplexityProvider(apiKey);
    case 'mistral':     return new MistralProvider(apiKey);
    case 'groq':        return new GroqProvider(apiKey);
    case 'xai':         return new XAIProvider(apiKey);
    case 'deepseek':    return new DeepSeekProvider(apiKey);
    case 'cohere':      return new CohereProvider(apiKey);
    case 'openrouter':  return new OpenRouterProvider(apiKey);
    default:
      throw new Error(`Provider ${provider} not implemented`);
  }
}

/**
 * Resolve API key for a provider.
 * Resolution order:
 *   1. vault (cache → alias-aware env var lookup → encrypted env)
 *   2. Direct process.env fallback (legacy safety net)
 *
 * Returns '' (never throws) — missing key surfaces at generateStream() time
 * so the router fallback chain can try the next provider gracefully.
 */
export function getProviderApiKey(provider: AIProvider | string): string {
  // ── Primary: vault (handles aliases, encryption, multi-var lookup) ──
  const vaultKey = vault.getProviderKey(provider);
  if (vaultKey) return vaultKey;

  // ── Fallback: direct process.env ──────────────────────────────────────
  const legacyKeyMap: Record<string, string> = {
    openai:      'OPENAI_API_KEY',
    anthropic:   'ANTHROPIC_API_KEY',
    perplexity:  'PERPLEXITY_API_KEY',
    mistral:     'MISTRAL_API_KEY',
    groq:        'GROQ_API_KEY',
    xai:         'XAI_API_KEY',
    deepseek:    'DEEPSEEK_API_KEY',
    cohere:      'COHERE_API_KEY',
    openrouter:  'OPENROUTER_API_KEY',
    together:    'TOGETHER_API_KEY',
    fireworks:   'FIREWORKS_API_KEY',
    gemini:      'GEMINI_API_KEY',
    elevenlabs:  'ELEVENLABS_API_KEY',
  };

  const envKey = legacyKeyMap[provider as string];
  if (envKey) {
    const direct = process.env[envKey];
    if (direct) return direct;
  }

  // Return empty string — BaseProvider.requireApiKey() will throw a clear
  // error at stream time, enabling fallback rather than crashing the router.
  console.warn(
    `[Providers] No API key found for "${provider}". ` +
    `Provider will fail at runtime and router will fallback.`
  );
  return '';
}

/**
 * All available providers in priority order.
 */
export const ALL_PROVIDERS: AIProvider[] = [
  'openai',
  'anthropic',
  'perplexity',
  'mistral',
  'openrouter',
  'groq',
  'xai',
  'deepseek',
  'cohere',
];

export const PROVIDER_METADATA = {
  openai:     { name: 'OpenAI',      models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],                                 tier: 'core' },
  anthropic:  { name: 'Anthropic',   models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'], tier: 'core' },
  perplexity: { name: 'Perplexity',  models: ['sonar-pro', 'sonar'],                                                      tier: 'core' },
  mistral:    { name: 'Mistral',     models: ['mistral-large-latest', 'mistral-medium'],                                  tier: 'core' },
  openrouter: { name: 'OpenRouter',  models: ['200+ models via unified API'],                                             tier: 'core+' },
  groq:       { name: 'Groq',        models: ['llama-3.3-70b-versatile', 'mixtral-8x7b'],                                 tier: 'extended' },
  xai:        { name: 'xAI',         models: ['grok-beta'],                                                               tier: 'extended' },
  deepseek:   { name: 'DeepSeek',    models: ['deepseek-chat', 'deepseek-coder'],                                         tier: 'extended' },
  cohere:     { name: 'Cohere',      models: ['command', 'command-light'],                                                tier: 'extended' },
} as const;

export const providerMap = new Map(
  ALL_PROVIDERS.map(id => [id, PROVIDER_METADATA[id as keyof typeof PROVIDER_METADATA]])
);
