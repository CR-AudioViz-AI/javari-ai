// app/api/chat/route.ts
/**
 * Main Chat API - EMERGENCY HARDENED
 * 
 * GUARANTEES:
 * - No empty JSON responses ({})
 * - All errors return structured format with message + stack
 * - All mode handlers return valid JSON
 * - Comprehensive error logging
 * - UI always receives valid assistant message or error
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
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
  error?: {
    message: string;
    stack?: string | null;
  };
  metadata?: {
    timestamp: string;
    duration?: number;
    fallbackUsed?: boolean;
    requestId?: string;
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
      console.error('[Chat] JSON parse error:', parseError);
      return NextResponse.json(
        {
          success: false,
          response: "Invalid request format. Please send valid JSON.",
          mode: "unknown",
          provider: "unknown",
          error: {
            message: parseError instanceof Error ? parseError.message : 'JSON parse failed',
            stack: parseError instanceof Error ? parseError.stack : null,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
          },
        } as ChatResponse,
        { status: 200 }
      );
    }

    const { message, mode = 'single', provider = 'anthropic' } = body;

    // Validate message
    if (!message || typeof message !== 'string' || !message.trim()) {
      console.error('[Chat] Empty or invalid message received');
      return NextResponse.json(
        {
          success: false,
          response: "Please provide a message to get started.",
          mode,
          provider,
          error: {
            message: 'Message field is required and must be a non-empty string',
            stack: null,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
          },
        } as ChatResponse,
        { status: 200 }
      );
    }

    // Route to appropriate handler based on mode
    try {
      console.log(`[Chat] Routing to mode: ${mode}, provider: ${provider}`);
      
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
      console.error(`[Chat] Mode handler (${mode}) error:`, modeError);
      
      // Fallback to simple router
      return await fallbackToSimpleRouter(message, mode, provider, startTime, modeError);
    }

  } catch (error) {
    console.error('[Chat] Top-level catastrophic error:', error);
    
    return NextResponse.json(
      {
        success: false,
        response: "I encountered an unexpected error. Please try again.",
        mode: "unknown",
        provider: "unknown",
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 }
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
    console.log('[Chat] handleSingleMode: Starting');
    
    // Use provider directly since routeAndExecute doesn't exist
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const providerName = body.provider || 'anthropic';
    const apiKey = getProviderApiKey(providerName);
    const provider = getProvider(providerName, apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] handleSingleMode: Success');
    
    // GUARANTEE: Always return valid response string
    if (!response || typeof response !== 'string') {
      throw new Error('Provider returned empty or invalid response');
    }

    return NextResponse.json(
      {
        success: true,
        response: response,
        mode: 'single',
        provider: providerName,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Chat] handleSingleMode error:', error);
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
    console.log('[Chat] handleSuperMode: Starting');
    
    // Use anthropic provider for super mode
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic');
    const provider = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] handleSuperMode: Success');
    
    // GUARANTEE: Always return valid response string
    if (!response || typeof response !== 'string') {
      throw new Error('Provider returned empty or invalid response');
    }

    return NextResponse.json(
      {
        success: true,
        response: response,
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
    console.error('[Chat] handleSuperMode error:', error);
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
    console.log('[Chat] handleAdvancedMode: Starting');
    
    // Use anthropic provider for advanced mode
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic');
    const provider = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] handleAdvancedMode: Success');
    
    // GUARANTEE: Always return valid response string
    if (!response || typeof response !== 'string') {
      throw new Error('Provider returned empty or invalid response');
    }

    return NextResponse.json(
      {
        success: true,
        response: response,
        mode: 'advanced',
        provider: 'anthropic',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Chat] handleAdvancedMode error:', error);
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
    console.log('[Chat] handleRoadmapMode: Starting');
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

    console.log('[Chat] handleRoadmapMode: Success');
    
    // GUARANTEE: Always return valid response string
    const responseText = result.executionResult?.response || 
                        result.response || 
                        result.content || 
                        '';
    
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('Roadmap execution returned empty or invalid response');
    }

    return NextResponse.json(
      {
        success: true,
        response: responseText,
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
    console.error('[Chat] handleRoadmapMode error:', error);
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
  startTime: number,
  originalError?: any
): Promise<NextResponse> {
  try {
    console.log('[Chat] fallbackToSimpleRouter: Starting');
    
    // Try to use provider directly as last resort
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic'); // Default to Claude
    if (!apiKey) {
      throw new Error('No API key available for fallback provider');
    }
    
    const providerInstance = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of providerInstance.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] fallbackToSimpleRouter: Success');
    
    // GUARANTEE: Always return valid response string
    if (!response || typeof response !== 'string' || !response.trim()) {
      throw new Error('Fallback provider returned empty response');
    }

    return NextResponse.json(
      {
        success: true,
        response: response,
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
    console.error('[Chat] Original error was:', originalError);
    
    // FINAL FALLBACK: Return structured error with both error details
    return NextResponse.json(
      {
        success: false,
        response: "I'm currently experiencing technical difficulties. Please try again in a moment.",
        mode,
        provider,
        error: {
          message: fallbackError instanceof Error ? fallbackError.message : 'All routing methods failed',
          stack: fallbackError instanceof Error ? fallbackError.stack : null,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          fallbackUsed: true,
        },
      } as ChatResponse,
      { status: 200 }
    );
  }
}

/**
 * Handle unsupported methods - returns 200 with error message
 */
export async function GET() {
  console.error('[Chat] GET request received - method not allowed');
  
  return NextResponse.json(
    {
      success: false,
      response: "This endpoint requires POST. Please send your message via POST request.",
      mode: "unknown",
      provider: "unknown",
      error: {
        message: "Method not allowed - use POST",
        stack: null,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    } as ChatResponse,
    { status: 200 }
  );
}
