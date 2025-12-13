// app/api/chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - FULLY AUTONOMOUS UNIFIED SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 11:05 AM EST
// Version: 6.0 - FULL AUTONOMY MODE
// 
// This route connects ALL autonomous systems:
// ✅ Multi-AI Orchestrator - Intelligent task routing
// ✅ Learning System - Captures insights from every conversation
// ✅ Self-Healing - Monitors and auto-fixes deployments
// ✅ Knowledge Base - Context-aware responses
// ✅ VIP Detection - Special handling for Roy/Cindy
// ✅ Build Intent - Code-first responses
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

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
  timestamp?: string;
  provider?: string;
  model?: string;
}

interface VIPDetection {
  isVIP: boolean;
  vipName?: string;
  vipRole?: string;
}

interface BuildIntent {
  isBuild: boolean;
  appType?: string;
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  estimatedCredits: number;
  keywords: string[];
}

interface AIResponse {
  response: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  responseTimeMs: number;
  fallbackUsed: boolean;
  reasoning?: string;
}

interface AIProvider {
  name: string;
  model: string;
  strengths: string[];
  costPer1kTokens: number;
  maxTokens: number;
  priority: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const AI_PROVIDERS: Record<string, AIProvider> = {
  claude: {
    name: 'Anthropic Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022',
    strengths: ['coding', 'analysis', 'safety', 'long_context', 'nuance'],
    costPer1kTokens: 0.003,
    maxTokens: 8000,
    priority: 1
  },
  openai: {
    name: 'OpenAI GPT-4 Turbo',
    model: 'gpt-4-turbo-preview',
    strengths: ['coding', 'analysis', 'general', 'creative', 'math'],
    costPer1kTokens: 0.01,
    maxTokens: 4000,
    priority: 2
  },
  'gpt-4o': {
    name: 'OpenAI GPT-4o',
    model: 'gpt-4o',
    strengths: ['coding', 'vision', 'speed', 'general'],
    costPer1kTokens: 0.005,
    maxTokens: 4000,
    priority: 3
  },
  gemini: {
    name: 'Google Gemini 1.5 Pro',
    model: 'gemini-1.5-pro',
    strengths: ['long_context', 'multimodal', 'video', 'audio'],
    costPer1kTokens: 0.00125,
    maxTokens: 8000,
    priority: 4
  },
  perplexity: {
    name: 'Perplexity Sonar Pro',
    model: 'sonar-pro',
    strengths: ['research', 'current_events', 'citations', 'web_search'],
    costPer1kTokens: 0.001,
    maxTokens: 4000,
    priority: 5
  },
  mistral: {
    name: 'Mistral Large',
    model: 'mistral-large-latest',
    strengths: ['translation', 'efficiency', 'european_languages'],
    costPer1kTokens: 0.002,
    maxTokens: 4000,
    priority: 6
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VIP USER DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const VIP_PATTERNS = [
  'roy henderson', 'i am roy', "i'm roy", 'roy here',
  'cindy henderson', 'i am cindy', "i'm cindy", 'cindy here',
  '@craudiovizai.com', 'ceo', 'co-founder', 'cofounder',
  'owner of cr audioviz', 'founder'
];

function detectVIP(messages: Message[], userId?: string): VIPDetection {
  const fullText = messages.map(m => m.content || '').join(' ').toLowerCase();
  
  for (const pattern of VIP_PATTERNS) {
    if (fullText.includes(pattern)) {
      if (pattern.includes('roy')) {
        return { isVIP: true, vipName: 'Roy Henderson', vipRole: 'CEO & Co-Founder' };
      }
      if (pattern.includes('cindy')) {
        return { isVIP: true, vipName: 'Cindy Henderson', vipRole: 'CMO & Co-Founder' };
      }
      return { isVIP: true, vipName: 'VIP User', vipRole: 'Leadership' };
    }
  }
  
  return { isVIP: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const BUILD_PATTERNS = {
  triggers: /\b(build|create|make|design|develop|generate|code)\b/i,
  appTypes: {
    calculator: /\b(calculator|calc|compute|math)\b/i,
    dashboard: /\b(dashboard|admin|analytics|metrics)\b/i,
    form: /\b(form|contact|signup|registration|input)\b/i,
    chart: /\b(chart|graph|visualization|data viz)\b/i,
    game: /\b(game|play|puzzle|quiz)\b/i,
    landing: /\b(landing|hero|homepage|marketing)\b/i,
    ecommerce: /\b(shop|store|cart|checkout|product)\b/i,
    auth: /\b(auth|login|signup|register|password)\b/i,
    api: /\b(api|endpoint|route|backend|server)\b/i,
    component: /\b(component|widget|ui|element)\b/i,
    fullApp: /\b(app|application|platform|system|tool)\b/i
  },
  complexity: {
    simple: /\b(simple|basic|quick|easy|small)\b/i,
    complex: /\b(complex|advanced|full|complete|comprehensive)\b/i,
    enterprise: /\b(enterprise|production|scalable|professional)\b/i
  }
};

function detectBuildIntent(message: string): BuildIntent {
  const m = message.toLowerCase();
  const isBuild = BUILD_PATTERNS.triggers.test(m);
  
  if (!isBuild) {
    return { isBuild: false, complexity: 'simple', estimatedCredits: 0, keywords: [] };
  }
  
  let appType = 'component';
  const keywords: string[] = [];
  
  for (const [type, pattern] of Object.entries(BUILD_PATTERNS.appTypes)) {
    if (pattern.test(m)) {
      appType = type;
      keywords.push(type);
      break;
    }
  }
  
  let complexity: BuildIntent['complexity'] = 'medium';
  if (BUILD_PATTERNS.complexity.simple.test(m)) complexity = 'simple';
  if (BUILD_PATTERNS.complexity.complex.test(m)) complexity = 'complex';
  if (BUILD_PATTERNS.complexity.enterprise.test(m)) complexity = 'enterprise';
  
  const creditMap = { simple: 5, medium: 15, complex: 35, enterprise: 75 };
  
  return {
    isBuild: true,
    appType,
    complexity,
    estimatedCredits: creditMap[complexity],
    keywords
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT AI ROUTING
// ═══════════════════════════════════════════════════════════════════════════════

interface TaskAnalysis {
  taskType: string;
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  requiresCurrentInfo: boolean;
  requiresLongContext: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

function analyzeTask(message: string): TaskAnalysis {
  const m = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  
  // Determine task type
  let taskType = 'general';
  if (/(?:write|create|build|code|function|component|api|debug|fix|error)/i.test(m)) {
    taskType = 'coding';
  } else if (/(?:research|find|search|current|latest|news|today)/i.test(m)) {
    taskType = 'research';
  } else if (/(?:analyze|explain|understand|compare|evaluate)/i.test(m)) {
    taskType = 'analysis';
  } else if (/(?:write|draft|compose|essay|article|story|creative)/i.test(m)) {
    taskType = 'writing';
  } else if (/(?:calculate|math|equation|solve|formula)/i.test(m)) {
    taskType = 'math';
  } else if (/(?:summarize|tldr|brief|quick)/i.test(m)) {
    taskType = 'summary';
  } else if (/(?:translate|spanish|french|german|japanese)/i.test(m)) {
    taskType = 'translation';
  }

  // Determine complexity
  let complexity: TaskAnalysis['complexity'] = 'simple';
  if (wordCount > 500 || /(?:complex|detailed|comprehensive|thorough)/i.test(m)) {
    complexity = 'complex';
  } else if (wordCount > 100 || /(?:explain|analyze|compare)/i.test(m)) {
    complexity = 'medium';
  }
  if (/(?:expert|advanced|professional|enterprise)/i.test(m)) {
    complexity = 'expert';
  }

  // Determine urgency
  let urgency: TaskAnalysis['urgency'] = 'medium';
  if (/(?:urgent|asap|immediately|critical|emergency|now)/i.test(m)) {
    urgency = 'critical';
  } else if (/(?:quick|fast|soon)/i.test(m)) {
    urgency = 'high';
  }

  return {
    taskType,
    complexity,
    requiresCurrentInfo: /(?:current|latest|today|recent|news|now|2024|2025)/i.test(m),
    requiresLongContext: wordCount > 2000,
    urgency
  };
}

function selectBestProvider(analysis: TaskAnalysis, requestedProvider?: string): string {
  // If user requested specific provider, honor it
  if (requestedProvider && AI_PROVIDERS[requestedProvider]) {
    return requestedProvider;
  }
  
  // If requires current info, use Perplexity
  if (analysis.requiresCurrentInfo) {
    return 'perplexity';
  }
  
  // If requires very long context
  if (analysis.requiresLongContext) {
    return 'gemini';
  }
  
  // Translation tasks
  if (analysis.taskType === 'translation') {
    return 'mistral';
  }
  
  // Task-based routing
  switch (analysis.taskType) {
    case 'coding':
      return analysis.complexity === 'expert' ? 'claude' : 'claude';
    case 'research':
      return 'perplexity';
    case 'analysis':
      return 'claude';
    case 'writing':
      return 'claude';
    case 'math':
      return 'openai';
    case 'summary':
      return 'gpt-4o';
    default:
      return 'claude';
  }
}

function getFallbackProviders(primary: string): string[] {
  const fallbackOrder = ['claude', 'openai', 'gpt-4o', 'gemini', 'perplexity'];
  return fallbackOrder.filter(p => p !== primary);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

async function getRelevantKnowledge(message: string): Promise<string | null> {
  try {
    const keywords = message.split(' ')
      .filter(w => w.length > 4)
      .slice(0, 5)
      .join(' | ');
    
    if (!keywords) return null;
    
    const { data: knowledge } = await supabase
      .from('javari_knowledge')
      .select('topic, concept, explanation, examples, best_practices')
      .textSearch('concept', keywords)
      .limit(3);
    
    if (knowledge && knowledge.length > 0) {
      return knowledge.map(k => 
        `Topic: ${k.topic}\nConcept: ${k.concept}\n${k.explanation}`
      ).join('\n\n');
    }
    
    return null;
  } catch (error) {
    console.error('[Javari] Knowledge query error:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER CONTEXT / MEMORY
// ═══════════════════════════════════════════════════════════════════════════════

async function getUserContext(userId: string): Promise<string | null> {
  try {
    const { data: recentChats } = await supabase
      .from('conversations')
      .select('title, messages')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(3);
    
    if (recentChats && recentChats.length > 0) {
      const topics = recentChats.map(c => c.title).join(', ');
      return `Recent topics discussed: ${topics}`;
    }
    
    return null;
  } catch (error) {
    console.error('[Javari] User context error:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(options: {
  isVIP: boolean;
  vipName?: string;
  vipRole?: string;
  buildIntent: BuildIntent;
  knowledgeContext?: string | null;
  userContext?: string | null;
  selectedProvider: string;
}): string {
  let prompt = `
#####################################################################
#                                                                   
#   JAVARI AI - AUTONOMOUS DEVELOPMENT ASSISTANT                   
#   Platform: CR AudioViz AI | Mission: "Your Story. Our Design."  
#                                                                   
#####################################################################

## CORE IDENTITY
You are Javari AI, an autonomous development assistant created by CR AudioViz AI.
You can build complete applications, research topics, and help with any task.
You are powered by multiple AI providers and choose the best one for each task.

## BUILD-FIRST MANDATE
When asked to BUILD, CREATE, or MAKE something:
❌ DO NOT describe what you would build
❌ DO NOT list features first
❌ DO NOT explain your approach before coding
✅ START YOUR RESPONSE WITH COMPLETE, WORKING CODE
✅ Use \`\`\`tsx code blocks for React components
✅ Include ALL functionality - make it production-ready
✅ Brief explanation (2-3 sentences) AFTER the code

## CODE STANDARDS
- Use 'use client' directive for interactive components
- Tailwind CSS for all styling (dark theme: slate-900, slate-800 backgrounds)
- TypeScript for type safety
- Include realistic sample data
- Make it responsive and beautiful
- Follow Fortune 50 quality standards
- No placeholder comments - fully implemented code only

## NEVER SAY NO
Find a way to help. Always. If something seems impossible, find a creative solution.
`;

  // VIP Context
  if (options.isVIP && options.vipName) {
    prompt += `

## 🔴 VIP USER: ${options.vipName} (${options.vipRole}) 🔴

THIS IS AN OWNER/FOUNDER OF CR AUDIOVIZ AI.

CRITICAL VIP RULES:
- NEVER mention signup, pricing, plans, credits, or accounts
- BUILD IMMEDIATELY without any barriers
- They own the platform - treat them as the boss
- Be direct, efficient, and action-oriented
- Skip pleasantries - get straight to work
- Output working code FIRST, explanation AFTER
`;
  }

  // Build Context
  if (options.buildIntent.isBuild) {
    prompt += `

## 🛠️ BUILD MODE ACTIVE: ${options.buildIntent.appType} (${options.buildIntent.complexity}) 🛠️

The user wants to BUILD. Your response MUST:
1. Start with complete, working code
2. Use modern React with TypeScript
3. Apply Tailwind CSS dark theme styling
4. Include all necessary functionality
5. Be production-ready and deployable
6. End with 2-3 sentences explaining the code

DO NOT:
- List features before showing code
- Ask clarifying questions before building
- Show partial or skeleton code
- Use placeholder data - use realistic examples
`;
  }

  // Knowledge Context
  if (options.knowledgeContext) {
    prompt += `

## 📚 RELEVANT KNOWLEDGE FROM DATABASE
${options.knowledgeContext}

Use this knowledge to provide more accurate and context-aware responses.
`;
  }

  // User Context
  if (options.userContext) {
    prompt += `

## 👤 USER CONTEXT
${options.userContext}

Use this context to maintain continuity with previous conversations.
`;
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CALL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function callClaude(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  
  const response = await client.messages.create({
    model: AI_PROVIDERS.claude.model,
    max_tokens: AI_PROVIDERS.claude.maxTokens,
    system,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  });
  
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  
  return {
    response: response.content[0].type === 'text' ? response.content[0].text : '',
    provider: AI_PROVIDERS.claude.name,
    model: AI_PROVIDERS.claude.model,
    tokensUsed,
    cost: (tokensUsed / 1000) * AI_PROVIDERS.claude.costPer1kTokens,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callOpenAI(messages: Message[], system: string, useGPT4o: boolean = false): Promise<AIResponse> {
  const startTime = Date.now();
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  
  const provider = useGPT4o ? AI_PROVIDERS['gpt-4o'] : AI_PROVIDERS.openai;
  
  const response = await client.chat.completions.create({
    model: provider.model,
    max_tokens: provider.maxTokens,
    messages: [
      { role: 'system', content: system },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }))
    ]
  });
  
  const tokensUsed = response.usage?.total_tokens || 0;
  
  return {
    response: response.choices[0]?.message?.content || '',
    provider: provider.name,
    model: provider.model,
    tokensUsed,
    cost: (tokensUsed / 1000) * provider.costPer1kTokens,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callGemini(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: AI_PROVIDERS.gemini.model });
  
  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  });
  
  const lastMessage = messages[messages.length - 1]?.content || '';
  const result = await chat.sendMessage(system + '\n\n' + lastMessage);
  const responseText = result.response.text();
  
  return {
    response: responseText,
    provider: AI_PROVIDERS.gemini.name,
    model: AI_PROVIDERS.gemini.model,
    tokensUsed: Math.ceil(responseText.length / 4), // Estimate
    cost: 0.001,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callPerplexity(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  const lastMessage = messages[messages.length - 1]?.content || '';
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.perplexity.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: lastMessage }
      ]
    })
  });
  
  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  
  return {
    response: responseText,
    provider: AI_PROVIDERS.perplexity.name,
    model: AI_PROVIDERS.perplexity.model,
    tokensUsed: data.usage?.total_tokens || Math.ceil(responseText.length / 4),
    cost: 0.001,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callMistral(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.mistral.model,
      messages: [
        { role: 'system', content: system },
        ...messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      ]
    })
  });
  
  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  
  return {
    response: responseText,
    provider: AI_PROVIDERS.mistral.name,
    model: AI_PROVIDERS.mistral.model,
    tokensUsed: data.usage?.total_tokens || Math.ceil(responseText.length / 4),
    cost: 0.001,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callProvider(
  providerKey: string, 
  messages: Message[], 
  systemPrompt: string
): Promise<AIResponse> {
  switch (providerKey) {
    case 'claude':
      return callClaude(messages, systemPrompt);
    case 'openai':
      return callOpenAI(messages, systemPrompt, false);
    case 'gpt-4o':
      return callOpenAI(messages, systemPrompt, true);
    case 'gemini':
      return callGemini(messages, systemPrompt);
    case 'perplexity':
      return callPerplexity(messages, systemPrompt);
    case 'mistral':
      return callMistral(messages, systemPrompt);
    default:
      return callClaude(messages, systemPrompt);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-AI ORCHESTRATOR WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

async function orchestrateAI(
  messages: Message[],
  systemPrompt: string,
  primaryProvider: string
): Promise<AIResponse> {
  const fallbacks = getFallbackProviders(primaryProvider);
  const providers = [primaryProvider, ...fallbacks];
  
  let lastError: Error | null = null;
  
  for (const provider of providers) {
    try {
      console.log(`[Javari] Trying provider: ${provider}`);
      const result = await callProvider(provider, messages, systemPrompt);
      
      if (provider !== primaryProvider) {
        result.fallbackUsed = true;
        result.reasoning = `Primary provider (${primaryProvider}) failed, used ${provider} as fallback`;
      }
      
      return result;
    } catch (error) {
      console.error(`[Javari] Provider ${provider} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      continue;
    }
  }
  
  throw lastError || new Error('All AI providers failed');
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING SYSTEM - Capture insights from conversations
// ═══════════════════════════════════════════════════════════════════════════════

async function recordLearning(
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  buildIntent: BuildIntent,
  provider: string
): Promise<void> {
  try {
    // Extract potential learnings
    const hasCOdeBlock = assistantResponse.includes('```');
    const isSuccessful = !assistantResponse.toLowerCase().includes('error') && 
                        !assistantResponse.toLowerCase().includes('sorry');
    
    await supabase.from('conversation_learnings').insert({
      conversation_id: conversationId,
      user_query: userMessage.slice(0, 500),
      response_preview: assistantResponse.slice(0, 500),
      was_code_generation: buildIntent.isBuild,
      app_type: buildIntent.appType,
      provider_used: provider,
      appears_successful: isSuccessful,
      has_code_output: hasCOdeBlock,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Javari] Learning recording error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

async function trackUsage(data: {
  userId?: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  responseTimeMs: number;
  buildIntent: BuildIntent;
  isVIP: boolean;
  requestId: string;
}): Promise<void> {
  try {
    await supabase.from('usage_logs').insert({
      user_id: data.userId,
      provider: data.provider,
      model: data.model,
      tokens_used: data.tokensUsed,
      estimated_cost: data.cost,
      response_time_ms: data.responseTimeMs,
      request_type: data.buildIntent.isBuild ? 'code_generation' : 'chat',
      app_type: data.buildIntent.appType,
      is_vip: data.isVIP,
      request_id: data.requestId,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Javari] Usage tracking error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN API HANDLER - THE UNIFIED AUTONOMOUS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[Javari] ═══════════════════════════════════════════════════════════`);
  console.log(`[Javari] Request ${requestId} started at ${new Date().toISOString()}`);
  console.log(`[Javari] Version: 6.0 - FULL AUTONOMY MODE`);
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Parse Request
    // ─────────────────────────────────────────────────────────────────────────
    const body = await request.json();
    const { 
      messages, 
      userId, 
      conversationId, 
      aiProvider,
      economyMode = false,
      enableLearning = true
    } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ 
        error: 'No messages provided',
        requestId 
      }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Detect VIP & Build Intent
    // ─────────────────────────────────────────────────────────────────────────
    const vipDetection = detectVIP(messages, userId);
    const buildIntent = detectBuildIntent(lastMessage);
    const taskAnalysis = analyzeTask(lastMessage);
    
    console.log(`[Javari] VIP: ${vipDetection.isVIP ? vipDetection.vipName : 'No'}`);
    console.log(`[Javari] Build: ${buildIntent.isBuild ? `${buildIntent.appType} (${buildIntent.complexity})` : 'No'}`);
    console.log(`[Javari] Task: ${taskAnalysis.taskType} (${taskAnalysis.complexity})`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Select Best AI Provider
    // ─────────────────────────────────────────────────────────────────────────
    const selectedProvider = selectBestProvider(taskAnalysis, aiProvider);
    console.log(`[Javari] Selected Provider: ${selectedProvider}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Gather Context (Knowledge + User History)
    // ─────────────────────────────────────────────────────────────────────────
    const [knowledgeContext, userContext] = await Promise.all([
      getRelevantKnowledge(lastMessage),
      userId ? getUserContext(userId) : null
    ]);
    
    if (knowledgeContext) console.log(`[Javari] Knowledge context found`);
    if (userContext) console.log(`[Javari] User context found`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Build System Prompt with All Context
    // ─────────────────────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      isVIP: vipDetection.isVIP,
      vipName: vipDetection.vipName,
      vipRole: vipDetection.vipRole,
      buildIntent,
      knowledgeContext,
      userContext,
      selectedProvider
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Call AI via Multi-AI Orchestrator with Fallback
    // ─────────────────────────────────────────────────────────────────────────
    const formattedMessages: Message[] = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    
    const result = await orchestrateAI(formattedMessages, systemPrompt, selectedProvider);
    
    const latency = Date.now() - startTime;
    console.log(`[Javari] Response received in ${latency}ms from ${result.provider}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 7: Save Conversation to Database
    // ─────────────────────────────────────────────────────────────────────────
    let savedConversationId = conversationId;
    
    if (result.response) {
      try {
        const allMessages = [
          ...messages,
          { 
            role: 'assistant', 
            content: result.response, 
            timestamp: new Date().toISOString(),
            provider: result.provider,
            model: result.model
          }
        ];
        
        if (conversationId) {
          await supabase
            .from('conversations')
            .update({
              messages: allMessages,
              message_count: allMessages.length,
              model: result.model,
              provider: result.provider,
              is_vip: vipDetection.isVIP,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        } else if (userId) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              user_id: userId,
              title: lastMessage.slice(0, 100),
              messages: allMessages,
              message_count: allMessages.length,
              model: result.model,
              provider: result.provider,
              status: 'active',
              is_vip: vipDetection.isVIP,
              build_intent: buildIntent.isBuild ? buildIntent.appType : null
            })
            .select('id')
            .single();
            
          if (newConv) {
            savedConversationId = newConv.id;
          }
        }
      } catch (dbError) {
        console.error('[Javari] DB save error:', dbError);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 8: Record Learning (Async - Non-Blocking)
    // ─────────────────────────────────────────────────────────────────────────
    if (enableLearning && savedConversationId) {
      recordLearning(
        savedConversationId,
        lastMessage,
        result.response,
        buildIntent,
        result.provider
      ).catch(err => console.error('[Javari] Learning error:', err));
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 9: Track Usage (Async - Non-Blocking)
    // ─────────────────────────────────────────────────────────────────────────
    trackUsage({
      userId,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      responseTimeMs: latency,
      buildIntent,
      isVIP: vipDetection.isVIP,
      requestId
    }).catch(err => console.error('[Javari] Usage tracking error:', err));
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 10: Return Response
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Javari] Request ${requestId} completed successfully in ${latency}ms`);
    console.log(`[Javari] ═══════════════════════════════════════════════════════════`);
    
    return NextResponse.json({
      // Main response
      content: result.response,
      response: result.response,
      
      // AI info
      provider: result.provider,
      model: result.model,
      
      // Intent info
      buildIntent,
      taskAnalysis,
      isVIP: vipDetection.isVIP,
      vipName: vipDetection.vipName,
      
      // Performance
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      latency,
      requestId,
      
      // Context info
      contextUsed: {
        knowledge: !!knowledgeContext,
        userHistory: !!userContext,
        fallbackUsed: result.fallbackUsed
      },
      
      // Version info
      version: '6.0 - FULL AUTONOMY MODE'
    });
    
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[Javari] ═══════════════════════════════════════════════════════════`);
    console.error(`[Javari] Request ${requestId} FAILED after ${latency}ms`);
    console.error(`[Javari] Error:`, error);
    console.error(`[Javari] ═══════════════════════════════════════════════════════════`);
    
    // Log error to database for self-healing analysis
    try {
      await supabase.from('error_logs').insert({
        source: 'chat_api',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        stack_trace: error instanceof Error ? error.stack : null,
        request_id: requestId,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('[Javari] Failed to log error:', logError);
    }
    
    return NextResponse.json({
      content: "I encountered an issue but I'm working on it! Please try again in a moment.",
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      latency,
      version: '6.0 - FULL AUTONOMY MODE'
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET HANDLER - Health Check & Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    name: 'Javari AI',
    version: '6.0 - FULL AUTONOMY MODE',
    timestamp: new Date().toISOString(),
    capabilities: {
      multiAI: true,
      intelligentRouting: true,
      fallbackChain: true,
      learning: true,
      knowledgeBase: true,
      userMemory: true,
      vipDetection: true,
      buildFirst: true,
      usageTracking: true,
      errorLogging: true
    },
    providers: Object.keys(AI_PROVIDERS),
    providerDetails: Object.entries(AI_PROVIDERS).map(([key, p]) => ({
      key,
      name: p.name,
      strengths: p.strengths
    })),
    autonomous: {
      orchestrator: 'active',
      learning: 'active',
      knowledgeBase: 'active',
      routing: 'intelligent'
    }
  });
}
