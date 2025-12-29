// lib/javari-knowledge.ts
// Utilities for managing Javari's knowledge base
// Created: December 29, 2025

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// SYSTEM PROMPT MANAGEMENT
// ============================================

export interface SystemPrompt {
  name: string;
  description?: string;
  content: string;
  priority?: number;
  category?: 'identity' | 'rules' | 'knowledge' | 'context';
  isActive?: boolean;
}

/**
 * Add or update a system prompt
 */
export async function upsertSystemPrompt(prompt: SystemPrompt): Promise<boolean> {
  const { error } = await supabase
    .from('javari_system_prompts')
    .upsert({
      name: prompt.name,
      description: prompt.description,
      content: prompt.content,
      priority: prompt.priority || 100,
      category: prompt.category || 'knowledge',
      is_active: prompt.isActive ?? true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'name',
    });

  if (error) {
    console.error('Error upserting system prompt:', error);
    return false;
  }
  return true;
}

/**
 * Get all active system prompts
 */
export async function getActiveSystemPrompts(): Promise<SystemPrompt[]> {
  const { data, error } = await supabase
    .from('javari_system_prompts')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error fetching system prompts:', error);
    return [];
  }
  return data || [];
}

/**
 * Deactivate a system prompt
 */
export async function deactivateSystemPrompt(name: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_system_prompts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('name', name);

  return !error;
}

// ============================================
// KNOWLEDGE CHUNK MANAGEMENT (RAG)
// ============================================

export interface KnowledgeChunk {
  source: 'document' | 'conversation' | 'manual' | 'crawl';
  sourceId?: string;
  topic: string;
  subtopic?: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  confidenceScore?: number;
  expiresAt?: Date;
}

/**
 * Add a knowledge chunk with automatic embedding generation
 */
export async function addKnowledge(chunk: KnowledgeChunk): Promise<string | null> {
  try {
    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: `${chunk.title}\n${chunk.content}`,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    // Insert into database
    const { data, error } = await supabase
      .from('javari_knowledge_chunks')
      .insert({
        source: chunk.source,
        source_id: chunk.sourceId,
        topic: chunk.topic,
        subtopic: chunk.subtopic,
        title: chunk.title,
        content: chunk.content,
        embedding,
        metadata: chunk.metadata || {},
        confidence_score: chunk.confidenceScore || 1.0,
        expires_at: chunk.expiresAt?.toISOString(),
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error adding knowledge:', error);
      return null;
    }
    
    return data.id;
  } catch (err) {
    console.error('Error in addKnowledge:', err);
    return null;
  }
}

/**
 * Add multiple knowledge chunks in batch
 */
export async function addKnowledgeBatch(chunks: KnowledgeChunk[]): Promise<number> {
  let successCount = 0;
  
  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    
    const results = await Promise.all(
      batch.map(chunk => addKnowledge(chunk))
    );
    
    successCount += results.filter(id => id !== null).length;
    
    // Small delay between batches
    if (i + 10 < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return successCount;
}

/**
 * Search knowledge by semantic similarity
 */
export async function searchKnowledge(
  query: string,
  options: {
    topic?: string;
    threshold?: number;
    limit?: number;
  } = {}
): Promise<Array<{ id: string; title: string; content: string; similarity: number }>> {
  const { topic, threshold = 0.7, limit = 5 } = options;
  
  try {
    // Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Search using database function
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_topic: topic || null,
    });
    
    if (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in searchKnowledge:', err);
    return [];
  }
}

/**
 * Update a knowledge chunk
 */
export async function updateKnowledge(
  id: string,
  updates: Partial<KnowledgeChunk>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  if (updates.topic) updateData.topic = updates.topic;
  if (updates.subtopic) updateData.subtopic = updates.subtopic;
  if (updates.title) updateData.title = updates.title;
  if (updates.metadata) updateData.metadata = updates.metadata;
  if (updates.confidenceScore) updateData.confidence_score = updates.confidenceScore;
  
  // If content changed, regenerate embedding
  if (updates.content || updates.title) {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: `${updates.title || ''}\n${updates.content || ''}`,
    });
    updateData.embedding = embeddingResponse.data[0].embedding;
    if (updates.content) updateData.content = updates.content;
  }
  
  const { error } = await supabase
    .from('javari_knowledge_chunks')
    .update(updateData)
    .eq('id', id);
  
  return !error;
}

/**
 * Delete a knowledge chunk
 */
export async function deleteKnowledge(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_knowledge_chunks')
    .delete()
    .eq('id', id);
  
  return !error;
}

/**
 * Verify a knowledge chunk (mark as verified)
 */
export async function verifyKnowledge(id: string, verifiedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_knowledge_chunks')
    .update({
      is_verified: true,
      verified_by: verifiedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  
  return !error;
}

// ============================================
// BULK IMPORT UTILITIES
// ============================================

/**
 * Import knowledge from a markdown document
 * Splits by headers and creates chunks
 */
export async function importMarkdownKnowledge(
  markdown: string,
  source: string,
  baseTopic: string
): Promise<number> {
  // Split by ## headers
  const sections = markdown.split(/^## /gm).filter(s => s.trim());
  
  const chunks: KnowledgeChunk[] = sections.map(section => {
    const lines = section.split('\n');
    const title = lines[0]?.trim() || 'Untitled';
    const content = lines.slice(1).join('\n').trim();
    
    return {
      source: 'document' as const,
      sourceId: source,
      topic: baseTopic,
      title,
      content,
    };
  });
  
  return await addKnowledgeBatch(chunks);
}

/**
 * Import the Javari Knowledge Base document
 */
export async function importJavariKnowledgeBase(markdownContent: string): Promise<number> {
  // Split by # PART headers for major sections
  const parts = markdownContent.split(/^# PART /gm);
  
  const chunks: KnowledgeChunk[] = [];
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    // Get part title
    const partLines = part.split('\n');
    const partTitle = partLines[0]?.replace(/^\d+:\s*/, '').trim() || 'General';
    
    // Split part by ## subheaders
    const sections = part.split(/^## /gm).slice(1); // Skip the part header
    
    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0]?.trim() || 'Untitled';
      const content = lines.slice(1).join('\n').trim();
      
      if (content.length > 50) { // Only add substantial content
        chunks.push({
          source: 'document',
          sourceId: 'javari-knowledge-base-v1',
          topic: partTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          title: `${partTitle} - ${title}`,
          content,
          confidenceScore: 1.0,
        });
      }
    }
  }
  
  console.log(`Importing ${chunks.length} knowledge chunks...`);
  return await addKnowledgeBatch(chunks);
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get knowledge base statistics
 */
export async function getKnowledgeStats(): Promise<{
  totalChunks: number;
  verifiedChunks: number;
  topicBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
}> {
  const { data: chunks, error } = await supabase
    .from('javari_knowledge_chunks')
    .select('topic, source, is_verified');
  
  if (error || !chunks) {
    return {
      totalChunks: 0,
      verifiedChunks: 0,
      topicBreakdown: {},
      sourceBreakdown: {},
    };
  }
  
  const topicBreakdown: Record<string, number> = {};
  const sourceBreakdown: Record<string, number> = {};
  let verifiedCount = 0;
  
  for (const chunk of chunks) {
    topicBreakdown[chunk.topic] = (topicBreakdown[chunk.topic] || 0) + 1;
    sourceBreakdown[chunk.source] = (sourceBreakdown[chunk.source] || 0) + 1;
    if (chunk.is_verified) verifiedCount++;
  }
  
  return {
    totalChunks: chunks.length,
    verifiedChunks: verifiedCount,
    topicBreakdown,
    sourceBreakdown,
  };
}
