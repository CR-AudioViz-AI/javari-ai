// app/api/chat/route.ts
/**
 * Chat API - MATCHES FRONTEND EXPECTATIONS
 * 
 * Frontend expects: data.response
 * Returns what ChatInterface line 137 needs
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

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ChatRequest = await req.json();
    const { message, mode = 'single', provider = 'anthropic' } = body;

    // Validate message
    if (!message || typeof message !== 'string' || !message.trim()) {
      console.error('[Chat] Empty message');
      return NextResponse.json({
        response: "Please provide a message",
        success: false,
        error: "Empty or invalid message",
        provider,
        mode,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      }, { status: 200 });
    }

    console.log(`[Chat] Processing: mode=${mode}, provider=${provider}`);

    try {
      // Get AI response
      const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
      
      const apiKey = getProviderApiKey(provider);
      if (!apiKey) {
        throw new Error(`Missing API key for ${provider}`);
      }
      
      const providerInstance = getProvider(provider, apiKey);
      
      let response = '';
      for await (const chunk of providerInstance.generateStream(message)) {
        response += chunk;
      }

      console.log('[Chat] Success');
      
      // Return format that frontend expects
      return NextResponse.json({
        response: response || 'No response generated',
        success: true,
        provider,
        mode,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      }, { status: 200 });
      
    } catch (providerError) {
      console.error('[Chat] Provider error:', providerError);
      
      return NextResponse.json({
        response: `I encountered an error: ${providerError instanceof Error ? providerError.message : 'Unknown error'}. Please try again.`,
        success: false,
        error: providerError instanceof Error ? providerError.message : 'Unknown error',
        provider,
        mode,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[Chat] Top-level error:', error);
    
    return NextResponse.json({
      response: "I encountered an unexpected error. Please try again.",
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    response: "This endpoint requires POST",
    success: false,
    error: "Method not allowed",
  }, { status: 200 });
}
