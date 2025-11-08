import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { historicalData, predictionType, timeframe, userId } = await req.json();
    
    if (!historicalData || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 25) {
      return NextResponse.json({ error: 'Insufficient credits', required: 25 }, { status: 402 });
    }

    const prompt = `Analyze historical data and predict ${predictionType} for ${timeframe}:\n\n${JSON.stringify(historicalData, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2000
    });

    const prediction = completion.choices[0].message.content;

    await supabase.from('users').update({ credits: user.credits - 25 }).eq('id', userId);
    await supabase.from('api_usage').insert({
      user_id: userId,
      endpoint: '/api/advanced/predictions',
      credits_used: 25,
      response_data: { prediction }
    });

    return NextResponse.json({ success: true, prediction, creditsUsed: 25 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Prediction failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
