import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, safeGet } from '@/lib/typescript-helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await safeAsync(
    async () => {
      const { id } = params;
      
      if (!isDefined(id)) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !isDefined(data)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const exportData = {
        id: data.id,
        title: safeGet(data, 'title', ''),
        created_at: safeGet(data, 'created_at', ''),
        messages: safeGet(data, 'messages', []),
        model: safeGet(data, 'model', ''),
        total_tokens: safeGet(data, 'total_tokens', 0),
        cost_usd: safeGet(data, 'cost_usd', 0)
      };

      const filename = `conversation-${id}-${new Date().toISOString().split('T')[0]}.json`;

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    },
    { file: 'conversations/[id]/export/route.ts', function: 'GET' },
    NextResponse.json({ error: 'Export failed' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
