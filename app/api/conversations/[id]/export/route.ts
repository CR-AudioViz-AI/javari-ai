/**
 * Conversation Export API
 * GET: Export conversation as JSON or Markdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json or markdown

    // Fetch conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Parse messages
    const messages = typeof conversation.messages === 'string' 
      ? JSON.parse(conversation.messages) 
      : conversation.messages;

    if (format === 'markdown') {
      // Export as Markdown
      let markdown = `# ${conversation.title}\n\n`;
      markdown += `**Created:** ${new Date(conversation.created_at).toLocaleString()}\n`;
      markdown += `**Updated:** ${new Date(conversation.updated_at).toLocaleString()}\n`;
      markdown += `**Messages:** ${conversation.message_count}\n`;
      markdown += `**Model:** ${conversation.model}\n\n`;

      if (conversation.summary) {
        markdown += `## Summary\n${conversation.summary}\n\n`;
      }

      markdown += `## Conversation\n\n`;

      messages.forEach((msg: any) => {
        const role = msg.role === 'user' ? '**You**' : '**Javari**';
        markdown += `### ${role}\n${msg.content}\n\n---\n\n`;
      });

      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="conversation-${conversation.numeric_id}.md"`,
        },
      });
    } else {
      // Export as JSON
      const exportData = {
        id: conversation.id,
        numeric_id: conversation.numeric_id,
        title: conversation.title,
        summary: conversation.summary,
        messages,
        model: conversation.model,
        message_count: conversation.message_count,
        total_tokens: conversation.total_tokens,
        cost_usd: conversation.cost_usd,
        continuation_depth: conversation.continuation_depth,
        starred: conversation.starred,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        metadata: conversation.metadata,
      };

      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="conversation-${conversation.numeric_id}.json"`,
        },
      });
    }
  } catch (error: any) {
    console.error('Error exporting conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
