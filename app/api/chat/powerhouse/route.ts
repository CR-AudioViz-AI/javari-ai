/**
 * POWERHOUSE CHAT API ROUTE
 * 
 * Phase Ω-X: EGRESS SANITIZATION INTEGRATED
 * 
 * Multi-model routing with automatic secret detection.
 * Supports OpenAI, Anthropic, Google Gemini, and OpenRouter.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { safeModelEgress, EgressSecurityError } from '@/orchestrator/security/safeRespond';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      messages, 
      provider = 'openai', 
      model, 
      stream = true,
      temperature = 0.7 
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }

    // Route to appropriate provider
    switch (provider) {
      case 'anthropic':
        return handleAnthropicPowerhouse(messages, model, stream, temperature);
      case 'openrouter':
        return handleOpenRouterPowerhouse(messages, model, stream, temperature);
      case 'openai':
      default:
        return handleOpenAIPowerhouse(messages, model, stream, temperature);
    }
  } catch (error) {
    console.error('Powerhouse API error:', error);
    
    if (error instanceof EgressSecurityError) {
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
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleOpenAIPowerhouse(
  messages: any[],
  model: string = 'gpt-4-turbo',
  stream: boolean,
  temperature: number
) {
  if (!stream) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // ✅ CRITICAL: Sanitize before return
    const sanitized = safeModelEgress(content, 'ai');

    return NextResponse.json({
      content: sanitized,
      model: response.model,
      provider: 'openai',
    });
  }

  // Streaming
  const streamResponse = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: 4000,
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
            
            // ✅ CRITICAL: Sanitize chunks
            const sanitized = safeModelEgress(content, 'ai');
            
            const data = `data: ${JSON.stringify({ text: sanitized })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }

        // ✅ Final check
        safeModelEgress(fullResponse, 'ai');
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        if (error instanceof EgressSecurityError) {
          console.error('[POWERHOUSE EGRESS BLOCKED]', error.detectedThreats);
          controller.error(error);
        } else {
          controller.error(error);
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function handleAnthropicPowerhouse(
  messages: any[],
  model: string = 'claude-3-5-sonnet-20241022',
  stream: boolean,
  temperature: number
) {
  const systemMessage = messages.find((m: any) => m.role === 'system');
  const userMessages = messages.filter((m: any) => m.role !== 'system');

  if (!stream) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: userMessages,
      temperature,
    });

    const content = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : '';
    
    // ✅ CRITICAL: Sanitize
    const sanitized = safeModelEgress(content, 'ai');

    return NextResponse.json({
      content: sanitized,
      model: response.model,
      provider: 'anthropic',
    });
  }

  // Streaming
  const streamResponse = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemMessage?.content,
    messages: userMessages,
    temperature,
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
            
            // ✅ CRITICAL: Sanitize
            const sanitized = safeModelEgress(content, 'ai');
            
            const data = `data: ${JSON.stringify({ text: sanitized })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }

        // ✅ Final check
        safeModelEgress(fullResponse, 'ai');
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        if (error instanceof EgressSecurityError) {
          console.error('[ANTHROPIC POWERHOUSE BLOCKED]', error.detectedThreats);
          controller.error(error);
        } else {
          controller.error(error);
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function handleOpenRouterPowerhouse(
  messages: any[],
  model: string,
  stream: boolean,
  temperature: number
) {
  if (!stream) {
    const response = await openrouter.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // ✅ CRITICAL: Sanitize
    const sanitized = safeModelEgress(content, 'ai');

    return NextResponse.json({
      content: sanitized,
      model: response.model,
      provider: 'openrouter',
    });
  }

  // Streaming
  const streamResponse = await openrouter.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: 4000,
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
            
            // ✅ CRITICAL: Sanitize
            const sanitized = safeModelEgress(content, 'ai');
            
            const data = `data: ${JSON.stringify({ text: sanitized })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }

        // ✅ Final check
        safeModelEgress(fullResponse, 'ai');
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        if (error instanceof EgressSecurityError) {
          console.error('[OPENROUTER POWERHOUSE BLOCKED]', error.detectedThreats);
          controller.error(error);
        } else {
          controller.error(error);
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
