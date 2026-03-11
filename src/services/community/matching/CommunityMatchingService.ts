```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import OpenAI from 'openai';

/**
 * Member profile for matching analysis
 */
export interface MemberProfile {
  id: string;
  name: string;
  bio: string;
  skills: string[];
  interests: string[];
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  collaboration_preferences: CollaborationPreferences;
  availability: AvailabilityProfile;
  location?: string;
  timezone?: string;
  created_at: Date;
  last_active: Date;
}

/**
 * Collaboration preferences configuration
 */
export interface CollaborationPreferences {
  project_types: string[];
  communication_style: 'direct' | 'collaborative' | 'supportive';
  time_commitment: 'casual' | 'regular' | 'intensive';
  remote_preference: 'remote_only' | 'hybrid' | 'in_person' | 'flexible';
  mentoring_interest: 'mentor' | 'mentee' | 'peer' | 'none';
}

/**
 * Member availability profile
 */
export interface AvailabilityProfile {
  days_available: string[];
  hours_per_week: number;
  preferred_time_slots: string[];
  timezone: string;
}

/**
 * Match request parameters
 */
export interface MatchRequest {
  requester_id: string;
  match_type: 'collaboration' | 'mentorship' | 'skill_exchange' | 'networking';
  specific_skills?: string[];
  specific_interests?: string[];
  project_context?: string;
  urgency: 'low' | 'medium' | 'high';
  max_matches: number;
  filters?: MatchFilters;
}

/**
 * Filtering criteria for matches
 */
export interface MatchFilters {
  experience_levels?: string[];
  locations?: string[];
  availability_overlap_min?: number;
  exclude_member_ids?: string[];
  include_only_active_since?: Date;
}

/**
 * Generated member match with scoring
 */
export interface MemberMatch {
  member: MemberProfile;
  match_score: number;
  compatibility_scores: CompatibilityScores;
  reasoning: MatchReasoning;
  collaboration_potential: CollaborationPotential;
  confidence_level: number;
  created_at: Date;
}

/**
 * Detailed compatibility scoring breakdown
 */
export interface CompatibilityScores {
  skill_alignment: number;
  interest_overlap: number;
  experience_complement: number;
  communication_fit: number;
  availability_overlap: number;
  collaboration_history: number;
  network_proximity: number;
  project_fit: number;
}

/**
 * Explainable match reasoning
 */
export interface MatchReasoning {
  primary_reasons: string[];
  shared_elements: string[];
  complementary_aspects: string[];
  potential_synergies: string[];
  collaboration_opportunities: string[];
  growth_potential: string[];
}

/**
 * Collaboration potential assessment
 */
export interface CollaborationPotential {
  project_types: string[];
  success_probability: number;
  expected_outcomes: string[];
  timeline_estimate: string;
  resource_requirements: string[];
  risk_factors: string[];
}

/**
 * Vector embedding representation
 */
export interface MemberEmbedding {
  member_id: string;
  skill_vector: number[];
  interest_vector: number[];
  behavior_vector: number[];
  combined_vector: number[];
  last_updated: Date;
  version: string;
}

/**
 * Match feedback for learning optimization
 */
export interface MatchFeedback {
  match_id: string;
  requester_id: string;
  matched_member_id: string;
  feedback_type: 'positive' | 'negative' | 'neutral';
  rating: number;
  collaboration_occurred: boolean;
  outcome_quality?: number;
  feedback_text?: string;
  improvement_suggestions?: string[];
  created_at: Date;
}

/**
 * Collaboration history record
 */
export interface CollaborationHistory {
  id: string;
  member_a_id: string;
  member_b_id: string;
  project_type: string;
  success_rating: number;
  duration_days: number;
  outcome_description: string;
  skills_developed: string[];
  created_at: Date;
}

/**
 * Community matching service configuration
 */
export interface CommunityMatchingConfig {
  supabase: {
    url: string;
    key: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  openai: {
    api_key: string;
    model: string;
  };
  matching: {
    default_max_matches: number;
    min_match_score: number;
    embedding_dimensions: number;
    cache_ttl_hours: number;
    batch_size: number;
  };
}

/**
 * Service errors
 */
export class CommunityMatchingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CommunityMatchingError';
  }
}

/**
 * Community Member Matching Service
 * 
 * Intelligent ML-powered service that matches community members based on
 * shared interests, complementary skills, collaboration history, and
 * opportunity alignment using vector embeddings and collaborative filtering.
 */
export class CommunityMatchingService {
  private supabase: SupabaseClient;
  private redis: Redis;
  private openai: OpenAI;
  private config: CommunityMatchingConfig;

  constructor(config: CommunityMatchingConfig) {
    this.config = config;
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    this.redis = new Redis(config.redis);
    this.openai = new OpenAI({ apiKey: config.openai.api_key });
  }

  /**
   * Find matches for a community member
   */
  async findMatches(request: MatchRequest): Promise<MemberMatch[]> {
    try {
      // Get requester profile
      const requester = await this.getMemberProfile(request.requester_id);
      if (!requester) {
        throw new CommunityMatchingError(
          'Requester profile not found',
          'MEMBER_NOT_FOUND',
          404
        );
      }

      // Get candidate members
      const candidates = await this.getCandidateMembers(request, requester);

      // Generate or retrieve embeddings
      const requesterEmbedding = await this.getMemberEmbedding(requester);
      const candidateEmbeddings = await Promise.all(
        candidates.map(candidate => this.getMemberEmbedding(candidate))
      );

      // Calculate compatibility scores
      const scoredMatches = await Promise.all(
        candidates.map(async (candidate, index) => {
          const candidateEmbedding = candidateEmbeddings[index];
          return this.calculateMatchScore(
            requester,
            candidate,
            requesterEmbedding,
            candidateEmbedding,
            request
          );
        })
      );

      // Filter and sort matches
      const filteredMatches = scoredMatches
        .filter(match => match.match_score >= this.config.matching.min_match_score)
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, request.max_matches);

      // Store match results
      await this.storeMatchResults(request.requester_id, filteredMatches);

      return filteredMatches;

    } catch (error) {
      throw new CommunityMatchingError(
        `Failed to find matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MATCH_GENERATION_FAILED'
      );
    }
  }

  /**
   * Get member profile with caching
   */
  private async getMemberProfile(memberId: string): Promise<MemberProfile | null> {
    const cacheKey = `member:profile:${memberId}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from database
      const { data, error } = await this.supabase
        .from('community_members')
        .select(`
          *,
          member_skills(*),
          member_interests(*),
          collaboration_history(*)
        `)
        .eq('id', memberId)
        .single();

      if (error || !data) {
        return null;
      }

      const profile: MemberProfile = {
        id: data.id,
        name: data.name,
        bio: data.bio || '',
        skills: data.member_skills?.map((s: any) => s.skill_name) || [],
        interests: data.member_interests?.map((i: any) => i.interest_name) || [],
        experience_level: data.experience_level,
        collaboration_preferences: data.collaboration_preferences,
        availability: data.availability,
        location: data.location,
        timezone: data.timezone,
        created_at: new Date(data.created_at),
        last_active: new Date(data.last_active)
      };

      // Cache profile
      await this.redis.setex(
        cacheKey,
        this.config.matching.cache_ttl_hours * 3600,
        JSON.stringify(profile)
      );

      return profile;

    } catch (error) {
      throw new CommunityMatchingError(
        `Failed to get member profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROFILE_FETCH_FAILED'
      );
    }
  }

  /**
   * Get candidate members for matching
   */
  private async getCandidateMembers(
    request: MatchRequest,
    requester: MemberProfile
  ): Promise<MemberProfile[]> {
    try {
      let query = this.supabase
        .from('community_members')
        .select(`
          *,
          member_skills(*),
          member_interests(*),
          collaboration_history(*)
        `)
        .neq('id', requester.id);

      // Apply filters
      if (request.filters) {
        if (request.filters.experience_levels) {
          query = query.in('experience_level', request.filters.experience_levels);
        }
        
        if (request.filters.locations) {
          query = query.in('location', request.filters.locations);
        }
        
        if (request.filters.exclude_member_ids) {
          query = query.not('id', 'in', `(${request.filters.exclude_member_ids.join(',')})`);
        }
        
        if (request.filters.include_only_active_since) {
          query = query.gte('last_active', request.filters.include_only_active_since.toISOString());
        }
      }

      const { data, error } = await query.limit(1000);

      if (error) {
        throw new Error(error.message);
      }

      return (data || []).map((member: any) => ({
        id: member.id,
        name: member.name,
        bio: member.bio || '',
        skills: member.member_skills?.map((s: any) => s.skill_name) || [],
        interests: member.member_interests?.map((i: any) => i.interest_name) || [],
        experience_level: member.experience_level,
        collaboration_preferences: member.collaboration_preferences,
        availability: member.availability,
        location: member.location,
        timezone: member.timezone,
        created_at: new Date(member.created_at),
        last_active: new Date(member.last_active)
      }));

    } catch (error) {
      throw new CommunityMatchingError(
        `Failed to get candidate members: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CANDIDATES_FETCH_FAILED'
      );
    }
  }

  /**
   * Generate or retrieve member embedding
   */
  private async getMemberEmbedding(member: MemberProfile): Promise<MemberEmbedding> {
    const cacheKey = `embedding:${member.id}`;
    
    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Generate embeddings
      const skillText = member.skills.join(' ');
      const interestText = member.interests.join(' ');
      const bioText = member.bio;
      
      const [skillEmbedding, interestEmbedding, bioEmbedding] = await Promise.all([
        this.generateEmbedding(skillText),
        this.generateEmbedding(interestText),
        this.generateEmbedding(bioText)
      ]);

      // Combine vectors (simple concatenation for now)
      const combinedVector = [...skillEmbedding, ...interestEmbedding, ...bioEmbedding];

      const embedding: MemberEmbedding = {
        member_id: member.id,
        skill_vector: skillEmbedding,
        interest_vector: interestEmbedding,
        behavior_vector: bioEmbedding,
        combined_vector: combinedVector,
        last_updated: new Date(),
        version: '1.0'
      };

      // Cache embedding
      await this.redis.setex(
        cacheKey,
        this.config.matching.cache_ttl_hours * 3600,
        JSON.stringify(embedding)
      );

      return embedding;

    } catch (error) {
      throw new CommunityMatchingError(
        `Failed to generate member embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EMBEDDING_GENERATION_FAILED'
      );
    }
  }

  /**
   * Generate text embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!text.trim()) {
      return new Array(1536).fill(0); // Default embedding dimension
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.openai.model,
        input: text
      });

      return response.data[0].embedding;

    } catch (error) {
      throw new Error(`OpenAI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate comprehensive match score
   */
  private async calculateMatchScore(
    requester: MemberProfile,
    candidate: MemberProfile,
    requesterEmbedding: MemberEmbedding,
    candidateEmbedding: MemberEmbedding,
    request: MatchRequest
  ): Promise<MemberMatch> {
    try {
      // Calculate individual compatibility scores
      const skillAlignment = this.calculateVectorSimilarity(
        requesterEmbedding.skill_vector,
        candidateEmbedding.skill_vector
      );

      const interestOverlap = this.calculateVectorSimilarity(
        requesterEmbedding.interest_vector,
        candidateEmbedding.interest_vector
      );

      const experienceComplement = this.calculateExperienceComplement(
        requester.experience_level,
        candidate.experience_level,
        request.match_type
      );

      const communicationFit = this.calculateCommunicationFit(
        requester.collaboration_preferences,
        candidate.collaboration_preferences
      );

      const availabilityOverlap = this.calculateAvailabilityOverlap(
        requester.availability,
        candidate.availability
      );

      const collaborationHistory = await this.getCollaborationHistoryScore(
        requester.id,
        candidate.id
      );

      const networkProximity = await this.calculateNetworkProximity(
        requester.id,
        candidate.id
      );

      const projectFit = this.calculateProjectFit(
        requester,
        candidate,
        request
      );

      // Combine scores with weights based on match type
      const weights = this.getMatchTypeWeights(request.match_type);
      const compatibilityScores: CompatibilityScores = {
        skill_alignment: skillAlignment,
        interest_overlap: interestOverlap,
        experience_complement: experienceComplement,
        communication_fit: communicationFit,
        availability_overlap: availabilityOverlap,
        collaboration_history: collaborationHistory,
        network_proximity: networkProximity,
        project_fit: projectFit
      };

      const matchScore = 
        skillAlignment * weights.skill +
        interestOverlap * weights.interest +
        experienceComplement * weights.experience +
        communicationFit * weights.communication +
        availabilityOverlap * weights.availability +
        collaborationHistory * weights.history +
        networkProximity * weights.network +
        projectFit * weights.project;

      // Generate reasoning
      const reasoning = this.generateMatchReasoning(
        requester,
        candidate,
        compatibilityScores,
        request
      );

      // Assess collaboration potential
      const collaborationPotential = this.assessCollaborationPotential(
        requester,
        candidate,
        compatibilityScores,
        request
      );

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidenceLevel(
        compatibilityScores,
        matchScore
      );

      return {
        member: candidate,
        match_score: Math.round(matchScore * 100) / 100,
        compatibility_scores: compatibilityScores,
        reasoning,
        collaboration_potential: collaborationPotential,
        confidence_level: confidenceLevel,
        created_at: new Date()
      };

    } catch (error) {
      throw new CommunityMatchingError(
        `Failed to calculate match score: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SCORE_CALCULATION_FAILED'
      );
    }
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private calculateVectorSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate experience level complementarity
   */
  private calculateExperienceComplement(
    requesterLevel: string,
    candidateLevel: string,
    matchType: string
  ): number {
    const levels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    const requesterScore = levels[requesterLevel as keyof typeof levels] || 2;
    const candidateScore = levels[candidateLevel as keyof typeof levels] || 2;

    if (matchType === 'mentorship') {
      return Math.abs(candidateScore - requesterScore) / 3;
    } else {
      // For collaboration, prefer similar levels with some diversity
      const difference = Math.abs(candidateScore - requesterScore);
      return Math.max(0, 1 - difference / 2);
    }
  }

  /**
   * Calculate communication style fit
   */
  private calculateCommunicationFit(
    requesterPrefs: CollaborationPreferences,
    candidatePrefs: CollaborationPreferences
  ): number {
    let score = 0;
    let factors = 0;

    // Communication style compatibility
    const styleCompatibility = requesterPrefs.communication_style === candidatePrefs.communication_style ? 1 : 0.7;
    score += styleCompatibility;
    factors++;

    // Time commitment alignment
    const commitmentLevels = { casual: 1, regular: 2, intensive: 3 };
    const requesterCommit = commitmentLevels[requesterPrefs.time_commitment as keyof typeof commitmentLevels];
    const candidateCommit = commitmentLevels[candidatePrefs.time_commitment as keyof typeof commitmentLevels];
    const commitmentScore = Math.max(0, 1 - Math.abs(requesterCommit - candidateCommit) / 2);
    score += commitmentScore;
    factors++;

    // Remote preference alignment
    const remoteScore = requesterPrefs.remote_preference === candidatePrefs.remote_preference || 
                       requesterPrefs.remote_preference === 'flexible' ||
                       candidatePrefs.remote_preference === 'flexible' ? 1 : 0.5;
    score += remoteScore;
    factors++;

    return score / factors;
  }

  /**
   * Calculate availability overlap
   */
  private calculateAvailabilityOverlap(
    requesterAvailability: AvailabilityProfile,
    candidateAvailability: AvailabilityProfile
  ): number {
    // Calculate day overlap
    const requesterDays = new Set(requesterAvailability.days_available);
    const candidateDays = new Set(candidateAvailability.days_available);
    const dayIntersection = new Set([...requesterDays].filter(x => candidateDays.has(x)));
    const dayOverlap = dayIntersection.size / Math.max(requesterDays.size, candidateDays.size);

    // Calculate hour capacity compatibility
    const hourCompatibility = Math.min(
      requesterAvailability.hours_per_week,
      candidateAvailability.hours_per_week
    ) / Math.max(requesterAvailability.hours_per_week, candidateAvailability.hours_per_week);

    // Simple timezone check (could be more sophisticated)
    const timezoneScore = requesterAvailability.timezone === candidateAvailability.timezone ? 1 : 0.7;

    return (dayOverlap + hourCompatibility + timezoneScore) / 3;
  }

  /**
   * Get collaboration history score
   */
  private async getCollaborationHistoryScore(
    requesterId: string,
    candidateId: string
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('collaboration_history')
        .select('success_rating')
        .or(`and(member_a_id.eq.${requesterId},member_b_id.eq.${candidateId}),and(member_a_id.eq.${candidateId},member_b_id.eq.${requesterId})`);

      if (error || !data?.length) {
        return 0.5; // Neutral score for no history
      }

      // Average success rating normalized to 0-1
      const avgRating = data.reduce((sum, record