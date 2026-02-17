// app/api/knowledge/query/route.ts
/**
 * Knowledge Query API - GUARANTEED MESSAGE STRUCTURE
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

export const runtime = 'nodejs';
export const maxDuration = 30;

interface KnowledgeQueryRequest {
  prompt?: string;
  message?: string;
  question?: string;
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[Knowledge] Query started');
    
    // Parse request
    let body: KnowledgeQueryRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Knowledge] JSON parse error:', parseError);
      return createErrorResponse('Invalid request format');
    }
    
    // Accept multiple field names for compatibility
    const prompt = body.prompt || body.message || body.question || '';

    if (!prompt.trim()) {
      console.error('[Knowledge] Empty prompt');
      return createErrorResponse('Please provide a question');
    }

    // R2 is not configured - go straight to AI
    console.log('[Knowledge] Using AI fallback');
    
    try {
      const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
      
      const apiKey = getProviderApiKey('anthropic');
      const provider = getProvider('anthropic', apiKey);
      
      let response = '';
      for await (const chunk of provider.generateStream(prompt)) {
        response += chunk;
      }

      console.log('[Knowledge] Success');
      
      // GUARANTEE: Return normalized structure
      return createResponse(response || 'No response generated');
      
    } catch (providerError) {
      console.error('[Knowledge] Provider error:', providerError);
      return createErrorResponse('Failed to generate response');
    }

  } catch (error) {
    console.error('[Knowledge] Top-level error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * GET method
 */
export async function GET() {
  console.error('[Knowledge] GET request - method not allowed');
  return createErrorResponse('This endpoint requires POST');
}

/**
 * Other unsupported methods
 */
export async function PUT() {
  return GET();
}

export async function DELETE() {
  return GET();
}

export async function PATCH() {
  return GET();
}
