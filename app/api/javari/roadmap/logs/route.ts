// app/api/javari/roadmap/logs/route.ts
/**
 * ROADMAP LOGS ENDPOINT
 * GET /api/javari/roadmap/logs?id=roadmap-123
 * Real-time execution logs streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const roadmapId = searchParams.get('id');

    if (!roadmapId) {
      return NextResponse.json(
        { error: 'Roadmap ID required' },
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

    // Generate execution logs
    const logs = state.tasks.map(task => ({
      taskId: task.id,
      title: task.title,
      status: task.status,
      provider: task.provider,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      error: task.error,
      retryCount: task.retryCount,
    }));

    return NextResponse.json({
      success: true,
      roadmapId: state.id,
      logs,
      summary: {
        total: state.metadata.totalTasks,
        completed: state.metadata.completedTasks,
        failed: state.metadata.failedTasks,
        progress: state.metadata.progress,
      },
    });

  } catch (error) {
    console.error('[Roadmap Logs] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
