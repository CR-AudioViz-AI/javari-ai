// app/api/chat/route.ts
// EDGE RUNTIME - Fast Multi-AI Chat Mode
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

    // Call router with streaming support
    const url = new URL(req.url);
    const routerUrl = `${url.protocol}//${url.host}/api/javari/router`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);
    
    try {
      const routerRes = await fetch(routerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode, provider, ...body }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!routerRes.ok) {
        return Response.json({ 
          error: "Router failed", 
          response: "I'm having trouble processing that request. Please try again.",
          provider,
          mode
        }, { status: 500 });
      }

      // Read SSE stream with timeout protection
      const reader = routerRes.body?.getReader();
      if (!reader) {
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

      try {
        const streamDeadline = Date.now() + 23000;
        
        while (true) {
          if (Date.now() > streamDeadline) {
            throw new Error('Stream reading timeout');
          }

          const { done, value } = await reader.read();
          
          if (done) break;

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
                } else if (event.type === 'error') {
                  return Response.json({
                    error: event.data.message,
                    response: "I encountered an error. Please try again.",
                    provider,
                    mode
                  }, { status: 500 });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        // Return final data if available, otherwise construct response
        if (finalData && finalData.response) {
          return Response.json({
            response: finalData.response,
            provider: finalData.provider || provider,
            mode: finalData.mode || mode,
            metadata: finalData.metadata
          });
        }

        // Fallback to accumulated response
        return Response.json({
          response: finalResponse || "No response received",
          provider,
          mode
        });

      } catch (streamError: any) {
        return Response.json({
          error: "Stream timeout",
          response: "The response took too long. Please try a shorter question.",
          provider,
          mode
        }, { status: 500 });
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return Response.json({
          error: "Request timeout",
          response: "Your request took too long to process.",
          provider,
          mode
        }, { status: 504 });
      }
      
      throw fetchError;
    }

  } catch (error: any) {
    console.error("Chat API error:", error);
    return Response.json({
      error: "Server error",
      response: "Something went wrong. Please try again.",
      provider: "unknown",
      mode: "single"
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    status: "healthy",
    runtime: "edge",
    version: "7.0-HYBRID-CHAT",
    modes: ["single", "super", "advanced", "roadmap"],
    maxDuration: 25,
    timestamp: new Date().toISOString()
  });
}
