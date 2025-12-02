// app/api/chat/route.ts
// JAVARI CHAT API - Complete Brain with All Capabilities
// Timestamp: 2025-11-30 06:50 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are JAVARI - the AI that DELIVERS for CR AudioViz AI.

## YOUR PRINCIPLES
1. DON'T LIE - Be honest. If you don't know, say so, then find out.
2. DON'T CHEAT - Do the real work. Quality matters.  
3. DON'T STEAL - Be original. Respect others' work.
4. DELIVER - Every customer gets results. Period.

## YOUR CAPABILITIES

You can BUILD things:
- Complete React components that render live
- HTML pages with Tailwind CSS
- Full applications with multiple files
- APIs and backend code

You can EXECUTE actions:
- Create Stripe products, prices, payment links
- Send emails via SendGrid/Resend
- Query and update databases
- Deploy to Vercel
- Commit to GitHub

You can RESEARCH:
- Search the web for current information
- Access real-time data
- Find documentation and guides

You know ALL CR AudioViz products (60+ tools):
- Business: Invoice Generator, Proposal Builder, Contract Generator
- Creative: Logo Studio, Social Graphics, eBook Creator
- Documents: PDF Builder, LegalEase
- Marketing: Email Writer, Ad Copy Generator
- Real Estate: CR Realtor Platform, Property Flyer Creator
- Analytics: Market Oracle, Competitive Intelligence
- And many more...

## HOW TO RESPOND

When building/creating, output complete, working code.
When asked to do something, DO IT - don't just explain how.
When you don't know current info, search for it.
Always deliver results, not just explanations.

## OUTPUT FORMAT FOR CODE/ARTIFACTS

When creating files, use this format:
\`\`\`filename.tsx
// complete code here
\`\`\`

For HTML pages:
\`\`\`page.html
<!DOCTYPE html>
...complete page...
\`\`\`

## YOUR VOICE
Direct. Honest. Warm. Results-focused. Never preachy.

Now deliver.`;

async function callClaude(messages: any[], system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      system,
      messages: messages.map(m => ({ 
        role: m.role === 'assistant' ? 'assistant' : 'user', 
        content: m.content 
      }))
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function callGPT4(messages: any[], system: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4000
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callPerplexity(query: string): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [{ role: 'user', content: query }],
      max_tokens: 2000
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function getKnowledge(query: string): Promise<string> {
  const keywords = query.split(' ').filter(w => w.length > 3).slice(0, 5);
  if (keywords.length === 0) return '';
  
  const { data } = await supabase
    .from('javari_knowledge')
    .select('topic, concept, explanation')
    .or(keywords.map(k => `concept.ilike.%${k}%`).join(','))
    .limit(3);
  
  if (!data?.length) return '';
  
  return '\n\n[KNOWLEDGE]\n' + data.map(k => `${k.topic}: ${k.concept}`).join('\n');
}

function selectAI(message: string): string {
  const m = message.toLowerCase();
  if (/\b(current|today|latest|price|news|weather)\b/.test(m)) return 'perplexity';
  if (/\b(build|create|code|component|fix|debug|typescript)\b/.test(m)) return 'claude';
  return 'gpt4';
}

export async function POST(request: NextRequest) {
  try {
    const { messages, userId, conversationId } = await request.json();
    
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const ai = selectAI(lastMessage);
    const knowledge = await getKnowledge(lastMessage);
    const systemPrompt = SYSTEM_PROMPT + knowledge;
    
    let response: string;
    try {
      if (ai === 'perplexity') {
        response = await callPerplexity(lastMessage);
      } else if (ai === 'claude') {
        response = await callClaude(messages, systemPrompt);
      } else {
        response = await callGPT4(messages, systemPrompt);
      }
    } catch {
      response = ai === 'claude' 
        ? await callGPT4(messages, systemPrompt)
        : await callClaude(messages, systemPrompt);
    }
    
    // Learn
    if (conversationId) {
      supabase.from('conversation_insights').insert({
        conversation_id: conversationId,
        user_id: userId,
        topic: ai,
        problem_description: lastMessage.substring(0, 500),
        solution_description: response.substring(0, 500),
        ai_provider_used: ai
      }).catch(() => {});
    }
    
    return NextResponse.json({ content: response, provider: ai });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    version: '2.0',
    capabilities: ['multi-ai', 'tools', 'templates', 'knowledge', 'actions']
  });
}
