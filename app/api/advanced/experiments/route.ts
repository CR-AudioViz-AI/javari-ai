import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let query = supabase.from('experiments').select('*').eq('user_id', userId);
    if (status) query = query.eq('status', status);

    const { data: experiments } = await query;

    return NextResponse.json({ success: true, experiments });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Fetch failed', details: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, featureFlags, targetPercentage, userId } = await req.json();
    
    if (!name || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 12) {
      return NextResponse.json({ error: 'Insufficient credits', required: 12 }, { status: 402 });
    }

    const { data: experiment } = await supabase.from('experiments').insert({
      user_id: userId,
      name,
      description,
      feature_flags: featureFlags,
      target_percentage: targetPercentage,
      status: 'active'
    }).select().single();

    await supabase.from('users').update({ credits: user.credits - 12 }).eq('id', userId);

    return NextResponse.json({ success: true, experiment, creditsUsed: 12 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Create failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
