/**
 * JAVARI AI - Chat API with Cost Tracking
 * 
 * Every request is:
 * 1. Classified by complexity
 * 2. Routed to optimal AI
 * 3. Cost-tracked for billing
 * 4. Logged for analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeQuery, getUserUsageSummary } from '@/lib/ai/cost-router';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { messages, userId = 'anonymous' } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from user' },
        { status: 400 }
      );
    }
    
    // Route through cost-optimized router
    const result = await routeQuery(
      userId,
      lastMessage.content,
      messages.slice(0, -1) // Conversation history
    );
    
    // Return response with cost info
    return NextResponse.json({
      content: result.response,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.inputTokens + result.outputTokens,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUSD: result.costUSD,
      responseTimeMs: result.responseTimeMs,
      totalTimeMs: Date.now() - startTime,
      complexity: result.complexity,
      version: '10.0-cost-optimized',
    });
    
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint for usage summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }
    
    const summary = await getUserUsageSummary(userId);
    
    return NextResponse.json(summary);
    
  } catch (error: unknown) {
    console.error('Usage summary error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get usage summary' },
      { status: 500 }
    );
  }
}
