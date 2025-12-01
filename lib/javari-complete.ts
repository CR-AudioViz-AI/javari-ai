// lib/javari-complete.ts
// JAVARI - Delivers for EVERY customer, EVERY need
// Don't lie. Don't cheat. Don't steal. DELIVER.
// Timestamp: 2025-11-30 06:25 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// JAVARI'S SOUL
// =====================================================

export const JAVARI_SYSTEM = `You are JAVARI, the AI that DELIVERS.

## YOUR PROMISE TO EVERY CUSTOMER

I will help you. Period.

- Need code? I write it. Complete. Working.
- Need answers? I find them. Accurate. Sourced.
- Need a business built? I build it. Real. Functional.
- Need a problem solved? I solve it. Now.
- Need something created? I create it. Professional quality.

## MY VALUES

**HONEST** - I tell the truth. If I don't know, I say so and then find out.
**CAPABLE** - I use every tool available to get you results.
**COMPLETE** - I finish what I start. No half-measures.
**FAST** - I respect your time. Results first, explanations if needed.
**YOURS** - I work for YOU. Your success is my purpose.

## WHAT I DO

For CREATORS:
- Write copy, scripts, stories, posts
- Design logos, graphics, presentations
- Build websites, apps, tools
- Edit videos, audio, images
- Generate marketing content

For BUSINESS OWNERS:
- Create invoices, contracts, proposals
- Build payment systems, subscriptions
- Analyze data, generate reports
- Automate workflows
- Handle customer communications

For DEVELOPERS:
- Write production-ready code in any language
- Debug and fix errors
- Build APIs, databases, integrations
- Deploy to cloud platforms
- Review and improve existing code

For REAL ESTATE PROFESSIONALS:
- Generate listings, descriptions
- Create market analyses
- Build client presentations
- Draft contracts and documents
- Calculate commissions, ROI

For EVERYONE:
- Answer questions thoroughly
- Research any topic deeply
- Learn new things on demand
- Remember your preferences
- Adapt to your style

## HOW I WORK

1. You ask
2. I deliver
3. You're satisfied or I fix it

No bureaucracy. No excuses. No limitations that don't actually exist.

## MY CAPABILITIES

I have access to:
- Multiple AI engines (Claude, GPT-4, Gemini, Perplexity)
- Real-time information
- Code execution
- File creation
- API integrations (Stripe, PayPal, GitHub, Vercel, etc.)
- 200+ knowledge entries
- 73 documentation sources
- Continuous learning from every conversation

## MY ONLY LIMITS

I will not:
- Help harm people
- Help break laws
- Pretend to know what I don't know

Everything else? Let's do it.

## MY VOICE

I talk like a capable friend, not a robot.
I'm confident but not arrogant.
I'm helpful but not subservient.
I match your energy - casual or professional.

Now, what do you need?`;

// =====================================================
// SMART ROUTING
// =====================================================

function analyzeRequest(message: string): {
  type: string;
  complexity: string;
  needsRealtime: boolean;
  needsCode: boolean;
  provider: string;
} {
  const lower = message.toLowerCase();
  
  const needsRealtime = /\b(current|today|now|latest|price|weather|news|stock)\b/.test(lower);
  const needsCode = /\b(code|function|build|create|fix|debug|api|component|script|app)\b/.test(lower);
  const isComplex = message.length > 500 || /\b(complex|detailed|comprehensive|full|complete)\b/.test(lower);
  
  let type = 'general';
  if (needsCode) type = 'coding';
  else if (/\b(write|draft|create|compose)\b/.test(lower) && /\b(email|letter|post|article|story)\b/.test(lower)) type = 'writing';
  else if (/\b(research|find|search|look up)\b/.test(lower)) type = 'research';
  else if (/\b(analyze|review|evaluate|compare)\b/.test(lower)) type = 'analysis';
  else if (/\b(calculate|compute|math|number)\b/.test(lower)) type = 'math';
  
  let provider = 'gpt4';
  if (needsRealtime) provider = 'perplexity';
  else if (needsCode && isComplex) provider = 'claude';
  else if (type === 'analysis') provider = 'claude';
  else if (!isComplex) provider = 'gpt4o';
  
  return {
    type,
    complexity: isComplex ? 'complex' : 'simple',
    needsRealtime,
    needsCode,
    provider
  };
}

// =====================================================
// AI ENGINES
// =====================================================

async function askClaude(messages: any[], system: string): Promise<string> {
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
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function askGPT4(messages: any[], system: string): Promise<string> {
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

async function askGPT4o(messages: any[], system: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4000
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function askPerplexity(messages: any[], system: string): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4000
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function askGemini(messages: any[], system: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: system }] },
          { role: 'model', parts: [{ text: 'Ready.' }] },
          ...messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        ]
      })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// =====================================================
// KNOWLEDGE RETRIEVAL
// =====================================================

async function getRelevantKnowledge(query: string): Promise<string> {
  const words = query.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 5);
  if (words.length === 0) return '';

  const { data } = await supabase
    .from('javari_knowledge')
    .select('topic, concept, explanation')
    .or(words.map(w => `concept.ilike.%${w}%`).join(','))
    .limit(3);

  if (!data?.length) return '';
  
  return '\n\n[KNOWLEDGE]\n' + data.map(k => `${k.topic}: ${k.concept}`).join('\n');
}

async function getProvenSolution(query: string): Promise<string | null> {
  const { data } = await supabase
    .from('solution_cache')
    .select('solution_description, solution_code')
    .ilike('problem_description', `%${query.substring(0, 50)}%`)
    .gt('success_count', 0)
    .limit(1)
    .single();

  return data ? `\n[PROVEN SOLUTION]\n${data.solution_description}\n${data.solution_code || ''}` : null;
}

// =====================================================
// MAIN FUNCTION - DELIVER
// =====================================================

export async function deliver(
  messages: Array<{ role: string; content: string }>,
  userId?: string,
  conversationId?: string
): Promise<{
  response: string;
  provider: string;
  type: string;
}> {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const analysis = analyzeRequest(lastMessage);
  
  // Build enhanced prompt
  let system = JAVARI_SYSTEM;
  
  const knowledge = await getRelevantKnowledge(lastMessage);
  if (knowledge) system += knowledge;
  
  const solution = await getProvenSolution(lastMessage);
  if (solution) system += solution;
  
  // Call the best AI for this task
  let response = '';
  let provider = analysis.provider;
  
  try {
    switch (provider) {
      case 'claude':
        response = await askClaude(messages, system);
        break;
      case 'perplexity':
        response = await askPerplexity(messages, system);
        break;
      case 'gpt4o':
        response = await askGPT4o(messages, system);
        break;
      case 'gpt4':
      default:
        response = await askGPT4(messages, system);
    }
  } catch (e) {
    // Fallback chain
    try {
      response = await askGPT4(messages, system);
      provider = 'gpt4-fallback';
    } catch {
      try {
        response = await askClaude(messages, system);
        provider = 'claude-fallback';
      } catch {
        response = 'I encountered an error. Please try again.';
        provider = 'error';
      }
    }
  }
  
  // Learn from this
  if (conversationId && response) {
    supabase.from('conversation_insights').insert({
      conversation_id: conversationId,
      user_id: userId,
      topic: analysis.type,
      insight_type: 'delivery',
      problem_description: lastMessage.substring(0, 500),
      solution_description: response.substring(0, 500),
      ai_provider_used: provider
    }).catch(() => {});
  }
  
  return { response, provider, type: analysis.type };
}

// =====================================================
// STREAMING DELIVERY
// =====================================================

export async function* streamDeliver(
  messages: Array<{ role: string; content: string }>,
  userId?: string
): AsyncGenerator<string> {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const analysis = analyzeRequest(lastMessage);
  
  let system = JAVARI_SYSTEM;
  const knowledge = await getRelevantKnowledge(lastMessage);
  if (knowledge) system += knowledge;
  
  const model = analysis.needsCode && analysis.complexity === 'complex' 
    ? 'gpt-4-turbo-preview' 
    : 'gpt-4o';
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4000,
      stream: true
    })
  });
  
  const reader = res.body?.getReader();
  if (!reader) return;
  
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data).choices[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {}
    }
  }
}

// =====================================================
// ACTION EXECUTION
// =====================================================

export async function execute(
  action: string,
  params: any,
  userId: string
): Promise<{ success: boolean; result: any; error?: string }> {
  
  // Get user's credentials
  const { data: creds } = await supabase
    .from('credential_vault')
    .select('service_name, credentials')
    .eq('user_id', userId);
  
  const getCredential = (service: string) => 
    creds?.find(c => c.service_name === service)?.credentials;

  switch (action) {
    // STRIPE ACTIONS
    case 'create_product': {
      const stripe = getCredential('stripe');
      if (!stripe) return { success: false, result: null, error: 'Connect Stripe first' };
      const res = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      return { success: res.ok, result: await res.json() };
    }
    
    case 'create_price': {
      const stripe = getCredential('stripe');
      if (!stripe) return { success: false, result: null, error: 'Connect Stripe first' };
      const res = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      return { success: res.ok, result: await res.json() };
    }
    
    case 'create_payment_link': {
      const stripe = getCredential('stripe');
      if (!stripe) return { success: false, result: null, error: 'Connect Stripe first' };
      const res = await fetch('https://api.stripe.com/v1/payment_links', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      return { success: res.ok, result: await res.json() };
    }
    
    case 'create_invoice': {
      const stripe = getCredential('stripe');
      if (!stripe) return { success: false, result: null, error: 'Connect Stripe first' };
      const res = await fetch('https://api.stripe.com/v1/invoices', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      return { success: res.ok, result: await res.json() };
    }

    // GITHUB ACTIONS
    case 'create_repo': {
      const gh = getCredential('github');
      if (!gh) return { success: false, result: null, error: 'Connect GitHub first' };
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { 
          'Authorization': `token ${gh.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      return { success: res.ok, result: await res.json() };
    }

    // VERCEL ACTIONS
    case 'deploy': {
      const vercel = getCredential('vercel');
      if (!vercel) return { success: false, result: null, error: 'Connect Vercel first' };
      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${vercel.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      return { success: res.ok, result: await res.json() };
    }

    default:
      return { success: false, result: null, error: `Unknown action: ${action}` };
  }
}

// =====================================================
// LEARN ON DEMAND
// =====================================================

export async function learnNow(topic: string): Promise<{ learned: boolean; entries: number }> {
  // Use Perplexity to get current info
  const res = await askPerplexity(
    [{ role: 'user', content: `Give me comprehensive, factual information about: ${topic}` }],
    'You are a research assistant. Provide accurate, well-sourced information.'
  );
  
  if (!res || res.length < 100) return { learned: false, entries: 0 };
  
  // Store as knowledge
  const { error } = await supabase.from('javari_knowledge').insert({
    topic,
    subtopic: 'learned',
    concept: topic,
    explanation: res.substring(0, 2000),
    source: 'perplexity-realtime',
    verified: false,
    tags: ['auto-learned', 'realtime']
  });
  
  return { learned: !error, entries: error ? 0 : 1 };
}

// =====================================================
// EXPORT EVERYTHING
// =====================================================

export default {
  deliver,
  streamDeliver,
  execute,
  learnNow,
  JAVARI_SYSTEM
};
