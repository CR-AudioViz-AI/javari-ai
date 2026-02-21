// lib/canonical/r2-client.ts
// CR AudioViz AI — Canonical R2 Read-Only Client
// 2026-02-22 — R2 is sole source of truth; this module NEVER mutates R2.
//
// Uses S3-compatible REST API (Cloudflare R2 supports AWS S3 GET/HEAD/LIST).
// Auth: HMAC-SHA256 AWS Signature V4 — same pattern used by existing R2 integrations.
// Env vars required:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_CANONICAL_PREFIX (default: "roadmap/")

import crypto from "crypto";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("canonical:r2");

// ── Config ────────────────────────────────────────────────────────────────────

function getR2Config() {
  const accountId  = process.env.R2_ACCOUNT_ID        ?? "";
  const accessKey  = process.env.R2_ACCESS_KEY_ID     ?? "";
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket     = process.env.R2_BUCKET            ?? "craudiovizai-canonical";
  const prefix     = process.env.R2_CANONICAL_PREFIX  ?? "roadmap/";
  const endpoint   = process.env.R2_ENDPOINT
    ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  return { accountId, accessKey, secretKey, bucket, prefix, endpoint };
}

// ── AWS Signature V4 (HMAC-SHA256) ───────────────────────────────────────────
// Minimal implementation for GET + ListObjectsV2 only — no PUT/DELETE.

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function hash(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function formatDate(d: Date): string {
  return d.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
}

function formatDateShort(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function signedHeaders(
  method:  "GET",
  url:     string,
  body:    string,
  cfg:     ReturnType<typeof getR2Config>
): Record<string, string> {
  const now      = new Date();
  const dateTime = formatDate(now);
  const dateShort = formatDateShort(now);
  const region   = "auto";
  const service  = "s3";

  const parsed   = new URL(url);
  const host     = parsed.host;
  const path     = parsed.pathname;
  const query    = parsed.search.slice(1); // strip leading "?"

  const payloadHash = hash(body);

  // Canonical headers (must be sorted, lowercase)
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${dateTime}\n`;
  const signedHdrs = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHdrs,
    payloadHash,
  ].join("\n");

  const credScope     = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign  = `AWS4-HMAC-SHA256\n${dateTime}\n${credScope}\n${hash(canonicalRequest)}`;

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${cfg.secretKey}`, dateShort), region), service),
    "aws4_request"
  );
  const signature = hmac(signingKey, stringToSign).toString("hex");

  return {
    host,
    "x-amz-date":          dateTime,
    "x-amz-content-sha256": payloadHash,
    authorization: (
      `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credScope}, ` +
      `SignedHeaders=${signedHdrs}, Signature=${signature}`
    ),
  };
}

// ── R2 API helpers ────────────────────────────────────────────────────────────

async function r2Get(path: string, query = ""): Promise<Response> {
  const cfg = getR2Config();

  if (!cfg.accessKey || !cfg.secretKey || !cfg.endpoint) {
    throw new Error("R2 credentials not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }

  const url  = `${cfg.endpoint}/${cfg.bucket}/${path}${query ? "?" + query : ""}`;
  const hdrs = signedHeaders("GET", url, "", cfg);

  const res = await fetch(url, {
    method:  "GET",
    headers: hdrs,
    signal:  AbortSignal.timeout(15_000),
  });
  return res;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface R2DocMeta {
  key:          string;   // full R2 key, e.g. "roadmap/MASTER_ROADMAP.md"
  size:         number;   // bytes
  lastModified: string;   // ISO date string
}

/**
 * List all documents under R2_CANONICAL_PREFIX.
 * Implements ListObjectsV2 pagination — returns ALL keys (up to 10k).
 * READ-ONLY — never mutates R2.
 */
export async function listRoadmapDocs(): Promise<R2DocMeta[]> {
  const cfg    = getR2Config();
  const docs: R2DocMeta[] = [];
  let continuationToken: string | null = null;

  try {
    do {
      const qs = new URLSearchParams({
        "list-type": "2",
        prefix: cfg.prefix,
        "max-keys": "1000",
        ...(continuationToken ? { "continuation-token": continuationToken } : {}),
      }).toString();

      const res = await r2Get("", qs);

      if (res.status === 404) {
        log.warn(`R2 bucket not found or prefix ${cfg.prefix} empty — returning empty list`);
        return [];
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`R2 ListObjectsV2 failed: ${res.status} ${body.slice(0, 200)}`);
      }

      const xml = await res.text();

      // Parse XML response (minimal, no external dependency)
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
      const sizes = [...xml.matchAll(/<Size>(\d+)<\/Size>/g)].map((m) => parseInt(m[1]));
      const dates  = [...xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)].map((m) => m[1]);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        // Only markdown files
        if (!key.endsWith(".md") && !key.endsWith(".txt")) continue;
        docs.push({
          key,
          size:         sizes[i]  ?? 0,
          lastModified: dates[i]  ?? new Date().toISOString(),
        });
      }

      // Check for next page
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      if (truncated) {
        const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
        continuationToken = tokenMatch ? tokenMatch[1] : null;
      } else {
        continuationToken = null;
      }
    } while (continuationToken);

    log.info(`R2 list complete: ${docs.length} docs under prefix "${cfg.prefix}"`);
    return docs;

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown R2 error";
    log.error(`listRoadmapDocs failed: ${msg}`);
    throw e;
  }
}

/**
 * Fetch raw text content of a single R2 document by key.
 * READ-ONLY — returns content string.
 * Returns null if not found or unreachable (caller decides to skip/abort).
 */
export async function fetchDoc(key: string): Promise<string | null> {
  try {
    const res = await r2Get(encodeURIComponent(key).replace(/%2F/g, "/"));

    if (res.status === 404) {
      log.warn(`R2 doc not found: ${key}`);
      return null;
    }
    if (!res.ok) {
      log.error(`R2 fetchDoc failed for ${key}: ${res.status}`);
      return null;
    }

    const text = await res.text();
    log.info(`Fetched R2 doc: ${key} (${text.length} chars)`);
    return text;

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    log.error(`fetchDoc(${key}) threw: ${msg}`);
    return null;
  }
}

/**
 * Verify R2 connectivity by attempting a HEAD-equivalent (small GET).
 * Returns { ok, message }.
 */
export async function checkR2Connectivity(): Promise<{ ok: boolean; message: string }> {
  try {
    const docs = await listRoadmapDocs();
    return { ok: true, message: `R2 reachable — ${docs.length} docs found under prefix` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "R2 unreachable" };
  }
}
