import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Main chat endpoint that consumes the SSE stream from /api/javari/router
 * and returns a final JSON response for the frontend.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      message,
      mode = 'single',
      provider = 'openai',
      sessionId,
      history = []
    } = body;

    // Validation
    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(
        JSON.stringify({ 
          error: "Message is required and must be a non-empty string" 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Validate mode
    const validModes = ['single', 'advanced', 'super', 'roadmap'];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get base URL from request
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Call the router endpoint (which returns SSE stream)
    const routerRes = await fetch(
      `${baseUrl}/api/javari/router`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          mode,
          provider,
          sessionId,
          history
        })
      }
    );

    if (!routerRes.ok) {
      const errorText = await routerRes.text();
      console.error('[/api/chat] Router error:', errorText);
      return new Response(
        JSON.stringify({
          error: "Router request failed",
          details: errorText,
          status: routerRes.status
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // The router returns an SSE stream - we need to consume it
    // and extract the final response
    const reader = routerRes.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      return new Response(
        JSON.stringify({
          error: "No response body from router"
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let finalResponse = '';
    let metadata: any = {};
    let responseProvider = provider;
    let councilVotes: any[] = [];
    let roadmap: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
            
            switch (data.type) {
              case 'token':
                // Accumulate tokens for final response
                if (data.data && typeof data.data === 'string') {
                  finalResponse += data.data;
                }
                break;

              case 'final':
                // Final event with complete response
                if (data.data) {
                  finalResponse = data.data.response || finalResponse;
                  metadata = data.data.metadata || metadata;
                  responseProvider = data.data.provider || responseProvider;
                  roadmap = data.data.roadmap || roadmap;
                }
                break;

              case 'council':
                // Council events from SuperMode
                if (data.data) {
                  if (data.data.provider && data.data.complete) {
                    councilVotes.push({
                      provider: data.data.provider,
                      confidence: data.data.confidence,
                      latency: data.data.latency,
                      error: data.data.error
                    });
                  }
                  if (data.data.merged) {
                    metadata.councilMetadata = data.data;
                  }
                }
                break;

              case 'error':
                console.error('[/api/chat] Stream error:', data.data);
                return new Response(
                  JSON.stringify({
                    error: data.data?.message || 'Stream error',
                    details: data.data?.details
                  }),
                  { 
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                  }
                );
            }
          } catch (parseError) {
            // Skip malformed SSE events
            console.warn('[/api/chat] Failed to parse SSE event:', line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Build final response object
    const responseData: any = {
      response: finalResponse || 'No response generated',
      provider: responseProvider,
      mode,
      metadata: {
        ...metadata,
        sessionId
      }
    };

    // Add mode-specific data
    if (mode === 'super' && councilVotes.length > 0) {
      responseData.metadata.councilVotes = councilVotes;
    }

    if (mode === 'roadmap' && roadmap) {
      responseData.roadmap = roadmap;
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (err: any) {
    console.error('[/api/chat] Error:', err);
    return new Response(
      JSON.stringify({
        error: "Server error",
        details: err?.message || "Unknown error occurred"
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
