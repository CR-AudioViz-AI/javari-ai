// app/api/javari/router/route.ts
import { NextRequest } from 'next/server';
import { getProvider, getProviderApiKey } from '@/lib/javari/providers';
import { RouterRequest, StreamEvent } from '@/lib/javari/router/types';
import { preprocessPrompt } from '@/lib/javari/utils/preprocessPrompt';
import { runCouncilFast } from '@/lib/javari/council/engine';

export const runtime = 'edge';
export const maxDuration = 60; // Increased for autonomous builds

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body: RouterRequest = await req.json();
        let { message, mode, provider: requestedProvider } = body;

        console.log(`[Router] Mode: ${mode}, Message: ${message.substring(0, 50)}...`);

        if (!message) {
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: 'Message required' }
          });
          controller.close();
          return;
        }

        // Preprocess for ALL modes
        const preprocessed = preprocessPrompt(message);
        message = preprocessed.rewrittenPrompt;
        
        console.log('[Router] Preprocessed:', {
          model: preprocessed.modelToUse,
          nounTrigger: preprocessed.nounTrigger,
          mode
        });

        // SUPER MODE: Fast parallel council
        if (mode === 'super') {
          try {
            const councilResult = await runCouncilFast(
              message,
              (provider, chunk) => {
                sendEvent(controller, encoder, {
                  type: 'token',
                  data: chunk
                });
              }
            );

            const bestResponse = councilResult.results
              .find(r => !r.error)?.response || 'No response';

            sendEvent(controller, encoder, {
              type: 'final',
              data: {
                response: bestResponse,
                mode: 'super',
                metadata: councilResult.metadata
              }
            });

          } catch (error: any) {
            console.error('[Router] Super mode error:', error);
            sendEvent(controller, encoder, {
              type: 'error',
              data: { message: 'Super mode failed', details: error.message }
            });
          }

          controller.close();
          return;
        }

        // ROADMAP MODE: Autonomous execution
        if (mode === 'roadmap') {
          try {
            sendEvent(controller, encoder, {
              type: 'token',
              data: '🚀 Starting autonomous build...\n\n'
            });

            // Phase 1: Quick architecture
            sendEvent(controller, encoder, {
              type: 'token',
              data: '📐 Planning architecture...\n'
            });

            const councilResult = await runCouncilFast(
              `Create implementation plan for: ${message}. Be concise and specific.`
            );

            const plan = councilResult.results.find(r => !r.error)?.response || '';
            
            sendEvent(controller, encoder, {
              type: 'token',
              data: `\n✅ Plan ready (${councilResult.metadata.totalTime}ms)\n\n`
            });

            // Phase 2: Execute with Claude
            sendEvent(controller, encoder, {
              type: 'token',
              data: '⚡ Building files...\n\n'
            });

            const claudeKey = getProviderApiKey('anthropic');
            const claude = getProvider('anthropic', claudeKey);

            let buildResponse = '';
            for await (const chunk of claude.generateStream(
              `${plan}\n\nBuild this now. Create actual files with complete, production-ready code.`,
              { timeout: 45000, preferredModel: preprocessed.modelToUse }
            )) {
              buildResponse += chunk;
              sendEvent(controller, encoder, { type: 'token', data: chunk });
            }

            sendEvent(controller, encoder, {
              type: 'final',
              data: {
                response: buildResponse,
                mode: 'roadmap',
                plan,
                metadata: { autonomous: true }
              }
            });

          } catch (error: any) {
            console.error('[Router] Roadmap mode error:', error);
            sendEvent(controller, encoder, {
              type: 'error',
              data: { message: 'Autonomous build failed', details: error.message }
            });
          }

          controller.close();
          return;
        }

        // SINGLE/ADVANCED MODE: Direct execution
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
          
          for await (const chunk of provider.generateStream(message, {
            preferredModel: preprocessed.modelToUse
          })) {
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
          console.error('[Router] Stream error:', streamError);
          sendEvent(controller, encoder, {
            type: 'error',
            data: { message: 'Stream error', details: streamError.message }
          });
        }

      } catch (error: any) {
        console.error('[Router] Fatal error:', error);
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
    version: '6.0-AUTONOMOUS',
    modes: {
      single: 'Direct OpenAI',
      super: 'Parallel multi-AI council',
      advanced: 'Enhanced single',
      roadmap: 'Autonomous ChatGPT→Claude execution'
    },
    timestamp: new Date().toISOString()
  });
}
