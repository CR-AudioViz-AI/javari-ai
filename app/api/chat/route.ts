// app/api/chat/route.ts
// Javari AI Chat API with System Prompt Injection + RAG + OpenRouter
// Updated: December 29, 2025
// 
// This API injects the knowledge base into EVERY AI call
// ensuring consistent behavior across all providers
// Now with OpenRouter for 500+ model access!

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
  provider?: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'auto';
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

// ============================================
// NEW: OpenRouter - Access 500+ Models
// ============================================

async function callOpenRouter(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'deepseek/deepseek-chat' // FREE by default!
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://javariai.com',
      'X-Title': 'Javari AI',
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
  
  // Log usage for tracking
  if (data.usage) {
    console.log(`[OpenRouter] Model: ${model}, Tokens: ${data.usage.total_tokens}, Cost: $${data.usage.cost || 0}`);
  }
  
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

// OpenRouter FREE models list
const OPENROUTER_FREE_MODELS = [
  'deepseek/deepseek-chat',           // DeepSeek V3 - excellent general purpose
  'deepseek/deepseek-r1:free',        // DeepSeek R1 - reasoning
  'meta-llama/llama-3.1-8b-instruct:free',  // Llama 3.1 8B
  'mistralai/mistral-7b-instruct:free',     // Mistral 7B
  'google/gemma-2-9b-it:free',        // Google Gemma 2
  'qwen/qwen-2-7b-instruct:free',     // Qwen 2 7B
];

// Auto-select best provider based on query
function selectProvider(query: string): 'openai' | 'anthropic' | 'groq' | 'gemini' | 'openrouter' {
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
  if (query.length < 100 && !lowerQuery.includes('complex')) {
    return 'groq';
  }
  
  // Use OpenRouter/DeepSeek for medium complexity (FREE + good quality)
  if (query.length < 300) {
    return 'openrouter';
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
      provider,
      model,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Memory save error:', err);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export async function GET() {
  // Health check endpoint
  try {
    const { data: prompts } = await supabase
      .from('javari_system_prompts')
      .select('name, priority')
      .eq('is_active', true)
      .order('priority');
    
    const systemPrompt = await getSystemPrompt();
    
    return NextResponse.json({
      status: 'healthy',
      database: prompts ? 'connected' : 'error',
      activePrompts: prompts?.length || 0,
      promptNames: prompts?.map(p => p.name) || [],
      totalPromptLength: systemPrompt.length,
      providers: ['openai', 'anthropic', 'groq', 'gemini', 'openrouter'],
      openrouterFreeModels: OPENROUTER_FREE_MODELS,
      timestamp: new Date().toISOString(),
      version: '2.1.0-openrouter',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: 'error',
      error: String(error),
      timestamp: new Date().toISOString(),
      version: '2.1.0-openrouter',
    });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ChatRequest = await req.json();
    const { 
      messages, 
      provider: requestedProvider = 'auto',
      model: requestedModel,
      userId,
      sessionId = crypto.randomUUID(),
      includeRag = true,
    } = body;
    
    // Validate
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }
    
    // Get user's latest message for provider selection
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // Select provider
    const provider = requestedProvider === 'auto' 
      ? selectProvider(userMessage)
      : requestedProvider;
    
    // Get system prompt from database
    const systemPrompt = await getSystemPrompt();
    
    // Optionally add RAG context
    let enhancedPrompt = systemPrompt;
    if (includeRag && userMessage.length > 10) {
      const ragContext = await getRelevantKnowledge(userMessage);
      if (ragContext) {
        enhancedPrompt += ragContext;
      }
    }
    
    // Add timestamp instruction
    enhancedPrompt += `\n\nIMPORTANT: Begin your response with the current timestamp in Eastern Time format: "Day, Month Date, Year at HH:MM AM/PM EST"`;
    
    // Call selected provider
    let response: string;
    let modelUsed: string;
    
    switch (provider) {
      case 'anthropic':
        modelUsed = requestedModel || 'claude-sonnet-4-20250514';
        response = await callAnthropic(enhancedPrompt, messages, modelUsed);
        break;
      case 'groq':
        modelUsed = requestedModel || 'llama-3.1-70b-versatile';
        response = await callGroq(enhancedPrompt, messages, modelUsed);
        break;
      case 'gemini':
        modelUsed = requestedModel || 'gemini-1.5-flash';
        response = await callGemini(enhancedPrompt, messages, modelUsed);
        break;
      case 'openrouter':
        modelUsed = requestedModel || 'deepseek/deepseek-chat';
        response = await callOpenRouter(enhancedPrompt, messages, modelUsed);
        break;
      case 'openai':
      default:
        modelUsed = requestedModel || 'gpt-4o-mini';
        response = await callOpenAI(enhancedPrompt, messages, modelUsed);
        break;
    }
    
    // Save to memory
    await saveToMemory(userId || null, sessionId, 'user', userMessage, provider, modelUsed);
    await saveToMemory(userId || null, sessionId, 'assistant', response, provider, modelUsed);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      response,
      provider,
      model: modelUsed,
      sessionId,
      processingTime,
      ragEnabled: includeRag,
      systemPromptLength: enhancedPrompt.length,
    });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
