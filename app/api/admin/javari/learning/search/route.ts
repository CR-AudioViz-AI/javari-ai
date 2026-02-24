export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAsync } from '@/lib/error-handler';
import { isDefined, toString, toNumber, isArray } from '@/lib/typescript-helpers';

export async function GET(request: NextRequest) {
  return await safeAsync(
    async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !isDefined(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const query = toString(searchParams.get('q'), '');
      const limit = toNumber(searchParams.get('limit'), 20);

      if (query.length < 2) {
        return NextResponse.json({ error: 'Query too short' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('javari_self_answers')
        .select('*')
        .ilike('question', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      const results = isArray(data) ? data : [];

      return NextResponse.json({ success: true, results, count: results.length });
    },
    { file: 'admin/javari/learning/search/route.ts', function: 'GET' },
    NextResponse.json({ error: 'Search failed' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
