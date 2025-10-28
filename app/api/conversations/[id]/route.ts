/**
 * Individual Conversation API
 * GET: Get conversation by ID
 * PATCH: Update conversation
 * DELETE: Delete/Archive conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/conversations/[id] - Get single conversation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation: data,
    });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/conversations/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      title,
      summary,
      messages,
      starred,
      status,
      projectId,
      subprojectId,
      metadata,
      totalTokens,
      costUsd,
    } = body;

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (messages !== undefined) {
      updates.messages = JSON.stringify(messages);
      updates.message_count = messages.length;
      updates.last_message_at = new Date().toISOString();
    }
    if (starred !== undefined) updates.starred = starred;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'archived') {
        updates.archived_at = new Date().toISOString();
      }
    }
    if (projectId !== undefined) updates.project_id = projectId;
    if (subprojectId !== undefined) updates.subproject_id = subprojectId;
    if (metadata !== undefined) updates.metadata = JSON.stringify(metadata);
    if (totalTokens !== undefined) updates.total_tokens = totalTokens;
    if (costUsd !== undefined) updates.cost_usd = costUsd;

    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversation: data,
    });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id] - Archive conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Permanent deletion
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Conversation permanently deleted',
      });
    } else {
      // Soft delete (archive)
      const { data, error } = await supabase
        .from('conversations')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Conversation archived',
        conversation: data,
      });
    }
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
