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

    const { data: workflows } = await supabase.from('workflows').select('*').eq('user_id', userId);

    return NextResponse.json({ success: true, workflows });
  } catch (error: any) {
    return NextResponse.json({ error: 'Fetch failed', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, trigger, steps, userId } = await req.json();
    
    if (!name || !trigger || !steps || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 15) {
      return NextResponse.json({ error: 'Insufficient credits', required: 15 }, { status: 402 });
    }

    const { data: workflow } = await supabase.from('workflows').insert({
      user_id: userId,
      name,
      description,
      trigger,
      steps,
      status: 'active'
    }).select().single();

    await supabase.from('users').update({ credits: user.credits - 15 }).eq('id', userId);

    return NextResponse.json({ success: true, workflow, creditsUsed: 15 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Workflow creation failed', details: error.message }, { status: 500 });
  }
}
