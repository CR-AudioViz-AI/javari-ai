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
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data: segments } = await supabase.from('user_segments').select('*').eq('user_id', userId);

    return NextResponse.json({ success: true, segments });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Fetch failed', details: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, criteria, userId } = await req.json();
    
    if (!name || !criteria || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 15) {
      return NextResponse.json({ error: 'Insufficient credits', required: 15 }, { status: 402 });
    }

    const { data: segment } = await supabase.from('user_segments').insert({
      user_id: userId,
      name,
      criteria
    }).select().single();

    await supabase.from('users').update({ credits: user.credits - 15 }).eq('id', userId);

    return NextResponse.json({ success: true, segment, creditsUsed: 15 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Segment creation failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
