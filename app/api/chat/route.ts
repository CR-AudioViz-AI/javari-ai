// app/api/chat/route.ts
// Javari Chat API - DELIVERS for every customer
// Timestamp: 2025-11-30 06:30 AM EST

import { NextRequest } from 'next/server';
import { deliver, streamDeliver, learnNow } from '@/lib/javari-complete';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, userId, conversationId, stream = true } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if we need to learn something first
    const lastMessage = messages[messages.length - 1]?.content || '';
    if (lastMessage.toLowerCase().includes("i don't know") || 
        lastMessage.toLowerCase().includes("learn about")) {
      const topic = lastMessage.replace(/learn about|i don't know/gi, '').trim();
      if (topic) {
        await learnNow(topic);
      }
    }

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamDeliver(messages, userId)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // Non-streaming response
      const result = await deliver(messages, userId, conversationId);
      
      return new Response(JSON.stringify({
        content: result.response,
        provider: result.provider,
        type: result.type
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ 
      error: 'Something went wrong. Please try again.',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Health check
export async function GET() {
  return new Response(JSON.stringify({ 
    status: 'ready',
    message: 'Javari is ready to deliver',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
