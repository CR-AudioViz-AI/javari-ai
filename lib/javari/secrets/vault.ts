// lib/javari/secrets/vault.ts
// Javari OS Unified Credential Vault — EDGE-SAFE
// Reads credentials from process.env with alias resolution.
// Works in both Edge and Node.js runtimes.
// AES-256 encrypt/decrypt is in vault-crypto.ts (Node/server-only).

// ── Provider name → env var mapping ──────────────────────────────────────────
export type ProviderName =
  | "openai" | "anthropic" | "mistral" | "groq" | "elevenlabs"
  | "perplexity" | "gemini" | "xai" | "openrouter" | "deepseek"
  | "cohere" | "fireworks" | "together" | "replicate" | "huggingface"
  | "supabase_url" | "supabase_anon" | "supabase_service"
  | "github" | "vercel" | "stripe" | "paypal"
  | "encryption_key" | "jwt_secret" | "cron_secret";

export type KeyStatus =
  | "valid" | "missing" | "invalid" | "expired" | "no_credits" | "unchecked";

// Canonical mapping: provider name → primary env var + all known aliases
// When primary is missing, aliases are checked in order.
const PROVIDER_MAP: Record<ProviderName, { primary: string; aliases: string[] }> = {
  openai:          { primary: "OPENAI_API_KEY",               aliases: ["OPENAI_KEY"] },
  anthropic:       { primary: "ANTHROPIC_API_KEY",            aliases: [] },
  mistral:         { primary: "MISTRAL_API_KEY",              aliases: [] },
  groq:            { primary: "GROQ_API_KEY",                 aliases: [] },
  elevenlabs:      { primary: "ELEVENLABS_API_KEY",           aliases: ["ELEVEN_LABS_API_KEY"] },
  perplexity:      { primary: "PERPLEXITY_API_KEY",           aliases: [] },
  gemini:          { primary: "GEMINI_API_KEY",               aliases: ["GOOGLE_AI_API_KEY","GOOGLE_GENERATIVE_AI_API_KEY"] },
  xai:             { primary: "XAI_API_KEY",                  aliases: [] },
  openrouter:      { primary: "OPENROUTER_API_KEY",           aliases: [] },
  deepseek:        { primary: "DEEPSEEK_API_KEY",             aliases: [] },
  cohere:          { primary: "COHERE_API_KEY",               aliases: [] },
  fireworks:       { primary: "FIREWORKS_API_KEY",            aliases: [] },
  together:        { primary: "TOGETHER_API_KEY",             aliases: [] },
  replicate:       { primary: "REPLICATE_API_KEY",            aliases: ["REPLICATE_API_TOKEN"] },
  huggingface:     { primary: "HUGGINGFACE_API_KEY",          aliases: [] },
  supabase_url:    { primary: "NEXT_PUBLIC_SUPABASE_URL",     aliases: ["SUPABASE_URL","VITE_SUPABASE_URL"] },
  supabase_anon:   { primary: "NEXT_PUBLIC_SUPABASE_ANON_KEY",aliases: ["SUPABASE_ANON_KEY","VITE_SUPABASE_ANON_KEY"] },
  supabase_service:{ primary: "SUPABASE_SERVICE_ROLE_KEY",    aliases: [] },
  github:          { primary: "GITHUB_TOKEN",                 aliases: ["GH_PAT","GITHUB_WRITE_TOKEN","GITHUB_READ_TOKEN"] },
  vercel:          { primary: "VERCEL_TOKEN",                 aliases: ["VERCEL_API_TOKEN"] },
  stripe:          { primary: "STRIPE_SECRET_KEY",            aliases: [] },
  paypal:          { primary: "PAYPAL_CLIENT_SECRET",         aliases: [] },
  encryption_key:  { primary: "CREDENTIAL_ENCRYPTION_KEY",   aliases: [] },
  jwt_secret:      { primary: "JWT_SECRET",                   aliases: ["NEXTAUTH_SECRET"] },
  cron_secret:     { primary: "CRON_SECRET",                  aliases: [] },
};

/**
 * Get a credential by provider name.
 * Checks primary env var first, then aliases. Returns null if not found.
 * Edge-safe: only reads process.env.
 */
export function vaultGet(provider: ProviderName): string | null {
  const map = PROVIDER_MAP[provider];
  if (!map) return null;
  const primary = process.env[map.primary];
  if (primary) return primary;
  for (const alias of map.aliases) {
    const val = process.env[alias];
    if (val) return val;
  }
  return null;
}

/**
 * Assert a credential exists. Throws a detailed error if missing.
 * Use in critical paths that must fail loudly.
 */
export function vaultAssert(provider: ProviderName): string {
  const val = vaultGet(provider);
  if (!val) {
    const map = PROVIDER_MAP[provider];
    const checked = [map?.primary, ...(map?.aliases ?? [])].filter(Boolean).join(", ");
    throw new Error(`[Vault] Missing required credential: ${provider}. Checked env vars: ${checked}`);
  }
  return val;
}

/** Check if a credential is present (no throw). */
export function vaultHas(provider: ProviderName): boolean {
  return vaultGet(provider) !== null;
}

/** Get multiple credentials at once. Only includes found keys. */
export function vaultGetMany(
  providers: ProviderName[]
): Partial<Record<ProviderName, string>> {
  const result: Partial<Record<ProviderName, string>> = {};
  for (const p of providers) {
    const v = vaultGet(p);
    if (v) result[p] = v;
  }
  return result;
}

/**
 * Get presence status for all providers (no key values).
 * Safe to return to clients — never includes actual key strings.
 */
export function vaultStatus(): Record<
  string,
  { present: boolean; envVar: string; aliases: string[] }
> {
  const out: Record<string, { present: boolean; envVar: string; aliases: string[] }> = {};
  for (const [name, map] of Object.entries(PROVIDER_MAP)) {
    out[name] = {
      present: vaultHas(name as ProviderName),
      envVar: map.primary,
      aliases: map.aliases,
    };
  }
  return out;
}

export const vault = {
  get: vaultGet,
  assert: vaultAssert,
  has: vaultHas,
  getMany: vaultGetMany,
  status: vaultStatus,
  PROVIDER_MAP,
} as const;

export default vault;
