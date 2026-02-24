/**
 * SYNTHETIC FAILURE INJECTION - For testing self-healing
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (process.env.AUTONOMOUS_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'Test mode not enabled' }, { status: 403 });
  }
  
  const code = parseInt(request.nextUrl.searchParams.get('code') || '503');
  const delay = parseInt(request.nextUrl.searchParams.get('delay') || '0');
  
  if (delay > 0) await new Promise(r => setTimeout(r, Math.min(delay, 5000)));
  
  return NextResponse.json({
    test: true,
    injected_code: code,
    timestamp: new Date().toISOString()
  }, { status: code });
}
