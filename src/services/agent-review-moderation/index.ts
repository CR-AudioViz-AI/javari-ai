```typescript
/**
 * Agent Review Moderation Service
 * Automated content moderation for marketplace reviews with AI analysis and human escalation
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';

/**
 * Review moderation status enumeration
 */
export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
  REQUIRES_HUMAN_REVIEW = 'requires_human_review'
}

/**
 * Toxicity severity levels
 */
export enum ToxicitySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  SEVERE = 'severe'
}

/**
 * Sentiment analysis result interface
 */
export interface SentimentAnalysis {
  score: number; // -1 to 1 (negative to positive)
  magnitude: number; // 0 to 1 (intensity)
  label: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  keywords: string[];
}

/**
 * Toxicity detection result interface
 */
export interface ToxicityDetection {
  isToxic: boolean;
  severity: ToxicitySeverity;
  confidence: number; // 0 to 1
  categories: string[];
  flaggedPhrases: string[];
}

/**
 * Review content to be moderated
 */
export interface ReviewContent {
  id: string;
  agentId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Moderation result interface
 */
export interface ModerationResult {
  reviewId: string;
  status: ModerationStatus;
  sentiment: SentimentAnalysis;
  toxicity: ToxicityDetection;
  riskScore: number; // 0 to 1 (low to high risk)
  autoDecision: boolean;
  reasons: string[];
  moderatedAt: Date;
  moderatorId?: string;
  escalationReason?: string;
}

/**
 * Escalation queue item interface
 */
export interface EscalationItem {
  id: string;
  reviewId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
  notes?: string;
}

/**
 * Moderation configuration interface
 */
export interface ModerationConfig {
  toxicityThreshold: number;
  sentimentThreshold: number;
  autoApproveThreshold: number;
  autoRejectThreshold: number;
  enableHumanEscalation: boolean;
  escalationRules: {
    highToxicity: boolean;
    extremeSentiment: boolean;
    lowConfidence: boolean;
    multipleFlags: boolean;
  };
}

/**
 * Default moderation configuration
 */
const DEFAULT_CONFIG: ModerationConfig = {
  toxicityThreshold: 0.7,
  sentimentThreshold: 0.8,
  autoApproveThreshold: 0.9,
  autoRejectThreshold: 0.8,
  enableHumanEscalation: true,
  escalationRules: {
    highToxicity: true,
    extremeSentiment: true,
    lowConfidence: true,
    multipleFlags: true
  }
};

/**
 * Agent Review Moderation Service
 * Provides automated content moderation with AI analysis and human escalation workflows
 */
export class AgentReviewModerationService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
  });
  
  private resend = new Resend(process.env.RESEND_API_KEY!);
  
  private config: ModerationConfig;

  constructor(config: Partial<ModerationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Moderate a review through the automated pipeline
   */
  async moderateReview(review: ReviewContent): Promise<ModerationResult> {
    try {
      // Perform parallel AI analysis
      const [sentiment, toxicity] = await Promise.all([
        this.analyzeSentiment(review.content),
        this.detectToxicity(review.content)
      ]);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(sentiment, toxicity);

      // Determine moderation status
      const status = this.determineStatus(riskScore, sentiment, toxicity);

      // Check if escalation is needed
      const needsEscalation = this.shouldEscalate(sentiment, toxicity, riskScore);

      const result: ModerationResult = {
        reviewId: review.id,
        status: needsEscalation ? ModerationStatus.ESCALATED : status,
        sentiment,
        toxicity,
        riskScore,
        autoDecision: !needsEscalation,
        reasons: this.generateReasons(sentiment, toxicity, riskScore),
        moderatedAt: new Date()
      };

      // Store moderation result
      await this.storeModerationResult(result);

      // Handle escalation if needed
      if (needsEscalation) {
        await this.escalateReview(review, result);
      }

      // Update review status
      await this.updateReviewStatus(review.id, result.status);

      // Log moderation action
      await this.logModerationAction(review.id, result);

      return result;

    } catch (error) {
      console.error('Error moderating review:', error);
      throw new Error(`Failed to moderate review: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform sentiment analysis on review content
   */
  private async analyzeSentiment(content: string): Promise<SentimentAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Analyze the sentiment of the following review content. Return a JSON response with:
            - score: number between -1 (very negative) and 1 (very positive)
            - magnitude: number between 0 and 1 indicating intensity
            - label: 'positive', 'negative', or 'neutral'
            - confidence: number between 0 and 1
            - keywords: array of significant words/phrases that influenced the sentiment`
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        score: analysis.score || 0,
        magnitude: analysis.magnitude || 0,
        label: analysis.label || 'neutral',
        confidence: analysis.confidence || 0,
        keywords: analysis.keywords || []
      };

    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return {
        score: 0,
        magnitude: 0,
        label: 'neutral',
        confidence: 0,
        keywords: []
      };
    }
  }

  /**
   * Detect toxicity in review content
   */
  private async detectToxicity(content: string): Promise<ToxicityDetection> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Analyze the following text for toxic content including harassment, hate speech, threats, profanity, spam, or inappropriate content. Return a JSON response with:
            - isToxic: boolean indicating if content is toxic
            - severity: 'low', 'medium', 'high', or 'severe'
            - confidence: number between 0 and 1
            - categories: array of toxicity categories found
            - flaggedPhrases: array of specific phrases that were flagged`
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const detection = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isToxic: detection.isToxic || false,
        severity: detection.severity || ToxicitySeverity.LOW,
        confidence: detection.confidence || 0,
        categories: detection.categories || [],
        flaggedPhrases: detection.flaggedPhrases || []
      };

    } catch (error) {
      console.error('Error detecting toxicity:', error);
      return {
        isToxic: false,
        severity: ToxicitySeverity.LOW,
        confidence: 0,
        categories: [],
        flaggedPhrases: []
      };
    }
  }

  /**
   * Calculate overall risk score based on sentiment and toxicity
   */
  private calculateRiskScore(sentiment: SentimentAnalysis, toxicity: ToxicityDetection): number {
    let riskScore = 0;

    // Toxicity contribution (0.6 weight)
    if (toxicity.isToxic) {
      const severityWeight = {
        [ToxicitySeverity.LOW]: 0.3,
        [ToxicitySeverity.MEDIUM]: 0.6,
        [ToxicitySeverity.HIGH]: 0.85,
        [ToxicitySeverity.SEVERE]: 1.0
      };
      riskScore += severityWeight[toxicity.severity] * toxicity.confidence * 0.6;
    }

    // Extreme sentiment contribution (0.2 weight)
    if (Math.abs(sentiment.score) > 0.8) {
      riskScore += (Math.abs(sentiment.score) - 0.8) * sentiment.magnitude * 0.2;
    }

    // Low confidence contribution (0.2 weight)
    const avgConfidence = (sentiment.confidence + toxicity.confidence) / 2;
    if (avgConfidence < 0.7) {
      riskScore += (0.7 - avgConfidence) * 0.2;
    }

    return Math.min(riskScore, 1);
  }

  /**
   * Determine moderation status based on analysis results
   */
  private determineStatus(
    riskScore: number,
    sentiment: SentimentAnalysis,
    toxicity: ToxicityDetection
  ): ModerationStatus {
    // Auto-reject for high toxicity or severe risk
    if (toxicity.isToxic && toxicity.severity === ToxicitySeverity.SEVERE) {
      return ModerationStatus.REJECTED;
    }

    if (riskScore >= this.config.autoRejectThreshold) {
      return ModerationStatus.REJECTED;
    }

    // Auto-approve for low risk
    if (riskScore <= (1 - this.config.autoApproveThreshold)) {
      return ModerationStatus.APPROVED;
    }

    // Default to requiring human review
    return ModerationStatus.REQUIRES_HUMAN_REVIEW;
  }

  /**
   * Check if review should be escalated to human moderators
   */
  private shouldEscalate(
    sentiment: SentimentAnalysis,
    toxicity: ToxicityDetection,
    riskScore: number
  ): boolean {
    if (!this.config.enableHumanEscalation) {
      return false;
    }

    const rules = this.config.escalationRules;

    // High toxicity escalation
    if (rules.highToxicity && toxicity.isToxic && 
        [ToxicitySeverity.HIGH, ToxicitySeverity.SEVERE].includes(toxicity.severity)) {
      return true;
    }

    // Extreme sentiment escalation
    if (rules.extremeSentiment && Math.abs(sentiment.score) > 0.9 && sentiment.magnitude > 0.8) {
      return true;
    }

    // Low confidence escalation
    if (rules.lowConfidence) {
      const avgConfidence = (sentiment.confidence + toxicity.confidence) / 2;
      if (avgConfidence < 0.6 && riskScore > 0.5) {
        return true;
      }
    }

    // Multiple flags escalation
    if (rules.multipleFlags) {
      const flagCount = [
        toxicity.isToxic,
        Math.abs(sentiment.score) > 0.7,
        riskScore > 0.6
      ].filter(Boolean).length;

      if (flagCount >= 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate human-readable reasons for moderation decision
   */
  private generateReasons(
    sentiment: SentimentAnalysis,
    toxicity: ToxicityDetection,
    riskScore: number
  ): string[] {
    const reasons: string[] = [];

    if (toxicity.isToxic) {
      reasons.push(`Toxic content detected (${toxicity.severity} severity)`);
      if (toxicity.categories.length > 0) {
        reasons.push(`Categories: ${toxicity.categories.join(', ')}`);
      }
    }

    if (Math.abs(sentiment.score) > 0.8) {
      const sentimentType = sentiment.score > 0 ? 'extremely positive' : 'extremely negative';
      reasons.push(`${sentimentType} sentiment detected`);
    }

    if (riskScore > 0.7) {
      reasons.push(`High risk score (${(riskScore * 100).toFixed(1)}%)`);
    }

    const avgConfidence = (sentiment.confidence + toxicity.confidence) / 2;
    if (avgConfidence < 0.6) {
      reasons.push(`Low confidence in analysis (${(avgConfidence * 100).toFixed(1)}%)`);
    }

    return reasons.length > 0 ? reasons : ['Review passed automated checks'];
  }

  /**
   * Escalate review to human moderation queue
   */
  private async escalateReview(review: ReviewContent, result: ModerationResult): Promise<void> {
    try {
      // Determine priority based on risk factors
      let priority: EscalationItem['priority'] = 'medium';
      
      if (result.toxicity.severity === ToxicitySeverity.SEVERE) {
        priority = 'urgent';
      } else if (result.riskScore > 0.8 || result.toxicity.severity === ToxicitySeverity.HIGH) {
        priority = 'high';
      } else if (result.riskScore < 0.4) {
        priority = 'low';
      }

      const escalationItem: Omit<EscalationItem, 'id'> = {
        reviewId: review.id,
        priority,
        reason: result.reasons.join('; '),
        createdAt: new Date()
      };

      // Add to escalation queue
      const { data, error } = await this.supabase
        .from('moderation_queue')
        .insert(escalationItem)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add to escalation queue: ${error.message}`);
      }

      // Send notification to moderators
      await this.notifyModerators(escalationItem, review);

    } catch (error) {
      console.error('Error escalating review:', error);
      throw error;
    }
  }

  /**
   * Store moderation result in database
   */
  private async storeModerationResult(result: ModerationResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('review_moderation')
        .insert({
          review_id: result.reviewId,
          status: result.status,
          sentiment_score: result.sentiment.score,
          sentiment_label: result.sentiment.label,
          sentiment_confidence: result.sentiment.confidence,
          toxicity_detected: result.toxicity.isToxic,
          toxicity_severity: result.toxicity.severity,
          toxicity_confidence: result.toxicity.confidence,
          risk_score: result.riskScore,
          auto_decision: result.autoDecision,
          reasons: result.reasons,
          moderated_at: result.moderatedAt.toISOString(),
          moderator_id: result.moderatorId,
          escalation_reason: result.escalationReason
        });

      if (error) {
        throw new Error(`Failed to store moderation result: ${error.message}`);
      }

    } catch (error) {
      console.error('Error storing moderation result:', error);
      throw error;
    }
  }

  /**
   * Update review status in the main reviews table
   */
  private async updateReviewStatus(reviewId: string, status: ModerationStatus): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('reviews')
        .update({
          moderation_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) {
        throw new Error(`Failed to update review status: ${error.message}`);
      }

    } catch (error) {
      console.error('Error updating review status:', error);
      throw error;
    }
  }

  /**
   * Log moderation action for audit trail
   */
  private async logModerationAction(reviewId: string, result: ModerationResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('moderation_actions')
        .insert({
          review_id: reviewId,
          action: result.status,
          automated: result.autoDecision,
          risk_score: result.riskScore,
          reasons: result.reasons,
          performed_at: new Date().toISOString(),
          performed_by: result.moderatorId || 'system'
        });

      if (error) {
        throw new Error(`Failed to log moderation action: ${error.message}`);
      }

    } catch (error) {
      console.error('Error logging moderation action:', error);
      // Don't throw here as this is just logging
    }
  }

  /**
   * Send notification to human moderators about escalated review
   */
  private async notifyModerators(escalation: Omit<EscalationItem, 'id'>, review: ReviewContent): Promise<void> {
    try {
      // Get moderator email addresses
      const { data: moderators } = await this.supabase
        .from('moderators')
        .select('email, name')
        .eq('active', true);

      if (!moderators || moderators.length === 0) {
        console.warn('No active moderators found for notification');
        return;
      }

      const subject = `Review Escalation - ${escalation.priority.toUpperCase()} Priority`;
      const html = `
        <h2>Review Escalated for Human Moderation</h2>
        <p><strong>Priority:</strong> ${escalation.priority.toUpperCase()}</p>
        <p><strong>Review ID:</strong> ${review.id}</p>
        <p><strong>Agent:</strong> ${review.agentId}</p>
        <p><strong>Reason:</strong> ${escalation.reason}</p>
        <p><strong>Review Content:</strong></p>
        <blockquote>${review.content}</blockquote>
        <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/moderation">View in Moderation Dashboard</a></p>
      `;

      // Send emails to all moderators
      await Promise.all(
        moderators.map(moderator =>
          this.resend.emails.send({
            from: 'moderation@craudioviz.com',
            to: moderator.email,
            subject,
            html
          })
        )
      );

    } catch (error) {
      console.error('Error notifying moderators:', error);
      // Don't throw here as notification failure shouldn't stop the escalation
    }
  }

  /**
   * Get moderation statistics for dashboard
   */
  async getModerationStats(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    total: number;
    approved: number;
    rejected: number;
    escalated: number;
    pending: number;
    averageRiskScore: number;
    toxicityRate: number;
  }> {
    try {
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const { data, error } = await this.supabase
        .from('review_moderation')
        .select('*')
        .gte('moderated_at', startDate.toISOString());

      if (error) {
        throw new Error(`Failed to get moderation stats: ${error.message}`);
      }

      const total = data.length;
      const approved = data.filter(r => r.status === ModerationStatus.APPROVED).length;
      const rejected = data.filter(r => r.status === ModerationStatus.REJECTED).length;
      const escalated = data.filter(r => r.status === ModerationStatus.ESCALATED).length;
      const pending = data.filter(r => r.status === ModerationStatus.PENDING).length;

      const averageRiskScore = total > 0 
        ? data.reduce((sum, r) => sum + (r.risk_score || 0), 0) / total 
        : 0;

      const toxicityRate = total > 0 
        ? data.filter(r => r.toxicity_detected).length / total 
        : 0;

      return {
        total,
        approved,
        rejected,
        escalated,
        pending,
        averageRiskScore,
        toxicityRate
      };

    } catch (error) {
      console.error('Error getting moderation stats:', error);
      throw error;
    }
  }

  /**
   * Get escalation queue items for moderation dashboard
   */
  async getEscalationQueue(limit: number = 50): Promise<EscalationItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('moderation_queue')
        .select(`
          *,
          reviews:review_id (
            id,
            title,
            content,
            rating,
            agent_id,
            user_id,
            created_at
          )
        `)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to