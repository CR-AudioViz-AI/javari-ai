/**
 * CHAMBER API - Main Execution Endpoint
 * 
 * POST /api/chamber/run
 * Integrated with Supabase auth + multi-model routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChamberController } from '@/chamber/controller';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // Supabase auth
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
    const { goal, context } = body;

    if (!goal) {
      return NextResponse.json({ error: 'Missing goal' }, { status: 400 });
    }

    // Execute chamber
    const controller = new ChamberController(user.id);
    const result = await controller.execute({
      goal,
      context,
      userId: user.id,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[CHAMBER API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const { data } = await supabase
      .from('chamber_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    return NextResponse.json(data || { error: 'Session not found' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
