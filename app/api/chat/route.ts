// app/api/chat/route.ts
/**
 * Main Chat API - HARDENED FOR PRODUCTION
 * 
 * Handles: Single, Super, Advanced, Roadmap modes
 * Guarantees: Proper JSON responses, No 400 errors, Structured output
 * Features: Validated input, Normalized errors, Fallback routing
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 25;

interface ChatRequest {
  message: string;
  mode?: 'single' | 'super' | 'advanced' | 'roadmap';
  provider?: string;
  history?: any[];
}

interface ChatResponse {
  success: boolean;
  response: string;
  mode: string;
  provider: string;
  error?: string;
  metadata?: {
    timestamp: string;
    duration?: number;
    fallbackUsed?: boolean;
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request
    let body: ChatRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          response: "Invalid request format. Please send valid JSON.",
          mode: "unknown",
          provider: "unknown",
          error: "JSON parse error",
        } as ChatResponse,
        { status: 200 } // Return 200 even for errors to avoid 400
      );
    }

    const { message, mode = 'single', provider = 'anthropic' } = body;

    // Validate message
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        {
          success: false,
          response: "Please provide a message to get started.",
          mode,
          provider,
          error: "Empty message",
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
          },
        } as ChatResponse,
        { status: 200 } // Return 200, not 400
      );
    }

    // Route to appropriate handler based on mode
    try {
      if (mode === 'roadmap') {
        return await handleRoadmapMode(message, body, startTime);
      } else if (mode === 'advanced') {
        return await handleAdvancedMode(message, body, startTime);
      } else if (mode === 'super') {
        return await handleSuperMode(message, body, startTime);
      } else {
        return await handleSingleMode(message, body, startTime);
      }
    } catch (modeError) {
      console.error('[Chat] Mode handler error:', modeError);
      
      // Fallback to simple router
      return await fallbackToSimpleRouter(message, mode, provider, startTime);
    }

  } catch (error) {
    console.error('[Chat] Top-level error:', error);
    
    return NextResponse.json(
      {
        success: false,
        response: "I encountered an unexpected error. Please try again.",
        mode: "unknown",
        provider: "unknown",
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 } // Always return 200 to avoid client errors
    );
  }
}

/**
 * Handle single provider mode
 */
async function handleSingleMode(
  message: string,
  body: ChatRequest,
  startTime: number
): Promise<NextResponse> {
  try {
    const { routeAndExecute } = await import('@/lib/javari/router/router');
    
    const result = await routeAndExecute({
      message,
      mode: 'single',
      provider: body.provider || 'anthropic',
    });

    return NextResponse.json(
      {
        success: true,
        response: result.content || result.response || 'Response generated successfully',
        mode: 'single',
        provider: result.provider || body.provider || 'anthropic',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Handle super mode (multi-provider consensus)
 */
async function handleSuperMode(
  message: string,
  body: ChatRequest,
  startTime: number
): Promise<NextResponse> {
  try {
    const { routeAndExecute } = await import('@/lib/javari/router/router');
    
    const result = await routeAndExecute({
      message,
      mode: 'super',
    });

    return NextResponse.json(
      {
        success: true,
        response: result.content || result.response || 'Consensus response generated',
        mode: 'super',
        provider: 'multi-provider',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Handle advanced mode
 */
async function handleAdvancedMode(
  message: string,
  body: ChatRequest,
  startTime: number
): Promise<NextResponse> {
  try {
    const { routeAndExecute } = await import('@/lib/javari/router/router');
    
    const result = await routeAndExecute({
      message,
      mode: 'advanced',
    });

    return NextResponse.json(
      {
        success: true,
        response: result.content || result.response || 'Advanced analysis complete',
        mode: 'advanced',
        provider: result.provider || 'multi-provider',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Handle roadmap mode
 */
async function handleRoadmapMode(
  message: string,
  body: ChatRequest,
  startTime: number
): Promise<NextResponse> {
  try {
    const { runJavariChatRequest } = await import('@/javari/chat/runJavariChatRequest');
    
    const result = await runJavariChatRequest(
      { 
        message,
        mode: 'roadmap',
        ...body 
      },
      {
        userId: 'roadmap-user',
        source: 'chat-api',
        autoExecute: true,
        applyPolicy: true,
      }
    );

    return NextResponse.json(
      {
        success: true,
        response: result.executionResult?.response || 'Roadmap execution initiated',
        mode: 'roadmap',
        provider: result.primaryModel || 'anthropic',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          requestId: result.requestId,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Chat] Roadmap mode error:', error);
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Fallback to simple router when advanced modes fail
 */
async function fallbackToSimpleRouter(
  message: string,
  mode: string,
  provider: string,
  startTime: number
): Promise<NextResponse> {
  try {
    // Try to use provider directly as last resort
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic'); // Default to Claude
    const providerInstance = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of providerInstance.generateStream(message)) {
      response += chunk;
    }

    return NextResponse.json(
      {
        success: true,
        response: response || 'Response generated via fallback',
        mode,
        provider: 'anthropic',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          fallbackUsed: true,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (fallbackError) {
    console.error('[Chat] Fallback also failed:', fallbackError);
    
    return NextResponse.json(
      {
        success: false,
        response: "I'm currently experiencing technical difficulties. Please try again in a moment.",
        mode,
        provider,
        error: 'All routing methods failed',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          fallbackUsed: true,
        },
      } as ChatResponse,
      { status: 200 } // Still return 200
    );
  }
}

/**
 * Handle unsupported methods - returns 200 with error message
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      response: "This endpoint requires POST. Please send your message via POST request.",
      mode: "unknown",
      provider: "unknown",
      error: "Method not allowed - use POST",
      metadata: {
        timestamp: new Date().toISOString(),
      },
    } as ChatResponse,
    { status: 200 } // Return 200, not 405
  );
}
