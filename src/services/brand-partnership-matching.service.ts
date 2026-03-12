```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { PineconeClient } from '@pinecone-database/pinecone';
import Redis from 'ioredis';
import { z } from 'zod';

/**
 * Creator profile interface with audience demographics and content data
 */
export interface CreatorProfile {
  id: string;
  userId: string;
  username: string;
  platform: string;
  followerCount: number;
  averageViews: number;
  engagementRate: number;
  contentCategories: string[];
  audienceDemographics: {
    ageGroups: Record<string, number>;
    genderDistribution: Record<string, number>;
    topLocations: string[];
    interests: string[];
  };
  contentThemes: string[];
  recentContent: ContentItem[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Brand campaign interface with requirements and targeting
 */
export interface BrandCampaign {
  id: string;
  brandId: string;
  brandName: string;
  campaignName: string;
  description: string;
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  targetAudience: {
    ageGroups: string[];
    genders: string[];
    locations: string[];
    interests: string[];
  };
  contentRequirements: {
    platforms: string[];
    contentTypes: string[];
    themes: string[];
    minFollowers: number;
    minEngagementRate: number;
  };
  campaignDuration: {
    startDate: Date;
    endDate: Date;
  };
  deliverables: string[];
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
}

/**
 * Content item for analysis
 */
export interface ContentItem {
  id: string;
  title: string;
  description: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  publishedAt: Date;
  tags: string[];
  thumbnailUrl?: string;
}

/**
 * Partnership match result
 */
export interface PartnershipMatch {
  id: string;
  creatorId: string;
  campaignId: string;
  compatibilityScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  matchReasons: string[];
  audienceOverlap: number;
  contentSimilarity: number;
  engagementScore: number;
  estimatedReach: number;
  suggestedCompensation: {
    min: number;
    max: number;
    currency: string;
  };
  risks: string[];
  recommendations: string[];
  matchedAt: Date;
}

/**
 * Engagement analysis result
 */
export interface EngagementAnalysis {
  overallScore: number;
  consistencyScore: number;
  qualityScore: number;
  trendScore: number;
  audienceGrowthRate: number;
  avgEngagementRate: number;
  peakEngagementHours: number[];
  topPerformingContentTypes: string[];
}

/**
 * Vector similarity result
 */
export interface VectorSimilarityResult {
  similarity: number;
  matchedThemes: string[];
  semanticDistance: number;
  confidenceScore: number;
}

/**
 * Service configuration schema
 */
const ConfigSchema = z.object({
  supabase: z.object({
    url: z.string(),
    key: z.string(),
  }),
  openai: z.object({
    apiKey: z.string(),
  }),
  pinecone: z.object({
    apiKey: z.string(),
    environment: z.string(),
    indexName: z.string(),
  }),
  redis: z.object({
    url: z.string(),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

/**
 * AI-powered brand partnership matching service
 * Analyzes creator profiles and matches them with relevant brand campaigns
 * using machine learning algorithms and vector similarity search
 */
export class BrandPartnershipMatchingService {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private pinecone: PineconeClient;
  private redis: Redis;
  private config: Config;

  constructor(config: Config) {
    this.config = ConfigSchema.parse(config);
    
    this.supabase = createClient(
      this.config.supabase.url,
      this.config.supabase.key
    );
    
    this.openai = new OpenAI({
      apiKey: this.config.openai.apiKey,
    });
    
    this.pinecone = new PineconeClient();
    this.redis = new Redis(this.config.redis.url);
  }

  /**
   * Initialize the service and connections
   */
  public async initialize(): Promise<void> {
    try {
      await this.pinecone.init({
        apiKey: this.config.pinecone.apiKey,
        environment: this.config.pinecone.environment,
      });

      await this.redis.ping();
      
      console.log('Brand Partnership Matching Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize service: ${error}`);
    }
  }

  /**
   * Find matching brand partnerships for a creator
   */
  public async findMatches(
    creatorId: string,
    options: {
      limit?: number;
      minCompatibilityScore?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<PartnershipMatch[]> {
    const {
      limit = 10,
      minCompatibilityScore = 0.6,
      includeInactive = false,
    } = options;

    try {
      // Get creator profile
      const creator = await this.getCreatorProfile(creatorId);
      if (!creator) {
        throw new Error(`Creator profile not found: ${creatorId}`);
      }

      // Get active brand campaigns
      const campaigns = await this.getActiveBrandCampaigns(includeInactive);

      // Analyze creator content and engagement
      const creatorAnalysis = await this.analyzeCreatorProfile(creator);

      // Find matches using multiple algorithms
      const matches: PartnershipMatch[] = [];

      for (const campaign of campaigns) {
        const match = await this.scoreCompatibility(
          creator,
          campaign,
          creatorAnalysis
        );

        if (match.compatibilityScore >= minCompatibilityScore) {
          matches.push(match);
        }
      }

      // Sort by compatibility score and limit results
      const sortedMatches = matches
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, limit);

      // Store matches in database
      await this.storeMatches(sortedMatches);

      return sortedMatches;
    } catch (error) {
      throw new Error(`Failed to find matches: ${error}`);
    }
  }

  /**
   * Score compatibility between creator and brand campaign
   */
  public async scoreCompatibility(
    creator: CreatorProfile,
    campaign: BrandCampaign,
    creatorAnalysis?: EngagementAnalysis
  ): Promise<PartnershipMatch> {
    try {
      const analysis = creatorAnalysis || await this.analyzeCreatorProfile(creator);

      // Calculate different compatibility dimensions
      const audienceScore = this.calculateAudienceCompatibility(
        creator.audienceDemographics,
        campaign.targetAudience
      );

      const contentScore = await this.calculateContentSimilarity(
        creator.contentThemes,
        campaign.contentRequirements.themes
      );

      const engagementScore = this.calculateEngagementScore(
        creator,
        campaign.contentRequirements
      );

      const reachScore = this.calculateReachScore(
        creator.followerCount,
        creator.averageViews,
        campaign.targetAudience
      );

      // Weighted compatibility scoring
      const weights = {
        audience: 0.3,
        content: 0.25,
        engagement: 0.25,
        reach: 0.2,
      };

      const compatibilityScore = Math.min(1.0,
        (audienceScore * weights.audience) +
        (contentScore * weights.content) +
        (engagementScore * weights.engagement) +
        (reachScore * weights.reach)
      );

      // Generate match insights
      const matchReasons = this.generateMatchReasons(
        audienceScore,
        contentScore,
        engagementScore,
        reachScore
      );

      const risks = this.identifyRisks(creator, campaign, compatibilityScore);
      const recommendations = this.generateRecommendations(creator, campaign);

      // Estimate compensation
      const suggestedCompensation = this.estimateCompensation(
        creator,
        campaign,
        compatibilityScore
      );

      return {
        id: `match_${creator.id}_${campaign.id}_${Date.now()}`,
        creatorId: creator.id,
        campaignId: campaign.id,
        compatibilityScore,
        confidenceLevel: this.getConfidenceLevel(compatibilityScore),
        matchReasons,
        audienceOverlap: audienceScore,
        contentSimilarity: contentScore,
        engagementScore,
        estimatedReach: Math.floor(creator.followerCount * creator.engagementRate),
        suggestedCompensation,
        risks,
        recommendations,
        matchedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to score compatibility: ${error}`);
    }
  }

  /**
   * Analyze creator profile for engagement patterns and content themes
   */
  private async analyzeCreatorProfile(creator: CreatorProfile): Promise<EngagementAnalysis> {
    const cacheKey = `creator_analysis:${creator.id}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate engagement metrics
      const engagementRates = creator.recentContent.map(content => {
        const totalEngagements = content.likes + content.comments + content.shares;
        return content.views > 0 ? totalEngagements / content.views : 0;
      });

      const avgEngagementRate = engagementRates.length > 0 
        ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length
        : 0;

      // Calculate consistency score
      const engagementVariance = this.calculateVariance(engagementRates);
      const consistencyScore = Math.max(0, 1 - engagementVariance);

      // Calculate trend score
      const recentEngagement = engagementRates.slice(-5).reduce((sum, rate) => sum + rate, 0) / 5;
      const olderEngagement = engagementRates.slice(0, -5).reduce((sum, rate) => sum + rate, 0) / Math.max(1, engagementRates.length - 5);
      const trendScore = olderEngagement > 0 ? Math.min(2, recentEngagement / olderEngagement) / 2 : 0.5;

      // Analyze content performance
      const topPerformingContent = creator.recentContent
        .sort((a, b) => {
          const aScore = (a.likes + a.comments + a.shares) / Math.max(1, a.views);
          const bScore = (b.likes + b.comments + b.shares) / Math.max(1, b.views);
          return bScore - aScore;
        })
        .slice(0, 3);

      const topPerformingContentTypes = [...new Set(
        topPerformingContent.map(content => this.inferContentType(content.title, content.tags))
      )];

      const analysis: EngagementAnalysis = {
        overallScore: Math.min(1, (consistencyScore + trendScore + avgEngagementRate) / 3),
        consistencyScore,
        qualityScore: avgEngagementRate,
        trendScore,
        audienceGrowthRate: 0.05, // Would need historical data
        avgEngagementRate,
        peakEngagementHours: [18, 19, 20, 21], // Default peak hours
        topPerformingContentTypes,
      };

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(analysis));

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze creator profile: ${error}`);
    }
  }

  /**
   * Calculate audience compatibility score
   */
  private calculateAudienceCompatibility(
    creatorAudience: CreatorProfile['audienceDemographics'],
    targetAudience: BrandCampaign['targetAudience']
  ): number {
    let score = 0;
    let totalWeight = 0;

    // Age group compatibility
    const ageWeight = 0.4;
    let ageOverlap = 0;
    for (const ageGroup of targetAudience.ageGroups) {
      ageOverlap += creatorAudience.ageGroups[ageGroup] || 0;
    }
    score += ageOverlap * ageWeight;
    totalWeight += ageWeight;

    // Gender compatibility
    const genderWeight = 0.2;
    let genderOverlap = 0;
    for (const gender of targetAudience.genders) {
      genderOverlap += creatorAudience.genderDistribution[gender] || 0;
    }
    score += genderOverlap * genderWeight;
    totalWeight += genderWeight;

    // Location compatibility
    const locationWeight = 0.2;
    const locationOverlap = targetAudience.locations.filter(loc =>
      creatorAudience.topLocations.includes(loc)
    ).length / Math.max(1, targetAudience.locations.length);
    score += locationOverlap * locationWeight;
    totalWeight += locationWeight;

    // Interest compatibility
    const interestWeight = 0.2;
    const interestOverlap = targetAudience.interests.filter(interest =>
      creatorAudience.interests.includes(interest)
    ).length / Math.max(1, targetAudience.interests.length);
    score += interestOverlap * interestWeight;
    totalWeight += interestWeight;

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculate content similarity using vector embeddings
   */
  private async calculateContentSimilarity(
    creatorThemes: string[],
    campaignThemes: string[]
  ): Promise<number> {
    try {
      if (creatorThemes.length === 0 || campaignThemes.length === 0) {
        return 0;
      }

      // Get embeddings for creator themes
      const creatorEmbedding = await this.getContentEmbedding(creatorThemes.join(' '));
      const campaignEmbedding = await this.getContentEmbedding(campaignThemes.join(' '));

      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(creatorEmbedding, campaignEmbedding);
      
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      console.warn(`Failed to calculate content similarity: ${error}`);
      // Fallback to keyword overlap
      return this.calculateKeywordOverlap(creatorThemes, campaignThemes);
    }
  }

  /**
   * Get content embedding using OpenAI
   */
  private async getContentEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      const embedding = response.data[0].embedding;
      
      // Cache for 24 hours
      await this.redis.setex(cacheKey, 86400, JSON.stringify(embedding));

      return embedding;
    } catch (error) {
      throw new Error(`Failed to get content embedding: ${error}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate keyword overlap as fallback similarity measure
   */
  private calculateKeywordOverlap(themes1: string[], themes2: string[]): number {
    const set1 = new Set(themes1.map(t => t.toLowerCase()));
    const set2 = new Set(themes2.map(t => t.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate engagement score against campaign requirements
   */
  private calculateEngagementScore(
    creator: CreatorProfile,
    requirements: BrandCampaign['contentRequirements']
  ): number {
    // Check minimum followers requirement
    const followersScore = creator.followerCount >= requirements.minFollowers ? 1 : 
      creator.followerCount / requirements.minFollowers;

    // Check minimum engagement rate requirement
    const engagementScore = creator.engagementRate >= requirements.minEngagementRate ? 1 :
      creator.engagementRate / requirements.minEngagementRate;

    // Platform compatibility
    const platformScore = requirements.platforms.includes(creator.platform) ? 1 : 0;

    return (followersScore * 0.4 + engagementScore * 0.4 + platformScore * 0.2);
  }

  /**
   * Calculate reach score based on audience size and engagement
   */
  private calculateReachScore(
    followerCount: number,
    averageViews: number,
    targetAudience: BrandCampaign['targetAudience']
  ): number {
    // Normalize follower count (1M followers = 1.0 score)
    const followersScore = Math.min(1, followerCount / 1000000);
    
    // Calculate view rate
    const viewRate = followerCount > 0 ? averageViews / followerCount : 0;
    const viewScore = Math.min(1, viewRate * 2); // 50% view rate = 1.0 score
    
    return (followersScore + viewScore) / 2;
  }

  /**
   * Generate reasons for the match
   */
  private generateMatchReasons(
    audienceScore: number,
    contentScore: number,
    engagementScore: number,
    reachScore: number
  ): string[] {
    const reasons: string[] = [];

    if (audienceScore > 0.8) {
      reasons.push('Excellent audience demographic alignment');
    } else if (audienceScore > 0.6) {
      reasons.push('Good audience demographic match');
    }

    if (contentScore > 0.8) {
      reasons.push('Strong content theme similarity');
    } else if (contentScore > 0.6) {
      reasons.push('Relevant content themes');
    }

    if (engagementScore > 0.8) {
      reasons.push('High engagement rate meets requirements');
    } else if (engagementScore > 0.6) {
      reasons.push('Satisfactory engagement metrics');
    }

    if (reachScore > 0.7) {
      reasons.push('Large potential reach');
    }

    return reasons;
  }

  /**
   * Identify potential risks in the partnership
   */
  private identifyRisks(
    creator: CreatorProfile,
    campaign: BrandCampaign,
    compatibilityScore: number
  ): string[] {
    const risks: string[] = [];

    if (compatibilityScore < 0.7) {
      risks.push('Moderate compatibility score may indicate limited alignment');
    }

    if (creator.followerCount < campaign.contentRequirements.minFollowers * 1.2) {
      risks.push('Follower count is close to minimum requirement');
    }

    if (creator.engagementRate < campaign.contentRequirements.minEngagementRate * 1.2) {
      risks.push('Engagement rate is close to minimum requirement');
    }

    // Check for content category mismatch
    const hasRelevantCategory = creator.contentCategories.some(category =>
      campaign.contentRequirements.themes.some(theme =>
        theme.toLowerCase().includes(category.toLowerCase())
      )
    );

    if (!hasRelevantCategory) {
      risks.push('Limited overlap in content categories');
    }

    return risks;
  }

  /**
   * Generate recommendations for the partnership
   */
  private generateRecommendations(
    creator: CreatorProfile,
    campaign: BrandCampaign
  ): string[] {
    const recommendations: string[] = [];

    recommendations.push(`Focus on ${campaign.contentRequirements.themes.slice(0, 2).join(' and ')} content themes`);
    recommendations.push(`Target content for ${campaign.targetAudience.ageGroups.join(' and ')} age groups`);
    
    if (campaign.contentRequirements.contentTypes.length > 0) {
      recommendations.push(`Consider creating ${campaign.contentRequirements.contentTypes[0]} content format`);
    }

    recommendations.push('Maintain consistent posting schedule during campaign period');

    return recommendations;
  }

  /**
   * Estimate compensation based on creator metrics and campaign budget
   */
  private estimateCompensation(
    creator: CreatorProfile,
    campaign: BrandCampaign,
    compatibilityScore: number
  ): { min: number; max: number; currency: string } {
    // Base rate per 1000 followers
    const baseRate = 10; // $10 per 1000 followers
    const followerRate = (creator.followerCount / 1000) * baseRate;

    // Engagement multiplier
    const engagementMultiplier = 1 + creator.engagementRate * 2;

    // Compatibility