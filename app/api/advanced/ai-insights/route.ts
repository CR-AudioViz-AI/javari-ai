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
      return NextResponse.json(
        { error: 'Missing required fields: data, analysisType, userId' },
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

    // Generate AI insights
    const prompt = `Analyze this data and provide ${analysisType}:
${context ? `Context: ${context}\n` : ''}
Data: ${JSON.stringify(data).substring(0, 3000)}

Provide detailed insights in JSON format with:
- summary: brief overview
- insights: array of key findings
- recommendations: actionable suggestions
- confidence: confidence score 0-100`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const insights = JSON.parse(completion.choices[0].message.content || '{}');

    // Deduct credits
    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    // Log usage
    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      endpoint: '/api/advanced/ai-insights',
      credits_used: CREDIT_COST,
      metadata: { analysisType, dataPoints: data.length },
    });

    return NextResponse.json({
      success: true,
      insights,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    console.error('AI Insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: error.message },
      { status: 500 }
    );
  }
}
