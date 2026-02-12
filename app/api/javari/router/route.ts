// app/api/javari/router/route.ts
import { NextRequest } from 'next/server';
import { getProvider, getProviderApiKey } from '@/lib/javari/providers';
import { RouterRequest, StreamEvent } from '@/lib/javari/router/types';
import { preprocessPrompt } from '@/lib/javari/utils/preprocessPrompt';
import { runCouncil } from '@/lib/javari/council/engine';
import { mergeCouncilResults } from '@/lib/javari/council/merge';
import { generateRoadmap } from '@/lib/javari/roadmap/engine';

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

        // ROADMAP MODE
        if (mode === 'roadmap') {
          try {
            const roadmap = await generateRoadmap(
              { goal: message },
              (chunk) => {
                sendEvent(controller, encoder, {
                  type: 'token',
                  data: chunk
                });
              }
            );

            sendEvent(controller, encoder, {
              type: 'final',
              data: {
                response: roadmap.summary,
                mode: 'roadmap',
                roadmap: roadmap
              }
            });

          } catch (roadmapError: any) {
            sendEvent(controller, encoder, {
              type: 'error',
              data: { message: 'Roadmap generation failed', details: roadmapError.message }
            });
          }

          controller.close();
          return;
        }

        // SUPER MODE or ADVANCED MODE - Use Council
        if (mode === 'super' || mode === 'advanced') {
          try {
            console.log(`[${mode.toUpperCase()}] Starting council...`);
            
            const councilResults = await runCouncil(
              message, // Already preprocessed
              (provider, chunk, partial) => {
                sendEvent(controller, encoder, {
                  type: 'council',
                  data: { provider, chunk, partial: partial.substring(0, 100) + '...' }
                });
              },
              (result) => {
                sendEvent(controller, encoder, {
                  type: 'council',
                  data: {
                    provider: result.provider,
                    complete: true,
                    confidence: result.confidence,
                    latency: result.latency,
                    error: result.error
                  }
                });
              }
            );

            console.log(`[${mode.toUpperCase()}] Council completed`);

            const merged = mergeCouncilResults(councilResults.results);
            
            sendEvent(controller, encoder, {
              type: 'council',
              data: { phase: 'merge', ...councilResults.metadata, merged: true }
            });

            sendEvent(controller, encoder, {
              type: 'final',
              data: {
                response: merged.finalText,
                mode,
                reasoning: merged.reasoning,
                metadata: { ...councilResults.metadata, ...merged.metadata }
              }
            });

          } catch (councilError: any) {
            console.error(`[${mode.toUpperCase()}] Error:`, councilError.message);
            sendEvent(controller, encoder, {
              type: 'error',
              data: { 
                message: `${mode} mode failed`, 
                details: councilError.message
              }
            });
          }

          controller.close();
          return;
        }

        // SINGLE MODE - Direct provider call
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
    version: '5.0-COUNCIL-RESTORED',
    modes: ['single', 'super', 'advanced', 'roadmap'],
    note: 'All modes use preprocessPrompt, Super/Advanced use council with noun-based fallback',
    timestamp: new Date().toISOString()
  });
}
