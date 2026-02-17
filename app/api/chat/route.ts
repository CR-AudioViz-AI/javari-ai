// app/api/chat/route.ts
/**
 * Chat API - DUAL FORMAT FOR MAXIMUM COMPATIBILITY
 * 
 * Returns BOTH:
 * - Frontend format: { response, success, error }
 * - Normalized format: { messages, sources, answer }
 * 
 * CRITICAL PATCH: Uses normalizePayload for ALL responses
 */

import { NextRequest, NextResponse } from "next/server";
import { normalizePayload } from "@/lib/normalize-envelope";

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
      
      const normalized = normalizePayload({
        content: "Please provide a message",
        success: false,
        fallbackUsed: true,
        error: "Empty or invalid message",
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          reason: "validation_error"
        }
      });
      
      // Add frontend format fields
      return NextResponse.json({
        ...normalized,
        response: "Please provide a message",
        provider,
        mode,
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
      
      const normalized = normalizePayload({
        content: response || 'No response generated',
        answer: response || 'No response generated',
        success: true,
        fallbackUsed: false,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        }
      });
      
      // Return format that frontend expects PLUS normalized fields
      return NextResponse.json({
        ...normalized,
        response: response || 'No response generated',
        provider,
        mode,
      }, { status: 200 });
      
    } catch (providerError) {
      console.error('[Chat] Provider error:', providerError);
      
      const errorMsg = `I encountered an error: ${providerError instanceof Error ? providerError.message : 'Unknown error'}. Please try again.`;
      
      const normalized = normalizePayload({
        content: errorMsg,
        success: false,
        fallbackUsed: true,
        error: providerError instanceof Error ? providerError.message : 'Unknown error',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          reason: "provider_error"
        }
      });
      
      return NextResponse.json({
        ...normalized,
        response: errorMsg,
        provider,
        mode,
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[Chat] Top-level error:', error);
    
    const normalized = normalizePayload({
      content: "I encountered an unexpected error. Please try again.",
      success: false,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        reason: "top_level_error"
      }
    });
    
    return NextResponse.json({
      ...normalized,
      response: "I encountered an unexpected error. Please try again.",
    }, { status: 200 });
  }
}

export async function GET() {
  const normalized = normalizePayload({
    content: "This endpoint requires POST",
    success: false,
    fallbackUsed: false,
    error: "Method not allowed",
    metadata: {
      reason: "method_not_allowed"
    }
  });
  
  return NextResponse.json({
    ...normalized,
    response: "This endpoint requires POST",
  }, { status: 200 });
}
