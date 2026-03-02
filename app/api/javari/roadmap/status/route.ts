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
    const searchParams = req.nextUrl.searchParams;
    const roadmapId = searchParams.get('roadmapId') || searchParams.get('id');

    if (!roadmapId) {
      // Return all active roadmaps from DB
      const active = await stateManager.listAsync();
      const activeFiltered = active.filter(
        (s) => s.status === 'planning' || s.status === 'executing'
      );
      return NextResponse.json({
        success: true,
        roadmaps: activeFiltered,
      });
    }

    // Return specific roadmap from DB
    const state = await stateManager.loadAsync(roadmapId);
    
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
