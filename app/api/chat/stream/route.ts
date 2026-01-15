/**
 * STREAMING CHAT API ROUTE
 * 
 * Phase Ω-X: EGRESS SANITIZATION INTEGRATED
 * 
 * Dedicated streaming endpoint with automatic secret detection
 * and sanitization for all AI responses.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { safeModelEgress, EgressSecurityError } from '@/orchestrator/security/safeRespond';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model = 'gpt-4-turbo', temperature = 0.7 } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      temperature,
      max_tokens: 2000,
    });

    const encoder = new TextEncoder();
    let accumulatedContent = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            
            if (content) {
              accumulatedContent += content;
              
              // ✅ CRITICAL: Sanitize each chunk
              try {
                const sanitized = safeModelEgress(content, 'ai');
                
                // Send as SSE format
                const data = `data: ${JSON.stringify({ text: sanitized })}\n\n`;
                controller.enqueue(encoder.encode(data));
              } catch (error) {
                if (error instanceof EgressSecurityError) {
                  // Block stream on security violation
                  const errorData = `data: ${JSON.stringify({ 
                    error: 'Response blocked by security policy',
                    threats: error.detectedThreats,
                  })}\n\n`;
                  controller.enqueue(encoder.encode(errorData));
                  controller.close();
                  return;
                }
                throw error;
              }
            }
          }

          // ✅ Final check on complete content
          safeModelEgress(accumulatedContent, 'ai');
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          
          if (error instanceof EgressSecurityError) {
            const errorData = `data: ${JSON.stringify({ 
              error: 'Security violation detected',
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
          }
          
          controller.error(error);
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
  } catch (error) {
    console.error('Stream API error:', error);
    
    if (error instanceof EgressSecurityError) {
      return new Response(
        JSON.stringify({ 
          error: 'Response blocked by security policy',
          details: process.env.NODE_ENV === 'development' 
            ? error.detectedThreats 
            : undefined,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
