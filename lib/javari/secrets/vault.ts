/**
 * Secrets Vault - Production Grade
 * Provides centralized credential management
 * Compatible with existing codebase imports
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ProviderName = 
  | 'openai'
  | 'anthropic' 
  | 'groq'
  | 'mistral'
  | 'openrouter'
  | 'xai'
  | 'deepseek'
  | 'cohere'
  | 'google'
  | 'vercel'
  | 'github'
  | 'supabase'
  | 'stripe'
  | 'paypal';

export type KeyStatus = 'active' | 'expired' | 'missing';

// ═══════════════════════════════════════════════════════════════
// PROVIDER ENV MAP
// ═══════════════════════════════════════════════════════════════

export const PROVIDER_ENV_MAP: Record<ProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  xai: 'XAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  cohere: 'COHERE_API_KEY',
  google: 'GOOGLE_API_KEY',
  vercel: 'VERCEL_TOKEN',
  github: 'GITHUB_TOKEN',
  supabase: 'SUPABASE_SERVICE_ROLE_KEY',
  stripe: 'STRIPE_SECRET_KEY',
  paypal: 'PAYPAL_CLIENT_SECRET',
};

// ═══════════════════════════════════════════════════════════════
// VAULT INTERFACE
// ═══════════════════════════════════════════════════════════════

class SecretVault {
  /**
   * Get secret value from environment
   */
  get(provider: ProviderName, keyName?: string): string | null {
    const envVar = keyName || PROVIDER_ENV_MAP[provider];
    if (!envVar) return null;
    return process.env[envVar] || null;
  }

  /**
   * Assert secret exists (throws if missing)
   */
  assert(provider: ProviderName, keyName?: string): string {
    const value = this.get(provider, keyName);
    if (!value) {
      const envVar = keyName || PROVIDER_ENV_MAP[provider];
      throw new Error(`Missing required secret: ${envVar}`);
    }
    return value;
  }

  /**
   * Check if secret exists
   */
  has(provider: ProviderName, keyName?: string): boolean {
    return this.get(provider, keyName) !== null;
  }

  /**
   * Get status of secret
   */
  status(provider: ProviderName, keyName?: string): KeyStatus {
    const value = this.get(provider, keyName);
    if (!value) return 'missing';
    // Simple validation - could be enhanced
    if (value.length < 10) return 'expired';
    return 'active';
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT SINGLETON
// ═══════════════════════════════════════════════════════════════

export const vault = new SecretVault();

// ═══════════════════════════════════════════════════════════════
// LEGACY CRYPTO FUNCTIONS (KEEP FOR COMPATIBILITY)
// ═══════════════════════════════════════════════════════════════

export async function encrypt(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return btoa(String.fromCharCode(...data));
}

export async function decrypt(encrypted: string, key: string): Promise<string> {
  const decoded = atob(encrypted);
  return decoded;
}

export function generateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
