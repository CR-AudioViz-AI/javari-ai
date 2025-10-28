/**
 * JAVARI AI - INDIVIDUAL CONVERSATION API
 * Operations on specific conversations
 * 
 * Endpoints:
 * - GET    /api/conversations/[id] - Get conversation details
 * - PATCH  /api/conversations/[id] - Update conversation
 * - DELETE /api/conversations/[id] - Delete/archive conversation
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:53 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]
 * Get a specific conversation by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching conversation:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversation', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update a conversation
 * 
 * Body (all fields optional):
 * {
 *   title?: string
 *   summary?: string
 *   status?: 'active' | 'inactive' | 'archived'
 *   starred?: boolean
 *   project_id?: UUID
 *   subproject_id?: UUID
 *   model?: string
 *   tags?: string[]
 *   metadata?: object
 *   messages?: array (replace all messages)
 *   append_message?: object (add single message)
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const body = await request.json();

    // First, get current conversation
    const { data: current, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching conversation:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch conversation', details: fetchError.message },
        { status: 500 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Update fields if provided
    if (body.title !== undefined) updateData.title = body.title;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.starred !== undefined) updateData.starred = body.starred;
    if (body.project_id !== undefined) updateData.project_id = body.project_id;
    if (body.subproject_id !== undefined) updateData.subproject_id = body.subproject_id;
    if (body.model !== undefined) updateData.model = body.model;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // Handle messages
    if (body.messages !== undefined) {
      // Replace all messages
      updateData.messages = body.messages;
      updateData.message_count = Array.isArray(body.messages) ? body.messages.length : 0;
      updateData.last_message_at = new Date().toISOString();
    } else if (body.append_message) {
      // Append single message
      const currentMessages = current.messages || [];
      updateData.messages = [...currentMessages, body.append_message];
      updateData.message_count = updateData.messages.length;
      updateData.last_message_at = new Date().toISOString();
    }

    // Handle archiving
    if (body.status === 'archived' && !current.archived_at) {
      updateData.archived_at = new Date().toISOString();
    }

    const { data, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating conversation:', updateError);
      return NextResponse.json(
        { error: 'Failed to update conversation', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Conversation updated successfully',
    });
  } catch (error: any) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete or archive a conversation
 * 
 * Query Parameters:
 * - soft: true (archive) | false (hard delete)
 * 
 * Default is soft delete (archive)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const softDelete = searchParams.get('soft') !== 'false'; // Default to soft delete

    if (softDelete) {
      // Soft delete - archive the conversation
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

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Conversation not found' },
            { status: 404 }
          );
        }
        console.error('Error archiving conversation:', error);
        return NextResponse.json(
          { error: 'Failed to archive conversation', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Conversation archived successfully',
      });
    } else {
      // Hard delete - permanently remove
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Conversation not found' },
            { status: 404 }
          );
        }
        console.error('Error deleting conversation:', error);
        return NextResponse.json(
          { error: 'Failed to delete conversation', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Conversation permanently deleted',
      });
    }
  } catch (error: any) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
