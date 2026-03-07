// app/api/javari/r2-sample/route.ts
// Temp: fetch first 100 lines of a sample R2 doc for pattern analysis
import { NextResponse } from "next/server";
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keys = await listCanonicalKeys();
    const mdKeys = keys.filter(k => k.key.endsWith(".md")).slice(0, 3);
    const samples: Record<string, string[]> = {};
    for (const obj of mdKeys) {
      const text = await fetchCanonicalText(obj.key).catch(() => "");
      samples[obj.key] = text.split("\n").slice(0, 80);
    }
    return NextResponse.json({ ok: true, keys: mdKeys.map(k=>k.key), samples });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
