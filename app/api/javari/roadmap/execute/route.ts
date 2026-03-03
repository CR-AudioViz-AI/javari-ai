// app/api/javari/roadmap/execute/route.ts
/**
 * DETERMINISTIC ROADMAP EXECUTION ENDPOINT
 * 
 * POST /api/javari/roadmap/execute
 * Advances exactly ONE task on an existing roadmap
 * - Pure state manipulation (no RoadmapEngine)
 * - DB as source of truth
 * - Recomputes metadata from tasks array
 */

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function POST(req: NextRequest) {
  try {
    const { roadmapId } = await req.json();
    
    if (!roadmapId) {
      return NextResponse.json(
        { error: 'roadmapId is required' },
        { status: 400 }
      );
    }

    const roadmap = await stateManager.loadAsync(roadmapId);
    
    if (!roadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      );
    }

    // Find next eligible pending task (prevent re-execution)
    const nextTask = roadmap.tasks?.find(task =>
      task.status === 'pending' &&
      (!task.dependencies || task.dependencies.length === 0 || 
        task.dependencies.every(depId =>
          roadmap.tasks?.find(t => t.id === depId)?.status === 'complete'
        ))
    );

    // Recompute metadata first
    const total = roadmap.tasks?.length || 0;
    const completed = roadmap.tasks?.filter(t => t.status === 'complete').length || 0;
    const failed = roadmap.tasks?.filter(t => t.status === 'failed').length || 0;

    roadmap.metadata.totalTasks = total;
    roadmap.metadata.completedTasks = completed;
    roadmap.metadata.failedTasks = failed;
    roadmap.metadata.progress = total === 0 ? 0 : completed / total;

    if (!nextTask) {
      // Check if roadmap is complete
      if (completed === total && total > 0) {
        roadmap.status = 'completed';
        roadmap.updatedAt = Date.now();
        await stateManager.saveAsync(roadmap);
        
        return NextResponse.json({
          success: true,
          message: 'Roadmap completed. All tasks finished.',
          roadmapId,
          state: roadmap
        });
      }
      
      // Otherwise roadmap is blocked (incomplete but no eligible tasks)
      if (completed < total) {
        roadmap.status = 'blocked';
        roadmap.updatedAt = Date.now();
        await stateManager.saveAsync(roadmap);
        
        return NextResponse.json({
          success: true,
          message: 'Roadmap blocked. No eligible tasks available.',
          roadmapId,
          state: roadmap
        });
      }

      // Edge case: no tasks at all
      return NextResponse.json({
        success: true,
        message: 'No tasks in roadmap.',
        roadmapId,
        state: roadmap
      });
    }

    // Transition task to running
    nextTask.status = 'running';
    nextTask.startedAt = Date.now();

    // Simulate completion (Phase 1 deterministic engine)
    nextTask.status = 'complete';
    nextTask.completedAt = Date.now();

    // Recompute metadata after task completion
    const newCompleted = roadmap.tasks?.filter(t => t.status === 'complete').length || 0;
    roadmap.metadata.completedTasks = newCompleted;
    roadmap.metadata.progress = total === 0 ? 0 : newCompleted / total;

    // Check if this was the final task
    if (newCompleted === total && total > 0) {
      roadmap.status = 'completed';
    }

    roadmap.updatedAt = Date.now();

    // Persist state
    await stateManager.saveAsync(roadmap);

    return NextResponse.json({
      success: true,
      roadmapId,
      executedTask: nextTask.id,
      state: roadmap
    });

  } catch (error) {
    console.error('[Roadmap Execute] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
