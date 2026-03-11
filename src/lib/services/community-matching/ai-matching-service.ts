```typescript
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * User profile data structure for AI matching
 */
export interface UserProfile {
  id: string;
  demographics: {
    location?: string;
    timezone?: string;
    experience_level?: string;
  };
  preferences: {
    collaboration_style?: string[];
    project_types?: string[];
    communication_frequency?: string;
  };
  interests: string[];
  skills: Array<{
    name: string;
    level: number;
    endorsements: number;
  }>;
  activity_patterns: {
    active_hours: number[];
    engagement_frequency: number;
    content_types_engaged: string[];
    collaboration_history: number;
  };
}

/**
 * Matching result with similarity scores
 */
export interface MatchingResult {
  user_id: string;
  matched_user_id: string;
  overall_score: number;
  scores: {
    interest_similarity: number;
    skill_complementarity: number;
    collaboration_potential: number;
    activity_alignment: number;
  };
  reasons: string[];
  confidence: number;
  match_type: 'similar_interests' | 'complementary_skills' | 'collaboration_potential';
}

/**
 * Batch matching configuration
 */
export interface BatchMatchingConfig {
  min_score_threshold: number;
  max_matches_per_user: number;
  include_existing_connections: boolean;
  match_types: string[];
}

/**
 * Validation schemas
 */
const UserProfileSchema = z.object({
  id: z.string(),
  demographics: z.object({
    location: z.string().optional(),
    timezone: z.string().optional(),
    experience_level: z.string().optional(),
  }),
  preferences: z.object({
    collaboration_style: z.array(z.string()).optional(),
    project_types: z.array(z.string()).optional(),
    communication_frequency: z.string().optional(),
  }),
  interests: z.array(z.string()),
  skills: z.array(z.object({
    name: z.string(),
    level: z.number().min(1).max(5),
    endorsements: z.number().min(0),
  })),
  activity_patterns: z.object({
    active_hours: z.array(z.number().min(0).max(23)),
    engagement_frequency: z.number().min(0),
    content_types_engaged: z.array(z.string()),
    collaboration_history: z.number().min(0),
  }),
});

const BatchMatchingConfigSchema = z.object({
  min_score_threshold: z.number().min(0).max(1),
  max_matches_per_user: z.number().min(1).max(50),
  include_existing_connections: z.boolean(),
  match_types: z.array(z.string()),
});

/**
 * Custom errors for AI matching service
 */
export class AIMatchingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AIMatchingError';
  }
}

/**
 * User Profile Analyzer for extracting behavioral patterns
 */
class UserProfileAnalyzer {
  /**
   * Extract feature vectors from user profile
   */
  static extractFeatureVector(profile: UserProfile): number[] {
    const features: number[] = [];
    
    // Activity pattern features
    features.push(
      profile.activity_patterns.engagement_frequency,
      profile.activity_patterns.collaboration_history,
      profile.activity_patterns.active_hours.length / 24 // activity spread
    );
    
    // Skill features
    const avgSkillLevel = profile.skills.reduce((sum, skill) => sum + skill.level, 0) / profile.skills.length || 0;
    const totalEndorsements = profile.skills.reduce((sum, skill) => sum + skill.endorsements, 0);
    features.push(avgSkillLevel, totalEndorsements);
    
    // Interest diversity
    features.push(profile.interests.length);
    
    // Experience level encoding
    const experienceLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const experienceIndex = experienceLevels.indexOf(profile.demographics.experience_level || 'intermediate');
    features.push(experienceIndex / experienceLevels.length);
    
    return features;
  }

  /**
   * Calculate activity alignment score between two users
   */
  static calculateActivityAlignment(profile1: UserProfile, profile2: UserProfile): number {
    const hours1 = new Set(profile1.activity_patterns.active_hours);
    const hours2 = new Set(profile2.activity_patterns.active_hours);
    
    const intersection = new Set([...hours1].filter(x => hours2.has(x)));
    const union = new Set([...hours1, ...hours2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

/**
 * Skill Complementarity Engine for identifying skill gaps and matches
 */
class SkillComplementarityEngine {
  /**
   * Calculate skill complementarity score between two users
   */
  static calculateComplementarity(profile1: UserProfile, profile2: UserProfile): number {
    const skills1Map = new Map(profile1.skills.map(s => [s.name, s.level]));
    const skills2Map = new Map(profile2.skills.map(s => [s.name, s.level]));
    
    let complementarityScore = 0;
    let totalComparisons = 0;
    
    // Find complementary skills (one high, one low)
    for (const [skill, level1] of skills1Map) {
      const level2 = skills2Map.get(skill) || 0;
      if (level2 > 0) {
        const levelDiff = Math.abs(level1 - level2);
        if (levelDiff >= 2) {
          complementarityScore += levelDiff / 4; // Normalize to 0-1
        }
        totalComparisons++;
      }
    }
    
    // Check for unique skills that could be shared
    const uniqueSkills1 = [...skills1Map.keys()].filter(skill => !skills2Map.has(skill));
    const uniqueSkills2 = [...skills2Map.keys()].filter(skill => !skills1Map.has(skill));
    
    const uniqueBonus = (uniqueSkills1.length + uniqueSkills2.length) * 0.1;
    complementarityScore += Math.min(uniqueBonus, 0.5);
    
    return totalComparisons > 0 ? Math.min(complementarityScore / Math.max(totalComparisons, 1), 1) : uniqueBonus;
  }

  /**
   * Identify skill gaps that could be filled by potential matches
   */
  static identifySkillGaps(profile: UserProfile, potentialMatch: UserProfile): string[] {
    const userSkills = new Set(profile.skills.map(s => s.name));
    const matchSkills = potentialMatch.skills.filter(s => s.level >= 3); // High-level skills
    
    return matchSkills
      .filter(skill => !userSkills.has(skill.name))
      .map(skill => skill.name);
  }
}

/**
 * Interest Similarity Calculator using cosine similarity
 */
class InterestSimilarityCalculator {
  /**
   * Calculate cosine similarity between interest vectors
   */
  static calculateCosineSimilarity(interests1: string[], interests2: string[]): number {
    const allInterests = [...new Set([...interests1, ...interests2])];
    
    if (allInterests.length === 0) return 0;
    
    const vector1 = allInterests.map(interest => interests1.includes(interest) ? 1 : 0);
    const vector2 = allInterests.map(interest => interests2.includes(interest) ? 1 : 0);
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate semantic similarity using embeddings
   */
  static async calculateSemanticSimilarity(
    interests1: string[],
    interests2: string[],
    openai: OpenAI
  ): Promise<number> {
    try {
      if (interests1.length === 0 || interests2.length === 0) return 0;
      
      const text1 = interests1.join(' ');
      const text2 = interests2.join(' ');
      
      const [embedding1, embedding2] = await Promise.all([
        openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text1,
        }),
        openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text2,
        }),
      ]);
      
      const vec1 = embedding1.data[0].embedding;
      const vec2 = embedding2.data[0].embedding;
      
      const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
      const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
      
      return dotProduct / (magnitude1 * magnitude2);
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      return this.calculateCosineSimilarity(interests1, interests2);
    }
  }
}

/**
 * Collaboration Potential Scorer with ML prediction models
 */
class CollaborationPotentialScorer {
  /**
   * Predict collaboration success probability
   */
  static predictCollaborationSuccess(
    profile1: UserProfile,
    profile2: UserProfile
  ): number {
    let score = 0;
    
    // Communication frequency compatibility
    const commFreq1 = profile1.preferences.communication_frequency;
    const commFreq2 = profile2.preferences.communication_frequency;
    if (commFreq1 && commFreq2 && commFreq1 === commFreq2) {
      score += 0.2;
    }
    
    // Collaboration style compatibility
    const styles1 = profile1.preferences.collaboration_style || [];
    const styles2 = profile2.preferences.collaboration_style || [];
    const styleOverlap = styles1.filter(style => styles2.includes(style)).length;
    score += Math.min(styleOverlap / Math.max(styles1.length, styles2.length, 1), 0.3);
    
    // Project type alignment
    const projects1 = profile1.preferences.project_types || [];
    const projects2 = profile2.preferences.project_types || [];
    const projectOverlap = projects1.filter(project => projects2.includes(project)).length;
    score += Math.min(projectOverlap / Math.max(projects1.length, projects2.length, 1), 0.3);
    
    // Experience level balance
    const exp1 = profile1.demographics.experience_level || 'intermediate';
    const exp2 = profile2.demographics.experience_level || 'intermediate';
    const expLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const expDiff = Math.abs(expLevels.indexOf(exp1) - expLevels.indexOf(exp2));
    score += expDiff <= 1 ? 0.2 : 0.1; // Slight preference for similar experience levels
    
    return Math.min(score, 1);
  }
}

/**
 * Matching Results Formatter for ranked recommendations
 */
class MatchingResultsFormatter {
  /**
   * Format and rank matching results
   */
  static formatResults(
    userId: string,
    matches: Array<{
      profile: UserProfile;
      scores: MatchingResult['scores'];
      reasons: string[];
    }>
  ): MatchingResult[] {
    return matches
      .map(match => {
        const overallScore = this.calculateOverallScore(match.scores);
        const matchType = this.determineMatchType(match.scores);
        
        return {
          user_id: userId,
          matched_user_id: match.profile.id,
          overall_score: overallScore,
          scores: match.scores,
          reasons: match.reasons,
          confidence: this.calculateConfidence(match.scores),
          match_type: matchType,
        };
      })
      .sort((a, b) => b.overall_score - a.overall_score);
  }

  /**
   * Calculate weighted overall score
   */
  private static calculateOverallScore(scores: MatchingResult['scores']): number {
    const weights = {
      interest_similarity: 0.3,
      skill_complementarity: 0.3,
      collaboration_potential: 0.25,
      activity_alignment: 0.15,
    };
    
    return (
      scores.interest_similarity * weights.interest_similarity +
      scores.skill_complementarity * weights.skill_complementarity +
      scores.collaboration_potential * weights.collaboration_potential +
      scores.activity_alignment * weights.activity_alignment
    );
  }

  /**
   * Determine primary match type based on highest scoring dimension
   */
  private static determineMatchType(scores: MatchingResult['scores']): MatchingResult['match_type'] {
    const maxScore = Math.max(
      scores.interest_similarity,
      scores.skill_complementarity,
      scores.collaboration_potential
    );
    
    if (scores.interest_similarity === maxScore) return 'similar_interests';
    if (scores.skill_complementarity === maxScore) return 'complementary_skills';
    return 'collaboration_potential';
  }

  /**
   * Calculate confidence score based on score distribution
   */
  private static calculateConfidence(scores: MatchingResult['scores']): number {
    const scoreArray = Object.values(scores);
    const avg = scoreArray.reduce((sum, score) => sum + score, 0) / scoreArray.length;
    const variance = scoreArray.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scoreArray.length;
    
    // Higher confidence when scores are consistently high, lower when highly variable
    return Math.max(0, Math.min(1, avg - Math.sqrt(variance)));
  }
}

/**
 * AI-Powered Community Matching Service
 * 
 * Machine learning service that analyzes user behavior patterns, preferences,
 * and skills to recommend optimal community member connections for collaboration
 * and shared interests.
 */
export class AIMatchingService {
  private openai: OpenAI;
  private supabase: any;

  constructor(
    openaiApiKey: string,
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Find matches for a specific user
   */
  async findMatches(
    userId: string,
    options: {
      limit?: number;
      minScore?: number;
      excludeUserIds?: string[];
    } = {}
  ): Promise<MatchingResult[]> {
    try {
      const { limit = 10, minScore = 0.3, excludeUserIds = [] } = options;

      // Get user profile
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        throw new AIMatchingError('User profile not found', 'PROFILE_NOT_FOUND', 404);
      }

      // Get potential matches
      const potentialMatches = await this.getPotentialMatches(userId, excludeUserIds);

      // Calculate matches
      const matches = await Promise.all(
        potentialMatches.map(async (candidateProfile) => {
          const scores = await this.calculateMatchScores(userProfile, candidateProfile);
          const reasons = this.generateMatchReasons(userProfile, candidateProfile, scores);

          return {
            profile: candidateProfile,
            scores,
            reasons,
          };
        })
      );

      // Filter by minimum score
      const filteredMatches = matches.filter(
        match => this.calculateOverallScore(match.scores) >= minScore
      );

      // Format and rank results
      const formattedResults = MatchingResultsFormatter.formatResults(userId, filteredMatches);

      // Store results in database
      await this.storeMatchingResults(formattedResults.slice(0, limit));

      return formattedResults.slice(0, limit);
    } catch (error) {
      if (error instanceof AIMatchingError) throw error;
      throw new AIMatchingError(
        `Failed to find matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MATCHING_FAILED'
      );
    }
  }

  /**
   * Process batch matching for all community members
   */
  async processBatchMatching(config: BatchMatchingConfig): Promise<{
    processed: number;
    matches_generated: number;
    processing_time: number;
  }> {
    try {
      BatchMatchingConfigSchema.parse(config);
      
      const startTime = Date.now();
      let processedCount = 0;
      let matchesGenerated = 0;

      // Get all user profiles
      const { data: userProfiles, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      // Process matches in batches
      for (const userProfile of userProfiles) {
        try {
          const matches = await this.findMatches(userProfile.id, {
            limit: config.max_matches_per_user,
            minScore: config.min_score_threshold,
          });

          matchesGenerated += matches.length;
          processedCount++;
        } catch (error) {
          console.error(`Failed to process matches for user ${userProfile.id}:`, error);
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        processed: processedCount,
        matches_generated: matchesGenerated,
        processing_time: processingTime,
      };
    } catch (error) {
      throw new AIMatchingError(
        `Batch matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BATCH_MATCHING_FAILED'
      );
    }
  }

  /**
   * Get user profile with all necessary data for matching
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_matching_profile', { user_id: userId });

      if (error) throw error;
      if (!data) return null;

      return UserProfileSchema.parse(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Get potential matches excluding specified users
   */
  private async getPotentialMatches(
    userId: string,
    excludeUserIds: string[]
  ): Promise<UserProfile[]> {
    const excludeList = [userId, ...excludeUserIds];

    const { data, error } = await this.supabase
      .rpc('get_potential_matches', {
        user_id: userId,
        exclude_user_ids: excludeList,
      });

    if (error) throw error;

    return data?.map((profile: any) => UserProfileSchema.parse(profile)) || [];
  }

  /**
   * Calculate comprehensive match scores between two profiles
   */
  private async calculateMatchScores(
    profile1: UserProfile,
    profile2: UserProfile
  ): Promise<MatchingResult['scores']> {
    // Calculate interest similarity (both cosine and semantic)
    const cosineSimilarity = InterestSimilarityCalculator.calculateCosineSimilarity(
      profile1.interests,
      profile2.interests
    );

    const semanticSimilarity = await InterestSimilarityCalculator.calculateSemanticSimilarity(
      profile1.interests,
      profile2.interests,
      this.openai
    );

    const interestSimilarity = Math.max(cosineSimilarity, semanticSimilarity * 0.7);

    // Calculate skill complementarity
    const skillComplementarity = SkillComplementarityEngine.calculateComplementarity(
      profile1,
      profile2
    );

    // Calculate collaboration potential
    const collaborationPotential = CollaborationPotentialScorer.predictCollaborationSuccess(
      profile1,
      profile2
    );

    // Calculate activity alignment
    const activityAlignment = UserProfileAnalyzer.calculateActivityAlignment(
      profile1,
      profile2
    );

    return {
      interest_similarity: interestSimilarity,
      skill_complementarity: skillComplementarity,
      collaboration_potential: collaborationPotential,
      activity_alignment: activityAlignment,
    };
  }

  /**
   * Generate human-readable reasons for the match
   */
  private generateMatchReasons(
    profile1: UserProfile,
    profile2: UserProfile,
    scores: MatchingResult['scores']
  ): string[] {
    const reasons: string[] = [];

    // Interest-based reasons
    if (scores.interest_similarity > 0.6) {
      const commonInterests = profile1.interests.filter(interest =>
        profile2.interests.includes(interest)
      );
      if (commonInterests.length > 0) {
        reasons.push(`Shared interests: ${commonInterests.slice(0, 3).join(', ')}`);
      }
    }

    // Skill-based reasons
    if (scores.skill_complementarity > 0.5) {
      const skillGaps = SkillComplementarityEngine.identifySkillGaps(profile1, profile2);
      if (skillGaps.length > 0) {
        reasons.push(`Could learn: ${skillGaps.slice(0, 2).join(', ')}`);
      }
    }

    // Activity alignment reasons
    if (scores.activity_alignment > 0.4) {
      reasons.push('Similar active hours for collaboration');
    }

    // Collaboration potential reasons
    if (scores.collaboration_potential > 0.6) {
      reasons.push('Compatible communication and work styles');
    }

    return reasons.length > 0 ? reasons : ['Potential for meaningful connection'];
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(scores: MatchingResult['scores']): number {
    return MatchingResultsFormatter['calculateOverallScore'](scores);
  }

  /**
   * Store matching results in database
   */
  private async storeMatchingResults(results: MatchingResult[]):