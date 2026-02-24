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

        console.log(`[Router] Request received - Mode: ${mode}, Provider: ${requestedProvider || 'openai'}`);

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
          console.log(`[Router] Getting API key for ${providerName}...`);
          apiKey = getProviderApiKey(providerName);
          console.log(`[Router] API key retrieved: ${apiKey.substring(0, 10)}...`);
        } catch (error: any) {
          console.error(`[Router] API key error for ${providerName}:`, error.message);
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: `Provider ${providerName} not configured: ${error.message}` }
          });
          controller.close();
          return;
        }

        console.log(`[Router] Creating ${providerName} provider...`);
        const provider = getProvider(providerName, apiKey);
        console.log(`[Router] Provider created successfully`);

        // Pass preprocessed model selection to provider
        const options = {
          preferredModel: preprocessed.modelToUse
        };

        console.log(`[Router] Starting stream with model: ${options.preferredModel}`);

        try {
          let fullResponse = '';
          let chunkCount = 0;
          
          for await (const chunk of provider.generateStream(message, options)) {
            fullResponse += chunk;
            chunkCount++;
            sendEvent(controller, encoder, { type: 'token', data: chunk });
          }

          console.log(`[Router] Stream complete - ${chunkCount} chunks, ${fullResponse.length} chars`);

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
          console.error('[Router] Stream error:', {
            error: streamError.message,
            stack: streamError.stack,
            name: streamError.name
          });
          sendEvent(controller, encoder, {
            type: 'error',
            data: { 
              message: 'Stream error', 
              details: streamError.message,
              errorType: streamError.name
            }
          });
        }

      } catch (error: any) {
        console.error('[Router] Fatal error:', {
          error: error.message,
          stack: error.stack,
          name: error.name
        });
        sendEvent(controller, encoder, {
          type: 'error',
          data: { 
            message: 'Server error', 
            details: error.message,
            errorType: error.name
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
    version: '5.2-DEBUG-LOGGING',
    modes: ['single', 'super', 'advanced', 'roadmap'],
    note: 'Extensive error logging enabled',
    timestamp: new Date().toISOString()
  });
}
