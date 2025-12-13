// lib/ai-router.ts
// Javari AI Smart Router - Intelligent Provider Selection
// Version: 1.0.0
// Timestamp: 2025-12-13 8:10 AM EST

import { createClient } from '@supabase/supabase-js';

// Provider capabilities and strengths
export type AIProvider = 'openai' | 'claude' | 'gemini' | 'perplexity' | 'mistral';

interface ProviderProfile {
  name: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  costTier: 'low' | 'medium' | 'high';
  speedTier: 'fast' | 'medium' | 'slow';
  contextWindow: number;
  models: string[];
}

// Provider profiles based on real-world performance
const PROVIDER_PROFILES: Record<AIProvider, ProviderProfile> = {
  openai: {
    name: 'GPT-4',
    strengths: ['creative writing', 'general knowledge', 'conversational', 'brainstorming'],
    weaknesses: ['real-time data', 'very long context'],
    bestFor: ['creative', 'general', 'writing', 'ideas', 'stories', 'marketing'],
    costTier: 'high',
    speedTier: 'medium',
    contextWindow: 128000,
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
  },
  claude: {
    name: 'Claude',
    strengths: ['code generation', 'analysis', 'long documents', 'technical writing', 'reasoning'],
    weaknesses: ['real-time data', 'image generation'],
    bestFor: ['code', 'programming', 'analysis', 'technical', 'documentation', 'debugging', 'refactoring'],
    costTier: 'medium',
    speedTier: 'medium',
    contextWindow: 200000,
    models: ['claude-sonnet-4-5-20250929', 'claude-opus-4-20250514'],
  },
  gemini: {
    name: 'Gemini',
    strengths: ['speed', 'multimodal', 'math', 'science', 'factual'],
    weaknesses: ['creative writing', 'nuanced tone'],
    bestFor: ['fast', 'quick', 'math', 'science', 'facts', 'calculations', 'images'],
    costTier: 'low',
    speedTier: 'fast',
    contextWindow: 1000000,
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  perplexity: {
    name: 'Perplexity',
    strengths: ['real-time search', 'current events', 'research', 'citations'],
    weaknesses: ['creative tasks', 'code generation'],
    bestFor: ['search', 'research', 'news', 'current', 'latest', 'today', 'recent', 'find', 'lookup'],
    costTier: 'medium',
    speedTier: 'medium',
    contextWindow: 128000,
    models: ['llama-3.1-sonar-large-128k-online'],
  },
  mistral: {
    name: 'Mistral',
    strengths: ['multilingual', 'efficient', 'European languages', 'concise'],
    weaknesses: ['very long context', 'complex reasoning'],
    bestFor: ['translate', 'french', 'german', 'spanish', 'multilingual', 'language', 'efficient'],
    costTier: 'low',
    speedTier: 'fast',
    contextWindow: 32000,
    models: ['mistral-large-latest', 'mistral-medium'],
  },
};

// Query patterns for routing
const QUERY_PATTERNS: { pattern: RegExp; provider: AIProvider; confidence: number }[] = [
  // Code & Programming -> Claude
  { pattern: /\b(code|programming|function|api|debug|refactor|typescript|javascript|python|react|next\.?js|component|build me|create a|make a)\b/i, provider: 'claude', confidence: 0.9 },
  { pattern: /\b(fix|error|bug|issue|doesn't work|not working|broken)\b/i, provider: 'claude', confidence: 0.85 },
  { pattern: /```|\bimport\b|\bexport\b|\bconst\b|\bfunction\b/i, provider: 'claude', confidence: 0.95 },
  
  // Search & Research -> Perplexity
  { pattern: /\b(search|find|lookup|research|latest|recent|today|news|current|what's happening)\b/i, provider: 'perplexity', confidence: 0.9 },
  { pattern: /\b(price of|stock|crypto|bitcoin|weather|who is|what is the current)\b/i, provider: 'perplexity', confidence: 0.85 },
  { pattern: /\b(2024|2025|this week|this month|yesterday|last night)\b/i, provider: 'perplexity', confidence: 0.8 },
  
  // Creative & Writing -> OpenAI
  { pattern: /\b(write|story|creative|blog|article|essay|poem|script|marketing|copy|slogan)\b/i, provider: 'openai', confidence: 0.85 },
  { pattern: /\b(brainstorm|ideas|suggest|imagine|what if|creative)\b/i, provider: 'openai', confidence: 0.8 },
  { pattern: /\b(email|letter|message|social media|post|caption)\b/i, provider: 'openai', confidence: 0.75 },
  
  // Math & Science -> Gemini
  { pattern: /\b(calculate|math|equation|formula|solve|derivative|integral|statistics)\b/i, provider: 'gemini', confidence: 0.9 },
  { pattern: /\b(physics|chemistry|biology|science|scientific)\b/i, provider: 'gemini', confidence: 0.8 },
  { pattern: /\b(quick|fast|simple|brief|short answer)\b/i, provider: 'gemini', confidence: 0.7 },
  
  // Multilingual -> Mistral
  { pattern: /\b(translate|translation|french|german|spanish|italian|portuguese|dutch)\b/i, provider: 'mistral', confidence: 0.9 },
  { pattern: /\b(multilingual|language|localize|localization)\b/i, provider: 'mistral', confidence: 0.85 },
  
  // Analysis -> Claude
  { pattern: /\b(analyze|analysis|review|evaluate|assess|compare|contrast)\b/i, provider: 'claude', confidence: 0.8 },
  { pattern: /\b(document|pdf|report|summary|summarize)\b/i, provider: 'claude', confidence: 0.75 },
];

// Intent categories
type QueryIntent = 
  | 'code' 
  | 'search' 
  | 'creative' 
  | 'analysis' 
  | 'math' 
  | 'translation' 
  | 'general'
  | 'build';

interface RoutingDecision {
  provider: AIProvider;
  model: string;
  confidence: number;
  reasoning: string;
  intent: QueryIntent;
  alternatives: { provider: AIProvider; confidence: number }[];
}

/**
 * Analyze query to determine intent
 */
function analyzeIntent(query: string): QueryIntent {
  const queryLower = query.toLowerCase();
  
  // Check for build/create requests first (highest priority)
  if (/\b(build|create|make|generate|design|develop|implement)\b.*\b(app|tool|component|page|website|calculator|dashboard|form)\b/i.test(query)) {
    return 'build';
  }
  
  // Code indicators
  if (/\b(code|function|api|debug|typescript|javascript|python|react|component|import|export)\b/i.test(query) || /```/.test(query)) {
    return 'code';
  }
  
  // Search/Research indicators
  if (/\b(search|find|latest|recent|news|current|price|stock|weather|who is|what is the current)\b/i.test(query)) {
    return 'search';
  }
  
  // Creative indicators
  if (/\b(write|story|creative|blog|article|poem|script|marketing|brainstorm|imagine)\b/i.test(query)) {
    return 'creative';
  }
  
  // Math/Science indicators
  if (/\b(calculate|math|equation|solve|formula|physics|chemistry)\b/i.test(query)) {
    return 'math';
  }
  
  // Translation indicators
  if (/\b(translate|translation|french|german|spanish|multilingual)\b/i.test(query)) {
    return 'translation';
  }
  
  // Analysis indicators
  if (/\b(analyze|analysis|review|evaluate|compare|summarize)\b/i.test(query)) {
    return 'analysis';
  }
  
  return 'general';
}

/**
 * Calculate match score for a provider based on query
 */
function calculateProviderScore(query: string, provider: AIProvider): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const profile = PROVIDER_PROFILES[provider];
  
  // Check against patterns
  for (const { pattern, provider: patternProvider, confidence } of QUERY_PATTERNS) {
    if (patternProvider === provider && pattern.test(query)) {
      score += confidence;
    }
  }
  
  // Check against bestFor keywords
  for (const keyword of profile.bestFor) {
    if (queryLower.includes(keyword)) {
      score += 0.3;
    }
  }
  
  // Check against strengths
  for (const strength of profile.strengths) {
    if (queryLower.includes(strength)) {
      score += 0.2;
    }
  }
  
  // Penalize for weaknesses
  for (const weakness of profile.weaknesses) {
    if (queryLower.includes(weakness)) {
      score -= 0.3;
    }
  }
  
  return Math.min(1, Math.max(0, score));
}

/**
 * Get historical performance for a provider (from database)
 */
async function getProviderPerformance(provider: AIProvider, intent: QueryIntent): Promise<number> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) return 0.5;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data } = await supabase
      .from('javari_provider_performance')
      .select('avg_user_rating, avg_response_time_ms, successful_requests, total_requests')
      .eq('provider', provider)
      .eq('query_category', intent)
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(7);
    
    if (!data || data.length === 0) return 0.5;
    
    // Calculate weighted average performance
    const avgRating = data.reduce((sum, d) => sum + (d.avg_user_rating || 3), 0) / data.length;
    const successRate = data.reduce((sum, d) => sum + (d.successful_requests / Math.max(1, d.total_requests)), 0) / data.length;
    
    // Normalize to 0-1 scale
    return (avgRating / 5) * 0.6 + successRate * 0.4;
  } catch (error) {
    console.error('Error fetching provider performance:', error);
    return 0.5;
  }
}

/**
 * Main routing function - determines best AI provider for a query
 */
export async function routeQuery(query: string, options?: {
  preferSpeed?: boolean;
  preferQuality?: boolean;
  preferCost?: boolean;
  excludeProviders?: AIProvider[];
  contextLength?: number;
}): Promise<RoutingDecision> {
  const {
    preferSpeed = false,
    preferQuality = false,
    preferCost = false,
    excludeProviders = [],
    contextLength = 0,
  } = options || {};
  
  // Analyze intent
  const intent = analyzeIntent(query);
  
  // Calculate scores for each provider
  const providerScores: { provider: AIProvider; score: number }[] = [];
  
  for (const provider of Object.keys(PROVIDER_PROFILES) as AIProvider[]) {
    if (excludeProviders.includes(provider)) continue;
    
    const profile = PROVIDER_PROFILES[provider];
    
    // Skip if context is too long for provider
    if (contextLength > profile.contextWindow) continue;
    
    // Base score from query matching
    let score = calculateProviderScore(query, provider);
    
    // Get historical performance
    const performanceScore = await getProviderPerformance(provider, intent);
    score = score * 0.7 + performanceScore * 0.3;
    
    // Apply preference modifiers
    if (preferSpeed) {
      if (profile.speedTier === 'fast') score += 0.2;
      if (profile.speedTier === 'slow') score -= 0.2;
    }
    
    if (preferQuality) {
      if (profile.costTier === 'high') score += 0.15; // Higher cost often = better quality
      if (provider === 'claude') score += 0.1; // Claude is known for quality
    }
    
    if (preferCost) {
      if (profile.costTier === 'low') score += 0.2;
      if (profile.costTier === 'high') score -= 0.2;
    }
    
    providerScores.push({ provider, score });
  }
  
  // Sort by score
  providerScores.sort((a, b) => b.score - a.score);
  
  // Default fallback
  if (providerScores.length === 0) {
    return {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      confidence: 0.5,
      reasoning: 'Default fallback - no suitable provider found',
      intent: 'general',
      alternatives: [],
    };
  }
  
  const winner = providerScores[0];
  const profile = PROVIDER_PROFILES[winner.provider];
  
  // Generate reasoning
  let reasoning = '';
  switch (intent) {
    case 'build':
    case 'code':
      reasoning = `Routing to ${profile.name} for code generation - best for building and programming tasks`;
      break;
    case 'search':
      reasoning = `Routing to ${profile.name} for real-time search and research`;
      break;
    case 'creative':
      reasoning = `Routing to ${profile.name} for creative writing tasks`;
      break;
    case 'math':
      reasoning = `Routing to ${profile.name} for mathematical calculations`;
      break;
    case 'translation':
      reasoning = `Routing to ${profile.name} for multilingual translation`;
      break;
    case 'analysis':
      reasoning = `Routing to ${profile.name} for deep analysis and reasoning`;
      break;
    default:
      reasoning = `Routing to ${profile.name} for general assistance`;
  }
  
  return {
    provider: winner.provider,
    model: profile.models[0],
    confidence: winner.score,
    reasoning,
    intent,
    alternatives: providerScores.slice(1, 4).map(p => ({ provider: p.provider, confidence: p.score })),
  };
}

/**
 * Quick route without async database lookup (for client-side)
 */
export function routeQuerySync(query: string): { provider: AIProvider; model: string; intent: QueryIntent } {
  const intent = analyzeIntent(query);
  
  // Intent-based routing
  switch (intent) {
    case 'build':
    case 'code':
    case 'analysis':
      return { provider: 'claude', model: 'claude-sonnet-4-5-20250929', intent };
    case 'search':
      return { provider: 'perplexity', model: 'llama-3.1-sonar-large-128k-online', intent };
    case 'creative':
      return { provider: 'openai', model: 'gpt-4-turbo-preview', intent };
    case 'math':
      return { provider: 'gemini', model: 'gemini-1.5-pro', intent };
    case 'translation':
      return { provider: 'mistral', model: 'mistral-large-latest', intent };
    default:
      return { provider: 'openai', model: 'gpt-4-turbo-preview', intent: 'general' };
  }
}

/**
 * Get provider info for display
 */
export function getProviderInfo(provider: AIProvider): ProviderProfile {
  return PROVIDER_PROFILES[provider];
}

/**
 * Get all provider profiles
 */
export function getAllProviders(): Record<AIProvider, ProviderProfile> {
  return PROVIDER_PROFILES;
}

export default {
  routeQuery,
  routeQuerySync,
  getProviderInfo,
  getAllProviders,
  analyzeIntent,
};
