/**
 * MULTI-AI CHAMBER API
 * 
 * POST /api/chamber/run - Execute chamber with goal
 * GET /api/chamber/run?sessionId=xxx - Retrieve session
 * 
 * Fixed: Proper JSON parsing, goal validation, error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChamberController } from '@/chamber/controller';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    let goal: string;
    
    try {
      const body = await req.json();
      goal = body.goal;
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate goal
    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid "goal" parameter' },
        { status: 400 }
      );
    }

    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify auth and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      );
    }

    // Execute chamber
    const controller = new ChamberController(supabase);
    const result = await controller.execute({
      goal: goal.trim(),
      context: {
        userId: user.id,
        timestamp: new Date().toISOString(),
      },
      userId: user.id,
      sessionId: crypto.randomUUID(),
    });

    // Return result
    return NextResponse.json({
      success: result.success,
      session_id: result.sessionId,
      architect_output: result.architectOutput,
      build_result: result.buildResult,
      observation_result: result.observationResult,
      total_duration: result.totalDuration,
    });

  } catch (error: any) {
    console.error('Chamber execution error:', error);
    return NextResponse.json(
      { 
        error: 'Chamber execution failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Fetch session from database
    const { data: session, error: dbError } = await supabase
      .from('chamber_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);

  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
