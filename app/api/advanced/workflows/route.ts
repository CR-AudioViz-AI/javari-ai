import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDIT_COST = 15;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { data } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId);

  return NextResponse.json({ success: true, workflows: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, trigger, steps, userId } = body;

    if (!name || !trigger || !steps || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (!profile || profile.credits < CREDIT_COST) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: CREDIT_COST },
        { status: 402 }
      );
    }

    const { data: workflow } = await supabase
      .from('workflows')
      .insert({
        user_id: userId,
        name,
        description,
        trigger,
        steps,
        status: 'active',
      })
      .select()
      .single();

    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      workflow,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Workflow creation failed', details: error.message },
      { status: 500 }
    );
  }
}
