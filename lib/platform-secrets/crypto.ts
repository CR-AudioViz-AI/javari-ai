// lib/platform-secrets/crypto.ts
// CR AudioViz AI — Platform Secret Authority: Crypto Layer
// 2026-02-21
//
// AES-256-GCM encryption / decryption for platform secrets.
//
// Master key derivation (PBKDF2-SHA256):
//   Input: NEXTAUTH_SECRET + ":" + SUPABASE_PROJECT_REF
//   These TWO bootstrap vars MUST remain in Vercel env forever.
//   Everything else migrates to platform_secrets.
//
// Wire format (base64 of JSON):
//   { v:1, salt:hex32, iv:hex12, tag:hex16, ct:hex }
//
// SERVER-SIDE ONLY. Never import from client components.

import crypto from "crypto";

const ALGORITHM  = "aes-256-gcm" as const;
const KDF_ITER   = 100_000;
const KEY_LEN    = 32;
const SALT_LEN   = 32;
const IV_LEN     = 12;
export const FORMAT_VER = 1;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function getBootstrapMaterial(): string {
  const a = process.env.NEXTAUTH_SECRET;
  const b = process.env.SUPABASE_PROJECT_REF;
  if (!a) throw new Error("[secret-authority] NEXTAUTH_SECRET missing — bootstrap var required");
  if (!b) throw new Error("[secret-authority] SUPABASE_PROJECT_REF missing — bootstrap var required");
  return `${a}:${b}`;
}

function deriveKey(material: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(material, salt, KDF_ITER, KEY_LEN, "sha256");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EncryptedEnvelope {
  v:    number;
  salt: string;
  iv:   string;
  tag:  string;
  ct:   string;
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

export function encrypt(plaintext: string): string {
  const material = getBootstrapMaterial();
  const salt     = crypto.randomBytes(SALT_LEN);
  const iv       = crypto.randomBytes(IV_LEN);
  const key      = deriveKey(material, salt);
  const cipher   = crypto.createCipheriv(ALGORITHM, key, iv);
  const ct       = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag      = cipher.getAuthTag();

  const envelope: EncryptedEnvelope = {
    v:    FORMAT_VER,
    salt: salt.toString("hex"),
    iv:   iv.toString("hex"),
    tag:  tag.toString("hex"),
    ct:   ct.toString("hex"),
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64");
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

export function decrypt(encryptedBase64: string): string {
  const material = getBootstrapMaterial();

  let env: EncryptedEnvelope;
  try {
    env = JSON.parse(Buffer.from(encryptedBase64, "base64").toString("utf8"));
  } catch {
    throw new Error("[secret-authority] Malformed encrypted envelope");
  }

  if (env.v !== FORMAT_VER) {
    throw new Error(`[secret-authority] Unknown envelope version: ${env.v}`);
  }

  const salt  = Buffer.from(env.salt, "hex");
  const iv    = Buffer.from(env.iv,   "hex");
  const tag   = Buffer.from(env.tag,  "hex");
  const ct    = Buffer.from(env.ct,   "hex");
  const key   = deriveKey(material, salt);
  const dciph = crypto.createDecipheriv(ALGORITHM, key, iv);
  dciph.setAuthTag(tag);

  try {
    return Buffer.concat([dciph.update(ct), dciph.final()]).toString("utf8");
  } catch {
    throw new Error("[secret-authority] Decryption failed — data tampered or wrong key");
  }
}

// ── Fingerprint ───────────────────────────────────────────────────────────────

/** sha256 of plaintext, first 12 hex chars — for change detection */
export function fingerprint(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex").slice(0, 12);
}

/** Mask a secret value for safe logging: sk-ant-api03... → sk-***(108) */
export function maskSecret(value: string): string {
  if (!value || value.length < 8) return "***";
  return `${value.slice(0, 6)}***(${value.length})`;
}
