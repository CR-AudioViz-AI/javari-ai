import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const CREDIT_COST = 15;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { data } = await supabase
    .from('user_segments')
    .select('*')
    .eq('user_id', userId);

  return NextResponse.json({ success: true, segments: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { users, criteria, userId } = body;

    if (!users || !userId) {
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

    const prompt = `Segment these users based on ${criteria || 'behavior patterns'}:
${JSON.stringify(users).substring(0, 2000)}

Return segments in JSON format with:
- segments: array of { name, size, characteristics, recommendations }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const segments = JSON.parse(completion.choices[0].message.content || '{}');

    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      segments,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Segmentation failed', details: error.message },
      { status: 500 }
    );
  }
}
