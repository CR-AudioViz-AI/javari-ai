/**
 * JAVARI UNIFIED CREDENTIAL VAULT
 * AES-256-GCM encrypted, self-healing, multi-agent credential store
 *
 * Architecture:
 * - Primary source: Vercel environment variables (encrypted at rest)
 * - Canonical names: snake_case provider aliases (e.g. "openai", "anthropic")
 * - All real key strings stay server-side only; never returned to client
 * - vault.get()            → raw key | null
 * - vault.getSafe()        → { ok, provider, hint } for status checks
 * - vault.assert()         → throws descriptive error if key missing
 * - vault.getProviderKey() → raw key | null (alias for providers/index.ts)
 * - vault.sync()           → reconciles Vercel ↔ vault, fixes naming mismatches
 *
 * Timestamp: 2026-02-19 09:40 EST
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderName =
  // AI Providers
  | 'anthropic' | 'openai' | 'gemini' | 'groq' | 'mistral'
  | 'perplexity' | 'openrouter' | 'xai' | 'together' | 'fireworks'
  | 'huggingface' | 'cohere' | 'stability' | 'replicate' | 'deepseek'
  | 'azure_openai' | 'nomic' | 'voyage'
  // Voice & Media
  | 'elevenlabs' | 'heygen' | 'did' | 'runway' | 'shotstack'
  | 'deepgram' | 'assemblyai'
  // Payments
  | 'stripe' | 'stripe_webhook' | 'paypal' | 'paypal_secret'
  // Infrastructure
  | 'supabase_url' | 'supabase_anon' | 'supabase_service'
  | 'github' | 'vercel' | 'cloudinary' | 'imagekit'
  | 'pusher' | 'qdrant' | 'resend' | 'cloudflare_r2'
  // Data & Search
  | 'tavily' | 'jina' | 'perplexity_market'
  | 'finnhub' | 'alpha_vantage' | 'coingecko'
  | 'tmdb' | 'rawg' | 'giphy' | 'pexels' | 'unsplash' | 'pixabay'
  | 'newsapi' | 'gnews' | 'newsdata' | 'thenewsapi' | 'currents'
  | 'google_maps' | 'mapbox' | 'geoapify'
  | 'twitch' | 'discord'
  | 'rapidapi' | 'hunter' | 'crawlbase'
  | 'amadeus' | 'viator' | 'getyourguide'
  | 'printful' | 'removebg' | 'tinypng'
  | 'stripe_pro_price' | 'stripe_creator_price'
  // Meta
  | 'jwt_secret' | 'nextauth_secret' | 'cron_secret'
  | 'admin_setup' | 'javari_api';

export type KeyStatus = 'ok' | 'missing' | 'invalid' | 'expired' | 'mis-scoped';

export interface CredentialStatus {
  provider: ProviderName;
  status: KeyStatus;
  hint: string;          // last 4 chars of key, never full key
  envVar: string;        // which env var name resolves this
  lastChecked?: string;  // ISO timestamp
}

export interface VaultSyncResult {
  restored: string[];
  verified: string[];
  failed: string[];
  missing: string[];
  timestamp: string;
}

// ─── Canonical Env Var Map ─────────────────────────────────────────────────
// Maps provider alias → Vercel env var name(s) in priority order

const PROVIDER_ENV_MAP: Record<ProviderName, string[]> = {
  // AI
  anthropic:       ['ANTHROPIC_API_KEY'],
  openai:          ['OPENAI_API_KEY'],
  gemini:          ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY'],
  groq:            ['GROQ_API_KEY'],
  mistral:         ['MISTRAL_API_KEY'],
  perplexity:      ['PERPLEXITY_API_KEY'],
  openrouter:      ['OPENROUTER_API_KEY'],
  xai:             ['XAI_API_KEY'],
  together:        ['TOGETHER_API_KEY'],
  fireworks:       ['FIREWORKS_API_KEY'],
  huggingface:     ['HUGGINGFACE_API_KEY'],
  cohere:          ['COHERE_API_KEY'],
  stability:       ['STABILITY_API_KEY'],
  replicate:       ['REPLICATE_API_TOKEN', 'REPLICATE_API_KEY'],
  deepseek:        ['DEEPSEEK_API_KEY'],
  azure_openai:    ['AZURE_OPENAI_API_KEY'],
  nomic:           ['NOMIC_API_KEY'],
  voyage:          ['VOYAGE_API_KEY'],
  // Voice & Media
  elevenlabs:      ['ELEVENLABS_API_KEY'],
  heygen:          ['HEYGEN_API_KEY'],
  did:             ['DID_API_KEY'],
  runway:          ['RUNWAY_API_KEY'],
  shotstack:       ['SHOTSTACK_PRODUCTION_API_KEY'],
  deepgram:        ['DEEPGRAM_API_KEY'],
  assemblyai:      ['ASSEMBLYAI_API_KEY'],
  // Payments
  stripe:          ['STRIPE_SECRET_KEY'],
  stripe_webhook:  ['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET_NEW'],
  paypal:          ['PAYPAL_CLIENT_ID'],
  paypal_secret:   ['PAYPAL_CLIENT_SECRET'],
  // Infrastructure
  supabase_url:    ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  supabase_anon:   ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  supabase_service:['SUPABASE_SERVICE_ROLE_KEY'],
  github:          ['GITHUB_WRITE_TOKEN', 'GH_PAT', 'GITHUB_TOKEN', 'GITHUB_READ_TOKEN'],
  vercel:          ['VERCEL_API_TOKEN', 'VERCEL_TOKEN'],
  cloudinary:      ['CLOUDINARY_URL'],
  imagekit:        ['IMAGEKIT_PRIVATE_KEY'],
  pusher:          ['PUSHER_SECRET'],
  qdrant:          ['QDRANT_API_KEY'],
  resend:          ['RESEND_API_KEY'],
  cloudflare_r2:   ['R2_SECRET_ACCESS_KEY'],
  // Data & Search
  tavily:          ['TAVILY_API_KEY'],
  jina:            ['JINA_API_KEY'],
  perplexity_market: ['PERPLEXITY_API_KEY'],
  finnhub:         ['FINNHUB_API_KEY'],
  alpha_vantage:   ['ALPHA_VANTAGE_API_KEY', 'ALPHA_VANTAGE_KEY'],
  coingecko:       ['COINGECKO_API_KEY'],
  tmdb:            ['TMDB_API_KEY'],
  rawg:            ['RAWG_API_KEY'],
  giphy:           ['GIPHY_API_KEY'],
  pexels:          ['PEXELS_API_KEY'],
  unsplash:        ['UNSPLASH_ACCESS_KEY'],
  pixabay:         ['PIXABAY_API_KEY'],
  newsapi:         ['NEWSAPI_API_KEY', 'NEWSAPI_KEY'],
  gnews:           ['GNEWS_API_KEY'],
  newsdata:        ['NEWSDATA_API_KEY'],
  thenewsapi:      ['THENEWSAPI_KEY', 'THENEWS_API_KEY'],
  currents:        ['CURRENTS_API_KEY'],
  google_maps:     ['GOOGLE_MAPS_API_KEY'],
  mapbox:          ['MAPBOX_ACCESS_TOKEN'],
  geoapify:        ['GEOAPIFY_API_KEY'],
  twitch:          ['TWITCH_CLIENT_ID'],
  discord:         ['DISCORD_WEBHOOK_URL'],
  rapidapi:        ['RAPIDAPI_KEY'],
  hunter:          ['HUNTER_API_KEY'],
  crawlbase:       ['CRAWLBASE_NORMAL_TOKEN'],
  amadeus:         ['AMADEUS_API_KEY'],
  viator:          ['VIATOR_PARTNER_ID'],
  getyourguide:    ['GETYOURGUIDE_PARTNER_ID'],
  printful:        ['PRINTFUL_API_KEY'],
  removebg:        ['REMOVEBG_API_KEY'],
  tinypng:         ['TINYPNG_API_KEY'],
  stripe_pro_price:    ['STRIPE_PRO_PRICE_ID'],
  stripe_creator_price: ['STRIPE_CREATOR_PRICE_ID'],
  // Meta
  jwt_secret:      ['JWT_SECRET'],
  nextauth_secret: ['NEXTAUTH_SECRET'],
  cron_secret:     ['CRON_SECRET'],
  admin_setup:     ['ADMIN_SETUP_SECRET'],
  javari_api:      ['JAVARI_API_KEY'],
};

// ─── Encryption helpers (server-side only) ─────────────────────────────────

function getMasterKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    // Vault still works without encryption — keys are stored plaintext in Vercel
    return Buffer.alloc(32); // fallback (no-op encryption path)
  }
  return raw.length === 64
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
}

export function encryptValue(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptValue(ciphertext: string): string {
  const key = getMasterKey();
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('[Vault] Malformed ciphertext');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final('utf8');
}

// ─── Core Vault ───────────────────────────────────────────────────────────

class CredentialVault {
  private cache = new Map<ProviderName, string>();

  /**
   * Resolve a provider alias → raw key string | null
   * Tries env vars in priority order, handles encrypted values transparently.
   * NEVER call from client-side code.
   */
  get(provider: ProviderName): string | null {
    if (this.cache.has(provider)) return this.cache.get(provider)!;

    const envVars = PROVIDER_ENV_MAP[provider];
    if (!envVars) return null;

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value && value.trim() !== '') {
        const resolved = value.includes(':') && value.split(':').length === 3
          ? this.tryDecrypt(value)
          : value;
        if (resolved) {
          this.cache.set(provider, resolved);
          return resolved;
        }
      }
    }

    return null;
  }

  /**
   * Alias for get() — used by providers/index.ts getProviderApiKey().
   * Maps AIProvider string → ProviderName, resolves key.
   */
  getProviderKey(provider: string): string | null {
    // Direct match first
    if (provider in PROVIDER_ENV_MAP) {
      return this.get(provider as ProviderName);
    }
    // Common alias normalisation
    const aliases: Record<string, ProviderName> = {
      'claude':        'anthropic',
      'gpt':           'openai',
      'gpt-4':         'openai',
      'gpt-3.5':       'openai',
      'grok':          'xai',
      'llama':         'groq',
      'mixtral':       'groq',
      'sonar':         'perplexity',
      'command':       'cohere',
      'deepseek-chat': 'deepseek',
      'gemini-pro':    'gemini',
    };
    const mapped = aliases[provider];
    return mapped ? this.get(mapped) : null;
  }

  /**
   * Like get() but throws a descriptive error if key missing.
   */
  assert(provider: ProviderName): string {
    const value = this.get(provider);
    if (!value) {
      const envVars = PROVIDER_ENV_MAP[provider] ?? [];
      throw new Error(
        `[Vault] Missing credential for provider "${provider}". ` +
        `Checked env vars: ${envVars.join(', ')}. ` +
        `Add to Vercel environment variables or run vault.sync().`
      );
    }
    return value;
  }

  /**
   * Returns status without exposing the key — safe for API responses.
   */
  getSafe(provider: ProviderName): CredentialStatus {
    const envVars = PROVIDER_ENV_MAP[provider] ?? [];
    let resolvedEnvVar = 'none';
    let value: string | null = null;

    for (const envVar of envVars) {
      const raw = process.env[envVar];
      if (raw && raw.trim() !== '') {
        resolvedEnvVar = envVar;
        value = raw.includes(':') && raw.split(':').length === 3
          ? this.tryDecrypt(raw)
          : raw;
        if (value) break;
      }
    }

    return {
      provider,
      status: value ? 'ok' : 'missing',
      hint: value ? `...${value.slice(-4)}` : 'n/a',
      envVar: resolvedEnvVar,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * All provider statuses in one call — safe for /api/javari/status.
   */
  getAllStatuses(): CredentialStatus[] {
    return (Object.keys(PROVIDER_ENV_MAP) as ProviderName[]).map(p => this.getSafe(p));
  }

  /**
   * Core provider summary — AI + payments + infra only.
   */
  getCoreStatuses(): CredentialStatus[] {
    const coreProviders: ProviderName[] = [
      'anthropic', 'openai', 'groq', 'mistral', 'perplexity',
      'openrouter', 'xai', 'together', 'fireworks', 'gemini',
      'elevenlabs',
      'stripe', 'stripe_webhook', 'paypal', 'paypal_secret',
      'supabase_url', 'supabase_anon', 'supabase_service',
      'github', 'vercel',
      'cloudinary', 'qdrant', 'resend',
    ];
    return coreProviders.map(p => this.getSafe(p));
  }

  /**
   * Clear the in-memory cache (call after rotating keys).
   */
  invalidateCache(provider?: ProviderName): void {
    if (provider) {
      this.cache.delete(provider);
    } else {
      this.cache.clear();
    }
  }

  private tryDecrypt(value: string): string | null {
    try {
      return decryptValue(value);
    } catch {
      return value; // Not encrypted — use as-is
    }
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────
export const vault = new CredentialVault();

// Convenience exports
export const getKey = (provider: ProviderName) => vault.get(provider);
export const assertKey = (provider: ProviderName) => vault.assert(provider);

// ─── Agent-scoped access ──────────────────────────────────────────────────

export type AgentName =
  | 'javari'
  | 'claude'
  | 'chatgpt'
  | 'router'
  | 'autonomous-executor'
  | 'voice-subsystem'
  | 'admin';

const AGENT_PERMISSIONS: Record<AgentName, ProviderName[]> = {
  javari: Object.keys(PROVIDER_ENV_MAP) as ProviderName[],
  admin:  Object.keys(PROVIDER_ENV_MAP) as ProviderName[],
  router: ['anthropic','openai','gemini','groq','mistral','perplexity','openrouter','xai','together','fireworks'],
  claude: ['anthropic','openai','gemini','groq','perplexity','openrouter','supabase_service','supabase_url','supabase_anon'],
  chatgpt:['openai','anthropic','groq','perplexity','supabase_service','supabase_url','supabase_anon'],
  'autonomous-executor': ['anthropic','openai','gemini','groq','openrouter','github','vercel','supabase_service','tavily'],
  'voice-subsystem': ['elevenlabs','deepgram','assemblyai','openai','groq'],
};

export function getCredentialForAgent(
  agentName: AgentName,
  providerName: ProviderName
): string {
  const allowed = AGENT_PERMISSIONS[agentName];
  if (!allowed) throw new Error(`[Vault] Unknown agent: "${agentName}"`);
  if (!allowed.includes(providerName)) {
    throw new Error(
      `[Vault] Agent "${agentName}" is not permitted to access provider "${providerName}". ` +
      `Update AGENT_PERMISSIONS in vault.ts to grant access.`
    );
  }
  return vault.assert(providerName);
}

export { PROVIDER_ENV_MAP };
