// lib/javari/secrets/vault-crypto.ts
// AES-256-GCM encryption utilities — Node.js runtime ONLY
// DO NOT import in edge runtime routes (will fail to compile).
// Use only in: API routes with runtime = "nodejs", server actions, scripts.

// This is a server-only file — importing in edge runtime throws at build time.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES   = 16;

function getMasterKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY ?? "";
  if (!raw) throw new Error("[VaultCrypto] CREDENTIAL_ENCRYPTION_KEY not set");
  const hex = raw.replace(/[^a-fA-F0-9]/g, "");
  if (hex.length >= 64) return Buffer.from(hex.slice(0, 64), "hex");
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf-8");
}

/**
 * Encrypt a plaintext string.
 * Returns: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptValue(plaintext: string): string {
  const key = getMasterKey();
  const iv  = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc  = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/**
 * Decrypt a value produced by encryptValue().
 */
export function decryptValue(ciphertext: string): string {
  const [ivH, tagH, encH] = ciphertext.split(":");
  if (!ivH || !tagH || !encH) throw new Error("[VaultCrypto] Invalid ciphertext format");
  const key = getMasterKey();
  const iv  = Buffer.from(ivH,  "hex");
  const tag = Buffer.from(tagH, "hex");
  const enc = Buffer.from(encH, "hex");
  const dec = createDecipheriv(ALGORITHM, key, iv);
  dec.setAuthTag(tag);
  return dec.update(enc).toString("utf-8") + dec.final("utf-8");
}
