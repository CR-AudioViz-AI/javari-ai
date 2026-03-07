// lib/canonical/r2-client.ts
// CR AudioViz AI — Canonical R2 Read-Only Client
// 2026-02-22 PART 2 — Updated 2026-03-07: credentials loaded from Platform Secret Authority vault
//
// READ-ONLY. Never writes, never deletes. Safe by design.
//
// Vault keys (Platform Secret Authority, Supabase-backed AES-256-GCM):
//   R2_ENDPOINT          — full account endpoint, e.g. https://<id>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID     — R2 access key
//   R2_SECRET_ACCESS_KEY — R2 secret key
//   R2_BUCKET            — bucket name, defaults to "cold-storage"
//   R2_CANONICAL_PREFIX  — object prefix, defaults to "consolidation-docs/"
//
// getSecret() lookup order: vault (Supabase AES-256-GCM) → process.env fallback
// All methods throw with clear, secret-free messages on failure.

import crypto from "crypto";
import { getSecret } from "@/lib/platform-secrets";

// ─── Config ───────────────────────────────────────────────────────────────────

interface R2Config {
  endpoint:  string;
  accessKey: string;
  secretKey: string;
  bucket:    string;
  prefix:    string;
}

/**
 * getConfig — async credential loader.
 * Reads from Platform Secret Authority vault first; falls back to process.env.
 * Vault keys: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_CANONICAL_PREFIX
 */
async function getConfig(): Promise<R2Config> {
  const [endpoint, accessKey, secretKey, bucket, prefix] = await Promise.all([
    getSecret("R2_ENDPOINT"),
    getSecret("R2_ACCESS_KEY_ID"),
    getSecret("R2_SECRET_ACCESS_KEY"),
    getSecret("R2_BUCKET"),
    getSecret("R2_CANONICAL_PREFIX"),
  ]);

  // Apply defaults for optional config keys
  const resolvedBucket = bucket  || "cold-storage";
  const resolvedPrefix = prefix  || "consolidation-docs/";

  if (!endpoint)  throw new Error("[r2-client] R2_ENDPOINT not found in vault or env");
  if (!accessKey) throw new Error("[r2-client] R2_ACCESS_KEY_ID not found in vault or env");
  if (!secretKey) throw new Error("[r2-client] R2_SECRET_ACCESS_KEY not found in vault or env");

  return {
    endpoint : endpoint.trim(),
    accessKey: accessKey.trim(),
    secretKey: secretKey.trim(),
    bucket   : resolvedBucket.trim(),
    prefix   : resolvedPrefix.trim(),
  };
}

// ─── AWS SigV4 (GET only) ─────────────────────────────────────────────────────
// Path-style addressing: https://{endpoint}/{bucket}?query
// Confirmed working pattern against Cloudflare R2.

function hmacSha256(key: Buffer | string, data: string): Buffer {
  const k = typeof key === "string" ? Buffer.from(key, "utf8") : key;
  return crypto.createHmac("sha256", k).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function buildSignedHeaders(
  cfg:    R2Config,
  path:   string,
  query:  string,
  body:   string = "",
): Record<string, string> {
  const now       = new Date();
  const dateShort = now.toISOString().slice(0, 10).replace(/-/g, "");
  const dateTime  = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";

  const host        = new URL(cfg.endpoint).host;
  const region      = "auto";
  const service     = "s3";
  const payloadHash = sha256Hex(body);

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateTime}\n`;
  const signedHeaders    = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "GET",
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign    = [
    "AWS4-HMAC-SHA256",
    dateTime,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmacSha256(
    hmacSha256(
      hmacSha256(
        hmacSha256(`AWS4${cfg.secretKey}`, dateShort),
        region,
      ),
      service,
    ),
    "aws4_request",
  );
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  return {
    host,
    "x-amz-date":           dateTime,
    "x-amz-content-sha256": payloadHash,
    authorization: (
      `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`
    ),
  };
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function r2Fetch(
  cfg:      R2Config,
  path:     string,
  query:    string,
  timeoutMs = 15_000,
): Promise<Response> {
  const url     = `${cfg.endpoint}${path}${query ? "?" + query : ""}`;
  const headers = buildSignedHeaders(cfg, path, query);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { method: "GET", headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface R2Object {
  key         : string;
  lastModified: string;
  size        : number;
}

/**
 * listCanonicalKeys — returns all R2 keys under the given prefix (or the
 * vault-configured default prefix).
 *
 * Credentials loaded from Platform Secret Authority vault.
 * Returns empty array if bucket has no matching keys.
 * Throws on auth failures or network errors.
 */
export async function listCanonicalKeys(prefix?: string): Promise<R2Object[]> {
  const cfg    = await getConfig();
  const pfx    = prefix !== undefined ? prefix : cfg.prefix;
  const objects: R2Object[] = [];
  let   continuationToken: string | undefined;

  do {
    const params = new URLSearchParams({
      "list-type": "2",
      "max-keys":  "1000",
      "prefix":    pfx,
    });
    if (continuationToken) params.set("continuation-token", continuationToken);

    const query = params.toString();
    const path  = `/${cfg.bucket}`;

    const res = await r2Fetch(cfg, path, query);

    if (res.status === 404) return [];
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `[r2-client] listCanonicalKeys failed: HTTP ${res.status} ` +
        `(bucket=${cfg.bucket}, prefix=${pfx}) — ${text.slice(0, 200)}`
      );
    }

    const xml = await res.text();

    const contentsMatches = xml.matchAll(/<Contents>(.*?)<\/Contents>/gs);
    for (const match of contentsMatches) {
      const block             = match[1];
      const keyMatch          = block.match(/<Key>([^<]+)<\/Key>/);
      const lastModifiedMatch = block.match(/<LastModified>([^<]+)<\/LastModified>/);
      const sizeMatch         = block.match(/<Size>([^<]+)<\/Size>/);

      if (keyMatch) {
        const key = keyMatch[1];
        // Only return keys within the requested prefix (or no-filter when prefix="")
        if (!pfx || key.startsWith(pfx)) {
          objects.push({
            key,
            lastModified: lastModifiedMatch?.[1] || new Date().toISOString(),
            size        : parseInt(sizeMatch?.[1] || "0", 10),
          });
        }
      }
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    if (truncated) {
      const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      continuationToken = tokenMatch?.[1];
    } else {
      continuationToken = undefined;
    }
  } while (continuationToken);

  return objects;
}

/**
 * fetchCanonicalText — fetches the raw UTF-8 text of a single R2 object.
 * Credentials loaded from Platform Secret Authority vault.
 */
export async function fetchCanonicalText(key: string): Promise<string> {
  const cfg = await getConfig();

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const path       = `/${cfg.bucket}/${encodedKey}`;

  const res = await r2Fetch(cfg, path, "");

  if (res.status === 404) throw new Error(`[r2-client] object not found: ${key}`);
  if (!res.ok) throw new Error(`[r2-client] fetchCanonicalText failed: HTTP ${res.status} for key=${key}`);

  return res.text();
}

// ── Compatibility exports ──────────────────────────────────────────────────────
export { listCanonicalKeys as listRoadmapDocs };
export { fetchCanonicalText as fetchDoc };

/**
 * checkR2Connectivity — verifies vault credentials + R2 connection.
 * Returns { ok, message, bucket, prefix } for diagnostics.
 */
export async function checkR2Connectivity(): Promise<{
  ok      : boolean;
  message : string;
  bucket? : string;
  prefix? : string;
}> {
  try {
    const cfg = await getConfig();
    // Attempt a minimal list with empty prefix to confirm auth works
    const objects = await listCanonicalKeys(cfg.prefix);
    return {
      ok     : true,
      message: `R2 connection verified. ${objects.length} objects under prefix "${cfg.prefix}".`,
      bucket : cfg.bucket,
      prefix : cfg.prefix,
    };
  } catch (error) {
    return {
      ok     : false,
      message: error instanceof Error ? error.message : "R2 connection failed",
    };
  }
}
