```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GamificationEngine } from './core/GamificationEngine';
import { PointsSystem } from './core/PointsSystem';
import { BadgeManager } from './core/BadgeManager';
import { LeaderboardService } from './core/LeaderboardService';
import { AchievementTracker } from './core/AchievementTracker';
import { RewardRuleEngine } from './rules/RewardRuleEngine';
import { ExternalRewardsConnector } from './integrations/ExternalRewardsConnector';
import { ActivityProcessor } from './utils/ActivityProcessor';
import {
  GamificationServiceConfig,
  UserActivity,
  UserProfile,
  Achievement,
  Badge,
  LeaderboardEntry,
  PointsTransaction,
  RewardRule,
  ExternalReward,
  ServiceResponse,
  GamificationMetrics,
  ActivityType
} from './models/GamificationTypes';

/**
 * Community Gamification Service
 * 
 * Manages community engagement through points, badges, leaderboards, and achievements.
 * Supports custom reward rules and integration with external incentive programs.
 * 
 * Features:
 * - Dynamic points system with configurable rules
 * - Badge management and automated awarding
 * - Real-time leaderboards with multiple categories
 * - Achievement tracking and progression
 * - External rewards integration (Discord, NFTs, tokens)
 * - Advanced analytics and metrics
 * 
 * @example
 * ```typescript
 * const gamificationService = new CommunityGamificationService({
 *   supabaseUrl: process.env.SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_ANON_KEY!,
 *   enableRealtime: true
 * });
 * 
 * // Process user activity
 * await gamificationService.processActivity({
 *   userId: 'user-123',
 *   type: 'audio_upload',
 *   metadata: { duration: 300, quality: 'high' }
 * });
 * 
 * // Get user profile
 * const profile = await gamificationService.getUserProfile('user-123');
 * ```
 */
export class CommunityGamificationService {
  private supabase: SupabaseClient;
  private gamificationEngine: GamificationEngine;
  private pointsSystem: PointsSystem;
  private badgeManager: BadgeManager;
  private leaderboardService: LeaderboardService;
  private achievementTracker: AchievementTracker;
  private rewardRuleEngine: RewardRuleEngine;
  private externalRewardsConnector: ExternalRewardsConnector;
  private activityProcessor: ActivityProcessor;
  private config: GamificationServiceConfig;

  /**
   * Initialize Community Gamification Service
   */
  constructor(config: GamificationServiceConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    
    this.initializeComponents();
  }

  /**
   * Initialize all service components
   */
  private initializeComponents(): void {
    this.pointsSystem = new PointsSystem(this.supabase);
    this.badgeManager = new BadgeManager(this.supabase);
    this.leaderboardService = new LeaderboardService(this.supabase);
    this.achievementTracker = new AchievementTracker(this.supabase);
    this.rewardRuleEngine = new RewardRuleEngine(this.supabase);
    this.externalRewardsConnector = new ExternalRewardsConnector(this.config.externalRewards);
    this.activityProcessor = new ActivityProcessor(this.supabase);

    this.gamificationEngine = new GamificationEngine({
      pointsSystem: this.pointsSystem,
      badgeManager: this.badgeManager,
      leaderboardService: this.leaderboardService,
      achievementTracker: this.achievementTracker,
      rewardRuleEngine: this.rewardRuleEngine,
      externalRewardsConnector: this.externalRewardsConnector
    });
  }

  /**
   * Process user activity and trigger gamification rewards
   */
  async processActivity(activity: UserActivity): Promise<ServiceResponse<{
    pointsAwarded: number;
    badgesEarned: Badge[];
    achievementsUnlocked: Achievement[];
    externalRewards: ExternalReward[];
  }>> {
    try {
      // Validate activity
      const validationResult = await this.activityProcessor.validateActivity(activity);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.error || 'Invalid activity data',
          data: null
        };
      }

      // Process through gamification engine
      const result = await this.gamificationEngine.processActivity(activity);

      // Update real-time leaderboards if enabled
      if (this.config.enableRealtime && result.pointsAwarded > 0) {
        await this.updateRealtimeLeaderboards(activity.userId, result.pointsAwarded);
      }

      // Log activity for analytics
      await this.logActivityMetrics(activity, result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error processing activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null
      };
    }
  }

  /**
   * Get user gamification profile
   */
  async getUserProfile(userId: string): Promise<ServiceResponse<UserProfile>> {
    try {
      const [
        userPoints,
        userBadges,
        userAchievements,
        leaderboardRank
      ] = await Promise.all([
        this.pointsSystem.getUserPoints(userId),
        this.badgeManager.getUserBadges(userId),
        this.achievementTracker.getUserAchievements(userId),
        this.leaderboardService.getUserRank(userId, 'overall')
      ]);

      const profile: UserProfile = {
        userId,
        totalPoints: userPoints.total,
        availablePoints: userPoints.available,
        level: this.calculateUserLevel(userPoints.total),
        badges: userBadges,
        achievements: userAchievements,
        leaderboardRank,
        joinedAt: userPoints.joinedAt,
        lastActivity: userPoints.lastActivity
      };

      return {
        success: true,
        data: profile
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user profile',
        data: null
      };
    }
  }

  /**
   * Get leaderboard for specific category
   */
  async getLeaderboard(
    category: string = 'overall',
    timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'all-time',
    limit: number = 100,
    offset: number = 0
  ): Promise<ServiceResponse<LeaderboardEntry[]>> {
    try {
      const leaderboard = await this.leaderboardService.getLeaderboard(
        category,
        timeframe,
        limit,
        offset
      );

      return {
        success: true,
        data: leaderboard
      };
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
        data: null
      };
    }
  }

  /**
   * Award points manually (admin function)
   */
  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    adminId: string
  ): Promise<ServiceResponse<PointsTransaction>> {
    try {
      // Verify admin permissions
      const hasPermission = await this.verifyAdminPermissions(adminId);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions',
          data: null
        };
      }

      const transaction = await this.pointsSystem.awardPoints(userId, points, reason, adminId);

      // Process potential badge/achievement unlocks
      await this.gamificationEngine.checkProgressionRewards(userId);

      return {
        success: true,
        data: transaction
      };
    } catch (error) {
      console.error('Error awarding points:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to award points',
        data: null
      };
    }
  }

  /**
   * Create custom badge
   */
  async createBadge(
    badge: Omit<Badge, 'id' | 'createdAt'>,
    adminId: string
  ): Promise<ServiceResponse<Badge>> {
    try {
      const hasPermission = await this.verifyAdminPermissions(adminId);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions',
          data: null
        };
      }

      const createdBadge = await this.badgeManager.createBadge(badge);
      return {
        success: true,
        data: createdBadge
      };
    } catch (error) {
      console.error('Error creating badge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create badge',
        data: null
      };
    }
  }

  /**
   * Create custom achievement
   */
  async createAchievement(
    achievement: Omit<Achievement, 'id' | 'createdAt'>,
    adminId: string
  ): Promise<ServiceResponse<Achievement>> {
    try {
      const hasPermission = await this.verifyAdminPermissions(adminId);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions',
          data: null
        };
      }

      const createdAchievement = await this.achievementTracker.createAchievement(achievement);
      return {
        success: true,
        data: createdAchievement
      };
    } catch (error) {
      console.error('Error creating achievement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create achievement',
        data: null
      };
    }
  }

  /**
   * Create custom reward rule
   */
  async createRewardRule(
    rule: Omit<RewardRule, 'id' | 'createdAt'>,
    adminId: string
  ): Promise<ServiceResponse<RewardRule>> {
    try {
      const hasPermission = await this.verifyAdminPermissions(adminId);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions',
          data: null
        };
      }

      const createdRule = await this.rewardRuleEngine.createRule(rule);
      return {
        success: true,
        data: createdRule
      };
    } catch (error) {
      console.error('Error creating reward rule:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reward rule',
        data: null
      };
    }
  }

  /**
   * Get gamification metrics and analytics
   */
  async getMetrics(
    timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<ServiceResponse<GamificationMetrics>> {
    try {
      const [
        totalUsers,
        activeUsers,
        totalPointsAwarded,
        badgesAwarded,
        achievementsUnlocked,
        topActivities
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(timeframe),
        this.getTotalPointsAwarded(timeframe),
        this.getBadgesAwarded(timeframe),
        this.getAchievementsUnlocked(timeframe),
        this.getTopActivities(timeframe)
      ]);

      const metrics: GamificationMetrics = {
        timeframe,
        totalUsers,
        activeUsers,
        totalPointsAwarded,
        badgesAwarded,
        achievementsUnlocked,
        topActivities,
        engagementRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        data: null
      };
    }
  }

  /**
   * Subscribe to real-time leaderboard updates
   */
  subscribeToLeaderboard(
    category: string,
    callback: (leaderboard: LeaderboardEntry[]) => void
  ): () => void {
    if (!this.config.enableRealtime) {
      console.warn('Real-time is not enabled');
      return () => {};
    }

    const subscription = this.supabase
      .channel(`leaderboard_${category}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboards',
          filter: `category=eq.${category}`
        },
        async () => {
          const result = await this.getLeaderboard(category);
          if (result.success) {
            callback(result.data!);
          }
        }
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(subscription);
    };
  }

  /**
   * Calculate user level based on total points
   */
  private calculateUserLevel(totalPoints: number): number {
    // Exponential leveling system
    return Math.floor(Math.sqrt(totalPoints / 100)) + 1;
  }

  /**
   * Update real-time leaderboards
   */
  private async updateRealtimeLeaderboards(userId: string, pointsAwarded: number): Promise<void> {
    try {
      await this.leaderboardService.updateUserScore(userId, pointsAwarded);
    } catch (error) {
      console.error('Error updating real-time leaderboards:', error);
    }
  }

  /**
   * Log activity metrics for analytics
   */
  private async logActivityMetrics(
    activity: UserActivity,
    result: {
      pointsAwarded: number;
      badgesEarned: Badge[];
      achievementsUnlocked: Achievement[];
    }
  ): Promise<void> {
    try {
      await this.supabase
        .from('activity_metrics')
        .insert({
          user_id: activity.userId,
          activity_type: activity.type,
          points_awarded: result.pointsAwarded,
          badges_earned: result.badgesEarned.length,
          achievements_unlocked: result.achievementsUnlocked.length,
          metadata: activity.metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging activity metrics:', error);
    }
  }

  /**
   * Verify admin permissions
   */
  private async verifyAdminPermissions(adminId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', adminId)
        .single();

      if (error || !data) return false;
      return ['admin', 'moderator'].includes(data.role);
    } catch (error) {
      console.error('Error verifying admin permissions:', error);
      return false;
    }
  }

  /**
   * Get total users count
   */
  private async getTotalUsers(): Promise<number> {
    const { count } = await this.supabase
      .from('user_points')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  /**
   * Get active users count
   */
  private async getActiveUsers(timeframe: string): Promise<number> {
    const date = new Date();
    if (timeframe === 'daily') {
      date.setDate(date.getDate() - 1);
    } else if (timeframe === 'weekly') {
      date.setDate(date.getDate() - 7);
    } else if (timeframe === 'monthly') {
      date.setMonth(date.getMonth() - 1);
    }

    const { count } = await this.supabase
      .from('activity_metrics')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', date.toISOString());

    return count || 0;
  }

  /**
   * Get total points awarded
   */
  private async getTotalPointsAwarded(timeframe: string): Promise<number> {
    const date = new Date();
    if (timeframe === 'daily') {
      date.setDate(date.getDate() - 1);
    } else if (timeframe === 'weekly') {
      date.setDate(date.getDate() - 7);
    } else if (timeframe === 'monthly') {
      date.setMonth(date.getMonth() - 1);
    }

    const { data } = await this.supabase
      .from('points_transactions')
      .select('points')
      .gte('created_at', date.toISOString());

    return data?.reduce((sum, tx) => sum + tx.points, 0) || 0;
  }

  /**
   * Get badges awarded count
   */
  private async getBadgesAwarded(timeframe: string): Promise<number> {
    const date = new Date();
    if (timeframe === 'daily') {
      date.setDate(date.getDate() - 1);
    } else if (timeframe === 'weekly') {
      date.setDate(date.getDate() - 7);
    } else if (timeframe === 'monthly') {
      date.setMonth(date.getMonth() - 1);
    }

    const { count } = await this.supabase
      .from('user_badges')
      .select('*', { count: 'exact', head: true })
      .gte('earned_at', date.toISOString());

    return count || 0;
  }

  /**
   * Get achievements unlocked count
   */
  private async getAchievementsUnlocked(timeframe: string): Promise<number> {
    const date = new Date();
    if (timeframe === 'daily') {
      date.setDate(date.getDate() - 1);
    } else if (timeframe === 'weekly') {
      date.setDate(date.getDate() - 7);
    } else if (timeframe === 'monthly') {
      date.setMonth(date.getMonth() - 1);
    }

    const { count } = await this.supabase
      .from('user_achievements')
      .select('*', { count: 'exact', head: true })
      .gte('unlocked_at', date.toISOString());

    return count || 0;
  }

  /**
   * Get top activities
   */
  private async getTopActivities(timeframe: string): Promise<Array<{
    activityType: ActivityType;
    count: number;
    totalPoints: number;
  }>> {
    const date = new Date();
    if (timeframe === 'daily') {
      date.setDate(date.getDate() - 1);
    } else if (timeframe === 'weekly') {
      date.setDate(date.getDate() - 7);
    } else if (timeframe === 'monthly') {
      date.setMonth(date.getMonth() - 1);
    }

    const { data } = await this.supabase
      .from('activity_metrics')
      .select('activity_type, points_awarded')
      .gte('created_at', date.toISOString());

    const activities = data?.reduce((acc, metric) => {
      const type = metric.activity_type as ActivityType;
      if (!acc[type]) {
        acc[type] = { count: 0, totalPoints: 0 };
      }
      acc[type].count++;
      acc[type].totalPoints += metric.points_awarded;
      return acc;
    }, {} as Record<ActivityType, { count: number; totalPoints: number }>) || {};

    return Object.entries(activities)
      .map(([activityType, stats]) => ({
        activityType: activityType as ActivityType,
        ...stats
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10);
  }
}

export default CommunityGamificationService;

// Export all types for external use
export * from './models/GamificationTypes';
export { GamificationEngine } from './core/GamificationEngine';
export { PointsSystem } from './core/PointsSystem';
export { BadgeManager } from './core/BadgeManager';
export { LeaderboardService } from './core/LeaderboardService';
export { AchievementTracker } from './core/AchievementTracker';
export { RewardRuleEngine } from './rules/RewardRuleEngine';
export { ExternalRewardsConnector } from './integrations/ExternalRewardsConnector';
```