// app/api/javari/router/route.ts
import { NextRequest } from 'next/server';
import { getProvider, getProviderApiKey } from '@/lib/javari/providers';
import { runCouncil, mergeCouncilResults } from '@/lib/javari/council/engine';
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

        // SUPERMODE - Council
        if (mode === 'super') {
          const councilData: any[] = [];

          const results = await runCouncil(
            message,
            ['openai', 'groq', 'anthropic'],
            (provider, chunk) => {
              // Stream partial results from each provider
              sendEvent(controller, encoder, {
                type: 'council',
                data: { provider, chunk }
              });
            }
          );

          // Send council results
          sendEvent(controller, encoder, {
            type: 'council',
            data: results
          });

          // Merge and send final answer
          const finalResponse = mergeCouncilResults(results);

          sendEvent(controller, encoder, {
            type: 'final',
            data: {
              response: finalResponse,
              mode: 'super',
              councilResults: results
            }
          });

          controller.close();
          return;
        }

        // SINGLE MODE - One provider
        const providerName = requestedProvider || 'openai';
        
        let apiKey: string;
        try {
          apiKey = getProviderApiKey(providerName);
        } catch (error: any) {
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: `Provider ${providerName} not configured` }
          });
          controller.close();
          return;
        }

        const provider = getProvider(providerName, apiKey);

        try {
          let fullResponse = '';
          
          for await (const chunk of provider.generateStream(message)) {
            fullResponse += chunk;
            
            sendEvent(controller, encoder, {
              type: 'token',
              data: chunk
            });
          }

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
            data: { message: 'Stream error', details: streamError.message }
          });
        }

      } catch (error: any) {
        sendEvent(controller, encoder, {
          type: 'error',
          data: { message: 'Server error', details: error.message }
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
    version: '4.1B',
    providers: ['openai', 'anthropic', 'groq'],
    modes: ['single', 'super', 'advanced', 'roadmap'],
    timestamp: new Date().toISOString()
  });
}
