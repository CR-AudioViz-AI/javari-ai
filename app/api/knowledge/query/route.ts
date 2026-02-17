// app/api/knowledge/query/route.ts
/**
 * Knowledge Query - ACTS AS CHAT PROXY
 * 
 * Since frontend is minified and can't be changed,
 * this endpoint receives the message and forwards it to chat logic.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const message = body.prompt || body.message || body.question || '';

    console.log('[Knowledge/Proxy] Received message:', message?.substring(0, 50));

    if (!message.trim()) {
      console.error('[Knowledge/Proxy] Empty message');
      return NextResponse.json({
        messages: [],
        sources: [],
        answer: "",
        success: false,
        fallbackUsed: true,
      }, { status: 200 });
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
    
    // Return in the format frontend expects from knowledge query
    return NextResponse.json({
      messages: [{
        role: "assistant",
        content: response || "No response generated"
      }],
      sources: [{
        title: "AI Response",
        content: response || "No response generated",
        relevance: 1.0
      }],
      answer: response || "No response generated",
      success: true,
      fallbackUsed: false, // We handled it directly
    }, { status: 200 });

  } catch (error) {
    console.error('[Knowledge/Proxy] Error:', error);
    
    return NextResponse.json({
      messages: [],
      sources: [],
      answer: "",
      success: false,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    messages: [],
    sources: [],
    success: false,
  }, { status: 200 });
}

export async function PUT() { return GET(); }
export async function DELETE() { return GET(); }
export async function PATCH() { return GET(); }
