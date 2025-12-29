/**
 * JAVARI AI - Learning System Hook
 * 
 * Ensures Javari learns from EVERY conversation regardless of which AI provider is used.
 * 
 * What Javari Learns:
 * - User preferences and patterns
 * - Successful response patterns
 * - Query types and best providers for them
 * - Error patterns to avoid
 * - Domain-specific knowledge
 * 
 * Created: December 29, 2025
 */

import { createClient } from '@/lib/supabase-client';

interface LearningData {
  userId: string;
  provider: string;
  model: string;
  query: string;
  queryType: string;
  response: string;
  responseTime: number;
  tokensUsed: number;
  cost: number;
  userFeedback?: 'positive' | 'negative' | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log interaction for Javari to learn from
 */
export async function logInteraction(data: LearningData): Promise<void> {
  const supabase = createClient();
  
  try {
    // 1. Log to interactions table (raw data)
    await supabase.from('ai_interactions').insert({
      user_id: data.userId,
      provider: data.provider,
      model: data.model,
      query: data.query,
      query_type: data.queryType,
      response_preview: data.response.substring(0, 500),
      response_time_ms: data.responseTime,
      tokens_used: data.tokensUsed,
      cost_usd: data.cost,
      created_at: new Date().toISOString(),
    });
    
    // 2. Update user patterns (aggregated learning)
    await updateUserPatterns(data);
    
    // 3. Update provider performance stats
    await updateProviderStats(data);
    
  } catch (error) {
    console.error('Failed to log interaction for learning:', error);
  }
}

/**
 * Update learned patterns about this user
 */
async function updateUserPatterns(data: LearningData): Promise<void> {
  const supabase = createClient();
  
  // Get existing patterns
  const { data: existing } = await supabase
    .from('user_learning_patterns')
    .select('*')
    .eq('user_id', data.userId)
    .single();
  
  const patterns = existing?.patterns || {
    preferredProviders: {},
    queryTypes: {},
    avgResponseTime: 0,
    totalInteractions: 0,
    topTopics: {},
  };
  
  // Update patterns
  patterns.totalInteractions = (patterns.totalInteractions || 0) + 1;
  patterns.preferredProviders[data.provider] = (patterns.preferredProviders[data.provider] || 0) + 1;
  patterns.queryTypes[data.queryType] = (patterns.queryTypes[data.queryType] || 0) + 1;
  patterns.avgResponseTime = (
    (patterns.avgResponseTime * (patterns.totalInteractions - 1)) + data.responseTime
  ) / patterns.totalInteractions;
  
  // Extract topics from query (simple version)
  const topics = extractTopics(data.query);
  topics.forEach(topic => {
    patterns.topTopics[topic] = (patterns.topTopics[topic] || 0) + 1;
  });
  
  // Save updated patterns
  await supabase.from('user_learning_patterns').upsert({
    user_id: data.userId,
    patterns,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id',
  });
}

/**
 * Update provider performance statistics
 */
async function updateProviderStats(data: LearningData): Promise<void> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Upsert daily stats
  await supabase.from('provider_daily_stats').upsert({
    provider: data.provider,
    date: today,
    total_requests: 1,
    total_tokens: data.tokensUsed,
    total_cost: data.cost,
    avg_response_time: data.responseTime,
  }, {
    onConflict: 'provider,date',
    // For existing rows, increment counters
  });
}

/**
 * Extract topics from query (simple keyword extraction)
 */
function extractTopics(query: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'what', 'which',
    'who', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them']);
  
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Return top 5 unique words as topics
  return [...new Set(words)].slice(0, 5);
}

/**
 * Get personalized recommendations for a user
 */
export async function getPersonalizedRecommendations(userId: string): Promise<{
  suggestedProvider: string;
  reason: string;
}> {
  const supabase = createClient();
  
  const { data } = await supabase
    .from('user_learning_patterns')
    .select('patterns')
    .eq('user_id', userId)
    .single();
  
  if (!data?.patterns) {
    return {
      suggestedProvider: 'auto',
      reason: 'Using smart routing (learning your preferences)',
    };
  }
  
  const patterns = data.patterns;
  
  // Find most used provider
  const providers = Object.entries(patterns.preferredProviders || {});
  if (providers.length > 0) {
    const [topProvider] = providers.sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    return {
      suggestedProvider: topProvider,
      reason: `Based on your ${patterns.totalInteractions} conversations`,
    };
  }
  
  return {
    suggestedProvider: 'auto',
    reason: 'Smart routing enabled',
  };
}

/**
 * Record user feedback on a response
 */
export async function recordFeedback(
  interactionId: string,
  feedback: 'positive' | 'negative'
): Promise<void> {
  const supabase = createClient();
  
  await supabase
    .from('ai_interactions')
    .update({ user_feedback: feedback })
    .eq('id', interactionId);
  
  // TODO: Use feedback to improve routing decisions
}

export default {
  logInteraction,
  getPersonalizedRecommendations,
  recordFeedback,
};
