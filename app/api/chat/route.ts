// app/api/chat/route.ts
// Javari AI Chat - ALWAYS learns, ALWAYS delivers
// Timestamp: 2025-11-30 12:35 EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { JAVARI_SYSTEM_PROMPT, detectTaskType, getJavariPrompt } from '@/lib/javari-system-prompt';
import { learnFromConversation } from '@/lib/javari-learning';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Knowledge cache
let knowledgeCache: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 300000; // 5 min

async function getKnowledge(query: string): Promise<string> {
  try {
    const now = Date.now();
    if (!knowledgeCache || now - cacheTime > CACHE_TTL) {
      const { data } = await supabase
        .from('javari_knowledge')
        .select('topic, concept, explanation, examples, best_practices')
        .eq('verified', true)
        .limit(100);
      knowledgeCache = data || [];
      cacheTime = now;
    }

    // Find relevant entries
    const queryLower = query.toLowerCase();
    const relevant = knowledgeCache.filter(k => 
      k.concept?.toLowerCase().includes(queryLower) ||
      k.explanation?.toLowerCase().includes(queryLower) ||
      k.topic?.toLowerCase().includes(queryLower)
    ).slice(0, 5);

    if (!relevant.length) return '';

    return '\n\n## RELEVANT KNOWLEDGE:\n' + 
      relevant.map(k => `**${k.topic} - ${k.concept}**: ${k.explanation?.substring(0, 200)}...`).join('\n');
  } catch {
    return '';
  }
}

// Route to best AI for task
function selectProvider(message: string): 'openai' | 'anthropic' {
  const lower = message.toLowerCase();
  // Claude for complex reasoning, analysis, writing
  if (/analyze|explain|compare|strategy|legal|complex|detailed|research/.test(lower)) {
    return 'anthropic';
  }
  // GPT-4 for code, quick tasks
  return 'openai';
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { messages, provider: requestedProvider, stream = false } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1]?.content || '';
    const taskType = detectTaskType(userMessage);
    const systemPrompt = getJavariPrompt(taskType);
    
    // Get relevant knowledge
    const knowledge = await getKnowledge(userMessage);
    const fullPrompt = systemPrompt + knowledge;

    // Select provider
    const provider = requestedProvider || selectProvider(userMessage);

    let response: string;

    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      const completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: fullPrompt,
        messages: messages.map((m: Message) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content
        }))
      });
      response = completion.content[0].type === 'text' ? completion.content[0].text : '';
    } else {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: fullPrompt },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7
      });
      response = completion.choices[0]?.message?.content || '';
    }

    // ALWAYS learn from this conversation (background, don't wait)
    learnFromConversation({
      conversationId: `chat_${Date.now()}`,
      userMessage,
      assistantResponse: response,
      wasHelpful: true, // Assume helpful, feedback can correct
      solutionWorked: true
    }).catch(err => console.error('Learning error:', err));

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: response,
      provider,
      taskType,
      responseTime,
      knowledgeUsed: knowledge.length > 0
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Quick status check
  const { count } = await supabase
    .from('javari_knowledge')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    status: 'operational',
    knowledge: count || 0,
    providers: ['openai', 'anthropic'],
    capabilities: ['chat', 'code', 'research', 'business']
  });
}
