// app/api/javari/router/route.ts
import { NextRequest } from 'next/server';
import { getProvider, getProviderApiKey } from '@/lib/javari/providers';
import { RouterRequest, StreamEvent } from '@/lib/javari/router/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body: RouterRequest = await req.json();
        const { message, mode, provider: requestedProvider } = body;

        if (!message) {
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: 'Message required' }
          });
          controller.close();
          return;
        }

        // Determine provider
        const providerName = requestedProvider || 'openai';
        
        // Get API key from environment
        let apiKey: string;
        try {
          apiKey = getProviderApiKey(providerName);
        } catch (error: any) {
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: `Provider ${providerName} not configured`, details: error.message }
          });
          controller.close();
          return;
        }

        // Create provider instance
        const provider = getProvider(providerName, apiKey);

        // Stream response
        try {
          let fullResponse = '';
          
          for await (const chunk of provider.generateStream(message)) {
            fullResponse += chunk;
            
            sendEvent(controller, encoder, {
              type: 'token',
              data: chunk
            });
          }

          // Send final event
          sendEvent(controller, encoder, {
            type: 'final',
            data: {
              response: fullResponse,
              provider: providerName,
              model: provider.getModel(),
              mode
            }
          });

        } catch (streamError: any) {
          sendEvent(controller, encoder, {
            type: 'error',
            data: { 
              message: 'Stream error',
              details: streamError.message 
            }
          });
        }

      } catch (error: any) {
        sendEvent(controller, encoder, {
          type: 'error',
          data: { 
            message: 'Server error',
            details: error.message 
          }
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: StreamEvent
) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

export async function GET() {
  return Response.json({
    status: 'healthy',
    version: '4.1A',
    providers: ['openai', 'anthropic'],
    timestamp: new Date().toISOString()
  });
}
