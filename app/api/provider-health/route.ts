// app/api/provider-health/route.ts
// Provider health status endpoint — read-only, no auth required
// Created: 2026-03-01

import { NextResponse } from 'next/server';
import { getAllProviderHealth, rebuildHealthFromExecutions } from '@/lib/javari/telemetry/provider-health';

export async function GET() {
  try {
    const health = await getAllProviderHealth();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      providers: health,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json();
    if (action === 'rebuild') {
      const count = await rebuildHealthFromExecutions();
      return NextResponse.json({ success: true, rebuilt: count });
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
