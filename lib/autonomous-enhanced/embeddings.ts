/**
 * Javari AI - Embeddings & Semantic Search System
 * Generates embeddings and enables semantic search across knowledge base
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

// Constants
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_MATCH_THRESHOLD = 0.7;
const DEFAULT_MATCH_COUNT = 5;

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

export interface SearchResult {
  id: string;
  category: string;
  subcategory?: string;
  title: string;
  content: string;
  keywords?: string[];
  confidence_score: number;
  similarity: number;
}

export interface HybridSearchResult {
  id: string;
  category: string;
  title: string;
  content: string;
  score: number;
}

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    // Clean and truncate text to avoid token limits
    const cleanedText = text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // ~2000 tokens max

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanedText,
    });

    return {
      embedding: response.data[0].embedding,
      tokens: response.usage.total_tokens,
      model: EMBEDDING_MODEL,
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<EmbeddingResult[]> {
  try {
    const cleanedTexts = texts.map(text =>
      text.replace(/\s+/g, ' ').trim().slice(0, 8000)
    );

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanedTexts,
    });

    return response.data.map((item, index) => ({
      embedding: item.embedding,
      tokens: Math.floor(response.usage.total_tokens / texts.length),
      model: EMBEDDING_MODEL,
    }));
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw error;
  }
}

/**
 * Semantic search in knowledge base
 */
export async function searchKnowledge(
  query: string,
  options: {
    matchThreshold?: number;
    matchCount?: number;
    category?: string;
  } = {}
): Promise<SearchResult[]> {
  const {
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
    matchCount = DEFAULT_MATCH_COUNT,
    category,
  } = options;

  try {
    // Generate embedding for query
    const { embedding } = await generateEmbedding(query);

    // Call the search_knowledge function in Supabase
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.error('Error searching knowledge:', error);
      // Fallback to keyword search
      return keywordSearch(query, matchCount, category);
    }

    // Filter by category if specified
    let results = data as SearchResult[];
    if (category) {
      results = results.filter(r => r.category === category);
    }

    return results;
  } catch (error) {
    console.error('Error in searchKnowledge:', error);
    // Fallback to keyword search
    return keywordSearch(query, matchCount, category);
  }
}

/**
 * Hybrid search (keyword + semantic)
 */
export async function hybridSearch(
  query: string,
  options: {
    limit?: number;
    category?: string;
  } = {}
): Promise<HybridSearchResult[]> {
  const { limit = 5, category } = options;

  try {
    // Generate embedding
    const { embedding } = await generateEmbedding(query);

    // Call hybrid search function
    const { data, error } = await supabase.rpc('hybrid_search_knowledge', {
      p_query: query,
      p_embedding: embedding,
      p_category: category,
      p_limit: limit,
    });

    if (error) {
      console.error('Hybrid search error:', error);
      return keywordSearch(query, limit, category);
    }

    return data as HybridSearchResult[];
  } catch (error) {
    console.error('Error in hybridSearch:', error);
    return keywordSearch(query, limit, category);
  }
}

/**
 * Keyword-only search (fallback)
 */
export async function keywordSearch(
  query: string,
  limit: number = 5,
  category?: string
): Promise<SearchResult[]> {
  try {
    let queryBuilder = supabase
      .from('javari_knowledge')
      .select('id, category, subcategory, title, content, keywords, confidence_score')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('confidence_score', { ascending: false })
      .limit(limit);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Keyword search error:', error);
      return [];
    }

    return (data || []).map(item => ({
      ...item,
      similarity: 0.5, // Default for keyword matches
    })) as SearchResult[];
  } catch (error) {
    console.error('Error in keywordSearch:', error);
    return [];
  }
}

/**
 * Update embedding for a knowledge entry
 */
export async function updateKnowledgeEmbedding(
  knowledgeId: string
): Promise<boolean> {
  try {
    // Fetch the knowledge entry
    const { data: entry, error: fetchError } = await supabase
      .from('javari_knowledge')
      .select('title, content')
      .eq('id', knowledgeId)
      .single();

    if (fetchError || !entry) {
      console.error('Error fetching knowledge entry:', fetchError);
      return false;
    }

    // Generate embedding from title + content
    const textToEmbed = `${entry.title}\n\n${entry.content}`;
    const { embedding } = await generateEmbedding(textToEmbed);

    // Update the entry with embedding
    const { error: updateError } = await supabase
      .from('javari_knowledge')
      .update({ embedding })
      .eq('id', knowledgeId);

    if (updateError) {
      console.error('Error updating embedding:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateKnowledgeEmbedding:', error);
    return false;
  }
}

/**
 * Batch update embeddings for all knowledge without embeddings
 */
export async function updateAllMissingEmbeddings(): Promise<{
  updated: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Fetch entries without embeddings
    const { data: entries, error } = await supabase
      .from('javari_knowledge')
      .select('id, title, content')
      .is('embedding', null)
      .limit(100);

    if (error || !entries) {
      result.errors.push(`Fetch error: ${error?.message}`);
      return result;
    }

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      // Generate texts for embedding
      const texts = batch.map(e => `${e.title}\n\n${e.content}`);
      
      try {
        // Generate batch embeddings
        const embeddings = await generateEmbeddingsBatch(texts);
        
        // Update each entry
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('javari_knowledge')
            .update({ embedding: embeddings[j].embedding })
            .eq('id', batch[j].id);

          if (updateError) {
            result.failed++;
            result.errors.push(`Update ${batch[j].id}: ${updateError.message}`);
          } else {
            result.updated++;
          }
        }
      } catch (batchError: any) {
        result.failed += batch.length;
        result.errors.push(`Batch error: ${batchError.message}`);
      }

      // Rate limit: wait between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return result;
  } catch (error: any) {
    result.errors.push(`General error: ${error.message}`);
    return result;
  }
}

/**
 * Search external data (news, financial, etc.)
 */
export async function searchExternalData(
  query: string,
  options: {
    dataType?: string;
    limit?: number;
  } = {}
): Promise<any[]> {
  const { dataType, limit = 10 } = options;

  try {
    const { embedding } = await generateEmbedding(query);

    let queryBuilder = supabase
      .from('javari_external_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (dataType) {
      queryBuilder = queryBuilder.eq('data_type', dataType);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('External data search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchExternalData:', error);
    return [];
  }
}

/**
 * Get relevant context for a query (combines knowledge + external data)
 */
export async function getRelevantContext(
  query: string,
  options: {
    maxKnowledge?: number;
    maxExternal?: number;
    includeExternal?: boolean;
  } = {}
): Promise<{
  knowledge: SearchResult[];
  external: any[];
  contextText: string;
}> {
  const {
    maxKnowledge = 3,
    maxExternal = 2,
    includeExternal = true,
  } = options;

  // Search knowledge base
  const knowledge = await hybridSearch(query, { limit: maxKnowledge });

  // Search external data if enabled
  const external = includeExternal
    ? await searchExternalData(query, { limit: maxExternal })
    : [];

  // Build context text
  let contextText = '';

  if (knowledge.length > 0) {
    contextText += '### Relevant Knowledge:\n';
    knowledge.forEach((k, i) => {
      contextText += `\n**${k.title}** (${k.category})\n${k.content}\n`;
    });
  }

  if (external.length > 0) {
    contextText += '\n### Recent Information:\n';
    external.forEach((e, i) => {
      contextText += `\n**${e.title}** (${e.data_type})\n${e.content}\n`;
    });
  }

  return {
    knowledge: knowledge as SearchResult[],
    external,
    contextText,
  };
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  searchKnowledge,
  hybridSearch,
  keywordSearch,
  updateKnowledgeEmbedding,
  updateAllMissingEmbeddings,
  searchExternalData,
  getRelevantContext,
};
