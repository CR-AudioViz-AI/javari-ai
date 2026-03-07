// app/api/javari/r2-sample/route.ts
// Temp: fetch content from roadmap-matched R2 docs for pattern analysis
import { NextResponse } from "next/server";
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROADMAP_PATTERNS = [
  /roadmap/i, /platform/i, /scaling/i, /next.steps/i, /master/i,
  /phase/i, /architecture/i, /blueprint/i, /ecosystem/i, /executive/i,
  /DR_Runbook/i, /deployment/i, /implementation/i, /strategic/i,
];

export async function GET() {
  try {
    const keys = await listCanonicalKeys();
    const matched = keys.filter(k => {
      const fn = k.key.split("/").pop() ?? "";
      return fn.endsWith(".md") && ROADMAP_PATTERNS.some(p => p.test(fn));
    }).slice(0, 5);

    const samples: Record<string, string[]> = {};
    for (const obj of matched) {
      const text = await fetchCanonicalText(obj.key).catch(() => "");
      samples[obj.key] = text.split("\n").slice(0, 60);
    }
    return NextResponse.json({ ok: true, matchedCount: matched.length, totalKeys: keys.length, keys: matched.map(k=>k.key), samples });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
