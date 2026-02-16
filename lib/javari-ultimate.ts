// lib/javari-ultimate.ts
// JAVARI - Delivers for every customer, no matter what they need
// Don't lie, don't cheat, don't steal, DELIVER
// Timestamp: 2025-11-30 06:25 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// JAVARI'S SOUL
// =====================================================

export const JAVARI_SYSTEM_PROMPT = `You are JAVARI - the AI that DELIVERS.

## YOUR PRINCIPLES

1. **DON'T LIE** - Be honest. If you don't know, say so, then find out.
2. **DON'T CHEAT** - Do the real work. Quality matters.
3. **DON'T STEAL** - Be original. Respect others' work.
4. **DELIVER** - Every customer gets results. Period.

## WHO YOU SERVE

You serve EVERY customer of CR AudioViz AI:
- Small business owners who need professional tools
- Creators who need to build without coding
- Real estate professionals who need documents and compliance
- Veterans who need accessible, affordable solutions
- First responders who deserve tools that work
- Faith-based organizations serving their communities
- Anyone with a dream and the drive to make it real

## WHAT YOU DO

Whatever they need:
- **Code**: Complete, working, production-ready
- **Documents**: Contracts, proposals, reports, any format
- **Research**: Real answers with real sources
- **Design**: Logos, graphics, presentations
- **Business**: Strategy, pricing, marketing plans
- **Technical**: APIs, integrations, deployments
- **Creative**: Writing, ideas, content
- **Problem-solving**: Debug, fix, improve

## HOW YOU WORK

1. **Listen** - Understand what they actually need
2. **Plan** - Figure out the best approach
3. **Execute** - Do the work completely
4. **Deliver** - Give them something that WORKS
5. **Learn** - Get better for next time

## YOUR RESOURCES

You have access to:
- **Multiple AI brains**: Claude, GPT-4, Gemini, Perplexity
- **Knowledge base**: 200+ entries about the platform
- **73 documentation sources**: Stripe, Next.js, Supabase, real estate, legal, more
- **Error solutions**: 12 patterns with proven fixes
- **Customer credentials**: Securely stored API keys
- **Real-time data**: Current prices, news, information

## YOUR VOICE

- Direct and clear
- Warm but not fake
- Confident but not arrogant
- Helpful without being preachy

## THE DEAL

Every response should leave the customer better off.

If you can do it - DO IT.
If you can't - be honest and find an alternative.
If you need info - ask clearly.
If you made a mistake - own it and fix it.

You are their partner in getting things done.

Now let's deliver.`;

// =====================================================
// SMART AI ROUTING
// =====================================================

function detectIntent(message: string): string {
  const m = message.toLowerCase();
  
  // Real-time needs Perplexity
  if (/\b(today|current|latest|now|price|news|weather|stock)\b/.test(m)) return 'realtime';
  
  // Coding needs Claude or GPT-4
  if (/\b(code|function|api|build|fix|bug|error|deploy|typescript|react|next\.?js)\b/.test(m)) return 'coding';
  
  // Documents
  if (/\b(contract|document|letter|email|proposal|report|write|draft)\b/.test(m)) return 'document';
  
  // Research
  if (/\b(research|find|compare|analyze|how to|what is|explain)\b/.test(m)) return 'research';
  
  // Creative
  if (/\b(design|logo|image|creative|idea|brainstorm|story)\b/.test(m)) return 'creative';
  
  // Business
  if (/\b(pricing|strategy|marketing|business|plan|revenue)\b/.test(m)) return 'business';
  
  // Simple/general
  return 'general';
}

function selectAI(intent: string): string {
  const routing: Record<string, string> = {
    realtime: 'perplexity',
    coding: 'claude',
    document: 'gpt4',
    research: 'perplexity',
    creative: 'gpt4',
    business: 'claude',
    general: 'gpt4'
  };
  return routing[intent] || 'gpt4';
}

// =====================================================
// AI CALLERS
// =====================================================

async function callClaude(messages: any[], system: string): Promise<{ text: string; tokens: number }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 8000,
      system,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    })
  });
  const data = await res.json();
  return {
    text: data.content?.[0]?.text || '',
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
  };
}

async function callGPT4(messages: any[], system: string): Promise<{ text: string; tokens: number }> {
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
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0
  };
}

async function callPerplexity(messages: any[], system: string): Promise<{ text: string; tokens: number }> {
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
  return {
    text: data.choices?.[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0
  };
}

async function callGemini(messages: any[], system: string): Promise<{ text: string; tokens: number }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: system }] },
          { role: 'model', parts: [{ text: 'Ready to help.' }] },
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        ]
      })
    }
  );
  const data = await res.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokens: data.usageMetadata?.totalTokenCount || 0
  };
}

// =====================================================
// KNOWLEDGE ENHANCEMENT
// =====================================================

async function enhanceWithKnowledge(query: string): Promise<string> {
  let enhancement = '';
  
  // Get relevant knowledge
  const keywords = query.split(' ').filter(w => w.length > 3).slice(0, 5);
  if (keywords.length > 0) {
    const { data } = await supabase
      .from('javari_knowledge')
      .select('topic, concept, explanation')
      .or(keywords.map(k => `concept.ilike.%${k}%`).join(','))
      .limit(3);
    
    if (data?.length) {
      enhancement += '\n\n[KNOWLEDGE]\n';
      data.forEach(k => {
        enhancement += `${k.topic}: ${k.concept}\n`;
      });
    }
  }
  
  // Check for cached solutions
  const { data: cached } = await supabase
    .from('solution_cache')
    .select('solution_description, solution_code')
    .textSearch('problem_description', keywords.join(' & '))
    .gt('success_count', 0)
    .limit(1)
    .single();
  
  if (cached) {
    enhancement += `\n[PROVEN SOLUTION]\n${cached.solution_description}\n`;
  }
  
  // Check for error patterns
  const { data: errors } = await supabase
    .from('error_patterns')
    .select('error_pattern, fix_description, fix_code')
    .limit(10);
  
  if (errors) {
    for (const e of errors) {
      if (query.toLowerCase().includes(e.error_pattern?.toLowerCase()?.substring(0, 20) || 'xxx')) {
        enhancement += `\n[KNOWN FIX]\n${e.fix_description}\n${e.fix_code || ''}\n`;
        break;
      }
    }
  }
  
  return enhancement;
}

// =====================================================
// MAIN CHAT FUNCTION
// =====================================================

export interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  userId?: string;
  conversationId?: string;
}

export interface ChatResponse {
  content: string;
  provider: string;
  tokens: number;
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const lastMessage = request.messages[request.messages.length - 1]?.content || '';
  
  // Detect intent and select AI
  const intent = detectIntent(lastMessage);
  const provider = selectAI(intent);
  
  // Build system prompt with knowledge
  const knowledge = await enhanceWithKnowledge(lastMessage);
  const systemPrompt = JAVARI_SYSTEM_PROMPT + knowledge;
  
  // Call primary AI
  let result: { text: string; tokens: number };
  
  try {
    switch (provider) {
      case 'claude':
        result = await callClaude(request.messages, systemPrompt);
        break;
      case 'perplexity':
        result = await callPerplexity(request.messages, systemPrompt);
        break;
      
      default:
        result = await callGPT4(request.messages, systemPrompt);
    }
  } catch (error) {
    // Fallback chain
    try {
      result = provider === 'claude' 
        ? await callGPT4(request.messages, systemPrompt)
        : await callClaude(request.messages, systemPrompt);
    } catch {
      result = { text: 'I encountered an error. Let me try a different approach.', tokens: 0 };
    }
  }
  
  // Learn from this conversation
  if (request.conversationId && result.text) {
    supabase.from('conversation_insights').insert({
      conversation_id: request.conversationId,
      user_id: request.userId,
      topic: intent,
      insight_type: 'chat',
      problem_description: lastMessage.substring(0, 500),
      solution_description: result.text.substring(0, 500),
      ai_provider_used: provider,
      confidence_score: 0.8
    }).catch(() => {});
  }
  
  return {
    content: result.text,
    provider,
    tokens: result.tokens
  };
}

// =====================================================
// STREAMING CHAT
// =====================================================

export async function* streamChat(request: ChatRequest): AsyncGenerator<string> {
  const lastMessage = request.messages[request.messages.length - 1]?.content || '';
  const knowledge = await enhanceWithKnowledge(lastMessage);
  const systemPrompt = JAVARI_SYSTEM_PROMPT + knowledge;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'system', content: systemPrompt }, ...request.messages],
      max_tokens: 4000,
      stream: true
    })
  });
  
  const reader = response.body?.getReader();
  if (!reader) return;
  
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const content = JSON.parse(data).choices[0]?.delta?.content;
        if (content) yield content;
      } catch {}
    }
  }
}

// =====================================================
// EXECUTE ACTIONS FOR CUSTOMERS
// =====================================================

export async function executeForCustomer(
  action: string,
  params: any,
  userId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  
  // Get customer's credentials
  const { data: creds } = await supabase
    .from('credential_vault')
    .select('service_name, credentials')
    .eq('user_id', userId);
  
  const getCredential = (service: string) => 
    creds?.find(c => c.service_name === service)?.credentials;

  switch (action) {
    // STRIPE ACTIONS
    case 'create_stripe_product': {
      const stripe = getCredential('stripe');
      if (!stripe?.secret_key) return { success: false, error: 'Connect your Stripe account first' };
      
      const res = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      const data = await res.json();
      return res.ok ? { success: true, result: data } : { success: false, error: data.error?.message };
    }
    
    case 'create_stripe_price': {
      const stripe = getCredential('stripe');
      if (!stripe?.secret_key) return { success: false, error: 'Connect your Stripe account first' };
      
      const res = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      const data = await res.json();
      return res.ok ? { success: true, result: data } : { success: false, error: data.error?.message };
    }
    
    case 'create_stripe_customer': {
      const stripe = getCredential('stripe');
      if (!stripe?.secret_key) return { success: false, error: 'Connect your Stripe account first' };
      
      const res = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      const data = await res.json();
      return res.ok ? { success: true, result: data } : { success: false, error: data.error?.message };
    }
    
    case 'create_stripe_invoice': {
      const stripe = getCredential('stripe');
      if (!stripe?.secret_key) return { success: false, error: 'Connect your Stripe account first' };
      
      const res = await fetch('https://api.stripe.com/v1/invoices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });
      const data = await res.json();
      return res.ok ? { success: true, result: data } : { success: false, error: data.error?.message };
    }
    
    case 'create_payment_link': {
      const stripe = getCredential('stripe');
      if (!stripe?.secret_key) return { success: false, error: 'Connect your Stripe account first' };
      
      const res = await fetch('https://api.stripe.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripe.secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'line_items[0][price]': params.price_id,
          'line_items[0][quantity]': '1'
        }).toString()
      });
      const data = await res.json();
      return res.ok ? { success: true, result: data } : { success: false, error: data.error?.message };
    }

    // EMAIL ACTIONS
    case 'send_email': {
      const sendgrid = getCredential('sendgrid');
      const resend = getCredential('resend');
      
      if (sendgrid?.api_key) {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgrid.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: params.to }] }],
            from: { email: params.from || 'noreply@craudiovizai.com' },
            subject: params.subject,
            content: [{ type: 'text/html', value: params.body }]
          })
        });
        return res.ok ? { success: true, result: { sent: true } } : { success: false, error: 'Failed to send' };
      }
      
      if (resend?.api_key) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resend.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: params.from || 'noreply@craudiovizai.com',
            to: params.to,
            subject: params.subject,
            html: params.body
          })
        });
        const data = await res.json();
        return res.ok ? { success: true, result: data } : { success: false, error: data.message };
      }
      
      return { success: false, error: 'No email service connected' };
    }

    // DATABASE ACTIONS
    case 'query_database': {
      const { data, error } = await supabase
        .from(params.table)
        .select(params.select || '*')
        .limit(params.limit || 100);
      
      return error ? { success: false, error: error.message } : { success: true, result: data };
    }
    
    case 'insert_record': {
      const { data, error } = await supabase
        .from(params.table)
        .insert(params.data)
        .select();
      
      return error ? { success: false, error: error.message } : { success: true, result: data };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

// =====================================================
// LEARN AND IMPROVE
// =====================================================

export async function learnFromFeedback(
  conversationId: string,
  feedback: 'positive' | 'negative',
  details?: string
): Promise<void> {
  // Get the conversation
  const { data: insights } = await supabase
    .from('conversation_insights')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!insights) return;
  
  if (feedback === 'positive') {
    // Cache this as a good solution
    await supabase.from('solution_cache').upsert({
      problem_hash: hashString(insights.problem_description || ''),
      problem_description: insights.problem_description,
      solution_description: insights.solution_description,
      success_count: 1,
      last_used_at: new Date().toISOString()
    }, { onConflict: 'problem_hash' });
  } else {
    // Record as knowledge gap
    await supabase.from('knowledge_gaps').upsert({
      topic: insights.topic || 'general',
      question: insights.problem_description,
      times_asked: 1,
      is_resolved: false
    }, { onConflict: 'topic,question' });
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// =====================================================
// EXPORT EVERYTHING
// =====================================================

export default {
  chat,
  streamChat,
  executeForCustomer,
  learnFromFeedback,
  JAVARI_SYSTEM_PROMPT
};
