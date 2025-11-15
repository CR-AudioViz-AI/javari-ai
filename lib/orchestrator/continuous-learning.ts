/**
 * Javari AI Continuous Learning System
 * Enables Javari to learn from every interaction and improve over time
 * 
 * @version 1.0.0
 * @created 2025-11-14
 * @author CR AudioViz AI, LLC
 */

import { createClient } from '@/lib/supabase/client';
import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export interface LearningEvent {
  type: 'build' | 'conversation' | 'feedback' | 'error';
  source: string;
  content: string;
  metadata?: Record<string, any>;
  quality?: number; // 0-1 score
}

export interface KnowledgeItem {
  source_type: string;
  source_url?: string;
  source_title?: string;
  content: string;
  content_type: string;
  language?: string;
  framework?: string;
  topic?: string;
  keywords: string[];
  embedding?: number[];
}

// ============================================================================
// LEARNING SYSTEM
// ============================================================================

export class ContinuousLearningSystem {
  private supabase: ReturnType<typeof createClient>;
  private openai?: OpenAI;

  constructor(openaiApiKey?: string) {
    this.supabase = createClient();
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Process a learning event
   */
  async processEvent(event: LearningEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'build':
          await this.learnFromBuild(event);
          break;
        case 'conversation':
          await this.learnFromConversation(event);
          break;
        case 'feedback':
          await this.learnFromFeedback(event);
          break;
        case 'error':
          await this.learnFromError(event);
          break;
      }
    } catch (error) {
      console.error('Failed to process learning event:', error);
    }
  }

  /**
   * Learn from successful build
   */
  private async learnFromBuild(event: LearningEvent): Promise<void> {
    // Extract learnings from build event
    const knowledge = await this.extractKnowledge(event.content);
    
    if (knowledge) {
      await this.storeKnowledge(knowledge);
    }
  }

  /**
   * Learn from conversation
   */
  private async learnFromConversation(event: LearningEvent): Promise<void> {
    // Extract useful patterns, questions, and answers from conversation
    const patterns = await this.extractConversationPatterns(event.content);
    
    for (const pattern of patterns) {
      await this.storeKnowledge({
        source_type: 'conversation',
        source_title: 'User Interaction',
        content: pattern.content,
        content_type: pattern.type,
        topic: pattern.topic,
        keywords: pattern.keywords
      });
    }
  }

  /**
   * Learn from user feedback
   */
  private async learnFromFeedback(event: LearningEvent): Promise<void> {
    // Update quality scores based on feedback
    if (event.metadata?.buildId) {
      await this.updateQualityScores(event.metadata.buildId, event.quality || 0.5);
    }
  }

  /**
   * Learn from errors
   */
  private async learnFromError(event: LearningEvent): Promise<void> {
    // Store error patterns to avoid in future
    await this.storeKnowledge({
      source_type: 'error_pattern',
      source_title: 'Common Error',
      content: event.content,
      content_type: 'error',
      topic: 'debugging',
      keywords: this.extractKeywords(event.content)
    });
  }

  /**
   * Extract knowledge from content using AI
   */
  private async extractKnowledge(content: string): Promise<KnowledgeItem | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract key learnings from this content. Return JSON with: language, framework, topic, keywords (array), summary.'
          },
          {
            role: 'user',
            content
          }
        ],
        response_format: { type: 'json_object' }
      });

      const extracted = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        source_type: 'build',
        content: extracted.summary || content.slice(0, 500),
        content_type: 'code',
        language: extracted.language,
        framework: extracted.framework,
        topic: extracted.topic,
        keywords: extracted.keywords || []
      };
    } catch (error) {
      console.error('Failed to extract knowledge:', error);
      return null;
    }
  }

  /**
   * Extract conversation patterns
   */
  private async extractConversationPatterns(content: string): Promise<Array<{
    content: string;
    type: string;
    topic: string;
    keywords: string[];
  }>> {
    // Simple pattern extraction (can be enhanced with AI)
    const keywords = this.extractKeywords(content);
    const topic = keywords[0] || 'general';

    return [{
      content: content.slice(0, 500),
      type: 'conversation',
      topic,
      keywords
    }];
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Remove duplicates and common words
    const commonWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could']);
    const unique = [...new Set(words)].filter(word => !commonWords.has(word));

    return unique.slice(0, 10);
  }

  /**
   * Store knowledge in database
   */
  private async storeKnowledge(knowledge: KnowledgeItem): Promise<void> {
    try {
      // Generate embedding if OpenAI available
      let embedding: number[] | undefined;
      if (this.openai) {
        try {
          const embeddingResponse = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: knowledge.content
          });
          embedding = embeddingResponse.data[0]?.embedding;
        } catch (error) {
          console.error('Failed to generate embedding:', error);
        }
      }

      await this.supabase.from('javari_knowledge_base').insert({
        source_type: knowledge.source_type,
        source_url: knowledge.source_url,
        source_title: knowledge.source_title,
        content: knowledge.content,
        content_type: knowledge.content_type,
        language: knowledge.language,
        framework: knowledge.framework,
        topic: knowledge.topic,
        keywords: knowledge.keywords,
        embedding: embedding,
        quality_score: 0.5
      });
    } catch (error) {
      console.error('Failed to store knowledge:', error);
    }
  }

  /**
   * Update quality scores based on feedback
   */
  private async updateQualityScores(buildId: string, rating: number): Promise<void> {
    try {
      // Get build details
      const { data: build } = await this.supabase
        .from('javari_builds')
        .select('*')
        .eq('id', buildId)
        .single();

      if (!build) return;

      // Update related knowledge quality scores
      const keywords = this.extractKeywords(build.description);

      await this.supabase
        .from('javari_knowledge_base')
        .update({
          usage_count: this.supabase.rpc('increment_usage'),
          success_rate: this.supabase.rpc('update_success_rate', { rating })
        })
        .in('keywords', keywords);
    } catch (error) {
      console.error('Failed to update quality scores:', error);
    }
  }

  /**
   * Query knowledge base
   */
  async queryKnowledge(query: string, limit: number = 10): Promise<Array<{
    content: string;
    topic: string;
    quality_score: number;
  }>> {
    try {
      // Generate query embedding
      let embedding: number[] | undefined;
      if (this.openai) {
        const embeddingResponse = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query
        });
        embedding = embeddingResponse.data[0]?.embedding;
      }

      let queryBuilder = this.supabase
        .from('javari_knowledge_base')
        .select('content, topic, quality_score');

      // Use vector similarity if embedding available
      if (embedding) {
        // This requires pgvector extension
        // queryBuilder = queryBuilder.rpc('match_knowledge', { 
        //   query_embedding: embedding, 
        //   match_threshold: 0.7,
        //   match_count: limit 
        // });
      } else {
        // Fallback to keyword search
        const keywords = this.extractKeywords(query);
        queryBuilder = queryBuilder
          .contains('keywords', keywords)
          .order('quality_score', { ascending: false })
          .limit(limit);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to query knowledge:', error);
      return [];
    }
  }

  /**
   * Get learning statistics
   */
  async getStatistics(): Promise<{
    totalKnowledge: number;
    byTopic: Record<string, number>;
    avgQuality: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('javari_knowledge_base')
        .select('topic, quality_score');

      if (error) throw error;

      const byTopic: Record<string, number> = {};
      let totalQuality = 0;

      for (const item of data || []) {
        if (item.topic) {
          byTopic[item.topic] = (byTopic[item.topic] || 0) + 1;
        }
        totalQuality += item.quality_score || 0;
      }

      return {
        totalKnowledge: data?.length || 0,
        byTopic,
        avgQuality: data?.length ? totalQuality / data.length : 0
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalKnowledge: 0,
        byTopic: {},
        avgQuality: 0
      };
    }
  }
}

// ============================================================================
// WEB CRAWLER FOR KNOWLEDGE ACQUISITION
// ============================================================================

export class KnowledgeCrawler {
  private learningSystem: ContinuousLearningSystem;

  constructor(learningSystem: ContinuousLearningSystem) {
    this.learningSystem = learningSystem;
  }

  /**
   * Crawl documentation site
   */
  async crawlDocumentation(url: string, maxPages: number = 100): Promise<void> {
    // Implementation would use headless browser or API
    console.log(`Would crawl ${url} for up to ${maxPages} pages`);
  }

  /**
   * Monitor RSS feeds for latest tech news
   */
  async monitorRSSFeeds(feeds: string[]): Promise<void> {
    // Implementation would check RSS feeds regularly
    console.log(`Would monitor ${feeds.length} RSS feeds`);
  }

  /**
   * Import from GitHub repositories
   */
  async importFromGitHub(repo: string): Promise<void> {
    // Implementation would analyze GitHub repo code and docs
    console.log(`Would import knowledge from ${repo}`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ContinuousLearningSystem, KnowledgeCrawler };
export default ContinuousLearningSystem;
