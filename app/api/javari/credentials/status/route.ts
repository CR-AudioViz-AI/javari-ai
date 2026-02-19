// app/api/javari/credentials/status/route.ts
// Javari Credential Status — diagnostic endpoint
// Returns provider health ONLY — never key values.
// GET  ?live=true  → live provider tests
// GET  (default)  → presence check (fast)
// POST {secret}   → trigger full sync

export const runtime = "nodejs";    // needs Buffer for JWT decode
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { vaultSync } from "@/lib/javari/secrets/credential-sync";
import vault from "@/lib/javari/secrets/vault";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const live = url.searchParams.get("live") === "true";

  if (live) {
    const report = await vaultSync({ liveTests: true });
    return NextResponse.json({
      ok: report.validCount >= Math.floor(report.totalProviders * 0.7),
      timestamp: report.timestamp,
      summary: {
        total: report.totalProviders,
        valid: report.validCount,
        missing: report.missingCount,
        issues: report.issueCount,
      },
      providers: report.results.map(r => ({
        provider: r.provider,
        envVar: r.envVar,
        status: r.status,
        latencyMs: r.latencyMs,
        note: r.note,
      })),
      namingMismatches: report.namingMismatches,
      criticalIssues: report.criticalIssues,
    });
  }

  // Fast: presence-only
  const status = vault.status();
  const entries = Object.entries(status);
  const presentCount = entries.filter(([,v]) => v.present).length;

  return NextResponse.json({
    ok: presentCount >= Math.floor(entries.length * 0.7),
    timestamp: new Date().toISOString(),
    summary: { total: entries.length, present: presentCount, missing: entries.length - presentCount },
    providers: entries.map(([name, info]) => ({
      provider: name,
      envVar: info.envVar,
      status: info.present ? "present" : "missing",
    })),
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const secret = body?.secret as string | undefined;
    const expected = process.env.CRON_SECRET ?? process.env.ADMIN_SETUP_SECRET ?? "";
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const report = await vaultSync({ liveTests: true });
    return NextResponse.json({
      success: true,
      timestamp: report.timestamp,
      summary: { total: report.totalProviders, valid: report.validCount, issues: report.issueCount },
      providers: report.results.map(r => ({ provider: r.provider, status: r.status, note: r.note })),
      namingMismatches: report.namingMismatches,
      criticalIssues: report.criticalIssues,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
