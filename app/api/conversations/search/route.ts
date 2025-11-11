import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, toString, toNumber, isArray } from '@/lib/typescript-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  return await safeAsync(
    async () => {
      const { searchParams } = new URL(request.url);
      
      const userId = toString(searchParams.get('userId'), 'default-user');
      const query = searchParams.get('q');
      const limit = toNumber(searchParams.get('limit'), 20);

      if (!isDefined(query) || query.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Search query must be at least 2 characters' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('id, numeric_id, title, summary, message_count, starred, created_at, updated_at, continuation_depth')
        .eq('user_id', userId)
        .eq('status', 'active')
        .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        handleError(error, { file: 'conversations/search/route.ts', function: 'GET' });
        throw error;
      }

      const results = isArray(data) ? data : [];

      return NextResponse.json({
        success: true,
        query,
        results,
        count: results.length,
      });
    },
    { file: 'conversations/search/route.ts', function: 'GET' },
    NextResponse.json(
      { success: false, error: 'Failed to search conversations' },
      { status: 500 }
    )
  );
}
