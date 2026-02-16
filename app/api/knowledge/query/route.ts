// app/api/knowledge/query/route.ts
/**
 * Knowledge Query Endpoint - POST ONLY
 * 
 * Queries R2 documentation buckets for relevant information
 * Falls back to router.chat() if no relevant docs found
 * Always returns structured JSON
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface KnowledgeQueryRequest {
  prompt: string;
  maxResults?: number;
  threshold?: number;
}

interface KnowledgeQueryResponse {
  success: boolean;
  sources: Array<{
    title: string;
    content: string;
    relevance: number;
    bucket?: string;
  }>;
  answer?: string;
  fallbackUsed: boolean;
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: KnowledgeQueryRequest = await req.json();
    const { prompt, maxResults = 5, threshold = 0.7 } = body;

    if (!prompt?.trim()) {
      return NextResponse.json(
        {
          success: false,
          sources: [],
          fallbackUsed: false,
          error: 'Prompt is required',
        } as KnowledgeQueryResponse,
        { status: 400 }
      );
    }

    // R2 bucket configuration
    const R2_BUCKET = process.env.R2_BUCKET;
    const R2_ENDPOINT = process.env.R2_ENDPOINT;
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

    // Check if R2 is configured
    const r2Configured =
      R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY;

    if (!r2Configured) {
      console.warn('[Knowledge] R2 not configured, using fallback');
      return await fallbackToChat(prompt);
    }

    try {
      // Query R2 bucket for relevant documentation
      // For now, we'll implement a simple fallback since we don't have vector search set up
      console.log('[Knowledge] R2 configured but vector search not implemented yet');
      console.log('[Knowledge] Falling back to router.chat()');
      
      return await fallbackToChat(prompt);
    } catch (error) {
      console.error('[Knowledge] R2 query failed:', error);
      return await fallbackToChat(prompt);
    }
  } catch (error) {
    console.error('[Knowledge] Request processing error:', error);
    return NextResponse.json(
      {
        success: false,
        sources: [],
        fallbackUsed: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as KnowledgeQueryResponse,
      { status: 500 }
    );
  }
}

/**
 * Fallback to router.chat() when R2 query fails or returns no results
 */
async function fallbackToChat(prompt: string): Promise<NextResponse> {
  try {
    // Call the router directly
    const { routeAndExecute } = await import('@/lib/javari/multi-ai/router');
    
    const response = await routeAndExecute({
      message: prompt,
      mode: 'single',
      provider: 'anthropic', // Use Claude for knowledge queries
    });

    return NextResponse.json(
      {
        success: true,
        sources: [
          {
            title: 'AI Response',
            content: response.content || '',
            relevance: 1.0,
          },
        ],
        answer: response.content,
        fallbackUsed: true,
      } as KnowledgeQueryResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Knowledge] Fallback to chat failed:', error);
    return NextResponse.json(
      {
        success: false,
        sources: [],
        fallbackUsed: true,
        error: 'Both R2 query and fallback failed',
      } as KnowledgeQueryResponse,
      { status: 500 }
    );
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  );
}
