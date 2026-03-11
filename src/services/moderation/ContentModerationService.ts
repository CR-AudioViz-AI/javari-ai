import { openai } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Content types that can be moderated
 */
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  MIXED = 'mixed'
}

/**
 * Moderation severity levels
 */
export enum ModerationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Moderation actions
 */
export enum ModerationAction {
  APPROVE = 'approve',
  FLAG = 'flag',
  HIDE = 'hide',
  REMOVE = 'remove',
  BAN_USER = 'ban_user',
  ESCALATE = 'escalate'
}

/**
 * Appeal status
 */
export enum AppealStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated'
}

/**
 * Content item for moderation
 */
export interface ContentItem {
  id: string;
  type: ContentType;
  content: string | Buffer;
  metadata: {
    userId: string;
    timestamp: Date;
    context?: string;
    location?: string;
    deviceInfo?: string;
  };
  url?: string;
  parentId?: string;
}

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
  contentId: string;
  confidence: number;
  flagged: boolean;
  categories: {
    hate: number;
    harassment: number;
    violence: number;
    sexual: number;
    selfHarm: number;
    spam: number;
    misinformation: number;
  };
  reasoning: string;
  suggestedAction: ModerationAction;
  severity: ModerationSeverity;
  metadata: Record<string, any>;
}

/**
 * Community report
 */
export interface CommunityReport {
  id: string;
  contentId: string;
  reporterId: string;
  reason: string;
  category: string;
  description: string;
  evidence?: string[];
  timestamp: Date;
  status: 'pending' | 'reviewed' | 'resolved';
}

/**
 * Moderation case
 */
export interface ModerationCase {
  id: string;
  contentId: string;
  aiAnalysis: AIAnalysisResult;
  communityReports: CommunityReport[];
  status: 'pending' | 'in_review' | 'resolved';
  assignedModerator?: string;
  priority: number;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: {
    action: ModerationAction;
    reason: string;
    moderatorId: string;
  };
}

/**
 * Appeal request
 */
export interface AppealRequest {
  id: string;
  caseId: string;
  userId: string;
  reason: string;
  evidence: string[];
  status: AppealStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  decision?: {
    action: 'uphold' | 'overturn' | 'modify';
    reason: string;
    newAction?: ModerationAction;
  };
}

/**
 * Moderator dashboard stats
 */
export interface ModeratorStats {
  totalCases: number;
  pendingCases: number;
  resolvedToday: number;
  averageResolutionTime: number;
  accuracyScore: number;
  categoryBreakdown: Record<string, number>;
  trendsData: Array<{
    date: string;
    count: number;
    category: string;
  }>;
}

/**
 * Validation schemas
 */
const ContentItemSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ContentType),
  content: z.union([z.string(), z.instanceof(Buffer)]),
  metadata: z.object({
    userId: z.string(),
    timestamp: z.date(),
    context: z.string().optional(),
    location: z.string().optional(),
    deviceInfo: z.string().optional(),
  }),
  url: z.string().optional(),
  parentId: z.string().optional(),
});

const CommunityReportSchema = z.object({
  contentId: z.string(),
  reporterId: z.string(),
  reason: z.string(),
  category: z.string(),
  description: z.string(),
  evidence: z.array(z.string()).optional(),
});

const AppealRequestSchema = z.object({
  caseId: z.string(),
  userId: z.string(),
  reason: z.string(),
  evidence: z.array(z.string()),
});

/**
 * AI Analysis Engine for content moderation
 */
export class AIAnalysisEngine {
  /**
   * Analyze text content using OpenAI Moderation API
   */
  async analyzeText(content: string): Promise<Partial<AIAnalysisResult>> {
    try {
      const response = await openai.moderations.create({
        input: content,
      });

      const result = response.results[0];
      
      return {
        flagged: result.flagged,
        confidence: Math.max(...Object.values(result.category_scores)),
        categories: {
          hate: result.category_scores.hate,
          harassment: result.category_scores.harassment,
          violence: result.category_scores.violence,
          sexual: result.category_scores.sexual,
          selfHarm: result.category_scores['self-harm'],
          spam: 0, // Not provided by OpenAI Moderation
          misinformation: 0, // Not provided by OpenAI Moderation
        },
        reasoning: this.generateReasoning(result.categories, result.category_scores),
      };
    } catch (error) {
      logger.error('Text analysis failed:', error);
      throw new Error('Failed to analyze text content');
    }
  }

  /**
   * Analyze image content using GPT-4 Vision
   */
  async analyzeImage(imageUrl: string): Promise<Partial<AIAnalysisResult>> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: `You are a content moderation AI. Analyze this image for:
            - Hate speech or symbols
            - Harassment or bullying
            - Violence or weapons
            - Sexual content
            - Self-harm content
            - Spam or low quality
            - Misinformation
            
            Respond with JSON containing scores 0-1 for each category and explanation.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        flagged: analysis.flagged || false,
        confidence: analysis.confidence || 0,
        categories: analysis.categories || {},
        reasoning: analysis.reasoning || 'AI visual analysis completed',
      };
    } catch (error) {
      logger.error('Image analysis failed:', error);
      throw new Error('Failed to analyze image content');
    }
  }

  /**
   * Analyze video content (first frame + audio transcription)
   */
  async analyzeVideo(videoUrl: string): Promise<Partial<AIAnalysisResult>> {
    try {
      // Extract first frame for visual analysis
      const frameAnalysis = await this.analyzeImage(videoUrl);
      
      // TODO: Implement audio transcription and analysis
      // const audioAnalysis = await this.analyzeAudio(videoUrl);
      
      return {
        ...frameAnalysis,
        metadata: {
          analysisType: 'video_frame',
          videoUrl,
        },
      };
    } catch (error) {
      logger.error('Video analysis failed:', error);
      throw new Error('Failed to analyze video content');
    }
  }

  /**
   * Generate human-readable reasoning from analysis
   */
  private generateReasoning(categories: Record<string, boolean>, scores: Record<string, number>): string {
    const flaggedCategories = Object.entries(categories)
      .filter(([_, flagged]) => flagged)
      .map(([category, _]) => category);

    if (flaggedCategories.length === 0) {
      return 'Content appears to be safe and compliant with community guidelines.';
    }

    const highestScore = Object.entries(scores)
      .sort(([_, a], [__, b]) => b - a)[0];

    return `Content flagged for: ${flaggedCategories.join(', ')}. Highest confidence in ${highestScore[0]} (${(highestScore[1] * 100).toFixed(1)}%).`;
  }
}

/**
 * Community Report Handler
 */
export class CommunityReportHandler {
  /**
   * Submit a community report
   */
  async submitReport(report: Omit<CommunityReport, 'id' | 'timestamp' | 'status'>): Promise<string> {
    try {
      CommunityReportSchema.parse(report);

      const { data, error } = await supabase
        .from('community_reports')
        .insert({
          ...report,
          timestamp: new Date(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger moderation queue update
      await this.triggerModerationReview(report.contentId);

      logger.info('Community report submitted:', { reportId: data.id });
      return data.id;
    } catch (error) {
      logger.error('Failed to submit community report:', error);
      throw new Error('Failed to submit report');
    }
  }

  /**
   * Get reports for content
   */
  async getReportsForContent(contentId: string): Promise<CommunityReport[]> {
    try {
      const { data, error } = await supabase
        .from('community_reports')
        .select('*')
        .eq('contentId', contentId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get reports:', error);
      throw new Error('Failed to retrieve reports');
    }
  }

  /**
   * Trigger moderation review for reported content
   */
  private async triggerModerationReview(contentId: string): Promise<void> {
    const { error } = await supabase
      .from('moderation_queue')
      .upsert({
        content_id: contentId,
        priority: 2, // Higher priority for community reports
        status: 'pending',
        updated_at: new Date(),
      });

    if (error) {
      logger.error('Failed to update moderation queue:', error);
    }
  }
}

/**
 * Appeal Processor
 */
export class AppealProcessor {
  /**
   * Submit an appeal
   */
  async submitAppeal(appeal: Omit<AppealRequest, 'id' | 'status' | 'submittedAt'>): Promise<string> {
    try {
      AppealRequestSchema.parse(appeal);

      const { data, error } = await supabase
        .from('appeal_requests')
        .insert({
          ...appeal,
          status: AppealStatus.PENDING,
          submittedAt: new Date(),
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Appeal submitted:', { appealId: data.id });
      return data.id;
    } catch (error) {
      logger.error('Failed to submit appeal:', error);
      throw new Error('Failed to submit appeal');
    }
  }

  /**
   * Process appeal decision
   */
  async processAppeal(
    appealId: string,
    decision: AppealRequest['decision'],
    reviewerId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('appeal_requests')
        .update({
          status: AppealStatus.UNDER_REVIEW,
          reviewedAt: new Date(),
          reviewerId,
          decision,
        })
        .eq('id', appealId);

      if (error) throw error;

      // If appeal is approved, update original case
      if (decision?.action === 'overturn') {
        await this.overturnModerationCase(appealId, decision.newAction);
      }

      logger.info('Appeal processed:', { appealId, decision: decision?.action });
    } catch (error) {
      logger.error('Failed to process appeal:', error);
      throw new Error('Failed to process appeal');
    }
  }

  /**
   * Get pending appeals
   */
  async getPendingAppeals(): Promise<AppealRequest[]> {
    try {
      const { data, error } = await supabase
        .from('appeal_requests')
        .select('*')
        .eq('status', AppealStatus.PENDING)
        .order('submittedAt', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get pending appeals:', error);
      throw new Error('Failed to retrieve appeals');
    }
  }

  /**
   * Overturn moderation case
   */
  private async overturnModerationCase(appealId: string, newAction?: ModerationAction): Promise<void> {
    try {
      // Get appeal details
      const { data: appeal, error: appealError } = await supabase
        .from('appeal_requests')
        .select('caseId')
        .eq('id', appealId)
        .single();

      if (appealError) throw appealError;

      // Update moderation case
      const { error: caseError } = await supabase
        .from('moderation_cases')
        .update({
          'resolution.action': newAction || ModerationAction.APPROVE,
          'resolution.reason': 'Appeal approved - original decision overturned',
          resolvedAt: new Date(),
        })
        .eq('id', appeal.caseId);

      if (caseError) throw caseError;

      logger.info('Moderation case overturned:', { caseId: appeal.caseId });
    } catch (error) {
      logger.error('Failed to overturn case:', error);
    }
  }
}

/**
 * Moderator Dashboard
 */
export class ModeratorDashboard {
  /**
   * Get moderator statistics
   */
  async getModeratorStats(moderatorId: string): Promise<ModeratorStats> {
    try {
      const [totalCases, pendingCases, resolvedToday, trends] = await Promise.all([
        this.getTotalCases(moderatorId),
        this.getPendingCases(),
        this.getResolvedToday(moderatorId),
        this.getTrendsData(),
      ]);

      return {
        totalCases,
        pendingCases,
        resolvedToday,
        averageResolutionTime: await this.getAverageResolutionTime(moderatorId),
        accuracyScore: await this.getAccuracyScore(moderatorId),
        categoryBreakdown: await this.getCategoryBreakdown(),
        trendsData: trends,
      };
    } catch (error) {
      logger.error('Failed to get moderator stats:', error);
      throw new Error('Failed to retrieve statistics');
    }
  }

  /**
   * Get moderation queue
   */
  async getModerationQueue(limit: number = 50): Promise<ModerationCase[]> {
    try {
      const { data, error } = await supabase
        .from('moderation_cases')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('createdAt', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get moderation queue:', error);
      throw new Error('Failed to retrieve moderation queue');
    }
  }

  /**
   * Assign case to moderator
   */
  async assignCase(caseId: string, moderatorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('moderation_cases')
        .update({
          assignedModerator: moderatorId,
          status: 'in_review',
        })
        .eq('id', caseId);

      if (error) throw error;

      logger.info('Case assigned:', { caseId, moderatorId });
    } catch (error) {
      logger.error('Failed to assign case:', error);
      throw new Error('Failed to assign case');
    }
  }

  /**
   * Resolve moderation case
   */
  async resolveCase(
    caseId: string,
    action: ModerationAction,
    reason: string,
    moderatorId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('moderation_cases')
        .update({
          status: 'resolved',
          resolvedAt: new Date(),
          resolution: {
            action,
            reason,
            moderatorId,
          },
        })
        .eq('id', caseId);

      if (error) throw error;

      // Execute the moderation action
      await this.executeModerationAction(caseId, action);

      logger.info('Case resolved:', { caseId, action, moderatorId });
    } catch (error) {
      logger.error('Failed to resolve case:', error);
      throw new Error('Failed to resolve case');
    }
  }

  private async getTotalCases(moderatorId: string): Promise<number> {
    const { count } = await supabase
      .from('moderation_cases')
      .select('*', { count: 'exact' })
      .eq('assignedModerator', moderatorId);
    return count || 0;
  }

  private async getPendingCases(): Promise<number> {
    const { count } = await supabase
      .from('moderation_cases')
      .select('*', { count: 'exact' })
      .eq('status', 'pending');
    return count || 0;
  }

  private async getResolvedToday(moderatorId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('moderation_cases')
      .select('*', { count: 'exact' })
      .eq('assignedModerator', moderatorId)
      .eq('status', 'resolved')
      .gte('resolvedAt', today.toISOString());

    return count || 0;
  }

  private async getAverageResolutionTime(moderatorId: string): Promise<number> {
    // This would require a database function or more complex query
    return 0; // Placeholder
  }

  private async getAccuracyScore(moderatorId: string): Promise<number> {
    // This would calculate based on appeal success rate
    return 0.95; // Placeholder
  }

  private async getCategoryBreakdown(): Promise<Record<string, number>> {
    return {}; // Placeholder
  }

  private async getTrendsData(): Promise<Array<{ date: string; count: number; category: string }>> {
    return []; // Placeholder
  }

  private async executeModerationAction(caseId: string, action: ModerationAction): Promise<void> {
    // Implementation depends on specific actions required
    logger.info('Executing moderation action:', { caseId, action });
  }
}

/**
 * Content Moderation Service
 * Main service orchestrating all moderation components
 */
export class ContentModerationService {
  private aiEngine: AIAnalysisEngine;
  private reportHandler: CommunityReportHandler;
  private appealProcessor: AppealProcessor;
  private dashboard: ModeratorDashboard;

  constructor() {
    this.aiEngine = new AIAnalysisEngine();
    this.reportHandler = new CommunityReportHandler();
    this.appealProcessor = new AppealProcessor();
    this.dashboard = new ModeratorDashboard();
  }

  /**
   * Analyze content and create moderation case if needed
   */
  async moderateContent(content: ContentItem): Promise<AIAnalysisResult> {
    try {
      const validatedContent = ContentItemSchema.parse(content);
      
      let analysis: Partial<AIAnalysisResult>;

      // Perform AI analysis based on content type
      switch (validatedContent.type) {
        case ContentType.TEXT:
          analysis = await this.aiEngine.analyzeText(validatedContent.content as string);
          break;
        case ContentType.IMAGE:
          analysis = await this.aiEngine.analyzeImage(validatedContent.url!);
          break;
        case ContentType.VIDEO:
          analysis = await this.aiEngine.analyzeVideo(validatedContent.url!);
          break;
        default:
          throw new Error(`Unsupported content type: ${validatedContent.type}`);
      }

      // Complete analysis result
      const result: AIAnalysisResult = {
        contentId: validatedContent.id,
        confidence: analysis.confidence || 0,
        flagged: analysis.flagged || false,
        categories: analysis.categories || {} as any,
        reasoning: analysis.reasoning || 'Analysis completed',
        suggestedAction: this.determineSuggestedAction(analysis),
        severity: this.determineSeverity(analysis),
        metadata: {
          contentType: validatedContent.type,
          analyzedAt: new Date(),
          ...analysis.metadata,
        },
      };

      // Create moderation case if flagged or high confidence
      if (result.flagged || result.confidence > 0.7) {
        await this.createModerationCase(validatedContent, result);
      }

      // Auto-execute low-risk actions
      if (result.confidence > 0.9 && result.suggestedAction !== ModerationAction.ESCALATE) {
        await this.executeAutoAction(result);
      }

      logger.info('Content moderated:', {
        contentId: validatedContent.id,
        flagged: result.flagged,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('Content moderation failed:', error);
      throw new Error('Failed to moderate content');
    }
  }

  /**
   * Submit community report
   */
  async submitCommunityReport(report: Omit<CommunityReport, 'id' | 'timestamp' | 'status'>): Promise<string> {
    return this.reportHandler.submitReport(report);
  }

  /**
   * Submit appeal
   */
  async submitAppeal(appeal: Omit<AppealRequest, 'id' | 'status' | 'submittedAt'>): Promise<string> {
    return this.appealProcessor.submitAppeal(appeal);