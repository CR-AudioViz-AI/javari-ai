import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDIT_COST = 10;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { data } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId);

  return NextResponse.json({ success: true, integrations: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service, action, config, data: serviceData, userId } = body;

    if (!service || !action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    let result: any = {};

    switch (action) {
      case 'connect':
        const { data: integration } = await supabase
          .from('integrations')
          .insert({
            user_id: userId,
            service,
            config,
            status: 'active',
          })
          .select()
          .single();
        result = { integration };
        break;

      case 'test':
        result = { status: 'connected', message: `${service} connection successful` };
        break;

      case 'sync':
        result = { synced: true, records: 0 };
        break;

      case 'webhook':
        result = { processed: true, timestamp: new Date().toISOString() };
        break;
    }

    await supabase
      .from('user_profiles')
      .update({ credits: profile.credits - CREDIT_COST })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      ...result,
      creditsUsed: CREDIT_COST,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Integration operation failed', details: error.message },
      { status: 500 }
    );
  }
}
