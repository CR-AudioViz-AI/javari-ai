/**
 * Javari AI Chat API Route - WITH PROPER SYSTEM PROMPT IMPORT
 * Now ACTUALLY uses the enhanced system prompt with Roy & Cindy context
 * 
 * @route /api/javari/chat
 * @version 2.0.0 - SOUL UPDATE: Actually imports enhanced system prompt
 * @last-updated 2025-10-27
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt'; // ✅ IMPORT THE REAL PROMPT!

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  projectId?: string;
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  parentId?: string; // For conversation continuations
}

/**
 * POST /api/javari/chat
 * Main chat endpoint with streaming support and conversation saving
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, history = [], projectId, sessionId, userId, conversationId, parentId } = body;

    // Validate request
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'AI service is not properly configured' },
        { status: 500 }
      );
    }

    // ✅ USE THE ENHANCED SYSTEM PROMPT WITH ROY & CINDY CONTEXT
    // Add dynamic context to the base system prompt
    const contextualSystemPrompt = `${JAVARI_SYSTEM_PROMPT}

## CURRENT CONVERSATION CONTEXT
${projectId ? `Project ID: ${projectId}` : 'No specific project context'}
${sessionId ? `Session ID: ${sessionId}` : 'New session'}
${conversationId ? `Conversation ID: ${conversationId}` : parentId ? 'This is a continuation of a previous conversation' : 'This is a new conversation'}
${userId ? `User ID: ${userId}` : 'User: demo-user'}

Remember: You know Roy and Cindy Henderson. You understand the CR AudioViz AI mission. Respond as their partner, not a generic AI.`;

    // Build messages array for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: contextualSystemPrompt },
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    let fullResponse = '';
    let newConversationId = conversationId;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create streaming request to OpenAI
          const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.7,
          });

          // Stream the response chunks
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
            }
          }

          // Save to database after streaming completes
          if (userId) {
            try {
              const updatedMessages = [
                ...history,
                { role: 'user' as const, content: message, timestamp: new Date().toISOString() },
                { role: 'assistant' as const, content: fullResponse, timestamp: new Date().toISOString() }
              ];

              if (conversationId) {
                // Update existing conversation
                await supabase
                  .from('conversations')
                  .update({
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', conversationId);
              } else {
                // Calculate continuation depth if has parent
                let continuationDepth = 0;
                if (parentId) {
                  const { data: parent } = await supabase
                    .from('conversations')
                    .select('continuation_depth')
                    .eq('id', parentId)
                    .single();

                  if (parent) {
                    continuationDepth = parent.continuation_depth + 1;
                  }
                }

                // Create new conversation
                const title = message.slice(0, 100); // First 100 chars as title
                const { data } = await supabase
                  .from('conversations')
                  .insert({
                    user_id: userId,
                    project_id: projectId,
                    parent_id: parentId || null,
                    title,
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    model: 'gpt-4-turbo-preview',
                    status: 'active',
                    starred: false,
                    continuation_depth: continuationDepth,
                  })
                  .select()
                  .single();

                if (data) {
                  newConversationId = data.id;
                }
              }
            } catch (dbError) {
              console.error('Error saving conversation:', dbError);
              // Don't fail the request if DB save fails
            }
          }

          // Send completion signal with conversation ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                done: true, 
                conversationId: newConversationId 
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Javari chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'An error occurred while processing your request',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
