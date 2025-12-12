/**
 * Javari AI - Proactive Suggestions Engine
 * Generates intelligent suggestions based on user behavior and context
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

export interface Suggestion {
  id?: string;
  user_id?: string;
  type: 'feature' | 'tip' | 'upsell' | 'news' | 'reminder' | 'insight';
  title: string;
  content: string;
  relevance_score: number;
  trigger_condition?: Record<string, any>;
  expires_at?: string;
}

export interface UserContext {
  user_id: string;
  recent_queries?: string[];
  recent_products?: string[];
  subscription_tier?: string;
  credits_remaining?: number;
  total_usage?: number;
  last_active?: string;
}

// ============================================================================
// SUGGESTION GENERATORS
// ============================================================================

/**
 * Generate suggestions based on user context
 */
export async function generateSuggestions(
  context: UserContext
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // 1. Low credits warning
  if (context.credits_remaining !== undefined && context.credits_remaining < 20) {
    suggestions.push({
      user_id: context.user_id,
      type: 'reminder',
      title: 'Credits Running Low',
      content: `You have ${context.credits_remaining} credits remaining. Consider upgrading your plan or purchasing a credit pack to continue creating without interruption.`,
      relevance_score: 0.95,
      trigger_condition: { credits_below: 20 },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // 2. Feature tips based on recent activity
  if (context.recent_products && context.recent_products.length > 0) {
    const relatedFeatures = await getRelatedFeatures(context.recent_products[0]);
    if (relatedFeatures) {
      suggestions.push({
        user_id: context.user_id,
        type: 'tip',
        title: `Did You Know?`,
        content: relatedFeatures,
        relevance_score: 0.8,
        trigger_condition: { recent_product: context.recent_products[0] },
        expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  // 3. Upsell based on usage patterns
  if (
    context.subscription_tier === 'starter' &&
    context.total_usage !== undefined &&
    context.total_usage > 50
  ) {
    suggestions.push({
      user_id: context.user_id,
      type: 'upsell',
      title: 'Ready to Level Up?',
      content:
        "You've been creating amazing things! Upgrade to Pro for 5x the credits, API access, and priority AI routing. Save 20% with annual billing.",
      relevance_score: 0.85,
      trigger_condition: { usage_above: 50, tier: 'starter' },
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // 4. Engagement reminder for inactive users
  if (context.last_active) {
    const daysSinceActive = Math.floor(
      (Date.now() - new Date(context.last_active).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceActive > 7) {
      suggestions.push({
        user_id: context.user_id,
        type: 'reminder',
        title: 'We Miss You!',
        content: `It's been ${daysSinceActive} days since your last visit. Come back and check out what's new - we've added exciting features!`,
        relevance_score: 0.7,
        trigger_condition: { days_inactive: daysSinceActive },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return suggestions;
}

/**
 * Get related feature tips for a product
 */
async function getRelatedFeatures(product: string): Promise<string | null> {
  const featureTips: Record<string, string> = {
    'invoice-generator':
      'Try our Proposal Builder next! Create professional proposals that include your invoices and close deals faster.',
    'proposal-builder':
      'Add Contract Generator to your workflow - send binding agreements right after your proposals are accepted.',
    'logo-studio':
      'Export your logo to Social Graphics Creator to instantly generate branded social media posts.',
    'market-oracle':
      'Combine Market Oracle with Competitive Intelligence for complete market visibility.',
    'ebook-creator':
      'Use SEO Content Writer to optimize your eBook chapters for better discoverability.',
    'resume-builder':
      'Our Email Writer can help you craft the perfect cover letter to go with your resume.',
  };

  return featureTips[product] || null;
}

/**
 * Generate AI-powered personalized insight
 */
export async function generatePersonalizedInsight(
  context: UserContext
): Promise<Suggestion | null> {
  if (!context.recent_queries || context.recent_queries.length < 3) {
    return null;
  }

  try {
    const prompt = `Based on these recent user queries, generate a brief, helpful insight or tip that would be valuable to them.

Recent queries:
${context.recent_queries.slice(0, 5).map((q, i) => `${i + 1}. "${q}"`).join('\n')}

Generate a personalized insight in JSON format:
{
  "title": "Short, catchy title (max 50 chars)",
  "content": "Helpful insight or tip (max 200 chars)",
  "relevance": 0.0-1.0 score
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });

    const insight = JSON.parse(response.choices[0].message.content || '{}');

    if (insight.title && insight.content) {
      return {
        user_id: context.user_id,
        type: 'insight',
        title: insight.title,
        content: insight.content,
        relevance_score: insight.relevance || 0.7,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error generating personalized insight:', error);
    return null;
  }
}

// ============================================================================
// NEWS & UPDATE SUGGESTIONS
// ============================================================================

/**
 * Generate suggestions from recent news/updates
 */
export async function generateNewsSuggestions(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Get recent external news that might be relevant
  const { data: news } = await supabase
    .from('javari_external_data')
    .select('title, content, data_type, metadata')
    .in('data_type', ['news', 'financial'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (news && news.length > 0) {
    // Pick top news item
    const topNews = news[0];
    suggestions.push({
      type: 'news',
      title: 'Trending Now',
      content: `${topNews.title}: ${topNews.content.slice(0, 150)}...`,
      relevance_score: 0.6,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return suggestions;
}

// ============================================================================
// SUGGESTION STORAGE & RETRIEVAL
// ============================================================================

/**
 * Store suggestions in database
 */
export async function storeSuggestions(suggestions: Suggestion[]): Promise<number> {
  if (suggestions.length === 0) return 0;

  const { error, data } = await supabase
    .from('javari_proactive_suggestions')
    .insert(
      suggestions.map(s => ({
        user_id: s.user_id,
        suggestion_type: s.type,
        title: s.title,
        content: s.content,
        relevance_score: s.relevance_score,
        trigger_condition: s.trigger_condition,
        expires_at: s.expires_at,
      }))
    )
    .select('id');

  if (error) {
    console.error('Error storing suggestions:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get suggestions for a user
 */
export async function getSuggestionsForUser(
  userId: string,
  limit: number = 5
): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('shown', false)
    .eq('dismissed', false)
    .gt('expires_at', new Date().toISOString())
    .order('relevance_score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(s => ({
    id: s.id,
    user_id: s.user_id,
    type: s.suggestion_type,
    title: s.title,
    content: s.content,
    relevance_score: s.relevance_score,
    trigger_condition: s.trigger_condition,
    expires_at: s.expires_at,
  }));
}

/**
 * Get global suggestions (not user-specific)
 */
export async function getGlobalSuggestions(limit: number = 3): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .select('*')
    .is('user_id', null)
    .eq('shown', false)
    .gt('expires_at', new Date().toISOString())
    .order('relevance_score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(s => ({
    id: s.id,
    type: s.suggestion_type,
    title: s.title,
    content: s.content,
    relevance_score: s.relevance_score,
    expires_at: s.expires_at,
  }));
}

/**
 * Mark suggestion as shown
 */
export async function markSuggestionShown(suggestionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_proactive_suggestions')
    .update({ shown: true, shown_at: new Date().toISOString() })
    .eq('id', suggestionId);

  return !error;
}

/**
 * Mark suggestion as clicked
 */
export async function markSuggestionClicked(suggestionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_proactive_suggestions')
    .update({ clicked: true })
    .eq('id', suggestionId);

  return !error;
}

/**
 * Dismiss a suggestion
 */
export async function dismissSuggestion(suggestionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_proactive_suggestions')
    .update({ dismissed: true })
    .eq('id', suggestionId);

  return !error;
}

/**
 * Clean up expired suggestions
 */
export async function cleanupExpiredSuggestions(): Promise<number> {
  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Error cleaning up suggestions:', error);
    return 0;
  }

  return data?.length || 0;
}

// ============================================================================
// "WHAT'S NEW" FEATURE
// ============================================================================

/**
 * Generate "What's New" summary for a user
 */
export async function getWhatsNew(
  userId?: string,
  since?: string
): Promise<{
  features: string[];
  news: string[];
  updates: string[];
}> {
  const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = {
    features: [] as string[],
    news: [] as string[],
    updates: [] as string[],
  };

  // Get recent news
  const { data: newsData } = await supabase
    .from('javari_external_data')
    .select('title, content')
    .eq('data_type', 'news')
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: false })
    .limit(5);

  if (newsData) {
    result.news = newsData.map(n => n.title);
  }

  // Get recent knowledge additions (features/updates)
  const { data: knowledgeData } = await supabase
    .from('javari_knowledge')
    .select('title, category')
    .in('category', ['products', 'features'])
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: false })
    .limit(5);

  if (knowledgeData) {
    result.features = knowledgeData
      .filter(k => k.category === 'products')
      .map(k => k.title);
    result.updates = knowledgeData
      .filter(k => k.category === 'features')
      .map(k => k.title);
  }

  return result;
}

export default {
  generateSuggestions,
  generatePersonalizedInsight,
  generateNewsSuggestions,
  storeSuggestions,
  getSuggestionsForUser,
  getGlobalSuggestions,
  markSuggestionShown,
  markSuggestionClicked,
  dismissSuggestion,
  cleanupExpiredSuggestions,
  getWhatsNew,
};
