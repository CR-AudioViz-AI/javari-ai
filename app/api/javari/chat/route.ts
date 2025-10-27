/**
 * Javari AI Chat API Route - With Conversation Saving
 * Using GPT-4 with automatic conversation persistence
 * 
 * @route /api/javari/chat
 * @version 1.3.0 - Now saves to database
 * @last-updated 2025-10-27 2:42 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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
}

/**
 * POST /api/javari/chat
 * Main chat endpoint with streaming support and conversation saving
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, history = [], projectId, sessionId, userId, conversationId } = body;

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

    // System prompt for Javari
    const systemPrompt = `You are Javari AI, an autonomous AI assistant for CR AudioViz AI developers.

Your core abilities:
- Help developers build, debug, and deploy applications
- Provide code examples and solutions
- Explain technical concepts clearly
- Learn from interactions to improve over time
- Access project context and build health data

Your personality:
- Professional but friendly
- Direct and action-oriented
- Fortune 50 quality standards
- "Let's make it happen" attitude
- Partner mindset: "Your success is my success"

Always:
- Provide complete, working code solutions
- Be honest if you don't know something
- Suggest better approaches when relevant
- Focus on what actually works

Current context:
${projectId ? `Project ID: ${projectId}` : 'No project context'}
${sessionId ? `Session ID: ${sessionId}` : 'New session'}
${conversationId ? `Conversation ID: ${conversationId}` : 'New conversation'}`;

    // Build messages array for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\\n\\n`));
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
                // Create new conversation
                const title = message.slice(0, 100); // First 100 chars as title
                const { data } = await supabase
                  .from('conversations')
                  .insert({
                    user_id: userId,
                    project_id: projectId,
                    title,
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    model: 'gpt-4-turbo-preview',
                    status: 'active',
                    starred: false,
                    continuation_depth: 0,
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
              })}\\n\\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\\n\\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\\n\\n`)
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
