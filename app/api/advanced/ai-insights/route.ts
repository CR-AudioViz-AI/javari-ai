import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface InsightRequest {
  data: any[];
  analysisType: 'trends' | 'anomalies' | 'predictions' | 'recommendations';
  context?: string;
  userId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: InsightRequest = await req.json();
    const { data, analysisType, context, userId } = body;
    
    if (!data || !analysisType || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 20) {
      return NextResponse.json({ error: 'Insufficient credits', required: 20 }, { status: 402 });
    }

    const prompt = `Analyze the following data and provide ${analysisType}:\n\n${JSON.stringify(data, null, 2)}\n\nContext: ${context || 'None'}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    });

    const insights = completion.choices[0].message.content;

    await supabase.from('users').update({ credits: user.credits - 20 }).eq('id', userId);
    await supabase.from('api_usage').insert({
      user_id: userId,
      endpoint: '/api/advanced/ai-insights',
      credits_used: 20,
      response_data: { insights }
    });

    return NextResponse.json({ success: true, insights, creditsUsed: 20 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Analysis failed', details: error.message }, { status: 500 });
  }
}
