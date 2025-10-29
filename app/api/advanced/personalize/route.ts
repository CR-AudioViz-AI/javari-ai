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

const CREDIT_COST = 20;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userProfile, contentType, options, userId } = body;

    if (!userProfile || !contentType || !userId) {
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

    const prompt = `Generate personalized ${contentType} for this user:
Profile: ${JSON.stringify(userProfile)}
Options: ${JSON.stringify(options || {})}

Return in JSON format with:
- content: personalized content
- reasoning: why this content fits
- alternatives: other options`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const personalized = JSON.parse(completion.choices[0].message.content || '{}');

    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      personalized,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Personalization failed', details: error.message },
      { status: 500 }
    );
  }
}
