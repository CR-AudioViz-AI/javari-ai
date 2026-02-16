// app/api/javari/roadmap/status/route.ts
/**
 * ROADMAP STATUS ENDPOINT
 * 
 * GET /api/javari/roadmap/status?id=roadmap-123
 * Returns current state of a roadmap
 */

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const roadmapId = searchParams.get('id');

    if (!roadmapId) {
      // Return all active roadmaps
      const active = stateManager.getActive();
      return NextResponse.json({
        success: true,
        roadmaps: active,
      });
    }

    // Return specific roadmap
    const state = stateManager.load(roadmapId);
    
    if (!state) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      state,
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
