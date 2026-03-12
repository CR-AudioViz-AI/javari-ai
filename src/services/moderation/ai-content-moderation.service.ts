```typescript
/**
 * AI Content Moderation Service
 * 
 * Provides comprehensive AI-powered content moderation using multiple models
 * to detect harmful content, spam, and policy violations with automated
 * escalation workflows and human review integration.
 * 
 * @fileoverview AI Content Moderation Service for CR AudioViz AI
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ==================== INTERFACES ====================

/**
 * Moderation result with confidence scores and violation details
 */
export interface ModerationResult {
  id: string;
  contentId: string;
  contentType: 'post' | 'comment' | 'message';
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  overallScore: number;
  confidence: number;
  violations: ViolationDetail[];
  aiModelResults: AIModelResult[];
  action: ModerationAction;
  reviewRequired: boolean;
  escalationLevel: EscalationLevel;
  processedAt: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  reviewerNotes?: string;
}

/**
 * Detailed violation information
 */
export interface ViolationDetail {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  matchedRules: string[];
  context: string;
}

/**
 * AI model analysis result
 */
export interface AIModelResult {
  modelName: string;
  modelVersion: string;
  score: number;
  categories: Record<string, number>;
  flagged: boolean;
  processingTime: number;
}

/**
 * Content moderation request
 */
export interface ModerationRequest {
  contentId: string;
  contentType: 'post' | 'comment' | 'message';
  content: string;
  authorId: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Moderation configuration
 */
export interface ModerationConfig {
  models: {
    openai: {
      enabled: boolean;
      threshold: number;
    };
    toxicity: {
      enabled: boolean;
      threshold: number;
    };
    spam: {
      enabled: boolean;
      threshold: number;
    };
  };
  autoAction: {
    enabled: boolean;
    highConfidenceThreshold: number;
    criticalThreshold: number;
  };
  escalation: {
    enabled: boolean;
    mediumThreshold: number;
    highThreshold: number;
  };
  humanReview: {
    required: boolean;
    queueLimit: number;
    priorityWeights: Record<string, number>;
  };
}

/**
 * Moderation queue item for human reviewers
 */
export interface ModerationQueueItem {
  id: string;
  moderationResult: ModerationResult;
  priority: number;
  queuedAt: Date;
  estimatedReviewTime: number;
  tags: string[];
}

/**
 * Escalation workflow configuration
 */
export interface EscalationWorkflow {
  level: EscalationLevel;
  threshold: number;
  actions: EscalationAction[];
  notificationTargets: string[];
  timeout: number;
}

/**
 * Moderation metrics
 */
export interface ModerationMetrics {
  period: string;
  totalProcessed: number;
  autoApproved: number;
  autoRejected: number;
  humanReviewed: number;
  escalated: number;
  averageProcessingTime: number;
  accuracyRate: number;
  falsePositives: number;
  falseNegatives: number;
  violationBreakdown: Record<ViolationType, number>;
}

// ==================== TYPES ====================

export type ViolationType = 
  | 'hate_speech'
  | 'harassment'
  | 'spam'
  | 'sexual_content'
  | 'violence'
  | 'self_harm'
  | 'illegal_content'
  | 'misinformation'
  | 'copyright'
  | 'privacy'
  | 'off_topic';

export type ModerationAction = 
  | 'approve'
  | 'reject'
  | 'shadow_ban'
  | 'warn_user'
  | 'escalate'
  | 'queue_review';

export type EscalationLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type EscalationAction = 
  | 'notify_moderators'
  | 'notify_admins'
  | 'auto_remove'
  | 'temp_ban'
  | 'account_review';

// ==================== ERRORS ====================

export class ModerationServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ModerationServiceError';
  }
}

export class AIModelError extends Error {
  constructor(
    message: string,
    public modelName: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AIModelError';
  }
}

export class EscalationError extends Error {
  constructor(
    message: string,
    public level: EscalationLevel,
    public details?: any
  ) {
    super(message);
    this.name = 'EscalationError';
  }
}

// ==================== SERVICE IMPLEMENTATION ====================

/**
 * AI Content Moderation Service
 * 
 * Comprehensive content moderation using multiple AI models with
 * automated escalation workflows and human review integration.
 */
export class AIContentModerationService {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private config: ModerationConfig;
  private escalationWorkflows: Map<EscalationLevel, EscalationWorkflow>;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string,
    config?: Partial<ModerationConfig>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.config = this.mergeConfig(config);
    this.escalationWorkflows = new Map();
    this.initializeEscalationWorkflows();
  }

  /**
   * Analyze content for policy violations and harmful content
   */
  async analyzeContent(request: ModerationRequest): Promise<ModerationResult> {
    try {
      const startTime = Date.now();
      
      // Initialize moderation result
      const result: ModerationResult = {
        id: crypto.randomUUID(),
        contentId: request.contentId,
        contentType: request.contentType,
        status: 'pending',
        overallScore: 0,
        confidence: 0,
        violations: [],
        aiModelResults: [],
        action: 'approve',
        reviewRequired: false,
        escalationLevel: 'none',
        processedAt: new Date()
      };

      // Run AI model analysis in parallel
      const modelPromises = [];

      if (this.config.models.openai.enabled) {
        modelPromises.push(this.analyzeWithOpenAI(request.content));
      }

      if (this.config.models.toxicity.enabled) {
        modelPromises.push(this.analyzeToxicity(request.content));
      }

      if (this.config.models.spam.enabled) {
        modelPromises.push(this.analyzeSpam(request.content, request.authorId));
      }

      const modelResults = await Promise.allSettled(modelPromises);

      // Process model results
      for (const modelResult of modelResults) {
        if (modelResult.status === 'fulfilled') {
          result.aiModelResults.push(modelResult.value);
        }
      }

      // Calculate overall score and confidence
      this.calculateOverallScore(result);

      // Detect policy violations
      result.violations = await this.detectPolicyViolations(
        request.content,
        result.aiModelResults
      );

      // Determine action and escalation
      this.determineAction(result);

      // Execute auto-actions if configured
      if (this.config.autoAction.enabled) {
        await this.executeAutoAction(result, request);
      }

      // Queue for human review if required
      if (result.reviewRequired) {
        await this.queueForReview(result, request.priority);
      }

      // Log moderation result
      await this.logModerationResult(result, request);

      // Handle escalation if needed
      if (result.escalationLevel !== 'none') {
        await this.handleEscalation(result);
      }

      const processingTime = Date.now() - startTime;
      console.log(`Content moderation completed in ${processingTime}ms`);

      return result;

    } catch (error) {
      console.error('Content moderation failed:', error);
      throw new ModerationServiceError(
        'Failed to analyze content',
        'ANALYSIS_FAILED',
        { request, error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Analyze content using OpenAI Moderation API
   */
  private async analyzeWithOpenAI(content: string): Promise<AIModelResult> {
    try {
      const startTime = Date.now();
      
      const response = await this.openai.moderations.create({
        input: content
      });

      const result = response.results[0];
      const processingTime = Date.now() - startTime;

      return {
        modelName: 'openai-moderation',
        modelVersion: '1.0',
        score: this.calculateOpenAIScore(result.category_scores),
        categories: result.category_scores,
        flagged: result.flagged,
        processingTime
      };

    } catch (error) {
      console.error('OpenAI moderation failed:', error);
      throw new AIModelError(
        'OpenAI moderation analysis failed',
        'openai-moderation',
        error
      );
    }
  }

  /**
   * Analyze content for toxicity
   */
  private async analyzeToxicity(content: string): Promise<AIModelResult> {
    try {
      const startTime = Date.now();
      
      // Implement toxicity analysis logic
      // This would typically use a toxicity detection model
      const toxicityScore = this.calculateToxicityScore(content);
      const processingTime = Date.now() - startTime;

      return {
        modelName: 'toxicity-detector',
        modelVersion: '1.0',
        score: toxicityScore,
        categories: { toxicity: toxicityScore },
        flagged: toxicityScore > this.config.models.toxicity.threshold,
        processingTime
      };

    } catch (error) {
      console.error('Toxicity analysis failed:', error);
      throw new AIModelError(
        'Toxicity analysis failed',
        'toxicity-detector',
        error
      );
    }
  }

  /**
   * Analyze content for spam
   */
  private async analyzeSpam(content: string, authorId: string): Promise<AIModelResult> {
    try {
      const startTime = Date.now();
      
      // Check user history for spam patterns
      const userHistory = await this.getUserModerationHistory(authorId);
      
      // Implement spam detection logic
      const spamScore = this.calculateSpamScore(content, userHistory);
      const processingTime = Date.now() - startTime;

      return {
        modelName: 'spam-detector',
        modelVersion: '1.0',
        score: spamScore,
        categories: { spam: spamScore },
        flagged: spamScore > this.config.models.spam.threshold,
        processingTime
      };

    } catch (error) {
      console.error('Spam analysis failed:', error);
      throw new AIModelError(
        'Spam analysis failed',
        'spam-detector',
        error
      );
    }
  }

  /**
   * Calculate overall moderation score and confidence
   */
  private calculateOverallScore(result: ModerationResult): void {
    if (result.aiModelResults.length === 0) {
      result.overallScore = 0;
      result.confidence = 0;
      return;
    }

    // Weight different models appropriately
    const weights = {
      'openai-moderation': 0.4,
      'toxicity-detector': 0.3,
      'spam-detector': 0.3
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const modelResult of result.aiModelResults) {
      const weight = weights[modelResult.modelName as keyof typeof weights] || 0.1;
      weightedScore += modelResult.score * weight;
      totalWeight += weight;
    }

    result.overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Calculate confidence based on model agreement
    const scores = result.aiModelResults.map(r => r.score);
    const variance = this.calculateVariance(scores);
    result.confidence = Math.max(0, 1 - variance);
  }

  /**
   * Detect specific policy violations
   */
  private async detectPolicyViolations(
    content: string,
    modelResults: AIModelResult[]
  ): Promise<ViolationDetail[]> {
    const violations: ViolationDetail[] = [];

    // Check each model result for violations
    for (const modelResult of modelResults) {
      if (modelResult.modelName === 'openai-moderation') {
        violations.push(...this.extractOpenAIViolations(modelResult));
      } else if (modelResult.modelName === 'toxicity-detector') {
        violations.push(...this.extractToxicityViolations(modelResult));
      } else if (modelResult.modelName === 'spam-detector') {
        violations.push(...this.extractSpamViolations(modelResult));
      }
    }

    // Apply rule engine for custom policy violations
    const customViolations = await this.applyCustomRules(content);
    violations.push(...customViolations);

    return violations;
  }

  /**
   * Determine appropriate action based on analysis results
   */
  private determineAction(result: ModerationResult): void {
    const { overallScore, confidence, violations } = result;

    // Check for critical violations
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      result.action = 'reject';
      result.escalationLevel = 'critical';
      result.reviewRequired = false; // Auto-reject critical content
      return;
    }

    // High confidence, high score - auto-reject
    if (confidence > 0.8 && overallScore > this.config.autoAction.criticalThreshold) {
      result.action = 'reject';
      result.escalationLevel = 'high';
      result.reviewRequired = false;
      return;
    }

    // High score but lower confidence - queue for review
    if (overallScore > this.config.escalation.highThreshold) {
      result.action = 'queue_review';
      result.escalationLevel = 'medium';
      result.reviewRequired = true;
      return;
    }

    // Medium score - warn user or queue for review
    if (overallScore > this.config.escalation.mediumThreshold) {
      result.action = 'warn_user';
      result.escalationLevel = 'low';
      result.reviewRequired = this.config.humanReview.required;
      return;
    }

    // Low score - approve
    result.action = 'approve';
    result.escalationLevel = 'none';
    result.reviewRequired = false;
  }

  /**
   * Execute automated moderation action
   */
  private async executeAutoAction(
    result: ModerationResult,
    request: ModerationRequest
  ): Promise<void> {
    try {
      switch (result.action) {
        case 'approve':
          await this.approveContent(request.contentId);
          break;
        case 'reject':
          await this.rejectContent(request.contentId, result.violations);
          break;
        case 'warn_user':
          await this.warnUser(request.authorId, result.violations);
          break;
        case 'shadow_ban':
          await this.shadowBanUser(request.authorId);
          break;
        default:
          // No auto-action for queue_review and escalate
          break;
      }
    } catch (error) {
      console.error('Auto-action execution failed:', error);
      // Don't throw - log and continue with manual review
    }
  }

  /**
   * Queue content for human review
   */
  private async queueForReview(
    result: ModerationResult,
    priority: string = 'medium'
  ): Promise<void> {
    try {
      const queueItem: ModerationQueueItem = {
        id: crypto.randomUUID(),
        moderationResult: result,
        priority: this.config.humanReview.priorityWeights[priority] || 1,
        queuedAt: new Date(),
        estimatedReviewTime: this.estimateReviewTime(result),
        tags: this.generateTags(result)
      };

      const { error } = await this.supabase
        .from('moderation_queue')
        .insert([queueItem]);

      if (error) {
        throw new Error(`Failed to queue for review: ${error.message}`);
      }

    } catch (error) {
      console.error('Failed to queue for review:', error);
      throw new ModerationServiceError(
        'Failed to queue content for human review',
        'QUEUE_FAILED',
        { result, error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Handle escalation workflow
   */
  private async handleEscalation(result: ModerationResult): Promise<void> {
    try {
      const workflow = this.escalationWorkflows.get(result.escalationLevel);
      if (!workflow) {
        return;
      }

      // Execute escalation actions
      for (const action of workflow.actions) {
        await this.executeEscalationAction(action, result);
      }

      // Send notifications
      await this.sendEscalationNotifications(workflow, result);

    } catch (error) {
      console.error('Escalation handling failed:', error);
      throw new EscalationError(
        'Failed to handle escalation',
        result.escalationLevel,
        { result, error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Get moderation metrics for a specific period
   */
  async getModerationMetrics(period: string): Promise<ModerationMetrics> {
    try {
      const { data: logs, error } = await this.supabase
        .from('moderation_logs')
        .select('*')
        .gte('created_at', this.getPeriodStartDate(period))
        .lte('created_at', new Date().toISOString());

      if (error) {
        throw new Error(`Failed to fetch moderation logs: ${error.message}`);
      }

      return this.calculateMetrics(logs, period);

    } catch (error) {
      console.error('Failed to get moderation metrics:', error);
      throw new ModerationServiceError(
        'Failed to retrieve moderation metrics',
        'METRICS_FAILED',
        { period, error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Get pending moderation queue items
   */
  async getModerationQueue(limit: number = 50): Promise<ModerationQueueItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('moderation_queue')
        .select('*')
        .is('reviewed_at', null)
        .order('priority', { ascending: false })
        .order('queued_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch moderation queue: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('Failed to get moderation queue:', error);
      throw new ModerationServiceError(
        'Failed to retrieve moderation queue',
        'QUEUE_FETCH_FAILED',
        { limit, error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Submit human review decision
   */
  async submitReview(
    queueItemId: string,
    reviewerId: string,
    decision: 'approve' | 'reject',
    notes?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('moderation_queue')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewer_id: reviewerId,
          reviewer_decision: decision,
          reviewer_notes: notes
        })
        .eq('id', queueItemId);

      if (error) {
        throw new Error(`Failed to submit review: ${error.message}`);
      }

      // Update moderation result status
      await this.updateModerationResultStatus(queueItemId, decision);

    } catch (error) {
      console.error('Failed to submit review:', error);
      throw new ModerationServiceError(
        'Failed to submit review decision',
        'REVIEW_FAILED',
        { queueItemId, reviewerId, decision, error: error instanceof Error ? error.message : error }
      );
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private mergeConfig(config?: Partial<ModerationConfig>): ModerationConfig {
    const defaultConfig: ModerationConfig = {
      models: {
        openai: { enabled: true, threshold: 0.7 },
        toxicity: { enabled: true, threshold: 0.8 },
        spam: { enabled: true, threshold: 0.6 }
      },
      autoAction: {
        enabled: true,
        highConfidenceThreshold: 0.8,
        criticalThreshold: 0.9
      },
      escalation: {
        enabled: true,
        mediumThreshold: 0.5,
        highThreshold: 0.7
      },
      humanReview: {
        required: false,
        queueLimit: 1000,
        priorityWeights: { low: 1, medium: 2, high: 3 }
      }
    };

    return { ...defaultConfig, ...config };
  }

  private initializeEscalationWorkflows(): void {
    this.escalationWorkflows.set('low', {
      level: 'low',
      threshold: 0.5,
      actions: ['notify_moderators'],
      notificationTargets: ['moderators'],
      timeout: 3600000 // 1 hour
    });

    this.escalationWorkflows.set('medium', {