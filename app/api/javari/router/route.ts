// app/api/javari/router/route.ts
import { NextRequest } from 'next/server';
import { getProvider, getProviderApiKey } from '@/lib/javari/providers';
import { runCouncil } from '@/lib/javari/council/engine';
import { mergeCouncilResults } from '@/lib/javari/council/merge';
import { validateCouncilResult } from '@/lib/javari/council/validator';
import { generateRoadmap } from '@/lib/javari/roadmap/engine';
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

        // ROADMAP MODE - Project Planning
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

        // SUPERMODE - Enhanced Council
        if (mode === 'super') {
          const councilResults = await runCouncil(
            message,
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

          const merged = mergeCouncilResults(councilResults.results);
          
          sendEvent(controller, encoder, {
            type: 'council',
            data: { phase: 'merge', ...councilResults.metadata, merged: true }
          });

          try {
            const validated = await validateCouncilResult(merged);
            
            sendEvent(controller, encoder, {
              type: 'council',
              data: { phase: 'validation', validated: validated.validated, validator: validated.validatorProvider }
            });

            sendEvent(controller, encoder, {
              type: 'final',
              data: {
                response: validated.finalText,
                mode: 'super',
                reasoning: merged.reasoning,
                metadata: { ...councilResults.metadata, ...merged.metadata, validated: validated.validated }
              }
            });

          } catch (validationError) {
            sendEvent(controller, encoder, {
              type: 'final',
              data: {
                response: merged.finalText,
                mode: 'super',
                reasoning: merged.reasoning,
                metadata: { ...councilResults.metadata, ...merged.metadata }
              }
            });
          }

          controller.close();
          return;
        }

        // SINGLE MODE
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
            sendEvent(controller, encoder, { type: 'token', data: chunk });
          }

          sendEvent(controller, encoder, {
            type: 'final',
            data: { response: fullResponse, provider: providerName, model: provider.getModel(), mode }
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
    version: '4.1C-C',
    providers: ['openai', 'anthropic', 'groq', 'mistral', 'xai', 'deepseek', 'cohere'],
    modes: ['single', 'super', 'advanced', 'roadmap'],
    features: ['weighted-scoring', 'fault-tolerance', 'agreement-detection', 'validation', 'roadmap-generation'],
    timestamp: new Date().toISOString()
  });
}
