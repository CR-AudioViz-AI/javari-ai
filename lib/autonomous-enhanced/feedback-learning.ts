/**
 * Javari AI - Feedback & Conversation Learning System
 * Learns from user feedback and extracts knowledge from conversations
 * 
 * Created: December 13, 2025
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ============================================================================
// TYPES
// ============================================================================

export interface ResponseFeedback {
  response_id: string;
  conversation_id?: string;
  user_id?: string;
  rating: 'positive' | 'negative' | 'neutral';
  feedback_text?: string;
  ai_provider: string;
  query_category?: string;
  response_time_ms?: number;
  knowledge_used?: string[];
}

export interface ConversationLearning {
  conversation_id?: string;
  user_query: string;
  javari_response: string;
  extracted_facts?: any[];
  user_intent?: string;
  products_mentioned?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface KnowledgeGap {
  query: string;
  category?: string;
  context?: string;
}

export interface ProviderPerformance {
  provider: string;
  query_category: string;
  success: boolean;
  response_time_ms: number;
  user_rating?: number;
  tokens_used?: number;
  cost_usd?: number;
}

// ============================================================================
// FEEDBACK SYSTEM
// ============================================================================

/**
 * Record user feedback on a response
 */
export async function recordFeedback(feedback: ResponseFeedback): Promise<boolean> {
  try {
    const { error } = await supabase.from('javari_response_feedback').insert({
      response_id: feedback.response_id,
      conversation_id: feedback.conversation_id,
      user_id: feedback.user_id,
      rating: feedback.rating,
      feedback_text: feedback.feedback_text,
      ai_provider: feedback.ai_provider,
      query_category: feedback.query_category,
      response_time_ms: feedback.response_time_ms,
      knowledge_used: feedback.knowledge_used,
    });

    if (error) {
      console.error('Error recording feedback:', error);
      return false;
    }

    // Update provider performance
    await updateProviderPerformance({
      provider: feedback.ai_provider,
      query_category: feedback.query_category || 'general',
      success: feedback.rating !== 'negative',
      response_time_ms: feedback.response_time_ms || 0,
      user_rating: feedback.rating === 'positive' ? 5 : feedback.rating === 'negative' ? 1 : 3,
    });

    // If negative feedback, log as potential knowledge gap
    if (feedback.rating === 'negative' && feedback.feedback_text) {
      await recordKnowledgeGap({
        query: feedback.feedback_text,
        category: feedback.query_category,
        context: 'negative_feedback',
      });
    }

    return true;
  } catch (error) {
    console.error('Error in recordFeedback:', error);
    return false;
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(days: number = 7): Promise<{
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  by_provider: Record<string, { total: number; positive_rate: number }>;
  by_category: Record<string, { total: number; positive_rate: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('javari_response_feedback')
    .select('rating, ai_provider, query_category')
    .gte('created_at', since);

  if (error || !data) {
    return {
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      by_provider: {},
      by_category: {},
    };
  }

  const stats = {
    total: data.length,
    positive: data.filter(f => f.rating === 'positive').length,
    negative: data.filter(f => f.rating === 'negative').length,
    neutral: data.filter(f => f.rating === 'neutral').length,
    by_provider: {} as Record<string, { total: number; positive_rate: number }>,
    by_category: {} as Record<string, { total: number; positive_rate: number }>,
  };

  // Group by provider
  const providerGroups: Record<string, { total: number; positive: number }> = {};
  const categoryGroups: Record<string, { total: number; positive: number }> = {};

  for (const feedback of data) {
    // Provider stats
    if (feedback.ai_provider) {
      if (!providerGroups[feedback.ai_provider]) {
        providerGroups[feedback.ai_provider] = { total: 0, positive: 0 };
      }
      providerGroups[feedback.ai_provider].total++;
      if (feedback.rating === 'positive') {
        providerGroups[feedback.ai_provider].positive++;
      }
    }

    // Category stats
    const category = feedback.query_category || 'general';
    if (!categoryGroups[category]) {
      categoryGroups[category] = { total: 0, positive: 0 };
    }
    categoryGroups[category].total++;
    if (feedback.rating === 'positive') {
      categoryGroups[category].positive++;
    }
  }

  // Calculate rates
  for (const [provider, group] of Object.entries(providerGroups)) {
    stats.by_provider[provider] = {
      total: group.total,
      positive_rate: group.total > 0 ? group.positive / group.total : 0,
    };
  }

  for (const [category, group] of Object.entries(categoryGroups)) {
    stats.by_category[category] = {
      total: group.total,
      positive_rate: group.total > 0 ? group.positive / group.total : 0,
    };
  }

  return stats;
}

// ============================================================================
// PROVIDER PERFORMANCE TRACKING
// ============================================================================

/**
 * Update provider performance metrics
 */
export async function updateProviderPerformance(
  perf: ProviderPerformance
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Try to get existing record for today
    const { data: existing } = await supabase
      .from('javari_provider_performance')
      .select('*')
      .eq('provider', perf.provider)
      .eq('query_category', perf.query_category)
      .eq('date', today)
      .single();

    if (existing) {
      // Update existing
      const newTotal = existing.total_requests + 1;
      const newSuccess = existing.successful_requests + (perf.success ? 1 : 0);
      const newFailed = existing.failed_requests + (perf.success ? 0 : 1);
      const newAvgTime =
        (existing.avg_response_time_ms * existing.total_requests + perf.response_time_ms) /
        newTotal;
      const newAvgRating = perf.user_rating
        ? existing.avg_user_rating
          ? (existing.avg_user_rating * existing.total_requests + perf.user_rating) / newTotal
          : perf.user_rating
        : existing.avg_user_rating;

      const { error } = await supabase
        .from('javari_provider_performance')
        .update({
          total_requests: newTotal,
          successful_requests: newSuccess,
          failed_requests: newFailed,
          avg_response_time_ms: newAvgTime,
          avg_user_rating: newAvgRating,
          total_tokens_used: existing.total_tokens_used + (perf.tokens_used || 0),
          total_cost_usd: existing.total_cost_usd + (perf.cost_usd || 0),
        })
        .eq('id', existing.id);

      return !error;
    } else {
      // Insert new
      const { error } = await supabase.from('javari_provider_performance').insert({
        provider: perf.provider,
        query_category: perf.query_category,
        date: today,
        total_requests: 1,
        successful_requests: perf.success ? 1 : 0,
        failed_requests: perf.success ? 0 : 1,
        avg_response_time_ms: perf.response_time_ms,
        avg_user_rating: perf.user_rating,
        total_tokens_used: perf.tokens_used || 0,
        total_cost_usd: perf.cost_usd || 0,
      });

      return !error;
    }
  } catch (error) {
    console.error('Error updating provider performance:', error);
    return false;
  }
}

/**
 * Get best provider for a category based on performance
 */
export async function getBestProvider(category: string = 'general'): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_best_provider', {
      p_category: category,
    });

    if (error || !data) {
      return 'openai'; // Default fallback
    }

    return data;
  } catch (error) {
    console.error('Error getting best provider:', error);
    return 'openai';
  }
}

/**
 * Get provider performance comparison
 */
export async function getProviderComparison(
  days: number = 7
): Promise<
  Array<{
    provider: string;
    total_requests: number;
    success_rate: number;
    avg_response_time: number;
    avg_rating: number;
    total_cost: number;
  }>
> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('javari_provider_performance')
    .select('*')
    .gte('date', since);

  if (error || !data) return [];

  // Aggregate by provider
  const providerStats: Record<
    string,
    {
      total: number;
      success: number;
      time_sum: number;
      rating_sum: number;
      rating_count: number;
      cost: number;
    }
  > = {};

  for (const row of data) {
    if (!providerStats[row.provider]) {
      providerStats[row.provider] = {
        total: 0,
        success: 0,
        time_sum: 0,
        rating_sum: 0,
        rating_count: 0,
        cost: 0,
      };
    }
    const stats = providerStats[row.provider];
    stats.total += row.total_requests;
    stats.success += row.successful_requests;
    stats.time_sum += row.avg_response_time_ms * row.total_requests;
    if (row.avg_user_rating) {
      stats.rating_sum += row.avg_user_rating * row.total_requests;
      stats.rating_count += row.total_requests;
    }
    stats.cost += parseFloat(row.total_cost_usd) || 0;
  }

  return Object.entries(providerStats).map(([provider, stats]) => ({
    provider,
    total_requests: stats.total,
    success_rate: stats.total > 0 ? stats.success / stats.total : 0,
    avg_response_time: stats.total > 0 ? stats.time_sum / stats.total : 0,
    avg_rating: stats.rating_count > 0 ? stats.rating_sum / stats.rating_count : 0,
    total_cost: stats.cost,
  }));
}

// ============================================================================
// CONVERSATION LEARNING SYSTEM
// ============================================================================

/**
 * Extract learnings from a conversation
 */
export async function extractConversationLearnings(
  learning: ConversationLearning
): Promise<boolean> {
  try {
    // Use AI to extract structured information
    const extractionPrompt = `Analyze this conversation and extract structured information.

User Query: "${learning.user_query}"

Javari Response: "${learning.javari_response.slice(0, 2000)}"

Extract:
1. User's primary intent (e.g., "create_invoice", "get_pricing", "build_app", "general_question")
2. Products/tools mentioned (list)
3. User sentiment (positive, negative, neutral)
4. Any new facts learned about the user's needs/preferences
5. Any questions that couldn't be fully answered (knowledge gaps)

Respond in JSON format:
{
  "intent": "string",
  "products": ["string"],
  "sentiment": "positive|negative|neutral",
  "facts": [{"type": "string", "content": "string"}],
  "knowledge_gaps": ["string"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');

    // Store the learning
    const { error } = await supabase.from('javari_conversation_learnings').insert({
      conversation_id: learning.conversation_id,
      user_query: learning.user_query,
      javari_response: learning.javari_response.slice(0, 5000),
      extracted_facts: extracted.facts || [],
      user_intent: extracted.intent,
      product_mentioned: extracted.products || [],
      sentiment: extracted.sentiment,
    });

    if (error) {
      console.error('Error storing learning:', error);
      return false;
    }

    // Record any knowledge gaps found
    if (extracted.knowledge_gaps?.length > 0) {
      for (const gap of extracted.knowledge_gaps) {
        await recordKnowledgeGap({
          query: gap,
          context: 'conversation_extraction',
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error extracting conversation learnings:', error);
    return false;
  }
}

/**
 * Get learning insights
 */
export async function getLearningInsights(days: number = 30): Promise<{
  total_learnings: number;
  top_intents: Array<{ intent: string; count: number }>;
  top_products: Array<{ product: string; count: number }>;
  sentiment_breakdown: { positive: number; negative: number; neutral: number };
  common_gaps: Array<{ query: string; frequency: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: learnings, error: learnError } = await supabase
    .from('javari_conversation_learnings')
    .select('user_intent, product_mentioned, sentiment')
    .gte('created_at', since);

  const { data: gaps, error: gapsError } = await supabase
    .from('javari_knowledge_gaps')
    .select('query, frequency')
    .eq('resolved', false)
    .order('frequency', { ascending: false })
    .limit(10);

  if (learnError || !learnings) {
    return {
      total_learnings: 0,
      top_intents: [],
      top_products: [],
      sentiment_breakdown: { positive: 0, negative: 0, neutral: 0 },
      common_gaps: [],
    };
  }

  // Aggregate intents
  const intentCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  const sentiments = { positive: 0, negative: 0, neutral: 0 };

  for (const learning of learnings) {
    // Intent
    if (learning.user_intent) {
      intentCounts[learning.user_intent] = (intentCounts[learning.user_intent] || 0) + 1;
    }

    // Products
    if (learning.product_mentioned) {
      for (const product of learning.product_mentioned) {
        productCounts[product] = (productCounts[product] || 0) + 1;
      }
    }

    // Sentiment
    if (learning.sentiment && sentiments.hasOwnProperty(learning.sentiment)) {
      sentiments[learning.sentiment as keyof typeof sentiments]++;
    }
  }

  return {
    total_learnings: learnings.length,
    top_intents: Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    top_products: Object.entries(productCounts)
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    sentiment_breakdown: sentiments,
    common_gaps: (gaps || []).map(g => ({ query: g.query, frequency: g.frequency })),
  };
}

// ============================================================================
// KNOWLEDGE GAP DETECTION
// ============================================================================

/**
 * Record a knowledge gap
 */
export async function recordKnowledgeGap(gap: KnowledgeGap): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('upsert_knowledge_gap', {
      p_query: gap.query,
      p_category: gap.category,
    });

    if (error) {
      // Fallback: direct insert/update
      const { data: existing } = await supabase
        .from('javari_knowledge_gaps')
        .select('id, frequency')
        .eq('query', gap.query)
        .eq('resolved', false)
        .single();

      if (existing) {
        await supabase
          .from('javari_knowledge_gaps')
          .update({
            frequency: existing.frequency + 1,
            last_seen: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('javari_knowledge_gaps').insert({
          query: gap.query,
          category: gap.category,
          metadata: gap.context ? { context: gap.context } : {},
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error recording knowledge gap:', error);
    return false;
  }
}

/**
 * Get top knowledge gaps to address
 */
export async function getTopKnowledgeGaps(
  limit: number = 10
): Promise<
  Array<{
    id: string;
    query: string;
    category: string | null;
    frequency: number;
    first_seen: string;
    last_seen: string;
  }>
> {
  const { data, error } = await supabase
    .from('javari_knowledge_gaps')
    .select('*')
    .eq('resolved', false)
    .order('frequency', { ascending: false })
    .order('last_seen', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(g => ({
    id: g.id,
    query: g.query,
    category: g.category,
    frequency: g.frequency,
    first_seen: g.first_seen,
    last_seen: g.last_seen,
  }));
}

/**
 * Mark a knowledge gap as resolved
 */
export async function resolveKnowledgeGap(
  gapId: string,
  knowledgeId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('javari_knowledge_gaps')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by_knowledge_id: knowledgeId,
    })
    .eq('id', gapId);

  return !error;
}

export default {
  recordFeedback,
  getFeedbackStats,
  updateProviderPerformance,
  getBestProvider,
  getProviderComparison,
  extractConversationLearnings,
  getLearningInsights,
  recordKnowledgeGap,
  getTopKnowledgeGaps,
  resolveKnowledgeGap,
};
