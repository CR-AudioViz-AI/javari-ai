// app/api/javari/credentials/status/route.ts
// Credential Status Diagnostic Endpoint
// Returns provider health status ONLY — no key values ever returned
// Called by: Javari health checks, admin dashboard, autonomous monitors

import { NextResponse } from "next/server";
import { vaultSync } from "@/lib/javari/secrets/credential-sync";
import vault from "@/lib/javari/secrets/vault";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const detailed = url.searchParams.get("detailed") === "true";
    const live = url.searchParams.get("live") === "true";

    if (live) {
      // Full sync with live provider tests
      const syncResult = await vaultSync();

      return NextResponse.json({
        ok: syncResult.validCount >= syncResult.totalProviders * 0.7,
        timestamp: syncResult.timestamp,
        summary: {
          total: syncResult.totalProviders,
          valid: syncResult.validCount,
          missing: syncResult.missingCount,
          issues: syncResult.issueCount,
        },
        providers: syncResult.results.map((r) => ({
          provider: r.provider,
          envVar: r.envVar,
          status: r.status,
          latencyMs: r.latencyMs,
          note: r.note,
        })),
        namingMismatches: syncResult.namingMismatches,
        criticalIssues: syncResult.criticalIssues,
      });
    }

    // Fast mode: just check presence
    const status = vault.status();

    const providers = Object.entries(status).map(([name, info]) => ({
      provider: name,
      envVar: info.envVar,
      aliases: detailed ? info.aliases : undefined,
      status: info.present ? "present" : "missing",
    }));

    const presentCount = providers.filter((p) => p.status === "present").length;

    return NextResponse.json({
      ok: presentCount >= providers.length * 0.7,
      timestamp: new Date().toISOString(),
      summary: {
        total: providers.length,
        present: presentCount,
        missing: providers.length - presentCount,
      },
      providers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  // Trigger a full sync (admin use only)
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body?.secret;
    const expected = process.env.CRON_SECRET || process.env.ADMIN_SETUP_SECRET;
    if (secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await vaultSync();
    return NextResponse.json({
      success: true,
      ...result,
      // Strip any test details that might contain timing side-channels
      results: result.results.map(r => ({
        provider: r.provider, status: r.status, latencyMs: r.latencyMs, note: r.note
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
