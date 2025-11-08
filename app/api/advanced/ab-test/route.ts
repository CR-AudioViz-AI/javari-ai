import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { action, userId, testId, testName, variants, participantId, eventType, eventData } = await req.json();
    
    if (!action || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 10) {
      return NextResponse.json({ error: 'Insufficient credits', required: 10 }, { status: 402 });
    }

    let result;
    switch (action) {
      case 'create':
        const { data: test } = await supabase.from('ab_tests').insert({
          user_id: userId,
          name: testName,
          variants: variants
        }).select().single();
        result = { test };
        break;

      case 'assign':
        const variant = variants[Math.floor(Math.random() * variants.length)];
        await supabase.from('ab_participants').insert({
          test_id: testId,
          participant_id: participantId,
          variant_name: variant.name
        });
        result = { variant };
        break;

      case 'record':
        await supabase.from('ab_events').insert({
          test_id: testId,
          participant_id: participantId,
          event_type: eventType,
          event_data: eventData
        });
        result = { recorded: true };
        break;

      case 'analyze':
        const { data: events } = await supabase.from('ab_events').select('*').eq('test_id', testId);
        result = { analysis: events };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await supabase.from('users').update({ credits: user.credits - 10 }).eq('id', userId);

    return NextResponse.json({ success: true, result, creditsUsed: 10 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'A/B test failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
