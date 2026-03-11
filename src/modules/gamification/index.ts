```typescript
export * from './components/AchievementCard';
export * from './components/AchievementGrid';
export * from './components/Leaderboard';
export * from './components/XPProgressBar';
export * from './components/LevelBadge';
export * from './components/ChallengeCard';
export * from './components/ChallengeList';
export * from './components/RewardModal';
export * from './components/StreakCounter';

export * from './hooks/useGamification';
export * from './hooks/useAchievements';
export * from './hooks/useLeaderboard';
export * from './hooks/useChallenges';

export * from './services/gamificationService';
export * from './services/achievementEngine';
export * from './services/xpCalculator';

export * from './types/gamification';

export * from './config/achievements';
export * from './config/levels';

export * from './utils/xpUtils';
export * from './utils/achievementUtils';

import { GamificationService } from './services/gamificationService';
import { AchievementEngine } from './services/achievementEngine';
import { XPCalculator } from './services/xpCalculator';
import { ACHIEVEMENT_CONFIG } from './config/achievements';
import { LEVEL_CONFIG } from './config/levels';
import type { 
  GamificationConfig, 
  GamificationState, 
  Achievement, 
  Challenge,
  UserLevel,
  XPTransaction,
  LeaderboardEntry 
} from './types/gamification';

/**
 * Community Gamification Engine
 * Comprehensive gamification system with achievements, leaderboards, XP tracking, and community challenges
 */
export class GamificationEngine {
  private gamificationService: GamificationService;
  private achievementEngine: AchievementEngine;
  private xpCalculator: XPCalculator;
  private config: GamificationConfig;

  /**
   * Initialize the gamification engine
   * @param config - Gamification configuration
   */
  constructor(config?: Partial<GamificationConfig>) {
    this.config = {
      enableAchievements: true,
      enableLeaderboards: true,
      enableChallenges: true,
      enableStreaks: true,
      xpMultiplier: 1.0,
      levelCap: 100,
      achievementRewards: true,
      communityFeatures: true,
      ...config
    };

    this.gamificationService = new GamificationService(this.config);
    this.achievementEngine = new AchievementEngine(ACHIEVEMENT_CONFIG);
    this.xpCalculator = new XPCalculator(LEVEL_CONFIG);
  }

  /**
   * Get user's gamification state
   * @param userId - User identifier
   * @returns Promise resolving to user's gamification state
   */
  async getUserState(userId: string): Promise<GamificationState> {
    try {
      return await this.gamificationService.getUserState(userId);
    } catch (error) {
      throw new Error(`Failed to get user gamification state: ${error}`);
    }
  }

  /**
   * Award experience points to user
   * @param userId - User identifier
   * @param action - Action that earned XP
   * @param baseXP - Base XP amount
   * @returns Promise resolving to XP transaction result
   */
  async awardXP(userId: string, action: string, baseXP: number): Promise<XPTransaction> {
    try {
      const xpAmount = this.xpCalculator.calculateXP(baseXP, action, userId);
      const transaction = await this.gamificationService.awardXP(userId, xpAmount, action);
      
      // Check for achievements
      await this.achievementEngine.checkAchievements(userId, action, xpAmount);
      
      return transaction;
    } catch (error) {
      throw new Error(`Failed to award XP: ${error}`);
    }
  }

  /**
   * Get user's achievements
   * @param userId - User identifier
   * @returns Promise resolving to user's achievements
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      return await this.achievementEngine.getUserAchievements(userId);
    } catch (error) {
      throw new Error(`Failed to get user achievements: ${error}`);
    }
  }

  /**
   * Get leaderboard data
   * @param category - Leaderboard category
   * @param timeframe - Time period for leaderboard
   * @param limit - Maximum number of entries
   * @returns Promise resolving to leaderboard entries
   */
  async getLeaderboard(
    category: string = 'overall',
    timeframe: 'daily' | 'weekly' | 'monthly' | 'allTime' = 'weekly',
    limit: number = 100
  ): Promise<LeaderboardEntry[]> {
    try {
      return await this.gamificationService.getLeaderboard(category, timeframe, limit);
    } catch (error) {
      throw new Error(`Failed to get leaderboard: ${error}`);
    }
  }

  /**
   * Get active challenges
   * @param userId - User identifier
   * @returns Promise resolving to active challenges
   */
  async getActiveChallenges(userId: string): Promise<Challenge[]> {
    try {
      return await this.gamificationService.getActiveChallenges(userId);
    } catch (error) {
      throw new Error(`Failed to get active challenges: ${error}`);
    }
  }

  /**
   * Join a community challenge
   * @param userId - User identifier
   * @param challengeId - Challenge identifier
   * @returns Promise resolving to challenge participation result
   */
  async joinChallenge(userId: string, challengeId: string): Promise<boolean> {
    try {
      return await this.gamificationService.joinChallenge(userId, challengeId);
    } catch (error) {
      throw new Error(`Failed to join challenge: ${error}`);
    }
  }

  /**
   * Update challenge progress
   * @param userId - User identifier
   * @param challengeId - Challenge identifier
   * @param progress - Progress amount
   * @returns Promise resolving to updated challenge state
   */
  async updateChallengeProgress(
    userId: string, 
    challengeId: string, 
    progress: number
  ): Promise<Challenge> {
    try {
      return await this.gamificationService.updateChallengeProgress(userId, challengeId, progress);
    } catch (error) {
      throw new Error(`Failed to update challenge progress: ${error}`);
    }
  }

  /**
   * Get user's current level
   * @param userId - User identifier
   * @returns Promise resolving to user's level information
   */
  async getUserLevel(userId: string): Promise<UserLevel> {
    try {
      const state = await this.getUserState(userId);
      return this.xpCalculator.calculateLevel(state.totalXP);
    } catch (error) {
      throw new Error(`Failed to get user level: ${error}`);
    }
  }

  /**
   * Get user's streak information
   * @param userId - User identifier
   * @returns Promise resolving to streak data
   */
  async getUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActivity: Date }> {
    try {
      return await this.gamificationService.getUserStreak(userId);
    } catch (error) {
      throw new Error(`Failed to get user streak: ${error}`);
    }
  }

  /**
   * Record user activity for streak tracking
   * @param userId - User identifier
   * @param activity - Activity type
   * @returns Promise resolving to updated streak information
   */
  async recordActivity(userId: string, activity: string): Promise<void> {
    try {
      await this.gamificationService.recordActivity(userId, activity);
    } catch (error) {
      throw new Error(`Failed to record activity: ${error}`);
    }
  }

  /**
   * Get available rewards for user
   * @param userId - User identifier
   * @returns Promise resolving to available rewards
   */
  async getAvailableRewards(userId: string): Promise<any[]> {
    try {
      return await this.gamificationService.getAvailableRewards(userId);
    } catch (error) {
      throw new Error(`Failed to get available rewards: ${error}`);
    }
  }

  /**
   * Claim a reward
   * @param userId - User identifier
   * @param rewardId - Reward identifier
   * @returns Promise resolving to claim result
   */
  async claimReward(userId: string, rewardId: string): Promise<boolean> {
    try {
      return await this.gamificationService.claimReward(userId, rewardId);
    } catch (error) {
      throw new Error(`Failed to claim reward: ${error}`);
    }
  }

  /**
   * Get gamification statistics for admin dashboard
   * @returns Promise resolving to system statistics
   */
  async getSystemStats(): Promise<{
    totalUsers: number;
    totalXPAwarded: number;
    achievementsUnlocked: number;
    activeChallenges: number;
    leaderboardUpdates: number;
  }> {
    try {
      return await this.gamificationService.getSystemStats();
    } catch (error) {
      throw new Error(`Failed to get system stats: ${error}`);
    }
  }

  /**
   * Reset user's gamification data
   * @param userId - User identifier
   * @returns Promise resolving to reset confirmation
   */
  async resetUserData(userId: string): Promise<boolean> {
    try {
      return await this.gamificationService.resetUserData(userId);
    } catch (error) {
      throw new Error(`Failed to reset user data: ${error}`);
    }
  }

  /**
   * Update gamification configuration
   * @param newConfig - New configuration settings
   */
  updateConfig(newConfig: Partial<GamificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.gamificationService.updateConfig(this.config);
  }

  /**
   * Get current configuration
   * @returns Current gamification configuration
   */
  getConfig(): GamificationConfig {
    return { ...this.config };
  }

  /**
   * Dispose of resources and cleanup
   */
  dispose(): void {
    this.gamificationService.dispose();
    this.achievementEngine.dispose();
    this.xpCalculator.dispose();
  }
}

/**
 * Default gamification engine instance
 */
export const gamificationEngine = new GamificationEngine();

/**
 * Create a new gamification engine with custom configuration
 * @param config - Gamification configuration
 * @returns New gamification engine instance
 */
export function createGamificationEngine(config?: Partial<GamificationConfig>): GamificationEngine {
  return new GamificationEngine(config);
}

/**
 * Gamification engine factory with singleton pattern
 */
export class GamificationEngineFactory {
  private static instance: GamificationEngine;

  /**
   * Get singleton instance of gamification engine
   * @param config - Optional configuration for first initialization
   * @returns Gamification engine instance
   */
  static getInstance(config?: Partial<GamificationConfig>): GamificationEngine {
    if (!GamificationEngineFactory.instance) {
      GamificationEngineFactory.instance = new GamificationEngine(config);
    }
    return GamificationEngineFactory.instance;
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (GamificationEngineFactory.instance) {
      GamificationEngineFactory.instance.dispose();
      GamificationEngineFactory.instance = null as any;
    }
  }
}

export default GamificationEngine;
```