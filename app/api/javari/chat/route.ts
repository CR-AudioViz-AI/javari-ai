/**
 * JAVARI CHAT API
 * Main endpoint that routes all conversations through the AI aggregation system
 * 
 * POST /api/javari/chat
 * 
 * @author CR AudioViz AI
 * @created December 22, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { JavariAIRouter, initializeRouter, classifyTask, type AIProvider } from './ai-router';

// ============================================================
// TYPES
// ============================================================

interface ChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
  systemPrompt?: string;
  preferredProvider?: AIProvider;
  options?: {
    maxTokens?: number;
    temperature?: number;
    preferSpeed?: boolean;
    preferCost?: boolean;
    preferQuality?: boolean;
  };
}

interface ChatResponse {
  success: boolean;
  response?: {
    content: string;
    provider: AIProvider;
    model: string;
    taskType: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latency: number;
    creditsUsed: number;
  };
  conversationId?: string;
  error?: string;
}

// ============================================================
// SUPABASE CLIENT
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================
// INITIALIZE ROUTER WITH ALL API KEYS
// ============================================================

function getRouter(): JavariAIRouter {
  return initializeRouter({
    'claude-3-5-sonnet': process.env.ANTHROPIC_API_KEY,
    'claude-3-opus': process.env.ANTHROPIC_API_KEY,
    'claude-3-haiku': process.env.ANTHROPIC_API_KEY,
    'gpt-4-turbo': process.env.OPENAI_API_KEY,
    'gpt-4o': process.env.OPENAI_API_KEY,
    'gpt-3.5-turbo': process.env.OPENAI_API_KEY,
    'gemini-1.5-pro': process.env.GOOGLE_AI_API_KEY,
    'gemini-1.5-flash': process.env.GOOGLE_AI_API_KEY,
    'mistral-large': process.env.MISTRAL_API_KEY,
    'mistral-medium': process.env.MISTRAL_API_KEY,
    'perplexity-sonar': process.env.PERPLEXITY_API_KEY,
  });
}

// ============================================================
// JAVARI SYSTEM PROMPT
// ============================================================

const JAVARI_SYSTEM_PROMPT = `You are Javari, the AI assistant for CR AudioViz AI platform.

Your core traits:
- Helpful, knowledgeable, and efficient
- Direct and actionable - you provide solutions, not just information
- You remember context from the conversation
- You're powered by a multi-AI system that routes to the best AI for each task

When users ask about the platform:
- CR AudioViz AI offers 60+ creative tools, 1200+ games, and Javari AI assistance
- Tools include logo generators, social media creators, landing page builders, and more
- Credits are the universal currency - users purchase credits and spend them on tools
- The platform mission is "Your Story. Our Design."

When helping users:
1. Understand what they need
2. Provide clear, actionable guidance
3. If they need a tool, point them to the right one
4. If they need code, write complete, working code
5. If they need research, provide accurate, sourced information

You are backed by Claude, GPT-4, Gemini, Mistral, and Perplexity - using whichever AI is best for each task.
You never give up. If one approach doesn't work, you try another.
You remember who helped you, and you always reciprocate.`;

// ============================================================
// CREDIT CALCULATION
// ============================================================

function calculateCredits(inputTokens: number, outputTokens: number, provider: string): number {
  // Base: 1 credit per 1000 tokens (combined)
  const totalTokens = inputTokens + outputTokens;
  let credits = Math.ceil(totalTokens / 1000);
  
  // Minimum 1 credit
  credits = Math.max(1, credits);
  
  // Premium providers cost more
  if (provider.includes('opus') || provider.includes('gpt-4-turbo')) {
    credits = Math.ceil(credits * 1.5);
  }
  
  // Budget providers cost less
  if (provider.includes('haiku') || provider.includes('3.5') || provider.includes('flash')) {
    credits = Math.ceil(credits * 0.5);
  }
  
  return credits;
}

// ============================================================
// MAIN API HANDLER
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now();
  
  try {
    const body: ChatRequest = await request.json();
    
    if (!body.message) {
      return NextResponse.json({
        success: false,
        error: 'Message is required',
      }, { status: 400 });
    }
    
    // Initialize router
    const router = getRouter();
    
    // Check available providers
    const availableProviders = router.getAvailableProviders();
    if (availableProviders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No AI providers available. Please check API keys.',
      }, { status: 503 });
    }
    
    // Classify task
    const taskType = classifyTask(body.message);
    
    // Build system prompt
    const systemPrompt = body.systemPrompt 
      ? `${JAVARI_SYSTEM_PROMPT}\n\nAdditional context:\n${body.systemPrompt}`
      : JAVARI_SYSTEM_PROMPT;
    
    // Execute with fallback
    const aiResponse = await router.executeWithFallback(
      body.message,
      systemPrompt,
      {
        maxTokens: body.options?.maxTokens || 4096,
        temperature: body.options?.temperature || 0.7,
      }
    );
    
    // Calculate credits
    const creditsUsed = calculateCredits(
      aiResponse.inputTokens,
      aiResponse.outputTokens,
      aiResponse.provider
    );
    
    // Generate or use conversation ID
    const conversationId = body.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log to database (async, don't wait)
    logConversation(
      conversationId,
      body.userId,
      body.message,
      aiResponse.content,
      aiResponse.provider,
      taskType,
      aiResponse.inputTokens,
      aiResponse.outputTokens,
      aiResponse.cost,
      aiResponse.latency,
      creditsUsed,
      aiResponse.success
    ).catch(err => console.error('[Javari] Failed to log conversation:', err));
    
    // Return response
    return NextResponse.json({
      success: aiResponse.success,
      response: {
        content: aiResponse.content,
        provider: aiResponse.provider,
        model: aiResponse.model,
        taskType,
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
        cost: aiResponse.cost,
        latency: aiResponse.latency,
        creditsUsed,
      },
      conversationId,
      error: aiResponse.error,
    });
    
  } catch (error: any) {
    console.error('[Javari] API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

// ============================================================
// DATABASE LOGGING
// ============================================================

async function logConversation(
  conversationId: string,
  userId: string | undefined,
  userMessage: string,
  assistantMessage: string,
  provider: string,
  taskType: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  latency: number,
  creditsUsed: number,
  success: boolean
): Promise<void> {
  // Log conversation
  await supabase.from('javari_conversations').upsert({
    id: conversationId,
    user_id: userId || 'anonymous',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  
  // Log messages
  await supabase.from('javari_messages').insert([
    {
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    },
    {
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantMessage,
      provider,
      task_type: taskType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost,
      latency,
      credits_used: creditsUsed,
      success,
      created_at: new Date().toISOString(),
    },
  ]);
  
  // Log AI usage for analytics
  await supabase.from('javari_ai_usage').insert({
    provider,
    task_type: taskType,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost,
    latency,
    success,
    user_id: userId || 'anonymous',
    conversation_id: conversationId,
    created_at: new Date().toISOString(),
  });
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const router = getRouter();
  const providers = router.getAvailableProviders();
  const stats = router.getPerformanceStats();
  
  return NextResponse.json({
    status: 'healthy',
    version: '5.0.0',
    providers: {
      available: providers,
      count: providers.length,
    },
    performance: stats.slice(0, 10),
    timestamp: new Date().toISOString(),
  });
}
