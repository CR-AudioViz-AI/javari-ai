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

interface CodeReviewRequest {
  code: string;
  language: string;
  reviewType?: 'security' | 'performance' | 'quality' | 'all';
  userId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CodeReviewRequest = await req.json();
    const { code, language, reviewType = 'all', userId } = body;

    if (!code || !language || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: code, language, userId' },
        { status: 400 }
      );
    }

    // Check credits
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

    // Generate code review
    const prompt = `Review this ${language} code for ${reviewType} issues:

\`\`\`${language}
${code}
\`\`\`

Provide detailed review in JSON format with:
- overallScore: 0-100
- issues: array of { severity: 'critical'|'warning'|'info', line: number, message: string, suggestion: string }
- strengths: array of positive findings
- recommendations: specific improvements`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const review = JSON.parse(completion.choices[0].message.content || '{}');

    // Deduct credits
    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    // Log usage
    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      endpoint: '/api/advanced/code-review',
      credits_used: CREDIT_COST,
      metadata: { language, reviewType, codeLength: code.length },
    });

    return NextResponse.json({
      success: true,
      review,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    console.error('Code Review error:', error);
    return NextResponse.json(
      { error: 'Failed to review code', details: error.message },
      { status: 500 }
    );
  }
}
