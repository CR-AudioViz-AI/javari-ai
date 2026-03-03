// app/api/javari/roadmap/run/route.ts
/**
 * ROADMAP EXECUTION ENDPOINT
 * 
 * POST /api/javari/roadmap/run
 * - With roadmapId: Advances existing roadmap
 * - Without roadmapId: Creates new roadmap from prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoadmapEngine } from '@/lib/roadmap-engine/roadmap-engine';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roadmapId, prompt, title, strategy = 'dependency-driven' } = body;

    // If roadmapId is provided, advance existing roadmap
    if (roadmapId) {
      const existingState = await stateManager.loadAsync(roadmapId);
      
      if (!existingState) {
        return NextResponse.json(
          { error: 'Roadmap not found' },
          { status: 404 }
        );
      }

      // Create engine from existing state
      const engine = new RoadmapEngine(
        existingState.title,
        existingState.description,
        'dependency-driven'
      );

      // Restore state
      engine.setState(existingState);

      // Subscribe to state changes
      engine.onStateChange(async (state) => {
        await stateManager.saveAsync(state);
      });

      // Execute next task (non-blocking)
      engine.execute().catch((error) => {
        console.error('[Roadmap] Execution error:', error);
      });

      return NextResponse.json({
        success: true,
        roadmapId: existingState.id,
        state: engine.getState(),
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
