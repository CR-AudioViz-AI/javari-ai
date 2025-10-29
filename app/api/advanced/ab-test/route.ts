import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDIT_COST = 10;

interface ABTestRequest {
  action: 'create' | 'assign' | 'record' | 'analyze';
  userId: string;
  testName?: string;
  testId?: string;
  participantId?: string;
  variants?: Array<{ name: string; weight: number; config: any }>;
  eventType?: string;
  eventData?: any;
}

export async function POST(req: NextRequest) {
  try {
    const body: ABTestRequest = await req.json();
    const { action, userId } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId' },
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

    let result: any;

    switch (action) {
      case 'create':
        if (!body.testName || !body.variants) {
          return NextResponse.json(
            { error: 'Missing testName or variants for create action' },
            { status: 400 }
          );
        }
        
        const { data: test } = await supabase
          .from('ab_tests')
          .insert({
            user_id: userId,
            name: body.testName,
            variants: body.variants,
            status: 'active',
          })
          .select()
          .single();
        
        result = { testId: test?.id, test };
        break;

      case 'assign':
        if (!body.testId || !body.participantId) {
          return NextResponse.json(
            { error: 'Missing testId or participantId for assign action' },
            { status: 400 }
          );
        }

        const { data: testData } = await supabase
          .from('ab_tests')
          .select('variants')
          .eq('id', body.testId)
          .single();

        if (!testData) {
          return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        const totalWeight = testData.variants.reduce((sum: number, v: any) => sum + v.weight, 0);
        let random = Math.random() * totalWeight;
        let assignedVariant = testData.variants[0];
        
        for (const variant of testData.variants) {
          random -= variant.weight;
          if (random <= 0) {
            assignedVariant = variant;
            break;
          }
        }

        await supabase.from('ab_test_participants').insert({
          test_id: body.testId,
          participant_id: body.participantId,
          variant: assignedVariant.name,
        });

        result = { variant: assignedVariant };
        break;

      case 'record':
        if (!body.testId || !body.participantId || !body.eventType) {
          return NextResponse.json(
            { error: 'Missing required fields for record action' },
            { status: 400 }
          );
        }

        await supabase.from('ab_test_events').insert({
          test_id: body.testId,
          participant_id: body.participantId,
          event_type: body.eventType,
          event_data: body.eventData,
        });

        result = { recorded: true };
        break;

      case 'analyze':
        if (!body.testId) {
          return NextResponse.json(
            { error: 'Missing testId for analyze action' },
            { status: 400 }
          );
        }

        const { data: events } = await supabase
          .from('ab_test_events')
          .select('*, ab_test_participants(variant)')
          .eq('test_id', body.testId);

        const analysis = {
          totalParticipants: events?.length || 0,
          byVariant: {},
          conversions: {},
        };

        result = { analysis };
        break;
    }

    // Deduct credits
    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    // Log usage
    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      endpoint: '/api/advanced/ab-test',
      credits_used: CREDIT_COST,
      metadata: { action },
    });

    return NextResponse.json({
      success: true,
      ...result,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    console.error('A/B Test error:', error);
    return NextResponse.json(
      { error: 'A/B test operation failed', details: error.message },
      { status: 500 }
    );
  }
}
