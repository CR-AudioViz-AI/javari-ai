import { Supabase } from '@supabase/supabase-js';
import { z } from 'zod';
import { EventEmitter } from 'events';

/**
 * Skill proficiency levels
 */
export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

/**
 * Mentorship session status
 */
export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

/**
 * Matching status
 */
export enum MatchingStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * Availability time slot
 */
export interface TimeSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

/**
 * Skill with proficiency level
 */
export interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
}

/**
 * Mentorship goal
 */
export interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
}

/**
 * User profile for mentorship
 */
export interface UserProfile {
  id: string;
  userId: string;
  type: 'MENTOR' | 'MENTEE' | 'BOTH';
  bio: string;
  skills: Skill[];
  availability: TimeSlot[];
  timezone: string;
  preferredMeetingDuration: number;
  maxMentees?: number;
  goals?: Goal[];
  experience?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mentorship match
 */
export interface MentorshipMatch {
  id: string;
  mentorId: string;
  menteeId: string;
  compatibilityScore: number;
  status: MatchingStatus;
  matchedAt: Date;
  activatedAt?: Date;
  completedAt?: Date;
  feedback?: MatchFeedback;
}

/**
 * Session record
 */
export interface Session {
  id: string;
  matchId: string;
  scheduledAt: Date;
  duration: number;
  status: SessionStatus;
  notes?: string;
  mentorFeedback?: string;
  menteeFeedback?: string;
  createdAt: Date;
}

/**
 * Progress milestone
 */
export interface Milestone {
  id: string;
  matchId: string;
  goalId: string;
  title: string;
  description: string;
  targetDate: Date;
  completedAt?: Date;
  feedback?: string;
}

/**
 * Match feedback
 */
export interface MatchFeedback {
  mentorRating: number;
  menteeRating: number;
  mentorComments?: string;
  menteeComments?: string;
  wouldRecommend: boolean;
  submittedAt: Date;
}

/**
 * Matching criteria
 */
export interface MatchingCriteria {
  requiredSkills: string[];
  preferredSkillLevels: Record<string, SkillLevel>;
  availabilityFlexibility: number;
  maxTravelDistance?: number;
  preferredMeetingType: 'VIRTUAL' | 'IN_PERSON' | 'BOTH';
  goals: string[];
}

/**
 * Compatibility metrics
 */
export interface CompatibilityMetrics {
  skillOverlap: number;
  availabilityOverlap: number;
  goalAlignment: number;
  experienceGap: number;
  overallScore: number;
}

/**
 * Validation schemas
 */
const skillSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.string(),
  level: z.nativeEnum(SkillLevel)
});

const timeSlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string()
});

const userProfileSchema = z.object({
  userId: z.string(),
  type: z.enum(['MENTOR', 'MENTEE', 'BOTH']),
  bio: z.string().max(1000),
  skills: z.array(skillSchema),
  availability: z.array(timeSlotSchema),
  timezone: z.string(),
  preferredMeetingDuration: z.number().min(15).max(240),
  maxMentees: z.number().optional(),
  experience: z.string().optional()
});

/**
 * Compatibility scoring algorithm
 */
class CompatibilityScorer {
  /**
   * Calculate skill compatibility between mentor and mentee
   */
  static calculateSkillCompatibility(mentorSkills: Skill[], menteeSkills: Skill[]): number {
    if (menteeSkills.length === 0) return 0;

    let totalScore = 0;
    let matchedSkills = 0;

    for (const menteeSkill of menteeSkills) {
      const mentorSkill = mentorSkills.find(s => s.name === menteeSkill.name);
      
      if (mentorSkill) {
        const levelDiff = this.getSkillLevelValue(mentorSkill.level) - this.getSkillLevelValue(menteeSkill.level);
        if (levelDiff > 0) {
          totalScore += Math.min(levelDiff, 3) / 3;
          matchedSkills++;
        }
      }
    }

    return matchedSkills > 0 ? (totalScore / menteeSkills.length) : 0;
  }

  /**
   * Calculate availability overlap
   */
  static calculateAvailabilityOverlap(mentorSlots: TimeSlot[], menteeSlots: TimeSlot[]): number {
    let totalOverlap = 0;
    let possibleOverlap = 0;

    for (const menteeSlot of menteeSlots) {
      possibleOverlap += this.getSlotDuration(menteeSlot);
      
      for (const mentorSlot of mentorSlots) {
        if (mentorSlot.dayOfWeek === menteeSlot.dayOfWeek) {
          const overlap = this.calculateTimeOverlap(mentorSlot, menteeSlot);
          totalOverlap += overlap;
        }
      }
    }

    return possibleOverlap > 0 ? totalOverlap / possibleOverlap : 0;
  }

  /**
   * Calculate goal alignment score
   */
  static calculateGoalAlignment(mentorSkills: Skill[], menteeGoals: Goal[]): number {
    if (menteeGoals.length === 0) return 0;

    let alignedGoals = 0;

    for (const goal of menteeGoals) {
      const hasRelevantSkill = mentorSkills.some(skill => 
        goal.description.toLowerCase().includes(skill.name.toLowerCase()) ||
        goal.title.toLowerCase().includes(skill.name.toLowerCase())
      );
      
      if (hasRelevantSkill) {
        alignedGoals++;
      }
    }

    return alignedGoals / menteeGoals.length;
  }

  /**
   * Get numeric value for skill level
   */
  private static getSkillLevelValue(level: SkillLevel): number {
    switch (level) {
      case SkillLevel.BEGINNER: return 1;
      case SkillLevel.INTERMEDIATE: return 2;
      case SkillLevel.ADVANCED: return 3;
      case SkillLevel.EXPERT: return 4;
    }
  }

  /**
   * Calculate duration of time slot in minutes
   */
  private static getSlotDuration(slot: TimeSlot): number {
    const start = this.timeStringToMinutes(slot.startTime);
    const end = this.timeStringToMinutes(slot.endTime);
    return end - start;
  }

  /**
   * Calculate overlap between two time slots
   */
  private static calculateTimeOverlap(slot1: TimeSlot, slot2: TimeSlot): number {
    const start1 = this.timeStringToMinutes(slot1.startTime);
    const end1 = this.timeStringToMinutes(slot1.endTime);
    const start2 = this.timeStringToMinutes(slot2.startTime);
    const end2 = this.timeStringToMinutes(slot2.endTime);

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    return Math.max(0, overlapEnd - overlapStart);
  }

  /**
   * Convert time string to minutes
   */
  private static timeStringToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

/**
 * AI-powered mentorship matching algorithm
 */
class MentorshipMatcher {
  private readonly weightSkills = 0.4;
  private readonly weightAvailability = 0.3;
  private readonly weightGoals = 0.3;

  /**
   * Find best mentor matches for a mentee
   */
  async findMatches(
    menteeProfile: UserProfile,
    availableMentors: UserProfile[],
    criteria: MatchingCriteria
  ): Promise<Array<{ mentor: UserProfile; compatibility: CompatibilityMetrics }>> {
    const matches: Array<{ mentor: UserProfile; compatibility: CompatibilityMetrics }> = [];

    for (const mentor of availableMentors) {
      if (mentor.id === menteeProfile.id) continue;

      const compatibility = this.calculateCompatibility(menteeProfile, mentor, criteria);
      
      if (compatibility.overallScore >= 0.3) {
        matches.push({ mentor, compatibility });
      }
    }

    return matches.sort((a, b) => b.compatibility.overallScore - a.compatibility.overallScore);
  }

  /**
   * Calculate overall compatibility between mentor and mentee
   */
  private calculateCompatibility(
    mentee: UserProfile,
    mentor: UserProfile,
    criteria: MatchingCriteria
  ): CompatibilityMetrics {
    const skillOverlap = CompatibilityScorer.calculateSkillCompatibility(mentor.skills, mentee.skills);
    const availabilityOverlap = CompatibilityScorer.calculateAvailabilityOverlap(
      mentor.availability,
      mentee.availability
    );
    const goalAlignment = CompatibilityScorer.calculateGoalAlignment(
      mentor.skills,
      mentee.goals || []
    );

    const overallScore = 
      skillOverlap * this.weightSkills +
      availabilityOverlap * this.weightAvailability +
      goalAlignment * this.weightGoals;

    return {
      skillOverlap,
      availabilityOverlap,
      goalAlignment,
      experienceGap: this.calculateExperienceGap(mentor, mentee),
      overallScore: Math.min(1, overallScore)
    };
  }

  /**
   * Calculate experience gap between mentor and mentee
   */
  private calculateExperienceGap(mentor: UserProfile, mentee: UserProfile): number {
    const mentorAvgLevel = this.getAverageSkillLevel(mentor.skills);
    const menteeAvgLevel = this.getAverageSkillLevel(mentee.skills);
    return Math.max(0, mentorAvgLevel - menteeAvgLevel) / 3;
  }

  /**
   * Calculate average skill level
   */
  private getAverageSkillLevel(skills: Skill[]): number {
    if (skills.length === 0) return 0;
    
    const total = skills.reduce((sum, skill) => {
      switch (skill.level) {
        case SkillLevel.BEGINNER: return sum + 1;
        case SkillLevel.INTERMEDIATE: return sum + 2;
        case SkillLevel.ADVANCED: return sum + 3;
        case SkillLevel.EXPERT: return sum + 4;
      }
    }, 0);

    return total / skills.length;
  }
}

/**
 * Progress tracking system
 */
class ProgressTracker {
  /**
   * Calculate progress completion percentage
   */
  static calculateProgress(goals: Goal[], milestones: Milestone[]): number {
    if (goals.length === 0) return 0;

    const completedGoals = goals.filter(goal => goal.completed).length;
    const goalProgress = completedGoals / goals.length;

    const completedMilestones = milestones.filter(milestone => milestone.completedAt).length;
    const milestoneProgress = milestones.length > 0 ? completedMilestones / milestones.length : 0;

    return (goalProgress + milestoneProgress) / 2;
  }

  /**
   * Generate progress insights
   */
  static generateInsights(
    goals: Goal[],
    milestones: Milestone[],
    sessions: Session[]
  ): {
    completionRate: number;
    averageSessionRating: number;
    upcomingDeadlines: Goal[];
    recommendedActions: string[];
  } {
    const completionRate = this.calculateProgress(goals, milestones);
    const completedSessions = sessions.filter(s => s.status === SessionStatus.COMPLETED);
    
    const averageSessionRating = completedSessions.length > 0 
      ? completedSessions.reduce((sum, session) => {
          // Assuming a default rating calculation based on feedback presence
          return sum + (session.mentorFeedback && session.menteeFeedback ? 4 : 3);
        }, 0) / completedSessions.length
      : 0;

    const upcomingDeadlines = goals.filter(goal => 
      !goal.completed && 
      new Date(goal.targetDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    );

    const recommendedActions: string[] = [];
    
    if (completionRate < 0.3) {
      recommendedActions.push('Schedule more frequent sessions with your mentor');
    }
    
    if (upcomingDeadlines.length > 0) {
      recommendedActions.push('Focus on upcoming goal deadlines');
    }
    
    if (averageSessionRating < 3) {
      recommendedActions.push('Discuss session effectiveness with your mentor');
    }

    return {
      completionRate,
      averageSessionRating,
      upcomingDeadlines,
      recommendedActions
    };
  }
}

/**
 * Main mentorship system class
 */
export class MentorshipSystem extends EventEmitter {
  private supabase: any;
  private matcher: MentorshipMatcher;

  constructor(supabaseClient: any) {
    super();
    this.supabase = supabaseClient;
    this.matcher = new MentorshipMatcher();
  }

  /**
   * Create or update user mentorship profile
   */
  async createProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const validatedData = userProfileSchema.parse(profileData);
      
      const { data, error } = await this.supabase
        .from('mentorship_profiles')
        .upsert({
          ...validatedData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const profile = this.mapDatabaseProfile(data);
      this.emit('profileCreated', profile);
      
      return profile;
    } catch (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }
  }

  /**
   * Find mentorship matches for a user
   */
  async findMatches(
    userId: string,
    criteria: MatchingCriteria
  ): Promise<Array<{ mentor: UserProfile; compatibility: CompatibilityMetrics }>> {
    try {
      // Get user profile
      const { data: userProfile, error: profileError } = await this.supabase
        .from('mentorship_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      // Get available mentors
      const { data: mentors, error: mentorsError } = await this.supabase
        .from('mentorship_profiles')
        .select('*')
        .in('type', ['MENTOR', 'BOTH'])
        .neq('user_id', userId);

      if (mentorsError) throw mentorsError;

      const mappedUserProfile = this.mapDatabaseProfile(userProfile);
      const mappedMentors = mentors.map(mentor => this.mapDatabaseProfile(mentor));

      const matches = await this.matcher.findMatches(
        mappedUserProfile,
        mappedMentors,
        criteria
      );

      this.emit('matchesFound', { userId, matchCount: matches.length });

      return matches;
    } catch (error) {
      throw new Error(`Failed to find matches: ${error.message}`);
    }
  }

  /**
   * Create a mentorship match
   */
  async createMatch(mentorId: string, menteeId: string): Promise<MentorshipMatch> {
    try {
      // Calculate compatibility score
      const { data: mentorData } = await this.supabase
        .from('mentorship_profiles')
        .select('*')
        .eq('id', mentorId)
        .single();

      const { data: menteeData } = await this.supabase
        .from('mentorship_profiles')
        .select('*')
        .eq('id', menteeId)
        .single();

      if (!mentorData || !menteeData) {
        throw new Error('Mentor or mentee profile not found');
      }

      const mentor = this.mapDatabaseProfile(mentorData);
      const mentee = this.mapDatabaseProfile(menteeData);
      
      const compatibility = CompatibilityScorer.calculateSkillCompatibility(
        mentor.skills,
        mentee.skills
      );

      const { data, error } = await this.supabase
        .from('mentorship_matches')
        .insert({
          mentor_id: mentorId,
          mentee_id: menteeId,
          compatibility_score: compatibility,
          status: MatchingStatus.MATCHED,
          matched_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const match = this.mapDatabaseMatch(data);
      this.emit('matchCreated', match);

      return match;
    } catch (error) {
      throw new Error(`Failed to create match: ${error.message}`);
    }
  }

  /**
   * Schedule a mentorship session
   */
  async scheduleSession(
    matchId: string,
    scheduledAt: Date,
    duration: number
  ): Promise<Session> {
    try {
      const { data, error } = await this.supabase
        .from('mentorship_sessions')
        .insert({
          match_id: matchId,
          scheduled_at: scheduledAt.toISOString(),
          duration,
          status: SessionStatus.SCHEDULED,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const session = this.mapDatabaseSession(data);
      this.emit('sessionScheduled', session);

      return session;
    } catch (error) {
      throw new Error(`Failed to schedule session: ${error.message}`);
    }
  }

  /**
   * Update session with feedback
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session> {
    try {
      const { data, error } = await this.supabase
        .from('mentorship_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      const session = this.mapDatabaseSession(data);
      this.emit('sessionUpdated', session);

      return session;
    } catch (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Track progress milestone
   */
  async createMilestone(milestoneData: Omit<Milestone, 'id'>): Promise<Milestone> {
    try {
      const { data, error } = await this.supabase
        .from('mentorship_milestones')
        .insert({
          match_id: milestoneData.matchId,
          goal_id: milestoneData.goalId,
          title: milestoneData.title,
          description: milestoneData.description,
          target_date: milestoneData.targetDate.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const milestone = this.mapDatabaseMilestone(data);
      this.emit('milestoneCreated', milestone);

      return milestone;
    } catch (error) {
      throw new Error(`Failed to create milestone: ${error.message}`);
    }
  }

  /**
   * Complete a milestone
   */
  async completeMilestone(milestoneId: string, feedback?: string): Promise<Milestone> {
    try {
      const { data, error } = await this.supabase
        .from('mentorship_milestones')
        .update({
          completed_at: new Date().toISOString(),
          feedback,
          updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId)
        .select()
        .single();

      if (error) throw error;

      const milestone = this.mapDatabaseMilestone(data);
      this.emit('milestoneCompleted', milestone);

      return milestone;
    } catch (error) {
      throw new Error(`Failed to complete milestone: ${error.message}`);
    }
  }

  /**
   * Get progress insights for a match
   */
  async getProgressInsights(matchId: string): Promise<{
    completionRate: number;
    averageSessionRating: number;
    upcomingDeadlines: Goal[];
    recommendedActions: string[];
  }> {
    try {
      const [goalsResult, milestonesResult, sessionsResult] = await Promise.all([
        this.supabase.from('mentorship_goals').select('*').eq('match_id', matchId),
        this.supabase.from('mentorship_milestones').select