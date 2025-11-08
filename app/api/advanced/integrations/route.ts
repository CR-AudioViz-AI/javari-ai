import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data: integrations } = await supabase.from('integrations').select('*').eq('user_id', userId);

    return NextResponse.json({ success: true, integrations });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Fetch failed', details: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { service, action, config, data, userId } = await req.json();
    
    if (!service || !action || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single();
    if (!user || user.credits < 10) {
      return NextResponse.json({ error: 'Insufficient credits', required: 10 }, { status: 402 });
    }

    let result;
    switch (action) {
      case 'connect':
        await supabase.from('integrations').insert({
          user_id: userId,
          service,
          config,
          status: 'connected'
        });
        result = { connected: true };
        break;

      case 'test':
        result = { status: 'ok' };
        break;

      case 'sync':
        result = { synced: true };
        break;

      case 'webhook':
        result = { processed: true };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await supabase.from('users').update({ credits: user.credits - 10 }).eq('id', userId);

    return NextResponse.json({ success: true, result, creditsUsed: 10 });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Integration failed', details: getErrorMessage(error) }, { status: 500 });
  }
}
