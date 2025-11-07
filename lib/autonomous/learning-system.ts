/**
 * Javari AI - Continuous Learning System
 * Learns from admin dashboard, conversations, code generation, and web crawls
 * 
 * Created: November 4, 2025 - 6:50 PM EST
 * Part of Phase 2: Autonomous & Self-Healing Build
 */

interface LearningSource {
  type: 'admin_dashboard' | 'conversation' | 'code_generation' | 'web_crawl';
  data: any;
  timestamp: number;
}

interface Learning {
  id: string;
  questionPattern: string;
  answer: string;
  confidenceScore: number;
  usageCount: number;
  successRate: number;
  source: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface WebCrawlTarget {
  url: string;
  category: 'ai_news' | 'best_practices' | 'competitor' | 'grants';
  frequency: 'daily' | 'weekly' | 'monthly';
}

interface LearningConfig {
  supabaseUrl: string;
  supabaseKey: string;
  openaiApiKey: string;
  crawlTargets: WebCrawlTarget[];
}

export class ContinuousLearningSystem {
  private config: LearningConfig;

  constructor(config: LearningConfig) {
    this.config = config;
  }

  /**
   * Ingest learning from admin dashboard
   */
  async ingestFromDashboard(insight: {
    topic: string;
    content: string;
    importance: 'low' | 'medium' | 'high';
  }): Promise<boolean> {
    try {
      const embedding = await this.generateEmbedding(insight.content);

      const learning: Partial<Learning> = {
        id: crypto.randomUUID(),
        questionPattern: insight.topic,
        answer: insight.content,
        confidenceScore: insight.importance === 'high' ? 0.9 : insight.importance === 'medium' ? 0.7 : 0.5,
        usageCount: 0,
        successRate: 1.0,
        source: 'admin_dashboard',
        embedding,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.storeLearning(learning as Learning);
      return true;
    } catch (error: unknown) {
      logError(\'Error ingesting from dashboard:\', error);
      return false;
    }
  }

  /**
   * Learn from conversation patterns
   */
  async learnFromConversation(conversation: {
    question: string;
    answer: string;
    userFeedback?: 'positive' | 'negative';
    wasSuccessful: boolean;
  }): Promise<void> {
    try {
      // Extract patterns from successful conversations
      if (conversation.wasSuccessful) {
        const embedding = await this.generateEmbedding(conversation.question);

        // Check if similar pattern exists
        const existing = await this.findSimilarLearning(embedding);

        if (existing) {
          // Update existing learning
          existing.usageCount++;
          existing.successRate = (existing.successRate * (existing.usageCount - 1) + 1) / existing.usageCount;
          existing.updatedAt = new Date();
          await this.updateLearning(existing);
        } else {
          // Create new learning
          const learning: Partial<Learning> = {
            id: crypto.randomUUID(),
            questionPattern: conversation.question,
            answer: conversation.answer,
            confidenceScore: conversation.userFeedback === 'positive' ? 0.9 : 0.7,
            usageCount: 1,
            successRate: 1.0,
            source: 'conversation',
            embedding,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await this.storeLearning(learning as Learning);
        }
      } else {
        // Learn from failures too
        const antiPattern = {
          question: conversation.question,
          badAnswer: conversation.answer,
          reason: 'User indicated this was not helpful'
        };

        // Store anti-pattern for future reference
        await this.storeAntiPattern(antiPattern);
      }
    } catch (error: unknown) {
      logError(\'Error learning from conversation:\', error);
    }
  }

  /**
   * Learn from code generation results
   */
  async learnFromCodeGeneration(codeResult: {
    task: string;
    code: string;
    language: string;
    successful: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      if (codeResult.successful) {
        const pattern = `Generate ${codeResult.language} code for: ${codeResult.task}`;
        const embedding = await this.generateEmbedding(pattern);

        const learning: Partial<Learning> = {
          id: crypto.randomUUID(),
          questionPattern: pattern,
          answer: codeResult.code,
          confidenceScore: 0.8,
          usageCount: 1,
          successRate: 1.0,
          source: 'code_generation',
          embedding,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.storeLearning(learning as Learning);
      } else {
        // Learn from code failures
        await this.storeAntiPattern({
          question: `Generate ${codeResult.language} code for: ${codeResult.task}`,
          badAnswer: codeResult.code,
          reason: codeResult.errorMessage || 'Code generation failed'
        });
      }
    } catch (error: unknown) {
      logError(\'Error learning from code generation:\', error);
    }
  }

  /**
   * Automated web crawling for industry news and best practices
   */
  async performWebCrawl(target: WebCrawlTarget): Promise<void> {
    try {
      console.log(`🕷️ Crawling ${target.url} (${target.category})...`);

      // Fetch content (in real implementation, use web_fetch tool)
      // For now, this is a placeholder
      const content = await this.fetchWebContent(target.url);

      if (!content) {
        console.error(`Failed to fetch content from ${target.url}`);
        return;
      }

      // Summarize with AI
      const summary = await this.summarizeContent(content, target.category);

      // Generate embedding
      const embedding = await this.generateEmbedding(summary.title);

      // Store as learning
      const learning: Partial<Learning> = {
        id: crypto.randomUUID(),
        questionPattern: summary.title,
        answer: summary.content,
        confidenceScore: 0.75,
        usageCount: 0,
        successRate: 1.0,
        source: 'web_crawl',
        embedding,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.storeLearning(learning as Learning);
      console.log(`✅ Stored learning from ${target.url}`);
    } catch (error: unknown) {
      console.error(`Error crawling ${target.url}:`, error);
    }
  }

  /**
   * Run scheduled crawls
   */
  async runScheduledCrawls(): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    for (const target of this.config.crawlTargets) {
      let shouldCrawl = false;

      if (target.frequency === 'daily' && hour === 6) {
        // Daily crawls at 6 AM
        shouldCrawl = true;
      } else if (target.frequency === 'weekly' && dayOfWeek === 1 && hour === 6) {
        // Weekly crawls on Monday at 6 AM
        shouldCrawl = true;
      } else if (target.frequency === 'monthly' && dayOfMonth === 1 && hour === 6) {
        // Monthly crawls on 1st of month at 6 AM
        shouldCrawl = true;
      }

      if (shouldCrawl) {
        await this.performWebCrawl(target);
      }
    }
  }

  /**
   * Query learnings for relevant information
   */
  async queryLearnings(question: string, limit: number = 5): Promise<Learning[]> {
    try {
      // Generate embedding for question
      const questionEmbedding = await this.generateEmbedding(question);

      // Find similar learnings using vector similarity
      const similar = await this.findSimilarLearnings(questionEmbedding, limit);

      // Sort by confidence and usage
      return similar.sort((a, b) => {
        const scoreA = a.confidenceScore * (1 + Math.log(1 + a.usageCount));
        const scoreB = b.confidenceScore * (1 + Math.log(1 + b.usageCount));
        return scoreB - scoreA;
      });
    } catch (error: unknown) {
      logError(\'Error querying learnings:\', error);
      return [];
    }
  }

  /**
   * Generate text embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate embedding');
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error: unknown) {
      logError(\'Error generating embedding:\', error);
      return [];
    }
  }

  /**
   * Store learning in database
   */
  private async storeLearning(learning: Learning): Promise<void> {
    try {
      const response = await fetch(`${this.config.supabaseUrl}/rest/v1/javari_self_answers`, {
        method: 'POST',
        headers: {
          'apikey': this.config.supabaseKey,
          'Authorization': `Bearer ${this.config.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          id: learning.id,
          question_pattern: learning.questionPattern,
          answer: learning.answer,
          confidence_score: learning.confidenceScore,
          usage_count: learning.usageCount,
          success_rate: learning.successRate,
          source: learning.source,
          embedding: learning.embedding,
          created_at: learning.createdAt.toISOString(),
          updated_at: learning.updatedAt.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to store learning: ${response.statusText}`);
      }
    } catch (error: unknown) {
      logError(\'Error storing learning:\', error);
      throw error;
    }
  }

  /**
   * Update existing learning
   */
  private async updateLearning(learning: Learning): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.supabaseUrl}/rest/v1/javari_self_answers?id=eq.${learning.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': this.config.supabaseKey,
            'Authorization': `Bearer ${this.config.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            usage_count: learning.usageCount,
            success_rate: learning.successRate,
            updated_at: learning.updatedAt.toISOString()
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update learning: ${response.statusText}`);
      }
    } catch (error: unknown) {
      logError(\'Error updating learning:\', error);
      throw error;
    }
  }

  /**
   * Find similar learning by embedding
   */
  private async findSimilarLearning(embedding: number[]): Promise<Learning | null> {
    const results = await this.findSimilarLearnings(embedding, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find multiple similar learnings
   */
  private async findSimilarLearnings(embedding: number[], limit: number): Promise<Learning[]> {
    try {
      // Use Supabase vector similarity search
      // This requires pgvector extension
      const response = await fetch(
        `${this.config.supabaseUrl}/rest/v1/rpc/match_javari_learnings`,
        {
          method: 'POST',
          headers: {
            'apikey': this.config.supabaseKey,
            'Authorization': `Bearer ${this.config.supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: limit
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to find similar learnings: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((row: any) => ({
        id: row.id,
        questionPattern: row.question_pattern,
        answer: row.answer,
        confidenceScore: row.confidence_score,
        usageCount: row.usage_count,
        successRate: row.success_rate,
        source: row.source,
        embedding: row.embedding,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error: unknown) {
      logError(\'Error finding similar learnings:\', error);
      return [];
    }
  }

  /**
   * Store anti-pattern (things that didn't work)
   */
  private async storeAntiPattern(antiPattern: any): Promise<void> {
    // TODO: Implement anti-pattern storage
    // This helps Javari learn what NOT to do
    console.log('Storing anti-pattern:', antiPattern);
  }

  /**
   * Fetch web content (placeholder - use web_fetch in real implementation)
   */
  private async fetchWebContent(url: string): Promise<string | null> {
    // In real implementation, this would use the web_fetch tool
    // For now, return null
    return null;
  }

  /**
   * Summarize content using AI
   */
  private async summarizeContent(
    content: string,
    category: string
  ): Promise<{ title: string; content: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'Summarize the content in a concise, actionable format. Return JSON with "title" and "content" fields.'
            },
            {
              role: 'user',
              content: `Category: ${category}\n\nContent:\n${content.slice(0, 4000)}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error('Failed to summarize content');
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error: unknown) {
      logError(\'Error summarizing content:\', error);
      return {
        title: 'Summary unavailable',
        content: content.slice(0, 500)
      };
    }
  }

  /**
   * Get learning statistics
   */
  async getStatistics(): Promise<{
    total: number;
    bySource: Record<string, number>;
    avgConfidence: number;
    avgSuccessRate: number;
    topLearnings: Learning[];
  }> {
    try {
      const response = await fetch(
        `${this.config.supabaseUrl}/rest/v1/javari_self_answers?select=*`,
        {
          headers: {
            'apikey': this.config.supabaseKey,
            'Authorization': `Bearer ${this.config.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get statistics');
      }

      const learnings: Learning[] = await response.json();

      const bySource = learnings.reduce((acc, l) => {
        acc[l.source] = (acc[l.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const avgConfidence = learnings.reduce((sum, l) => sum + l.confidenceScore, 0) / learnings.length || 0;
      const avgSuccessRate = learnings.reduce((sum, l) => sum + l.successRate, 0) / learnings.length || 0;

      const topLearnings = learnings
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      return {
        total: learnings.length,
        bySource,
        avgConfidence,
        avgSuccessRate,
        topLearnings
      };
    } catch (error: unknown) {
      logError(\'Error getting statistics:\', error);
      return {
        total: 0,
        bySource: {},
        avgConfidence: 0,
        avgSuccessRate: 0,
        topLearnings: []
      };
    }
  }
}

// Export factory function
export function createLearningSystem(config: LearningConfig): ContinuousLearningSystem {
  return new ContinuousLearningSystem(config);
}
