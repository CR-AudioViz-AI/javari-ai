/**
 * CHAMBER LOOP API
 * 
 * POST /api/chamber/loop
 * Autonomous iteration with confidence-based execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChamberController } from '@/chamber/controller';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes for loops

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { goal, maxIterations = 3, autoExecuteThreshold = 0.95 } = body;

    if (!goal) {
      return NextResponse.json({ error: 'Missing goal' }, { status: 400 });
    }

    const iterations = [];
    let currentGoal = goal;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Execute chamber
      const controller = new ChamberController(user.id);
      const result = await controller.execute({
        goal: currentGoal,
        userId: user.id,
      });

      iterations.push(result);

      // Check if successful
      if (!result.success) {
        break;
      }

      // Check for next iteration from observations
      const nextGoal = result.observationResult?.futureAutomations?.[0];
      
      if (!nextGoal) {
        break; // No more iterations needed
      }

      // Check confidence threshold
      if (nextGoal.confidence < autoExecuteThreshold) {
        break; // Requires human approval
      }

      currentGoal = nextGoal.trigger;
    }

    return NextResponse.json({
      success: true,
      iterations,
      totalIterations: iteration,
    });

  } catch (error: any) {
    console.error('[CHAMBER LOOP] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
