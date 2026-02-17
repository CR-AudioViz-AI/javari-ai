// app/api/knowledge/query/route.ts
/**
 * Knowledge Query - DISABLED TEMPORARILY
 * Returns empty response so frontend immediately falls back to /api/chat
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[Knowledge] Bypassing - returning empty to trigger chat fallback');
  
  // Return structure that makes frontend immediately fall back to /api/chat
  // with the message intact
  return NextResponse.json({
    messages: [],
    sources: [],
    answer: "",
    success: false,
    fallbackUsed: true,
  }, { status: 200 });
}

export async function GET() {
  return POST({} as NextRequest);
}

export async function PUT() {
  return POST({} as NextRequest);
}

export async function DELETE() {
  return POST({} as NextRequest);
}

export async function PATCH() {
  return POST({} as NextRequest);
}
