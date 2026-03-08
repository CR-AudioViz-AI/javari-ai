// lib/security/vaultClient.ts
// CR AudioViz AI — Unified Vault Client
// Purpose: Single facade over Platform Secret Authority (lib/platform-secrets/getSecret)
//          and Javari Vault v3 (lib/javari/secrets/vault). All credential retrieval
//          in the platform goes through this file. Never use process.env for API keys.
// Date: 2026-03-09
//
// Architecture:
//   vaultClient → getSecret() (Platform Secret Authority, Supabase-backed, AES-256-GCM)
//              → vault.get() (Javari Secrets Vault v3, fallback)
//              → process.env (last-resort bootstrap only, logs warning)
//
// Canonical provider secret names:
//   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY,
//   GROQ_API_KEY, MISTRAL_API_KEY, COHERE_API_KEY, PERPLEXITY_API_KEY,
//   TOGETHER_API_KEY, FIREWORKS_API_KEY, REPLICATE_API_KEY,
//   GITHUB_TOKEN, VERCEL_TOKEN, STRIPE_SECRET_KEY, PAYPAL_CLIENT_SECRET

import { getSecret }   from "@/lib/platform-secrets/getSecret";
import { vault }       from "@/lib/javari/secrets/vault";

// ── Types ──────────────────────────────────────────────────────────────────

export type VaultProvider =
  | "openai" | "anthropic" | "google" | "openrouter"
  | "groq" | "mistral" | "cohere" | "perplexity"
  | "together" | "fireworks" | "replicate" | "huggingface"
  | "deepseek" | "xai" | "github" | "vercel"
  | "stripe" | "paypal";

export interface VaultCredential {
  provider  : VaultProvider | string;
  secretName: string;
  value     : string;
  active    : boolean;
  source    : "secret_authority" | "javari_vault" | "env_fallback";
}

export interface VaultStatusReport {
  checkedAt  : string;
  total      : number;
  active     : number;
  missing    : number;
  providers  : Array<{ provider: string; secretName: string; active: boolean; source: string }>;
}

// ── Canonical provider → secret name map ─────────────────────────────────

const PROVIDER_SECRET_MAP: Record<VaultProvider, string> = {
  openai     : "OPENAI_API_KEY",
  anthropic  : "ANTHROPIC_API_KEY",
  google     : "GOOGLE_API_KEY",
  openrouter : "OPENROUTER_API_KEY",
  groq       : "GROQ_API_KEY",
  mistral    : "MISTRAL_API_KEY",
  cohere     : "COHERE_API_KEY",
  perplexity : "PERPLEXITY_API_KEY",
  together   : "TOGETHER_API_KEY",
  fireworks  : "FIREWORKS_API_KEY",
  replicate  : "REPLICATE_API_KEY",
  huggingface: "HUGGINGFACE_API_KEY",
  deepseek   : "DEEPSEEK_API_KEY",
  xai        : "XAI_API_KEY",
  github     : "GITHUB_TOKEN",
  vercel     : "VERCEL_TOKEN",
  stripe     : "STRIPE_SECRET_KEY",
  paypal     : "PAYPAL_CLIENT_SECRET",
};

// ── Module-level in-process cache (TTL 5 min) ────────────────────────────

const _cache = new Map<string, { value: string; expiresAt: number; source: VaultCredential["source"] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key: string): { value: string; source: VaultCredential["source"] } | undefined {
  const entry = _cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { _cache.delete(key); return undefined; }
  return { value: entry.value, source: entry.source };
}

function cacheSet(key: string, value: string, source: VaultCredential["source"]): void {
  _cache.set(key, { value, source, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Core retrieval ────────────────────────────────────────────────────────

/**
 * getCredential — retrieve a secret by name.
 * Resolution order: in-process cache → Platform Secret Authority → Javari Vault → env
 * Never throws. Returns empty string if not found anywhere.
 */
export async function getCredential(secretName: string): Promise<VaultCredential> {
  // Cache hit
  const cached = cacheGet(secretName);
  if (cached) {
    return {
      provider  : secretName,
      secretName,
      value     : cached.value,
      active    : cached.value.length > 4,
      source    : cached.source,
    };
  }

  // Platform Secret Authority (primary)
  try {
    const val = await getSecret(secretName);
    if (val && val.length > 4) {
      cacheSet(secretName, val, "secret_authority");
      return { provider: secretName, secretName, value: val, active: true, source: "secret_authority" };
    }
  } catch { /* fall through */ }

  // Javari Vault v3 (secondary)
  try {
    const javariVaultProvider = Object.entries(PROVIDER_SECRET_MAP)
      .find(([, s]) => s === secretName)?.[0];

    if (javariVaultProvider) {
      // vault.get() takes its own ProviderName — cast via import
      type VaultProviderName = Parameters<typeof vault.get>[0];
      const val = await vault.get(javariVaultProvider as VaultProviderName);
      if (val && val.length > 4) {
        cacheSet(secretName, val, "javari_vault");
        return { provider: secretName, secretName, value: val, active: true, source: "javari_vault" };
      }
    }
  } catch { /* fall through */ }

  // env fallback (bootstrap-only)
  const envVal = process.env[secretName];
  if (envVal && envVal.length > 4) {
    console.warn(`[vaultClient] ENV FALLBACK: "${secretName}" not in vault — using process.env`);
    cacheSet(secretName, envVal, "env_fallback");
    return { provider: secretName, secretName, value: envVal, active: true, source: "env_fallback" };
  }

  console.error(`[vaultClient] MISSING: "${secretName}" not found in vault or env`);
  return { provider: secretName, secretName, value: "", active: false, source: "env_fallback" };
}

/**
 * getProviderCredential — retrieve by provider name (e.g. "openai", "anthropic")
 */
export async function getProviderCredential(provider: VaultProvider): Promise<VaultCredential> {
  const secretName = PROVIDER_SECRET_MAP[provider] ?? provider.toUpperCase() + "_API_KEY";
  return getCredential(secretName);
}

/**
 * getProviderApiKey — convenience: returns the key string or "" if missing.
 * Marks provider as inactive in caller logic when empty.
 */
export async function getProviderApiKey(provider: VaultProvider | string): Promise<string> {
  const secretName = PROVIDER_SECRET_MAP[provider as VaultProvider]
    ?? provider.toUpperCase().replace(/-/g, "_") + "_API_KEY";
  const cred = await getCredential(secretName);
  return cred.value;
}

/**
 * getAllProviderKeys — fetch all AI provider keys at once (for orchestrator warm-up).
 * Returns a map of provider → key string. Inactive providers have empty strings.
 */
export async function getAllProviderKeys(
  providers?: VaultProvider[]
): Promise<Record<string, string>> {
  const targets = providers ?? (Object.keys(PROVIDER_SECRET_MAP) as VaultProvider[]);
  const results = await Promise.all(
    targets.map(async (p) => ({ p, key: await getProviderApiKey(p) }))
  );
  return Object.fromEntries(results.map(({ p, key }) => [p, key]));
}

/**
 * getVaultStatus — check all AI provider credentials and return a status report.
 * Useful for the operations dashboard and validation endpoints.
 */
export async function getVaultStatus(): Promise<VaultStatusReport> {
  const aiProviders: VaultProvider[] = [
    "openai", "anthropic", "google", "openrouter", "groq",
    "mistral", "cohere", "perplexity", "together", "fireworks", "replicate",
  ];

  const checks = await Promise.all(
    aiProviders.map(async (p) => {
      const cred = await getProviderCredential(p);
      return {
        provider  : p,
        secretName: cred.secretName,
        active    : cred.active,
        source    : cred.source,
      };
    })
  );

  const active  = checks.filter((c) => c.active).length;
  const missing = checks.filter((c) => !c.active).length;

  return {
    checkedAt: new Date().toISOString(),
    total    : checks.length,
    active,
    missing,
    providers: checks,
  };
}

/**
 * invalidateCredential — clear cache for a specific secret (call after rotation).
 */
export function invalidateCredential(secretName: string): void {
  _cache.delete(secretName);
}

/**
 * invalidateAll — clear entire vault cache.
 */
export function invalidateAll(): void {
  _cache.clear();
}

// ── API route helper ──────────────────────────────────────────────────────

export { PROVIDER_SECRET_MAP };
