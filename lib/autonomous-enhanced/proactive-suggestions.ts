/**
 * Javari AI - Proactive Suggestions Engine
 * 
 * Generates smart suggestions based on user behavior, trending topics,
 * and platform features. Makes Javari proactively helpful.
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

interface Suggestion {
  userId?: string;
  type: 'feature' | 'tip' | 'upsell' | 'news' | 'reminder' | 'insight';
  title: string;
  content: string;
  relevanceScore: number;
  triggerCondition?: Record<string, any>;
  expiresAt?: string;
}

/**
 * Generate context-aware suggestions
 */
export async function generateSuggestions(
  userId?: string,
  context?: {
    recentActivity?: string[];
    creditsRemaining?: number;
    subscriptionTier?: string;
    lastLogin?: string;
  }
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  
  // Low credits warning
  if (context?.creditsRemaining !== undefined && context.creditsRemaining < 100) {
    suggestions.push({
      userId,
      type: 'reminder',
      title: '💳 Low Credits Alert',
      content: `You have ${context.creditsRemaining} credits remaining. ` +
               `Consider upgrading your plan or purchasing additional credits to continue using Javari AI.`,
      relevanceScore: 0.95,
      triggerCondition: { credits_below: 100 },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  // Feature tips based on activity
  if (context?.recentActivity?.length) {
    const hasUsedChat = context.recentActivity.includes('chat');
    const hasUsedTools = context.recentActivity.includes('tools');
    
    if (hasUsedChat && !hasUsedTools) {
      suggestions.push({
        userId,
        type: 'tip',
        title: '🛠️ Explore Our 60+ Creative Tools',
        content: 'Did you know Javari can help you access over 60 professional creative tools? ' +
                 'Try asking "What tools can help me create a logo?" or "Show me video editing tools".',
        relevanceScore: 0.8,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }
  
  // Upsell for free tier
  if (context?.subscriptionTier === 'free') {
    suggestions.push({
      userId,
      type: 'upsell',
      title: '⭐ Upgrade to Creator Plan',
      content: 'Unlock unlimited AI generations, priority support, and access to premium tools. ' +
               'Save 20% with annual billing!',
      relevanceScore: 0.6,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  // Re-engagement for inactive users
  if (context?.lastLogin) {
    const lastLoginDate = new Date(context.lastLogin);
    const daysSinceLogin = (Date.now() - lastLoginDate.getTime()) / (24 * 60 * 60 * 1000);
    
    if (daysSinceLogin > 7) {
      suggestions.push({
        userId,
        type: 'reminder',
        title: '👋 Welcome Back!',
        content: 'We\'ve added new features since your last visit! ' +
                 'Check out our improved AI models and new creative tools.',
        relevanceScore: 0.85,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }
  
  return suggestions;
}

/**
 * Generate AI-powered personalized insight
 */
export async function generatePersonalizedInsight(
  userId: string,
  userData: {
    usagePatterns?: string[];
    recentQueries?: string[];
    preferredTools?: string[];
  }
): Promise<Suggestion | null> {
  if (!userData.recentQueries?.length && !userData.usagePatterns?.length) {
    return null;
  }

  try {
    const prompt = `Based on this user's activity, generate ONE helpful insight or tip:

Usage patterns: ${userData.usagePatterns?.join(', ') || 'Not available'}
Recent queries: ${userData.recentQueries?.slice(0, 5).join('; ') || 'Not available'}
Preferred tools: ${userData.preferredTools?.join(', ') || 'Not available'}

Generate a brief, actionable insight (2-3 sentences) that would help this user be more productive.
Focus on features they might not know about or ways to improve their workflow.

Respond in JSON format:
{
  "title": "Brief title (with emoji)",
  "content": "The insight content",
  "relevance": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    const insight = JSON.parse(response.choices[0].message.content || '{}');

    return {
      userId,
      type: 'insight',
      title: insight.title || '💡 Productivity Tip',
      content: insight.content || '',
      relevanceScore: insight.relevance || 0.7,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error('[Suggestions] Error generating insight:', error);
    return null;
  }
}

/**
 * Generate suggestions from trending news
 */
export async function generateNewsSuggestions(): Promise<Suggestion[]> {
  const { data: news, error } = await supabase
    .from('javari_external_data')
    .select('title, content, url, source_name, metadata')
    .eq('data_type', 'news')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !news?.length) {
    return [];
  }

  return news.map(item => ({
    type: 'news' as const,
    title: `📰 ${item.title.substring(0, 50)}...`,
    content: item.content?.substring(0, 200) + '...',
    relevanceScore: 0.5,
    triggerCondition: { source: item.source_name, url: item.url },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }));
}

/**
 * Store suggestions in database
 */
export async function storeSuggestions(suggestions: Suggestion[]): Promise<number> {
  if (suggestions.length === 0) return 0;

  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .insert(suggestions.map(s => ({
      user_id: s.userId,
      suggestion_type: s.type,
      title: s.title,
      content: s.content,
      relevance_score: s.relevanceScore,
      trigger_condition: s.triggerCondition,
      expires_at: s.expiresAt
    })))
    .select('id');

  if (error) {
    console.error('[Suggestions] Error storing suggestions:', error);
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
): Promise<any[]> {
  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('shown', false)
    .eq('dismissed', false)
    .gt('expires_at', new Date().toISOString())
    .order('relevance_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Suggestions] Error getting user suggestions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get global suggestions (not user-specific)
 */
export async function getGlobalSuggestions(limit: number = 3): Promise<any[]> {
  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .select('*')
    .is('user_id', null)
    .eq('shown', false)
    .gt('expires_at', new Date().toISOString())
    .order('relevance_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Suggestions] Error getting global suggestions:', error);
    return [];
  }

  return data || [];
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
 * Mark suggestion as dismissed
 */
export async function markSuggestionDismissed(suggestionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_proactive_suggestions')
    .update({ dismissed: true })
    .eq('id', suggestionId);

  return !error;
}

/**
 * Get "What's New" digest
 */
export async function getWhatsNew(since?: Date): Promise<{
  features: any[];
  news: any[];
  updates: any[];
}> {
  const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get feature suggestions
  const { data: features } = await supabase
    .from('javari_proactive_suggestions')
    .select('title, content, created_at')
    .eq('suggestion_type', 'feature')
    .gte('created_at', sinceDate.toISOString())
    .limit(5);

  // Get news
  const { data: news } = await supabase
    .from('javari_external_data')
    .select('title, content, url, source_name, created_at')
    .eq('data_type', 'news')
    .gte('created_at', sinceDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  // Get recent updates from knowledge base
  const { data: updates } = await supabase
    .from('javari_knowledge')
    .select('title, content, updated_at')
    .gte('updated_at', sinceDate.toISOString())
    .order('updated_at', { ascending: false })
    .limit(5);

  return {
    features: features || [],
    news: news || [],
    updates: updates || []
  };
}

/**
 * Cleanup expired suggestions
 */
export async function cleanupExpiredSuggestions(): Promise<number> {
  const { data, error } = await supabase
    .from('javari_proactive_suggestions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[Suggestions] Cleanup error:', error);
    return 0;
  }

  return data?.length || 0;
}
