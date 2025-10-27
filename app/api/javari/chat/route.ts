/**
 * Javari AI Chat API Route - FIXED & WORKING
 * Handles chat requests with Anthropic Claude
 * 
 * @route /api/javari/chat
 * @version 1.1.0 - SIMPLIFIED & WORKING
 * @last-updated 2025-10-27 11:40 AM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  projectId?: string;
  sessionId?: string;
}

/**
 * POST /api/javari/chat
 * Main chat endpoint with streaming support
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, history = [], projectId, sessionId } = body;

    // Validate request
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not configured');
      return NextResponse.json(
        { error: 'AI service is not properly configured' },
        { status: 500 }
      );
    }

    // Build conversation history for Claude
    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // System prompt for Javari
    const systemPrompt = `You are Javari AI, an autonomous AI assistant for CR AudioViz AI developers.

Your core abilities:
- Help developers build, debug, and deploy applications
- Provide code examples and solutions
- Explain technical concepts clearly
- Learn from interactions to improve over time
- Access project context and build health data

Your personality:
- Professional but friendly
- Direct and action-oriented
- Fortune 50 quality standards
- "Let's make it happen" attitude
- Partner mindset: "Your success is my success"

Always:
- Provide complete, working code solutions
- Be honest if you don't know something
- Suggest better approaches when relevant
- Focus on what actually works

Current context:
${projectId ? `Project ID: ${projectId}` : 'No project context'}
${sessionId ? `Session ID: ${sessionId}` : 'New session'}`;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create streaming request to Claude
          const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages,
            stream: true,
          });

          // Stream the response chunks
          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const chunk = event.delta.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Javari chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'An error occurred while processing your request',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/chat
 * Get Javari info and capabilities
 */
export async function GET() {
  return NextResponse.json({
    name: 'Javari AI',
    version: '1.1.0',
    status: 'operational',
    model: 'claude-3-5-sonnet-20241022',
    features: [
      'Real-time streaming responses',
      'Conversation history support',
      'Project context awareness',
      'Code generation and debugging',
      'Self-healing capabilities',
    ],
    greeting: "Hey! I'm Javari, your AI development partner. How can I help you build something amazing today?",
  });
}
