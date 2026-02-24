// lib/canonical/r2-client.ts
// CR AudioViz AI — Canonical R2 Read-Only Client
// 2026-02-22 PART 2
//
// READ-ONLY. Never writes, never deletes. Safe by design.
//
// Env vars used (all optional with safe defaults):
//   R2_ENDPOINT           — full account endpoint, e.g. https://<id>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID      — R2 access key
//   R2_SECRET_ACCESS_KEY  — R2 secret key
//   R2_CANONICAL_BUCKET   — defaults to "craudiovizai-canonical" (separate from R2_BUCKET)
//   R2_CANONICAL_PREFIX   — defaults to "roadmap/"
//
// All methods throw with clear, secret-free messages on failure.

import crypto from "crypto";

// ─── Config ───────────────────────────────────────────────────────────────────

interface R2Config {
  endpoint:  string;
  accessKey: string;
  secretKey: string;
  bucket:    string;
  prefix:    string;
}

function getConfig(): R2Config {
  const endpoint  = process.env.R2_ENDPOINT            ?? "";
  const accessKey = process.env.R2_ACCESS_KEY_ID       ?? "";
  const secretKey = process.env.R2_SECRET_ACCESS_KEY   ?? "";
  const bucket    = process.env.R2_CANONICAL_BUCKET    ?? "craudiovizai-canonical";
  const prefix    = process.env.R2_CANONICAL_PREFIX    ?? "roadmap/";

  if (!endpoint)  throw new Error("[r2-client] R2_ENDPOINT is not set");
  if (!accessKey) throw new Error("[r2-client] R2_ACCESS_KEY_ID is not set");
  if (!secretKey) throw new Error("[r2-client] R2_SECRET_ACCESS_KEY is not set");

  return { endpoint, accessKey, secretKey, bucket, prefix };
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
  path:   string,          // e.g. "/my-bucket"
  query:  string,          // pre-sorted query string without "?"
  body:   string = "",
): Record<string, string> {
  const now         = new Date();
  const dateShort   = now.toISOString().slice(0, 10).replace(/-/g, "");             // YYYYMMDD
  const dateTime    = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z"; // YYYYMMDDTHHmmssZ

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
  path:     string,     // path component, e.g. "/bucket" or "/bucket/key"
  query:    string,     // sorted query string without "?"
  timeoutMs = 10_000,
): Promise<Response> {
  const url     = `${cfg.endpoint}${path}${query ? "?" + query : ""}`;
  const headers = buildSignedHeaders(cfg, path, query);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method:  "GET",
      headers,
      signal:  controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * listCanonicalKeys — returns all R2 keys under the configured prefix.
 *
 * Returns an empty array (never throws) if the bucket exists but has no
 * matching keys. Throws on auth failures or network errors.
 *
 * Only returns keys that start with the configured prefix — safe by design.
 */
export async function listCanonicalKeys(prefix?: string): Promise<string[]> {
  const cfg    = getConfig();
  const pfx    = prefix ?? cfg.prefix;
  const keys: string[] = [];
  let   continuationToken: string | undefined;

  do {
    const params = new URLSearchParams({
      "list-type": "2",
      "max-keys":  "1000",
      "prefix":    pfx,
    });
    if (continuationToken) {
      params.set("continuation-token", continuationToken);
    }

    // URLSearchParams sorts keys alphabetically, which is required by SigV4
    const query = params.toString();
    const path  = `/${cfg.bucket}`;

    const res = await r2Fetch(cfg, path, query);

    if (res.status === 404) {
      // Bucket doesn't exist or is empty — return empty list gracefully
      return [];
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `[r2-client] listCanonicalKeys failed: HTTP ${res.status} ` +
        `(bucket=${cfg.bucket}, prefix=${pfx}) — ${text.slice(0, 200)}`
      );
    }

    const xml = await res.text();

    // Parse XML — no external dependency
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    for (const m of keyMatches) {
      const key = m[1];
      // Enforce prefix guard — only yield keys within configured prefix
      if (key.startsWith(pfx)) {
        keys.push(key);
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

  return keys;
}

/**
 * fetchCanonicalText — fetches the raw UTF-8 text of a single R2 object.
 *
 * Validates that the key starts with the configured prefix before fetching.
 * Throws on fetch failure; never returns partial content.
 */
export async function fetchCanonicalText(key: string): Promise<string> {
  const cfg = getConfig();

  // Prefix guard — never fetch outside the canonical prefix
  if (!key.startsWith(cfg.prefix)) {
    throw new Error(
      `[r2-client] fetchCanonicalText: key "${key}" is outside allowed prefix "${cfg.prefix}"`
    );
  }

  // Encode key segments individually (preserve "/" separators)
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const path       = `/${cfg.bucket}/${encodedKey}`;

  const res = await r2Fetch(cfg, path, "");

  if (res.status === 404) {
    throw new Error(`[r2-client] fetchCanonicalText: object not found: ${key}`);
  }
  if (!res.ok) {
    throw new Error(
      `[r2-client] fetchCanonicalText failed: HTTP ${res.status} for key=${key}`
    );
  }

  return res.text();
}
