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
    const { code, language, userId } = await req.json();
    
    if (!code || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 15) {
      return NextResponse.json({ error: 'Insufficient credits', required: 15 }, { status: 402 });
    }

    const prompt = `Review the following ${language || 'code'} for security vulnerabilities, performance issues, and best practices:\n\n\`\`\`\n${code}\n\`\`\``;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const review = completion.choices[0].message.content;

    await supabase.from('users').update({ credits: user.credits - 15 }).eq('id', userId);
    await supabase.from('api_usage').insert({
      user_id: userId,
      endpoint: '/api/advanced/code-review',
      credits_used: 15,
      response_data: { review }
    });

    return NextResponse.json({ success: true, review, creditsUsed: 15 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Review failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
