import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';
import { EventEmitter } from 'events';

/**
 * Content types that can be moderated
 */
export enum ContentType {
  TEXT = 'text',
  AUDIO = 'audio',
  IMAGE = 'image',
  VIDEO = 'video',
  COMMENT = 'comment',
  POST = 'post',
  MESSAGE = 'message'
}

/**
 * Moderation risk levels
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Moderation actions that can be taken
 */
export enum ModerationAction {
  APPROVE = 'approve',
  FLAG = 'flag',
  HIDE = 'hide',
  REMOVE = 'remove',
  BAN_USER = 'ban_user',
  SUSPEND_USER = 'suspend_user',
  REQUIRE_EDIT = 'require_edit'
}

/**
 * Status of moderation decisions
 */
export enum ModerationStatus {
  PENDING = 'pending',
  AUTO_APPROVED = 'auto_approved',
  AUTO_FLAGGED = 'auto_flagged',
  HUMAN_REVIEW = 'human_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  APPEALED = 'appealed',
  APPEAL_APPROVED = 'appeal_approved',
  APPEAL_REJECTED = 'appeal_rejected'
}

/**
 * Types of content violations
 */
export enum ViolationType {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  MISINFORMATION = 'misinformation',
  ADULT_CONTENT = 'adult_content',
  VIOLENCE = 'violence',
  COPYRIGHT = 'copyright',
  PRIVACY = 'privacy',
  OTHER = 'other'
}

/**
 * Content to be moderated
 */
export interface ContentSubmission {
  id: string;
  type: ContentType;
  content: string;
  authorId: string;
  metadata?: {
    url?: string;
    title?: string;
    description?: string;
    tags?: string[];
    parentId?: string;
  };
  timestamp: Date;
  source: string;
}

/**
 * ML model analysis result
 */
export interface MLAnalysisResult {
  modelName: string;
  version: string;
  confidence: number;
  predictions: {
    violationType: ViolationType;
    probability: number;
    evidence: string[];
  }[];
  toxicityScore: number;
  spamScore: number;
  misinformationScore: number;
  overallRisk: RiskLevel;
  processingTime: number;
}

/**
 * Human review decision
 */
export interface HumanReviewDecision {
  reviewerId: string;
  reviewerName: string;
  decision: ModerationAction;
  reasoning: string;
  confidence: number;
  timestamp: Date;
  timeSpent: number;
  violationTypes: ViolationType[];
  notes?: string;
}

/**
 * Moderation result
 */
export interface ModerationResult {
  contentId: string;
  status: ModerationStatus;
  action: ModerationAction;
  riskLevel: RiskLevel;
  violationTypes: ViolationType[];
  mlAnalysis: MLAnalysisResult;
  humanReview?: HumanReviewDecision;
  confidence: number;
  reasoning: string;
  timestamp: Date;
  expiresAt?: Date;
  appealEligible: boolean;
  appealDeadline?: Date;
}

/**
 * Appeal submission
 */
export interface AppealSubmission {
  id: string;
  contentId: string;
  userId: string;
  reason: string;
  evidence?: string[];
  timestamp: Date;
  priority: 'normal' | 'high' | 'urgent';
}

/**
 * Appeal decision
 */
export interface AppealDecision {
  appealId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'partial';
  reasoning: string;
  newAction?: ModerationAction;
  timestamp: Date;
  finalDecision: boolean;
}

/**
 * Moderation configuration
 */
export interface ModerationConfig {
  autoApproveThreshold: number;
  humanReviewThreshold: number;
  autoRejectThreshold: number;
  appealWindow: number; // hours
  enabledModels: string[];
  contentTypeSettings: {
    [key in ContentType]: {
      enabled: boolean;
      strictness: 'low' | 'medium' | 'high';
      requireHumanReview: boolean;
    };
  };
  violationWeights: {
    [key in ViolationType]: number;
  };
}

/**
 * Moderation metrics
 */
export interface ModerationMetrics {
  totalProcessed: number;
  autoApproved: number;
  autoRejected: number;
  humanReviewed: number;
  appealed: number;
  accuracyRate: number;
  averageProcessingTime: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  topViolationTypes: { type: ViolationType; count: number }[];
}

/**
 * ML Model interface for content analysis
 */
interface MLModelInterface {
  name: string;
  version: string;
  analyze(content: string, type: ContentType): Promise<MLAnalysisResult>;
  isHealthy(): Promise<boolean>;
  getModelInfo(): { name: string; version: string; capabilities: string[] };
}

/**
 * OpenAI-based content analysis model
 */
class OpenAIContentModel implements MLModelInterface {
  name = 'openai-gpt4';
  version = '4.0';

  constructor(private openai: OpenAI) {}

  async analyze(content: string, type: ContentType): Promise<MLAnalysisResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a content moderation AI. Analyze the following ${type} content for violations. 
            Return a JSON response with toxicityScore (0-1), spamScore (0-1), misinformationScore (0-1), 
            and predictions array with violationType, probability, and evidence.`
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      const processingTime = Date.now() - startTime;

      return {
        modelName: this.name,
        version: this.version,
        confidence: analysis.confidence || 0.8,
        predictions: analysis.predictions || [],
        toxicityScore: analysis.toxicityScore || 0,
        spamScore: analysis.spamScore || 0,
        misinformationScore: analysis.misinformationScore || 0,
        overallRisk: this.calculateRisk(analysis),
        processingTime
      };
    } catch (error) {
      throw new Error(`OpenAI analysis failed: ${error}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch {
      return false;
    }
  }

  getModelInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: ['toxicity', 'spam', 'misinformation', 'harassment']
    };
  }

  private calculateRisk(analysis: any): RiskLevel {
    const maxScore = Math.max(
      analysis.toxicityScore || 0,
      analysis.spamScore || 0,
      analysis.misinformationScore || 0
    );

    if (maxScore >= 0.8) return RiskLevel.CRITICAL;
    if (maxScore >= 0.6) return RiskLevel.HIGH;
    if (maxScore >= 0.3) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

/**
 * Perspective API model for toxicity detection
 */
class PerspectiveAPIModel implements MLModelInterface {
  name = 'perspective-api';
  version = '1.0';

  constructor(private apiKey: string) {}

  async analyze(content: string, type: ContentType): Promise<MLAnalysisResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              IDENTITY_ATTACK: {},
              INSULT: {},
              PROFANITY: {},
              THREAT: {}
            },
            comment: { text: content },
            languages: ['en']
          })
        }
      );

      const data = await response.json();
      const scores = data.attributeScores;
      const processingTime = Date.now() - startTime;

      const toxicityScore = scores.TOXICITY?.summaryScore?.value || 0;
      
      return {
        modelName: this.name,
        version: this.version,
        confidence: 0.9,
        predictions: this.buildPredictions(scores),
        toxicityScore,
        spamScore: 0,
        misinformationScore: 0,
        overallRisk: this.calculateRisk(toxicityScore),
        processingTime
      };
    } catch (error) {
      throw new Error(`Perspective API analysis failed: ${error}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestedAttributes: { TOXICITY: {} },
            comment: { text: 'test' }
          })
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getModelInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: ['toxicity', 'harassment', 'hate_speech']
    };
  }

  private buildPredictions(scores: any) {
    const predictions = [];
    
    if (scores.TOXICITY?.summaryScore?.value > 0.7) {
      predictions.push({
        violationType: ViolationType.HARASSMENT,
        probability: scores.TOXICITY.summaryScore.value,
        evidence: ['High toxicity score detected']
      });
    }

    if (scores.IDENTITY_ATTACK?.summaryScore?.value > 0.7) {
      predictions.push({
        violationType: ViolationType.HATE_SPEECH,
        probability: scores.IDENTITY_ATTACK.summaryScore.value,
        evidence: ['Identity attack detected']
      });
    }

    return predictions;
  }

  private calculateRisk(toxicityScore: number): RiskLevel {
    if (toxicityScore >= 0.8) return RiskLevel.CRITICAL;
    if (toxicityScore >= 0.6) return RiskLevel.HIGH;
    if (toxicityScore >= 0.3) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

/**
 * Human review queue manager
 */
class HumanReviewQueue extends EventEmitter {
  private reviewQueue: Map<string, ContentSubmission> = new Map();
  private priorityQueue: ContentSubmission[] = [];

  constructor(private supabase: SupabaseClient) {
    super();
  }

  /**
   * Add content to human review queue
   */
  async addToQueue(
    content: ContentSubmission,
    mlResult: MLAnalysisResult,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('moderation_queue')
        .insert({
          content_id: content.id,
          content_type: content.type,
          content_data: content.content,
          author_id: content.authorId,
          ml_analysis: mlResult,
          priority,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      this.reviewQueue.set(content.id, content);
      
      if (priority === 'high' || mlResult.overallRisk === RiskLevel.CRITICAL) {
        this.priorityQueue.unshift(content);
      } else {
        this.priorityQueue.push(content);
      }

      this.emit('contentQueued', { contentId: content.id, priority });
    } catch (error) {
      throw new Error(`Failed to add content to review queue: ${error}`);
    }
  }

  /**
   * Get next item for human review
   */
  async getNextForReview(reviewerId: string): Promise<ContentSubmission | null> {
    if (this.priorityQueue.length === 0) {
      await this.refreshQueue();
    }

    const content = this.priorityQueue.shift();
    if (!content) return null;

    // Assign to reviewer
    await this.supabase
      .from('moderation_queue')
      .update({
        reviewer_id: reviewerId,
        status: 'in_review',
        review_started_at: new Date().toISOString()
      })
      .eq('content_id', content.id);

    return content;
  }

  /**
   * Submit human review decision
   */
  async submitReview(
    contentId: string,
    decision: HumanReviewDecision
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('moderation_queue')
        .update({
          status: 'completed',
          decision: decision.decision,
          reasoning: decision.reasoning,
          reviewer_confidence: decision.confidence,
          violation_types: decision.violationTypes,
          completed_at: new Date().toISOString(),
          time_spent: decision.timeSpent
        })
        .eq('content_id', contentId);

      if (error) throw error;

      this.reviewQueue.delete(contentId);
      this.emit('reviewCompleted', { contentId, decision });
    } catch (error) {
      throw new Error(`Failed to submit review: ${error}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    inReview: number;
    highPriority: number;
    averageWaitTime: number;
  }> {
    const { data, error } = await this.supabase
      .from('moderation_queue')
      .select('status, priority, created_at')
      .in('status', ['pending', 'in_review']);

    if (error) throw error;

    const stats = {
      pending: 0,
      inReview: 0,
      highPriority: 0,
      averageWaitTime: 0
    };

    let totalWaitTime = 0;
    const now = new Date();

    data?.forEach(item => {
      if (item.status === 'pending') {
        stats.pending++;
        if (item.priority === 'high') stats.highPriority++;
        totalWaitTime += now.getTime() - new Date(item.created_at).getTime();
      } else if (item.status === 'in_review') {
        stats.inReview++;
      }
    });

    if (stats.pending > 0) {
      stats.averageWaitTime = totalWaitTime / stats.pending / (1000 * 60); // minutes
    }

    return stats;
  }

  private async refreshQueue(): Promise<void> {
    const { data, error } = await this.supabase
      .from('moderation_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    this.priorityQueue = data?.map(item => ({
      id: item.content_id,
      type: item.content_type,
      content: item.content_data,
      authorId: item.author_id,
      timestamp: new Date(item.created_at),
      source: 'queue_refresh'
    })) || [];
  }
}

/**
 * Appeal processor for handling moderation appeals
 */
class AppealProcessor extends EventEmitter {
  constructor(
    private supabase: SupabaseClient,
    private resend: Resend
  ) {
    super();
  }

  /**
   * Submit an appeal
   */
  async submitAppeal(appeal: AppealSubmission): Promise<string> {
    try {
      // Check if content is eligible for appeal
      const { data: moderationResult } = await this.supabase
        .from('moderation_results')
        .select('*')
        .eq('content_id', appeal.contentId)
        .single();

      if (!moderationResult?.appeal_eligible) {
        throw new Error('Content is not eligible for appeal');
      }

      if (new Date() > new Date(moderationResult.appeal_deadline)) {
        throw new Error('Appeal deadline has passed');
      }

      // Insert appeal
      const { data, error } = await this.supabase
        .from('appeals')
        .insert({
          id: appeal.id,
          content_id: appeal.contentId,
          user_id: appeal.userId,
          reason: appeal.reason,
          evidence: appeal.evidence,
          priority: appeal.priority,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Notify moderators
      this.emit('appealSubmitted', { appealId: appeal.id, priority: appeal.priority });

      return data.id;
    } catch (error) {
      throw new Error(`Failed to submit appeal: ${error}`);
    }
  }

  /**
   * Process an appeal decision
   */
  async processAppeal(
    appealId: string,
    decision: AppealDecision
  ): Promise<void> {
    try {
      // Update appeal status
      const { error: appealError } = await this.supabase
        .from('appeals')
        .update({
          status: decision.decision,
          reviewer_id: decision.reviewerId,
          reasoning: decision.reasoning,
          processed_at: new Date().toISOString(),
          final_decision: decision.finalDecision
        })
        .eq('id', appealId);

      if (appealError) throw appealError;

      // If appeal approved, update original moderation result
      if (decision.decision === 'approved' && decision.newAction) {
        const { data: appeal } = await this.supabase
          .from('appeals')
          .select('content_id, user_id')
          .eq('id', appealId)
          .single();

        if (appeal) {
          await this.supabase
            .from('moderation_results')
            .update({
              status: ModerationStatus.APPEAL_APPROVED,
              action: decision.newAction,
              appeal_decision: decision.reasoning,
              updated_at: new Date().toISOString()
            })
            .eq('content_id', appeal.content_id);

          // Notify user of successful appeal
          await this.notifyUser(appeal.user_id, 'appeal_approved', {
            appealId,
            newAction: decision.newAction,
            reasoning: decision.reasoning
          });
        }
      } else if (decision.decision === 'rejected') {
        const { data: appeal } = await this.supabase
          .from('appeals')
          .select('user_id')
          .eq('id', appealId)
          .single();

        if (appeal) {
          await this.notifyUser(appeal.user_id, 'appeal_rejected', {
            appealId,
            reasoning: decision.reasoning
          });
        }
      }

      this.emit('appealProcessed', { appealId, decision: decision.decision });
    } catch (error) {
      throw new Error(`Failed to process appeal: ${error}`);
    }
  }

  /**
   * Get pending appeals for review
   */
  async getPendingAppeals(): Promise<AppealSubmission[]> {
    const { data, error } = await this.supabase
      .from('appeals')
      .select(`
        id,
        content_id,
        user_id,
        reason,
        evidence,
        priority,
        created_at
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data?.map(appeal => ({
      id: appeal.id,
      contentId: appeal.content_id,
      userId: appeal.user_id,
      reason: appeal.reason,
      evidence: appeal.evidence,
      priority: appeal.priority,
      timestamp: new Date(appeal.created_at)
    })) || [];
  }

  private async notifyUser(userId: string, type: string, data: any): Promise<void> {
    try {
      // Get user email
      const { data: user } = await this.supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (!user?.email) return;

      const emailContent = this.buildEmailContent(type, data);
      
      await this.resend.emails.send({
        from: 'moderation@craudioviz.ai',
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html
      });
    } catch (error) {
      console.error('Failed to notify user:', error);
    }
  }

  private buildEmailContent(type: string, data: any): { subject: string; html: string } {
    switch (type) {
      case 'appeal_approved':
        return {
          subject: 'Your Appeal Has Been Approved',
          html: `
            <h2>Appeal Approved</h2>
            <p>Your appeal has been reviewed and approved. The moderation action has been updated.</p>
            <p><strong>New Action:</strong> ${data.newAction}</p>
            <p><strong>Reasoning:</strong> ${data.reasoning}</p>
          `
        };
      case 'appeal_rejected':
        return {