// lib/knowledge-integration.ts
// Javari AI Knowledge Integration - Context-Aware Responses
// Version: 1.0.0
// Timestamp: 2025-12-13 8:20 AM EST

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory?: string;
  title: string;
  content: string;
  keywords: string[];
  confidence_score: number;
  source?: string;
  embedding?: number[];
}

interface KnowledgeSearchResult extends KnowledgeEntry {
  similarity: number;
}

interface ExternalDataEntry {
  id: string;
  source_name: string;
  data_type: string;
  title: string;
  content: string;
  url?: string;
  published_at?: string;
  metadata?: Record<string, any>;
}

/**
 * Search knowledge base using semantic similarity
 */
export async function searchKnowledge(
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    categories?: string[];
  }
): Promise<KnowledgeSearchResult[]> {
  const { limit = 5, threshold = 0.7, categories } = options || {};
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Generate embedding for query
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Search using vector similarity
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });
    
    if (error) {
      console.error('Knowledge search error:', error);
      return [];
    }
    
    // Filter by categories if specified
    let results = data as KnowledgeSearchResult[];
    if (categories && categories.length > 0) {
      results = results.filter(r => categories.includes(r.category));
    }
    
    return results;
  } catch (error) {
    console.error('Knowledge search failed:', error);
    return [];
  }
}

/**
 * Search knowledge using keywords (fallback when embeddings unavailable)
 */
export async function searchKnowledgeByKeywords(
  keywords: string[],
  options?: {
    limit?: number;
    categories?: string[];
  }
): Promise<KnowledgeEntry[]> {
  const { limit = 5, categories } = options || {};
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('javari_knowledge')
      .select('*')
      .limit(limit);
    
    // Add keyword filters
    if (keywords.length > 0) {
      const keywordFilters = keywords.map(k => `keywords.cs.{${k}}`).join(',');
      query = query.or(keywordFilters);
    }
    
    // Add category filters
    if (categories && categories.length > 0) {
      query = query.in('category', categories);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Keyword search error:', error);
      return [];
    }
    
    return data as KnowledgeEntry[];
  } catch (error) {
    console.error('Keyword search failed:', error);
    return [];
  }
}

/**
 * Get real-time external data
 */
export async function getExternalData(
  dataType: 'news' | 'crypto' | 'weather' | 'all',
  options?: {
    limit?: number;
    source?: string;
  }
): Promise<ExternalDataEntry[]> {
  const { limit = 10, source } = options || {};
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('javari_external_data')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (dataType !== 'all') {
      query = query.eq('data_type', dataType);
    }
    
    if (source) {
      query = query.eq('source_name', source);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('External data fetch error:', error);
      return [];
    }
    
    return data as ExternalDataEntry[];
  } catch (error) {
    console.error('External data fetch failed:', error);
    return [];
  }
}

/**
 * Get trending news headlines
 */
export async function getTrendingNews(limit: number = 5): Promise<ExternalDataEntry[]> {
  return getExternalData('news', { limit });
}

/**
 * Get current crypto prices
 */
export async function getCryptoPrices(limit: number = 10): Promise<ExternalDataEntry[]> {
  return getExternalData('crypto', { limit, source: 'coingecko' });
}

/**
 * Get current weather
 */
export async function getCurrentWeather(): Promise<ExternalDataEntry | null> {
  const data = await getExternalData('weather', { limit: 1, source: 'weather_openmeteo' });
  return data[0] || null;
}

/**
 * Build context for AI from knowledge and external data
 */
export async function buildKnowledgeContext(
  query: string,
  options?: {
    includeNews?: boolean;
    includeCrypto?: boolean;
    includeWeather?: boolean;
    maxKnowledge?: number;
  }
): Promise<string> {
  const {
    includeNews = false,
    includeCrypto = false,
    includeWeather = false,
    maxKnowledge = 3,
  } = options || {};
  
  const contextParts: string[] = [];
  
  // Search knowledge base
  try {
    const knowledge = await searchKnowledge(query, { limit: maxKnowledge });
    if (knowledge.length > 0) {
      contextParts.push('## RELEVANT KNOWLEDGE\n');
      for (const entry of knowledge) {
        contextParts.push(`### ${entry.title} (${entry.category})`);
        contextParts.push(entry.content);
        contextParts.push(`[Confidence: ${Math.round(entry.similarity * 100)}%]\n`);
      }
    }
  } catch (error) {
    console.error('Knowledge fetch failed:', error);
  }
  
  // Add news if requested or if query mentions news/latest
  if (includeNews || /\b(news|latest|recent|today|happening)\b/i.test(query)) {
    try {
      const news = await getTrendingNews(3);
      if (news.length > 0) {
        contextParts.push('\n## TRENDING NEWS\n');
        for (const item of news) {
          contextParts.push(`- ${item.title}`);
          if (item.url) contextParts.push(`  Source: ${item.url}`);
        }
      }
    } catch (error) {
      console.error('News fetch failed:', error);
    }
  }
  
  // Add crypto if requested or if query mentions crypto
  if (includeCrypto || /\b(crypto|bitcoin|btc|ethereum|eth|coin|price)\b/i.test(query)) {
    try {
      const crypto = await getCryptoPrices(5);
      if (crypto.length > 0) {
        contextParts.push('\n## CURRENT CRYPTO PRICES\n');
        for (const coin of crypto) {
          const metadata = coin.metadata as any;
          contextParts.push(`- ${coin.title}: $${metadata?.current_price?.toLocaleString() || 'N/A'}`);
        }
      }
    } catch (error) {
      console.error('Crypto fetch failed:', error);
    }
  }
  
  // Add weather if requested or if query mentions weather
  if (includeWeather || /\b(weather|temperature|forecast|rain|sunny)\b/i.test(query)) {
    try {
      const weather = await getCurrentWeather();
      if (weather) {
        const metadata = weather.metadata as any;
        contextParts.push('\n## CURRENT WEATHER (Fort Myers, FL)\n');
        contextParts.push(`Temperature: ${metadata?.temperature || 'N/A'}°F`);
        contextParts.push(`Conditions: ${weather.content || 'N/A'}`);
      }
    } catch (error) {
      console.error('Weather fetch failed:', error);
    }
  }
  
  return contextParts.join('\n');
}

/**
 * Analyze query to determine what context is needed
 */
export function analyzeQueryContext(query: string): {
  needsKnowledge: boolean;
  needsNews: boolean;
  needsCrypto: boolean;
  needsWeather: boolean;
  categories: string[];
} {
  const queryLower = query.toLowerCase();
  
  // Determine knowledge categories
  const categories: string[] = [];
  if (/\b(code|programming|api|function|component|react|next|javascript|typescript)\b/i.test(query)) {
    categories.push('development', 'programming');
  }
  if (/\b(business|strategy|okr|kpi|revenue|growth|marketing)\b/i.test(query)) {
    categories.push('business', 'strategy');
  }
  if (/\b(design|ui|ux|interface|layout|style|css)\b/i.test(query)) {
    categories.push('design', 'ui');
  }
  if (/\b(database|supabase|sql|postgres|data)\b/i.test(query)) {
    categories.push('database', 'infrastructure');
  }
  
  return {
    needsKnowledge: categories.length > 0 || query.length > 50,
    needsNews: /\b(news|latest|recent|today|happening|update)\b/i.test(query),
    needsCrypto: /\b(crypto|bitcoin|btc|ethereum|eth|coin|price|market)\b/i.test(query),
    needsWeather: /\b(weather|temperature|forecast|rain|sunny|outside)\b/i.test(query),
    categories,
  };
}

/**
 * Record a knowledge gap (when Javari can't answer something)
 */
export async function recordKnowledgeGap(
  query: string,
  category?: string
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.rpc('upsert_knowledge_gap', {
      p_query: query,
      p_category: category,
    });
  } catch (error) {
    console.error('Failed to record knowledge gap:', error);
  }
}

/**
 * Get knowledge statistics
 */
export async function getKnowledgeStats(): Promise<{
  totalEntries: number;
  categories: { category: string; count: number }[];
  recentUpdates: number;
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Total count
    const { count: totalEntries } = await supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact', head: true });
    
    // Category breakdown
    const { data: categoryData } = await supabase
      .from('javari_knowledge')
      .select('category')
      .order('category');
    
    const categoryCounts: Record<string, number> = {};
    for (const item of categoryData || []) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }
    
    const categories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    
    // Recent updates (last 24 hours)
    const { count: recentUpdates } = await supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    return {
      totalEntries: totalEntries || 0,
      categories,
      recentUpdates: recentUpdates || 0,
    };
  } catch (error) {
    console.error('Failed to get knowledge stats:', error);
    return {
      totalEntries: 0,
      categories: [],
      recentUpdates: 0,
    };
  }
}

export default {
  searchKnowledge,
  searchKnowledgeByKeywords,
  getExternalData,
  getTrendingNews,
  getCryptoPrices,
  getCurrentWeather,
  buildKnowledgeContext,
  analyzeQueryContext,
  recordKnowledgeGap,
  getKnowledgeStats,
};
