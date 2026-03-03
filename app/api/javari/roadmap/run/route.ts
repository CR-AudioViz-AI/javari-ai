// app/api/javari/roadmap/run/route.ts
/**
 * ROADMAP EXECUTION ENDPOINT
 * 
 * POST /api/javari/roadmap/run
 * - With roadmapId: Advances existing roadmap (pure state update)
 * - Without roadmapId: Creates new roadmap from prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoadmapEngine } from '@/lib/roadmap-engine/roadmap-engine';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roadmapId, prompt, title, strategy = 'dependency-driven' } = body;

    // If roadmapId is provided, advance existing roadmap via pure state update
    if (roadmapId) {
      const roadmap = await stateManager.loadAsync(roadmapId);
      
      if (!roadmap) {
        return NextResponse.json(
          { error: 'Roadmap not found' },
          { status: 404 }
        );
      }

      // Find first eligible task (pending with satisfied dependencies)
      const eligibleTask = roadmap.tasks?.find(task => {
        if (task.status !== 'pending') return false;
        
        // Check if all dependencies are complete
        if (!task.dependencies || task.dependencies.length === 0) return true;
        
        return task.dependencies.every(depId => {
          const depTask = roadmap.tasks?.find(t => t.id === depId);
          return depTask && depTask.status === 'complete';
        });
      });

      if (eligibleTask) {
        // Advance task to running
        eligibleTask.status = 'running';
        eligibleTask.startedAt = Date.now();
        roadmap.currentTaskId = eligibleTask.id;
      }

      // Update roadmap timestamp
      roadmap.updatedAt = Date.now();

      // Persist state
      await stateManager.saveAsync(roadmap);

      return NextResponse.json({
        success: true,
        roadmapId: roadmap.id,
        state: roadmap,
        advancedTask: eligibleTask ? eligibleTask.id : null
      });
    }

    // Otherwise, create new roadmap from prompt
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required when creating new roadmap' },
        { status: 400 }
      );
    }

    // Create roadmap engine
    const engine = new RoadmapEngine(
      title || 'Untitled Roadmap',
      prompt,
      strategy
    );

    // Subscribe to state changes
    engine.onStateChange(async (state) => {
      await stateManager.saveAsync(state);
    });

    // Initialize roadmap (task breakdown)
    await engine.initialize(prompt);

    // Get initial state after planning
    const state = engine.getState();

    // Start execution (non-blocking)
    engine.execute().catch((error) => {
      console.error('[Roadmap] Execution error:', error);
    });

    return NextResponse.json({
      success: true,
      roadmapId: state.id,
      state,
    });

  } catch (error) {
    console.error('[Roadmap Run] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
