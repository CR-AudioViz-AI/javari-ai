/**
 * JAVARI LEARNING SYSTEM - UTILITIES
 * Helper functions for the learning/feedback system
 * Moved from app/api/learning/route.ts to comply with Next.js route export restrictions
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface LearningEntry {
  id?: string;
  user_query: string;
  query_category: string;
  response_summary: string;
  data_sources_used: string[];
  user_satisfaction?: number;
  response_time_ms: number;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface PatternStats {
  category: string;
  total_queries: number;
  avg_satisfaction: number;
  common_keywords: string[];
  best_data_sources: string[];
}

export async function logInteraction(entry: LearningEntry): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('javari_learning')
      .insert({
        user_query: entry.user_query,
        query_category: entry.query_category,
        response_summary: entry.response_summary?.slice(0, 500),
        data_sources_used: entry.data_sources_used,
        user_satisfaction: entry.user_satisfaction,
        response_time_ms: entry.response_time_ms,
        metadata: entry.metadata
      });
    
    if (error) {
      console.error('Failed to log interaction:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Learning log error:', e);
    return false;
  }
}

// =============================================================================
// RECORD FEEDBACK - User satisfaction rating
// =============================================================================
export async function recordFeedback(
  interactionId: string, 
  satisfaction: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('javari_learning')
      .update({ user_satisfaction: satisfaction })
      .eq('id', interactionId);
    
    return !error;
  } catch (e) {
    return false;
  }
}

// =============================================================================
// GET PATTERNS - Analyze what works best
// =============================================================================
export async function getPatterns(category?: string): Promise<PatternStats[]> {
  try {
    let query = supabase
      .from('javari_learning')
      .select('query_category, user_satisfaction, data_sources_used, user_query')
      .not('user_satisfaction', 'is', null);
    
    if (category) {
      query = query.eq('query_category', category);
    }
    
    const { data, error } = await query.limit(1000);
    
    if (error || !data) return [];
    
    // Aggregate by category
    const categoryMap = new Map<string, {
      queries: string[];
      satisfactions: number[];
      sources: string[];
    }>();
    
    for (const row of data) {
      const cat = row.query_category;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { queries: [], satisfactions: [], sources: [] });
      }
      const entry = categoryMap.get(cat)!;
      entry.queries.push(row.user_query);
      if (row.user_satisfaction) {
        entry.satisfactions.push(row.user_satisfaction);
      }
      if (row.data_sources_used) {
        entry.sources.push(...row.data_sources_used);
      }
    }
    
    // Build stats
    const stats: PatternStats[] = [];
    for (const [cat, data] of categoryMap) {
      // Extract common keywords
      const words = data.queries.join(' ').toLowerCase().split(/\s+/);
      const wordCounts = new Map<string, number>();
      for (const word of words) {
        if (word.length > 3) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
      const commonKeywords = [...wordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
      
      // Count data sources
      const sourceCounts = new Map<string, number>();
      for (const source of data.sources) {
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      }
      const bestSources = [...sourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source]) => source);
      
      stats.push({
        category: cat,
        total_queries: data.queries.length,
        avg_satisfaction: data.satisfactions.length > 0
          ? data.satisfactions.reduce((a, b) => a + b, 0) / data.satisfactions.length
          : 0,
        common_keywords: commonKeywords,
        best_data_sources: bestSources
      });
    }
    
    return stats.sort((a, b) => b.total_queries - a.total_queries);
    
  } catch (e) {
    console.error('Pattern analysis error:', e);
    return [];
  }
}

// =============================================================================
// GET SIMILAR QUERIES - Find past successful responses
// =============================================================================
export async function findSimilarQueries(
  query: string, 
  category: string,
  limit = 5
): Promise<LearningEntry[]> {
  try {
    // Simple keyword matching for now
    // Could be enhanced with vector embeddings later
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const { data, error } = await supabase
      .from('javari_learning')
      .select('*')
      .eq('query_category', category)
      .gte('user_satisfaction', 4) // Only highly rated responses
      .limit(50);
    
    if (error || !data) return [];
    
    // Score by keyword overlap
    const scored = data.map(entry => {
      const entryWords = entry.user_query.toLowerCase().split(/\s+/);
      const overlap = keywords.filter(k => entryWords.some(w => w.includes(k))).length;
      return { entry, score: overlap };
    });
    
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
    
  } catch (e) {
    return [];
  }
}

// =============================================================================
// DAILY LEARNING SUMMARY - For admin dashboard
// =============================================================================
export async function getDailySummary(): Promise<{
  total_interactions: number;
  avg_satisfaction: number;
  top_categories: { category: string; count: number }[];
  avg_response_time: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    const { data, error } = await supabase
      .from('javari_learning')
      .select('query_category, user_satisfaction, response_time_ms')
      .gte('created_at', today.toISOString());
    
    if (error || !data) {
      return {
        total_interactions: 0,
        avg_satisfaction: 0,
        top_categories: [],
        avg_response_time: 0
      };
    }
    
    const categoryCounts = new Map<string, number>();
    let totalSatisfaction = 0;
    let satisfactionCount = 0;
    let totalResponseTime = 0;
    
    for (const row of data) {
      categoryCounts.set(
        row.query_category, 
        (categoryCounts.get(row.query_category) || 0) + 1
      );
      if (row.user_satisfaction) {
        totalSatisfaction += row.user_satisfaction;
        satisfactionCount++;
      }
      if (row.response_time_ms) {
        totalResponseTime += row.response_time_ms;
      }
    }
    
    return {
      total_interactions: data.length,
      avg_satisfaction: satisfactionCount > 0 
        ? totalSatisfaction / satisfactionCount 
        : 0,
      top_categories: [...categoryCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count })),
      avg_response_time: data.length > 0 
        ? totalResponseTime / data.length 
        : 0
    };
    
  } catch (e) {
    return {
      total_interactions: 0,
      avg_satisfaction: 0,
      top_categories: [],
      avg_response_time: 0
    };
  }
}

// =============================================================================
// API ROUTES
// =============================================================================
