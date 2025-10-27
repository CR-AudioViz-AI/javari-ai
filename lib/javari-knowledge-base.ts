/**
 * Javari AI Knowledge Base & Learning System
 * Enables Javari to learn from interactions and improve over time
 * 
 * @version 4.0.0
 * @last-updated 2025-10-27
 */

export interface KnowledgeEntry {
  id: string;
  category: 'faq' | 'troubleshooting' | 'workflow' | 'feature' | 'user_preference';
  question: string;
  answer: string;
  context?: string;
  tags: string[];
  confidence: number;
  useCount: number;
  successRate: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInteraction {
  id: string;
  userId: string;
  sessionId: string;
  query: string;
  response: string;
  wasHelpful: boolean | null;
  feedback?: string;
  toolsUsed: string[];
  functionsCall: string[];
  duration: number;
  timestamp: Date;
}

export interface LearningInsight {
  pattern: string;
  frequency: number;
  successRate: number;
  recommendation: string;
}

/**
 * Javari's Core Knowledge Base
 * Pre-populated with common questions and solutions
 */
export const CORE_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'kb_001',
    category: 'faq',
    question: 'How do I upgrade my subscription?',
    answer: 'You can upgrade your subscription by going to Settings > Billing > Change Plan. Choose your desired tier and confirm. The change takes effect immediately, and you\'ll be prorated for the current billing period.',
    context: 'billing, subscription, upgrade',
    tags: ['billing', 'subscription', 'upgrade', 'payment'],
    confidence: 0.95,
    useCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'kb_002',
    category: 'troubleshooting',
    question: 'Export is failing with error code 500',
    answer: 'Error 500 during export usually means: 1) File is too large for your plan, 2) Insufficient storage space, or 3) Temporary server issue. Try: reducing quality settings, freeing up storage, or waiting 5 minutes and trying again. If it persists, create a support ticket.',
    context: 'export, error, rendering',
    tags: ['export', 'error', 'error_500', 'rendering', 'troubleshooting'],
    confidence: 0.90,
    useCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'kb_003',
    category: 'workflow',
    question: 'Best workflow for creating podcast intros',
    answer: 'Recommended workflow: 1) Use AudioViz Studio to create base audio visualization, 2) Import into Video Editor Pro for additional graphics, 3) Add text overlays with Typography Tool, 4) Export in 1080p MP4. Pro tip: Save as template for future episodes!',
    context: 'podcast, audio, video, workflow',
    tags: ['podcast', 'workflow', 'audio', 'video', 'tutorial'],
    confidence: 0.85,
    useCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'kb_004',
    category: 'feature',
    question: 'What is batch processing and how do I use it?',
    answer: 'Batch processing lets you apply the same operation to multiple files at once. Access it via Tools > Batch Process. Select your files, choose the operation (e.g., resize, convert, enhance), configure settings, and click "Process All". Available on Pro tier and above.',
    context: 'batch, processing, automation',
    tags: ['batch', 'automation', 'pro_feature', 'efficiency'],
    confidence: 0.92,
    useCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'kb_005',
    category: 'troubleshooting',
    question: 'Video playback is choppy or laggy',
    answer: 'Choppy playback can be fixed by: 1) Lowering preview quality (Settings > Preview > Quality: Draft), 2) Clearing browser cache, 3) Closing other browser tabs, 4) Ensuring good internet connection, 5) Using Chrome or Edge for best performance. The final export will still be high quality.',
    context: 'video, playback, performance',
    tags: ['video', 'performance', 'playback', 'troubleshooting', 'browser'],
    confidence: 0.88,
    useCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * Knowledge Base Manager Class
 * Handles searching, learning, and updating knowledge
 */
export class JavariKnowledgeBase {
  private knowledge: KnowledgeEntry[] = [...CORE_KNOWLEDGE];
  private interactions: UserInteraction[] = [];

  /**
   * Search knowledge base for relevant entries
   */
  async search(query: string, category?: string, limit: number = 5): Promise<KnowledgeEntry[]> {
    const searchTerms = query.toLowerCase().split(' ');
    
    let results = this.knowledge
      .filter(entry => {
        // Filter by category if specified
        if (category && entry.category !== category) return false;
        
        // Check if query matches question, answer, or tags
        const questionMatch = searchTerms.some(term => 
          entry.question.toLowerCase().includes(term)
        );
        const answerMatch = searchTerms.some(term => 
          entry.answer.toLowerCase().includes(term)
        );
        const tagMatch = searchTerms.some(term => 
          entry.tags.some(tag => tag.includes(term))
        );
        
        return questionMatch || answerMatch || tagMatch;
      })
      .map(entry => ({
        ...entry,
        relevance: this.calculateRelevance(entry, searchTerms)
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return results;
  }

  /**
   * Calculate relevance score for a knowledge entry
   */
  private calculateRelevance(entry: KnowledgeEntry, searchTerms: string[]): number {
    let score = 0;
    
    // Question match (highest weight)
    searchTerms.forEach(term => {
      if (entry.question.toLowerCase().includes(term)) score += 3;
    });
    
    // Tag match (medium weight)
    searchTerms.forEach(term => {
      entry.tags.forEach(tag => {
        if (tag.includes(term)) score += 2;
      });
    });
    
    // Answer match (lower weight)
    searchTerms.forEach(term => {
      if (entry.answer.toLowerCase().includes(term)) score += 1;
    });
    
    // Boost by confidence and success rate
    score *= entry.confidence;
    score *= (1 + entry.successRate);
    
    // Slight boost for frequently used entries
    score += Math.log(entry.useCount + 1) * 0.1;
    
    return score;
  }

  /**
   * Record a new user interaction
   */
  async recordInteraction(interaction: Omit<UserInteraction, 'id' | 'timestamp'>): Promise<void> {
    const newInteraction: UserInteraction = {
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...interaction
    };
    
    this.interactions.push(newInteraction);
    
    // Store in database (Supabase)
    // await supabase.from('javari_interactions').insert(newInteraction);
  }

  /**
   * Learn from user feedback
   */
  async learnFromFeedback(interactionId: string, wasHelpful: boolean, feedback?: string): Promise<void> {
    const interaction = this.interactions.find(i => i.id === interactionId);
    if (!interaction) return;
    
    interaction.wasHelpful = wasHelpful;
    interaction.feedback = feedback;
    
    // Update related knowledge entries
    const relatedEntries = await this.search(interaction.query);
    relatedEntries.forEach(entry => {
      entry.useCount++;
      entry.lastUsed = new Date();
      
      if (wasHelpful) {
        entry.successRate = (entry.successRate * (entry.useCount - 1) + 1) / entry.useCount;
        entry.confidence = Math.min(0.99, entry.confidence + 0.01);
      } else {
        entry.successRate = (entry.successRate * (entry.useCount - 1)) / entry.useCount;
        entry.confidence = Math.max(0.50, entry.confidence - 0.02);
      }
      
      entry.updatedAt = new Date();
    });
    
    // If negative feedback with comment, create new learning opportunity
    if (!wasHelpful && feedback) {
      await this.createLearningOpportunity(interaction, feedback);
    }
  }

  /**
   * Create a new learning opportunity from negative feedback
   */
  private async createLearningOpportunity(
    interaction: UserInteraction, 
    feedback: string
  ): Promise<void> {
    // This could integrate with a human review system
    // For now, log it for later analysis
    const opportunity = {
      query: interaction.query,
      response: interaction.response,
      feedback,
      timestamp: new Date()
    };
    
    // Store for human review
    // await supabase.from('javari_learning_opportunities').insert(opportunity);
    
    console.log('Learning opportunity created:', opportunity);
  }

  /**
   * Add new knowledge entry (learned from interactions)
   */
  async addKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'useCount' | 'successRate' | 'createdAt' | 'updatedAt' | 'lastUsed'>): Promise<void> {
    const newEntry: KnowledgeEntry = {
      id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      useCount: 0,
      successRate: 0,
      lastUsed: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...entry
    };
    
    this.knowledge.push(newEntry);
    
    // Store in database
    // await supabase.from('javari_knowledge').insert(newEntry);
  }

  /**
   * Analyze interaction patterns to generate insights
   */
  async generateInsights(userId?: string): Promise<LearningInsight[]> {
    const interactions = userId 
      ? this.interactions.filter(i => i.userId === userId)
      : this.interactions;
    
    // Group by query patterns
    const patterns = new Map<string, { count: number; successful: number }>();
    
    interactions.forEach(interaction => {
      const key = interaction.query.toLowerCase().trim();
      const existing = patterns.get(key) || { count: 0, successful: 0 };
      existing.count++;
      if (interaction.wasHelpful) existing.successful++;
      patterns.set(key, existing);
    });
    
    // Convert to insights
    const insights: LearningInsight[] = Array.from(patterns.entries())
      .filter(([_, data]) => data.count >= 3) // Only patterns with 3+ occurrences
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        successRate: data.successful / data.count,
        recommendation: this.generateRecommendation(pattern, data)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    
    return insights;
  }

  /**
   * Generate recommendation based on pattern
   */
  private generateRecommendation(pattern: string, data: { count: number; successful: number }): string {
    const successRate = data.successful / data.count;
    
    if (successRate >= 0.8) {
      return 'High success rate - this response is working well, reinforce it';
    } else if (successRate >= 0.5) {
      return 'Moderate success - consider creating targeted documentation or tutorial';
    } else {
      return 'Low success rate - needs improvement or human expert input';
    }
  }

  /**
   * Get knowledge base statistics
   */
  getStats() {
    return {
      totalEntries: this.knowledge.length,
      totalInteractions: this.interactions.length,
      averageConfidence: this.knowledge.reduce((sum, e) => sum + e.confidence, 0) / this.knowledge.length,
      averageSuccessRate: this.knowledge.reduce((sum, e) => sum + e.successRate, 0) / this.knowledge.length,
      mostUsedEntry: this.knowledge.sort((a, b) => b.useCount - a.useCount)[0],
      recentInteractions: this.interactions.slice(-10)
    };
  }
}

// Export singleton instance
export const javariKB = new JavariKnowledgeBase();

/**
 * Helper function to integrate with chat API
 */
export async function enhanceResponseWithKnowledge(
  userQuery: string,
  context?: string
): Promise<{ knowledge: KnowledgeEntry[]; suggestions: string[] }> {
  const knowledge = await javariKB.search(userQuery, undefined, 3);
  
  const suggestions = knowledge
    .filter(k => k.confidence > 0.8)
    .map(k => k.answer)
    .slice(0, 2);
  
  return { knowledge, suggestions };
}
