// AI Routing Logic for Javari
// Intelligently routes tasks to the best AI provider based on task type, cost, and availability

export type AIProvider = 'gpt-4' | 'claude' | 'gemini' | 'mistral';
export type TaskType = 
  | 'code_generation'
  | 'code_review'
  | 'debugging'
  | 'analysis'
  | 'search'
  | 'chat'
  | 'translation'
  | 'optimization';

interface ProviderConfig {
  id: AIProvider;
  name: string;
  costPerToken: number;
  strengths: TaskType[];
  available: boolean;
  maxTokens: number;
  apiEndpoint: string;
}

interface RoutingDecision {
  provider: AIProvider;
  reasoning: string;
  estimatedCost: number;
  fallbacks: AIProvider[];
  confidence: number;
}

// Provider configurations
const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    costPerToken: 0.03 / 1000, // $0.03 per 1K tokens
    strengths: ['code_generation', 'code_review', 'debugging', 'analysis'],
    available: true,
    maxTokens: 8192,
    apiEndpoint: '/api/ai/openai',
  },
  'claude': {
    id: 'claude',
    name: 'Claude',
    costPerToken: 0.015 / 1000, // $0.015 per 1K tokens  
    strengths: ['analysis', 'code_review', 'chat', 'translation'],
    available: true,
    maxTokens: 100000,
    apiEndpoint: '/api/ai/anthropic',
  },
  'gemini': {
    id: 'gemini',
    name: 'Gemini',
    costPerToken: 0.001 / 1000, // $0.001 per 1K tokens
    strengths: ['search', 'analysis', 'chat'],
    available: true,
    maxTokens: 32000,
    apiEndpoint: '/api/ai/google',
  },
  'mistral': {
    id: 'mistral',
    name: 'Mistral',
    costPerToken: 0.0002 / 1000, // $0.0002 per 1K tokens
    strengths: ['chat', 'translation', 'optimization'],
    available: true,
    maxTokens: 8192,
    apiEndpoint: '/api/ai/mistral',
  },
};

/**
 * Route a task to the optimal AI provider
 */
export function routeTask(
  taskType: TaskType,
  estimatedTokens: number,
  userPreference?: AIProvider,
  prioritizeCost: boolean = false
): RoutingDecision {
  // If user has explicit preference and it's available, use it
  if (userPreference && PROVIDERS[userPreference].available) {
    return {
      provider: userPreference,
      reasoning: 'User-specified provider',
      estimatedCost: estimatedTokens * PROVIDERS[userPreference].costPerToken,
      fallbacks: getFallbacks(userPreference, taskType),
      confidence: 1.0,
    };
  }

  // Score each provider for this task
  const scores = Object.entries(PROVIDERS).map(([id, config]) => {
    if (!config.available) {
      return { provider: id as AIProvider, score: 0, cost: 0 };
    }

    let score = 0;

    // Strength scoring (0-50 points)
    if (config.strengths.includes(taskType)) {
      score += 50;
    }

    // Cost scoring (0-30 points)
    if (prioritizeCost) {
      const maxCost = Math.max(...Object.values(PROVIDERS).map(p => p.costPerToken));
      const costScore = 30 * (1 - config.costPerToken / maxCost);
      score += costScore;
    }

    // Token capacity scoring (0-20 points)
    if (estimatedTokens <= config.maxTokens) {
      score += 20;
    } else {
      score += 10; // Partial credit if close
    }

    const cost = estimatedTokens * config.costPerToken;

    return { provider: id as AIProvider, score, cost };
  });

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  // Get top provider
  const topProvider = scores[0].provider;
  const confidence = scores[0].score / 100;

  return {
    provider: topProvider,
    reasoning: getReasoningForProvider(topProvider, taskType, prioritizeCost),
    estimatedCost: scores[0].cost,
    fallbacks: getFallbacks(topProvider, taskType),
    confidence,
  };
}

/**
 * Get fallback providers in order of preference
 */
function getFallbacks(primary: AIProvider, taskType: TaskType): AIProvider[] {
  const others = (Object.keys(PROVIDERS) as AIProvider[])
    .filter(id => id !== primary && PROVIDERS[id].available);

  // Sort by strength for this task type
  return others.sort((a, b) => {
    const aStrong = PROVIDERS[a].strengths.includes(taskType) ? 1 : 0;
    const bStrong = PROVIDERS[b].strengths.includes(taskType) ? 1 : 0;
    return bStrong - aStrong;
  });
}

/**
 * Get human-readable reasoning for provider selection
 */
function getReasoningForProvider(
  provider: AIProvider,
  taskType: TaskType,
  prioritizeCost: boolean
): string {
  const config = PROVIDERS[provider];
  const reasons: string[] = [];

  if (config.strengths.includes(taskType)) {
    reasons.push(`${config.name} excels at ${taskType.replace('_', ' ')}`);
  }

  if (prioritizeCost) {
    reasons.push('cost-optimized choice');
  }

  if (reasons.length === 0) {
    reasons.push('best available option');
  }

  return reasons.join(', ');
}

/**
 * Attempt to execute a task with automatic fallback
 */
export async function executeWithFallback<T>(
  taskType: TaskType,
  prompt: string,
  estimatedTokens: number,
  executor: (provider: AIProvider, endpoint: string) => Promise<T>,
  userPreference?: AIProvider
): Promise<{ result: T; provider: AIProvider; cost: number }> {
  const routing = routeTask(taskType, estimatedTokens, userPreference);
  const providersToTry = [routing.provider, ...routing.fallbacks];

  let lastError: Error | null = null;

  for (const provider of providersToTry) {
    try {
      const config = PROVIDERS[provider];
      const result = await executor(provider, config.apiEndpoint);
      const cost = estimatedTokens * config.costPerToken;

      return { result, provider, cost };
    } catch (error) {
      console.error(`Provider ${provider} failed:`, error);
      lastError = error as Error;
      // Continue to next fallback
    }
  }

  throw new Error(
    `All providers failed. Last error: ${lastError?.message || 'Unknown'}`
  );
}

/**
 * Stream responses with provider failover
 */
export async function* streamWithFallback(
  taskType: TaskType,
  prompt: string,
  estimatedTokens: number,
  userPreference?: AIProvider
): AsyncGenerator<{ chunk: string; provider: AIProvider }, void, unknown> {
  const routing = routeTask(taskType, estimatedTokens, userPreference);
  const providersToTry = [routing.provider, ...routing.fallbacks];

  for (const provider of providersToTry) {
    try {
      const config = PROVIDERS[provider];
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        yield { chunk, provider };
      }

      return; // Success - don't try fallbacks
    } catch (error) {
      console.error(`Streaming provider ${provider} failed:`, error);
      // Continue to next fallback
    }
  }

  throw new Error('All streaming providers failed');
}

/**
 * Calculate total cost for a conversation
 */
export function calculateConversationCost(
  messages: Array<{ content: string; provider: AIProvider }>
): number {
  return messages.reduce((total, msg) => {
    const tokens = estimateTokens(msg.content);
    const cost = tokens * PROVIDERS[msg.provider].costPerToken;
    return total + cost;
  }, 0);
}

/**
 * Simple token estimation (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Get provider availability status
 */
export function getProviderStatus(): Record<AIProvider, boolean> {
  return Object.fromEntries(
    Object.entries(PROVIDERS).map(([id, config]) => [id, config.available])
  ) as Record<AIProvider, boolean>;
}

/**
 * Update provider availability
 */
export function setProviderAvailability(provider: AIProvider, available: boolean): void {
  PROVIDERS[provider].available = available;
}

/**
 * Get cost comparison for a task
 */
export function getCostComparison(
  taskType: TaskType,
  estimatedTokens: number
): Array<{ provider: AIProvider; cost: number; suitable: boolean }> {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    provider: id as AIProvider,
    cost: estimatedTokens * config.costPerToken,
    suitable: config.strengths.includes(taskType),
  }));
}
