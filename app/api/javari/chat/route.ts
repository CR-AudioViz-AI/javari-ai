/**
 * Javari AI Enhanced Multi-Model Chat API Route
 * MASTER INTEGRATION - All Enhancements Combined
 * 
 * Features:
 * - Smart Auto-Routing (picks best AI per query)
 * - VIP Detection (no signup prompts for owners)
 * - BUILD Mode (action over description)
 * - Knowledge Integration (44+ knowledge entries)
 * - Real-time Data (news, crypto, weather)
 * - User Memory (persistent preferences)
 * - Conversation Learning (extracts facts)
 * 
 * @route /api/javari/chat
 * @version 5.0.0 - MASTER INTEGRATION
 * @last-updated 2025-12-13
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { JAVARI_SYSTEM_PROMPT } from '@/lib/javari-system-prompt';
import { routeQuery, routeQuerySync, AIProvider } from '@/lib/ai-router';
import { buildMemoryContext, learnFromConversation } from '@/lib/user-memory';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// VIP Detection
const VIP_IDENTIFIERS = [
  'roy henderson', 'i am roy', "i'm roy",
  'cindy henderson', 'i am cindy', "i'm cindy",
  '@craudiovizai.com', 'ceo', 'co-founder',
];

// Model mapping
const MODEL_MAP: Record<AIProvider, { model: string; provider: 'openai' | 'anthropic' | 'google' | 'perplexity' | 'mistral' }> = {
  openai: { model: 'gpt-4-turbo-preview', provider: 'openai' },
  claude: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
  gemini: { model: 'gemini-1.5-pro', provider: 'google' },
  perplexity: { model: 'llama-3.1-sonar-large-128k-online', provider: 'perplexity' },
  mistral: { model: 'mistral-large-latest', provider: 'mistral' },
};

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
  provider?: AIProvider | 'auto';
  maxTokens?: number;
  temperature?: number;
  includeKnowledge?: boolean;
  includeMemory?: boolean;
}

/**
 * Detect VIP users
 */
function detectVIP(message: string, history: ChatMessage[], userId?: string, userEmail?: string): { isVIP: boolean; vipName?: string } {
  const fullConversation = [...history.map(m => m.content), message].join(' ').toLowerCase();
  
  for (const identifier of VIP_IDENTIFIERS) {
    if (fullConversation.includes(identifier.toLowerCase())) {
      if (identifier.includes('roy')) return { isVIP: true, vipName: 'Roy Henderson (CEO)' };
      if (identifier.includes('cindy')) return { isVIP: true, vipName: 'Cindy Henderson (CMO)' };
      return { isVIP: true, vipName: 'VIP User' };
    }
  }
  
  if (userEmail?.toLowerCase().includes('@craudiovizai.com')) {
    return { isVIP: true, vipName: 'CR AudioViz Staff' };
  }
  
  return { isVIP: false };
}

/**
 * Detect BUILD requests
 */
function isBuildRequest(message: string): boolean {
  return /\b(build|create|make|generate|design|develop|implement|write code|code a)\b.*\b(app|tool|component|page|website|calculator|dashboard|form|interface)\b/i.test(message) ||
         /\b(build|create|make)\s+(me\s+)?(a|an)\b/i.test(message);
}

/**
 * Fetch knowledge context
 */
async function fetchKnowledgeContext(query: string, supabase: any): Promise<string> {
  try {
    // Simple keyword-based search
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const { data } = await supabase
      .from('javari_knowledge')
      .select('title, category, content')
      .limit(3);
    
    if (!data || data.length === 0) return '';
    
    // Score by keyword relevance
    const scored = data.map((k: any) => {
      let score = 0;
      const text = (k.content + ' ' + k.title).toLowerCase();
      keywords.forEach((kw: string) => { if (text.includes(kw)) score++; });
      return { ...k, score };
    }).filter((k: any) => k.score > 0).sort((a: any, b: any) => b.score - a.score);
    
    if (scored.length === 0) return '';
    
    let context = '## RELEVANT KNOWLEDGE\n';
    for (const entry of scored.slice(0, 2)) {
      context += `### ${entry.title}\n${entry.content.slice(0, 400)}\n\n`;
    }
    return context;
  } catch (error) {
    console.error('Knowledge fetch error:', error);
    return '';
  }
}

/**
 * Fetch real-time data context
 */
async function fetchRealtimeContext(query: string, supabase: any): Promise<string> {
  const queryLower = query.toLowerCase();
  const parts: string[] = [];
  
  // Check for news
  if (/\b(news|latest|recent|today|happening)\b/i.test(query)) {
    try {
      const { data } = await supabase
        .from('javari_external_data')
        .select('title, source_name')
        .eq('data_type', 'news')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data?.length) {
        parts.push('## TRENDING NEWS');
        data.forEach((n: any) => parts.push(`- ${n.title} (${n.source_name})`));
      }
    } catch {}
  }
  
  // Check for crypto
  if (/\b(crypto|bitcoin|btc|ethereum|eth|price)\b/i.test(query)) {
    try {
      const { data } = await supabase
        .from('javari_external_data')
        .select('title, metadata')
        .eq('data_type', 'crypto')
        .gt('expires_at', new Date().toISOString())
        .limit(10);
      
      if (data?.length) {
        parts.push('\n## CURRENT CRYPTO PRICES');
        data.forEach((c: any) => {
          const price = c.metadata?.current_price;
          if (price) parts.push(`- ${c.title}: $${price.toLocaleString()}`);
        });
      }
    } catch {}
  }
  
  // Check for weather
  if (/\b(weather|temperature|forecast)\b/i.test(query)) {
    try {
      const { data } = await supabase
        .from('javari_external_data')
        .select('content, metadata')
        .eq('data_type', 'weather')
        .limit(1);
      
      if (data?.[0]) {
        parts.push('\n## CURRENT WEATHER (Fort Myers, FL)');
        parts.push(`Temperature: ${data[0].metadata?.temperature || 'N/A'}°F`);
        parts.push(`Conditions: ${data[0].content || 'N/A'}`);
      }
    } catch {}
  }
  
  return parts.join('\n');
}

/**
 * Stream from OpenAI
 */
async function streamOpenAI(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  maxTokens: number,
  temperature: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string> {
  let fullResponse = '';
  
  const response = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: maxTokens,
    temperature,
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
 * Stream from Claude
 */
async function streamClaude(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  maxTokens: number,
  temperature: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string> {
  let fullResponse = '';
  
  const claudeMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: msg.content,
  }));
  
  const response = await anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: claudeMessages,
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
 * POST /api/javari/chat
 * Enhanced chat with all integrations
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
      provider: requestedProvider = 'auto',
      maxTokens = 4096,
      temperature = 0.7,
      includeKnowledge = true,
      includeMemory = true,
    } = body;
    
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // === SMART ROUTING ===
    let selectedProvider: AIProvider;
    let routingReason = '';
    
    if (requestedProvider === 'auto') {
      const routing = routeQuerySync(message);
      selectedProvider = routing.provider;
      routingReason = `Auto-selected ${selectedProvider} for ${routing.intent} task`;
    } else {
      selectedProvider = requestedProvider as AIProvider;
      routingReason = `User selected ${selectedProvider}`;
    }
    
    const modelInfo = MODEL_MAP[selectedProvider] || MODEL_MAP.openai;
    
    // === VIP DETECTION ===
    const { isVIP, vipName } = detectVIP(message, history, userId, userEmail);
    const isBuild = isBuildRequest(message);
    
    // === BUILD CONTEXTUAL PROMPT ===
    let contextualPrompt = JAVARI_SYSTEM_PROMPT;
    
    // Add routing context
    contextualPrompt += `\n\n## AI ROUTING\n${routingReason}\nProvider: ${selectedProvider}\nModel: ${modelInfo.model}`;
    
    // Add VIP context
    if (isVIP) {
      contextualPrompt += `\n\n## 🔴 VIP USER: ${vipName} 🔴
THIS IS AN OWNER/FOUNDER. CRITICAL RULES:
- NEVER mention signup, pricing, plans, credits
- BUILD IMMEDIATELY without barriers
- Be direct and efficient
- Output working code FIRST`;
    }
    
    // Add BUILD mode context
    if (isBuild) {
      contextualPrompt += `\n\n## 🛠️ BUILD MODE ACTIVATED 🛠️
User wants you to BUILD something. Your response MUST:
1. START with complete working code (React/TSX)
2. Use Tailwind CSS for styling
3. Include all state and functionality
4. Add realistic sample data
5. Be deployable as-is
6. Keep explanations BRIEF (2-3 sentences) AFTER code

DO NOT list features or describe what you would build. Just BUILD IT.`;
    }
    
    // === KNOWLEDGE CONTEXT ===
    if (includeKnowledge) {
      const knowledgeContext = await fetchKnowledgeContext(message, supabase);
      if (knowledgeContext) {
        contextualPrompt += '\n\n' + knowledgeContext;
      }
    }
    
    // === REAL-TIME DATA ===
    const realtimeContext = await fetchRealtimeContext(message, supabase);
    if (realtimeContext) {
      contextualPrompt += '\n\n' + realtimeContext;
    }
    
    // === USER MEMORY ===
    if (includeMemory && userId) {
      try {
        const memoryContext = await buildMemoryContext(userId);
        if (memoryContext) {
          contextualPrompt += '\n\n' + memoryContext;
        }
      } catch {}
    }
    
    // Add conversation context
    contextualPrompt += `\n\n## CONVERSATION CONTEXT
${projectId ? `Project: ${projectId}` : ''}
${sessionId ? `Session: ${sessionId}` : ''}
${isVIP ? `🔴 VIP: ${vipName}` : ''}
Provider: ${selectedProvider} (${modelInfo.model})

You are Javari AI. You BUILD things. ACTION over words.`;
    
    // === STREAMING RESPONSE ===
    const encoder = new TextEncoder();
    let fullResponse = '';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send provider info first
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            provider: selectedProvider,
            model: modelInfo.model,
            routing: routingReason,
            isVIP,
            isBuild,
          })}\n\n`));
          
          // Route to appropriate provider
          if (modelInfo.provider === 'openai') {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              { role: 'system', content: contextualPrompt },
              ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
              { role: 'user', content: message },
            ];
            
            fullResponse = await streamOpenAI(messages, modelInfo.model, maxTokens, temperature, controller, encoder);
          } else if (modelInfo.provider === 'anthropic') {
            const messages: ChatMessage[] = [...history, { role: 'user', content: message }];
            fullResponse = await streamClaude(messages, contextualPrompt, modelInfo.model, maxTokens, temperature, controller, encoder);
          } else {
            // Fallback to OpenAI for unsupported providers (Gemini, Perplexity, Mistral)
            // In production, you'd add proper SDK integrations for these
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              { role: 'system', content: contextualPrompt },
              ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
              { role: 'user', content: message },
            ];
            
            fullResponse = await streamOpenAI(messages, 'gpt-4-turbo-preview', maxTokens, temperature, controller, encoder);
          }
          
          const latency = Date.now() - startTime;
          
          // === POST-PROCESSING ===
          
          // Learn from conversation
          if (userId) {
            try {
              await learnFromConversation(userId, message, fullResponse);
            } catch {}
          }
          
          // Save to database
          if (userId) {
            try {
              const updatedMessages = [
                ...history,
                { role: 'user' as const, content: message, timestamp: new Date().toISOString() },
                { role: 'assistant' as const, content: fullResponse, timestamp: new Date().toISOString() },
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
                await supabase
                  .from('conversations')
                  .insert({
                    user_id: userId,
                    project_id: projectId,
                    parent_id: parentId || null,
                    title: message.slice(0, 100),
                    messages: updatedMessages,
                    message_count: updatedMessages.length,
                    model: modelInfo.model,
                    status: 'active',
                    is_vip: isVIP,
                  });
              }
              
              // Log usage
              await supabase
                .from('javari_usage_logs')
                .insert({
                  user_id: userId,
                  model: modelInfo.model,
                  provider: selectedProvider,
                  is_vip: isVIP,
                  is_build_request: isBuild,
                  latency_ms: latency,
                });
            } catch {}
          }
          
          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            provider: selectedProvider,
            model: modelInfo.model,
            latency,
            isVIP,
            isBuild,
          })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
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
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'An error occurred', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/chat
 * Get available models and routing info
 */
export async function GET() {
  return NextResponse.json({
    providers: Object.keys(MODEL_MAP),
    defaultProvider: 'auto',
    features: [
      'Smart Auto-Routing',
      'VIP Detection',
      'BUILD Mode',
      'Knowledge Integration',
      'Real-time Data',
      'User Memory',
      'Conversation Learning',
    ],
    version: '5.0.0',
  });
}
