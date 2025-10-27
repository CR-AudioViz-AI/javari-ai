/**
 * Javari AI Chat API Route
 * Handles chat requests with multi-model support and function calling
 * 
 * @route /api/javari/chat
 * @version 4.0.0
 * @last-updated 2025-10-27
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJavariMultiModel, type AIModel } from '@/lib/javari-multi-model';
import { javariKB, enhanceResponseWithKnowledge } from '@/lib/javari-knowledge-base';
import { JAVARI_GREETING } from '@/lib/javari-system-prompt';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface ChatRequest {
  message: string;
  model?: AIModel;
  conversationHistory?: Array<{ role: string; content: string }>;
  userId?: string;
  sessionId?: string;
  stream?: boolean;
}

/**
 * POST /api/javari/chat
 * Main chat endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const {
      message,
      model = 'claude-3-5-sonnet-20241022',
      conversationHistory = [],
      userId,
      sessionId,
      stream = false
    } = body;

    // Validate request
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get API keys from environment
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiKey || !anthropicKey) {
      return NextResponse.json(
        { error: 'AI service configuration error' },
        { status: 500 }
      );
    }

    // Initialize multi-model handler
    const javari = createJavariMultiModel(openaiKey, anthropicKey);

    // Enhance user query with knowledge base context
    const { knowledge, suggestions } = await enhanceResponseWithKnowledge(message);
    
    let contextualMessage = message;
    if (suggestions.length > 0) {
      contextualMessage += `\n\n[Knowledge Base Context: ${suggestions.join('; ')}]`;
    }

    // Prepare messages for AI
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: contextualMessage
      }
    ];

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const interactionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            let fullResponse = '';
            const startTime = Date.now();

            // Stream response chunks
            for await (const chunk of javari.chatStream({
              model,
              messages,
              userId,
              sessionId
            })) {
              fullResponse += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk, interactionId })}\n\n`));
            }

            // Record interaction in knowledge base
            const duration = Date.now() - startTime;
            await javariKB.recordInteraction({
              userId: userId || 'anonymous',
              sessionId: sessionId || 'unknown',
              query: message,
              response: fullResponse,
              wasHelpful: null,
              toolsUsed: [],
              functionsCall: [],
              duration
            });

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Non-streaming response
    const startTime = Date.now();
    const response = await javari.chat({
      model,
      messages,
      userId,
      sessionId
    });
    const duration = Date.now() - startTime;

    // Record interaction
    const interactionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await javariKB.recordInteraction({
      userId: userId || 'anonymous',
      sessionId: sessionId || 'unknown',
      query: message,
      response,
      wasHelpful: null,
      toolsUsed: [],
      functionsCall: [],
      duration
    });

    return NextResponse.json({
      response,
      interactionId,
      model,
      tokensUsed: Math.ceil((message.length + response.length) / 4), // Rough estimate
      processingTime: duration
    });

  } catch (error) {
    console.error('Javari chat error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while processing your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/chat
 * Get Javari greeting message
 */
export async function GET() {
  return NextResponse.json({
    greeting: JAVARI_GREETING,
    models: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    features: [
      'Multi-model support',
      'Function calling',
      'Knowledge base integration',
      'Learning from interactions',
      'Streaming responses'
    ]
  });
}

/**
 * PUT /api/javari/chat
 * Update interaction feedback
 */
export async function PUT(request: NextRequest) {
  try {
    const { interactionId, wasHelpful, feedback } = await request.json();

    if (!interactionId || typeof wasHelpful !== 'boolean') {
      return NextResponse.json(
        { error: 'interactionId and wasHelpful are required' },
        { status: 400 }
      );
    }

    await javariKB.learnFromFeedback(interactionId, wasHelpful, feedback);

    return NextResponse.json({
      success: true,
      message: 'Thank you for your feedback! I\'ll learn from this.'
    });

  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}
