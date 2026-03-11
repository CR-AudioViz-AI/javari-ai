```typescript
/**
 * AI-Powered Mentorship Matching Service
 * Intelligently pairs community members for mentorship relationships based on
 * skills, goals, availability, and personality compatibility with progress tracking
 * and success metrics.
 */

import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/ai/openai-client';
import { EventEmitter } from 'events';
import { z } from 'zod';
import type { 
  MentorshipProfile, 
  MatchingCriteria, 
  MentorshipMatch, 
  MatchingResult,
  RelationshipMetrics,
  ProgressUpdate,
  CompatibilityScore,
  MatchingPreferences,
  MentorshipGoal,
  SkillLevel,
  AvailabilitySlot,
  PersonalityTraits,
  MatchStatus,
  RelationshipStatus
} from '@/types/mentorship';

/**
 * Configuration schema for mentorship matching
 */
const MentorshipConfigSchema = z.object({
  minCompatibilityScore: z.number().min(0).max(1).default(0.7),
  maxMatchesPerUser: z.number().min(1).max(20).default(5),
  matchingCooldownHours: z.number().min(1).max(168).default(24),
  progressTrackingInterval: z.number().min(1).max(30).default(7),
  personalityWeights: z.object({
    skills: z.number().min(0).max(1).default(0.3),
    goals: z.number().min(0).max(1).default(0.25),
    availability: z.number().min(0).max(1).default(0.15),
    personality: z.number().min(0).max(1).default(0.2),
    experience: z.number().min(0).max(1).default(0.1)
  })
});

type MentorshipConfig = z.infer<typeof MentorshipConfigSchema>;

/**
 * Mentorship matching request schema
 */
const MatchingRequestSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['mentor', 'mentee', 'both']),
  criteria: z.object({
    skills: z.array(z.string()).min(1),
    goals: z.array(z.string()).min(1),
    availability: z.array(z.object({
      dayOfWeek: z.number().min(0).max(6),
      startHour: z.number().min(0).max(23),
      endHour: z.number().min(0).max(23),
      timezone: z.string()
    })),
    preferredExperienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    maxMentees: z.number().min(1).max(10).optional(),
    preferredCommunicationStyle: z.enum(['formal', 'casual', 'structured', 'flexible']).optional()
  }),
  preferences: z.object({
    prioritizeSkillMatch: z.boolean().default(true),
    prioritizeGoalAlignment: z.boolean().default(true),
    prioritizeAvailability: z.boolean().default(false),
    allowCrossDisciplinary: z.boolean().default(true),
    preferSameTimezone: z.boolean().default(false)
  }).optional()
});

type MatchingRequest = z.infer<typeof MatchingRequestSchema>;

/**
 * AI-Powered Mentorship Matching Service
 * 
 * Provides comprehensive mentorship matching functionality including:
 * - Intelligent compatibility scoring
 * - Real-time matching updates
 * - Progress tracking and metrics
 * - Relationship success analysis
 * 
 * @example
 * ```typescript
 * const matchingService = new MentorshipMatchingService({
 *   minCompatibilityScore: 0.8,
 *   maxMatchesPerUser: 3
 * });
 * 
 * // Find matches for a user
 * const matches = await matchingService.findMatches({
 *   userId: 'user-123',
 *   role: 'mentee',
 *   criteria: {
 *     skills: ['typescript', 'react'],
 *     goals: ['career-growth', 'technical-skills'],
 *     availability: [...]
 *   }
 * });
 * ```
 */
export class MentorshipMatchingService extends EventEmitter {
  private config: MentorshipConfig;
  private matchingCache = new Map<string, { matches: MatchingResult[]; timestamp: number }>();
  private progressTrackers = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<MentorshipConfig> = {}) {
    super();
    this.config = MentorshipConfigSchema.parse(config);
  }

  /**
   * Find potential mentorship matches for a user
   */
  async findMatches(request: MatchingRequest): Promise<MatchingResult> {
    try {
      const validatedRequest = MatchingRequestSchema.parse(request);
      const { userId, role, criteria, preferences } = validatedRequest;

      // Check rate limiting
      await this.checkRateLimit(userId);

      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Analyze personality traits using AI
      const personalityTraits = await this.analyzePersonalityTraits(userProfile);

      // Find potential matches based on role
      const candidates = await this.getCandidates(role, criteria);

      // Calculate compatibility scores
      const scoredMatches = await Promise.all(
        candidates.map(candidate => this.calculateCompatibilityScore(
          { ...userProfile, personalityTraits },
          candidate,
          criteria,
          preferences || {}
        ))
      );

      // Filter and rank matches
      const filteredMatches = scoredMatches
        .filter(match => match.compatibilityScore >= this.config.minCompatibilityScore)
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, this.config.maxMatchesPerUser);

      // Create match records
      const matches = await Promise.all(
        filteredMatches.map(match => this.createMatchRecord(userId, match))
      );

      const result: MatchingResult = {
        userId,
        matches,
        totalCandidates: candidates.length,
        matchingCriteria: criteria,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + this.config.matchingCooldownHours * 60 * 60 * 1000)
      };

      // Cache results
      this.cacheMatches(userId, [result]);

      // Emit matching event
      this.emit('matchesFound', result);

      return result;
    } catch (error) {
      this.emit('error', { type: 'matching_failed', error, userId: request.userId });
      throw new Error(`Failed to find matches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Accept a mentorship match
   */
  async acceptMatch(userId: string, matchId: string): Promise<MentorshipMatch> {
    try {
      const { data: match, error } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('id', matchId)
        .eq('mentee_id', userId)
        .or(`mentor_id.eq.${userId}`)
        .single();

      if (error || !match) {
        throw new Error('Match not found or unauthorized');
      }

      // Update match status
      const { data: updatedMatch, error: updateError } = await supabase
        .from('mentorship_matches')
        .update({
          status: 'accepted' as MatchStatus,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to accept match');
      }

      // Create mentorship relationship
      const relationship = await this.createMentorshipRelationship(updatedMatch);

      // Start progress tracking
      this.startProgressTracking(relationship.id);

      // Send notifications
      await this.sendMatchNotification(updatedMatch, 'accepted');

      this.emit('matchAccepted', { match: updatedMatch, relationship });

      return updatedMatch;
    } catch (error) {
      this.emit('error', { type: 'accept_match_failed', error, userId, matchId });
      throw new Error(`Failed to accept match: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decline a mentorship match
   */
  async declineMatch(userId: string, matchId: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('mentorship_matches')
        .update({
          status: 'declined' as MatchStatus,
          declined_at: new Date().toISOString(),
          decline_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .eq('mentee_id', userId)
        .or(`mentor_id.eq.${userId}`);

      if (error) {
        throw new Error('Failed to decline match');
      }

      this.emit('matchDeclined', { matchId, userId, reason });
    } catch (error) {
      this.emit('error', { type: 'decline_match_failed', error, userId, matchId });
      throw new Error(`Failed to decline match: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update mentorship progress
   */
  async updateProgress(relationshipId: string, update: ProgressUpdate): Promise<void> {
    try {
      const { error } = await supabase
        .from('mentorship_progress')
        .insert({
          relationship_id: relationshipId,
          update_type: update.type,
          progress_data: update.data,
          notes: update.notes,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error('Failed to update progress');
      }

      // Update relationship metrics
      await this.updateRelationshipMetrics(relationshipId);

      this.emit('progressUpdated', { relationshipId, update });
    } catch (error) {
      this.emit('error', { type: 'progress_update_failed', error, relationshipId });
      throw new Error(`Failed to update progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get relationship metrics
   */
  async getRelationshipMetrics(relationshipId: string): Promise<RelationshipMetrics> {
    try {
      const { data: relationship, error: relationshipError } = await supabase
        .from('mentorship_relationships')
        .select('*')
        .eq('id', relationshipId)
        .single();

      if (relationshipError || !relationship) {
        throw new Error('Relationship not found');
      }

      const { data: progressData, error: progressError } = await supabase
        .from('mentorship_progress')
        .select('*')
        .eq('relationship_id', relationshipId)
        .order('created_at', { ascending: false });

      if (progressError) {
        throw new Error('Failed to fetch progress data');
      }

      // Calculate metrics
      const metrics = await this.calculateRelationshipMetrics(relationship, progressData || []);

      return metrics;
    } catch (error) {
      this.emit('error', { type: 'get_metrics_failed', error, relationshipId });
      throw new Error(`Failed to get relationship metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's mentorship dashboard data
   */
  async getDashboardData(userId: string): Promise<{
    activeRelationships: any[];
    pendingMatches: MentorshipMatch[];
    recentProgress: ProgressUpdate[];
    metrics: RelationshipMetrics[];
  }> {
    try {
      const [activeRelationships, pendingMatches, recentProgress, metrics] = await Promise.all([
        this.getActiveRelationships(userId),
        this.getPendingMatches(userId),
        this.getRecentProgress(userId),
        this.getUserMetrics(userId)
      ]);

      return {
        activeRelationships,
        pendingMatches,
        recentProgress,
        metrics
      };
    } catch (error) {
      this.emit('error', { type: 'dashboard_data_failed', error, userId });
      throw new Error(`Failed to get dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze personality traits using AI
   */
  private async analyzePersonalityTraits(profile: MentorshipProfile): Promise<PersonalityTraits> {
    try {
      const prompt = `
        Analyze the following mentorship profile and extract personality traits:
        
        Bio: ${profile.bio}
        Skills: ${profile.skills.join(', ')}
        Goals: ${profile.goals.join(', ')}
        Communication Style: ${profile.communicationStyle}
        Experience Level: ${profile.experienceLevel}
        
        Return a JSON object with personality traits scored 0-1:
        {
          "openness": 0.8,
          "conscientiousness": 0.7,
          "extraversion": 0.6,
          "agreeableness": 0.9,
          "neuroticism": 0.2,
          "communicationStyle": "collaborative",
          "learningStyle": "hands-on",
          "mentorshipApproach": "supportive"
        }
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      console.warn('Failed to analyze personality traits, using defaults:', error);
      return {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5,
        communicationStyle: profile.communicationStyle || 'flexible',
        learningStyle: 'balanced',
        mentorshipApproach: 'supportive'
      };
    }
  }

  /**
   * Calculate compatibility score between two profiles
   */
  private async calculateCompatibilityScore(
    user: MentorshipProfile & { personalityTraits: PersonalityTraits },
    candidate: MentorshipProfile,
    criteria: MatchingCriteria,
    preferences: MatchingPreferences
  ): Promise<{ candidate: MentorshipProfile; compatibilityScore: number; breakdown: any }> {
    // Skills compatibility
    const skillsScore = this.calculateSkillsCompatibility(user.skills, candidate.skills, criteria.skills);
    
    // Goals alignment
    const goalsScore = this.calculateGoalsAlignment(user.goals, candidate.goals, criteria.goals);
    
    // Availability overlap
    const availabilityScore = this.calculateAvailabilityOverlap(
      criteria.availability,
      candidate.availability || []
    );
    
    // Personality compatibility
    const personalityScore = await this.calculatePersonalityCompatibility(
      user.personalityTraits,
      candidate.personalityTraits || {}
    );
    
    // Experience level compatibility
    const experienceScore = this.calculateExperienceCompatibility(
      user.experienceLevel,
      candidate.experienceLevel,
      criteria.preferredExperienceLevel
    );

    // Weighted total score
    const weights = this.config.personalityWeights;
    const totalScore = (
      skillsScore * weights.skills +
      goalsScore * weights.goals +
      availabilityScore * weights.availability +
      personalityScore * weights.personality +
      experienceScore * weights.experience
    );

    return {
      candidate,
      compatibilityScore: Math.round(totalScore * 100) / 100,
      breakdown: {
        skills: skillsScore,
        goals: goalsScore,
        availability: availabilityScore,
        personality: personalityScore,
        experience: experienceScore
      }
    };
  }

  /**
   * Calculate skills compatibility score
   */
  private calculateSkillsCompatibility(
    userSkills: string[],
    candidateSkills: string[],
    requiredSkills: string[]
  ): number {
    const intersection = candidateSkills.filter(skill => 
      requiredSkills.some(req => req.toLowerCase().includes(skill.toLowerCase()))
    );
    
    return Math.min(intersection.length / requiredSkills.length, 1);
  }

  /**
   * Calculate goals alignment score
   */
  private calculateGoalsAlignment(
    userGoals: string[],
    candidateGoals: string[],
    requiredGoals: string[]
  ): number {
    const alignedGoals = candidateGoals.filter(goal =>
      requiredGoals.some(req => req.toLowerCase().includes(goal.toLowerCase()))
    );
    
    return Math.min(alignedGoals.length / requiredGoals.length, 1);
  }

  /**
   * Calculate availability overlap
   */
  private calculateAvailabilityOverlap(
    userAvailability: AvailabilitySlot[],
    candidateAvailability: AvailabilitySlot[]
  ): number {
    let overlapHours = 0;
    let totalUserHours = 0;

    userAvailability.forEach(userSlot => {
      const userHours = userSlot.endHour - userSlot.startHour;
      totalUserHours += userHours;

      candidateAvailability.forEach(candidateSlot => {
        if (userSlot.dayOfWeek === candidateSlot.dayOfWeek) {
          const overlapStart = Math.max(userSlot.startHour, candidateSlot.startHour);
          const overlapEnd = Math.min(userSlot.endHour, candidateSlot.endHour);
          if (overlapStart < overlapEnd) {
            overlapHours += overlapEnd - overlapStart;
          }
        }
      });
    });

    return totalUserHours > 0 ? Math.min(overlapHours / totalUserHours, 1) : 0;
  }

  /**
   * Calculate personality compatibility
   */
  private async calculatePersonalityCompatibility(
    userTraits: PersonalityTraits,
    candidateTraits: PersonalityTraits
  ): Promise<number> {
    if (!candidateTraits || Object.keys(candidateTraits).length === 0) {
      return 0.5; // Neutral score for missing data
    }

    const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
    let totalScore = 0;

    traits.forEach(trait => {
      const userValue = userTraits[trait as keyof PersonalityTraits] as number || 0.5;
      const candidateValue = candidateTraits[trait as keyof PersonalityTraits] as number || 0.5;
      
      // Calculate similarity (1 - absolute difference)
      const similarity = 1 - Math.abs(userValue - candidateValue);
      totalScore += similarity;
    });

    return totalScore / traits.length;
  }

  /**
   * Calculate experience level compatibility
   */
  private calculateExperienceCompatibility(
    userLevel: string,
    candidateLevel: string,
    preferredLevel?: string
  ): number {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const userIndex = levels.indexOf(userLevel);
    const candidateIndex = levels.indexOf(candidateLevel);
    
    if (preferredLevel) {
      const preferredIndex = levels.indexOf(preferredLevel);
      return candidateIndex === preferredIndex ? 1 : 0.5;
    }
    
    // Mentors should generally be at same or higher level
    const levelDifference = Math.abs(candidateIndex - userIndex);
    return Math.max(0, 1 - levelDifference * 0.25);
  }

  /**
   * Get candidates for matching
   */
  private async getCandidates(
    role: 'mentor' | 'mentee' | 'both',
    criteria: MatchingCriteria
  ): Promise<MentorshipProfile[]> {
    const oppositeRole = role === 'mentor' ? 'mentee' : 'mentor';
    const queryRole = role === 'both' ? undefined : oppositeRole;

    const { data: profiles, error } = await supabase
      .from('mentorship_profiles')
      .select('*')
      .eq('is_active', true)
      .neq('role', role === 'both' ? 'inactive' : role);

    if (error) {
      throw new Error('Failed to fetch candidates');
    }

    return profiles || [];
  }

  /**
   * Create match record in database
   */
  private async createMatchRecord(
    userId: string,
    scoredMatch: { candidate: MentorshipProfile; compatibilityScore: number; breakdown: any }
  ): Promise<MentorshipMatch> {
    const { data: match, error } = await supabase
      .from('mentorship_matches')
      .insert({
        mentee_id: userId,
        mentor_id: scoredMatch.candidate.userId,
        compatibility_score: scoredMatch.compatibilityScore,
        score_breakdown: scoredMatch.breakdown,
        status: 'pending' as MatchStatus,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create match record');
    }

    return match;
  }

  /**
   * Create mentorship relationship
   */
  private async createMentorshipRelationship(match: MentorshipMatch): Promise<any> {
    const { data: relationship, error } = await supabase
      .from('mentorship_relationships')
      .insert({
        mentor_id: match.mentor_id,
        mentee_id: match.mentee_id,
        match_id: match.id,
        status: 'active' as RelationshipStatus,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create relationship');
    }

    return relationship;
  }

  /**
   * Start progress tracking for a relationship
   */
  private startProgressTracking(relationshipId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.trackProgress(relationshipId);
      } catch (error) {
        console.error('Progress tracking error:', error);
      }
    }, this.config.progressTrackingInterval * 24 * 60