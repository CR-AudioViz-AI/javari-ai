export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAsync } from '@/lib/error-handler';
import { isDefined, toNumber, isArray } from '@/lib/typescript-helpers';

export async function GET(request: NextRequest) {
  return await safeAsync(
    async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !isDefined(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const limit = toNumber(searchParams.get('limit'), 50);

      const { data, error } = await supabase
        .from('javari_healing_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      const history = isArray(data) ? data : [];

      return NextResponse.json({ success: true, history, count: history.length });
    },
    { file: 'admin/javari/self-healing/history/route.ts', function: 'GET' },
    NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
