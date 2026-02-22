// app/api/canonical/ingest/route.ts
// CR AudioViz AI — Canonical Ingest API
// 2026-02-22 PART 2
//
// POST /api/canonical/ingest
//   Header: x-canonical-secret: <CANONICAL_ADMIN_SECRET>
//   Returns: { ok: true, status: "skeleton_ready", note: "PART1 only" }
//
// POST /api/canonical/ingest/inspect  ← PART 2 addition
//   Header: x-canonical-secret: <CANONICAL_ADMIN_SECRET>
//   Lists R2 keys, fetches first doc, returns sha256 + chunk count.
//   No DB writes. Read-only.
//
// SAFE: Does NOT modify unified.ts, /api/chat, autonomy-core, billing, enterprise.

import { NextRequest, NextResponse } from "next/server";
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";
import { sha256Hex }                              from "@/lib/canonical/hasher";
import { chunkMarkdown }                          from "@/lib/canonical/chunker";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CANONICAL_ADMIN_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("x-canonical-secret") === secret;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

// ─── POST /api/canonical/ingest (PART 1 skeleton — unchanged) ─────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return unauthorized();

  return NextResponse.json({
    ok:     true,
    status: "skeleton_ready",
    note:   "PART1 only",
  });
}
