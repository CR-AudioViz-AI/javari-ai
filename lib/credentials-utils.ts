/**
 * Credential Encryption and Decryption Utilities
 * Shared utilities for secure credential management
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/utils/error-utils';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Encrypt a credential value using AES-256-GCM
 */
export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

/**
 * Decrypt a credential value
 */
export function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask a credential value for display
 */
export function maskValue(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return '•'.repeat(value.length);
  return value.substring(0, visibleChars) + '•'.repeat(Math.min(20, value.length - visibleChars));
}

/**
 * Get decrypted credential value (requires authentication)
 */
export async function getDecryptedValue(credentialId: string, userId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('credentials')
      .select('value_encrypted, iv, auth_tag')
      .eq('id', credentialId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Decrypt the value
    const decrypted = decrypt(data.value_encrypted, data.iv, data.auth_tag);
    
    // Update last_used_at
    await supabase
      .from('credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credentialId);

    return decrypted;
  } catch (error: unknown) {
    logError('Decryption error:', error);
    return null;
  }
}
