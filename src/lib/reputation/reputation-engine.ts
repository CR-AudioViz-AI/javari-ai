```typescript
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

/**
 * User contribution data for reputation analysis
 */
interface UserContribution {
  userId: string;
  type: 'code' | 'comment' | 'post' | 'help' | 'review';
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
  interactions: {
    likes: number;
    comments: number;
    shares: number;
    votes: number;
  };
}

/**
 * Technical expertise scoring metrics
 */
interface TechnicalExpertiseMetrics {
  codeComplexity: number;
  technicalAccuracy: number;
  innovationLevel: number;
  problemSolvingSkill: number;
  knowledgeDepth: number;
}

/**
 * Community helpfulness scoring metrics
 */
interface CommunityHelpfulnessMetrics {
  responseQuality: number;
  helpfulnessRating: number;
  engagementLevel: number;
  mentorshipActivity: number;
  collaborationScore: number;
}

/**
 * Content quality evaluation metrics
 */
interface ContentQualityMetrics {
  clarity: number;
  relevance: number;
  originality: number;
  sentiment: number;
  engagement: number;
}

/**
 * Comprehensive reputation score breakdown
 */
interface ReputationScore {
  userId: string;
  totalScore: number;
  technicalExpertise: TechnicalExpertiseMetrics;
  communityHelpfulness: CommunityHelpfulnessMetrics;
  contentQuality: ContentQualityMetrics;
  badges: ReputationBadge[];
  level: number;
  percentile: number;
  lastUpdated: Date;
}

/**
 * Reputation badge configuration
 */
interface ReputationBadge {
  id: string;
  name: string;
  description: string;
  category: 'technical' | 'community' | 'content' | 'milestone';
  threshold: number;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

/**
 * Reputation calculation weights
 */
interface ReputationWeights {
  technicalExpertise: number;
  communityHelpfulness: number;
  contentQuality: number;
  recencyDecay: number;
  interactionBonus: number;
}

/**
 * Advanced multi-dimensional reputation scoring engine
 */
export class ReputationEngine {
  private supabase: any;
  private openai: OpenAI;
  private weights: ReputationWeights;
  private badges: ReputationBadge[];

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string,
    weights?: Partial<ReputationWeights>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    
    this.weights = {
      technicalExpertise: 0.4,
      communityHelpfulness: 0.35,
      contentQuality: 0.25,
      recencyDecay: 0.95,
      interactionBonus: 0.1,
      ...weights
    };

    this.badges = this.initializeBadgeSystem();
  }

  /**
   * Calculate comprehensive reputation score for a user
   */
  async calculateScore(userId: string): Promise<ReputationScore> {
    try {
      const contributions = await this.getUserContributions(userId);
      const historicalData = await this.getReputationHistory(userId);
      
      const technicalMetrics = await this.analyzeTechnicalExpertise(contributions);
      const helpfulnessMetrics = await this.analyzeCommunityHelpfulness(contributions);
      const qualityMetrics = await this.analyzeContentQuality(contributions);
      
      const weightedScore = this.calculateWeightedScore(
        technicalMetrics,
        helpfulnessMetrics,
        qualityMetrics
      );

      const adjustedScore = this.applyTemporalDecay(weightedScore, contributions);
      const badges = await this.calculateBadges(userId, technicalMetrics, helpfulnessMetrics, qualityMetrics);
      const level = this.calculateLevel(adjustedScore);
      const percentile = await this.calculatePercentile(userId, adjustedScore);

      const reputationScore: ReputationScore = {
        userId,
        totalScore: adjustedScore,
        technicalExpertise: technicalMetrics,
        communityHelpfulness: helpfulnessMetrics,
        contentQuality: qualityMetrics,
        badges,
        level,
        percentile,
        lastUpdated: new Date()
      };

      await this.saveReputationScore(reputationScore);
      await this.updateReputationHistory(reputationScore);

      return reputationScore;
    } catch (error) {
      throw new Error(`Failed to calculate reputation score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze technical expertise from user contributions
   */
  private async analyzeTechnicalExpertise(
    contributions: UserContribution[]
  ): Promise<TechnicalExpertiseMetrics> {
    const codeContributions = contributions.filter(c => c.type === 'code');
    
    let codeComplexity = 0;
    let technicalAccuracy = 0;
    let innovationLevel = 0;
    let problemSolvingSkill = 0;
    let knowledgeDepth = 0;

    if (codeContributions.length === 0) {
      return {
        codeComplexity: 0,
        technicalAccuracy: 0,
        innovationLevel: 0,
        problemSolvingSkill: 0,
        knowledgeDepth: 0
      };
    }

    for (const contribution of codeContributions) {
      try {
        const analysis = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: `Analyze the technical quality of this code contribution. Rate each aspect from 0-100:
            1. Code Complexity (algorithmic sophistication)
            2. Technical Accuracy (correctness and best practices)
            3. Innovation Level (creativity and novel approaches)
            4. Problem Solving Skill (efficiency and elegance)
            5. Knowledge Depth (advanced concepts usage)
            
            Return JSON format: {"complexity": 0-100, "accuracy": 0-100, "innovation": 0-100, "problemSolving": 0-100, "knowledge": 0-100}`
          }, {
            role: 'user',
            content: contribution.content
          }],
          temperature: 0.1
        });

        const scores = JSON.parse(analysis.choices[0].message.content || '{}');
        const interactionWeight = this.calculateInteractionWeight(contribution.interactions);

        codeComplexity += (scores.complexity || 0) * interactionWeight;
        technicalAccuracy += (scores.accuracy || 0) * interactionWeight;
        innovationLevel += (scores.innovation || 0) * interactionWeight;
        problemSolvingSkill += (scores.problemSolving || 0) * interactionWeight;
        knowledgeDepth += (scores.knowledge || 0) * interactionWeight;
      } catch (error) {
        console.warn(`Failed to analyze contribution: ${error}`);
      }
    }

    const totalWeight = codeContributions.reduce(
      (sum, c) => sum + this.calculateInteractionWeight(c.interactions),
      0
    );

    return {
      codeComplexity: totalWeight > 0 ? codeComplexity / totalWeight : 0,
      technicalAccuracy: totalWeight > 0 ? technicalAccuracy / totalWeight : 0,
      innovationLevel: totalWeight > 0 ? innovationLevel / totalWeight : 0,
      problemSolvingSkill: totalWeight > 0 ? problemSolvingSkill / totalWeight : 0,
      knowledgeDepth: totalWeight > 0 ? knowledgeDepth / totalWeight : 0
    };
  }

  /**
   * Analyze community helpfulness metrics
   */
  private async analyzeCommunityHelpfulness(
    contributions: UserContribution[]
  ): Promise<CommunityHelpfulnessMetrics> {
    const helpContributions = contributions.filter(c => 
      c.type === 'help' || c.type === 'comment' || c.type === 'review'
    );

    let responseQuality = 0;
    let helpfulnessRating = 0;
    let engagementLevel = 0;
    let mentorshipActivity = 0;
    let collaborationScore = 0;

    if (helpContributions.length === 0) {
      return {
        responseQuality: 0,
        helpfulnessRating: 0,
        engagementLevel: 0,
        mentorshipActivity: 0,
        collaborationScore: 0
      };
    }

    for (const contribution of helpContributions) {
      try {
        const analysis = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: `Analyze the helpfulness quality of this community contribution. Rate each aspect from 0-100:
            1. Response Quality (clarity and usefulness)
            2. Helpfulness Rating (how helpful to the community)
            3. Engagement Level (encourages discussion)
            4. Mentorship Activity (teaching and guidance)
            5. Collaboration Score (promotes teamwork)
            
            Return JSON format: {"responseQuality": 0-100, "helpfulness": 0-100, "engagement": 0-100, "mentorship": 0-100, "collaboration": 0-100}`
          }, {
            role: 'user',
            content: contribution.content
          }],
          temperature: 0.1
        });

        const scores = JSON.parse(analysis.choices[0].message.content || '{}');
        const interactionWeight = this.calculateInteractionWeight(contribution.interactions);

        responseQuality += (scores.responseQuality || 0) * interactionWeight;
        helpfulnessRating += (scores.helpfulness || 0) * interactionWeight;
        engagementLevel += (scores.engagement || 0) * interactionWeight;
        mentorshipActivity += (scores.mentorship || 0) * interactionWeight;
        collaborationScore += (scores.collaboration || 0) * interactionWeight;
      } catch (error) {
        console.warn(`Failed to analyze contribution: ${error}`);
      }
    }

    const totalWeight = helpContributions.reduce(
      (sum, c) => sum + this.calculateInteractionWeight(c.interactions),
      0
    );

    return {
      responseQuality: totalWeight > 0 ? responseQuality / totalWeight : 0,
      helpfulnessRating: totalWeight > 0 ? helpfulnessRating / totalWeight : 0,
      engagementLevel: totalWeight > 0 ? engagementLevel / totalWeight : 0,
      mentorshipActivity: totalWeight > 0 ? mentorshipActivity / totalWeight : 0,
      collaborationScore: totalWeight > 0 ? collaborationScore / totalWeight : 0
    };
  }

  /**
   * Analyze content quality metrics
   */
  private async analyzeContentQuality(
    contributions: UserContribution[]
  ): Promise<ContentQualityMetrics> {
    const contentContributions = contributions.filter(c => 
      c.type === 'post' || c.type === 'comment'
    );

    let clarity = 0;
    let relevance = 0;
    let originality = 0;
    let sentiment = 0;
    let engagement = 0;

    if (contentContributions.length === 0) {
      return { clarity: 0, relevance: 0, originality: 0, sentiment: 0, engagement: 0 };
    }

    for (const contribution of contentContributions) {
      try {
        const analysis = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: `Analyze the content quality of this contribution. Rate each aspect from 0-100:
            1. Clarity (clear and well-structured)
            2. Relevance (relevant to the topic/community)
            3. Originality (unique insights or perspectives)
            4. Sentiment (positive and constructive tone)
            5. Engagement (likely to generate meaningful discussion)
            
            Return JSON format: {"clarity": 0-100, "relevance": 0-100, "originality": 0-100, "sentiment": 0-100, "engagement": 0-100}`
          }, {
            role: 'user',
            content: contribution.content
          }],
          temperature: 0.1
        });

        const scores = JSON.parse(analysis.choices[0].message.content || '{}');
        const interactionWeight = this.calculateInteractionWeight(contribution.interactions);

        clarity += (scores.clarity || 0) * interactionWeight;
        relevance += (scores.relevance || 0) * interactionWeight;
        originality += (scores.originality || 0) * interactionWeight;
        sentiment += (scores.sentiment || 0) * interactionWeight;
        engagement += (scores.engagement || 0) * interactionWeight;
      } catch (error) {
        console.warn(`Failed to analyze contribution: ${error}`);
      }
    }

    const totalWeight = contentContributions.reduce(
      (sum, c) => sum + this.calculateInteractionWeight(c.interactions),
      0
    );

    return {
      clarity: totalWeight > 0 ? clarity / totalWeight : 0,
      relevance: totalWeight > 0 ? relevance / totalWeight : 0,
      originality: totalWeight > 0 ? originality / totalWeight : 0,
      sentiment: totalWeight > 0 ? sentiment / totalWeight : 0,
      engagement: totalWeight > 0 ? engagement / totalWeight : 0
    };
  }

  /**
   * Calculate weighted reputation score
   */
  private calculateWeightedScore(
    technical: TechnicalExpertiseMetrics,
    helpfulness: CommunityHelpfulnessMetrics,
    quality: ContentQualityMetrics
  ): number {
    const technicalScore = (
      technical.codeComplexity +
      technical.technicalAccuracy +
      technical.innovationLevel +
      technical.problemSolvingSkill +
      technical.knowledgeDepth
    ) / 5;

    const helpfulnessScore = (
      helpfulness.responseQuality +
      helpfulness.helpfulnessRating +
      helpfulness.engagementLevel +
      helpfulness.mentorshipActivity +
      helpfulness.collaborationScore
    ) / 5;

    const qualityScore = (
      quality.clarity +
      quality.relevance +
      quality.originality +
      quality.sentiment +
      quality.engagement
    ) / 5;

    return (
      technicalScore * this.weights.technicalExpertise +
      helpfulnessScore * this.weights.communityHelpfulness +
      qualityScore * this.weights.contentQuality
    );
  }

  /**
   * Apply temporal decay to reputation score
   */
  private applyTemporalDecay(
    score: number,
    contributions: UserContribution[]
  ): number {
    const now = new Date();
    let decayedScore = 0;
    let totalWeight = 0;

    for (const contribution of contributions) {
      const daysSince = (now.getTime() - contribution.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.pow(this.weights.recencyDecay, daysSince);
      const weight = this.calculateInteractionWeight(contribution.interactions);
      
      decayedScore += score * decayFactor * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? decayedScore / totalWeight : score;
  }

  /**
   * Calculate interaction weight for contribution
   */
  private calculateInteractionWeight(interactions: UserContribution['interactions']): number {
    const baseWeight = 1;
    const interactionBonus = (
      interactions.likes * 0.1 +
      interactions.comments * 0.2 +
      interactions.shares * 0.3 +
      interactions.votes * 0.4
    ) * this.weights.interactionBonus;

    return baseWeight + interactionBonus;
  }

  /**
   * Calculate earned badges
   */
  private async calculateBadges(
    userId: string,
    technical: TechnicalExpertiseMetrics,
    helpfulness: CommunityHelpfulnessMetrics,
    quality: ContentQualityMetrics
  ): Promise<ReputationBadge[]> {
    const earnedBadges: ReputationBadge[] = [];
    const userStats = await this.getUserStats(userId);

    for (const badge of this.badges) {
      let qualifies = false;

      switch (badge.category) {
        case 'technical':
          qualifies = this.checkTechnicalBadge(badge, technical, userStats);
          break;
        case 'community':
          qualifies = this.checkCommunityBadge(badge, helpfulness, userStats);
          break;
        case 'content':
          qualifies = this.checkContentBadge(badge, quality, userStats);
          break;
        case 'milestone':
          qualifies = this.checkMilestoneBadge(badge, userStats);
          break;
      }

      if (qualifies) {
        earnedBadges.push(badge);
      }
    }

    return earnedBadges;
  }

  /**
   * Check technical badge qualification
   */
  private checkTechnicalBadge(
    badge: ReputationBadge,
    technical: TechnicalExpertiseMetrics,
    userStats: Record<string, number>
  ): boolean {
    const avgTechnical = (
      technical.codeComplexity +
      technical.technicalAccuracy +
      technical.innovationLevel +
      technical.problemSolvingSkill +
      technical.knowledgeDepth
    ) / 5;

    return avgTechnical >= badge.threshold;
  }

  /**
   * Check community badge qualification
   */
  private checkCommunityBadge(
    badge: ReputationBadge,
    helpfulness: CommunityHelpfulnessMetrics,
    userStats: Record<string, number>
  ): boolean {
    const avgHelpfulness = (
      helpfulness.responseQuality +
      helpfulness.helpfulnessRating +
      helpfulness.engagementLevel +
      helpfulness.mentorshipActivity +
      helpfulness.collaborationScore
    ) / 5;

    return avgHelpfulness >= badge.threshold;
  }

  /**
   * Check content badge qualification
   */
  private checkContentBadge(
    badge: ReputationBadge,
    quality: ContentQualityMetrics,
    userStats: Record<string, number>
  ): boolean {
    const avgQuality = (
      quality.clarity +
      quality.relevance +
      quality.originality +
      quality.sentiment +
      quality.engagement
    ) / 5;

    return avgQuality >= badge.threshold;
  }

  /**
   * Check milestone badge qualification
   */
  private checkMilestoneBadge(
    badge: ReputationBadge,
    userStats: Record<string, number>
  ): boolean {
    switch (badge.id) {
      case 'contributor':
        return userStats.totalContributions >= 10;
      case 'expert':
        return userStats.totalContributions >= 100;
      case 'mentor':
        return userStats.helpfulAnswers >= 50;
      case 'innovator':
        return userStats.originalContributions >= 25;
      default:
        return false;
    }
  }

  /**
   * Calculate user level based on score
   */
  private calculateLevel(score: number): number {
    if (score >= 90) return 10;
    if (score >= 80) return 9;
    if (score >= 70) return 8;
    if (score >= 60) return 7;
    if (score >= 50) return 6;
    if (score >= 40) return 5;
    if (score >= 30) return 4;
    if (score >= 20) return 3;
    if (score >= 10) return 2;
    return 1;
  }

  /**
   * Calculate user percentile ranking
   */
  private async calculatePercentile(userId: string, score: number): Promise<number> {
    try {
      const { data: allScores } = await this.supabase
        .from('reputation_scores')
        .select('total_score')
        .order('total_score', { ascending: false });

      if (!allScores?.length) return 100;

      const lowerScores = allScores.filter(s => s.total_score < score).length;
      return (lowerScores / allScores.length) * 100;
    } catch (error) {
      console.warn(`Failed to calculate percentile: ${error}`);
      return 50;
    }
  }

  /**
   * Get user contributions from database
   */
  private async getUserContributions(userId: string): Promise<UserContribution[]> {
    try {
      const { data, error } = await this.supabase
        .from('contribution_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return data?.map(item => ({
        userId: item.user_id,
        type: item.contribution_type,
        content: item.content,
        metadata: item.metadata || {},
        timestamp: new Date(item.created_at),
        interactions: {
          likes: item.likes || 0,
          comments: item.comments || 0,
          shares: item.shares || 0,
          votes: item.votes || 0
        }
      })) || [];
    } catch (error) {
      throw new Error(`Failed to fetch user contributions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(userId: string): Promise<Record<string, number>> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_reputation_stats', { user_id: userId });

      if (error) throw error;

      return data || {
        totalContributions: 0,
        helpfulAnswers: 0,
        originalContributions: 0,
        communityEngagement: 0
      };
    } catch (error) {
      console.warn(`Failed to fetch user stats: ${error}`);
      return {
        totalContributions: 0,
        helpfulAnswers: 0,
        originalContributions: 0,
        communityEngagement: 0
      };
    }
  }

  /**
   * Get reputation history
   */
  private async get