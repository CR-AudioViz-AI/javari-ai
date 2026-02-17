// app/api/chat/route.ts
/**
 * Chat API - GUARANTEED MESSAGE STRUCTURE
 * 
 * EVERY response returns:
 * {
 *   messages: [
 *     { role: "assistant", content: "..." }
 *   ]
 * }
 * 
 * Status: ALWAYS 200
 * Never returns: undefined, {}, or missing messages field
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

interface NormalizedResponse {
  messages: Array<{
    role: "assistant";
    content: string;
  }>;
}

/**
 * Guaranteed response wrapper - NEVER fails
 */
function createResponse(content: string): NextResponse {
  return NextResponse.json(
    {
      messages: [
        {
          role: "assistant",
          content: content || "No response generated",
        },
      ],
    } as NormalizedResponse,
    { status: 200 }
  );
}

/**
 * Guaranteed error wrapper - NEVER fails
 */
function createErrorResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      messages: [
        {
          role: "assistant",
          content: `I encountered an error: ${error}. Please try again.`,
        },
      ],
    } as NormalizedResponse,
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request
    let body: ChatRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Chat] JSON parse error:', parseError);
      return createErrorResponse('Invalid request format');
    }

    const { message, mode = 'single', provider = 'anthropic' } = body;

    // Validate message
    if (!message || typeof message !== 'string' || !message.trim()) {
      console.error('[Chat] Empty or invalid message');
      return createErrorResponse('Please provide a message');
    }

    console.log(`[Chat] Processing: mode=${mode}, provider=${provider}`);

    // Route to appropriate handler - ALL wrapped in try/catch
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
      console.error(`[Chat] Mode handler (${mode}) error:`, modeError);
      
      // Fallback to simple provider
      try {
        return await fallbackToSimpleProvider(message, provider, startTime);
      } catch (fallbackError) {
        console.error('[Chat] Fallback also failed:', fallbackError);
        return createErrorResponse('All routing methods failed');
      }
    }

  } catch (error) {
    console.error('[Chat] Top-level error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
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
    
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const providerName = body.provider || 'anthropic';
    const apiKey = getProviderApiKey(providerName);
    const provider = getProvider(providerName, apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] handleSingleMode: Success');
    
    // GUARANTEE: Return normalized structure
    return createResponse(response || 'No response generated');
    
  } catch (error) {
    console.error('[Chat] handleSingleMode error:', error);
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Handle super mode
 */
async function handleSuperMode(
  message: string,
  body: ChatRequest,
  startTime: number
): Promise<NextResponse> {
  try {
    console.log('[Chat] handleSuperMode: Starting');
    
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic');
    const provider = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] handleSuperMode: Success');
    
    return createResponse(response || 'No response generated');
    
  } catch (error) {
    console.error('[Chat] handleSuperMode error:', error);
    throw error;
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
    
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic');
    const provider = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Chat] handleAdvancedMode: Success');
    
    return createResponse(response || 'No response generated');
    
  } catch (error) {
    console.error('[Chat] handleAdvancedMode error:', error);
    throw error;
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
    
    // Extract response from result
    const responseText = result.executionResult?.response || 
                        result.response || 
                        result.content || 
                        'Roadmap execution initiated';
    
    return createResponse(responseText);
    
  } catch (error) {
    console.error('[Chat] handleRoadmapMode error:', error);
    throw error;
  }
}

/**
 * Fallback to simple provider
 */
async function fallbackToSimpleProvider(
  message: string,
  provider: string,
  startTime: number
): Promise<NextResponse> {
  console.log('[Chat] fallbackToSimpleProvider: Starting');
  
  const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
  
  const apiKey = getProviderApiKey('anthropic');
  const providerInstance = getProvider('anthropic', apiKey);
  
  let response = '';
  for await (const chunk of providerInstance.generateStream(message)) {
    response += chunk;
  }

  console.log('[Chat] fallbackToSimpleProvider: Success');
  
  return createResponse(response || 'Fallback response generated');
}

/**
 * GET method
 */
export async function GET() {
  console.error('[Chat] GET request - method not allowed');
  return createErrorResponse('This endpoint requires POST');
}
