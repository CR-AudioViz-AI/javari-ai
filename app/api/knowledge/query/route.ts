// app/api/knowledge/query/route.ts
/**
 * Knowledge Query API - DUAL FORMAT FOR COMPATIBILITY
 * Returns BOTH old and new formats
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[Knowledge] Query started');
    
    const body = await req.json();
    const prompt = body.prompt || body.message || body.question || '';

    if (!prompt.trim()) {
      console.error('[Knowledge] Empty prompt');
      return NextResponse.json({
        // NEW format
        messages: [{
          role: "assistant",
          content: "Please provide a question"
        }],
        // OLD format
        sources: [],
        answer: "",
        success: false,
        error: "Please provide a question"
      }, { status: 200 });
    }

    console.log('[Knowledge] Getting AI response');
    
    const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
    
    const apiKey = getProviderApiKey('anthropic');
    const provider = getProvider('anthropic', apiKey);
    
    let response = '';
    for await (const chunk of provider.generateStream(prompt)) {
      response += chunk;
    }

    console.log('[Knowledge] Success');
    
    // Return BOTH formats for maximum compatibility
    return NextResponse.json({
      // NEW format (messages)
      messages: [{
        role: "assistant",
        content: response || "No response generated"
      }],
      // OLD format (sources + answer)
      sources: [{
        title: "AI Response",
        content: response || "No response generated",
        relevance: 1.0
      }],
      answer: response || "No response generated",
      success: true,
      fallbackUsed: true
    }, { status: 200 });

  } catch (error) {
    console.error('[Knowledge] Error:', error);
    
    // Extract better error message
    let errorMsg = 'I encountered an error. Please try again.';
    if (error instanceof Error) {
      if (error.message.includes('Missing') && error.message.includes('API_KEY')) {
        errorMsg = 'The AI service is not configured. Please contact support.';
      } else if (error.message.includes('Anthropic')) {
        errorMsg = 'The AI service encountered an error. Please try a different mode or contact support.';
      } else {
        errorMsg = `Error: ${error.message}`;
      }
    }
    
    return NextResponse.json({
      messages: [{
        role: "assistant",
        content: errorMsg
      }],
      sources: [],
      answer: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    messages: [{
      role: "assistant",
      content: "This endpoint requires POST"
    }],
    sources: [],
    success: false,
    error: "Method not allowed"
  }, { status: 200 });
}

export async function PUT() { return GET(); }
export async function DELETE() { return GET(); }
export async function PATCH() { return GET(); }
