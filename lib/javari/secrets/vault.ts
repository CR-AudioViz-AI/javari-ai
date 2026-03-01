// lib/javari/secrets/vault.ts
// Vault v3 Hardened Secret Authority
// Provides centralized credential management with encrypted storage
// Date: 2025-01-02

import { createClient } from '@supabase/supabase-js';
import { encryptValue, decryptValue, fingerprint } from './vault-crypto';

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
// SUPABASE CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('[SecretVault] Supabase service role not configured - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  return createClient(url, key);
}

// ═══════════════════════════════════════════════════════════════
// SECRET VAULT CLASS
// ═══════════════════════════════════════════════════════════════

class SecretVault {
  private cache = new Map<string, { value: string; timestamp: number }>();
  private cacheTTL = 300000; // 5 minutes

  /**
   * Get secret value - checks database first, falls back to env
   * ALWAYS decrypts - NO plaintext storage
   */
  async get(provider: ProviderName, keyName?: string): Promise<string | null> {
    const secretName = keyName || PROVIDER_ENV_MAP[provider];
    
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    try {
      const supabase = getSupabase();

      // Fetch ONLY encrypted_value - NO plaintext column access
      const { data, error } = await supabase
        .from('platform_secrets_v2')
        .select('encrypted_value')
        .eq('name', secretName)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        // Fall back to environment variable
        return process.env[secretName] || null;
      }

      // Decrypt using vault-crypto
      const value = decryptValue(data.encrypted_value);

      // Cache decrypted value
      this.cache.set(secretName, { value, timestamp: Date.now() });

      // Increment access counter using RPC
      await supabase.rpc('increment_secret_access', { secret_name: secretName });

      return value;
    } catch (error) {
      console.error(`[SecretVault] Error fetching secret ${secretName}:`, error);
      // Fall back to environment variable
      return process.env[secretName] || null;
    }
  }

  /**
   * Set secret value in database
   * ALWAYS encrypts - NO plaintext storage
   */
  async set(
    provider: ProviderName,
    value: string,
    category: string = 'api_key',
    notes?: string,
    keyName?: string
  ): Promise<void> {
    const secretName = keyName || PROVIDER_ENV_MAP[provider];
    const supabase = getSupabase();

    // Encrypt value using vault-crypto
    const encryptedValue = encryptValue(value);
    const fp = fingerprint(value);

    const { error } = await supabase.from('platform_secrets_v2').upsert({
      name: secretName,
      category,
      notes,
      encrypted_value: encryptedValue,
      fingerprint: fp,
      is_active: true,
      updated_at: new Date().toISOString(),
      updated_by: 'JAVARI_AI'
    });

    if (error) {
      throw new Error(`[SecretVault] Failed to set secret ${secretName}: ${error.message}`);
    }

    // Invalidate cache
    this.cache.delete(secretName);

    // Audit log
    await supabase.from('vault_audit_log').insert({
      secret_name: secretName,
      actor: 'JAVARI_AI',
      action: 'SET',
      fingerprint_after: fp,
      outcome: 'SUCCESS'
    });
  }

  /**
   * Assert secret exists (throws if missing)
   */
  async assert(provider: ProviderName, keyName?: string): Promise<string> {
    const value = await this.get(provider, keyName);
    if (!value) {
      const envVar = keyName || PROVIDER_ENV_MAP[provider];
      throw new Error(`[SecretVault] Missing required secret: ${envVar}`);
    }
    return value;
  }

  /**
   * Check if secret exists
   */
  async has(provider: ProviderName, keyName?: string): Promise<boolean> {
    const value = await this.get(provider, keyName);
    return value !== null;
  }

  /**
   * Get status of secret
   */
  async status(provider: ProviderName, keyName?: string): Promise<KeyStatus> {
    const value = await this.get(provider, keyName);
    if (!value) return 'missing';
    if (value.length < 10) return 'expired';
    return 'active';
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT SINGLETON
// ═══════════════════════════════════════════════════════════════

export const vault = new SecretVault();
