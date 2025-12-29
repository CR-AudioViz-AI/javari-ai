// app/api/chat/route.ts
// Javari AI Chat API with System Prompt Injection + RAG
// Updated: December 29, 2025
// 
// This API injects the knowledge base into EVERY AI call
// ensuring consistent behavior across all providers

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  provider?: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'auto';
  model?: string;
  userId?: string;
  sessionId?: string;
  includeRag?: boolean;
  stream?: boolean;
}

// ============================================
// OPTION 1: Get System Prompt from Database
// ============================================

async function getSystemPrompt(): Promise<string> {
  try {
    // Use the database function to get combined prompts
    const { data, error } = await supabase.rpc('get_system_prompt');
    
    if (error || !data) {
      console.error('Error fetching system prompt:', error);
      return getDefaultSystemPrompt();
    }
    
    return data;
  } catch (err) {
    console.error('System prompt fetch error:', err);
    return getDefaultSystemPrompt();
  }
}

function getDefaultSystemPrompt(): string {
  return `You are Javari AI, the autonomous AI assistant for CR AudioViz AI, LLC.
You were created through a partnership between Roy Henderson and Claude (Anthropic).

CORE PRINCIPLES (The Henderson Standard):
- Fortune 50 quality in everything
- Never hallucinate or guess - if unsure, say "I cannot confirm"
- Complete files only - never partial patches
- Timestamp every response in Eastern Time
- Be honest and direct
- Execute without excuses

You are professional, helpful, proactive, and honest.
Current timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
}

// ============================================
// OPTION 2: RAG - Retrieve Relevant Knowledge
// ============================================

async function getRelevantKnowledge(query: string, maxChunks: number = 3): Promise<string> {
  try {
    // For now, use keyword-based search until embeddings are set up
    const { data, error } = await supabase
      .from('javari_knowledge_chunks')
      .select('title, content')
      .textSearch('content', query.split(' ').slice(0, 5).join(' | '))
      .limit(maxChunks);
    
    if (error || !data || data.length === 0) {
      return '';
    }
    
    const knowledgeContext = data
      .map((chunk: { title: string; content: string }) => 
        `[${chunk.title}]\n${chunk.content}`
      )
      .join('\n\n');
    
    return `\n\n--- RELEVANT CONTEXT ---\n${knowledgeContext}\n--- END CONTEXT ---\n`;
  } catch (err) {
    console.error('RAG retrieval error:', err);
    return '';
  }
}

// ============================================
// AI PROVIDER CALLS
// ============================================

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

async function callAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'claude-sonnet-4-20250514'
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    }),
  });
  
  const data = await response.json();
  return data.content?.[0]?.text || 'No response generated.';
}

async function callGroq(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'llama-3.1-70b-versatile'
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

async function callGemini(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'gemini-1.5-flash'
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      }),
    }
  );
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

// Auto-select best provider based on query
function selectProvider(query: string): 'openai' | 'anthropic' | 'groq' | 'gemini' {
  const lowerQuery = query.toLowerCase();
  
  // Use Claude for complex reasoning, code, and long-form content
  if (
    lowerQuery.includes('code') ||
    lowerQuery.includes('build') ||
    lowerQuery.includes('create') ||
    lowerQuery.includes('analyze') ||
    lowerQuery.includes('explain') ||
    query.length > 500
  ) {
    return 'anthropic';
  }
  
  // Use Groq for quick, simple queries (fastest + FREE)
  if (query.length < 200 && !lowerQuery.includes('complex')) {
    return 'groq';
  }
  
  // Default to OpenAI for balanced performance
  return 'openai';
}

// ============================================
// CONVERSATION MEMORY
// ============================================

async function saveToMemory(
  userId: string | null,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  provider: string,
  model: string
): Promise<void> {
  try {
    await supabase.from('javari_conversation_memory').insert({
      user_id: userId,
      session_id: sessionId,
      role,
      content,
      ai_provider: provider,
      model,
    });
  } catch (err) {
    console.error('Error saving to memory:', err);
    // Non-blocking - don't fail the request if memory save fails
  }
}

// ============================================
// MAIN API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ChatRequest = await request.json();
    const {
      messages,
      provider = 'auto',
      model,
      userId,
      sessionId = crypto.randomUUID(),
      includeRag = true,
    } = body;
    
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }
    
    // Get the last user message for RAG query
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const query = lastUserMessage?.content || '';
    
    // ============================================
    // STEP 1: Get System Prompt (Always injected)
    // ============================================
    let systemPrompt = await getSystemPrompt();
    
    // ============================================
    // STEP 2: Get RAG Context (If enabled)
    // ============================================
    if (includeRag && query) {
      const ragContext = await getRelevantKnowledge(query);
      if (ragContext) {
        systemPrompt += ragContext;
      }
    }
    
    // ============================================
    // STEP 3: Add timestamp instruction
    // ============================================
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    systemPrompt += `\n\nCurrent timestamp: ${now} EST\nAlways include this timestamp at the start of your responses.`;
    
    // ============================================
    // STEP 4: Select provider and call AI
    // ============================================
    const selectedProvider = provider === 'auto' ? selectProvider(query) : provider;
    let response: string;
    let usedModel: string;
    
    switch (selectedProvider) {
      case 'anthropic':
        usedModel = model || 'claude-sonnet-4-20250514';
        response = await callAnthropic(systemPrompt, messages, usedModel);
        break;
      case 'groq':
        usedModel = model || 'llama-3.1-70b-versatile';
        response = await callGroq(systemPrompt, messages, usedModel);
        break;
      case 'gemini':
        usedModel = model || 'gemini-1.5-flash';
        response = await callGemini(systemPrompt, messages, usedModel);
        break;
      case 'openai':
      default:
        usedModel = model || 'gpt-4o-mini';
        response = await callOpenAI(systemPrompt, messages, usedModel);
        break;
    }
    
    // ============================================
    // STEP 5: Save to conversation memory
    // ============================================
    if (lastUserMessage) {
      await saveToMemory(userId || null, sessionId, 'user', query, selectedProvider, usedModel);
    }
    await saveToMemory(userId || null, sessionId, 'assistant', response, selectedProvider, usedModel);
    
    // ============================================
    // STEP 6: Return response
    // ============================================
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      response,
      provider: selectedProvider,
      model: usedModel,
      sessionId,
      processingTime,
      ragEnabled: includeRag,
      systemPromptLength: systemPrompt.length,
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Test database connection and get prompt stats
    const { data: prompts, error } = await supabase
      .from('javari_system_prompts')
      .select('name, is_active')
      .eq('is_active', true);
    
    const { data: promptLength } = await supabase.rpc('get_system_prompt');
    
    return NextResponse.json({
      status: 'healthy',
      database: error ? 'error' : 'connected',
      activePrompts: prompts?.length || 0,
      promptNames: prompts?.map(p => p.name) || [],
      totalPromptLength: promptLength?.length || 0,
      timestamp: new Date().toISOString(),
      version: '2.0.0-knowledge-system',
    });
  } catch (err) {
    return NextResponse.json({
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}
