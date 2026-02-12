// app/api/javari/router/route.ts
import { NextRequest } from 'next/server';
import { getProvider, getProviderApiKey } from '@/lib/javari/providers';
import { RouterRequest, StreamEvent } from '@/lib/javari/router/types';
import { preprocessPrompt } from '@/lib/javari/utils/preprocessPrompt';

export const runtime = 'edge';
export const maxDuration = 25;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body: RouterRequest = await req.json();
        let { message, mode, provider: requestedProvider } = body;

        if (!message) {
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: 'Message required' }
          });
          controller.close();
          return;
        }

        // CRITICAL: Preprocess prompt for ALL modes
        const preprocessed = preprocessPrompt(message);
        message = preprocessed.rewrittenPrompt;
        
        console.log('[Router] Preprocessed:', {
          original: body.message.substring(0, 50),
          rewritten: message.substring(0, 50),
          model: preprocessed.modelToUse,
          nounTrigger: preprocessed.nounTrigger,
          mode
        });

        // All modes use single AI with preprocessed model
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

        // Pass preprocessed model selection to provider
        const options = {
          preferredModel: preprocessed.modelToUse
        };

        try {
          let fullResponse = '';
          
          for await (const chunk of provider.generateStream(message, options)) {
            fullResponse += chunk;
            sendEvent(controller, encoder, { type: 'token', data: chunk });
          }

          sendEvent(controller, encoder, {
            type: 'final',
            data: { 
              response: fullResponse, 
              provider: providerName, 
              model: preprocessed.modelToUse, 
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
    version: '5.1-SIMPLIFIED-WORKING',
    modes: ['single', 'super', 'advanced', 'roadmap'],
    note: 'All modes use preprocessPrompt with noun-based fallback (gpt-4o-mini)',
    timestamp: new Date().toISOString()
  });
}
