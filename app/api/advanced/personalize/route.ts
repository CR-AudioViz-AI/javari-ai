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
    const { userProfile, contentType, userId } = await req.json();
    
    if (!userProfile || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 20) {
      return NextResponse.json({ error: 'Insufficient credits', required: 20 }, { status: 402 });
    }

    const prompt = `Create personalized ${contentType || 'content'} for user:\n\n${JSON.stringify(userProfile, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    });

    const personalizedContent = completion.choices[0].message.content;

    await supabase.from('users').update({ credits: user.credits - 20 }).eq('id', userId);
    await supabase.from('api_usage').insert({
      user_id: userId,
      endpoint: '/api/advanced/personalize',
      credits_used: 20,
      response_data: { personalizedContent }
    });

    return NextResponse.json({ success: true, content: personalizedContent, creditsUsed: 20 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Personalization failed', details: error.message }, { status: 500 });
  }
}
