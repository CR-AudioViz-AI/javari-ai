```typescript
import { createClient } from '@supabase/supabase-js';
import { AIContentAnalyzer } from './AIContentAnalyzer';
import { PolicyEngine } from './PolicyEngine';
import { EscalationManager } from './EscalationManager';
import { AppealsProcessor } from './AppealsProcessor';
import { ReviewerQueue } from './ReviewerQueue';
import type {
  ModerationRequest,
  ModerationResult,
  ContentType,
  PolicyRule,
  EscalationReason,
  AppealRequest,
  ReviewerAssignment,
  ModerationMetrics,
  ModerationConfig,
  AIAnalysisResult,
  HumanReviewResult
} from '../../types/moderation';

/**
 * AI-Powered Content Moderation Service
 * 
 * Provides comprehensive content moderation using hybrid AI/human workflows,
 * custom policy engine, escalation management, and appeals processing.
 * 
 * Features:
 * - Multi-modal AI content analysis (text, image, video, audio)
 * - Custom policy rule engine with configurable thresholds
 * - Intelligent escalation to human reviewers
 * - Appeals processing with workflow management
 * - Real-time reviewer queue management
 * - Comprehensive audit logging and metrics
 * 
 * @example
 * ```typescript
 * const moderationService = new ModerationService({
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
 *   openaiApiKey: process.env.OPENAI_API_KEY!,
 *   azureContentModeratorKey: process.env.AZURE_CONTENT_MODERATOR_KEY!
 * });
 * 
 * const result = await moderationService.moderateContent({
 *   contentId: 'content-123',
 *   contentType: 'text',
 *   content: 'User generated content...',
 *   authorId: 'user-456',
 *   communityId: 'community-789'
 * });
 * ```
 */
export class ModerationService {
  private supabase: ReturnType<typeof createClient>;
  private aiAnalyzer: AIContentAnalyzer;
  private policyEngine: PolicyEngine;
  private escalationManager: EscalationManager;
  private appealsProcessor: AppealsProcessor;
  private reviewerQueue: ReviewerQueue;
  private config: ModerationConfig;

  /**
   * Initialize the Moderation Service
   * 
   * @param config - Service configuration including API keys and settings
   */
  constructor(config: ModerationConfig) {
    this.config = config;
    
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false }
    });

    this.aiAnalyzer = new AIContentAnalyzer({
      openaiApiKey: config.openaiApiKey,
      perspectiveApiKey: config.perspectiveApiKey,
      azureContentModeratorKey: config.azureContentModeratorKey,
      azureContentModeratorEndpoint: config.azureContentModeratorEndpoint
    });

    this.policyEngine = new PolicyEngine(this.supabase);
    this.escalationManager = new EscalationManager(this.supabase);
    this.appealsProcessor = new AppealsProcessor(this.supabase);
    this.reviewerQueue = new ReviewerQueue(this.supabase);
  }

  /**
   * Moderate content using AI analysis and policy rules
   * 
   * @param request - Moderation request containing content and metadata
   * @returns Promise<ModerationResult> - Analysis results and actions taken
   * 
   * @throws {Error} When content analysis fails or required fields are missing
   * 
   * @example
   * ```typescript
   * const result = await moderationService.moderateContent({
   *   contentId: 'post-123',
   *   contentType: 'text',
   *   content: 'This is a sample post content',
   *   authorId: 'user-456',
   *   communityId: 'community-789',
   *   metadata: { platform: 'web', timestamp: new Date() }
   * });
   * 
   * if (result.action === 'block') {
   *   // Content was blocked due to policy violations
   * }
   * ```
   */
  async moderateContent(request: ModerationRequest): Promise<ModerationResult> {
    try {
      // Validate request
      this.validateModerationRequest(request);

      // Start moderation session
      const sessionId = await this.createModerationSession(request);

      // Get applicable policies for the content
      const policies = await this.policyEngine.getApplicablePolicies(
        request.communityId,
        request.contentType,
        request.authorId
      );

      // Perform AI analysis
      const aiAnalysis = await this.aiAnalyzer.analyzeContent({
        contentId: request.contentId,
        contentType: request.contentType,
        content: request.content,
        metadata: request.metadata
      });

      // Apply policy rules to AI results
      const policyDecision = await this.policyEngine.evaluateContent(
        aiAnalysis,
        policies,
        request
      );

      // Determine if human review is needed
      const needsHumanReview = this.shouldEscalateToHuman(
        aiAnalysis,
        policyDecision,
        request
      );

      let finalResult: ModerationResult;

      if (needsHumanReview) {
        // Queue for human review
        const escalation = await this.escalationManager.createEscalation({
          contentId: request.contentId,
          sessionId,
          aiAnalysis,
          policyDecision,
          reason: this.getEscalationReason(aiAnalysis, policyDecision),
          priority: this.calculateEscalationPriority(aiAnalysis, request),
          metadata: request.metadata
        });

        await this.reviewerQueue.assignReviewer(escalation);

        finalResult = {
          sessionId,
          contentId: request.contentId,
          action: 'pending_review',
          confidence: aiAnalysis.confidence,
          aiAnalysis,
          policyDecision,
          escalationId: escalation.id,
          needsHumanReview: true,
          timestamp: new Date(),
          processingTimeMs: Date.now() - new Date(sessionId).getTime()
        };
      } else {
        // Auto-moderate based on AI + policy decision
        const action = this.determineAction(aiAnalysis, policyDecision);

        finalResult = {
          sessionId,
          contentId: request.contentId,
          action,
          confidence: aiAnalysis.confidence,
          aiAnalysis,
          policyDecision,
          needsHumanReview: false,
          timestamp: new Date(),
          processingTimeMs: Date.now() - new Date(sessionId).getTime()
        };

        // Execute the action
        await this.executeAction(request, finalResult);
      }

      // Log the moderation result
      await this.logModerationResult(request, finalResult);

      // Update metrics
      await this.updateModerationMetrics(request, finalResult);

      return finalResult;

    } catch (error) {
      console.error('Content moderation failed:', error);
      throw new Error(`Content moderation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit human review decision for escalated content
   * 
   * @param escalationId - ID of the escalated content
   * @param reviewerId - ID of the reviewer
   * @param decision - Human review decision
   * @returns Promise<ModerationResult> - Updated moderation result
   */
  async submitHumanReview(
    escalationId: string,
    reviewerId: string,
    decision: HumanReviewResult
  ): Promise<ModerationResult> {
    try {
      // Get escalation details
      const escalation = await this.escalationManager.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      // Validate reviewer assignment
      const assignment = await this.reviewerQueue.getAssignment(escalationId);
      if (assignment?.reviewerId !== reviewerId) {
        throw new Error('Reviewer not assigned to this escalation');
      }

      // Process human review
      const finalResult = await this.escalationManager.processHumanReview(
        escalationId,
        reviewerId,
        decision
      );

      // Execute the final action
      const request = await this.getModerationRequest(escalation.contentId);
      await this.executeAction(request, finalResult);

      // Complete the review assignment
      await this.reviewerQueue.completeAssignment(escalationId, decision);

      // Log the human review
      await this.logHumanReview(escalationId, reviewerId, decision);

      return finalResult;

    } catch (error) {
      console.error('Human review submission failed:', error);
      throw new Error(`Human review submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process content appeal from users
   * 
   * @param appealRequest - Appeal request details
   * @returns Promise<string> - Appeal ID for tracking
   */
  async processAppeal(appealRequest: AppealRequest): Promise<string> {
    try {
      // Validate appeal eligibility
      await this.validateAppealEligibility(appealRequest);

      // Create appeal record
      const appealId = await this.appealsProcessor.createAppeal(appealRequest);

      // Queue for appeal review
      await this.reviewerQueue.queueAppealReview(appealId);

      // Notify stakeholders
      await this.notifyAppealCreated(appealRequest, appealId);

      return appealId;

    } catch (error) {
      console.error('Appeal processing failed:', error);
      throw new Error(`Appeal processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get moderation metrics for analytics
   * 
   * @param communityId - Optional community filter
   * @param timeRange - Time range for metrics
   * @returns Promise<ModerationMetrics> - Aggregated metrics
   */
  async getModerationMetrics(
    communityId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<ModerationMetrics> {
    try {
      const { data, error } = await this.supabase
        .from('moderation_metrics')
        .select('*')
        .gte('created_at', timeRange?.start?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', timeRange?.end?.toISOString() || new Date().toISOString())
        .eq(communityId ? 'community_id' : 'id', communityId || '')
        .single();

      if (error) throw error;

      return data as ModerationMetrics;

    } catch (error) {
      console.error('Failed to fetch moderation metrics:', error);
      throw new Error(`Failed to fetch moderation metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update moderation policies
   * 
   * @param communityId - Community ID
   * @param policies - Policy rules to update
   * @returns Promise<void>
   */
  async updatePolicies(communityId: string, policies: PolicyRule[]): Promise<void> {
    try {
      await this.policyEngine.updatePolicies(communityId, policies);
      
      // Log policy update
      await this.logPolicyUpdate(communityId, policies);

    } catch (error) {
      console.error('Policy update failed:', error);
      throw new Error(`Policy update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending review queue for reviewers
   * 
   * @param reviewerId - Optional reviewer filter
   * @returns Promise<ReviewerAssignment[]> - Pending assignments
   */
  async getPendingReviews(reviewerId?: string): Promise<ReviewerAssignment[]> {
    try {
      return await this.reviewerQueue.getPendingReviews(reviewerId);
    } catch (error) {
      console.error('Failed to fetch pending reviews:', error);
      throw new Error(`Failed to fetch pending reviews: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate moderation request
   * 
   * @private
   * @param request - Moderation request to validate
   * @throws {Error} When validation fails
   */
  private validateModerationRequest(request: ModerationRequest): void {
    if (!request.contentId) {
      throw new Error('Content ID is required');
    }
    if (!request.contentType) {
      throw new Error('Content type is required');
    }
    if (!request.content && !request.metadata?.mediaUrl) {
      throw new Error('Content or media URL is required');
    }
    if (!request.authorId) {
      throw new Error('Author ID is required');
    }
  }

  /**
   * Create moderation session
   * 
   * @private
   * @param request - Moderation request
   * @returns Promise<string> - Session ID
   */
  private async createModerationSession(request: ModerationRequest): Promise<string> {
    const { data, error } = await this.supabase
      .from('moderation_sessions')
      .insert({
        content_id: request.contentId,
        content_type: request.contentType,
        author_id: request.authorId,
        community_id: request.communityId,
        metadata: request.metadata,
        status: 'processing',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Determine if content should be escalated to human review
   * 
   * @private
   * @param aiAnalysis - AI analysis result
   * @param policyDecision - Policy engine decision
   * @param request - Original request
   * @returns boolean - Whether escalation is needed
   */
  private shouldEscalateToHuman(
    aiAnalysis: AIAnalysisResult,
    policyDecision: any,
    request: ModerationRequest
  ): boolean {
    // Low confidence AI results
    if (aiAnalysis.confidence < this.config.humanReviewThreshold) {
      return true;
    }

    // Policy violations with appeal history
    if (policyDecision.violations.length > 0 && policyDecision.hasAppealHistory) {
      return true;
    }

    // High-risk content types
    if (this.config.alwaysReviewContentTypes.includes(request.contentType)) {
      return true;
    }

    // Complex policy violations
    if (policyDecision.violations.some((v: any) => v.severity === 'high' && v.confidence < 0.9)) {
      return true;
    }

    return false;
  }

  /**
   * Get escalation reason based on analysis
   * 
   * @private
   * @param aiAnalysis - AI analysis result
   * @param policyDecision - Policy decision
   * @returns EscalationReason - Reason for escalation
   */
  private getEscalationReason(aiAnalysis: AIAnalysisResult, policyDecision: any): EscalationReason {
    if (aiAnalysis.confidence < this.config.humanReviewThreshold) {
      return 'low_confidence';
    }
    if (policyDecision.violations.some((v: any) => v.severity === 'high')) {
      return 'policy_violation';
    }
    return 'manual_review_requested';
  }

  /**
   * Calculate escalation priority
   * 
   * @private
   * @param aiAnalysis - AI analysis result
   * @param request - Moderation request
   * @returns number - Priority score (1-10)
   */
  private calculateEscalationPriority(aiAnalysis: AIAnalysisResult, request: ModerationRequest): number {
    let priority = 5; // Default priority

    // High toxicity score increases priority
    if (aiAnalysis.toxicityScore > 0.8) priority += 2;
    
    // Content type factors
    if (request.contentType === 'video' || request.contentType === 'image') priority += 1;
    
    // Community factors (high-traffic communities get higher priority)
    if (request.metadata?.communitySize && request.metadata.communitySize > 10000) {
      priority += 1;
    }

    return Math.min(Math.max(priority, 1), 10);
  }

  /**
   * Determine action based on analysis results
   * 
   * @private
   * @param aiAnalysis - AI analysis result
   * @param policyDecision - Policy decision
   * @returns string - Action to take
   */
  private determineAction(aiAnalysis: AIAnalysisResult, policyDecision: any): string {
    if (policyDecision.violations.some((v: any) => v.severity === 'critical')) {
      return 'block';
    }
    if (policyDecision.violations.some((v: any) => v.severity === 'high')) {
      return 'flag';
    }
    if (aiAnalysis.toxicityScore > this.config.autoFlagThreshold) {
      return 'flag';
    }
    return 'approve';
  }

  /**
   * Execute moderation action
   * 
   * @private
   * @param request - Original request
   * @param result - Moderation result
   * @returns Promise<void>
   */
  private async executeAction(request: ModerationRequest, result: ModerationResult): Promise<void> {
    const { error } = await this.supabase
      .from('moderation_actions')
      .insert({
        content_id: request.contentId,
        action: result.action,
        session_id: result.sessionId,
        executed_at: new Date().toISOString(),
        metadata: {
          confidence: result.confidence,
          automated: !result.needsHumanReview
        }
      });

    if (error) {
      console.error('Failed to execute action:', error);
    }

    // Send real-time notifications if needed
    if (result.action === 'block' || result.action === 'flag') {
      await this.notifyStakeholders(request, result);
    }
  }

  /**
   * Log moderation result to database
   * 
   * @private
   * @param request - Original request
   * @param result - Moderation result
   * @returns Promise<void>
   */
  private async logModerationResult(request: ModerationRequest, result: ModerationResult): Promise<void> {
    const { error } = await this.supabase
      .from('moderation_logs')
      .insert({
        session_id: result.sessionId,
        content_id: request.contentId,
        content_type: request.contentType,
        author_id: request.authorId,
        community_id: request.communityId,
        action: result.action,
        confidence: result.confidence,
        ai_analysis: result.aiAnalysis,
        policy_decision: result.policyDecision,
        processing_time_ms: result.processingTimeMs,
        needs_human_review: result.needsHumanReview,
        escalation_id: result.escalationId,
        timestamp: result.timestamp.toISOString()
      });

    if (error) {
      console.error('Failed to log moderation result:', error);
    }
  }

  /**
   * Update moderation metrics
   * 
   * @private
   * @param request - Original request
   * @param result - Moderation result
   * @returns Promise<void>
   */
  private async updateModerationMetrics(request: ModerationRequest, result: ModerationResult): Promise<void> {
    try {
      await this.supabase.rpc('update_moderation_metrics', {
        community_id: request.communityId,
        content_type: request.contentType,
        action: result.action,
        processing_time_ms: result.processingTimeMs,
        needs_human_review: result.needsHumanReview
      });
    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  }

  /**
   * Validate appeal eligibility
   * 
   * @private
   * @param appealRequest - Appeal request
   * @returns Promise<void>
   * @throws {Error} When appeal is not eligible
   */
  private async validateAppealEligibility(appealRequest: AppealRequest): Promise<void> {
    // Check if content exists and was moderated
    const { data: moderationLog } = await this.supabase
      .from('moderation_logs')
      .select('*')
      .eq('content_id', appealRequest.contentId)
      .single();

    if (!moderationLog) {
      throw new Error('No moderation record found for this content');
    }

    if (moderationLog.action === 'approve') {
      throw new Error('Cannot appeal approved content');
    }

    // Check for existing appeals
    const { data: existingAppeal } = await this.supabase
      .from('appeals')
      .select('*')
      .eq('content_id', appealRequest.contentId)
      .eq('status', 'pending')
      .single();

    if (existingAppeal) {
      throw new Error('Appeal already pending for this content');
    }

    // Check appeal time window (e.g., 7 days)
    const moderationDate = new Date(moderationLog.timestamp);
    const appealDeadline = new Date(moderationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    if (new Date() > appealDeadline) {
      throw new Error('Appeal window has expired');
    }
  }

  /**
   * Get moderation request by content ID
   * 
   * @private
   * @param contentId - Content ID
   * @returns Promise<ModerationRequest> - Original moderation request
   */
  private async getModerationRequest(contentId: string): Promise<ModerationRequest> {
    const { data, error } = await this.supabase
      .from('moderation_sessions')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    return {
      contentId: data.content_id,
      contentType: data.content_type,
      content: data.content,
      authorId: data.author_id,
      communityId: data.community_id,
      metadata: data.metadata
    };
  }

  /**
   * Log human review decision
   * 
   * @private
   * @param escalationId - Escalation ID
   * @param reviewerId - Reviewer ID
   * @param decision - Review decision
   * @returns Promise<void>
   */
  private async logHumanReview(
    escal