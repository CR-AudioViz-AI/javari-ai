// app/api/canonical/ingest/route.ts
// CR AudioViz AI — Canonical Ingest API (PART 1 skeleton)
// 2026-02-22
//
// POST /api/canonical/ingest
//   Header: x-canonical-secret: <CANONICAL_ADMIN_SECRET>
//   Returns: { ok: true, status: "skeleton_ready", note: "PART1 only" }
//
// PART 2 will add: R2 list → fetch → chunk → embed → store.
// This file intentionally contains NO ingest logic — stable foundation first.
//
// SAFE: read-only endpoint. No R2 access. No DB writes. No side effects.
// Does NOT modify: unified.ts, /api/chat, autonomy-core, billing, enterprise.

import { NextRequest, NextResponse } from "next/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CANONICAL_ADMIN_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("x-canonical-secret") === secret;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok:     true,
    status: "skeleton_ready",
    note:   "PART1 only",
  });
}
