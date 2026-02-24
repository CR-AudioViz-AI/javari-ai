// app/api/knowledge/query/route.ts
/**
 * Knowledge Query - ACTS AS CHAT PROXY
 * 
 * Since frontend is minified and can't be changed,
 * this endpoint receives the message and forwards it to chat logic.
 * 
 * CRITICAL PATCH: Uses normalizePayload to guarantee minimum message structure
 */

import { NextRequest, NextResponse } from "next/server";
import { normalizePayload } from "@/lib/normalize-envelope";

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const message = body.prompt || body.message || body.question || '';

    console.log('[Knowledge/Proxy] Received message:', message?.substring(0, 50));

    if (!message.trim()) {
      console.error('[Knowledge/Proxy] Empty message');
      
      // CRITICAL: Use normalizePayload to guarantee structure
      const normalized = normalizePayload({
        content: "Please provide a message",
        success: false,
        fallbackUsed: true,
        error: "Empty message"
      });
      
      return NextResponse.json(normalized, { status: 200 });
    }

    // ACT AS CHAT PROXY - Call chat directly
    console.log('[Knowledge/Proxy] Forwarding to chat provider');
    
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic');
    const provider = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(message)) {
      response += chunk;
    }

    console.log('[Knowledge/Proxy] Success, returning chat response');
    
    // CRITICAL: Use normalizePayload to guarantee structure
    const normalized = normalizePayload({
      content: response || "No response generated",
      answer: response || "No response generated",
      sources: [{
        title: "AI Response",
        content: response || "No response generated",
        relevance: 1.0
      }],
      success: true,
      fallbackUsed: false
    });

    return NextResponse.json(normalized, { status: 200 });

  } catch (error) {
    console.error('[Knowledge/Proxy] Error:', error);
    
    // CRITICAL: Use normalizePayload to guarantee structure even on error
    const normalized = normalizePayload({
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    return NextResponse.json(normalized, { status: 200 });
  }
}

export async function GET() {
  const normalized = normalizePayload({
    content: "This endpoint requires POST",
    success: false,
    error: "Method not allowed"
  });
  return NextResponse.json(normalized, { status: 200 });
}

export async function PUT() { return GET(); }
export async function DELETE() { return GET(); }
export async function PATCH() { return GET(); }
