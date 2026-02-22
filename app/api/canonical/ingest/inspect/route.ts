// app/api/canonical/ingest/inspect/route.ts
// CR AudioViz AI — Canonical R2 Inspect Endpoint (PART 2)
// 2026-02-22
//
// POST /api/canonical/ingest/inspect
//   Header: x-canonical-secret: <CANONICAL_ADMIN_SECRET>
//   Returns: keyCount, firstKey, firstDocSha256, firstDocChunkCount
//
// READ-ONLY. No writes. Used by verify_r2.ps1.
// SAFE: Does NOT modify unified.ts, /api/chat, autonomy-core, billing, enterprise.

import { NextRequest, NextResponse }              from "next/server";
import { listCanonicalKeys, fetchCanonicalText }  from "@/lib/canonical/r2-client";
import { sha256Hex }                              from "@/lib/canonical/hasher";
import { chunkMarkdown }                          from "@/lib/canonical/chunker";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CANONICAL_ADMIN_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("x-canonical-secret") === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. List all keys under configured prefix
    const keys = await listCanonicalKeys();

    if (keys.length === 0) {
      return NextResponse.json({
        ok:                 true,
        keyCount:           0,
        firstKey:           null,
        firstDocSha256:     null,
        firstDocChunkCount: null,
        note:               "No keys found under prefix. Upload docs to R2 first.",
      });
    }

    // 2. Fetch first document
    const firstKey  = keys[0];
    const text      = await fetchCanonicalText(firstKey);

    // 3. Hash + chunk
    const hash   = sha256Hex(text);
    const chunks = chunkMarkdown(text);

    return NextResponse.json({
      ok:                 true,
      keyCount:           keys.length,
      firstKey,
      firstDocSha256:     hash,
      firstDocChunkCount: chunks.length,
      firstDocChars:      text.length,
      firstDocApproxTokens: chunks.reduce((s, c) => s + c.approxTokens, 0),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
