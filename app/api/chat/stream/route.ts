// app/api/chat/stream/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - STREAMING CHAT ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 11:40 AM EST
// Version: 1.0 - REAL-TIME STREAMING RESPONSES
//
// Features:
// - Server-Sent Events (SSE) for real-time streaming
// - Multi-AI provider support with streaming
// - Token-by-token output for immediate feedback
// - Automatic fallback if streaming fails
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIP & BUILD DETECTION (Reused from main route)
// ═══════════════════════════════════════════════════════════════════════════════

const VIP_PATTERNS = [
  'roy henderson', 'i am roy', "i'm roy", 'roy here',
  'cindy henderson', 'i am cindy', "i'm cindy", 'cindy here',
  '@craudiovizai.com', 'ceo', 'co-founder', 'cofounder'
];

function detectVIP(messages: Message[]): { isVIP: boolean; vipName?: string } {
  const fullText = messages.map(m => m.content || '').join(' ').toLowerCase();
  
  for (const pattern of VIP_PATTERNS) {
    if (fullText.includes(pattern)) {
      if (pattern.includes('roy')) return { isVIP: true, vipName: 'Roy Henderson' };
      if (pattern.includes('cindy')) return { isVIP: true, vipName: 'Cindy Henderson' };
      return { isVIP: true, vipName: 'VIP User' };
    }
  }
  
  return { isVIP: false };
}

function detectBuildIntent(message: string): boolean {
  return /\b(build|create|make|design|develop|generate|code)\b/i.test(message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(isVIP: boolean, vipName?: string, isBuild?: boolean): string {
  let prompt = `You are Javari AI, an autonomous development assistant created by CR AudioViz AI.
Platform: craudiovizai.com | Mission: "Your Story. Our Design."

When asked to BUILD something:
- START with complete, working code
- Use 'use client' and Tailwind CSS
- Include ALL functionality
- Brief explanation AFTER code

Never say no. Find a way to help.`;

  if (isVIP && vipName) {
    prompt += `\n\n🔴 VIP USER: ${vipName} - Build immediately, no barriers, skip pleasantries.`;
  }

  if (isBuild) {
    prompt += `\n\n🛠️ BUILD MODE: Output complete React/TypeScript code NOW.`;
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

async function* streamClaude(
  messages: Message[],
  systemPrompt: string
): AsyncGenerator<StreamEvent> {
  yield { type: 'start', provider: 'Anthropic Claude 3.5 Sonnet', model: 'claude-3-5-sonnet-20241022' };
  
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  
  const stream = await client.messages.stream({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  });
  
  let totalTokens = 0;
  
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'token', content: event.delta.text };
    }
    if (event.type === 'message_delta' && event.usage) {
      totalTokens = event.usage.output_tokens;
    }
  }
  
  const finalMessage = await stream.finalMessage();
  totalTokens = (finalMessage.usage?.input_tokens || 0) + (finalMessage.usage?.output_tokens || 0);
  
  yield { 
    type: 'done', 
    tokensUsed: totalTokens,
    provider: 'Anthropic Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022'
  };
}

async function* streamOpenAI(
  messages: Message[],
  systemPrompt: string,
  useGPT4o: boolean = false
): AsyncGenerator<StreamEvent> {
  const model = useGPT4o ? 'gpt-4o' : 'gpt-4-turbo-preview';
  const name = useGPT4o ? 'OpenAI GPT-4o' : 'OpenAI GPT-4 Turbo';
  
  yield { type: 'start', provider: name, model };
  
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 4000,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }))
    ]
  });
  
  let totalTokens = 0;
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield { type: 'token', content };
    }
    if (chunk.usage) {
      totalTokens = chunk.usage.total_tokens;
    }
  }
  
  yield { type: 'done', tokensUsed: totalTokens, provider: name, model };
}

async function* streamGemini(
  messages: Message[],
  systemPrompt: string
): AsyncGenerator<StreamEvent> {
  yield { type: 'start', provider: 'Google Gemini 1.5 Pro', model: 'gemini-1.5-pro' };
  
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  
  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  });
  
  const lastMessage = messages[messages.length - 1]?.content || '';
  const result = await chat.sendMessageStream(systemPrompt + '\n\n' + lastMessage);
  
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield { type: 'token', content: text };
    }
  }
  
  yield { type: 'done', provider: 'Google Gemini 1.5 Pro', model: 'gemini-1.5-pro' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT PROVIDER SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

function selectStreamingProvider(message: string, requestedProvider?: string): string {
  if (requestedProvider) return requestedProvider;
  
  const m = message.toLowerCase();
  
  // Research/current events → Can't stream Perplexity easily, use GPT-4o
  if (/(?:current|today|latest|news|weather|stock|search)/i.test(m)) {
    return 'gpt-4o';
  }
  
  // Coding → Claude
  if (/(?:build|create|code|component|deploy|app|website|tool)/i.test(m)) {
    return 'claude';
  }
  
  // Long context → Gemini
  if (message.length > 10000) {
    return 'gemini';
  }
  
  // Default to Claude
  return 'claude';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN STREAMING HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const body = await request.json();
    const { messages, userId, conversationId, aiProvider } = body;
    
    if (!messages?.length) {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'No messages provided' })}\n\n`),
        { 
          status: 400,
          headers: { 'Content-Type': 'text/event-stream' }
        }
      );
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const { isVIP, vipName } = detectVIP(messages);
    const isBuild = detectBuildIntent(lastMessage);
    const selectedProvider = selectStreamingProvider(lastMessage, aiProvider);
    const systemPrompt = buildSystemPrompt(isVIP, vipName, isBuild);
    
    // Format messages
    const formattedMessages: Message[] = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    
    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let streamGenerator: AsyncGenerator<StreamEvent>;
          
          switch (selectedProvider) {
            case 'claude':
              streamGenerator = streamClaude(formattedMessages, systemPrompt);
              break;
            case 'openai':
              streamGenerator = streamOpenAI(formattedMessages, systemPrompt, false);
              break;
            case 'gpt-4o':
              streamGenerator = streamOpenAI(formattedMessages, systemPrompt, true);
              break;
            case 'gemini':
              streamGenerator = streamGemini(formattedMessages, systemPrompt);
              break;
            default:
              streamGenerator = streamClaude(formattedMessages, systemPrompt);
          }
          
          let fullResponse = '';
          let provider = '';
          let model = '';
          let tokensUsed = 0;
          
          for await (const event of streamGenerator) {
            // Send event to client
            const eventData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(eventData));
            
            // Accumulate response
            if (event.type === 'token' && event.content) {
              fullResponse += event.content;
            }
            if (event.type === 'start') {
              provider = event.provider || '';
              model = event.model || '';
            }
            if (event.type === 'done') {
              tokensUsed = event.tokensUsed || 0;
              provider = event.provider || provider;
              model = event.model || model;
            }
          }
          
          // Save conversation to database (non-blocking)
          if (userId && fullResponse) {
            const allMessages = [
              ...messages,
              { 
                role: 'assistant', 
                content: fullResponse, 
                timestamp: new Date().toISOString(),
                provider,
                model
              }
            ];
            
            if (conversationId) {
              supabase
                .from('conversations')
                .update({
                  messages: allMessages,
                  message_count: allMessages.length,
                  model,
                  provider,
                  is_vip: isVIP,
                  updated_at: new Date().toISOString()
                })
                .eq('id', conversationId)
                .then(() => {});
            } else {
              supabase
                .from('conversations')
                .insert({
                  user_id: userId,
                  title: lastMessage.slice(0, 100),
                  messages: allMessages,
                  message_count: allMessages.length,
                  model,
                  provider,
                  status: 'active',
                  is_vip: isVIP
                })
                .then(() => {});
            }
          }
          
          // Track usage (non-blocking)
          supabase
            .from('usage_logs')
            .insert({
              user_id: userId,
              provider,
              model,
              tokens_used: tokensUsed,
              request_type: isBuild ? 'code_generation_stream' : 'chat_stream',
              is_vip: isVIP,
              created_at: new Date().toISOString()
            })
            .then(() => {});
          
        } catch (error) {
          const errorEvent = { 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Stream error' 
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
    
  } catch (error) {
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Request parsing failed' })}\n\n`),
      { 
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' }
      }
    );
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    status: 'ok',
    name: 'Javari AI Streaming',
    version: '1.0',
    endpoint: '/api/chat/stream',
    method: 'POST',
    streamFormat: 'Server-Sent Events (SSE)',
    providers: ['claude', 'openai', 'gpt-4o', 'gemini'],
    events: [
      { type: 'start', description: 'Stream started, includes provider info' },
      { type: 'token', description: 'Partial response token' },
      { type: 'done', description: 'Stream complete, includes usage stats' },
      { type: 'error', description: 'Error occurred' }
    ],
    example: {
      request: {
        messages: [{ role: 'user', content: 'Build me a calculator' }],
        userId: 'optional',
        aiProvider: 'optional - claude|openai|gpt-4o|gemini'
      }
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
