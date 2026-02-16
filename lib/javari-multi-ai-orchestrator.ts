// lib/javari-multi-ai-orchestrator.ts
// OUTSTANDING AI ORCHESTRATION - Use the RIGHT AI for the RIGHT task
// Timestamp: 2025-11-30 04:35 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// AI PROVIDER CONFIGURATION
// =====================================================

interface AIProvider {
  name: string;
  model: string;
  endpoint: string;
  strengths: string[];
  costPer1kTokens: number;
  maxTokens: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  avgResponseTimeMs: number;
}

const AI_PROVIDERS: Record<string, AIProvider> = {
  'gpt-4-turbo': {
    name: 'OpenAI GPT-4 Turbo',
    model: 'gpt-4-turbo-preview',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    strengths: ['coding', 'analysis', 'general', 'creative', 'math'],
    costPer1kTokens: 0.01,
    maxTokens: 128000,
    supportsVision: true,
    supportsStreaming: true,
    avgResponseTimeMs: 2000
  },
  'gpt-4o': {
    name: 'OpenAI GPT-4o',
    model: 'gpt-4o',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    strengths: ['coding', 'vision', 'speed', 'general'],
    costPer1kTokens: 0.005,
    maxTokens: 128000,
    supportsVision: true,
    supportsStreaming: true,
    avgResponseTimeMs: 1000
  },
  'gpt-3.5-turbo': {
    name: 'OpenAI GPT-3.5 Turbo',
    model: 'gpt-3.5-turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    strengths: ['speed', 'simple_tasks', 'cost_effective'],
    costPer1kTokens: 0.0005,
    maxTokens: 16385,
    supportsVision: false,
    supportsStreaming: true,
    avgResponseTimeMs: 500
  },
  'claude-3.5-sonnet': {
    name: 'Anthropic Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022',
    endpoint: 'https://api.anthropic.com/v1/messages',
    strengths: ['coding', 'analysis', 'safety', 'long_context', 'nuance'],
    costPer1kTokens: 0.003,
    maxTokens: 200000,
    supportsVision: true,
    supportsStreaming: true,
    avgResponseTimeMs: 1500
  },
  'claude-3-opus': {
    name: 'Anthropic Claude 3 Opus',
    model: 'claude-3-opus-20240229',
    endpoint: 'https://api.anthropic.com/v1/messages',
    strengths: ['complex_reasoning', 'research', 'writing', 'analysis'],
    costPer1kTokens: 0.015,
    maxTokens: 200000,
    supportsVision: true,
    supportsStreaming: true,
    avgResponseTimeMs: 3000
  }: {
    name: 'Google Gemini Pro',
    model:,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    strengths: ['speed', 'multimodal', 'google_integration'],
    costPer1kTokens: 0.00025,
    maxTokens: 32760,
    supportsVision: false,
    supportsStreaming: true,
    avgResponseTimeMs: 800
  }: {
    name: 'Google Gemini 1.5 Pro',
    model:,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
    strengths: ['long_context', 'multimodal', 'video', 'audio'],
    costPer1kTokens: 0.00125,
    maxTokens: 1000000,
    supportsVision: true,
    supportsStreaming: true,
    avgResponseTimeMs: 1200
  },
  'perplexity': {
    name: 'Perplexity',
    model: 'llama-3.1-sonar-large-128k-online',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    strengths: ['research', 'current_events', 'citations', 'web_search'],
    costPer1kTokens: 0.001,
    maxTokens: 127072,
    supportsVision: false,
    supportsStreaming: true,
    avgResponseTimeMs: 2500
  }
};

// =====================================================
// TASK ROUTING - Pick the best AI for each task
// =====================================================

interface TaskAnalysis {
  taskType: string;
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  requiresVision: boolean;
  requiresCurrentInfo: boolean;
  requiresLongContext: boolean;
  estimatedTokens: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

function analyzeTask(message: string, hasImages: boolean = false): TaskAnalysis {
  const messageLower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  
  // Determine task type
  let taskType = 'general';
  if (/(?:write|create|build|code|function|component|api|debug|fix|error)/i.test(message)) {
    taskType = 'coding';
  } else if (/(?:research|find|search|current|latest|news|today)/i.test(message)) {
    taskType = 'research';
  } else if (/(?:analyze|explain|understand|compare|evaluate)/i.test(message)) {
    taskType = 'analysis';
  } else if (/(?:write|draft|compose|essay|article|story|creative)/i.test(message)) {
    taskType = 'writing';
  } else if (/(?:calculate|math|equation|solve|formula)/i.test(message)) {
    taskType = 'math';
  } else if (/(?:summarize|tldr|brief|quick)/i.test(message)) {
    taskType = 'summary';
  }

  // Determine complexity
  let complexity: TaskAnalysis['complexity'] = 'simple';
  if (wordCount > 500 || /(?:complex|detailed|comprehensive|thorough)/i.test(message)) {
    complexity = 'complex';
  } else if (wordCount > 100 || /(?:explain|analyze|compare)/i.test(message)) {
    complexity = 'medium';
  }
  if (/(?:expert|advanced|professional|enterprise)/i.test(message)) {
    complexity = 'expert';
  }

  // Determine urgency
  let urgency: TaskAnalysis['urgency'] = 'medium';
  if (/(?:urgent|asap|immediately|critical|emergency|now)/i.test(message)) {
    urgency = 'critical';
  } else if (/(?:quick|fast|soon)/i.test(message)) {
    urgency = 'high';
  }

  return {
    taskType,
    complexity,
    requiresVision: hasImages,
    requiresCurrentInfo: /(?:current|latest|today|recent|news|now|2024|2025)/i.test(message),
    requiresLongContext: wordCount > 2000,
    estimatedTokens: Math.ceil(wordCount * 1.5),
    urgency
  };
}

function selectBestProvider(analysis: TaskAnalysis, economyMode: boolean = false): string {
  // If requires current info, use Perplexity
  if (analysis.requiresCurrentInfo) {
    return 'perplexity';
  }

  // If requires vision, use vision-capable model
  if (analysis.requiresVision) {
    return economyMode ? 'gpt-4o' : 'claude-3.5-sonnet';
  }

  // If requires very long context
  if (analysis.requiresLongContext) {
    return;
  }

  // Economy mode routing
  if (economyMode) {
    if (analysis.complexity === 'simple') {
      return 'gpt-3.5-turbo';
    }
    return;
  }

  // Task-based routing
  switch (analysis.taskType) {
    case 'coding':
      return analysis.complexity === 'expert' ? 'claude-3.5-sonnet' : 'gpt-4o';
    case 'research':
      return 'perplexity';
    case 'analysis':
      return 'claude-3.5-sonnet';
    case 'writing':
      return analysis.complexity === 'expert' ? 'claude-3-opus' : 'claude-3.5-sonnet';
    case 'math':
      return 'gpt-4-turbo';
    case 'summary':
      return 'gpt-3.5-turbo';
    default:
      return 'gpt-4o';
  }
}

// =====================================================
// MULTI-AI ORCHESTRATION
// =====================================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OrchestrationResult {
  response: string;
  provider: string;
  model: string;
  tokensUsed: number;
  responseTimeMs: number;
  cost: number;
  fallbackUsed: boolean;
  reasoning?: string;
}

export class MultiAIOrchestrator {
  private economyMode: boolean;
  private maxRetries: number;

  constructor(economyMode: boolean = false, maxRetries: number = 3) {
    this.economyMode = economyMode;
    this.maxRetries = maxRetries;
  }

  async process(
    messages: Message[],
    systemPrompt: string,
    hasImages: boolean = false
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // Analyze the task
    const analysis = analyzeTask(lastMessage, hasImages);
    
    // Select best provider
    const primaryProvider = selectBestProvider(analysis, this.economyMode);
    const fallbackProviders = this.getFallbackProviders(primaryProvider, analysis);
    
    // Try primary, then fallbacks
    let lastError: Error | null = null;
    
    for (const providerKey of [primaryProvider, ...fallbackProviders]) {
      try {
        const result = await this.callProvider(providerKey, messages, systemPrompt);
        
        return {
          ...result,
          responseTimeMs: Date.now() - startTime,
          fallbackUsed: providerKey !== primaryProvider,
          reasoning: `Selected ${providerKey} for ${analysis.taskType} task (${analysis.complexity} complexity)`
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Provider ${providerKey} failed:`, error);
        continue;
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  private getFallbackProviders(primary: string, analysis: TaskAnalysis): string[] {
    const allProviders = Object.keys(AI_PROVIDERS);
    const fallbacks: string[] = [];

    // Add fallbacks based on task type
    if (analysis.taskType === 'coding') {
      fallbacks.push('claude-3.5-sonnet', 'gpt-4-turbo', 'gpt-4o');
    } else if (analysis.taskType === 'research') {
      fallbacks.push('gpt-4-turbo', 'claude-3.5-sonnet');
    } else {
      fallbacks.push('gpt-4o', 'claude-3.5-sonnet');
    }

    // Always add GPT-3.5 as last resort
    fallbacks.push('gpt-3.5-turbo');

    // Remove primary and duplicates
    return [...new Set(fallbacks.filter(f => f !== primary))].slice(0, this.maxRetries);
  }

  private async callProvider(
    providerKey: string,
    messages: Message[],
    systemPrompt: string
  ): Promise<Omit<OrchestrationResult, 'responseTimeMs' | 'fallbackUsed' | 'reasoning'>> {
    const provider = AI_PROVIDERS[providerKey];
    if (!provider) throw new Error(`Unknown provider: ${providerKey}`);

    if (providerKey.startsWith('gpt') || providerKey === 'perplexity') {
      return this.callOpenAICompatible(providerKey, provider, messages, systemPrompt);
    } else if (providerKey.startsWith('claude')) {
      return this.callAnthropic(provider, messages, systemPrompt);
    } else if (providerKey.startsWith('gemini')) {
      return this.callGemini(provider, messages, systemPrompt);
    }

    throw new Error(`No handler for provider: ${providerKey}`);
  }

  private async callOpenAICompatible(
    providerKey: string,
    provider: AIProvider,
    messages: Message[],
    systemPrompt: string
  ): Promise<Omit<OrchestrationResult, 'responseTimeMs' | 'fallbackUsed' | 'reasoning'>> {
    const apiKey = providerKey === 'perplexity' 
      ? process.env.PERPLEXITY_API_KEY 
      : process.env.OPENAI_API_KEY;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        messages: formattedMessages,
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} error: ${response.status}`);
    }

    const data = await response.json();
    const tokensUsed = data.usage?.total_tokens || 0;

    return {
      response: data.choices[0].message.content,
      provider: provider.name,
      model: provider.model,
      tokensUsed,
      cost: (tokensUsed / 1000) * provider.costPer1kTokens
    };
  }

  private async callAnthropic(
    provider: AIProvider,
    messages: Message[],
    systemPrompt: string
  ): Promise<Omit<OrchestrationResult, 'responseTimeMs' | 'fallbackUsed' | 'reasoning'>> {
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: formattedMessages
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} error: ${response.status}`);
    }

    const data = await response.json();
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    return {
      response: data.content[0].text,
      provider: provider.name,
      model: provider.model,
      tokensUsed,
      cost: (tokensUsed / 1000) * provider.costPer1kTokens
    };
  }

  private async callGemini(
    provider: AIProvider,
    messages: Message[],
    systemPrompt: string
  ): Promise<Omit<OrchestrationResult, 'responseTimeMs' | 'fallbackUsed' | 'reasoning'>> {
    const contents = [
      { role: 'user', parts: [{ text: `[System]\n${systemPrompt}\n[/System]\n\nAcknowledge and proceed.` }] },
      { role: 'model', parts: [{ text: 'Understood. I am ready to assist.' }] },
      ...messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    ];

    const response = await fetch(
      `${provider.endpoint}?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );

    if (!response.ok) {
      throw new Error(`${provider.name} error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    return {
      response: text,
      provider: provider.name,
      model: provider.model,
      tokensUsed,
      cost: (tokensUsed / 1000) * provider.costPer1kTokens
    };
  }

  // =====================================================
  // CONSENSUS MODE - Ask multiple AIs and synthesize
  // =====================================================

  async getConsensus(
    messages: Message[],
    systemPrompt: string,
    providers: string[] = ['gpt-4o', 'claude-3.5-sonnet']
  ): Promise<{
    consensus: string;
    individualResponses: Record<string, string>;
    agreement: number;
  }> {
    const results = await Promise.allSettled(
      providers.map(p => this.callProvider(p, messages, systemPrompt))
    );

    const responses: Record<string, string> = {};
    const successfulResponses: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        responses[providers[index]] = result.value.response;
        successfulResponses.push(result.value.response);
      }
    });

    // Synthesize consensus using GPT-4
    const synthesisPrompt = `You are synthesizing answers from multiple AI models. Find the consensus or best answer.

Individual responses:
${Object.entries(responses).map(([provider, response]) => `
--- ${provider} ---
${response}
`).join('\n')}

Provide a synthesized, accurate answer that combines the best insights from all responses.`;

    const synthesis = await this.callProvider('gpt-4o', [
      { role: 'user', content: synthesisPrompt }
    ], 'You synthesize AI responses into optimal answers.');

    return {
      consensus: synthesis.response,
      individualResponses: responses,
      agreement: this.calculateAgreement(successfulResponses)
    };
  }

  private calculateAgreement(responses: string[]): number {
    if (responses.length < 2) return 1;
    
    // Simple word overlap calculation
    const wordSets = responses.map(r => 
      new Set(r.toLowerCase().split(/\s+/).filter(w => w.length > 4))
    );
    
    let totalOverlap = 0;
    let comparisons = 0;
    
    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const intersection = [...wordSets[i]].filter(w => wordSets[j].has(w));
        const union = new Set([...wordSets[i], ...wordSets[j]]);
        totalOverlap += intersection.length / union.size;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalOverlap / comparisons : 1;
  }
}

// =====================================================
// EXPORT SINGLETON
// =====================================================

export const orchestrator = new MultiAIOrchestrator(false);
export const economyOrchestrator = new MultiAIOrchestrator(true);

export default MultiAIOrchestrator;
