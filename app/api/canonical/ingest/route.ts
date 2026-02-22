// app/api/canonical/ingest/route.ts
// CR AudioViz AI — Canonical Ingest API Endpoint
// 2026-02-22 FINAL — Canonical Document Ingestion System
//
// POST /api/canonical/ingest
// Auth: x-canonical-secret header = CANONICAL_ADMIN_SECRET env var
// Body: { force?: boolean, dryRun?: boolean, maxTokens?: number }
//
// GET /api/canonical/ingest → health/status (no auth required)
//
// Feature flag: CANONICAL_INGEST_ENABLED=false disables POST without code change.
//
// SAFE: read-only from R2, additive writes to Supabase only.
// Does NOT touch: chat routes, autonomy-core, unified engine, enterprise layer.

import { NextRequest, NextResponse } from "next/server";
import { safeHandler }               from "@/lib/errors/handler";
import { ApiError }                  from "@/lib/errors/api-error";
import {
  ingestAllCanonicalDocs,
  getStoreStats,
}                                    from "@/lib/canonical/ingest";
import { checkR2Connectivity }       from "@/lib/canonical/r2-client";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;        // 5 min — large doc sets

// ── Feature flag ──────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  return process.env.CANONICAL_INGEST_ENABLED !== "false";
}

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CANONICAL_ADMIN_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("x-canonical-secret") === secret ||
    req.headers.get("authorization")       === `Bearer ${secret}`
  );
}

// ── GET — health / status ─────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  let r2     = { ok: false, message: "not checked" };
  let store  = { totalDocs: 0, totalChunks: 0 };

  try {
    [r2, store] = await Promise.all([
      checkR2Connectivity(),
      getStoreStats(),
    ]);
  } catch { /* best-effort */ }

  return NextResponse.json({
    status:  "canonical-ingest",
    enabled: isEnabled(),
    r2,
    store,
    config: {
      CANONICAL_INGEST_ENABLED:  process.env.CANONICAL_INGEST_ENABLED  ?? "true",
      R2_BUCKET:                 process.env.R2_BUCKET                 ?? "(not set)",
      R2_CANONICAL_PREFIX:       process.env.R2_CANONICAL_PREFIX       ?? "roadmap/",
      CANONICAL_ADMIN_SECRET:    process.env.CANONICAL_ADMIN_SECRET    ? "set" : "MISSING",
      OPENAI_API_KEY:            process.env.OPENAI_API_KEY            ? "set" : "MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
    },
    ts: new Date().toISOString(),
  });
}

// ── POST — trigger ingest ─────────────────────────────────────────────────────

export const POST = safeHandler(async (req: NextRequest) => {
  if (!isEnabled()) {
    return NextResponse.json(
      { success: false, error: "Canonical ingest disabled (CANONICAL_INGEST_ENABLED=false)" },
      { status: 503 }
    );
  }

  if (!isAuthorized(req)) {
    throw ApiError.unauthorized(
      "Canonical ingest: x-canonical-secret header required"
    );
  }

  let body: { force?: boolean; dryRun?: boolean; maxTokens?: number } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const force     = body.force     === true;
  const dryRun    = body.dryRun    === true;
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : 800;

  console.info(
    `${new Date().toISOString()} [INFO][api:canonical:ingest] ` +
    `Ingest triggered force=${force} dryRun=${dryRun} maxTokens=${maxTokens}`
  );

  const summary = await ingestAllCanonicalDocs({ force, dryRun, maxTokens });

  return NextResponse.json({
    success:       true,
    docsProcessed: summary.docsProcessed,
    docsUpdated:   summary.docsUpdated,
    docsUnchanged: summary.docsUnchanged,
    docsFailed:    summary.docsFailed,
    chunksCreated: summary.chunksCreated,
    chunksSkipped: summary.chunksSkipped,
    durationMs:    summary.durationMs,
    dryRun:        summary.dryRun,
    docs: summary.docs.map((d) => ({
      r2Key:        d.r2Key,
      status:       d.status,
      chunksCreated: d.chunksCreated,
      durationMs:   d.durationMs,
    })),
  });
});
