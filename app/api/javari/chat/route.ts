/**
 * Javari AI Chat API Route - OpenAI Version
 * Using GPT-4 for reliable chat functionality
 * 
 * @route /api/javari/chat
 * @version 1.2.0 - WORKING WITH OPENAI
 * @last-updated 2025-10-27 12:10 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
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
 * Main chat endpoint with streaming support using OpenAI GPT-4
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
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'AI service is not properly configured' },
        { status: 500 }
      );
    }

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

    // Build messages array for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create streaming request to OpenAI
          const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.7,
          });

          // Stream the response chunks
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
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
    version: '1.2.0',
    status: 'operational',
    model: 'gpt-4-turbo-preview',
    provider: 'OpenAI',
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
