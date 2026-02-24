import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined } from '@/lib/typescript-helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await safeAsync(
    async () => {
      const { id } = params;
      
      if (!isDefined(id)) {
        return NextResponse.json(
          { success: false, error: 'ID required' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('starred')
        .eq('id', id)
        .single();

      if (error || !isDefined(data)) {
        return NextResponse.json(
          { success: false, error: 'Conversation not found' },
          { status: 404 }
        );
      }

      const newStarred = !data.starred;

      const { error: updateError } = await supabase
        .from('conversations')
        .update({ starred: newStarred })
        .eq('id', id);

      if (updateError) {
        handleError(updateError, { file: 'conversations/[id]/star/route.ts', function: 'PATCH' });
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        starred: newStarred,
      });
    },
    { file: 'conversations/[id]/star/route.ts', function: 'PATCH' },
    NextResponse.json(
      { success: false, error: 'Failed to toggle star' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { success: false, error: 'Unexpected error' },
    { status: 500 }
  );
}
