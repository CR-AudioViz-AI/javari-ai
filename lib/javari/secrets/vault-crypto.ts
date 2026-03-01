// lib/javari/secrets/vault-crypto.ts
// Vault v3 Hardened Encryption Engine
// AES-256-GCM with PBKDF2 key derivation
// Node.js runtime ONLY — DO NOT import in edge runtime
// Date: 2025-01-02

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const PBKDF2_ITERATIONS = 150000;

/**
 * Get master password from environment
 * NO FALLBACKS - fails hard if not configured
 */
function getMasterPassword(): string {
  const password = process.env.VAULT_MASTER_PASSWORD;
  if (!password) {
    throw new Error('[VaultCrypto] VAULT_MASTER_PASSWORD must be configured - no fallbacks allowed');
  }
  return password;
}

/**
 * Derive encryption key using PBKDF2 with 150k iterations
 */
function deriveKey(masterPassword: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterPassword,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns: salt:iv:authTag:encrypted (all hex-encoded)
 */
export function encryptValue(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(getMasterPassword(), salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex')
  ].join(':');
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Validates format and auth tag deterministically
 */
export function decryptValue(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('[VaultCrypto] Invalid ciphertext format - expected 4 parts');
  }

  const [saltHex, ivHex, authTagHex, encryptedHex] = parts;

  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const key = deriveKey(getMasterPassword(), salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate SHA-256 fingerprint of value
 */
export function fingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
