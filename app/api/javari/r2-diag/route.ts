// app/api/javari/r2-diag/route.ts
// Purpose: One-time diagnostic — shows resolved R2 credentials and attempts list.
//          DELETE after R2 ingestion is confirmed working.
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { getSecret } from "@/lib/platform-secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Load all four R2 keys from vault
    const [endpoint, accessKeyId, secretAccessKey, bucket, prefix] = await Promise.all([
      getSecret("R2_ENDPOINT"),
      getSecret("R2_ACCESS_KEY_ID"),
      getSecret("R2_SECRET_ACCESS_KEY"),
      getSecret("R2_BUCKET"),
      getSecret("R2_CANONICAL_PREFIX"),
    ]);

    // Also try alternate key names in case vault uses different names
    const [accountId, bucketName] = await Promise.all([
      getSecret("R2_ACCOUNT_ID"),
      getSecret("R2_BUCKET_NAME"),
    ]);

    // Resolve effective endpoint
    let effectiveEndpoint = endpoint?.trim() || "";
    if (!effectiveEndpoint && accountId?.trim()) {
      effectiveEndpoint = `https://${accountId.trim()}.r2.cloudflarestorage.com`;
    }

    const effectiveBucket = bucket?.trim() || bucketName?.trim() || "cold-storage";
    const effectivePrefix = prefix?.trim() || "consolidation-docs/";

    const diagnosis = {
      vault_keys: {
        R2_ENDPOINT:          endpoint ? `set (${endpoint.length} chars, starts: ${endpoint.slice(0, 30)}...)` : "MISSING",
        R2_ACCESS_KEY_ID:     accessKeyId ? `set (${accessKeyId.length} chars)` : "MISSING",
        R2_SECRET_ACCESS_KEY: secretAccessKey ? `set (${secretAccessKey.length} chars)` : "MISSING",
        R2_BUCKET:            bucket ? `"${bucket}"` : "MISSING (will use default)",
        R2_CANONICAL_PREFIX:  prefix ? `"${prefix}"` : "MISSING (will use default)",
        R2_ACCOUNT_ID:        accountId ? `set (${accountId.length} chars, starts: ${accountId.slice(0, 10)}...)` : "MISSING",
        R2_BUCKET_NAME:       bucketName ? `"${bucketName}"` : "MISSING",
      },
      resolved: {
        endpoint: effectiveEndpoint || "UNRESOLVABLE",
        bucket  : effectiveBucket,
        prefix  : effectivePrefix,
      },
    };

    // Attempt a direct raw list if we have enough to try
    let listTest: { ok: boolean; status?: number; objectCount?: number; error?: string; xml_preview?: string } = { ok: false };

    if (effectiveEndpoint && accessKeyId && secretAccessKey) {
      try {
        const crypto = await import("crypto");

        const now      = new Date();
        const dateShort = now.toISOString().slice(0, 10).replace(/-/g, "");
        const dateTime  = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
        const host      = new URL(effectiveEndpoint).host;

        const params     = new URLSearchParams({ "list-type": "2", "max-keys": "5", "prefix": effectivePrefix });
        const query      = params.toString();
        const path       = `/${effectiveBucket}`;
        const payloadHash = crypto.default.createHash("sha256").update("", "utf8").digest("hex");

        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateTime}\n`;
        const signedHeaders    = "host;x-amz-content-sha256;x-amz-date";
        const canonicalRequest = ["GET", path, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");

        const credentialScope = `${dateShort}/auto/s3/aws4_request`;
        const stringToSign    = ["AWS4-HMAC-SHA256", dateTime, credentialScope,
          crypto.default.createHash("sha256").update(canonicalRequest, "utf8").digest("hex")].join("\n");

        const hmac = (key: Buffer | string, data: string) => {
          const k = typeof key === "string" ? Buffer.from(key, "utf8") : key;
          return crypto.default.createHmac("sha256", k).update(data, "utf8").digest();
        };
        const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateShort), "auto"), "s3"), "aws4_request");
        const signature  = hmac(signingKey, stringToSign).toString("hex");

        const res = await fetch(
          `${effectiveEndpoint}${path}?${query}`,
          {
            headers: {
              host,
              "x-amz-date": dateTime,
              "x-amz-content-sha256": payloadHash,
              authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
            },
          }
        );

        const xml = await res.text();
        const keyMatches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);

        listTest = {
          ok         : res.ok,
          status     : res.status,
          objectCount: keyMatches.length,
          xml_preview: xml.slice(0, 300),
          ...(keyMatches.length ? { sample_keys: keyMatches.slice(0, 5) } as Record<string, unknown> : {}),
        };
      } catch (err) {
        listTest = { ok: false, error: String(err) };
      }
    } else {
      listTest = { ok: false, error: "Cannot test — missing endpoint, accessKeyId, or secretAccessKey" };
    }

    return NextResponse.json({ ok: true, diagnosis, listTest });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
