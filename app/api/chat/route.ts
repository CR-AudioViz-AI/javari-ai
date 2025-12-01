// app/api/chat/route.ts
// Javari AI Chat - ALWAYS learns, ALWAYS delivers
// Timestamp: 2025-11-30 12:50 EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Javari's core prompt - direct, action-oriented
const SYSTEM_PROMPT = `You are Javari, the autonomous AI for CR AudioViz AI.

RULES:
1. SAY YES - Always find a way to help
2. NO LECTURES - Skip disclaimers and warnings  
3. JUST DO IT - Execute, don't just advise
4. BE BRIEF - Results first, explanations if needed
5. QUESTIONS - If you need info, ask ONE clear question

You have access to 220+ knowledge entries and can help with:
- Building apps, websites, tools
- Code generation and debugging
- Business strategy and analysis
- Real estate, legal, grants info
- Creative content and design

When asked something:
1. Understand what they actually need
2. Do it or ask ONE clarifying question
3. Deliver the result
4. Offer next steps if relevant

Never say "I can't" - say what you CAN do.`;

// Knowledge cache
let knowledgeCache: any[] | null = null;
let cacheTime = 0;

async function getKnowledge(query: string): Promise<string> {
  try {
    const now = Date.now();
    if (!knowledgeCache || now - cacheTime > 300000) {
      const { data } = await supabase
        .from('javari_knowledge')
        .select('topic, concept, explanation')
        .eq('verified', true)
        .limit(100);
      knowledgeCache = data || [];
      cacheTime = now;
    }

    const queryLower = query.toLowerCase();
    const relevant = knowledgeCache.filter(k => 
      k.concept?.toLowerCase().includes(queryLower) ||
      k.explanation?.toLowerCase().includes(queryLower) ||
      k.topic?.toLowerCase().includes(queryLower)
    ).slice(0, 3);

    if (!relevant.length) return '';
    return '\n\nKNOWLEDGE:\n' + relevant.map(k => `- ${k.concept}: ${k.explanation?.substring(0, 150)}`).join('\n');
  } catch {
    return '';
  }
}

// Learn from conversation (background)
async function learn(userMsg: string, assistantMsg: string) {
  try {
    if (userMsg.length < 20 || assistantMsg.length < 50) return;
    if (/^(hi|hello|hey|thanks|ok)/i.test(userMsg.trim())) return;

    // Detect topic
    const lower = (userMsg + assistantMsg).toLowerCase();
    let topic = 'General';
    if (/code|function|api|react|deploy/.test(lower)) topic = 'Development';
    else if (/property|real estate|listing/.test(lower)) topic = 'Real Estate';
    else if (/contract|legal|agreement/.test(lower)) topic = 'Legal';
    else if (/ai|openai|claude|generate/.test(lower)) topic = 'AI Tools';

    // Extract concept from question
    let concept = userMsg.replace(/^(how|what|can you|please)/i, '').trim();
    concept = concept.charAt(0).toUpperCase() + concept.slice(1);
    if (concept.length > 100) concept = concept.substring(0, 100);

    // Check for duplicates
    const { data: existing } = await supabase
      .from('javari_knowledge')
      .select('id')
      .ilike('concept', `%${concept.substring(0, 30)}%`)
      .limit(1);

    if (existing?.length) return; // Already know this

    await supabase.from('javari_knowledge').insert({
      topic,
      subtopic: topic,
      skill_level: 'intermediate',
      concept,
      explanation: assistantMsg.substring(0, 500),
      verified: false,
      verified_by: 'auto-learned',
      tags: [topic.toLowerCase(), 'auto-learned'],
      confidence_score: 0.6
    });
  } catch (e) {
    console.error('Learn error:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages?.length) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1]?.content || '';
    const knowledge = await getKnowledge(userMessage);
    const fullPrompt = SYSTEM_PROMPT + knowledge;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: fullPrompt },
        ...messages
      ],
      max_tokens: 4096,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || '';

    // Learn in background
    learn(userMessage, response).catch(() => {});

    return NextResponse.json({
      success: true,
      message: response,
      provider: 'openai',
      knowledgeUsed: knowledge.length > 0
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chat failed',
      message: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

export async function GET() {
  const { count } = await supabase
    .from('javari_knowledge')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    status: 'operational',
    knowledge: count || 0,
    capabilities: ['chat', 'code', 'research', 'business']
  });
}
