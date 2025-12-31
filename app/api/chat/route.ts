// app/api/chat/route.ts
// Javari AI Chat API with System Prompt Injection + RAG + OpenRouter
// Updated: December 31, 2025 11:30 AM EST
// Fixed: Proper error handling for all AI providers
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
  provider?: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'perplexity' | 'auto';
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
// AI PROVIDER CALLS - WITH PROPER ERROR HANDLING
// ============================================

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'gpt-4o-mini'
): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[OpenAI] API key not configured');
      return '[OpenAI Error] API key not configured. Please check Vercel environment variables.';
    }

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
    
    // Check for API errors
    if (data.error) {
      console.error('[OpenAI] API Error:', data.error);
      return `[OpenAI Error] ${data.error.message || 'Unknown error'}`;
    }
    
    if (!response.ok) {
      console.error('[OpenAI] HTTP Error:', response.status, data);
      return `[OpenAI Error] HTTP ${response.status}: ${data.error?.message || 'Request failed'}`;
    }
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[OpenAI] Empty response:', data);
      return '[OpenAI Error] Empty response received. Check API key and quota.';
    }
    
    return content;
  } catch (err) {
    console.error('[OpenAI] Exception:', err);
    return `[OpenAI Error] ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function callAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'claude-sonnet-4-20250514'
): Promise<string> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Anthropic] API key not configured');
      return '[Anthropic Error] API key not configured. Please check Vercel environment variables.';
    }

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
    
    // Check for API errors
    if (data.error) {
      console.error('[Anthropic] API Error:', data.error);
      return `[Anthropic Error] ${data.error.message || 'Unknown error'}`;
    }
    
    if (!response.ok) {
      console.error('[Anthropic] HTTP Error:', response.status, data);
      return `[Anthropic Error] HTTP ${response.status}: ${data.error?.message || 'Request failed'}`;
    }
    
    const content = data.content?.[0]?.text;
    if (!content) {
      console.error('[Anthropic] Empty response:', data);
      return '[Anthropic Error] Empty response received. Check API key and quota.';
    }
    
    return content;
  } catch (err) {
    console.error('[Anthropic] Exception:', err);
    return `[Anthropic Error] ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function callGroq(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'llama-3.3-70b-versatile'
): Promise<string> {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('[Groq] API key not configured');
      return '[Groq Error] API key not configured. Please check Vercel environment variables.';
    }

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
    
    // Check for API errors
    if (data.error) {
      console.error('[Groq] API Error:', data.error);
      return `[Groq Error] ${data.error.message || 'Unknown error'}`;
    }
    
    if (!response.ok) {
      console.error('[Groq] HTTP Error:', response.status, data);
      return `[Groq Error] HTTP ${response.status}: ${data.error?.message || 'Request failed'}`;
    }
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[Groq] Empty response:', data);
      return '[Groq Error] Empty response received. Check API key and quota.';
    }
    
    return content;
  } catch (err) {
    console.error('[Groq] Exception:', err);
    return `[Groq Error] ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function callGemini(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'gemini-2.0-flash-exp'
): Promise<string> {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      console.error('[Gemini] API key not configured');
      return '[Gemini Error] API key not configured. Please check Vercel environment variables.';
    }

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
    
    // Check for API errors
    if (data.error) {
      console.error('[Gemini] API Error:', data.error);
      return `[Gemini Error] ${data.error.message || 'Unknown error'}`;
    }
    
    if (!response.ok) {
      console.error('[Gemini] HTTP Error:', response.status, data);
      return `[Gemini Error] HTTP ${response.status}: ${data.error?.message || 'Request failed'}`;
    }
    
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.error('[Gemini] Empty response:', data);
      return '[Gemini Error] Empty response received. Check API key and quota.';
    }
    
    return content;
  } catch (err) {
    console.error('[Gemini] Exception:', err);
    return `[Gemini Error] ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

// ============================================
// OpenRouter - Access 500+ Models
// ============================================

async function callOpenRouter(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'deepseek/deepseek-chat' // FREE by default!
): Promise<string> {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[OpenRouter] API key not configured');
      return '[OpenRouter Error] API key not configured. Please check Vercel environment variables.';
    }

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
    
    // Check for API errors
    if (data.error) {
      console.error('[OpenRouter] API Error:', data.error);
      return `[OpenRouter Error] ${data.error.message || 'Unknown error'}`;
    }
    
    if (!response.ok) {
      console.error('[OpenRouter] HTTP Error:', response.status, data);
      return `[OpenRouter Error] HTTP ${response.status}: ${data.error?.message || 'Request failed'}`;
    }
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[OpenRouter] Empty response:', data);
      return '[OpenRouter Error] Empty response received.';
    }
    
    return content;
  } catch (err) {
    console.error('[OpenRouter] Exception:', err);
    return `[OpenRouter Error] ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

// ============================================
// Perplexity - Real-time web search
// ============================================

async function callPerplexity(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = 'sonar'
): Promise<string> {
  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('[Perplexity] API key not configured');
      return '[Perplexity Error] API key not configured. Please check Vercel environment variables.';
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
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
    
    // Check for API errors
    if (data.error) {
      console.error('[Perplexity] API Error:', data.error);
      return `[Perplexity Error] ${data.error.message || 'Unknown error'}`;
    }
    
    if (!response.ok) {
      console.error('[Perplexity] HTTP Error:', response.status, data);
      return `[Perplexity Error] HTTP ${response.status}: ${data.error?.message || 'Request failed'}`;
    }
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[Perplexity] Empty response:', data);
      return '[Perplexity Error] Empty response received. Check API key and quota.';
    }
    
    return content;
  } catch (err) {
    console.error('[Perplexity] Exception:', err);
    return `[Perplexity Error] ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
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
function selectProvider(query: string): 'openai' | 'anthropic' | 'groq' | 'gemini' | 'openrouter' | 'perplexity' {
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
  
  // Use Perplexity for web search / current events
  if (
    lowerQuery.includes('search') ||
    lowerQuery.includes('latest') ||
    lowerQuery.includes('news') ||
    lowerQuery.includes('current')
  ) {
    return 'perplexity';
  }
  
  // Default to OpenRouter (DeepSeek) - FREE, fast, and reliable
  return 'openrouter';
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
    await supabase.from('javari_conversations').insert({
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
    
    // Check API key configuration
    const apiKeyStatus = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      gemini: !!process.env.GOOGLE_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
    };
    
    return NextResponse.json({
      status: 'healthy',
      database: prompts ? 'connected' : 'error',
      activePrompts: prompts?.length || 0,
      promptNames: prompts?.map(p => p.name) || [],
      totalPromptLength: systemPrompt.length,
      providers: ['openai', 'anthropic', 'groq', 'gemini', 'openrouter', 'perplexity'],
      apiKeyStatus,
      openrouterFreeModels: OPENROUTER_FREE_MODELS,
      timestamp: new Date().toISOString(),
      version: '2.2.0-error-handling',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: 'error',
      error: String(error),
      timestamp: new Date().toISOString(),
      version: '2.2.0-error-handling',
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
        modelUsed = requestedModel || 'llama-3.3-70b-versatile';
        response = await callGroq(enhancedPrompt, messages, modelUsed);
        break;
      case 'gemini':
        modelUsed = requestedModel || 'gemini-2.0-flash-exp';
        response = await callGemini(enhancedPrompt, messages, modelUsed);
        break;
      case 'openrouter':
        modelUsed = requestedModel || 'deepseek/deepseek-chat';
        response = await callOpenRouter(enhancedPrompt, messages, modelUsed);
        break;
      case 'perplexity':
        modelUsed = requestedModel || 'sonar';
        response = await callPerplexity(enhancedPrompt, messages, modelUsed);
        break;
      case 'openai':
        modelUsed = requestedModel || 'gpt-4o-mini';
        response = await callOpenAI(enhancedPrompt, messages, modelUsed);
        break;
      default:
        // Default to OpenRouter (FREE DeepSeek) since it's reliable
        modelUsed = requestedModel || 'deepseek/deepseek-chat';
        response = await callOpenRouter(enhancedPrompt, messages, modelUsed);
        break;
    }
    
    // Save to memory (don't save error messages)
    if (!response.startsWith('[')) {
      await saveToMemory(userId || null, sessionId, 'user', userMessage, provider, modelUsed);
      await saveToMemory(userId || null, sessionId, 'assistant', response, provider, modelUsed);
    }
    
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
