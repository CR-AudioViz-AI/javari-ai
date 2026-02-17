// app/api/knowledge/query/route.ts
/**
 * Knowledge Query API - FULL ENVELOPE NORMALIZATION
 * 
 * EVERY response includes ALL fields:
 * - messages, results, sources, metadata
 * - provider, model, latency_ms, tokens_in, tokens_out, usage
 * - id, success, error
 * 
 * Status: ALWAYS 200
 */

import { NextRequest, NextResponse } from "next/server";
import { normalizeEnvelope, NormalizedEnvelope } from "@/lib/normalize-envelope";

export const runtime = 'nodejs';
export const maxDuration = 30;

interface KnowledgeQueryRequest {
  prompt?: string;
  message?: string;
  question?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    console.log('[Knowledge] Query started');
    
    let body: KnowledgeQueryRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Knowledge] JSON parse error:', parseError);
      const envelope = normalizeEnvelope(
        "I encountered an error: Invalid request format. Please try again.",
        {
          success: false,
          error: "Invalid JSON in request body",
          latency: Date.now() - startTime,
        }
      );
      return NextResponse.json(envelope, { status: 200 });
    }
    
    const prompt = body.prompt || body.message || body.question || '';

    if (!prompt.trim()) {
      console.error('[Knowledge] Empty prompt');
      const envelope = normalizeEnvelope(
        "I encountered an error: Please provide a question. Please try again.",
        {
          success: false,
          error: "Empty prompt",
          latency: Date.now() - startTime,
        }
      );
      return NextResponse.json(envelope, { status: 200 });
    }

    console.log('[Knowledge] Using AI provider');
    
    try {
      const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
      
      const apiKey = getProviderApiKey('anthropic');
      const provider = getProvider('anthropic', apiKey);
      
      let response = '';
      for await (const chunk of provider.generateStream(prompt)) {
        response += chunk;
      }

      console.log('[Knowledge] Success');
      
      const envelope = normalizeEnvelope(response, {
        success: true,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        latency: Date.now() - startTime,
        tokensIn: Math.ceil(prompt.length / 4),
        tokensOut: Math.ceil(response.length / 4),
        sources: [
          {
            title: 'AI Response',
            content: response,
            relevance: 1.0,
          },
        ],
        metadata: {
          fallbackUsed: true,
          r2Configured: false,
        },
      });
      
      return NextResponse.json(envelope, { status: 200 });
      
    } catch (providerError) {
      console.error('[Knowledge] Provider error:', providerError);
      const envelope = normalizeEnvelope(
        "I encountered an error: Failed to generate response. Please try again.",
        {
          success: false,
          error: providerError instanceof Error ? providerError.message : "Provider error",
          latency: Date.now() - startTime,
        }
      );
      return NextResponse.json(envelope, { status: 200 });
    }

  } catch (error) {
    console.error('[Knowledge] Top-level error:', error);
    const envelope = normalizeEnvelope(
      "I encountered an error: Unknown error. Please try again.",
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        latency: Date.now() - startTime,
      }
    );
    return NextResponse.json(envelope, { status: 200 });
  }
}

export async function GET() {
  console.error('[Knowledge] GET request - method not allowed');
  const envelope = normalizeEnvelope(
    "I encountered an error: This endpoint requires POST. Please try again.",
    {
      success: false,
      error: "Method not allowed - use POST",
    }
  );
  return NextResponse.json(envelope, { status: 200 });
}

export async function PUT() {
  return GET();
}

export async function DELETE() {
  return GET();
}

export async function PATCH() {
  return GET();
}
