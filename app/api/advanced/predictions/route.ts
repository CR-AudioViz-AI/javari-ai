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

const CREDIT_COST = 25;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, predictType, horizon, userId } = body;

    if (!data || !predictType || !userId) {
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

    const prompt = `Generate ${predictType} predictions for the next ${horizon || '30 days'}:
Data: ${JSON.stringify(data)}

Provide predictions in JSON format with:
- predictions: array of future values
- confidence: confidence intervals
- factors: key influencing factors`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const predictions = JSON.parse(completion.choices[0].message.content || '{}');

    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      endpoint: '/api/advanced/predictions',
      credits_used: CREDIT_COST,
    });

    return NextResponse.json({
      success: true,
      predictions,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Prediction failed', details: error.message },
      { status: 500 }
    );
  }
}
