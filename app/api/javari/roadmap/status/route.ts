// app/api/javari/roadmap/status/route.ts
/**
 * ROADMAP STATUS ENDPOINT
 * 
 * GET /api/javari/roadmap/status?roadmapId=roadmap-123
 * Returns current state of a roadmap from Supabase (source of truth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function GET(req: NextRequest) {
  try {
    // DEPLOYMENT MARKER FOR VERIFICATION
    return NextResponse.json({
      DEPLOYMENT_MARKER: "ROADMAP_STATUS_FORENSIC_V1",
      timestamp: new Date().toISOString(),
      commitSHA: "13331a3"
    });

  } catch (error) {
    console.error('[Roadmap Status] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
