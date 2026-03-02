// app/api/javari/roadmap/status/route.ts
/**
 * ROADMAP STATUS ENDPOINT
 * 
 * GET /api/javari/roadmap/status?roadmapId=roadmap-123
 * Returns current state of a roadmap from Supabase (source of truth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function GET() {
  const rows = await stateManager.listAsync();
  return NextResponse.json({
    DEPLOYMENT_MARKER: "RAW_DB_PHASE_2",
    rawCount: rows.length,
    raw: rows
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
