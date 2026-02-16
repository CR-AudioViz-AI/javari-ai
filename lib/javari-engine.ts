// lib/javari-engine.ts
// Javari's Complete Execution Engine
// Timestamp: 2025-11-30 05:50 AM EST

import { createClient } from '@supabase/supabase-js';
import { getJavariPrompt, detectTaskType } from './javari-system-prompt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// AI PROVIDERS - Use the right tool for the job
// =====================================================

interface AIResponse {
  content: string;
  provider: string;
  tokens: number;
}

async function callOpenAI(messages: any[], systemPrompt: string): Promise<AIResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 4000,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    provider: 'gpt-4-turbo',
    tokens: data.usage?.total_tokens || 0
  };
}

async function callClaude(messages: any[], systemPrompt: string): Promise<AIResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 4000,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    })
  });
  
  const data = await response.json();
  return {
    content: data.content[0].text,
    provider: 'claude-3.5-sonnet',
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
  };
}

async function callGemini(messages: any[], systemPrompt: string): Promise<AIResponse> {
  const contents = [
    { role: 'user', parts: [{ text: `[System Instructions]\n${systemPrompt}\n[End Instructions]\n\nReady.` }] },
    { role: 'model', parts: [{ text: 'Ready to execute.' }] },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    }
  );
  
  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    provider: 'gemini-1.5-pro',
    tokens: data.usageMetadata?.totalTokenCount || 0
  };
}

async function callPerplexity(query: string): Promise<AIResponse> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [{ role: 'user', content: query }],
      max_tokens: 4000
    })
  });
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    provider: 'perplexity',
    tokens: data.usage?.total_tokens || 0
  };
}

// =====================================================
// KNOWLEDGE RETRIEVAL
// =====================================================

async function getRelevantKnowledge(query: string, limit: number = 5): Promise<string> {
  // Search knowledge base
  const { data: knowledge } = await supabase
    .from('javari_knowledge')
    .select('topic, concept, explanation, examples')
    .or(`concept.ilike.%${query}%,explanation.ilike.%${query}%,topic.ilike.%${query}%`)
    .limit(limit);

  if (!knowledge || knowledge.length === 0) return '';

  let context = '\n\n## RELEVANT KNOWLEDGE:\n';
  for (const k of knowledge) {
    context += `\n### ${k.topic}: ${k.concept}\n${k.explanation}\n`;
    if (k.examples?.length > 0) {
      context += `Example: ${k.examples[0]}\n`;
    }
  }
  
  return context;
}

async function getErrorFix(errorMessage: string): Promise<string | null> {
  const { data: patterns } = await supabase
    .from('error_patterns')
    .select('fix_description, fix_code')
    .limit(10);

  if (!patterns) return null;

  for (const pattern of patterns) {
    // Simple match - in production use better matching
    if (errorMessage.toLowerCase().includes(pattern.fix_description?.toLowerCase().substring(0, 20) || '')) {
      return `FIX: ${pattern.fix_description}\n\nCode:\n${pattern.fix_code}`;
    }
  }
  
  return null;
}

async function getCachedSolution(problem: string): Promise<string | null> {
  const { data } = await supabase
    .from('solution_cache')
    .select('solution_description, solution_code')
    .ilike('problem_description', `%${problem.substring(0, 50)}%`)
    .gt('success_count', 0)
    .limit(1)
    .single();

  if (data) {
    return `CACHED SOLUTION:\n${data.solution_description}\n\n${data.solution_code || ''}`;
  }
  
  return null;
}

// =====================================================
// CREDENTIAL RETRIEVAL
// =====================================================

async function getCredential(userId: string, service: string): Promise<any> {
  const { data } = await supabase
    .from('credential_vault')
    .select('credentials')
    .eq('user_id', userId)
    .eq('service_name', service)
    .eq('is_verified', true)
    .single();

  return data?.credentials;
}

// =====================================================
// MAIN EXECUTION ENGINE
// =====================================================

export interface JavariRequest {
  messages: Array<{ role: string; content: string }>;
  userId?: string;
  conversationId?: string;
  stream?: boolean;
}

export interface JavariResponse {
  content: string;
  provider: string;
  tokens: number;
  knowledge_used: boolean;
  cached_solution: boolean;
}

export async function executeJavari(request: JavariRequest): Promise<JavariResponse> {
  const lastMessage = request.messages[request.messages.length - 1]?.content || '';
  
  // Detect task type and get appropriate prompt
  const taskType = detectTaskType(lastMessage);
  let systemPrompt = getJavariPrompt(taskType);
  
  // Enhance with relevant knowledge
  const knowledge = await getRelevantKnowledge(lastMessage);
  if (knowledge) {
    systemPrompt += knowledge;
  }
  
  // Check for cached solution
  const cachedSolution = await getCachedSolution(lastMessage);
  if (cachedSolution) {
    systemPrompt += `\n\n## PROVEN SOLUTION AVAILABLE:\n${cachedSolution}`;
  }
  
  // Check for error pattern
  if (/error|failed|broken|not working/i.test(lastMessage)) {
    const errorFix = await getErrorFix(lastMessage);
    if (errorFix) {
      systemPrompt += `\n\n## KNOWN FIX:\n${errorFix}`;
    }
  }
  
  // Select best AI for the task
  let response: AIResponse;
  
  try {
    if (taskType === 'research' || /current|latest|today|news/i.test(lastMessage)) {
      // Use Perplexity for real-time research
      response = await callPerplexity(lastMessage);
    } else if (taskType === 'coding') {
      // Use Claude for complex coding, GPT-4 for general
      if (lastMessage.length > 500 || /complex|architecture|design/i.test(lastMessage)) {
        response = await callClaude(request.messages, systemPrompt);
      } else {
        response = await callOpenAI(request.messages, systemPrompt);
      }
    } else {
      // Default to GPT-4
      response = await callOpenAI(request.messages, systemPrompt);
    }
  } catch (error) {
    // Fallback chain
    console.error('Primary AI failed, trying fallback:', error);
    try {
      response = await callClaude(request.messages, systemPrompt);
    } catch (e2) {
      try {
        response = await callGemini(request.messages, systemPrompt);
      } catch (e3) {
        throw new Error('All AI providers failed');
      }
    }
  }
  
  // Learn from this interaction
  if (request.conversationId) {
    await supabase.from('conversation_insights').insert({
      conversation_id: request.conversationId,
      user_id: request.userId,
      topic: taskType,
      insight_type: 'interaction',
      problem_description: lastMessage.substring(0, 500),
      solution_description: response.content.substring(0, 500),
      confidence_score: 0.7
    }).catch(() => {}); // Don't fail if logging fails
  }
  
  return {
    content: response.content,
    provider: response.provider,
    tokens: response.tokens,
    knowledge_used: !!knowledge,
    cached_solution: !!cachedSolution
  };
}

// =====================================================
// STREAMING VERSION
// =====================================================

export async function* streamJavari(request: JavariRequest): AsyncGenerator<string> {
  const lastMessage = request.messages[request.messages.length - 1]?.content || '';
  const taskType = detectTaskType(lastMessage);
  let systemPrompt = getJavariPrompt(taskType);
  
  // Add knowledge context
  const knowledge = await getRelevantKnowledge(lastMessage);
  if (knowledge) systemPrompt += knowledge;
  
  // Stream from OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...request.messages
      ],
      max_tokens: 4000,
      temperature: 0.7,
      stream: true
    })
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) throw new Error('No reader available');
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
    
    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) yield content;
      } catch {}
    }
  }
}

// =====================================================
// TOOL EXECUTION
// =====================================================

export async function executeWithCredentials(
  userId: string,
  service: string,
  action: string,
  params: any
): Promise<any> {
  const credentials = await getCredential(userId, service);
  
  if (!credentials) {
    throw new Error(`No ${service} credentials found. Please connect your ${service} account first.`);
  }
  
  switch (service) {
    case 'stripe':
      return executeStripeAction(credentials, action, params);
    case 'supabase':
      return executeSupabaseAction(credentials, action, params);
    // Add more services as needed
    default:
      throw new Error(`Service ${service} not yet supported for direct execution`);
  }
}

async function executeStripeAction(credentials: any, action: string, params: any): Promise<any> {
  const stripe = require('stripe')(credentials.secret_key);
  
  switch (action) {
    case 'create_product':
      return stripe.products.create(params);
    case 'create_price':
      return stripe.prices.create(params);
    case 'create_customer':
      return stripe.customers.create(params);
    case 'create_invoice':
      return stripe.invoices.create(params);
    case 'create_payment_link':
      return stripe.paymentLinks.create(params);
    default:
      throw new Error(`Unknown Stripe action: ${action}`);
  }
}

async function executeSupabaseAction(credentials: any, action: string, params: any): Promise<any> {
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(credentials.url, credentials.service_key);
  
  switch (action) {
    case 'query':
      return client.from(params.table).select(params.select || '*');
    case 'insert':
      return client.from(params.table).insert(params.data);
    case 'update':
      return client.from(params.table).update(params.data).match(params.match);
    case 'delete':
      return client.from(params.table).delete().match(params.match);
    default:
      throw new Error(`Unknown Supabase action: ${action}`);
  }
}

export default {
  executeJavari,
  streamJavari,
  executeWithCredentials,
  getRelevantKnowledge
};
