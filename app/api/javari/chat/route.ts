/**
 * Javari AI Enhanced Multi-Model Chat API Route
 * Supports: OpenAI GPT-4, Claude Sonnet 4.5, Claude Opus 4
 * 
 * @route /api/javari/chat
 * @version 3.0.0 - MULTI-MODEL SUPPORT
 * @last-updated 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Supported AI models
export type AIModel = 
  | 'gpt-4-turbo-preview' 
  | 'gpt-4' 
  | 'gpt-3.5-turbo'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  projectId?: string;
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  parentId?: string;
  model?: AIModel; // Model selection
  maxTokens?: number;
  temperature?: number;
}

interface ModelCapabilities {
  name: string;
  provider: 'openai' | 'anthropic';
  maxTokens: number;
  supportsStreaming: boolean;
  costPer1kTokens: { input: number; output: number };
}

// Model configuration
const MODEL_CONFIG: Record<AIModel, ModelCapabilities> = {
  'gpt-4-turbo-preview': {
    name: 'GPT-4 Turbo',
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.01, output: 0.03 },
  },
  'gpt-4': {
    name: 'GPT-4',
    provider: 'openai',
    maxTokens: 8192,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.03, output: 0.06 },
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    maxTokens: 16384,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.0015, output: 0.002 },
  },
  'claude-sonnet-4-5-20250929': {
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.003, output: 0.015 },
  },
  'claude-opus-4-20250514': {
    name: 'Claude Opus 4',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.015, output: 0.075 },
  },
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    maxTokens: 200000,
    supportsStreaming: true,
    costPer1kTokens: { input: 0.003, output: 0.015 },
  },
};

/**
 * Stream response from OpenAI
 */
async function streamOpenAI(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: AIModel,
  maxTokens: number,
  temperature: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string> {
  let fullResponse = '';

  const response = await openai.chat.completions.create({
    model: model,
    messages: messages,
    stream: true,
    max_tokens: maxTokens,
    temperature: temperature,
  });

  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullResponse += content;
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
    }
  }

  return fullResponse;
}

/**
 * Stream response from Claude (Anthropic)
 */
async function streamClaude(
  messages: ChatMessage[],
  systemPrompt: string,
  model: AIModel,
  maxTokens: number,
  temperature: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string> {
  let fullResponse = '';

  // Convert messages to Claude format
  const claudeMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  const response = await anthropic.messages.stream({
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    system: systemPrompt,
    messages: claudeMessages as any,
  });

  for await (const chunk of response) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      const content = chunk.delta.text;
      fullResponse += content;
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
    }
  }

  return fullResponse;
}

/**
 * Calculate estimated cost based on token usage
 */
function estimateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
  const config = MODEL_CONFIG[model];
  const inputCost = (inputTokens / 1000) * config.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * config.costPer1kTokens.output;
  return inputCost + outputCost;
}

/**
 * Rough token estimation (4 chars ≈ 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * POST /api/javari/chat
 * Multi-model chat endpoint with streaming support
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { 
      message, 
      history = [], 
      projectId, 
      sessionId, 
      userId, 
      conversationId, 
      parentId,
      model = 'gpt-4-turbo-preview', // Default model
      maxTokens = 4096,
      temperature = 0.7,
    } = body;

    // Validate request
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate model
    if (!MODEL_CONFIG[model]) {
      return NextResponse.json(
        { error: `Invalid model: ${model}. Supported models: ${Object.keys(MODEL_CONFIG).join(', ')}` },
        { status: 400 }
      );
    }

    const modelConfig = MODEL_CONFIG[model];

    // Check API keys
    if (modelConfig.provider === 'openai' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    if (modelConfig.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key is not configured' },
        { status: 500 }
      );
    }

    // Build contextual system prompt
    const contextualSystemPrompt = `${JAVARI_SYSTEM_PROMPT}

## CURRENT CONVERSATION CONTEXT
${projectId ? `Project ID: ${projectId}` : 'No specific project context'}
${sessionId ? `Session ID: ${sessionId}` : 'New session'}
${conversationId ? `Conversation ID: ${conversationId}` : parentId ? 'This is a continuation of a previous conversation' : 'This is a new conversation'}
${userId ? `User ID: ${userId}` : 'User: demo-user'}
Model: ${modelConfig.name} (${model})

Remember: You know Roy and Cindy Henderson. You understand the CR AudioViz AI mission. Respond as their partner, not a generic AI.`;

    let fullResponse = '';
    let newConversationId = conversationId;
    let inputTokens = 0;
    let outputTokens = 0;

    // Estimate input tokens
    const historyText = history.map(m => m.content).join(' ');
    inputTokens = estimateTokens(contextualSystemPrompt + historyText + message);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Route to appropriate AI provider
          if (modelConfig.provider === 'openai') {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              { role: 'system', content: contextualSystemPrompt },
              ...history.map((msg) => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              })),
              { role: 'user', content: message },
            ];

            fullResponse = await streamOpenAI(
              messages,
              model,
              maxTokens,
              temperature,
              controller,
              encoder
            );
          } else if (modelConfig.provider === 'anthropic') {
            const messages: ChatMessage[] = [
              ...history,
              { role: 'user', content: message },
            ];

            fullResponse = await streamClaude(
              messages,
              contextualSystemPrompt,
              model,
              maxTokens,
              temperature,
              controller,
              encoder
            );
          }

          // Estimate output tokens and cost
          outputTokens = estimateTokens(fullResponse);
          const estimatedCost = estimateCost(model, inputTokens, outputTokens);

          // Save to database after streaming completes
          if (userId) {
            try {
              const updatedMessages = [
                ...history,
                { role: 'user' as const, content: message, timestamp: new Date().toISOString() },
                { role: 'assistant' as const, content: fullResponse, timestamp: new Date().toISOString() }
              ];

              if (conversationId) {
                // Update existing conversation
                await supabase
                  .from('conversations')
                  .update({
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', conversationId);
              } else {
                // Calculate continuation depth if has parent
                let continuationDepth = 0;
                if (parentId) {
                  const { data: parent } = await supabase
                    .from('conversations')
                    .select('continuation_depth')
                    .eq('id', parentId)
                    .single();

                  if (parent) {
                    continuationDepth = parent.continuation_depth + 1;
                  }
                }

                // Create new conversation
                const title = message.slice(0, 100);
                const { data } = await supabase
                  .from('conversations')
                  .insert({
                    user_id: userId,
                    project_id: projectId,
                    parent_id: parentId || null,
                    title,
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    model: model,
                    status: 'active',
                    starred: false,
                    continuation_depth: continuationDepth,
                    token_count: inputTokens + outputTokens,
                    estimated_cost: estimatedCost,
                  })
                  .select()
                  .single();

                if (data) {
                  newConversationId = data.id;
                }
              }

              // Log usage for analytics
              await supabase
                .from('javari_usage_logs')
                .insert({
                  user_id: userId,
                  conversation_id: newConversationId,
                  model: model,
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  estimated_cost: estimatedCost,
                  provider: modelConfig.provider,
                });
            } catch (dbError) {
              console.error('Error saving conversation:', dbError);
              // Don't fail the request if DB save fails
            }
          }

          // Send completion signal with metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                done: true, 
                conversationId: newConversationId,
                metadata: {
                  model: model,
                  provider: modelConfig.provider,
                  inputTokens: inputTokens,
                  outputTokens: outputTokens,
                  estimatedCost: estimatedCost,
                }
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: unknown) {
          logError('Streaming error:', error);
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
  } catch (error: unknown) {
    logError('Javari chat error:', error);
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
 * Get available models and their capabilities
 */
export async function GET() {
  return NextResponse.json({
    models: MODEL_CONFIG,
    defaultModel: 'gpt-4-turbo-preview',
  });
}
