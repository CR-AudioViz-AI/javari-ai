/**
 * Javari AI - Conversation Summary API
 * Generate context summaries for conversation continuations
 * 
 * @route /api/javari/conversations/summary
 * @version 1.0.0
 * @date October 27, 2025 - 3:15 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge';

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * POST /api/javari/conversations/summary
 * Generate a summary for a conversation (for continuation context)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Fetch conversation from database
    const { data: conversation, error: dbError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (dbError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Generate summary using OpenAI
    const messages = conversation.messages as Array<{ role: string; content: string }>;
    
    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Conversation has no messages' },
        { status: 400 }
      );
    }

    // Create a prompt for summarization
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that creates concise, informative summaries of conversations.
          
Your task:
- Summarize the main topics, decisions, and outcomes from the conversation
- Highlight key technical details, code snippets discussed, or solutions found
- Keep it under 200 words but include all important context
- Focus on what would be useful for continuing this conversation later
- Use bullet points for clarity

Format your summary as:
**Main Topics:**
- [list key topics]

**Key Decisions/Solutions:**
- [list important outcomes]

**Context for Continuation:**
- [relevant background info for next session]`
        },
        {
          role: 'user',
          content: `Please summarize this conversation:\n\n${conversationText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const summary = response.choices[0]?.message?.content || 'Summary generation failed';

    // Update conversation with summary
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ 
        summary,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating conversation with summary:', updateError);
      // Don't fail the request if update fails
    }

    return NextResponse.json({
      success: true,
      summary,
      conversationId
    });

  } catch (error: unknown) {
    logError('Summary generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to generate summary',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/conversations/summary
 * Get existing summary for a conversation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('id, title, summary, message_count')
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      summary: conversation.summary,
      message_count: conversation.message_count,
      hasSummary: !!conversation.summary
    });

  } catch (error: unknown) {
    logError('Get summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
