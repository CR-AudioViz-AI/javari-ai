import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';

// Input validation schema
const moderateReviewSchema = z.object({
  reviewId: z.string().uuid(),
  agentId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  rating: z.number().min(1).max(5),
  metadata: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    timestamp: z.string().optional(),
  }).optional(),
});

// Response types
interface ModerationResult {
  reviewId: string;
  status: 'approved' | 'flagged' | 'rejected' | 'pending';
  confidence: number;
  flags: string[];
  trustScoreImpact: number;
  reasoning: string;
  requiresManualReview: boolean;
}

interface ContentAnalysis {
  toxicity: number;
  spam: number;
  authenticity: number;
  sentiment: number;
  flags: string[];
}

class ReviewModerationService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async moderateReview(data: z.infer<typeof moderateReviewSchema>): Promise<ModerationResult> {
    try {
      // Parallel analysis for better performance
      const [
        contentAnalysis,
        authenticityCheck,
        userHistory,
        agentMetrics
      ] = await Promise.all([
        this.analyzeContent(data.content, data.rating),
        this.validateAuthenticity(data.userId, data.agentId, data.content),
        this.getUserReviewHistory(data.userId),
        this.getAgentTrustMetrics(data.agentId)
      ]);

      // Calculate overall moderation result
      const moderationResult = this.calculateModerationResult(
        contentAnalysis,
        authenticityCheck,
        userHistory,
        agentMetrics,
        data
      );

      // Log moderation decision
      await this.logModerationDecision(data.reviewId, moderationResult);

      // Update trust scores if approved
      if (moderationResult.status === 'approved') {
        await this.updateTrustScores(data.agentId, data.userId, moderationResult.trustScoreImpact);
      }

      // Queue for manual review if needed
      if (moderationResult.requiresManualReview) {
        await this.queueForManualReview(data.reviewId, moderationResult);
      }

      return moderationResult;

    } catch (error) {
      console.error('Review moderation error:', error);
      throw new Error('Failed to moderate review');
    }
  }

  private async analyzeContent(content: string, rating: number): Promise<ContentAnalysis> {
    try {
      const prompt = `
        Analyze this review for content moderation:
        
        Review: "${content}"
        Rating: ${rating}/5
        
        Provide analysis for:
        1. Toxicity (0-1): Harmful, abusive, or inappropriate language
        2. Spam (0-1): Generic, repetitive, or promotional content  
        3. Authenticity (0-1): Likelihood of being genuine user feedback
        4. Sentiment (-1 to 1): Overall emotional tone
        
        Also identify specific flags from: profanity, hate_speech, spam, fake_positive, fake_negative, off_topic, promotional
        
        Respond in JSON format:
        {
          "toxicity": 0.0,
          "spam": 0.0, 
          "authenticity": 0.0,
          "sentiment": 0.0,
          "flags": []
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        toxicity: Math.max(0, Math.min(1, analysis.toxicity || 0)),
        spam: Math.max(0, Math.min(1, analysis.spam || 0)),
        authenticity: Math.max(0, Math.min(1, analysis.authenticity || 0.5)),
        sentiment: Math.max(-1, Math.min(1, analysis.sentiment || 0)),
        flags: Array.isArray(analysis.flags) ? analysis.flags : [],
      };

    } catch (error) {
      console.error('Content analysis error:', error);
      return {
        toxicity: 0,
        spam: 0,
        authenticity: 0.5,
        sentiment: 0,
        flags: ['analysis_failed'],
      };
    }
  }

  private async validateAuthenticity(userId: string, agentId: string, content: string): Promise<{
    score: number;
    flags: string[];
  }> {
    try {
      // Check for duplicate content
      const { data: duplicates } = await this.supabase
        .from('agent_reviews')
        .select('id')
        .eq('content', content)
        .neq('user_id', userId);

      const flags: string[] = [];
      let score = 1.0;

      if (duplicates && duplicates.length > 0) {
        flags.push('duplicate_content');
        score -= 0.4;
      }

      // Check user's review velocity
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentReviews } = await this.supabase
        .from('agent_reviews')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo);

      if (recentReviews && recentReviews.length > 3) {
        flags.push('high_velocity');
        score -= 0.3;
      }

      // Check if user has reviewed this agent before
      const { data: existingReview } = await this.supabase
        .from('agent_reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('agent_id', agentId);

      if (existingReview && existingReview.length > 0) {
        flags.push('duplicate_user_review');
        score -= 0.5;
      }

      return {
        score: Math.max(0, score),
        flags,
      };

    } catch (error) {
      console.error('Authenticity validation error:', error);
      return { score: 0.5, flags: ['validation_failed'] };
    }
  }

  private async getUserReviewHistory(userId: string): Promise<{
    totalReviews: number;
    avgRating: number;
    flaggedReviews: number;
    trustScore: number;
  }> {
    try {
      const { data: reviews } = await this.supabase
        .from('agent_reviews')
        .select('rating, moderation_status')
        .eq('user_id', userId);

      const { data: userTrust } = await this.supabase
        .from('trust_scores')
        .select('score')
        .eq('user_id', userId)
        .single();

      const totalReviews = reviews?.length || 0;
      const avgRating = totalReviews > 0 
        ? reviews!.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
        : 0;
      const flaggedReviews = reviews?.filter(r => r.moderation_status === 'flagged').length || 0;
      const trustScore = userTrust?.score || 0.5;

      return {
        totalReviews,
        avgRating,
        flaggedReviews,
        trustScore,
      };

    } catch (error) {
      console.error('User history error:', error);
      return {
        totalReviews: 0,
        avgRating: 0,
        flaggedReviews: 0,
        trustScore: 0.5,
      };
    }
  }

  private async getAgentTrustMetrics(agentId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    trustScore: number;
  }> {
    try {
      const { data: metrics } = await this.supabase
        .from('agents')
        .select('average_rating, total_reviews, trust_score')
        .eq('id', agentId)
        .single();

      return {
        averageRating: metrics?.average_rating || 0,
        totalReviews: metrics?.total_reviews || 0,
        trustScore: metrics?.trust_score || 0.5,
      };

    } catch (error) {
      console.error('Agent metrics error:', error);
      return {
        averageRating: 0,
        totalReviews: 0,
        trustScore: 0.5,
      };
    }
  }

  private calculateModerationResult(
    contentAnalysis: ContentAnalysis,
    authenticityCheck: { score: number; flags: string[] },
    userHistory: { totalReviews: number; avgRating: number; flaggedReviews: number; trustScore: number },
    agentMetrics: { averageRating: number; totalReviews: number; trustScore: number },
    data: z.infer<typeof moderateReviewSchema>
  ): ModerationResult {
    
    const flags = [...contentAnalysis.flags, ...authenticityCheck.flags];
    let confidence = 0.8;
    let status: 'approved' | 'flagged' | 'rejected' | 'pending' = 'approved';
    let trustScoreImpact = 0.1;
    let requiresManualReview = false;

    // High toxicity = immediate rejection
    if (contentAnalysis.toxicity > 0.8) {
      status = 'rejected';
      confidence = 0.95;
      trustScoreImpact = -0.3;
    }
    // High spam = flagged
    else if (contentAnalysis.spam > 0.7) {
      status = 'flagged';
      requiresManualReview = true;
      trustScoreImpact = -0.1;
    }
    // Low authenticity = flagged
    else if (authenticityCheck.score < 0.3) {
      status = 'flagged';
      requiresManualReview = true;
      trustScoreImpact = -0.2;
    }
    // User with poor history
    else if (userHistory.trustScore < 0.3 || userHistory.flaggedReviews > 3) {
      status = 'pending';
      requiresManualReview = true;
      confidence = 0.6;
    }
    // Suspicious rating patterns
    else if (Math.abs(data.rating - agentMetrics.averageRating) > 2 && agentMetrics.totalReviews < 10) {
      requiresManualReview = true;
      confidence = 0.7;
    }

    // Adjust trust score impact based on review quality
    if (status === 'approved') {
      const qualityScore = (contentAnalysis.authenticity + userHistory.trustScore) / 2;
      trustScoreImpact = qualityScore * 0.15;
    }

    const reasoning = this.generateReasoning(contentAnalysis, authenticityCheck, userHistory, status);

    return {
      reviewId: data.reviewId,
      status,
      confidence,
      flags,
      trustScoreImpact,
      reasoning,
      requiresManualReview,
    };
  }

  private generateReasoning(
    contentAnalysis: ContentAnalysis,
    authenticityCheck: { score: number; flags: string[] },
    userHistory: { totalReviews: number; avgRating: number; flaggedReviews: number; trustScore: number },
    status: string
  ): string {
    const reasons: string[] = [];

    if (contentAnalysis.toxicity > 0.5) {
      reasons.push('High toxicity detected in content');
    }
    if (contentAnalysis.spam > 0.5) {
      reasons.push('Spam-like characteristics identified');
    }
    if (authenticityCheck.score < 0.5) {
      reasons.push('Authenticity concerns raised');
    }
    if (userHistory.trustScore < 0.5) {
      reasons.push('User has low trust score');
    }
    if (authenticityCheck.flags.includes('duplicate_content')) {
      reasons.push('Similar content found in other reviews');
    }

    if (reasons.length === 0) {
      return status === 'approved' ? 'Review meets quality standards' : 'Manual review required';
    }

    return reasons.join('; ');
  }

  private async logModerationDecision(reviewId: string, result: ModerationResult): Promise<void> {
    try {
      await this.supabase
        .from('review_moderation_logs')
        .insert({
          review_id: reviewId,
          status: result.status,
          confidence: result.confidence,
          flags: result.flags,
          trust_score_impact: result.trustScoreImpact,
          reasoning: result.reasoning,
          requires_manual_review: result.requiresManualReview,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to log moderation decision:', error);
    }
  }

  private async updateTrustScores(agentId: string, userId: string, impact: number): Promise<void> {
    try {
      // Update user trust score
      await this.supabase.rpc('update_user_trust_score', {
        user_id: userId,
        impact: Math.max(-0.5, Math.min(0.5, impact)),
      });

      // Update agent trust score
      await this.supabase.rpc('update_agent_trust_score', {
        agent_id: agentId,
        impact: Math.max(-0.3, Math.min(0.3, impact * 0.5)),
      });

    } catch (error) {
      console.error('Failed to update trust scores:', error);
    }
  }

  private async queueForManualReview(reviewId: string, result: ModerationResult): Promise<void> {
    try {
      await this.supabase
        .from('moderation_queue')
        .insert({
          review_id: reviewId,
          priority: result.confidence < 0.5 ? 'high' : 'normal',
          flags: result.flags,
          ai_reasoning: result.reasoning,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to queue for manual review:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await rateLimit.limit(identifier, 20, 60000); // 20 requests per minute

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Validate API key
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey || !validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = moderateReviewSchema.parse(body);

    // Initialize moderation service
    const moderationService = new ReviewModerationService();

    // Moderate the review
    const result = await moderationService.moderateReview(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Review moderation API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'review-moderation',
    timestamp: new Date().toISOString(),
  });
}