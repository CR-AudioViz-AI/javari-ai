// lib/javari/providers/index.ts
/**
 * JAVARI AI PROVIDER REGISTRY
 * Master registry for all AI providers in the Javari ecosystem
 *
 * KEY RESOLUTION: All API keys now flow through vault.getProviderKey()
 * instead of direct process.env access. Vault reads process.env internally
 * with alias resolution and encrypted key support.
 *
 * CORE PROVIDERS (Production-ready):
 * - OpenAI: GPT-4 Turbo, GPT-4, GPT-3.5
 * - Anthropic: Claude Sonnet/Opus/Haiku
 * - Perplexity: Sonar Pro (with web search)
 * - Mistral: Mistral Large Latest
 *
 * EXTENDED PROVIDERS (Available):
 * - Groq: Fast inference
 * - xAI: Grok models
 * - DeepSeek: DeepSeek models
 * - Cohere: Command models
 * - OpenRouter: 200+ models
 *
 * TIMEOUT CHAIN: provider(20s) < router(23s) < chat(25s)
 * Timestamp: 2026-02-18 16:45 EST — vault-integrated
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
 * Provider factory function
 * Creates a provider instance with the appropriate API key
 *
 * @param provider - Provider ID (e.g., 'openai', 'anthropic')
 * @param apiKey - API key for the provider
 * @returns Provider instance ready for streaming
 * @throws Error if provider not implemented
 */
export function getProvider(provider: AIProvider, apiKey: string): BaseProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'perplexity':
      return new PerplexityProvider(apiKey);
    case 'mistral':
      return new MistralProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    case 'xai':
      return new XAIProvider(apiKey);
    case 'deepseek':
      return new DeepSeekProvider(apiKey);
    case 'cohere':
      return new CohereProvider(apiKey);
    case 'openrouter':
      return new OpenRouterProvider(apiKey);
    default:
      throw new Error(`Provider ${provider} not implemented`);
  }
}

/**
 * Get API key for a provider.
 * ── VAULT-INTEGRATED ──
 * Resolution order:
 *   1. Vault (in-memory cache → encrypted env → plaintext env → alias env)
 *   2. Direct process.env fallback (for backwards compat during transition)
 *
 * @param provider - Provider ID
 * @returns API key string
 * @throws Error if API key not found via any path
 */
export function getProviderApiKey(provider: AIProvider): string {
  // ── Primary: vault resolution (alias-aware, cache-optimized) ──
  const vaultKey = vault.getProviderKey(provider);
  if (vaultKey) return vaultKey;

  // ── Fallback: direct process.env (legacy compatibility) ──
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
  };

  const envKey = legacyKeyMap[provider];
  if (envKey) {
    const direct = process.env[envKey];
    if (direct) return direct;
  }

  throw new Error(
    `[Providers] Missing API key for "${provider}". ` +
    `Set ${envKey ?? provider.toUpperCase() + '_API_KEY'} in Vercel environment variables.`
  );
}

/**
 * All available providers in priority order
 * Core providers first, then extended providers
 */
export const ALL_PROVIDERS: AIProvider[] = [
  // Core providers (production-ready)
  'openai',
  'anthropic',
  'perplexity',
  'mistral',

  // Core+ (Meta-provider with 200+ models)
  'openrouter',

  // Extended providers
  'groq',
  'xai',
  'deepseek',
  'cohere',
];

/**
 * Provider metadata for display and routing
 */
export const PROVIDER_METADATA = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
    capabilities: ['chat', 'function-calling', 'vision'],
    tier: 'core',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
    capabilities: ['chat', 'long-context', 'analysis'],
    tier: 'core',
  },
  perplexity: {
    name: 'Perplexity',
    models: ['sonar-pro', 'sonar'],
    capabilities: ['chat', 'web-search', 'real-time'],
    tier: 'core',
  },
  mistral: {
    name: 'Mistral',
    models: ['mistral-large-latest', 'mistral-medium', 'mistral-small'],
    capabilities: ['chat', 'multilingual', 'code'],
    tier: 'core',
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['200+ models via unified API'],
    capabilities: ['chat', 'streaming', 'multi-model', 'cost-optimization', 'dynamic-routing', 'free-tier'],
    tier: 'core+',
  },
  groq: {
    name: 'Groq',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b'],
    capabilities: ['chat', 'fast-inference'],
    tier: 'extended',
  },
  xai: {
    name: 'xAI',
    models: ['grok-beta'],
    capabilities: ['chat', 'humor', 'real-time'],
    tier: 'extended',
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    capabilities: ['chat', 'code', 'reasoning'],
    tier: 'extended',
  },
  cohere: {
    name: 'Cohere',
    models: ['command', 'command-light'],
    capabilities: ['chat', 'embeddings', 'search'],
    tier: 'extended',
  },
} as const;

/**
 * Provider map for quick lookup
 */
export const providerMap = new Map(
  ALL_PROVIDERS.map(id => [id, PROVIDER_METADATA[id as keyof typeof PROVIDER_METADATA]])
);
