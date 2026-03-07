// app/api/javari/r2-sample/route.ts
// Temp: inspect ALL 74 R2 docs — find non-placeholder ones and sample content
import { NextResponse } from "next/server";
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const allKeys = await listCanonicalKeys();
    const mdKeys  = allKeys.filter(k => k.key.endsWith(".md"));

    // Classify each doc: is it a placeholder or real content?
    const results: Array<{key: string; lines: number; isPlaceholder: boolean; firstLines: string[]}> = [];

    // Sample first 20 only to avoid timeout
    for (const obj of mdKeys.slice(0, 20)) {
      const text = await fetchCanonicalText(obj.key).catch(() => "");
      const lines = text.split("\n").filter(l => l.trim());
      const isPlaceholder = text.includes("placeholder") || lines.length <= 4;
      results.push({
        key          : obj.key.split("/").pop() ?? obj.key,
        lines        : lines.length,
        isPlaceholder,
        firstLines   : lines.slice(0, 8),
      });
    }

    const real = results.filter(r => !r.isPlaceholder);
    return NextResponse.json({
      ok         : true,
      totalMd    : mdKeys.length,
      sampled    : results.length,
      realDocs   : real.length,
      docs       : real,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
