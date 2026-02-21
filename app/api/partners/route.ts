// app/api/partners/route.ts
// CR AudioViz AI — Partner API Framework
// 2026-02-21 — STEP 10 Enterprise

import { NextRequest, NextResponse } from "next/server";
import { createPartnerKey, revokePartnerKey, validatePartnerKey } from "@/lib/enterprise/partners/keys";
import { submitManifest, validateManifest } from "@/lib/enterprise/partners/manifest";
import { safeHandler } from "@/lib/errors/handler";
import { ApiError } from "@/lib/errors/api-error";
import type { PartnerManifest } from "@/lib/enterprise/partners/manifest";
import type { PartnerScope } from "@/lib/enterprise/partners/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/partners — validate partner key status
export const GET = safeHandler(async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer pk_live_")) {
    throw ApiError.unauthorized("Partner API key required");
  }
  const rawKey    = authHeader.slice(7);
  const partnerKey = await validatePartnerKey(rawKey);
  if (!partnerKey) throw ApiError.unauthorized("Invalid or expired partner key");

  return NextResponse.json({
    success:    true,
    partner:    partnerKey.partnerId,
    scopes:     partnerKey.scopes,
    rateLimit:  partnerKey.rateLimit,
    expiresAt:  partnerKey.expiresAt ?? null,
    keyPrefix:  partnerKey.keyPrefix,
  });
});

// POST /api/partners — create key or submit manifest
export const POST = safeHandler(async (req: NextRequest) => {
  const body = await req.json() as {
    action:    string;
    partnerId?: string;
    scopes?:   PartnerScope[];
    rateLimit?: number;
    expiresAt?: string;
    manifest?: PartnerManifest;
    keyId?:    string;
    requestedBy?: string;
  };

  switch (body.action) {
    case "create_key": {
      if (!body.partnerId) throw ApiError.badRequest("partnerId required");
      const scopes: PartnerScope[] = body.scopes ?? ["modules:read"];
      const { key, rawKey } = await createPartnerKey({
        partnerId:  body.partnerId,
        scopes,
        rateLimit:  body.rateLimit,
        expiresAt:  body.expiresAt,
        createdBy:  body.requestedBy ?? "api",
      });
      return NextResponse.json({
        success: true,
        key: { id: key.id, prefix: key.keyPrefix, scopes, rateLimit: key.rateLimit },
        // Raw key shown ONCE — never stored
        rawKey,
        warning: "Store this key securely — it will not be shown again.",
      });
    }

    case "revoke_key": {
      if (!body.keyId) throw ApiError.badRequest("keyId required");
      await revokePartnerKey(body.keyId, body.requestedBy ?? "api");
      return NextResponse.json({ success: true, revoked: body.keyId });
    }

    case "submit_manifest": {
      if (!body.manifest || !body.partnerId) throw ApiError.badRequest("manifest + partnerId required");
      const validation = validateManifest(body.manifest);
      if (!validation.valid) {
        return NextResponse.json({ success: false, errors: validation.errors, warnings: validation.warnings }, { status: 422 });
      }
      const result = await submitManifest(body.manifest, body.partnerId);
      return NextResponse.json({ success: true, ...result, warnings: validation.warnings });
    }

    case "validate_manifest": {
      if (!body.manifest) throw ApiError.badRequest("manifest required");
      const validation = validateManifest(body.manifest);
      return NextResponse.json({ success: true, ...validation });
    }

    default:
      throw ApiError.badRequest(`Unknown action: ${body.action}`);
  }
});
