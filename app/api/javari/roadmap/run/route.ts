// app/api/javari/roadmap/run/route.ts
/**
 * ROADMAP EXECUTION ENDPOINT
 * 
 * POST /api/javari/roadmap/run
 * Initializes and executes a roadmap from user prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoadmapEngine } from '@/lib/roadmap-engine/roadmap-engine';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, title, strategy = 'dependency-driven' } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
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
    engine.onStateChange((state) => {
      stateManager.save(state);
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
