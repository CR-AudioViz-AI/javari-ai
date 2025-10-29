import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDIT_COST = 12;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const status = searchParams.get('status');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  let query = supabase.from('experiments').select('*').eq('user_id', userId);
  
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, experiments: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, featureFlags, targetPercentage, userId } = body;

    if (!name || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, userId' },
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

    const { data: experiment } = await supabase
      .from('experiments')
      .insert({
        user_id: userId,
        name,
        description,
        feature_flags: featureFlags,
        target_percentage: targetPercentage || 100,
        status: 'active',
      })
      .select()
      .single();

    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      endpoint: '/api/advanced/experiments',
      credits_used: CREDIT_COST,
    });

    return NextResponse.json({
      success: true,
      experiment,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create experiment', details: error.message },
      { status: 500 }
    );
  }
}
