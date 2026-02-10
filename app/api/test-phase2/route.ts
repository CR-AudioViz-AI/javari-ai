import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: Date.now(),
    message: "VerifyForge Phase 2 API is live"
  });
}
