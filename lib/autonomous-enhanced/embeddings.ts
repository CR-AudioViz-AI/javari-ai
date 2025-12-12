/**
 * Javari AI - Embeddings & Semantic Search
 * 
 * Uses OpenAI's text-embedding-3-small for semantic understanding.
 * Enables Javari to find relevant knowledge even with different wording.
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

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Limit to 8000 chars
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  try {
    const truncatedTexts = texts.map(t => t.substring(0, 8000));
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedTexts,
    });
    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('[Embeddings] Batch error:', error);
    return texts.map(() => null);
  }
}

/**
 * Semantic search in knowledge base
 */
export async function searchKnowledge(
  query: string,
  options: {
    threshold?: number;
    limit?: number;
    category?: string;
  } = {}
): Promise<any[]> {
  const { threshold = 0.7, limit = 5, category } = options;
  
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    console.warn('[Embeddings] Could not generate embedding, falling back to keyword search');
    return keywordSearch(query, limit, category);
  }

  try {
    // Use the search_knowledge function we created
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error('[Embeddings] Search error:', error);
      return keywordSearch(query, limit, category);
    }

    // Filter by category if specified
    if (category && data) {
      return data.filter((r: any) => r.category === category);
    }

    return data || [];
  } catch (error) {
    console.error('[Embeddings] Search failed:', error);
    return keywordSearch(query, limit, category);
  }
}

/**
 * Keyword-based fallback search
 */
export async function keywordSearch(
  query: string,
  limit: number = 5,
  category?: string
): Promise<any[]> {
  let queryBuilder = supabase
    .from('javari_knowledge')
    .select('id, category, subcategory, title, content, keywords, confidence_score')
    .textSearch('content', query.split(' ').join(' | '), { type: 'websearch' })
    .limit(limit);

  if (category) {
    queryBuilder = queryBuilder.eq('category', category);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('[Embeddings] Keyword search error:', error);
    return [];
  }

  return data || [];
}

/**
 * Hybrid search: combines semantic and keyword search
 */
export async function hybridSearch(
  query: string,
  options: {
    semanticWeight?: number;
    limit?: number;
    category?: string;
  } = {}
): Promise<any[]> {
  const { semanticWeight = 0.7, limit = 5, category } = options;

  const [semanticResults, keywordResults] = await Promise.all([
    searchKnowledge(query, { limit: limit * 2, category }),
    keywordSearch(query, limit * 2, category)
  ]);

  // Combine and deduplicate results
  const resultMap = new Map<string, any>();

  // Add semantic results with weight
  semanticResults.forEach((r, i) => {
    const score = (1 - i / semanticResults.length) * semanticWeight;
    resultMap.set(r.id, { ...r, hybrid_score: score });
  });

  // Add keyword results with remaining weight
  keywordResults.forEach((r, i) => {
    const keywordScore = (1 - i / keywordResults.length) * (1 - semanticWeight);
    if (resultMap.has(r.id)) {
      const existing = resultMap.get(r.id);
      existing.hybrid_score += keywordScore;
    } else {
      resultMap.set(r.id, { ...r, hybrid_score: keywordScore });
    }
  });

  // Sort by hybrid score and return top results
  return Array.from(resultMap.values())
    .sort((a, b) => b.hybrid_score - a.hybrid_score)
    .slice(0, limit);
}

/**
 * Update embedding for a specific knowledge entry
 */
export async function updateKnowledgeEmbedding(knowledgeId: string): Promise<boolean> {
  try {
    const { data: knowledge, error: fetchError } = await supabase
      .from('javari_knowledge')
      .select('title, content')
      .eq('id', knowledgeId)
      .single();

    if (fetchError || !knowledge) {
      console.error('[Embeddings] Could not fetch knowledge:', fetchError);
      return false;
    }

    const textToEmbed = `${knowledge.title}\n${knowledge.content}`;
    const embedding = await generateEmbedding(textToEmbed);

    if (!embedding) {
      return false;
    }

    const { error: updateError } = await supabase
      .from('javari_knowledge')
      .update({ embedding })
      .eq('id', knowledgeId);

    if (updateError) {
      console.error('[Embeddings] Update error:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Embeddings] updateKnowledgeEmbedding error:', error);
    return false;
  }
}

/**
 * Batch update all knowledge entries missing embeddings
 */
export async function updateAllMissingEmbeddings(): Promise<{ updated: number; failed: number }> {
  const { data: missingEmbeddings, error } = await supabase
    .from('javari_knowledge')
    .select('id, title, content')
    .is('embedding', null)
    .limit(100); // Process 100 at a time

  if (error || !missingEmbeddings) {
    console.error('[Embeddings] Could not fetch missing embeddings:', error);
    return { updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  // Process in batches of 10
  for (let i = 0; i < missingEmbeddings.length; i += 10) {
    const batch = missingEmbeddings.slice(i, i + 10);
    const texts = batch.map(k => `${k.title}\n${k.content}`);
    const embeddings = await generateEmbeddingsBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      if (embeddings[j]) {
        const { error: updateError } = await supabase
          .from('javari_knowledge')
          .update({ embedding: embeddings[j] })
          .eq('id', batch[j].id);

        if (updateError) {
          failed++;
        } else {
          updated++;
        }
      } else {
        failed++;
      }
    }
  }

  return { updated, failed };
}

/**
 * Search external data with embeddings
 */
export async function searchExternalData(
  query: string,
  options: {
    dataType?: string;
    limit?: number;
  } = {}
): Promise<any[]> {
  const { dataType, limit = 10 } = options;

  // For now, use keyword search on external data
  // Embeddings will be added as data is fetched
  let queryBuilder = supabase
    .from('javari_external_data')
    .select('*')
    .textSearch('content', query.split(' ').join(' | '), { type: 'websearch' })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (dataType) {
    queryBuilder = queryBuilder.eq('data_type', dataType);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('[Embeddings] External data search error:', error);
    return [];
  }

  return data || [];
}

/**
 * Get relevant context for a user query
 * Combines knowledge base and external data
 */
export async function getRelevantContext(
  query: string,
  options: {
    includeExternal?: boolean;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const { includeExternal = true, maxTokens = 2000 } = options;

  const [knowledgeResults, externalResults] = await Promise.all([
    hybridSearch(query, { limit: 3 }),
    includeExternal ? searchExternalData(query, { limit: 2 }) : Promise.resolve([])
  ]);

  let context = '';

  // Add knowledge base context
  if (knowledgeResults.length > 0) {
    context += '## From Knowledge Base:\n';
    for (const result of knowledgeResults) {
      context += `### ${result.title}\n${result.content}\n\n`;
    }
  }

  // Add external data context
  if (externalResults.length > 0) {
    context += '## Recent Information:\n';
    for (const result of externalResults) {
      context += `### ${result.title} (${result.source_name})\n${result.content?.substring(0, 500)}...\n\n`;
    }
  }

  // Truncate to max tokens (rough estimate: 4 chars per token)
  return context.substring(0, maxTokens * 4);
}
