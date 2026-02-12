import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, mode = 'single', provider = 'openai' } = body;

    if (!message?.trim()) {
      return Response.json({ error: "Message required" }, { status: 400 });
    }

    // Call router
    const url = new URL(req.url);
    const routerUrl = `${url.protocol}//${url.host}/api/javari/router`;
    
    const routerRes = await fetch(routerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode, provider, ...body })
    });

    if (!routerRes.ok) {
      return Response.json({ error: "Router failed", status: routerRes.status }, { status: 500 });
    }

    // Read SSE stream
    const reader = routerRes.body?.getReader();
    if (!reader) {
      return Response.json({ error: "No stream" }, { status: 500 });
    }

    const decoder = new TextDecoder();
    let accumulated = '';
    let finalResponse = '';
    let finalData: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Accumulate chunks
        accumulated += decoder.decode(value, { stream: true });
        
        // Process lines
        const lines = accumulated.split('\n');
        
        // Keep last incomplete line
        accumulated = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(line.substring(6));
            
            if (event.type === 'token' && event.data) {
              finalResponse += event.data;
            } else if (event.type === 'final') {
              finalData = event.data;
              // Use final response if provided
              if (finalData.response) {
                finalResponse = finalData.response;
              }
            } else if (event.type === 'error') {
              reader.releaseLock();
              return Response.json({ error: event.data?.message || 'Stream error' }, { status: 500 });
            }
          } catch (e) {
            // Skip bad JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Return response
    return Response.json({
      response: finalResponse || 'No response',
      provider: finalData?.provider || provider,
      mode,
      metadata: finalData?.metadata || {}
    });

  } catch (err: any) {
    return Response.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}
