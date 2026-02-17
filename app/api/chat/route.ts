// app/api/chat/route.ts
/**
 * Chat API - FULL ENVELOPE NORMALIZATION
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
    let body: ChatRequest;
    try {
      body = await req.json();
    } catch (parseError) {
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

    const { message, mode = 'single', provider = 'anthropic' } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      const envelope = normalizeEnvelope(
        "I encountered an error: Please provide a message. Please try again.",
        {
          success: false,
          error: "Empty or invalid message",
          latency: Date.now() - startTime,
          provider,
        }
      );
      return NextResponse.json(envelope, { status: 200 });
    }

    console.log(`[Chat] Processing: mode=${mode}, provider=${provider}`);

    try {
      if (mode === 'roadmap') {
        return await handleRoadmapMode(message, body, provider, startTime);
      } else if (mode === 'advanced') {
        return await handleAdvancedMode(message, body, provider, startTime);
      } else if (mode === 'super') {
        return await handleSuperMode(message, body, provider, startTime);
      } else {
        return await handleSingleMode(message, body, provider, startTime);
      }
    } catch (modeError) {
      console.error(`[Chat] Mode handler (${mode}) error:`, modeError);
      
      try {
        return await fallbackToProvider(message, provider, startTime);
      } catch (fallbackError) {
        console.error('[Chat] Fallback failed:', fallbackError);
        const envelope = normalizeEnvelope(
          "I encountered an error: All routing methods failed. Please try again.",
          {
            success: false,
            error: fallbackError instanceof Error ? fallbackError.message : "Unknown error",
            latency: Date.now() - startTime,
            provider,
          }
        );
        return NextResponse.json(envelope, { status: 200 });
      }
    }

  } catch (error) {
    console.error('[Chat] Top-level error:', error);
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

async function handleSingleMode(
  message: string,
  body: ChatRequest,
  providerName: string,
  startTime: number
): Promise<NextResponse> {
  console.log('[Chat] handleSingleMode: Starting');
  
  const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
  
  const apiKey = getProviderApiKey(providerName);
  const provider = getProvider(providerName, apiKey);
  
  let response = '';
  for await (const chunk of provider.generateStream(message)) {
    response += chunk;
  }

  console.log('[Chat] handleSingleMode: Success');
  
  const envelope = normalizeEnvelope(response, {
    success: true,
    provider: providerName,
    model: 'claude-3-5-sonnet-20241022',
    latency: Date.now() - startTime,
    tokensIn: Math.ceil(message.length / 4),
    tokensOut: Math.ceil(response.length / 4),
  });
  
  return NextResponse.json(envelope, { status: 200 });
}

async function handleSuperMode(
  message: string,
  body: ChatRequest,
  providerName: string,
  startTime: number
): Promise<NextResponse> {
  console.log('[Chat] handleSuperMode: Starting');
  
  const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
  
  const apiKey = getProviderApiKey('anthropic');
  const provider = getProvider('anthropic', apiKey);
  
  let response = '';
  for await (const chunk of provider.generateStream(message)) {
    response += chunk;
  }

  console.log('[Chat] handleSuperMode: Success');
  
  const envelope = normalizeEnvelope(response, {
    success: true,
    provider: 'multi-provider',
    model: 'claude-3-5-sonnet-20241022',
    latency: Date.now() - startTime,
    tokensIn: Math.ceil(message.length / 4),
    tokensOut: Math.ceil(response.length / 4),
  });
  
  return NextResponse.json(envelope, { status: 200 });
}

async function handleAdvancedMode(
  message: string,
  body: ChatRequest,
  providerName: string,
  startTime: number
): Promise<NextResponse> {
  console.log('[Chat] handleAdvancedMode: Starting');
  
  const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
  
  const apiKey = getProviderApiKey('anthropic');
  const provider = getProvider('anthropic', apiKey);
  
  let response = '';
  for await (const chunk of provider.generateStream(message)) {
    response += chunk;
  }

  console.log('[Chat] handleAdvancedMode: Success');
  
  const envelope = normalizeEnvelope(response, {
    success: true,
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    latency: Date.now() - startTime,
    tokensIn: Math.ceil(message.length / 4),
    tokensOut: Math.ceil(response.length / 4),
  });
  
  return NextResponse.json(envelope, { status: 200 });
}

async function handleRoadmapMode(
  message: string,
  body: ChatRequest,
  providerName: string,
  startTime: number
): Promise<NextResponse> {
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
  
  const responseText = result.executionResult?.response || 
                      result.response || 
                      result.content || 
                      'Roadmap execution initiated';
  
  const envelope = normalizeEnvelope(responseText, {
    success: true,
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    latency: Date.now() - startTime,
    tokensIn: Math.ceil(message.length / 4),
    tokensOut: Math.ceil(responseText.length / 4),
    metadata: {
      mode: 'roadmap',
      requestId: result.requestId,
    },
  });
  
  return NextResponse.json(envelope, { status: 200 });
}

async function fallbackToProvider(
  message: string,
  providerName: string,
  startTime: number
): Promise<NextResponse> {
  console.log('[Chat] fallbackToProvider: Starting');
  
  const { getProvider, getProviderApiKey } = await import('@/lib/javari/providers');
  
  const apiKey = getProviderApiKey('anthropic');
  const provider = getProvider('anthropic', apiKey);
  
  let response = '';
  for await (const chunk of provider.generateStream(message)) {
    response += chunk;
  }

  console.log('[Chat] fallbackToProvider: Success');
  
  const envelope = normalizeEnvelope(response, {
    success: true,
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    latency: Date.now() - startTime,
    tokensIn: Math.ceil(message.length / 4),
    tokensOut: Math.ceil(response.length / 4),
    metadata: {
      fallbackUsed: true,
    },
  });
  
  return NextResponse.json(envelope, { status: 200 });
}

export async function GET() {
  console.error('[Chat] GET request - method not allowed');
  const envelope = normalizeEnvelope(
    "I encountered an error: This endpoint requires POST. Please try again.",
    {
      success: false,
      error: "Method not allowed - use POST",
    }
  );
  return NextResponse.json(envelope, { status: 200 });
}
