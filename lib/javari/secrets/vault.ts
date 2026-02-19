// lib/javari/secrets/vault.ts
// Javari OS Unified Credential Vault
// AES-256-GCM encryption, server-side only
// Never expose raw keys — always use vault.get() / vault.assert()

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ProviderName =
  | "openai" | "anthropic" | "mistral" | "groq" | "elevenlabs"
  | "perplexity" | "gemini" | "xai" | "openrouter" | "deepseek"
  | "cohere" | "fireworks" | "together" | "replicate" | "huggingface"
  | "supabase_url" | "supabase_anon" | "supabase_service"
  | "github" | "vercel" | "stripe" | "paypal"
  | "encryption_key" | "jwt_secret" | "cron_secret";

export type KeyStatus = "valid" | "missing" | "invalid" | "expired" | "no_credits" | "unchecked";

export interface VaultEntry {
  provider: ProviderName;
  envVar: string;
  aliases: string[];          // all env var names this value is known by
  status: KeyStatus;
  lastChecked?: string;       // ISO timestamp
  note?: string;
}

// ── Provider → Env Var Map ────────────────────────────────────────────────────
// This is the canonical truth: what env var name each provider actually uses
const PROVIDER_MAP: Record<ProviderName, { primary: string; aliases: string[] }> = {
  openai:          { primary: "OPENAI_API_KEY",                  aliases: ["OPENAI_KEY"] },
  anthropic:       { primary: "ANTHROPIC_API_KEY",               aliases: ["ANTHROPIC_KEY"] },
  mistral:         { primary: "MISTRAL_API_KEY",                  aliases: [] },
  groq:            { primary: "GROQ_API_KEY",                     aliases: [] },
  elevenlabs:      { primary: "ELEVENLABS_API_KEY",               aliases: ["ELEVEN_LABS_API_KEY"] },
  perplexity:      { primary: "PERPLEXITY_API_KEY",               aliases: [] },
  gemini:          { primary: "GEMINI_API_KEY",                   aliases: ["GOOGLE_AI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"] },
  xai:             { primary: "XAI_API_KEY",                      aliases: [] },
  openrouter:      { primary: "OPENROUTER_API_KEY",               aliases: [] },
  deepseek:        { primary: "DEEPSEEK_API_KEY",                 aliases: [] },
  cohere:          { primary: "COHERE_API_KEY",                   aliases: [] },
  fireworks:       { primary: "FIREWORKS_API_KEY",                aliases: [] },
  together:        { primary: "TOGETHER_API_KEY",                 aliases: [] },
  replicate:       { primary: "REPLICATE_API_KEY",                aliases: ["REPLICATE_API_TOKEN"] },
  huggingface:     { primary: "HUGGINGFACE_API_KEY",              aliases: [] },
  supabase_url:    { primary: "NEXT_PUBLIC_SUPABASE_URL",         aliases: ["SUPABASE_URL", "VITE_SUPABASE_URL"] },
  supabase_anon:   { primary: "NEXT_PUBLIC_SUPABASE_ANON_KEY",   aliases: ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"] },
  supabase_service:{ primary: "SUPABASE_SERVICE_ROLE_KEY",        aliases: [] },
  github:          { primary: "GITHUB_TOKEN",                     aliases: ["GITHUB_WRITE_TOKEN", "GITHUB_READ_TOKEN", "GH_PAT"] },
  vercel:          { primary: "VERCEL_TOKEN",                     aliases: ["VERCEL_API_TOKEN"] },
  stripe:          { primary: "STRIPE_SECRET_KEY",                aliases: [] },
  paypal:          { primary: "PAYPAL_CLIENT_SECRET",             aliases: [] },
  encryption_key:  { primary: "CREDENTIAL_ENCRYPTION_KEY",        aliases: [] },
  jwt_secret:      { primary: "JWT_SECRET",                       aliases: ["NEXTAUTH_SECRET"] },
  cron_secret:     { primary: "CRON_SECRET",                      aliases: [] },
};

// ── AES-256-GCM Encryption ────────────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY || "";
  if (!raw) throw new Error("[Vault] CREDENTIAL_ENCRYPTION_KEY not set");
  // Derive 32-byte key from the stored hex/string
  const hex = raw.replace(/[^a-fA-F0-9]/g, "");
  if (hex.length >= 64) return Buffer.from(hex.slice(0, 64), "hex");
  // Pad if shorter
  const padded = raw.padEnd(32, "0").slice(0, 32);
  return Buffer.from(padded, "utf-8");
}

export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const key = getMasterKey();
  const [ivHex, authTagHex, encHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encHex) throw new Error("[Vault] Invalid ciphertext format");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(enc).toString("utf-8") + decipher.final("utf-8");
}

// ── Core Vault Functions ──────────────────────────────────────────────────────

/**
 * Get a credential value by provider name.
 * Checks primary env var first, then all aliases.
 * Returns null if not found (never throws).
 */
export function vaultGet(provider: ProviderName): string | null {
  const map = PROVIDER_MAP[provider];
  if (!map) return null;

  // Check primary first
  const primary = process.env[map.primary];
  if (primary) return primary;

  // Check aliases in order
  for (const alias of map.aliases) {
    const val = process.env[alias];
    if (val) return val;
  }

  return null;
}

/**
 * Assert a credential exists or throw a detailed error.
 * Use in critical paths where missing key should fail loudly.
 */
export function vaultAssert(provider: ProviderName): string {
  const val = vaultGet(provider);
  if (!val) {
    const map = PROVIDER_MAP[provider];
    const checked = [map?.primary, ...(map?.aliases || [])].filter(Boolean).join(", ");
    throw new Error(
      `[Vault] Required credential missing: ${provider}. Checked: ${checked}`
    );
  }
  return val;
}

/**
 * Check if a credential is present (without asserting).
 */
export function vaultHas(provider: ProviderName): boolean {
  return vaultGet(provider) !== null;
}

/**
 * Get multiple credentials at once. Returns partial record (only found keys).
 */
export function vaultGetMany(providers: ProviderName[]): Partial<Record<ProviderName, string>> {
  const result: Partial<Record<ProviderName, string>> = {};
  for (const p of providers) {
    const val = vaultGet(p);
    if (val) result[p] = val;
  }
  return result;
}

/**
 * Get the status of all providers (for diagnostics — no key values returned).
 */
export function vaultStatus(): Record<string, { present: boolean; envVar: string; aliases: string[] }> {
  const result: Record<string, { present: boolean; envVar: string; aliases: string[] }> = {};
  for (const [provider, map] of Object.entries(PROVIDER_MAP)) {
    result[provider] = {
      present: vaultHas(provider as ProviderName),
      envVar: map.primary,
      aliases: map.aliases,
    };
  }
  return result;
}

// ── Convenience shorthands ────────────────────────────────────────────────────
export const vault = {
  get: vaultGet,
  assert: vaultAssert,
  has: vaultHas,
  getMany: vaultGetMany,
  status: vaultStatus,
  encrypt,
  decrypt,
  PROVIDER_MAP,
} as const;

export default vault;
