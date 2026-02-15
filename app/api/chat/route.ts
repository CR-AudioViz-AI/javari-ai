// app/api/chat/route.ts
// FIXED: Proper error handling, timeout management, streaming support
// Handles: Single, Super, Advanced, Roadmap modes
// Max Duration: 25 seconds

import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 25;

interface ChatRequest {
  message: string;
  mode?: 'single' | 'super' | 'advanced' | 'roadmap';
  provider?: string;
  history?: any[];
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, mode = 'single', provider = 'openai' } = body;

    if (!message?.trim()) {
      return Response.json({ 
        error: "Message required",
        response: "Please provide a message"
      }, { status: 400 });
    }

    // Call router with extended timeout
    const url = new URL(req.url);
    const routerUrl = `${url.protocol}//${url.host}/api/javari/router`;
    
    console.log('[Chat API] Calling router:', { mode, provider, messageLength: message.length });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 23000); // Give router 23s
    
    try {
      const routerRes = await fetch(routerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode, provider, ...body }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!routerRes.ok) {
        const errorText = await routerRes.text().catch(() => 'Unknown error');
        console.error('[Chat API] Router error:', {
          status: routerRes.status,
          statusText: routerRes.statusText,
          error: errorText,
          mode,
          provider
        });
        
        return Response.json({ 
          error: "Router failed", 
          response: "I'm having trouble processing that request. Please try again.",
          details: errorText,
          provider,
          mode
        }, { status: 500 });
      }

      // Read SSE stream with proper error handling
      const reader = routerRes.body?.getReader();
      if (!reader) {
        console.error('[Chat API] No stream reader available');
        return Response.json({ 
          error: "No stream",
          response: "Stream error - please try again.",
          provider,
          mode
        }, { status: 500 });
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let finalResponse = '';
      let finalData: any = null;
      let chunkCount = 0;

      try {
        const streamDeadline = Date.now() + 24000; // Absolute deadline
        
        while (true) {
          if (Date.now() > streamDeadline) {
            console.error('[Chat API] Stream reading timeout after', chunkCount, 'chunks');
            throw new Error('Stream reading timeout');
          }

          const readResult = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Chunk read timeout')), 5000)
            )
          ]).catch((err) => {
            console.error('[Chat API] Chunk read error:', err);
            return { done: true, value: undefined };
          });
          
          const { done, value } = readResult as ReadableStreamReadResult<Uint8Array>;
          
          if (done) {
            console.log('[Chat API] Stream complete:', { 
              chunks: chunkCount, 
              responseLength: finalResponse.length 
            });
            break;
          }

          chunkCount++;
          accumulated += decoder.decode(value, { stream: true });
          
          const lines = accumulated.split('\n');
          accumulated = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                
                if (event.type === 'token') {
                  finalResponse += event.data;
                } else if (event.type === 'final') {
                  finalData = event.data;
                  console.log('[Chat API] Final event received:', {
                    provider: finalData.provider,
                    model: finalData.model,
                    responseLength: finalData.response?.length
                  });
                } else if (event.type === 'error') {
                  console.error('[Chat API] Stream error event:', event.data);
                  return Response.json({
                    error: event.data.message || 'Stream error',
                    response: "I encountered an error. Please try again.",
                    details: event.data.details || event.data.message,
                    provider,
                    mode
                  }, { status: 500 });
                }
              } catch (parseError) {
                console.warn('[Chat API] Failed to parse event:', line.substring(0, 100));
              }
            }
          }
        }

        // Return final data if available
        if (finalData && finalData.response) {
          return Response.json({
            response: finalData.response,
            provider: finalData.provider || provider,
            mode: finalData.mode || mode,
            model: finalData.model,
            metadata: finalData.metadata
          });
        }

        // Fallback to accumulated response
        if (finalResponse) {
          return Response.json({
            response: finalResponse,
            provider,
            mode
          });
        }

        // No response received
        console.error('[Chat API] No response received from stream');
        return Response.json({
          error: "No response",
          response: "I didn't receive a response. Please try again.",
          provider,
          mode
        }, { status: 500 });

      } catch (streamError: any) {
        console.error('[Chat API] Stream processing error:', {
          error: streamError.message,
          stack: streamError.stack,
          chunks: chunkCount
        });
        
        // If we have a partial response, return it
        if (finalResponse) {
          return Response.json({
            response: finalResponse,
            provider,
            mode,
            warning: 'Stream interrupted but partial response available'
          });
        }
        
        return Response.json({
          error: "Stream timeout",
          response: "The response took too long. Please try a shorter question.",
          provider,
          mode
        }, { status: 500 });
      } finally {
        reader.releaseLock();
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      console.error('[Chat API] Fetch error:', {
        name: fetchError.name,
        message: fetchError.message,
        mode,
        provider
      });
      
      if (fetchError.name === 'AbortError') {
        return Response.json({
          error: "Request timeout",
          response: "Your request took too long to process. Please try again.",
          provider,
          mode
        }, { status: 504 });
      }
      
      throw fetchError;
    }

  } catch (error: any) {
    console.error("[Chat API] Fatal error:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return Response.json({
      error: "Server error",
      response: "Something went wrong. Please try again.",
      details: error.message,
      provider: "unknown",
      mode: "single"
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    status: "healthy",
    runtime: "edge",
    version: "8.0-FIXED-TIMEOUT-ERROR-HANDLING",
    modes: ["single", "super", "advanced", "roadmap"],
    maxDuration: 25,
    fixes: [
      "Extended router timeout to 23s",
      "Added comprehensive error logging",
      "Fixed stream read timeout handling",
      "Added partial response fallback",
      "Improved error message clarity"
    ],
    timestamp: new Date().toISOString()
  });
}
