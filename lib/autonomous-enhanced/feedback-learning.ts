/**
 * Javari AI - Feedback & Learning System
 * 
 * Tracks user feedback on responses and learns from conversations.
 * Enables Javari to improve over time based on actual usage.
 * 
 * Created: December 13, 2025
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface FeedbackInput {
  responseId: string;
  conversationId?: string;
  userId?: string;
  rating: 'positive' | 'negative' | 'neutral';
  feedbackText?: string;
  aiProvider?: string;
  queryCategory?: string;
  responseTimeMs?: number;
  knowledgeUsed?: string[];
}

interface ConversationLearning {
  conversationId?: string;
  userQuery: string;
  javariResponse: string;
  extractedFacts?: any[];
  userIntent?: string;
  productMentioned?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

/**
 * Record user feedback on a response
 */
export async function recordFeedback(feedback: FeedbackInput): Promise<boolean> {
  const { error } = await supabase
    .from('javari_response_feedback')
    .insert({
      response_id: feedback.responseId,
      conversation_id: feedback.conversationId,
      user_id: feedback.userId,
      rating: feedback.rating,
      feedback_text: feedback.feedbackText,
      ai_provider: feedback.aiProvider,
      query_category: feedback.queryCategory,
      response_time_ms: feedback.responseTimeMs,
      knowledge_used: feedback.knowledgeUsed
    });

  if (error) {
    console.error('[Feedback] Error recording feedback:', error);
    return false;
  }

  // Update provider performance
  if (feedback.aiProvider && feedback.queryCategory) {
    await updateProviderPerformance(
      feedback.aiProvider,
      feedback.queryCategory,
      feedback.rating === 'positive' ? 1 : feedback.rating === 'negative' ? -1 : 0,
      feedback.responseTimeMs || 0
    );
  }

  return true;
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(options: {
  aiProvider?: string;
  category?: string;
  days?: number;
} = {}): Promise<{
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  positiveRate: number;
}> {
  const { aiProvider, category, days = 30 } = options;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  let query = supabase
    .from('javari_response_feedback')
    .select('rating')
    .gte('created_at', startDate.toISOString());
  
  if (aiProvider) {
    query = query.eq('ai_provider', aiProvider);
  }
  if (category) {
    query = query.eq('query_category', category);
  }
  
  const { data, error } = await query;
  
  if (error || !data) {
    return { total: 0, positive: 0, negative: 0, neutral: 0, positiveRate: 0 };
  }
  
  const positive = data.filter(d => d.rating === 'positive').length;
  const negative = data.filter(d => d.rating === 'negative').length;
  const neutral = data.filter(d => d.rating === 'neutral').length;
  
  return {
    total: data.length,
    positive,
    negative,
    neutral,
    positiveRate: data.length > 0 ? positive / data.length : 0
  };
}

/**
 * Update provider performance metrics
 */
export async function updateProviderPerformance(
  provider: string,
  category: string,
  ratingDelta: number,
  responseTimeMs: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Try to update existing record
  const { data: existing } = await supabase
    .from('javari_provider_performance')
    .select('*')
    .eq('provider', provider)
    .eq('query_category', category)
    .eq('date', today)
    .single();
  
  if (existing) {
    // Update existing
    const newTotal = existing.total_requests + 1;
    const newAvgRating = existing.avg_user_rating 
      ? (existing.avg_user_rating * existing.total_requests + ratingDelta) / newTotal
      : ratingDelta;
    const newAvgTime = existing.avg_response_time_ms
      ? (existing.avg_response_time_ms * existing.total_requests + responseTimeMs) / newTotal
      : responseTimeMs;
    
    await supabase
      .from('javari_provider_performance')
      .update({
        total_requests: newTotal,
        successful_requests: existing.successful_requests + (ratingDelta >= 0 ? 1 : 0),
        failed_requests: existing.failed_requests + (ratingDelta < 0 ? 1 : 0),
        avg_response_time_ms: newAvgTime,
        avg_user_rating: newAvgRating
      })
      .eq('id', existing.id);
  } else {
    // Insert new
    await supabase
      .from('javari_provider_performance')
      .insert({
        provider,
        query_category: category,
        total_requests: 1,
        successful_requests: ratingDelta >= 0 ? 1 : 0,
        failed_requests: ratingDelta < 0 ? 1 : 0,
        avg_response_time_ms: responseTimeMs,
        avg_user_rating: ratingDelta,
        date: today
      });
  }
}

/**
 * Get best performing provider for a category
 */
export async function getBestProvider(category: string = 'general'): Promise<string> {
  try {
    const { data } = await supabase.rpc('get_best_provider', { p_category: category });
    return data || 'openai';
  } catch (error) {
    console.error('[Feedback] Error getting best provider:', error);
    return 'openai';
  }
}

/**
 * Extract learnings from a conversation using AI
 */
export async function extractConversationLearnings(
  userQuery: string,
  javariResponse: string,
  conversationId?: string
): Promise<ConversationLearning | null> {
  try {
    const extractionPrompt = `Analyze this conversation and extract learnings:

USER QUERY: ${userQuery}

JAVARI RESPONSE: ${javariResponse}

Extract:
1. Facts mentioned (list specific facts)
2. User intent (what they wanted to accomplish)
3. Products/features mentioned (from CR AudioViz AI platform)
4. Sentiment (positive/negative/neutral)

Respond in JSON format:
{
  "facts": ["fact1", "fact2"],
  "intent": "brief description of intent",
  "products": ["product1", "product2"],
  "sentiment": "positive|negative|neutral"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');

    const learning: ConversationLearning = {
      conversationId,
      userQuery,
      javariResponse,
      extractedFacts: extracted.facts || [],
      userIntent: extracted.intent,
      productMentioned: extracted.products || [],
      sentiment: extracted.sentiment || 'neutral'
    };

    // Store learning
    await supabase
      .from('javari_conversation_learnings')
      .insert({
        conversation_id: learning.conversationId,
        user_query: learning.userQuery,
        javari_response: learning.javariResponse,
        extracted_facts: learning.extractedFacts,
        user_intent: learning.userIntent,
        product_mentioned: learning.productMentioned,
        sentiment: learning.sentiment
      });

    return learning;
  } catch (error) {
    console.error('[Feedback] Error extracting learnings:', error);
    return null;
  }
}

/**
 * Get learning insights
 */
export async function getLearningInsights(days: number = 7): Promise<{
  totalLearnings: number;
  topIntents: { intent: string; count: number }[];
  topProducts: { product: string; count: number }[];
  sentimentBreakdown: { positive: number; negative: number; neutral: number };
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: learnings, error } = await supabase
    .from('javari_conversation_learnings')
    .select('user_intent, product_mentioned, sentiment')
    .gte('created_at', startDate.toISOString());

  if (error || !learnings) {
    return {
      totalLearnings: 0,
      topIntents: [],
      topProducts: [],
      sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 }
    };
  }

  // Count intents
  const intentCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  let positive = 0, negative = 0, neutral = 0;

  for (const learning of learnings) {
    if (learning.user_intent) {
      intentCounts[learning.user_intent] = (intentCounts[learning.user_intent] || 0) + 1;
    }
    for (const product of learning.product_mentioned || []) {
      productCounts[product] = (productCounts[product] || 0) + 1;
    }
    if (learning.sentiment === 'positive') positive++;
    else if (learning.sentiment === 'negative') negative++;
    else neutral++;
  }

  const topIntents = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([intent, count]) => ({ intent, count }));

  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([product, count]) => ({ product, count }));

  return {
    totalLearnings: learnings.length,
    topIntents,
    topProducts,
    sentimentBreakdown: { positive, negative, neutral }
  };
}

/**
 * Record a knowledge gap (query Javari couldn't answer well)
 */
export async function recordKnowledgeGap(
  query: string,
  category?: string
): Promise<string | null> {
  try {
    const { data } = await supabase.rpc('upsert_knowledge_gap', {
      p_query: query,
      p_category: category
    });
    return data;
  } catch (error) {
    console.error('[Feedback] Error recording knowledge gap:', error);
    return null;
  }
}

/**
 * Get top knowledge gaps
 */
export async function getTopKnowledgeGaps(limit: number = 10): Promise<{
  query: string;
  category: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
}[]> {
  const { data, error } = await supabase
    .from('javari_knowledge_gaps')
    .select('query, category, frequency, first_seen, last_seen')
    .eq('resolved', false)
    .order('frequency', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map(d => ({
    query: d.query,
    category: d.category || 'unknown',
    frequency: d.frequency,
    firstSeen: d.first_seen,
    lastSeen: d.last_seen
  }));
}

/**
 * Mark a knowledge gap as resolved
 */
export async function resolveKnowledgeGap(
  gapId: string,
  knowledgeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('javari_knowledge_gaps')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by_knowledge_id: knowledgeId
    })
    .eq('id', gapId);

  return !error;
}
