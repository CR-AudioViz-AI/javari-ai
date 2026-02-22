// lib/canonical/r2-client.ts
// CR AudioViz AI — Canonical R2 Read-Only Client
// 2026-02-22 REWRITE — Fixes SigV4 SignatureDoesNotMatch by using @aws-sdk/client-s3.
// Cloudflare R2 is S3-compatible; aws-sdk v3 supports it via endpoint override.
//
// READ-ONLY — no writes, no mutations, no deletes. Ever.
//
// Env vars (all already exist in Vercel):
//   R2_ACCESS_KEY_ID     — R2 access key
//   R2_SECRET_ACCESS_KEY — R2 secret key
//   R2_ACCOUNT_ID        — Cloudflare account ID (used to build endpoint)
//   R2_BUCKET            — bucket name (default: "crav-assets-prod")
//   R2_CANONICAL_PREFIX  — prefix to list under (default: "roadmap/")
//   R2_ENDPOINT          — optional override (e.g. https://xxx.r2.cloudflarestorage.com)

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface R2DocMeta {
  key:          string;   // full R2 key, e.g. "roadmap/MASTER_ROADMAP.md"
  size:         number;   // bytes
  lastModified: string;   // ISO date string
}

// ── R2 client factory ─────────────────────────────────────────────────────────

function buildS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID        ?? "";
  const accessKey = process.env.R2_ACCESS_KEY_ID     ?? "";
  const secretKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const endpoint  = process.env.R2_ENDPOINT
    ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accessKey || !secretKey) {
    throw new Error(
      "R2 credentials not configured. " +
      "Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in Vercel env vars."
    );
  }
  if (!endpoint) {
    throw new Error(
      "R2 endpoint not configured. " +
      "Set R2_ACCOUNT_ID or R2_ENDPOINT in Vercel env vars."
    );
  }

  return new S3Client({
    region:   "auto",               // Cloudflare R2 requires "auto"
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    // Force path-style for R2 compatibility
    forcePathStyle: true,
  });
}

function getR2Config() {
  return {
    bucket: process.env.R2_BUCKET           ?? "crav-assets-prod",
    prefix: process.env.R2_CANONICAL_PREFIX ?? "roadmap/",
  };
}

function clog(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  const ts  = new Date().toISOString();
  const tag = `[${level.toUpperCase()}][canonical:r2]`;
  if (extra !== undefined) {
    console[level](`${ts} ${tag} ${msg}`, extra);
  } else {
    console[level](`${ts} ${tag} ${msg}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * listRoadmapDocs — list all docs under R2_CANONICAL_PREFIX.
 * Handles S3 pagination automatically.
 * Returns empty array (not throw) if prefix is empty.
 * Throws on auth failure or network error.
 */
export async function listRoadmapDocs(): Promise<R2DocMeta[]> {
  const s3  = buildS3Client();
  const cfg = getR2Config();
  const docs: R2DocMeta[] = [];
  let continuationToken: string | undefined;

  clog("info", `Listing R2 docs: bucket=${cfg.bucket} prefix=${cfg.prefix}`);

  do {
    const cmd = new ListObjectsV2Command({
      Bucket:            cfg.bucket,
      Prefix:            cfg.prefix,
      MaxKeys:           1000,
      ContinuationToken: continuationToken,
    });

    let output: ListObjectsV2CommandOutput;
    try {
      output = await s3.send(cmd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      clog("error", `ListObjectsV2 failed: ${msg}`);
      throw new Error(`R2 ListObjectsV2 failed: ${msg}`);
    }

    for (const obj of output.Contents ?? []) {
      if (!obj.Key) continue;
      // Only markdown files
      if (!obj.Key.endsWith(".md") && !obj.Key.endsWith(".txt")) continue;
      docs.push({
        key:          obj.Key,
        size:         obj.Size         ?? 0,
        lastModified: obj.LastModified?.toISOString() ?? new Date().toISOString(),
      });
    }

    continuationToken = output.IsTruncated ? output.NextContinuationToken : undefined;
  } while (continuationToken);

  clog("info", `Listed ${docs.length} docs under prefix "${cfg.prefix}"`);
  return docs;
}

/**
 * fetchDoc — fetch raw text of a single R2 document by key.
 * Returns null if not found or on fetch error (caller decides to skip).
 * READ-ONLY — never writes or deletes.
 */
export async function fetchDoc(key: string): Promise<string | null> {
  const s3  = buildS3Client();
  const cfg = getR2Config();

  clog("info", `Fetching R2 doc: ${key}`);

  try {
    const cmd = new GetObjectCommand({ Bucket: cfg.bucket, Key: key });
    const res = await s3.send(cmd);

    if (!res.Body) {
      clog("warn", `Empty body for R2 key: ${key}`);
      return null;
    }

    // Body is a ReadableStream in Node.js — collect it
    const bytes = await res.Body.transformToByteArray();
    const text  = new TextDecoder("utf-8").decode(bytes);
    clog("info", `Fetched ${key}: ${text.length} chars`);
    return text;

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("NoSuchKey") || msg.includes("404")) {
      clog("warn", `R2 key not found: ${key}`);
    } else {
      clog("error", `fetchDoc(${key}) failed: ${msg}`);
    }
    return null;
  }
}

/**
 * checkR2Connectivity — probe R2 by attempting a real list.
 * Returns { ok, message } — never throws.
 */
export async function checkR2Connectivity(): Promise<{ ok: boolean; message: string }> {
  try {
    const docs = await listRoadmapDocs();
    return {
      ok:      true,
      message: `R2 reachable — ${docs.length} docs found under prefix`,
    };
  } catch (e) {
    return {
      ok:      false,
      message: e instanceof Error ? e.message : "R2 unreachable",
    };
  }
}
