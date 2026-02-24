// app/api/javari/roadmap/step/route.ts
/**
 * ROADMAP STEP ENDPOINT
 * 
 * GET /api/javari/roadmap/step?id=roadmap-123&taskId=task-1
 * Returns details of a specific task
 */

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const roadmapId = searchParams.get('id');
    const taskId = searchParams.get('taskId');

    if (!roadmapId || !taskId) {
      return NextResponse.json(
        { error: 'Both id and taskId are required' },
        { status: 400 }
      );
    }

    const state = stateManager.load(roadmapId);
    
    if (!state) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      );
    }

    const task = state.tasks.find(t => t.id === taskId);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      task,
      roadmapProgress: state.metadata.progress,
    });

  } catch (error) {
    console.error('[Roadmap Step] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
