import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, isArray, toNumber, safeGet } from '@/lib/typescript-helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UpdateBody {
  title?: string;
  summary?: string;
  messages?: any[];
  starred?: boolean;
  status?: string;
  projectId?: string;
  subprojectId?: string;
  metadata?: Record<string, any>;
  totalTokens?: number;
  costUsd?: number;
}

// GET /api/conversations/[id]
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

      if (error) {
        handleError(error, { file: 'conversations/[id]/route.ts', function: 'GET' });
        throw error;
      }

      if (!isDefined(data)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, conversation: data });
    },
    { file: 'conversations/[id]/route.ts', function: 'GET' },
    NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}

// PATCH /api/conversations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await safeAsync(
    async () => {
      const { id } = params;
      if (!isDefined(id)) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
      }

      const body = await request.json() as UpdateBody;

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (isDefined(body.title)) updates.title = body.title;
      if (isDefined(body.summary)) updates.summary = body.summary;
      if (isDefined(body.messages) && isArray(body.messages)) {
        updates.messages = JSON.stringify(body.messages);
        updates.message_count = body.messages.length;
        updates.last_message_at = new Date().toISOString();
      }
      if (isDefined(body.starred)) updates.starred = body.starred;
      if (isDefined(body.status)) {
        updates.status = body.status;
        if (body.status === 'archived') {
          updates.archived_at = new Date().toISOString();
        }
      }
      if (isDefined(body.projectId)) updates.project_id = body.projectId;
      if (isDefined(body.subprojectId)) updates.subproject_id = body.subprojectId;
      if (isDefined(body.metadata)) updates.metadata = JSON.stringify(body.metadata);
      if (isDefined(body.totalTokens)) updates.total_tokens = toNumber(body.totalTokens, 0);
      if (isDefined(body.costUsd)) updates.cost_usd = toNumber(body.costUsd, 0);

      const { data, error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        handleError(error, { file: 'conversations/[id]/route.ts', function: 'PATCH' });
        throw error;
      }

      return NextResponse.json({ success: true, conversation: data });
    },
    { file: 'conversations/[id]/route.ts', function: 'PATCH' },
    NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}

// DELETE /api/conversations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await safeAsync(
    async () => {
      const { id } = params;
      if (!isDefined(id)) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
      }

      const { searchParams } = new URL(request.url);
      const hard = searchParams.get('hard') === 'true';

      if (hard) {
        const { error } = await supabase
          .from('conversations')
          .delete()
          .eq('id', id);

        if (error) {
          handleError(error, { file: 'conversations/[id]/route.ts', function: 'DELETE' });
          throw error;
        }

        return NextResponse.json({ success: true, deleted: true, hard: true });
      } else {
        const { data, error } = await supabase
          .from('conversations')
          .update({
            status: 'archived',
            archived_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          handleError(error, { file: 'conversations/[id]/route.ts', function: 'DELETE' });
          throw error;
        }

        return NextResponse.json({ success: true, deleted: false, conversation: data });
      }
    },
    { file: 'conversations/[id]/route.ts', function: 'DELETE' },
    NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
