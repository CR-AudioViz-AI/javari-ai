import { NextRequest } from "next/server";

export const runtime = "edge";

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

    // Get base URL
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    console.log('[/api/chat] Calling router:', { message: message.substring(0, 50), mode, provider });

    // Call router
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
          details: errorText
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get reader
    const reader = routerRes.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      return new Response(
        JSON.stringify({ error: "No response body from router" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let finalResponse = '';
    let metadata: any = {};
    let responseProvider = provider;
    let error: string | null = null;

    try {
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[/api/chat] Stream complete. Final response length:', finalResponse.length);
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const eventData = JSON.parse(line.slice(6));
            
            switch (eventData.type) {
              case 'token':
                if (eventData.data && typeof eventData.data === 'string') {
                  finalResponse += eventData.data;
                }
                break;

              case 'final':
                if (eventData.data) {
                  // Use final response if provided, otherwise keep accumulated
                  if (eventData.data.response) {
                    finalResponse = eventData.data.response;
                  }
                  metadata = eventData.data.metadata || metadata;
                  responseProvider = eventData.data.provider || responseProvider;
                }
                break;

              case 'error':
                error = eventData.data?.message || 'Stream error';
                console.error('[/api/chat] Stream error event:', eventData.data);
                break;
            }
          } catch (parseError) {
            console.warn('[/api/chat] Failed to parse SSE:', line.substring(0, 100));
          }
        }
      }
      
      // Process any remaining buffer
      if (buffer.trim() && buffer.startsWith('data: ')) {
        try {
          const eventData = JSON.parse(buffer.slice(6));
          if (eventData.type === 'token' && eventData.data) {
            finalResponse += eventData.data;
          }
        } catch (e) {
          // Ignore
        }
      }
      
    } finally {
      reader.releaseLock();
    }

    // Check if we got an error
    if (error) {
      return new Response(
        JSON.stringify({ error, details: 'Router reported an error' }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Check if we got any response
    if (!finalResponse || finalResponse.trim().length === 0) {
      console.error('[/api/chat] Empty response from router');
      return new Response(
        JSON.stringify({ 
          error: "Empty response from AI",
          details: "The AI provider returned no content. Check API keys and quotas."
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Success
    console.log('[/api/chat] Success. Response length:', finalResponse.length);
    
    return new Response(
      JSON.stringify({
        response: finalResponse,
        provider: responseProvider,
        mode,
        metadata
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err: any) {
    console.error('[/api/chat] Fatal error:', err);
    return new Response(
      JSON.stringify({
        error: "Server error",
        details: err?.message || "Unknown error"
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
