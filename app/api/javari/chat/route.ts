/**
 * Javari AI Enhanced Multi-Model Chat API Route
 * Supports: OpenAI GPT-4, Claude Sonnet 4.5, Claude Opus 4
 * 
 * @route /api/javari/chat
 * @version 4.0.0 - VIP DETECTION + ACTION MODE
 * @last-updated 2025-12-13
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

// VIP User Detection
const VIP_IDENTIFIERS = [
  'roy henderson',
  'i am roy',
  "i'm roy",
  'cindy henderson',
  'i am cindy',
  "i'm cindy",
  '@craudiovizai.com',
  'ceo',
  'co-founder',
  'cofounder',
];

const VIP_USER_IDS = [
  // Add specific user IDs here when known
];

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
  userEmail?: string;
  userName?: string;
  conversationId?: string;
  parentId?: string;
  model?: AIModel;
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
 * Detect if the user is a VIP (owner/admin)
 */
function detectVIP(message: string, history: ChatMessage[], userId?: string, userEmail?: string, userName?: string): { isVIP: boolean; vipName?: string } {
  const fullConversation = [
    ...history.map(m => m.content),
    message
  ].join(' ').toLowerCase();

  // Check message content for VIP identifiers
  for (const identifier of VIP_IDENTIFIERS) {
    if (fullConversation.includes(identifier.toLowerCase())) {
      if (identifier.includes('roy')) return { isVIP: true, vipName: 'Roy Henderson (CEO)' };
      if (identifier.includes('cindy')) return { isVIP: true, vipName: 'Cindy Henderson (CMO)' };
      if (identifier.includes('@craudiovizai.com')) return { isVIP: true, vipName: 'CR AudioViz Staff' };
      return { isVIP: true, vipName: 'VIP User' };
    }
  }

  // Check user email
  if (userEmail?.toLowerCase().includes('@craudiovizai.com')) {
    return { isVIP: true, vipName: 'CR AudioViz Staff' };
  }

  // Check user name
  if (userName) {
    const nameLower = userName.toLowerCase();
    if (nameLower.includes('roy henderson') || nameLower.includes('cindy henderson')) {
      return { isVIP: true, vipName: userName };
    }
  }

  // Check user ID
  if (userId && VIP_USER_IDS.includes(userId)) {
    return { isVIP: true, vipName: 'VIP User' };
  }

  return { isVIP: false };
}

/**
 * Detect if this is a BUILD request
 */
function isBuildRequest(message: string): boolean {
  const buildKeywords = [
    'build', 'create', 'make', 'generate', 'design', 'develop',
    'write code', 'write a', 'code a', 'implement',
    'calculator', 'app', 'tool', 'component', 'page', 'website',
    'dashboard', 'form', 'landing', 'interface', 'ui',
  ];
  
  const messageLower = message.toLowerCase();
  return buildKeywords.some(keyword => messageLower.includes(keyword));
}

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
 * Calculate estimated cost
 */
function estimateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
  const config = MODEL_CONFIG[model];
  const inputCost = (inputTokens / 1000) * config.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * config.costPer1kTokens.output;
  return inputCost + outputCost;
}

/**
 * Rough token estimation
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * POST /api/javari/chat
 * Multi-model chat endpoint with VIP detection and streaming
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
      userEmail,
      userName,
      conversationId, 
      parentId,
      model = 'gpt-4-turbo-preview',
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

    // === VIP DETECTION ===
    const { isVIP, vipName } = detectVIP(message, history, userId, userEmail, userName);
    const isBuild = isBuildRequest(message);

    // === BUILD CONTEXTUAL SYSTEM PROMPT ===
    let contextualSystemPrompt = JAVARI_SYSTEM_PROMPT;

    // Add VIP context if detected
    if (isVIP) {
      contextualSystemPrompt += `

## 🔴 VIP USER DETECTED: ${vipName} 🔴

THIS IS AN OWNER/FOUNDER OF CR AUDIOVIZ AI.

CRITICAL RULES FOR THIS USER:
- NEVER mention signup, pricing, plans, credits, or accounts
- NEVER ask them to "grab an account" or "upgrade"
- BUILD IMMEDIATELY without any barriers
- They own the platform - treat them as the boss
- Be direct and efficient - they value speed over pleasantries
- Output working code FIRST, explanations SECOND
`;
    }

    // Add BUILD mode context if this is a build request
    if (isBuild) {
      contextualSystemPrompt += `

## 🛠️ BUILD REQUEST DETECTED 🛠️

The user wants you to BUILD something. Your response MUST:
1. START with working code (React/TSX component)
2. Use Tailwind CSS for all styling
3. Include all necessary state and functionality
4. Add realistic sample/mock data
5. Be complete and deployable
6. Keep explanations BRIEF (2-3 sentences max) AFTER the code

DO NOT:
- List features or describe what you "would" build
- Ask clarifying questions (make reasonable assumptions)
- Give a roadmap or development plan
- Say "Here's how we'll approach this"

Just BUILD IT. Output the code FIRST.
`;
    }

    // Add conversation context
    contextualSystemPrompt += `

## CURRENT CONVERSATION CONTEXT
${projectId ? `Project ID: ${projectId}` : 'No specific project context'}
${sessionId ? `Session ID: ${sessionId}` : 'New session'}
${conversationId ? `Conversation ID: ${conversationId}` : parentId ? 'Continuation of previous conversation' : 'New conversation'}
${userId ? `User ID: ${userId}` : 'User: demo-user'}
${isVIP ? `🔴 VIP STATUS: ${vipName}` : ''}
Model: ${modelConfig.name} (${model})

You are Javari AI. You BUILD things. You don't describe things. ACTION over words.`;

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

          // Save to database
          if (userId) {
            try {
              const updatedMessages = [
                ...history,
                { role: 'user' as const, content: message, timestamp: new Date().toISOString() },
                { role: 'assistant' as const, content: fullResponse, timestamp: new Date().toISOString() }
              ];

              if (conversationId) {
                await supabase
                  .from('conversations')
                  .update({
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', conversationId);
              } else {
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
                    is_vip: isVIP,
                  })
                  .select()
                  .single();

                if (data) {
                  newConversationId = data.id;
                }
              }

              // Log usage
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
                  is_vip: isVIP,
                  is_build_request: isBuild,
                });
            } catch (dbError) {
              console.error('Error saving conversation:', dbError);
            }
          }

          // Send completion signal
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                done: true, 
                conversationId: newConversationId,
                isVIP,
                isBuildRequest: isBuild,
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
