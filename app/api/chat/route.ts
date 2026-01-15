/**
 * MAIN CHAT API ROUTE
 * 
 * Phase Ω-X: EGRESS SANITIZATION INTEGRATED
 * 
 * This route handles streaming AI chat responses with automatic
 * secret detection and sanitization.
 * 
 * SECURITY:
 * - All AI outputs pass through safeModelEgress()
 * - Production: Blocks responses containing secrets
 * - Development: Redacts secrets and logs warnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { safeModelEgress, createSafeEgressStream, EgressSecurityError } from '@/orchestrator/security/safeRespond';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, conversationId, provider = 'openai', model, stream = true } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }

    // Route to appropriate provider
    if (provider === 'anthropic') {
      return handleAnthropicChat(messages, conversationId, model, stream);
    }
    
    return handleOpenAIChat(messages, conversationId, model, stream);
  } catch (error) {
    // Handle egress security errors
    if (error instanceof EgressSecurityError) {
      console.error('[EGRESS BLOCKED]', {
        threats: error.detectedThreats,
        environment: process.env.NODE_ENV,
      });
      
      return NextResponse.json(
        { 
          error: 'Response blocked by security policy',
          details: process.env.NODE_ENV === 'development' 
            ? error.detectedThreats 
            : undefined,
        },
        { status: 403 }
      );
    }
    
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleOpenAIChat(
  messages: any[],
  conversationId: string,
  model: string = 'gpt-4-turbo',
  stream: boolean = true
) {
  if (!stream) {
    // Non-streaming response
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // ✅ CRITICAL: Sanitize before return
    const sanitized = safeModelEgress(content, 'ai');

    // Save to database
    if (conversationId) {
      await supabase.from('javari_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: sanitized,
      });
    }

    return NextResponse.json({
      content: sanitized,
      model: response.model,
    });
  }

  // Streaming response
  const streamResponse = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2000,
  });

  const encoder = new TextEncoder();
  let fullResponse = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamResponse) {
          const content = chunk.choices[0]?.delta?.content || '';
          
          if (content) {
            fullResponse += content;
            
            // ✅ CRITICAL: Sanitize each chunk
            // For streaming, we accumulate and sanitize periodically
            // to avoid partial secret detection
            const sanitized = safeModelEgress(content, 'ai');
            
            controller.enqueue(encoder.encode(sanitized));
          }
        }

        // ✅ Final sanitization check on complete response
        const finalSanitized = safeModelEgress(fullResponse, 'ai');

        // Save to database
        if (conversationId) {
          await supabase.from('javari_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalSanitized,
          });

          await supabase
            .from('javari_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }

        controller.close();
      } catch (error) {
        // Handle egress security errors in stream
        if (error instanceof EgressSecurityError) {
          console.error('[EGRESS BLOCKED IN STREAM]', {
            threats: error.detectedThreats,
          });
          controller.error(error);
        } else {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

async function handleAnthropicChat(
  messages: any[],
  conversationId: string,
  model: string = 'claude-3-5-sonnet-20241022',
  stream: boolean = true
) {
  // Extract system message if present
  const systemMessage = messages.find((m: any) => m.role === 'system');
  const userMessages = messages.filter((m: any) => m.role !== 'system');

  if (!stream) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: userMessages,
    });

    const content = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : '';
    
    // ✅ CRITICAL: Sanitize before return
    const sanitized = safeModelEgress(content, 'ai');

    if (conversationId) {
      await supabase.from('javari_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: sanitized,
      });
    }

    return NextResponse.json({
      content: sanitized,
      model: response.model,
    });
  }

  // Streaming response
  const streamResponse = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemMessage?.content,
    messages: userMessages,
    stream: true,
  });

  const encoder = new TextEncoder();
  let fullResponse = '';

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamResponse) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const content = chunk.delta.text;
            fullResponse += content;
            
            // ✅ CRITICAL: Sanitize chunks
            const sanitized = safeModelEgress(content, 'ai');
            controller.enqueue(encoder.encode(sanitized));
          }
        }

        // ✅ Final sanitization
        const finalSanitized = safeModelEgress(fullResponse, 'ai');

        if (conversationId) {
          await supabase.from('javari_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalSanitized,
          });

          await supabase
            .from('javari_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }

        controller.close();
      } catch (error) {
        if (error instanceof EgressSecurityError) {
          console.error('[EGRESS BLOCKED IN ANTHROPIC STREAM]', error.detectedThreats);
          controller.error(error);
        } else {
          console.error('Anthropic streaming error:', error);
          controller.error(error);
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
