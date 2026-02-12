import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 25; // Vercel edge limit

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, mode = 'single', provider = 'openai' } = body;

    if (!message?.trim()) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }

    // Call router with 20 second timeout
    const url = new URL(req.url);
    const routerUrl = `${url.protocol}//${url.host}/api/javari/router`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
    
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
          status: routerRes.status,
          response: "I'm having trouble processing that request. Please try a simpler question or try again."
        }, { status: 500 });
      }

      // Read SSE stream with timeout protection
      const reader = routerRes.body?.getReader();
      if (!reader) {
        return Response.json({ 
          error: "No stream",
          response: "Stream error - please try again."
        }, { status: 500 });
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let finalResponse = '';
      let finalData: any = null;
      let streamTimeout: NodeJS.Timeout | null = null;

      try {
        // 15 second timeout for stream reading
        const streamDeadline = Date.now() + 15000;
        
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
                    response: "I encountered an error. Please try again with a simpler request."
                  }, { status: 500 });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        if (finalData) {
          return Response.json(finalData);
        }

        return Response.json({
          response: finalResponse || "No response received",
          provider,
          mode
        });

      } catch (streamError: any) {
        return Response.json({
          error: "Stream timeout",
          response: "The response took too long. Please try a shorter or simpler question.",
          details: streamError.message
        }, { status: 500 });
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return Response.json({
          error: "Request timeout",
          response: "Your request took too long to process. Please try a shorter or simpler question."
        }, { status: 504 });
      }
      
      throw fetchError;
    }

  } catch (error: any) {
    console.error("Chat API error:", error);
    return Response.json({
      error: "Server error",
      response: "Something went wrong. Please try again.",
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    status: "healthy",
    version: "4.4-TIMEOUT-PROTECTED",
    timestamp: new Date().toISOString()
  });
}
