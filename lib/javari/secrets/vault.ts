// lib/javari/secrets/vault.ts
// ─────────────────────────────────────────────────────────────────────────────
// JAVARI OS — PERMANENT ENCRYPTED CREDENTIAL VAULT
// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM encryption using CREDENTIAL_ENCRYPTION_KEY (server-side only)
// Falls back to live process.env if no encryption key is set.
// NEVER logs or returns raw key strings.
// ─────────────────────────────────────────────────────────────────────────────
// Timestamp: 2026-02-18 16:45 EST

import crypto from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export type ProviderName =
  | "openai"
  | "anthropic"
  | "mistral"
  | "groq"
  | "perplexity"
  | "elevenlabs"
  | "openrouter"
  | "xai"
  | "deepseek"
  | "cohere"
  | "supabase_url"
  | "supabase_anon_key"
  | "supabase_service_role"
  | "github_pat"
  | "vercel_token"
  | "stripe_secret"
  | "stripe_webhook_secret"
  | "paypal_client_id"
  | "paypal_client_secret"
  | "resend"
  | "cron_secret"
  | "ingest_secret"
  | "admin_setup_key"
  | "credential_encryption_key";

export type KeyStatus = "ok" | "missing" | "invalid" | "expired";

export interface VaultEntry {
  provider: ProviderName;
  envVar: string;           // canonical env var name
  aliasEnvVars?: string[];  // alternate env var names (legacy/alias)
  description: string;
  required: boolean;        // will vault.assert() throw if missing?
  category: "ai_provider" | "infrastructure" | "payment" | "communication" | "internal";
}

export interface VaultStatus {
  provider: ProviderName;
  status: KeyStatus;
  envVar: string;
  present: boolean;
  // NOTE: never includes the actual key value
}

// ── Canonical Provider Registry ───────────────────────────────────────────────
// This is the single source of truth for every credential in Javari OS.

const REGISTRY: VaultEntry[] = [
  // AI Providers
  {
    provider: "openai",
    envVar: "OPENAI_API_KEY",
    description: "OpenAI — GPT-4, embeddings, Realtime API, TTS, image gen",
    required: true,
    category: "ai_provider",
  },
  {
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    description: "Anthropic — Claude Sonnet/Opus/Haiku",
    required: true,
    category: "ai_provider",
  },
  {
    provider: "mistral",
    envVar: "MISTRAL_API_KEY",
    description: "Mistral AI — mistral-large, mistral-medium",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "groq",
    envVar: "GROQ_API_KEY",
    description: "Groq — llama-3.3-70b, ultra-fast inference",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "perplexity",
    envVar: "PERPLEXITY_API_KEY",
    description: "Perplexity — sonar-pro, real-time web search",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "elevenlabs",
    envVar: "ELEVENLABS_API_KEY",
    description: "ElevenLabs — Javari voice synthesis (Charlotte voice)",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "openrouter",
    envVar: "OPENROUTER_API_KEY",
    description: "OpenRouter — 200+ model meta-router, fallback provider",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "xai",
    envVar: "XAI_API_KEY",
    description: "xAI — Grok models",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "deepseek",
    envVar: "DEEPSEEK_API_KEY",
    description: "DeepSeek — deepseek-chat, deepseek-coder",
    required: false,
    category: "ai_provider",
  },
  {
    provider: "cohere",
    envVar: "COHERE_API_KEY",
    description: "Cohere — Command models, embeddings",
    required: false,
    category: "ai_provider",
  },

  // Infrastructure
  {
    provider: "supabase_url",
    envVar: "NEXT_PUBLIC_SUPABASE_URL",
    aliasEnvVars: ["SUPABASE_URL"],
    description: "Supabase project URL (kteobfyferrukqeolofj.supabase.co)",
    required: true,
    category: "infrastructure",
  },
  {
    provider: "supabase_anon_key",
    envVar: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    aliasEnvVars: ["SUPABASE_ANON_KEY"],
    description: "Supabase anonymous/public key for client-side queries",
    required: true,
    category: "infrastructure",
  },
  {
    provider: "supabase_service_role",
    envVar: "SUPABASE_SERVICE_ROLE_KEY",
    description: "Supabase service role key — admin/server-side only",
    required: true,
    category: "infrastructure",
  },
  {
    provider: "github_pat",
    envVar: "GITHUB_TOKEN",
    aliasEnvVars: ["GITHUB_PAT", "GH_PAT"],
    description: "GitHub PAT — repo access, autonomous code pushes",
    required: true,
    category: "infrastructure",
  },
  {
    provider: "vercel_token",
    envVar: "VERCEL_TOKEN",
    aliasEnvVars: ["VERCEL_API_TOKEN"],
    description: "Vercel API token — autonomous deploy management",
    required: false,
    category: "infrastructure",
  },
  {
    provider: "credential_encryption_key",
    envVar: "CREDENTIAL_ENCRYPTION_KEY",
    description: "AES-256 master key for vault encryption (32 hex bytes = 64 chars)",
    required: false, // degrades gracefully to plaintext env reads
    category: "internal",
  },

  // Payment
  {
    provider: "stripe_secret",
    envVar: "STRIPE_SECRET_KEY",
    description: "Stripe secret key — checkout, subscriptions, payouts",
    required: false,
    category: "payment",
  },
  {
    provider: "stripe_webhook_secret",
    envVar: "STRIPE_WEBHOOK_SECRET",
    description: "Stripe webhook signing secret",
    required: false,
    category: "payment",
  },
  {
    provider: "paypal_client_id",
    envVar: "PAYPAL_CLIENT_ID",
    description: "PayPal client ID for payment flows",
    required: false,
    category: "payment",
  },
  {
    provider: "paypal_client_secret",
    envVar: "PAYPAL_CLIENT_SECRET",
    aliasEnvVars: ["PAYPAL_SECRET"],
    description: "PayPal client secret",
    required: false,
    category: "payment",
  },

  // Communication
  {
    provider: "resend",
    envVar: "RESEND_API_KEY",
    description: "Resend — transactional email delivery",
    required: false,
    category: "communication",
  },

  // Internal
  {
    provider: "cron_secret",
    envVar: "CRON_SECRET",
    description: "Cron auth token for autonomous bot jobs",
    required: false,
    category: "internal",
  },
  {
    provider: "ingest_secret",
    envVar: "INGEST_SECRET",
    description: "Auth token for /api/javari/ingest-r2 knowledge ingestion",
    required: false,
    category: "internal",
  },
  {
    provider: "admin_setup_key",
    envVar: "ADMIN_SETUP_KEY",
    aliasEnvVars: ["ADMIN_SETUP_SECRET", "X_ADMIN_KEY"],
    description: "Admin setup endpoint authorization key",
    required: false,
    category: "internal",
  },
];

// ── Encryption Helpers ────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer | null {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw || raw.length < 64) return null;
  try {
    return Buffer.from(raw.slice(0, 64), "hex");
  } catch {
    return null;
  }
}

/** Encrypt plaintext value. Returns base64 ciphertext or null on failure. */
export function encryptValue(plaintext: string): string | null {
  const key = getMasterKey();
  if (!key) return null; // no encryption key configured
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Layout: iv(16) + tag(16) + ciphertext
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  } catch {
    return null;
  }
}

/** Decrypt base64 ciphertext. Returns plaintext or null on failure. */
export function decryptValue(ciphertext: string): string | null {
  const key = getMasterKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return null;
  }
}

// ── In-Memory Cache (server process lifetime) ─────────────────────────────────
// Keys are read once at first access and cached. Never serialized to disk.

const _cache = new Map<ProviderName, string>();

// ── Core Vault API ────────────────────────────────────────────────────────────

/**
 * Get a credential by provider name.
 * Resolution order:
 *   1. In-memory cache
 *   2. Encrypted env var (CREDENTIAL_ENCRYPTION_KEY must be set)
 *   3. Plaintext env var (primary envVar)
 *   4. Plaintext env var (aliasEnvVars in order)
 * Returns null if not found. NEVER throws.
 */
export function vaultGet(provider: ProviderName): string | null {
  // 1. Cache
  if (_cache.has(provider)) return _cache.get(provider)!;

  const entry = REGISTRY.find((e) => e.provider === provider);
  if (!entry) return null;

  // 2. Try encrypted variant: envVar + "_ENCRYPTED"
  const encryptedEnvName = entry.envVar + "_ENCRYPTED";
  const encryptedVal = process.env[encryptedEnvName];
  if (encryptedVal) {
    const decrypted = decryptValue(encryptedVal);
    if (decrypted) {
      _cache.set(provider, decrypted);
      return decrypted;
    }
  }

  // 3. Plaintext primary env var
  const primary = process.env[entry.envVar];
  if (primary) {
    _cache.set(provider, primary);
    return primary;
  }

  // 4. Alias env vars
  for (const alias of entry.aliasEnvVars ?? []) {
    const val = process.env[alias];
    if (val) {
      _cache.set(provider, val);
      return val;
    }
  }

  return null;
}

/**
 * Assert a credential exists. Throws a descriptive error if missing.
 * Use in server-side routes that cannot function without the key.
 */
export function vaultAssert(provider: ProviderName): string {
  const val = vaultGet(provider);
  if (!val) {
    const entry = REGISTRY.find((e) => e.provider === provider);
    const envVar = entry?.envVar ?? provider;
    throw new Error(
      `[Vault] Missing required credential: ${provider} (env: ${envVar}). ` +
        `Set ${envVar} in Vercel environment variables. ` +
        `Description: ${entry?.description ?? "unknown"}`
    );
  }
  return val;
}

/**
 * Check status of all credentials. Returns array of status objects.
 * NEVER includes actual key values.
 */
export function vaultStatus(): VaultStatus[] {
  return REGISTRY.map((entry) => {
    const val = vaultGet(entry.provider);
    return {
      provider: entry.provider,
      envVar: entry.envVar,
      present: !!val,
      status: val ? "ok" : ("missing" as KeyStatus),
    };
  });
}

/**
 * Get status for a single provider. Safe to call from diagnostic endpoints.
 */
export function vaultGetStatus(provider: ProviderName): VaultStatus {
  const entry = REGISTRY.find((e) => e.provider === provider);
  if (!entry) {
    return { provider, envVar: "unknown", present: false, status: "missing" };
  }
  const val = vaultGet(provider);
  return {
    provider,
    envVar: entry.envVar,
    present: !!val,
    status: val ? "ok" : "missing",
  };
}

/**
 * Get all registry entries (no values). Safe to expose to diagnostics.
 */
export function vaultRegistry(): VaultEntry[] {
  return REGISTRY;
}

/**
 * Clear the in-memory cache. Call if env vars have been updated at runtime.
 */
export function vaultClearCache(): void {
  _cache.clear();
}

/**
 * Convenience: resolve key for a named AI provider.
 * Throws if key is not available and provider is required.
 */
export function getProviderKey(provider: string): string | null {
  const providerMap: Record<string, ProviderName> = {
    openai:     "openai",
    anthropic:  "anthropic",
    mistral:    "mistral",
    groq:       "groq",
    perplexity: "perplexity",
    elevenlabs: "elevenlabs",
    openrouter: "openrouter",
    xai:        "xai",
    deepseek:   "deepseek",
    cohere:     "cohere",
  };
  const vaultKey = providerMap[provider.toLowerCase()];
  if (!vaultKey) return null;
  return vaultGet(vaultKey);
}

// ── Named exports for direct import ──────────────────────────────────────────
export const vault = {
  get:          vaultGet,
  assert:       vaultAssert,
  status:       vaultStatus,
  getStatus:    vaultGetStatus,
  registry:     vaultRegistry,
  clearCache:   vaultClearCache,
  getProviderKey,
  encrypt:      encryptValue,
  decrypt:      decryptValue,
} as const;

export default vault;
