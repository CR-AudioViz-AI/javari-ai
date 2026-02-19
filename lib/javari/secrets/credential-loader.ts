/**
 * JAVARI CREDENTIAL LOADER
 * Drop-in replacement for direct process.env access in all provider files.
 *
 * Usage:
 *   // OLD: const key = process.env.OPENAI_API_KEY!
 *   // NEW:
 *   import { loadCredential } from '@/lib/javari/secrets/credential-loader'
 *   const key = loadCredential('openai')
 *
 * For typed access with full provider configs:
 *   import { providers } from '@/lib/javari/secrets/credential-loader'
 *   const { apiKey, baseUrl } = providers.openai()
 */

import { vault, assertKey, type ProviderName } from './vault';

// ─── Simple loader ─────────────────────────────────────────────────────────

export function loadCredential(provider: ProviderName): string {
  return assertKey(provider);
}

export function loadCredentialOptional(provider: ProviderName): string | null {
  return vault.get(provider);
}

// ─── Typed provider configs ───────────────────────────────────────────────

export const providers = {
  openai: () => ({
    apiKey: assertKey('openai'),
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4o',
  }),

  anthropic: () => ({
    apiKey: assertKey('anthropic'),
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL ?? 'claude-sonnet-4-20250514',
  }),

  gemini: () => ({
    apiKey: assertKey('gemini'),
    defaultModel: process.env.GEMINI_DEFAULT_MODEL ?? 'gemini-1.5-pro',
  }),

  groq: () => ({
    apiKey: assertKey('groq'),
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: process.env.GROQ_DEFAULT_MODEL ?? 'llama-3.1-70b-versatile',
  }),

  mistral: () => ({
    apiKey: assertKey('mistral'),
    defaultModel: 'mistral-large-latest',
  }),

  perplexity: () => ({
    apiKey: assertKey('perplexity'),
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
  }),

  openrouter: () => ({
    apiKey: assertKey('openrouter'),
    baseUrl: 'https://openrouter.ai/api/v1',
  }),

  xai: () => ({
    apiKey: assertKey('xai'),
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-beta',
  }),

  together: () => ({
    apiKey: assertKey('together'),
    baseUrl: 'https://api.together.xyz/v1',
  }),

  elevenlabs: () => ({
    apiKey: assertKey('elevenlabs'),
    baseUrl: 'https://api.elevenlabs.io/v1',
    defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB',
  }),

  supabase: () => ({
    url: assertKey('supabase_url'),
    anonKey: assertKey('supabase_anon'),
    serviceKey: assertKey('supabase_service'),
  }),

  stripe: () => ({
    secretKey: assertKey('stripe'),
    webhookSecret: assertKey('stripe_webhook'),
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
    proPriceId: vault.get('stripe_pro_price') ?? '',
    creatorPriceId: vault.get('stripe_creator_price') ?? '',
  }),

  paypal: () => ({
    clientId: assertKey('paypal'),
    clientSecret: assertKey('paypal_secret'),
    mode: (process.env.PAYPAL_MODE ?? 'live') as 'live' | 'sandbox',
  }),

  github: () => ({
    token: assertKey('github'),
    org: process.env.GITHUB_DEFAULT_OWNER ?? process.env.GITHUB_ORG ?? 'CR-AudioViz-AI',
    defaultRepo: process.env.GITHUB_DEFAULT_REPO ?? 'javari-ai',
  }),

  vercel: () => ({
    token: assertKey('vercel'),
    teamId: process.env.VERCEL_TEAM_ID ?? 'team_Z0yef7NlFu1coCJWz8UmUdI5',
    projectId: process.env.VERCEL_PROJECT_ID ?? '',
  }),
};

// ─── Bulk multi-provider loader (for router) ──────────────────────────────

export interface RouterCredentials {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  groq?: string;
  mistral?: string;
  perplexity?: string;
  openrouter?: string;
  xai?: string;
  together?: string;
}

export function loadRouterCredentials(): RouterCredentials {
  const aiProviders: ProviderName[] = [
    'openai','anthropic','gemini','groq','mistral','perplexity','openrouter','xai','together'
  ];
  const result: RouterCredentials = {};
  for (const provider of aiProviders) {
    const key = vault.get(provider);
    if (key) (result as Record<string, string>)[provider] = key;
  }
  return result;
}
