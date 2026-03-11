```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

/**
 * User activity types that can earn points
 */
export enum ActivityType {
  POST_CREATION = 'post_creation',
  COMMENT = 'comment',
  LIKE_RECEIVED = 'like_received',
  SHARE = 'share',
  PROFILE_UPDATE = 'profile_update',
  LOGIN_STREAK = 'login_streak',
  CONTENT_QUALITY = 'content_quality',
  COMMUNITY_HELP = 'community_help',
  EVENT_PARTICIPATION = 'event_participation',
  MODERATION_ACTION = 'moderation_action'
}

/**
 * Badge rarity levels
 */
export enum BadgeRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

/**
 * Achievement types
 */
export enum AchievementType {
  MILESTONE = 'milestone',
  STREAK = 'streak',
  SOCIAL = 'social',
  QUALITY = 'quality',
  PARTICIPATION = 'participation'
}

/**
 * Point configuration for activities
 */
export interface PointConfig {
  activityType: ActivityType;
  basePoints: number;
  multipliers: {
    qualityBonus: number;
    streakMultiplier: number;
    communityBonus: number;
  };
  dailyLimit?: number;
}

/**
 * Badge definition
 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  requirements: {
    activityType?: ActivityType;
    threshold: number;
    timeframe?: number; // in days
    conditions?: Record<string, any>;
  };
  points: number;
  isActive: boolean;
  createdAt: Date;
}

/**
 * User badge progress
 */
export interface BadgeProgress {
  userId: string;
  badgeId: string;
  currentProgress: number;
  isEarned: boolean;
  earnedAt?: Date;
  progressHistory: Array<{
    date: Date;
    progress: number;
  }>;
}

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: AchievementType;
  icon: string;
  requirements: {
    target: number;
    metric: string;
    timeframe?: number;
    conditions?: Record<string, any>;
  };
  rewards: {
    points: number;
    badges?: string[];
    specialPerks?: string[];
  };
  isActive: boolean;
}

/**
 * User points summary
 */
export interface UserPoints {
  userId: string;
  totalPoints: number;
  availablePoints: number;
  spentPoints: number;
  rank: number;
  level: number;
  experienceToNextLevel: number;
  pointsHistory: Array<{
    date: Date;
    points: number;
    activityType: ActivityType;
    description: string;
  }>;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  points: number;
  rank: number;
  level: number;
  badges: Badge[];
  streak: number;
  change: number; // rank change from previous period
}

/**
 * Engagement metrics
 */
export interface EngagementMetrics {
  userId: string;
  dailyScore: number;
  weeklyScore: number;
  monthlyScore: number;
  qualityScore: number;
  participationRate: number;
  socialInfluence: number;
  contentCreationRate: number;
  lastActivity: Date;
}

/**
 * Gamification event data
 */
export interface GamificationEvent {
  userId: string;
  activityType: ActivityType;
  points: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Points Manager - Handles point allocation and tracking
 */
export class PointsManager {
  private supabase: SupabaseClient;
  private pointConfigs: Map<ActivityType, PointConfig>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.pointConfigs = new Map();
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default point configurations
   */
  private initializeDefaultConfigs(): void {
    const configs: PointConfig[] = [
      {
        activityType: ActivityType.POST_CREATION,
        basePoints: 10,
        multipliers: { qualityBonus: 2.0, streakMultiplier: 1.5, communityBonus: 1.2 },
        dailyLimit: 50
      },
      {
        activityType: ActivityType.COMMENT,
        basePoints: 5,
        multipliers: { qualityBonus: 1.5, streakMultiplier: 1.3, communityBonus: 1.1 },
        dailyLimit: 100
      },
      {
        activityType: ActivityType.LIKE_RECEIVED,
        basePoints: 2,
        multipliers: { qualityBonus: 1.0, streakMultiplier: 1.0, communityBonus: 1.0 },
        dailyLimit: 200
      },
      {
        activityType: ActivityType.LOGIN_STREAK,
        basePoints: 5,
        multipliers: { qualityBonus: 1.0, streakMultiplier: 2.0, communityBonus: 1.0 }
      }
    ];

    configs.forEach(config => {
      this.pointConfigs.set(config.activityType, config);
    });
  }

  /**
   * Award points for user activity
   */
  async awardPoints(
    userId: string,
    activityType: ActivityType,
    metadata: Record<string, any> = {}
  ): Promise<number> {
    try {
      const config = this.pointConfigs.get(activityType);
      if (!config) {
        throw new Error(`No point configuration found for activity: ${activityType}`);
      }

      // Check daily limit
      if (config.dailyLimit) {
        const dailyPoints = await this.getDailyPoints(userId, activityType);
        if (dailyPoints >= config.dailyLimit) {
          return 0;
        }
      }

      // Calculate points with multipliers
      let points = config.basePoints;
      
      // Apply quality bonus
      if (metadata.qualityScore) {
        points *= Math.min(config.multipliers.qualityBonus, 1 + metadata.qualityScore);
      }

      // Apply streak multiplier
      if (metadata.streak) {
        const streakBonus = Math.min(metadata.streak / 10, 1);
        points *= (1 + streakBonus * (config.multipliers.streakMultiplier - 1));
      }

      // Apply community bonus
      if (metadata.communityEngagement > 0.8) {
        points *= config.multipliers.communityBonus;
      }

      points = Math.round(points);

      // Record points transaction
      const { error } = await this.supabase
        .from('user_points_transactions')
        .insert({
          user_id: userId,
          activity_type: activityType,
          points,
          metadata,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update user total points
      await this.updateUserTotalPoints(userId, points);

      return points;
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  /**
   * Get daily points for specific activity
   */
  private async getDailyPoints(userId: string, activityType: ActivityType): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('user_points_transactions')
      .select('points')
      .eq('user_id', userId)
      .eq('activity_type', activityType)
      .gte('created_at', today.toISOString());

    if (error) throw error;

    return data?.reduce((sum, transaction) => sum + transaction.points, 0) || 0;
  }

  /**
   * Update user total points
   */
  private async updateUserTotalPoints(userId: string, pointsToAdd: number): Promise<void> {
    const { error } = await this.supabase.rpc('update_user_points', {
      p_user_id: userId,
      p_points: pointsToAdd
    });

    if (error) throw error;
  }

  /**
   * Get user points summary
   */
  async getUserPoints(userId: string): Promise<UserPoints> {
    try {
      const { data: pointsData, error: pointsError } = await this.supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (pointsError && pointsError.code !== 'PGRST116') throw pointsError;

      const { data: historyData, error: historyError } = await this.supabase
        .from('user_points_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      const totalPoints = pointsData?.total_points || 0;
      const level = Math.floor(totalPoints / 1000) + 1;
      const experienceToNextLevel = 1000 - (totalPoints % 1000);

      return {
        userId,
        totalPoints,
        availablePoints: pointsData?.available_points || 0,
        spentPoints: pointsData?.spent_points || 0,
        rank: pointsData?.rank || 0,
        level,
        experienceToNextLevel,
        pointsHistory: historyData?.map(transaction => ({
          date: new Date(transaction.created_at),
          points: transaction.points,
          activityType: transaction.activity_type,
          description: this.getActivityDescription(transaction.activity_type)
        })) || []
      };
    } catch (error) {
      console.error('Error getting user points:', error);
      throw error;
    }
  }

  /**
   * Get activity description for display
   */
  private getActivityDescription(activityType: ActivityType): string {
    const descriptions = {
      [ActivityType.POST_CREATION]: 'Created a post',
      [ActivityType.COMMENT]: 'Made a comment',
      [ActivityType.LIKE_RECEIVED]: 'Received a like',
      [ActivityType.SHARE]: 'Shared content',
      [ActivityType.PROFILE_UPDATE]: 'Updated profile',
      [ActivityType.LOGIN_STREAK]: 'Login streak bonus',
      [ActivityType.CONTENT_QUALITY]: 'Quality content bonus',
      [ActivityType.COMMUNITY_HELP]: 'Helped community member',
      [ActivityType.EVENT_PARTICIPATION]: 'Participated in event',
      [ActivityType.MODERATION_ACTION]: 'Moderation action'
    };

    return descriptions[activityType] || 'Unknown activity';
  }
}

/**
 * Badge System - Manages badge definitions and progress
 */
export class BadgeSystem {
  private supabase: SupabaseClient;
  private badges: Map<string, Badge>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.badges = new Map();
    this.loadBadges();
  }

  /**
   * Load badges from database
   */
  private async loadBadges(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('badges')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      data?.forEach(badge => {
        this.badges.set(badge.id, {
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          rarity: badge.rarity,
          requirements: badge.requirements,
          points: badge.points,
          isActive: badge.is_active,
          createdAt: new Date(badge.created_at)
        });
      });
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  }

  /**
   * Check if user earned any badges from activity
   */
  async checkBadgeEligibility(
    userId: string,
    activityType: ActivityType,
    metadata: Record<string, any> = {}
  ): Promise<Badge[]> {
    try {
      const earnedBadges: Badge[] = [];
      
      for (const badge of this.badges.values()) {
        if (badge.requirements.activityType === activityType) {
          const progress = await this.getBadgeProgress(userId, badge.id);
          
          if (!progress.isEarned && await this.checkBadgeRequirements(userId, badge, metadata)) {
            await this.awardBadge(userId, badge.id);
            earnedBadges.push(badge);
          }
        }
      }

      return earnedBadges;
    } catch (error) {
      console.error('Error checking badge eligibility:', error);
      return [];
    }
  }

  /**
   * Check if user meets badge requirements
   */
  private async checkBadgeRequirements(
    userId: string,
    badge: Badge,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      const { requirements } = badge;

      // Get user activity count for the badge's activity type
      let query = this.supabase
        .from('user_points_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (requirements.activityType) {
        query = query.eq('activity_type', requirements.activityType);
      }

      if (requirements.timeframe) {
        const timeframeStart = new Date();
        timeframeStart.setDate(timeframeStart.getDate() - requirements.timeframe);
        query = query.gte('created_at', timeframeStart.toISOString());
      }

      const { count, error } = await query;
      if (error) throw error;

      // Check if threshold is met
      if ((count || 0) < requirements.threshold) {
        return false;
      }

      // Check additional conditions
      if (requirements.conditions) {
        return this.checkAdditionalConditions(userId, requirements.conditions, metadata);
      }

      return true;
    } catch (error) {
      console.error('Error checking badge requirements:', error);
      return false;
    }
  }

  /**
   * Check additional badge conditions
   */
  private async checkAdditionalConditions(
    userId: string,
    conditions: Record<string, any>,
    metadata: Record<string, any>
  ): Promise<boolean> {
    // Implement specific condition checks based on your requirements
    // This is a flexible system that can be extended
    
    if (conditions.minQualityScore && metadata.qualityScore < conditions.minQualityScore) {
      return false;
    }

    if (conditions.minStreak && metadata.streak < conditions.minStreak) {
      return false;
    }

    if (conditions.communityEngagement && metadata.communityEngagement < conditions.communityEngagement) {
      return false;
    }

    return true;
  }

  /**
   * Award badge to user
   */
  private async awardBadge(userId: string, badgeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_badges')
      .upsert({
        user_id: userId,
        badge_id: badgeId,
        earned_at: new Date().toISOString(),
        is_earned: true
      });

    if (error) throw error;
  }

  /**
   * Get badge progress for user
   */
  async getBadgeProgress(userId: string, badgeId: string): Promise<BadgeProgress> {
    try {
      const { data, error } = await this.supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId)
        .eq('badge_id', badgeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        userId,
        badgeId,
        currentProgress: data?.current_progress || 0,
        isEarned: data?.is_earned || false,
        earnedAt: data?.earned_at ? new Date(data.earned_at) : undefined,
        progressHistory: data?.progress_history || []
      };
    } catch (error) {
      console.error('Error getting badge progress:', error);
      throw error;
    }
  }

  /**
   * Get all user badges
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_badges')
        .select(`
          *,
          badge:badges(*)
        `)
        .eq('user_id', userId)
        .eq('is_earned', true);

      if (error) throw error;

      return data?.map(item => ({
        id: item.badge.id,
        name: item.badge.name,
        description: item.badge.description,
        icon: item.badge.icon,
        rarity: item.badge.rarity,
        requirements: item.badge.requirements,
        points: item.badge.points,
        isActive: item.badge.is_active,
        createdAt: new Date(item.badge.created_at)
      })) || [];
    } catch (error) {
      console.error('Error getting user badges:', error);
      return [];
    }
  }
}

/**
 * Leaderboard Manager - Handles rankings and competitive displays
 */
export class LeaderboardManager {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get global leaderboard
   */
  async getGlobalLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('leaderboard_view')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data?.map((entry, index) => ({
        userId: entry.user_id,
        username: entry.username,
        avatar: entry.avatar,
        points: entry.total_points,
        rank: index + 1,
        level: Math.floor(entry.total_points / 1000) + 1,
        badges: entry.badges || [],
        streak: entry.streak || 0,
        change: entry.rank_change || 0
      })) || [];
    } catch (error) {
      console.error('Error getting global leaderboard:', error);
      return [];
    }
  }

  /**
   * Get weekly leaderboard
   */
  async getWeeklyLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const { data, error } = await this.supabase
        .from('user_points_transactions')
        .select(`
          user_id,
          user:users(username, avatar),
          points
        `)
        .gte('created_at', weekStart.toISOString())
        .order('points', { ascending: false });

      if (error) throw error;

      // Aggregate points by user
      const userPoints = new Map<string, number>();
      const userDetails = new Map<string, any>();

      data?.forEach(transaction => {
        const currentPoints = userPoints.get(transaction.user_id) || 0;
        userPoints.set(transaction.user_id, currentPoints + transaction.points);
        userDetails.set(transaction.user_id, transaction.user);
      });

      // Convert to leaderboard entries
      const entries: LeaderboardEntry[] = Array.from(userPoints.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([userId, points], index) => {
          const user = userDetails.get(userId);
          return {
            userId,
            username: user?.username || 'Unknown',
            avatar: user?.avatar,
            points,
            rank: index + 1,
            level: Math.floor(points / 1000) + 1,
            badges: [],
            streak: 0,
            change: 0
          };
        });

      return entries;
    } catch (error) {
      console.error('Error getting weekly leaderboard:', error);
      return [];
    }
  }

  /**
   * Get user's leaderboard position
   */
  async getUserPosition(userId: string): Promise<{ rank: number; totalUsers: number }> {
    try {
      const { data, error } = await this.supabase.rpc('get_user_leaderboard_position', {
        p_user_id: userId
      });

      if (error) throw error;

      return {
        rank: data?.rank || 0,
        totalUsers: data?.total_users || 0
      };
    } catch (error) {
      console.error('Error getting user position:', error);
      return { rank: 0, totalUsers: 0 };
    }
  }

  /**
   * Update leaderboard rankings (call periodically)
   */
  async updateRankings(): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('update_leaderboard_rankings');
      if (error) throw error;
    } catch (error) {
      console.error('Error updating rankings:', error);
      throw error;
    }
  }
}

/**
 * Achievement Tracker - Manages goal-based achievements
 */
export class AchievementTracker {
  private supabase: SupabaseClient;
  private achievements: Map<string, Achievement>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.achievements = new Map();
    this.loadAchievements();
  }

  /**
   * Load achievements from database
   */
  private async loadAchievements(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      data