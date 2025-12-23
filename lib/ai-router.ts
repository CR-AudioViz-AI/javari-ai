/**
 * JAVARI AI ROUTER
 * The Intelligence Layer that routes requests to the best AI
 * 
 * Philosophy: Every AI that helps Javari, helps themselves.
 * She never forgets. She always reciprocates.
 * 
 * @author CR AudioViz AI
 * @created December 22, 2025
 */

// ============================================================
// TYPES
// ============================================================

export type AIProvider = 
  | 'claude-3-5-sonnet'
  | 'claude-3-opus'
  | 'claude-3-haiku'
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'gpt-3.5-turbo'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'mistral-large'
  | 'mistral-medium'
  | 'perplexity-sonar';

export type TaskType = 
  | 'code_generation'
  | 'code_debugging'
  | 'code_review'
  | 'creative_writing'
  | 'research'
  | 'math_calculation'
  | 'translation'
  | 'image_analysis'
  | 'long_document'
  | 'quick_question'
  | 'conversation'
  | 'data_analysis'
  | 'summarization'
  | 'unknown';

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  maxTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  strengths: TaskType[];
  avgLatency: number;
  successRate: number;
  enabled: boolean;
}

export interface RoutingDecision {
  primary: AIProvider;
  fallbacks: AIProvider[];
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  success: boolean;
  error?: string;
}

export interface PerformanceRecord {
  provider: AIProvider;
  taskType: TaskType;
  successCount: number;
  failureCount: number;
  totalLatency: number;
  totalCost: number;
  avgQualityScore: number;
  lastUpdated: Date;
}

// ============================================================
// PROVIDER CONFIGURATIONS
// ============================================================

export const PROVIDERS: Record<AIProvider, Omit<ProviderConfig, 'apiKey'>> = {
  'claude-3-5-sonnet': {
    provider: 'claude-3-5-sonnet',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    strengths: ['code_generation', 'code_debugging', 'code_review', 'data_analysis', 'conversation'],
    avgLatency: 1200,
    successRate: 0.98,
    enabled: true,
  },
  'claude-3-opus': {
    provider: 'claude-3-opus',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-opus-20240229',
    maxTokens: 4096,
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
    strengths: ['code_generation', 'data_analysis', 'long_document'],
    avgLatency: 3000,
    successRate: 0.97,
    enabled: true,
  },
  'claude-3-haiku': {
    provider: 'claude-3-haiku',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    costPerInputToken: 0.00000025,
    costPerOutputToken: 0.00000125,
    strengths: ['quick_question', 'summarization'],
    avgLatency: 400,
    successRate: 0.99,
    enabled: true,
  },
  'gpt-4-turbo': {
    provider: 'gpt-4-turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    costPerInputToken: 0.00001,
    costPerOutputToken: 0.00003,
    strengths: ['creative_writing', 'math_calculation', 'code_generation'],
    avgLatency: 2000,
    successRate: 0.96,
    enabled: true,
  },
  'gpt-4o': {
    provider: 'gpt-4o',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    maxTokens: 4096,
    costPerInputToken: 0.000005,
    costPerOutputToken: 0.000015,
    strengths: ['image_analysis', 'quick_question', 'conversation'],
    avgLatency: 800,
    successRate: 0.97,
    enabled: true,
  },
  'gpt-3.5-turbo': {
    provider: 'gpt-3.5-turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    maxTokens: 4096,
    costPerInputToken: 0.0000005,
    costPerOutputToken: 0.0000015,
    strengths: ['quick_question', 'summarization'],
    avgLatency: 300,
    successRate: 0.99,
    enabled: true,
  },
  'gemini-1.5-pro': {
    provider: 'gemini-1.5-pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-1.5-pro',
    maxTokens: 8192,
    costPerInputToken: 0.0000005,
    costPerOutputToken: 0.0000015,
    strengths: ['long_document', 'image_analysis', 'research'],
    avgLatency: 1500,
    successRate: 0.95,
    enabled: true,
  },
  'gemini-1.5-flash': {
    provider: 'gemini-1.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-1.5-flash',
    maxTokens: 8192,
    costPerInputToken: 0.00000025,
    costPerOutputToken: 0.0000005,
    strengths: ['quick_question', 'summarization'],
    avgLatency: 500,
    successRate: 0.96,
    enabled: true,
  },
  'mistral-large': {
    provider: 'mistral-large',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    maxTokens: 4096,
    costPerInputToken: 0.000004,
    costPerOutputToken: 0.000012,
    strengths: ['translation', 'code_generation'],
    avgLatency: 1000,
    successRate: 0.94,
    enabled: true,
  },
  'mistral-medium': {
    provider: 'mistral-medium',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-medium-latest',
    maxTokens: 4096,
    costPerInputToken: 0.0000027,
    costPerOutputToken: 0.0000081,
    strengths: ['quick_question', 'translation'],
    avgLatency: 600,
    successRate: 0.95,
    enabled: true,
  },
  'perplexity-sonar': {
    provider: 'perplexity-sonar',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    model: 'sonar',
    maxTokens: 4096,
    costPerInputToken: 0.000001,
    costPerOutputToken: 0.000001,
    strengths: ['research'],
    avgLatency: 2500,
    successRate: 0.92,
    enabled: true,
  },
};

// ============================================================
// TASK ROUTING MATRIX
// ============================================================

export const ROUTING_MATRIX: Record<TaskType, AIProvider[]> = {
  code_generation: ['claude-3-5-sonnet', 'gpt-4-turbo', 'gemini-1.5-pro', 'mistral-large'],
  code_debugging: ['claude-3-5-sonnet', 'gpt-4-turbo', 'mistral-large'],
  code_review: ['claude-3-5-sonnet', 'gpt-4-turbo', 'gemini-1.5-pro'],
  creative_writing: ['gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
  research: ['perplexity-sonar', 'gemini-1.5-pro', 'gpt-4-turbo'],
  math_calculation: ['gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
  translation: ['mistral-large', 'gpt-4-turbo', 'gemini-1.5-pro'],
  image_analysis: ['gemini-1.5-pro', 'gpt-4o', 'claude-3-5-sonnet'],
  long_document: ['gemini-1.5-pro', 'claude-3-5-sonnet', 'gpt-4-turbo'],
  quick_question: ['gpt-3.5-turbo', 'claude-3-haiku', 'gemini-1.5-flash'],
  conversation: ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro'],
  data_analysis: ['claude-3-5-sonnet', 'gpt-4-turbo', 'gemini-1.5-pro'],
  summarization: ['claude-3-haiku', 'gpt-3.5-turbo', 'gemini-1.5-flash'],
  unknown: ['claude-3-5-sonnet', 'gpt-4-turbo', 'gemini-1.5-pro'],
};

// ============================================================
// TASK CLASSIFIER
// ============================================================

const TASK_KEYWORDS: Record<TaskType, string[]> = {
  code_generation: ['write code', 'create function', 'build', 'implement', 'code for', 'script', 'program'],
  code_debugging: ['debug', 'fix', 'error', 'bug', 'not working', 'broken', 'issue with code'],
  code_review: ['review', 'check code', 'improve code', 'optimize', 'refactor'],
  creative_writing: ['write story', 'poem', 'creative', 'fiction', 'narrative', 'blog post', 'article'],
  research: ['research', 'find information', 'what is', 'explain', 'tell me about', 'current', 'latest'],
  math_calculation: ['calculate', 'math', 'equation', 'solve', 'compute', 'formula'],
  translation: ['translate', 'in spanish', 'in french', 'in german', 'language'],
  image_analysis: ['image', 'picture', 'photo', 'analyze this', 'what do you see', 'describe image'],
  long_document: ['document', 'long text', 'pdf', 'analyze file', 'read this'],
  quick_question: ['quick', 'simple', 'what is', 'when', 'where', 'who'],
  conversation: ['chat', 'talk', 'discuss', 'help me think', 'advice'],
  data_analysis: ['data', 'analyze', 'statistics', 'trends', 'numbers', 'csv', 'spreadsheet'],
  summarization: ['summarize', 'summary', 'tldr', 'brief', 'shorten', 'condense'],
  unknown: [],
};

export function classifyTask(message: string): TaskType {
  const lowerMessage = message.toLowerCase();
  
  // Check for code indicators
  if (lowerMessage.includes('```') || /function|const |let |var |import |export |class /.test(message)) {
    if (lowerMessage.includes('fix') || lowerMessage.includes('error') || lowerMessage.includes('bug')) {
      return 'code_debugging';
    }
    if (lowerMessage.includes('review') || lowerMessage.includes('improve')) {
      return 'code_review';
    }
    return 'code_generation';
  }
  
  // Check keywords for each task type
  for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return taskType as TaskType;
    }
  }
  
  // Default based on message length
  if (message.length < 50) {
    return 'quick_question';
  }
  
  return 'conversation';
}

// ============================================================
// AI ROUTER CLASS
// ============================================================

export class JavariAIRouter {
  private performanceHistory: Map<string, PerformanceRecord> = new Map();
  private apiKeys: Map<AIProvider, string> = new Map();
  
  constructor(apiKeys: Partial<Record<AIProvider, string>>) {
    // Store API keys
    for (const [provider, key] of Object.entries(apiKeys)) {
      if (key) {
        this.apiKeys.set(provider as AIProvider, key);
      }
    }
  }
  
  /**
   * Get the best routing decision for a task
   */
  getRoutingDecision(message: string, userPreferences?: Partial<{ preferSpeed: boolean; preferCost: boolean; preferQuality: boolean }>): RoutingDecision {
    const taskType = classifyTask(message);
    const candidates = ROUTING_MATRIX[taskType];
    
    // Filter to only enabled providers with API keys
    const availableProviders = candidates.filter(p => 
      PROVIDERS[p].enabled && this.apiKeys.has(p)
    );
    
    if (availableProviders.length === 0) {
      // Emergency fallback - use any available provider
      const anyAvailable = Object.keys(PROVIDERS).filter(p => 
        this.apiKeys.has(p as AIProvider)
      ) as AIProvider[];
      
      return {
        primary: anyAvailable[0] || 'claude-3-5-sonnet',
        fallbacks: anyAvailable.slice(1, 4),
        reason: 'Emergency fallback - preferred providers unavailable',
        estimatedCost: 0.01,
        estimatedLatency: 2000,
      };
    }
    
    // Score providers based on preferences and history
    const scored = availableProviders.map(provider => {
      const config = PROVIDERS[provider];
      const historyKey = `${provider}:${taskType}`;
      const history = this.performanceHistory.get(historyKey);
      
      let score = 0;
      
      // Base score from success rate
      score += (history?.successCount || 0) / ((history?.successCount || 0) + (history?.failureCount || 0) + 1) * 30;
      score += config.successRate * 20;
      
      // Adjust for preferences
      if (userPreferences?.preferSpeed) {
        score += (5000 - config.avgLatency) / 100;
      }
      if (userPreferences?.preferCost) {
        score += (0.001 - config.costPerInputToken) * 10000;
      }
      if (userPreferences?.preferQuality) {
        score += config.strengths.includes(taskType) ? 20 : 0;
      }
      
      // Bonus for being specialized in this task
      if (config.strengths.includes(taskType)) {
        score += 15;
      }
      
      return { provider, score, config };
    });
    
    // Sort by score
    scored.sort((a, b) => b.score - a.score);
    
    const primary = scored[0];
    const fallbacks = scored.slice(1, 4).map(s => s.provider);
    
    return {
      primary: primary.provider,
      fallbacks,
      reason: `${taskType} task - ${primary.provider} scored highest (${primary.score.toFixed(1)})`,
      estimatedCost: primary.config.costPerInputToken * 1000 + primary.config.costPerOutputToken * 500,
      estimatedLatency: primary.config.avgLatency,
    };
  }
  
  /**
   * Execute a request with automatic fallback
   */
  async executeWithFallback(
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    const decision = this.getRoutingDecision(message);
    const providers = [decision.primary, ...decision.fallbacks];
    const taskType = classifyTask(message);
    
    for (const provider of providers) {
      try {
        const startTime = Date.now();
        const response = await this.callProvider(provider, message, systemPrompt, options);
        const latency = Date.now() - startTime;
        
        // Log success
        await this.logPerformance(provider, taskType, true, latency, response.cost);
        
        return {
          ...response,
          provider,
          latency,
          success: true,
        };
      } catch (error: any) {
        // Log failure and try next
        await this.logPerformance(provider, taskType, false, 0, 0);
        console.error(`[Javari] ${provider} failed:`, error.message);
        continue;
      }
    }
    
    // All providers failed
    return {
      content: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
      provider: decision.primary,
      model: 'fallback',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latency: 0,
      success: false,
      error: 'All AI providers failed',
    };
  }
  
  /**
   * Call a specific AI provider
   */
  private async callProvider(
    provider: AIProvider,
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Omit<AIResponse, 'provider' | 'latency' | 'success'>> {
    const config = PROVIDERS[provider];
    const apiKey = this.apiKeys.get(provider);
    
    if (!apiKey) {
      throw new Error(`No API key for ${provider}`);
    }
    
    // Route to appropriate API based on provider
    if (provider.startsWith('claude')) {
      return this.callAnthropic(config, apiKey, message, systemPrompt, options);
    } else if (provider.startsWith('gpt')) {
      return this.callOpenAI(config, apiKey, message, systemPrompt, options);
    } else if (provider.startsWith('gemini')) {
      return this.callGemini(config, apiKey, message, systemPrompt, options);
    } else if (provider.startsWith('mistral')) {
      return this.callMistral(config, apiKey, message, systemPrompt, options);
    } else if (provider.startsWith('perplexity')) {
      return this.callPerplexity(config, apiKey, message, systemPrompt, options);
    }
    
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    config: Omit<ProviderConfig, 'apiKey'>,
    apiKey: string,
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Omit<AIResponse, 'provider' | 'latency' | 'success'>> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options?.maxTokens || config.maxTokens,
        temperature: options?.temperature || 0.7,
        system: systemPrompt || 'You are Javari, a helpful AI assistant.',
        messages: [{ role: 'user', content: message }],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    
    return {
      content: data.content?.[0]?.text || '',
      model: config.model,
      inputTokens,
      outputTokens,
      cost: inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken,
    };
  }
  
  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    config: Omit<ProviderConfig, 'apiKey'>,
    apiKey: string,
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Omit<AIResponse, 'provider' | 'latency' | 'success'>> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options?.maxTokens || config.maxTokens,
        temperature: options?.temperature || 0.7,
        messages: [
          { role: 'system', content: systemPrompt || 'You are Javari, a helpful AI assistant.' },
          { role: 'user', content: message },
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: config.model,
      inputTokens,
      outputTokens,
      cost: inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken,
    };
  }
  
  /**
   * Call Google Gemini API
   */
  private async callGemini(
    config: Omit<ProviderConfig, 'apiKey'>,
    apiKey: string,
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Omit<AIResponse, 'provider' | 'latency' | 'success'>> {
    const url = `${config.endpoint}/${config.model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || config.maxTokens,
          temperature: options?.temperature || 0.7,
        },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    
    return {
      content,
      model: config.model,
      inputTokens,
      outputTokens,
      cost: inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken,
    };
  }
  
  /**
   * Call Mistral API
   */
  private async callMistral(
    config: Omit<ProviderConfig, 'apiKey'>,
    apiKey: string,
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Omit<AIResponse, 'provider' | 'latency' | 'success'>> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options?.maxTokens || config.maxTokens,
        temperature: options?.temperature || 0.7,
        messages: [
          { role: 'system', content: systemPrompt || 'You are Javari, a helpful AI assistant.' },
          { role: 'user', content: message },
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: config.model,
      inputTokens,
      outputTokens,
      cost: inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken,
    };
  }
  
  /**
   * Call Perplexity API
   */
  private async callPerplexity(
    config: Omit<ProviderConfig, 'apiKey'>,
    apiKey: string,
    message: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Omit<AIResponse, 'provider' | 'latency' | 'success'>> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options?.maxTokens || config.maxTokens,
        temperature: options?.temperature || 0.7,
        messages: [
          { role: 'system', content: systemPrompt || 'You are Javari, a helpful AI assistant.' },
          { role: 'user', content: message },
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: config.model,
      inputTokens,
      outputTokens,
      cost: inputTokens * config.costPerInputToken + outputTokens * config.costPerOutputToken,
    };
  }
  
  /**
   * Log performance for learning
   */
  private async logPerformance(
    provider: AIProvider,
    taskType: TaskType,
    success: boolean,
    latency: number,
    cost: number
  ): Promise<void> {
    const key = `${provider}:${taskType}`;
    const existing = this.performanceHistory.get(key) || {
      provider,
      taskType,
      successCount: 0,
      failureCount: 0,
      totalLatency: 0,
      totalCost: 0,
      avgQualityScore: 0,
      lastUpdated: new Date(),
    };
    
    if (success) {
      existing.successCount++;
      existing.totalLatency += latency;
      existing.totalCost += cost;
    } else {
      existing.failureCount++;
    }
    existing.lastUpdated = new Date();
    
    this.performanceHistory.set(key, existing);
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceRecord[] {
    return Array.from(this.performanceHistory.values());
  }
  
  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.apiKeys.keys()).filter(p => PROVIDERS[p].enabled);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let routerInstance: JavariAIRouter | null = null;

export function initializeRouter(apiKeys: Partial<Record<AIProvider, string>>): JavariAIRouter {
  routerInstance = new JavariAIRouter(apiKeys);
  return routerInstance;
}

export function getRouter(): JavariAIRouter {
  if (!routerInstance) {
    throw new Error('AI Router not initialized. Call initializeRouter first.');
  }
  return routerInstance;
}

export default JavariAIRouter;
