```typescript
/**
 * Agent Review Sentiment Analysis Module
 * Analyzes agent reviews using transformer models to categorize feedback
 * and identify improvement opportunities for agent creators.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Star, 
  MessageCircle,
  BarChart3,
  Lightbulb,
  Filter
} from 'lucide-react';

// Types and Interfaces
interface Review {
  id: string;
  agent_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
    disgust: number;
  };
  aspects: {
    performance: number;
    usability: number;
    features: number;
    support: number;
  };
}

interface ProcessedReview extends Review {
  sentiment_result: SentimentResult;
  processed_at: string;
}

interface SentimentAnalytics {
  agent_id: string;
  total_reviews: number;
  average_sentiment: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  common_themes: string[];
  improvement_areas: string[];
  trend_direction: 'improving' | 'declining' | 'stable';
  last_updated: string;
}

interface ImprovementSuggestion {
  category: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  actionable_steps: string[];
  impact_score: number;
}

interface HuggingFaceResponse {
  label: string;
  score: number;
}

interface NotificationPayload {
  agent_id: string;
  creator_id: string;
  type: 'improvement_alert' | 'sentiment_decline';
  message: string;
  suggestions: ImprovementSuggestion[];
}

// Configuration
const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models';
const SENTIMENT_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
const EMOTION_MODEL = 'j-hartmann/emotion-english-distilroberta-base';
const CACHE_TTL = 3600; // 1 hour
const BATCH_SIZE = 50;

/**
 * Core sentiment analysis engine using transformer models
 */
class SentimentAnalyzer {
  private huggingFaceToken: string;
  private redis: Redis;

  constructor(huggingFaceToken: string, redis: Redis) {
    this.huggingFaceToken = huggingFaceToken;
    this.redis = redis;
  }

  /**
   * Analyzes sentiment of a single review comment
   */
  async analyze(comment: string): Promise<SentimentResult> {
    try {
      const cacheKey = `sentiment:${this.hashString(comment)}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const [sentimentResponse, emotionResponse] = await Promise.all([
        this.callHuggingFace(SENTIMENT_MODEL, comment),
        this.callHuggingFace(EMOTION_MODEL, comment)
      ]);

      const result = this.processSentimentResponse(sentimentResponse, emotionResponse, comment);
      
      await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      
      return result;
    } catch (error) {
      throw new Error(`Sentiment analysis failed: ${error.message}`);
    }
  }

  /**
   * Calls Hugging Face API for model inference
   */
  private async callHuggingFace(model: string, text: string): Promise<HuggingFaceResponse[]> {
    const response = await fetch(`${HUGGING_FACE_API_URL}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.huggingFaceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        options: {
          wait_for_model: true
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Processes raw sentiment and emotion responses into structured result
   */
  private processSentimentResponse(
    sentimentData: HuggingFaceResponse[], 
    emotionData: HuggingFaceResponse[],
    comment: string
  ): SentimentResult {
    const sentimentMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
      'LABEL_0': 'negative',
      'LABEL_1': 'neutral', 
      'LABEL_2': 'positive',
      'NEGATIVE': 'negative',
      'NEUTRAL': 'neutral',
      'POSITIVE': 'positive'
    };

    const primarySentiment = sentimentData[0];
    const sentiment = sentimentMap[primarySentiment.label] || 'neutral';

    const emotions = {
      joy: 0,
      anger: 0,
      fear: 0,
      sadness: 0,
      surprise: 0,
      disgust: 0
    };

    emotionData.forEach(emotion => {
      const emotionKey = emotion.label.toLowerCase();
      if (emotions.hasOwnProperty(emotionKey)) {
        emotions[emotionKey as keyof typeof emotions] = emotion.score;
      }
    });

    const aspects = this.extractAspects(comment);

    return {
      sentiment,
      confidence: primarySentiment.score,
      emotions,
      aspects
    };
  }

  /**
   * Extracts aspect-based sentiment scores
   */
  private extractAspects(comment: string): { performance: number; usability: number; features: number; support: number; } {
    const lowerComment = comment.toLowerCase();
    
    const performanceKeywords = ['fast', 'slow', 'quick', 'performance', 'speed', 'efficient', 'lag'];
    const usabilityKeywords = ['easy', 'difficult', 'user-friendly', 'intuitive', 'confusing', 'simple'];
    const featureKeywords = ['feature', 'functionality', 'capability', 'tool', 'option'];
    const supportKeywords = ['support', 'help', 'documentation', 'guide', 'tutorial'];

    return {
      performance: this.calculateAspectScore(lowerComment, performanceKeywords),
      usability: this.calculateAspectScore(lowerComment, usabilityKeywords),
      features: this.calculateAspectScore(lowerComment, featureKeywords),
      support: this.calculateAspectScore(lowerComment, supportKeywords)
    };
  }

  /**
   * Calculates sentiment score for specific aspects
   */
  private calculateAspectScore(comment: string, keywords: string[]): number {
    let score = 0;
    let mentions = 0;

    keywords.forEach(keyword => {
      if (comment.includes(keyword)) {
        mentions++;
        // Simple heuristic based on surrounding words
        const index = comment.indexOf(keyword);
        const context = comment.substring(Math.max(0, index - 20), index + keyword.length + 20);
        
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'perfect', 'love'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible'];
        
        let contextScore = 0;
        positiveWords.forEach(word => {
          if (context.includes(word)) contextScore += 1;
        });
        negativeWords.forEach(word => {
          if (context.includes(word)) contextScore -= 1;
        });
        
        score += contextScore;
      }
    });

    return mentions > 0 ? Math.max(-1, Math.min(1, score / mentions)) : 0;
  }

  /**
   * Generates hash for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }
}

/**
 * Batch processor for review sentiment analysis
 */
class ReviewProcessor {
  private supabase: SupabaseClient;
  private analyzer: SentimentAnalyzer;
  private notificationService: NotificationService;

  constructor(supabase: SupabaseClient, analyzer: SentimentAnalyzer, notificationService: NotificationService) {
    this.supabase = supabase;
    this.analyzer = analyzer;
    this.notificationService = notificationService;
  }

  /**
   * Processes a batch of reviews for sentiment analysis
   */
  async processBatch(agentId?: string): Promise<ProcessedReview[]> {
    try {
      let query = this.supabase
        .from('agent_reviews')
        .select('*')
        .is('sentiment_result', null)
        .limit(BATCH_SIZE);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: reviews, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch reviews: ${error.message}`);
      }

      if (!reviews || reviews.length === 0) {
        return [];
      }

      const processedReviews: ProcessedReview[] = [];

      for (const review of reviews) {
        try {
          const sentimentResult = await this.analyzer.analyze(review.comment);
          
          const processedReview: ProcessedReview = {
            ...review,
            sentiment_result: sentimentResult,
            processed_at: new Date().toISOString()
          };

          // Update review with sentiment result
          const { error: updateError } = await this.supabase
            .from('agent_reviews')
            .update({
              sentiment_result: sentimentResult,
              processed_at: processedReview.processed_at
            })
            .eq('id', review.id);

          if (updateError) {
            console.error(`Failed to update review ${review.id}:`, updateError);
            continue;
          }

          processedReviews.push(processedReview);
        } catch (error) {
          console.error(`Failed to process review ${review.id}:`, error);
        }
      }

      // Update analytics after processing
      if (processedReviews.length > 0) {
        await this.updateAnalytics(processedReviews);
      }

      return processedReviews;
    } catch (error) {
      throw new Error(`Batch processing failed: ${error.message}`);
    }
  }

  /**
   * Updates sentiment analytics for affected agents
   */
  private async updateAnalytics(processedReviews: ProcessedReview[]): Promise<void> {
    const agentIds = [...new Set(processedReviews.map(r => r.agent_id))];

    for (const agentId of agentIds) {
      try {
        const analytics = await this.calculateAnalytics(agentId);
        
        const { error } = await this.supabase
          .from('agent_sentiment_analytics')
          .upsert(analytics, { onConflict: 'agent_id' });

        if (error) {
          console.error(`Failed to update analytics for agent ${agentId}:`, error);
        }

        // Check for improvement alerts
        await this.checkImprovementAlerts(agentId, analytics);
      } catch (error) {
        console.error(`Failed to calculate analytics for agent ${agentId}:`, error);
      }
    }
  }

  /**
   * Calculates comprehensive sentiment analytics for an agent
   */
  private async calculateAnalytics(agentId: string): Promise<SentimentAnalytics> {
    const { data: reviews, error } = await this.supabase
      .from('agent_reviews')
      .select('*')
      .eq('agent_id', agentId)
      .not('sentiment_result', 'is', null);

    if (error || !reviews) {
      throw new Error(`Failed to fetch reviews for analytics: ${error?.message}`);
    }

    const totalReviews = reviews.length;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let sentimentSum = 0;

    const themes: Record<string, number> = {};
    const improvementAreas: Record<string, number> = {};

    reviews.forEach(review => {
      const result = review.sentiment_result as SentimentResult;
      
      switch (result.sentiment) {
        case 'positive':
          positiveCount++;
          sentimentSum += 1;
          break;
        case 'negative':
          negativeCount++;
          sentimentSum -= 1;
          // Extract improvement areas from negative reviews
          this.extractImprovementAreas(review.comment, improvementAreas);
          break;
        case 'neutral':
          neutralCount++;
          break;
      }

      // Extract common themes
      this.extractThemes(review.comment, themes);
    });

    const averageSentiment = totalReviews > 0 ? sentimentSum / totalReviews : 0;
    const trendDirection = this.calculateTrendDirection(agentId, averageSentiment);

    return {
      agent_id: agentId,
      total_reviews: totalReviews,
      average_sentiment: averageSentiment,
      positive_count: positiveCount,
      negative_count: negativeCount,
      neutral_count: neutralCount,
      common_themes: Object.entries(themes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([theme]) => theme),
      improvement_areas: Object.entries(improvementAreas)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([area]) => area),
      trend_direction: trendDirection,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Extracts themes from review comments
   */
  private extractThemes(comment: string, themes: Record<string, number>): void {
    const words = comment.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'as', 'are', 'was', 'will', 'be']);
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
        themes[cleanWord] = (themes[cleanWord] || 0) + 1;
      }
    });
  }

  /**
   * Extracts improvement areas from negative comments
   */
  private extractImprovementAreas(comment: string, areas: Record<string, number>): void {
    const improvementKeywords = {
      'performance': ['slow', 'lag', 'performance', 'speed', 'timeout'],
      'usability': ['confusing', 'difficult', 'hard to use', 'complicated'],
      'features': ['missing', 'lack', 'need', 'should have', 'feature'],
      'support': ['help', 'documentation', 'support', 'guide', 'tutorial'],
      'bugs': ['bug', 'error', 'broken', 'crash', 'issue']
    };

    const lowerComment = comment.toLowerCase();
    
    Object.entries(improvementKeywords).forEach(([area, keywords]) => {
      if (keywords.some(keyword => lowerComment.includes(keyword))) {
        areas[area] = (areas[area] || 0) + 1;
      }
    });
  }

  /**
   * Calculates trend direction based on recent sentiment
   */
  private calculateTrendDirection(agentId: string, currentAverage: number): 'improving' | 'declining' | 'stable' {
    // This would compare with historical data - simplified implementation
    const threshold = 0.1;
    
    if (currentAverage > threshold) return 'improving';
    if (currentAverage < -threshold) return 'declining';
    return 'stable';
  }

  /**
   * Checks if improvement alerts should be sent
   */
  private async checkImprovementAlerts(agentId: string, analytics: SentimentAnalytics): Promise<void> {
    const alertThreshold = 0.3; // 30% negative sentiment
    const negativeRatio = analytics.negative_count / analytics.total_reviews;

    if (negativeRatio > alertThreshold || analytics.trend_direction === 'declining') {
      const suggestions = this.generateImprovementSuggestions(analytics);
      
      // Get agent creator ID
      const { data: agent } = await this.supabase
        .from('agents')
        .select('creator_id')
        .eq('id', agentId)
        .single();

      if (agent?.creator_id) {
        const notification: NotificationPayload = {
          agent_id: agentId,
          creator_id: agent.creator_id,
          type: analytics.trend_direction === 'declining' ? 'sentiment_decline' : 'improvement_alert',
          message: `Your agent has received ${Math.round(negativeRatio * 100)}% negative reviews. Here are some improvement suggestions.`,
          suggestions
        };

        await this.notificationService.sendNotification(notification);
      }
    }
  }

  /**
   * Generates improvement suggestions based on analytics
   */
  private generateImprovementSuggestions(analytics: SentimentAnalytics): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    analytics.improvement_areas.forEach((area, index) => {
      const priority: 'high' | 'medium' | 'low' = index === 0 ? 'high' : index === 1 ? 'medium' : 'low';
      
      const suggestionMap: Record<string, ImprovementSuggestion> = {
        performance: {
          category: 'Performance',
          priority,
          description: 'Users are experiencing performance issues with your agent',
          actionable_steps: [
            'Optimize your agent\'s response time',
            'Review and simplify complex operations',
            'Consider caching frequently used data',
            'Test your agent under various load conditions'
          ],
          impact_score: 0.8
        },
        usability: {
          category: 'User Experience',
          priority,
          description: 'Users find your agent difficult to use or confusing',
          actionable_steps: [
            'Simplify your agent\'s interface',
            'Add clear instructions and examples',
            'Improve error messages and guidance',
            'Conduct user testing sessions'
          ],
          impact_score: 0.9
        },
        features: {
          category: 'Features',
          priority,
          description: 'Users are requesting additional features or improvements',
          actionable_steps: [
            'Review common feature requests from users',
            'Prioritize high-impact feature additions',
            'Consider integrating with popular tools',
            'Survey users for specific needs'
          ],
          impact_score: 0.7
        },
        support: {
          category: 'Support & Documentation',
          priority,
          description: 'Users need better support and documentation',
          actionable_steps: [
            'Create comprehensive user guides',
            'Add FAQ section with common issues',
            'Provide video tutorials or demos',
            'Set up community support channels'
          ],
          impact_score: 0.6
        },
        bugs: {
          category: 'Quality & Reliability',
          priority: 'high',
          description: 'Users are reporting bugs and reliability issues',
          actionable_steps: [
            'Implement comprehensive testing',
            'Set up error monitoring and logging',
            'Create a bug reporting system',
            'Establish regular maintenance schedules'
          ],
          impact_score: 0.95
        }
      };

      if (suggestionMap[area]) {
        suggestions.push(suggestionMap[area]);
      }
    });

    return suggestions.sort((a, b) => b.impact_score - a.impact_score);
  }
}

/**
 * Notification service for improvement alerts
 */
class NotificationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Sends improvement notification to agent creator
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: payload.creator_id,
          type: payload.type,
          title: 'Agent Improvement Opportunity',
          message: payload.message,
          data: {
            agent_id: payload.agent_id,
            suggestions: payload.suggestions
          },
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to send notification: ${error.message}`);
      }

      // Also send real-time notification via Supabase realtime
      await this.supabase.channel('notifications')
        .send({
          type: 'broadcast',
          event: 'new_notification',
          payload: {
            user_id: payload.creator_id,
            notification: payload
          }
        });
    } catch (error) {
      console.error('Notification sending failed:', error);
    }
  }
}

/**
 * React component for displaying sentiment metrics dashboard
 */
const SentimentDashboard: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [analytics, setAnalytics] = useState<SentimentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchAnalytics();
  }, [agentId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data, error } =