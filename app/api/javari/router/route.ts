// app/api/javari/router/route.ts
// FIXED: Better error handling, extended timeout, improved logging
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
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      try {
        const body: RouterRequest = await req.json();
        let { message, mode, provider: requestedProvider } = body;

        console.log(`[Router:${requestId}] Request received:`, { 
          mode, 
          provider: requestedProvider || 'openai',
          messageLength: message?.length 
        });

        if (!message) {
          console.error(`[Router:${requestId}] No message provided`);
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: 'Message required' }
          });
          controller.close();
          return;
        }

        // Preprocess prompt for ALL modes
        const preprocessed = preprocessPrompt(message);
        message = preprocessed.rewrittenPrompt;
        
        console.log(`[Router:${requestId}] Preprocessed:`, {
          originalLength: body.message.length,
          rewrittenLength: message.length,
          model: preprocessed.modelToUse,
          nounTrigger: preprocessed.nounTrigger,
          mode
        });

        // Determine provider
        const providerName = requestedProvider || 'openai';
        
        // Get API key
        let apiKey: string;
        try {
          console.log(`[Router:${requestId}] Getting API key for ${providerName}...`);
          apiKey = getProviderApiKey(providerName);
          console.log(`[Router:${requestId}] API key retrieved: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
        } catch (error: any) {
          console.error(`[Router:${requestId}] API key error:`, {
            provider: providerName,
            error: error.message,
            stack: error.stack
          });
          sendEvent(controller, encoder, {
            type: 'error',
            data: { 
              message: `Provider ${providerName} not configured`, 
              details: error.message,
              requestId
            }
          });
          controller.close();
          return;
        }

        // Create provider instance
        console.log(`[Router:${requestId}] Creating ${providerName} provider...`);
        let provider;
        try {
          provider = getProvider(providerName, apiKey);
          console.log(`[Router:${requestId}] Provider created successfully`);
        } catch (error: any) {
          console.error(`[Router:${requestId}] Provider creation error:`, {
            provider: providerName,
            error: error.message,
            stack: error.stack
          });
          sendEvent(controller, encoder, {
            type: 'error',
            data: { 
              message: `Failed to create ${providerName} provider`, 
              details: error.message,
              requestId
            }
          });
          controller.close();
          return;
        }

        // Configure provider options
        const options = {
          preferredModel: preprocessed.modelToUse
        };

        console.log(`[Router:${requestId}] Starting stream:`, {
          provider: providerName,
          model: options.preferredModel,
          mode
        });

        try {
          let fullResponse = '';
          let chunkCount = 0;
          const streamStartTime = Date.now();
          
          for await (const chunk of provider.generateStream(message, options)) {
            fullResponse += chunk;
            chunkCount++;
            sendEvent(controller, encoder, { type: 'token', data: chunk });
            
            // Log progress every 50 chunks
            if (chunkCount % 50 === 0) {
              console.log(`[Router:${requestId}] Progress: ${chunkCount} chunks, ${fullResponse.length} chars`);
            }
          }

          const streamDuration = Date.now() - streamStartTime;
          console.log(`[Router:${requestId}] Stream complete:`, {
            chunks: chunkCount,
            chars: fullResponse.length,
            duration: `${streamDuration}ms`,
            provider: providerName,
            model: preprocessed.modelToUse
          });

          sendEvent(controller, encoder, {
            type: 'final',
            data: { 
              response: fullResponse, 
              provider: providerName, 
              model: preprocessed.modelToUse, 
              mode,
              metadata: {
                chunks: chunkCount,
                duration: streamDuration,
                requestId
              }
            }
          });

        } catch (streamError: any) {
          console.error(`[Router:${requestId}] Stream error:`, {
            error: streamError.message,
            stack: streamError.stack,
            name: streamError.name,
            provider: providerName,
            model: preprocessed.modelToUse
          });
          
          sendEvent(controller, encoder, {
            type: 'error',
            data: { 
              message: 'Stream generation failed', 
              details: streamError.message,
              errorType: streamError.name,
              provider: providerName,
              requestId
            }
          });
        }

      } catch (error: any) {
        console.error(`[Router:${requestId}] Fatal error:`, {
          error: error.message,
          stack: error.stack,
          name: error.name
        });
        
        sendEvent(controller, encoder, {
          type: 'error',
          data: { 
            message: 'Router error', 
            details: error.message,
            errorType: error.name,
            requestId
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
  try {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    controller.enqueue(encoder.encode(data));
  } catch (error: any) {
    console.error('[Router] Failed to send event:', {
      error: error.message,
      eventType: event.type
    });
  }
}

export async function GET() {
  return Response.json({
    status: 'healthy',
    version: '6.0-FIXED-TIMEOUT-ERROR-HANDLING',
    modes: ['single', 'super', 'advanced', 'roadmap'],
    fixes: [
      'Extended provider timeout to 20s',
      'Added request ID tracking',
      'Improved error logging',
      'Better provider error handling',
      'Stream progress monitoring'
    ],
    timestamp: new Date().toISOString()
  });
}
