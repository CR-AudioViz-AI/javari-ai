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
    const { type, content, language, targetMetrics, userId } = await req.json();
    
    if (!content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 18) {
      return NextResponse.json({ error: 'Insufficient credits', required: 18 }, { status: 402 });
    }

    const prompt = `Optimize the following ${type || 'code'}:\n\n\`\`\`${language || ''}\n${content}\n\`\`\`\n\nTarget: ${JSON.stringify(targetMetrics || {})}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2500
    });

    const optimization = completion.choices[0].message.content;

    await supabase.from('users').update({ credits: user.credits - 18 }).eq('id', userId);
    await supabase.from('api_usage').insert({
      user_id: userId,
      endpoint: '/api/advanced/optimize',
      credits_used: 18,
      response_data: { optimization }
    });

    return NextResponse.json({ success: true, optimization, creditsUsed: 18 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Optimization failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
