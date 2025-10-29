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

const CREDIT_COST = 18;

interface OptimizeRequest {
  type: 'code' | 'query' | 'algorithm' | 'bundle';
  content: string;
  language?: string;
  context?: string;
  userId: string;
  targetMetrics?: {
    speedImprovement?: number;
    memoryReduction?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: OptimizeRequest = await req.json();
    const { type, content, language, context, userId, targetMetrics } = body;

    if (!type || !content || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, content, userId' },
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

    // Generate optimization
    const prompt = `Optimize this ${type}${language ? ` (${language})` : ''}:

${context ? `Context: ${context}\n` : ''}
${targetMetrics ? `Target: ${JSON.stringify(targetMetrics)}\n` : ''}

\`\`\`
${content}
\`\`\`

Provide optimization in JSON format with:
- currentPerformance: { complexity: string, bottlenecks: string[] }
- optimizedCode: string (the optimized version)
- improvements: array of { area: string, impact: 'high'|'medium'|'low', before: string, after: string }
- estimatedImpact: { speedImprovement: string, complexityImprovement: string }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const optimization = JSON.parse(completion.choices[0].message.content || '{}');

    // Deduct credits
    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    // Log usage
    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      endpoint: '/api/advanced/optimize',
      credits_used: CREDIT_COST,
      metadata: { type, contentLength: content.length },
    });

    return NextResponse.json({
      success: true,
      optimization,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    console.error('Optimization error:', error);
    return NextResponse.json(
      { error: 'Failed to optimize', details: error.message },
      { status: 500 }
    );
  }
}
