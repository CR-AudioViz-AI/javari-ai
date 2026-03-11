import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';
import { AnalyticsService } from '@/services/analytics/service';
import { NotificationService } from '@/services/notifications/service';
import { EmailService } from '@/services/email/service';

/**
 * Brand Partnership Opportunity interface
 */
export interface BrandPartnershipOpportunity {
  id: string;
  brand_name: string;
  campaign_title: string;
  description: string;
  requirements: {
    min_followers: number;
    target_demographics: {
      age_ranges: string[];
      genders: string[];
      locations: string[];
      interests: string[];
    };
    content_themes: string[];
    min_engagement_rate: number;
    platform_requirements: string[];
  };
  budget: {
    min_amount: number;
    max_amount: number;
    currency: string;
    payment_type: 'flat_fee' | 'per_post' | 'revenue_share' | 'product_only';
  };
  timeline: {
    application_deadline: string;
    campaign_start: string;
    campaign_end: string;
  };
  status: 'active' | 'paused' | 'expired' | 'filled';
  created_at: string;
  updated_at: string;
}

/**
 * Creator Profile interface
 */
export interface CreatorProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  platforms: {
    platform: string;
    followers: number;
    engagement_rate: number;
    verified: boolean;
  }[];
  audience_demographics: {
    age_distribution: Record<string, number>;
    gender_distribution: Record<string, number>;
    location_distribution: Record<string, number>;
    interests: string[];
  };
  content_analytics: {
    primary_themes: string[];
    secondary_themes: string[];
    posting_frequency: number;
    avg_engagement_rate: number;
    performance_trends: Record<string, number>;
  };
  collaboration_preferences: {
    preferred_brands: string[];
    budget_range: {
      min: number;
      max: number;
    };
    content_types: string[];
    exclusions: string[];
  };
  created_at: string;
  updated_at: string;
}

/**
 * Compatibility Score breakdown
 */
export interface CompatibilityScore {
  overall_score: number;
  demographic_score: number;
  thematic_score: number;
  engagement_score: number;
  budget_score: number;
  timeline_score: number;
  breakdown: {
    demographic_factors: Record<string, number>;
    thematic_factors: Record<string, number>;
    engagement_factors: Record<string, number>;
  };
  confidence_level: 'high' | 'medium' | 'low';
}

/**
 * Match Result with explanation
 */
export interface MatchResult {
  opportunity: BrandPartnershipOpportunity;
  compatibility_score: CompatibilityScore;
  match_explanation: string;
  recommended_actions: string[];
  estimated_earnings: {
    min: number;
    max: number;
    currency: string;
  };
  application_priority: 'high' | 'medium' | 'low';
}

/**
 * Matching Algorithm strategies interface
 */
export interface MatchingAlgorithm {
  calculateDemographicScore(
    creatorDemographics: CreatorProfile['audience_demographics'],
    brandRequirements: BrandPartnershipOpportunity['requirements']['target_demographics']
  ): Promise<number>;
  
  calculateThematicScore(
    creatorThemes: string[],
    brandThemes: string[]
  ): Promise<number>;
  
  calculateEngagementScore(
    creatorEngagement: number,
    requiredEngagement: number
  ): Promise<number>;
}

/**
 * Creator Brand Matching Service
 * Matches creators with relevant brand partnership opportunities
 */
export class CreatorBrandMatchingService implements MatchingAlgorithm {
  private analyticsService: AnalyticsService;
  private notificationService: NotificationService;
  private emailService: EmailService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.notificationService = new NotificationService();
    this.emailService = new EmailService();
  }

  /**
   * Find matching brand partnership opportunities for a creator
   */
  async match(
    creatorId: string,
    filters?: {
      min_budget?: number;
      max_budget?: number;
      preferred_brands?: string[];
      content_types?: string[];
      exclude_applied?: boolean;
    }
  ): Promise<MatchResult[]> {
    try {
      // Get creator profile
      const creator = await this.getCreatorProfile(creatorId);
      if (!creator) {
        throw new Error('Creator profile not found');
      }

      // Get active partnership opportunities
      const opportunities = await this.getActiveOpportunities(filters);

      // Calculate compatibility scores for each opportunity
      const matches: MatchResult[] = [];
      
      for (const opportunity of opportunities) {
        const compatibilityScore = await this.calculateCompatibilityScore(creator, opportunity);
        
        // Only include matches above threshold
        if (compatibilityScore.overall_score >= 0.6) {
          const matchResult: MatchResult = {
            opportunity,
            compatibility_score: compatibilityScore,
            match_explanation: await this.generateMatchExplanation(creator, opportunity, compatibilityScore),
            recommended_actions: await this.generateRecommendedActions(creator, opportunity),
            estimated_earnings: this.calculateEstimatedEarnings(creator, opportunity),
            application_priority: this.determineApplicationPriority(compatibilityScore.overall_score)
          };
          
          matches.push(matchResult);
        }
      }

      // Sort by compatibility score
      matches.sort((a, b) => b.compatibility_score.overall_score - a.compatibility_score.overall_score);

      // Send match notifications if high-quality matches found
      const highQualityMatches = matches.filter(m => m.application_priority === 'high');
      if (highQualityMatches.length > 0) {
        await this.sendMatchNotifications(creator, highQualityMatches);
      }

      return matches;

    } catch (error) {
      console.error('Error in creator brand matching:', error);
      throw new Error(`Failed to find matching opportunities: ${error.message}`);
    }
  }

  /**
   * Calculate overall compatibility score between creator and opportunity
   */
  async calculateCompatibilityScore(
    creator: CreatorProfile,
    opportunity: BrandPartnershipOpportunity
  ): Promise<CompatibilityScore> {
    try {
      const demographicScore = await this.calculateDemographicScore(
        creator.audience_demographics,
        opportunity.requirements.target_demographics
      );

      const thematicScore = await this.calculateThematicScore(
        creator.content_analytics.primary_themes,
        opportunity.requirements.content_themes
      );

      const engagementScore = await this.calculateEngagementScore(
        creator.content_analytics.avg_engagement_rate,
        opportunity.requirements.min_engagement_rate
      );

      const budgetScore = this.calculateBudgetScore(creator, opportunity);
      const timelineScore = this.calculateTimelineScore(opportunity);

      // Weighted overall score
      const weights = {
        demographic: 0.25,
        thematic: 0.3,
        engagement: 0.25,
        budget: 0.1,
        timeline: 0.1
      };

      const overallScore = 
        demographicScore * weights.demographic +
        thematicScore * weights.thematic +
        engagementScore * weights.engagement +
        budgetScore * weights.budget +
        timelineScore * weights.timeline;

      return {
        overall_score: Math.round(overallScore * 100) / 100,
        demographic_score: Math.round(demographicScore * 100) / 100,
        thematic_score: Math.round(thematicScore * 100) / 100,
        engagement_score: Math.round(engagementScore * 100) / 100,
        budget_score: Math.round(budgetScore * 100) / 100,
        timeline_score: Math.round(timelineScore * 100) / 100,
        breakdown: {
          demographic_factors: await this.getDemographicFactors(creator, opportunity),
          thematic_factors: await this.getThematicFactors(creator, opportunity),
          engagement_factors: await this.getEngagementFactors(creator, opportunity)
        },
        confidence_level: this.determineConfidenceLevel(overallScore)
      };

    } catch (error) {
      console.error('Error calculating compatibility score:', error);
      throw new Error(`Failed to calculate compatibility: ${error.message}`);
    }
  }

  /**
   * Analyze audience demographic alignment
   */
  async analyzeAudienceAlignment(
    creatorId: string,
    opportunityId: string
  ): Promise<{
    alignment_score: number;
    demographic_overlap: Record<string, number>;
    gap_analysis: string[];
    recommendations: string[];
  }> {
    try {
      const creator = await this.getCreatorProfile(creatorId);
      const opportunity = await this.getOpportunityById(opportunityId);

      if (!creator || !opportunity) {
        throw new Error('Creator or opportunity not found');
      }

      const demographicScore = await this.calculateDemographicScore(
        creator.audience_demographics,
        opportunity.requirements.target_demographics
      );

      const overlap = await this.calculateDemographicOverlap(creator, opportunity);
      const gaps = await this.identifyDemographicGaps(creator, opportunity);
      const recommendations = await this.generateDemographicRecommendations(creator, opportunity, gaps);

      return {
        alignment_score: demographicScore,
        demographic_overlap: overlap,
        gap_analysis: gaps,
        recommendations
      };

    } catch (error) {
      console.error('Error analyzing audience alignment:', error);
      throw new Error(`Failed to analyze audience alignment: ${error.message}`);
    }
  }

  /**
   * Calculate demographic compatibility score
   */
  async calculateDemographicScore(
    creatorDemographics: CreatorProfile['audience_demographics'],
    brandRequirements: BrandPartnershipOpportunity['requirements']['target_demographics']
  ): Promise<number> {
    let totalScore = 0;
    let factors = 0;

    // Age alignment
    if (brandRequirements.age_ranges.length > 0) {
      const ageScore = this.calculateAgeAlignment(
        creatorDemographics.age_distribution,
        brandRequirements.age_ranges
      );
      totalScore += ageScore;
      factors++;
    }

    // Gender alignment
    if (brandRequirements.genders.length > 0) {
      const genderScore = this.calculateGenderAlignment(
        creatorDemographics.gender_distribution,
        brandRequirements.genders
      );
      totalScore += genderScore;
      factors++;
    }

    // Location alignment
    if (brandRequirements.locations.length > 0) {
      const locationScore = this.calculateLocationAlignment(
        creatorDemographics.location_distribution,
        brandRequirements.locations
      );
      totalScore += locationScore;
      factors++;
    }

    // Interest alignment
    if (brandRequirements.interests.length > 0) {
      const interestScore = this.calculateInterestAlignment(
        creatorDemographics.interests,
        brandRequirements.interests
      );
      totalScore += interestScore;
      factors++;
    }

    return factors > 0 ? totalScore / factors : 0;
  }

  /**
   * Calculate thematic compatibility using AI
   */
  async calculateThematicScore(creatorThemes: string[], brandThemes: string[]): Promise<number> {
    try {
      const prompt = `
        Analyze the semantic similarity between creator content themes and brand campaign themes.
        
        Creator themes: ${creatorThemes.join(', ')}
        Brand themes: ${brandThemes.join(', ')}
        
        Return a similarity score between 0 and 1, considering:
        - Direct theme matches
        - Semantic similarity
        - Complementary themes
        - Brand safety alignment
        
        Respond with only a decimal number between 0 and 1.
      `;

      const response = await openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt,
        max_tokens: 10,
        temperature: 0.1
      });

      const score = parseFloat(response.choices[0].text.trim());
      return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);

    } catch (error) {
      console.error('Error calculating thematic score:', error);
      // Fallback to simple keyword matching
      return this.calculateKeywordSimilarity(creatorThemes, brandThemes);
    }
  }

  /**
   * Calculate engagement score based on requirements
   */
  async calculateEngagementScore(creatorEngagement: number, requiredEngagement: number): Promise<number> {
    if (requiredEngagement <= 0) return 1;
    
    const ratio = creatorEngagement / requiredEngagement;
    
    // Score based on how much creator exceeds requirement
    if (ratio >= 2) return 1; // Double or more
    if (ratio >= 1.5) return 0.9; // 50% above
    if (ratio >= 1.2) return 0.8; // 20% above
    if (ratio >= 1) return 0.7; // Meets requirement
    if (ratio >= 0.8) return 0.5; // 20% below
    if (ratio >= 0.6) return 0.3; // 40% below
    
    return 0.1; // Significantly below
  }

  /**
   * Get creator profile from database
   */
  private async getCreatorProfile(creatorId: string): Promise<CreatorProfile | null> {
    const { data, error } = await supabase
      .from('creator_profiles')
      .select(`
        *,
        audience_demographics(*),
        content_analytics(*)
      `)
      .eq('id', creatorId)
      .single();

    if (error) {
      console.error('Error fetching creator profile:', error);
      return null;
    }

    return data;
  }

  /**
   * Get active partnership opportunities
   */
  private async getActiveOpportunities(filters?: any): Promise<BrandPartnershipOpportunity[]> {
    let query = supabase
      .from('brand_partnerships')
      .select('*')
      .eq('status', 'active')
      .gt('timeline->application_deadline', new Date().toISOString());

    if (filters?.min_budget) {
      query = query.gte('budget->min_amount', filters.min_budget);
    }

    if (filters?.max_budget) {
      query = query.lte('budget->max_amount', filters.max_budget);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching opportunities:', error);
      throw new Error('Failed to fetch opportunities');
    }

    return data || [];
  }

  /**
   * Get specific opportunity by ID
   */
  private async getOpportunityById(opportunityId: string): Promise<BrandPartnershipOpportunity | null> {
    const { data, error } = await supabase
      .from('brand_partnerships')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (error) {
      console.error('Error fetching opportunity:', error);
      return null;
    }

    return data;
  }

  /**
   * Calculate budget compatibility score
   */
  private calculateBudgetScore(creator: CreatorProfile, opportunity: BrandPartnershipOpportunity): number {
    const creatorMin = creator.collaboration_preferences.budget_range.min;
    const creatorMax = creator.collaboration_preferences.budget_range.max;
    const brandMin = opportunity.budget.min_amount;
    const brandMax = opportunity.budget.max_amount;

    // Check for overlap
    if (brandMax < creatorMin || brandMin > creatorMax) {
      return 0; // No overlap
    }

    // Calculate overlap ratio
    const overlapMin = Math.max(creatorMin, brandMin);
    const overlapMax = Math.min(creatorMax, brandMax);
    const overlapRange = overlapMax - overlapMin;
    const creatorRange = creatorMax - creatorMin;

    return overlapRange / Math.max(creatorRange, 1);
  }

  /**
   * Calculate timeline score based on urgency and duration
   */
  private calculateTimelineScore(opportunity: BrandPartnershipOpportunity): number {
    const now = new Date();
    const deadline = new Date(opportunity.timeline.application_deadline);
    const campaignStart = new Date(opportunity.timeline.campaign_start);
    
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilStart = Math.ceil((campaignStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Prefer opportunities with reasonable time to apply and prepare
    if (daysUntilDeadline < 1) return 0.1; // Very urgent
    if (daysUntilDeadline < 3) return 0.5; // Urgent
    if (daysUntilDeadline < 7) return 0.8; // Good timing
    if (daysUntilDeadline < 30) return 1.0; // Optimal timing
    
    return 0.7; // Far future
  }

  /**
   * Generate match explanation using AI
   */
  private async generateMatchExplanation(
    creator: CreatorProfile,
    opportunity: BrandPartnershipOpportunity,
    score: CompatibilityScore
  ): Promise<string> {
    try {
      const prompt = `
        Generate a brief explanation for why this brand partnership opportunity matches well with this creator:
        
        Creator: ${creator.display_name}
        - Primary themes: ${creator.content_analytics.primary_themes.join(', ')}
        - Engagement rate: ${creator.content_analytics.avg_engagement_rate}%
        - Top audience interests: ${creator.audience_demographics.interests.slice(0, 3).join(', ')}
        
        Brand Campaign: ${opportunity.campaign_title}
        - Brand: ${opportunity.brand_name}
        - Required themes: ${opportunity.requirements.content_themes.join(', ')}
        - Target interests: ${opportunity.requirements.target_demographics.interests.slice(0, 3).join(', ')}
        
        Overall compatibility score: ${score.overall_score}
        
        Write a concise 2-3 sentence explanation highlighting the strongest alignment factors.
      `;

      const response = await openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt,
        max_tokens: 150,
        temperature: 0.3
      });

      return response.choices[0].text.trim();

    } catch (error) {
      console.error('Error generating explanation:', error);
      return `This opportunity matches your content focus on ${creator.content_analytics.primary_themes[0]} and aligns with your audience interests. Your ${creator.content_analytics.avg_engagement_rate}% engagement rate meets the campaign requirements.`;
    }
  }

  /**
   * Generate recommended actions for the creator
   */
  private async generateRecommendedActions(
    creator: CreatorProfile,
    opportunity: BrandPartnershipOpportunity
  ): Promise<string[]> {
    const actions: string[] = [];
    
    // Review application deadline
    const deadline = new Date(opportunity.timeline.application_deadline);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 3) {
      actions.push('Apply immediately - deadline is in ' + daysLeft + ' days');
    } else if (daysLeft <= 7) {
      actions.push('Prepare application soon - deadline approaching');
    }

    // Content preparation
    if (opportunity.requirements.content_themes.some(theme => 
      !creator.content_analytics.primary_themes.includes(theme)
    )) {
      actions.push('Create sample content showcasing relevant themes');
    }

    // Portfolio update
    actions.push('Update portfolio with best-performing content');

    // Engagement optimization
    if (creator.content_analytics.avg_engagement_rate < opportunity.requirements.min_engagement_rate * 1.2) {
      actions.push('Focus on increasing engagement rate before applying');
    }

    return actions;
  }

  /**
   * Calculate estimated earnings for the creator
   */
  private calculateEstimatedEarnings(
    creator: CreatorProfile,
    opportunity: BrandPartnershipOpportunity
  ): { min: number; max: number; currency: string } {
    let min = opportunity.budget.min_amount;
    let max = opportunity.budget.max_amount;

    // Adjust based on creator's follower count and engagement
    const totalFollowers = creator.platforms.reduce((sum, p) => sum + p.followers, 0);
    const avgEngagement = creator.content_analytics.avg_engagement_rate;

    // Premium for high engagement
    if (avgEngagement > 5) {
      min *= 1.2;
      max *= 1.2;
    }

    // Premium for large audience
    if (totalFollowers > 100000) {
      min *= 1.1;
      max *= 1.1;
    }

    return {
      min: Math.round(min),
      max: Math.round(max),
      currency: opportunity.budget.currency
    };
  }

  /**
   * Determine application priority based on score
   */
  private determineApplicationPriority(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.85) return 'high';
    if (score >= 0.7) return 'medium';
    return 'low';
  }

  /**
   * Send match notifications to creator
   */
  private async sendMatchNotifications(
    creator: CreatorProfile,
    matches: MatchResult[]
  ): Promise<void> {
    try {
      // Send in-app notification
      await this.notificationService.send({
        user_id: creator.user_id,
        type: 'brand_match',
        title: `${matches.length} New Brand Partnership${matches.length > 1 ? 's' : ''} Found!`,
        message: `We found ${matches.length} brand partnership opportunities that match your profile.`,
        data: {
          match_count: matches.length,
          top_match: matches[0].opportunity.brand_name
        }
      });

      // Send email summary
      await this.emailService.sendBrandMatchSummary({
        to: creator.user_id,
        creator_name: creator.display_name,
        matches: matches.slice(0, 3) // Top 3 matches