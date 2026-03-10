// This batch route has been superseded by /api/canonical/ingest-ecosystem-v3
// which fetches catalog data at runtime from data/ecosystem-roadmap-v3.json
// This file is kept as a redirect stub only.
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ ok: false, error: "Use /api/canonical/ingest-ecosystem-v3 instead", redirect: "/api/canonical/ingest-ecosystem-v3" }, { status: 301 });
}
