import { ReputationEngine } from '../../community/reputation-engine';
import { ReputationCalculator } from '../../community/reputation-calculator';
import { BehaviorAnalyzer } from '../../community/behavior-analyzer';
import { GamificationSystem } from '../../community/gamification-system';
import { AntiGamingDetector } from '../../community/anti-gaming-detector';
import { ReputationMetrics } from '../../community/reputation-metrics';
import { CommunityReputationModel } from '../../community/community-reputation-model';
import { createClient } from '@supabase/supabase-js';
import { createRedisClient } from '../../lib/redis';
import { EventEmitter } from 'events';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../lib/redis');
jest.mock('../../services/community-service');
jest.mock('../../services/analytics-service');
jest.mock('../../services/notification-service');

// Mock data
const mockUser = {
  id: 'user-123',
  communityId: 'community-456',
  joinedAt: '2023-01-01T00:00:00Z'
};

const mockCommunity = {
  id: 'community-456',
  name: 'Test Community',
  reputationModel: {
    dimensions: ['helpfulness', 'expertise', 'engagement'],
    weights: { helpfulness: 0.4, expertise: 0.4, engagement: 0.2 },
    decayRate: 0.1
  }
};

const mockUserActions = [
  { type: 'post_created', timestamp: Date.now(), metadata: { quality: 0.8 } },
  { type: 'helpful_vote', timestamp: Date.now() - 3600000, metadata: { weight: 1.0 } },
  { type: 'comment_liked', timestamp: Date.now() - 7200000, metadata: { count: 5 } }
];

describe('ReputationEngine', () => {
  let reputationEngine: ReputationEngine;
  let mockSupabase: any;
  let mockRedis: any;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockUser }))
          }))
        })),
        insert: jest.fn(() => Promise.resolve({ data: {} })),
        update: jest.fn(() => Promise.resolve({ data: {} })),
        upsert: jest.fn(() => Promise.resolve({ data: {} }))
      }))
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      zadd: jest.fn(),
      zrange: jest.fn()
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (createRedisClient as jest.Mock).mockReturnValue(mockRedis);

    eventEmitter = new EventEmitter();
    reputationEngine = new ReputationEngine({
      supabase: mockSupabase,
      redis: mockRedis,
      eventEmitter
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    eventEmitter.removeAllListeners();
  });

  describe('calculateReputation', () => {
    it('should calculate multi-dimensional reputation score', async () => {
      const result = await reputationEngine.calculateReputation(
        mockUser.id,
        mockCommunity.id,
        mockUserActions
      );

      expect(result).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          communityId: mockCommunity.id,
          totalScore: expect.any(Number),
          dimensions: expect.objectContaining({
            helpfulness: expect.any(Number),
            expertise: expect.any(Number),
            engagement: expect.any(Number)
          }),
          level: expect.any(Number),
          percentile: expect.any(Number)
        })
      );
    });

    it('should handle empty action history', async () => {
      const result = await reputationEngine.calculateReputation(
        mockUser.id,
        mockCommunity.id,
        []
      );

      expect(result.totalScore).toBe(0);
      expect(result.level).toBe(1);
      expect(result.percentile).toBe(0);
    });

    it('should apply time decay to older actions', async () => {
      const oldActions = [
        { type: 'helpful_vote', timestamp: Date.now() - 86400000 * 30, metadata: { weight: 1.0 } }
      ];

      const newActions = [
        { type: 'helpful_vote', timestamp: Date.now(), metadata: { weight: 1.0 } }
      ];

      const oldResult = await reputationEngine.calculateReputation(
        mockUser.id,
        mockCommunity.id,
        oldActions
      );

      const newResult = await reputationEngine.calculateReputation(
        mockUser.id,
        mockCommunity.id,
        newActions
      );

      expect(newResult.totalScore).toBeGreaterThan(oldResult.totalScore);
    });

    it('should handle calculation errors gracefully', async () => {
      jest.spyOn(reputationEngine, 'calculateReputation').mockRejectedValueOnce(
        new Error('Calculation failed')
      );

      await expect(
        reputationEngine.calculateReputation(mockUser.id, mockCommunity.id, mockUserActions)
      ).rejects.toThrow('Calculation failed');
    });
  });

  describe('updateReputation', () => {
    it('should update user reputation and cache results', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce('OK');

      const result = await reputationEngine.updateReputation(
        mockUser.id,
        mockCommunity.id,
        'helpful_vote',
        { weight: 1.0 }
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        `reputation:${mockUser.id}:${mockCommunity.id}`,
        expect.any(String),
        'EX',
        3600
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          reputation: expect.any(Object)
        })
      );
    });

    it('should emit reputation change events', async () => {
      const eventSpy = jest.fn();
      eventEmitter.on('reputation:updated', eventSpy);

      await reputationEngine.updateReputation(
        mockUser.id,
        mockCommunity.id,
        'helpful_vote',
        { weight: 1.0 }
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          communityId: mockCommunity.id,
          change: expect.any(Number)
        })
      );
    });

    it('should handle database update failures', async () => {
      mockSupabase.from.mockReturnValueOnce({
        upsert: jest.fn(() => Promise.reject(new Error('Database error')))
      });

      await expect(
        reputationEngine.updateReputation(mockUser.id, mockCommunity.id, 'helpful_vote', {})
      ).rejects.toThrow('Database error');
    });
  });

  describe('getReputation', () => {
    it('should retrieve reputation from cache if available', async () => {
      const cachedReputation = {
        userId: mockUser.id,
        communityId: mockCommunity.id,
        totalScore: 150,
        level: 3
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedReputation));

      const result = await reputationEngine.getReputation(mockUser.id, mockCommunity.id);

      expect(result).toEqual(cachedReputation);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `reputation:${mockUser.id}:${mockCommunity.id}`
      );
    });

    it('should calculate reputation if not cached', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: mockUserActions }))
          }))
        }))
      });

      const result = await reputationEngine.getReputation(mockUser.id, mockCommunity.id);

      expect(result).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          communityId: mockCommunity.id,
          totalScore: expect.any(Number)
        })
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should retrieve community leaderboard', async () => {
      const mockLeaderboard = [
        { userId: 'user-1', score: 200, rank: 1 },
        { userId: 'user-2', score: 180, rank: 2 },
        { userId: 'user-3', score: 160, rank: 3 }
      ];

      mockRedis.zrange.mockResolvedValueOnce(
        mockLeaderboard.map(entry => `${entry.userId}:${entry.score}`)
      );

      const result = await reputationEngine.getLeaderboard(mockCommunity.id, 10);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          score: 200,
          rank: 1
        })
      );
    });

    it('should handle empty leaderboard', async () => {
      mockRedis.zrange.mockResolvedValueOnce([]);

      const result = await reputationEngine.getLeaderboard(mockCommunity.id, 10);

      expect(result).toEqual([]);
    });
  });
});

describe('ReputationCalculator', () => {
  let calculator: ReputationCalculator;

  beforeEach(() => {
    calculator = new ReputationCalculator();
  });

  describe('calculateDimensionScore', () => {
    it('should calculate helpfulness score correctly', () => {
      const actions = [
        { type: 'helpful_vote', weight: 1.0, timestamp: Date.now() },
        { type: 'solution_accepted', weight: 2.0, timestamp: Date.now() }
      ];

      const score = calculator.calculateDimensionScore('helpfulness', actions);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should apply different weights for different action types', () => {
      const lowWeightActions = [{ type: 'comment_liked', weight: 0.1, timestamp: Date.now() }];
      const highWeightActions = [{ type: 'solution_accepted', weight: 2.0, timestamp: Date.now() }];

      const lowScore = calculator.calculateDimensionScore('helpfulness', lowWeightActions);
      const highScore = calculator.calculateDimensionScore('helpfulness', highWeightActions);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should handle invalid dimension gracefully', () => {
      expect(() => {
        calculator.calculateDimensionScore('invalid_dimension', []);
      }).toThrow('Unknown reputation dimension: invalid_dimension');
    });
  });

  describe('applyTimeDecay', () => {
    it('should reduce score for older actions', () => {
      const recentAction = { timestamp: Date.now(), score: 100 };
      const oldAction = { timestamp: Date.now() - 86400000 * 30, score: 100 };

      const recentDecayed = calculator.applyTimeDecay(recentAction.score, recentAction.timestamp);
      const oldDecayed = calculator.applyTimeDecay(oldAction.score, oldAction.timestamp);

      expect(oldDecayed).toBeLessThan(recentDecayed);
    });

    it('should handle zero timestamps', () => {
      const result = calculator.applyTimeDecay(100, 0);
      expect(result).toBe(0);
    });
  });

  describe('calculateLevel', () => {
    it('should calculate correct level from score', () => {
      expect(calculator.calculateLevel(0)).toBe(1);
      expect(calculator.calculateLevel(100)).toBe(2);
      expect(calculator.calculateLevel(500)).toBe(3);
      expect(calculator.calculateLevel(1000)).toBeGreaterThan(3);
    });

    it('should handle negative scores', () => {
      expect(calculator.calculateLevel(-50)).toBe(1);
    });
  });
});

describe('BehaviorAnalyzer', () => {
  let analyzer: BehaviorAnalyzer;

  beforeEach(() => {
    analyzer = new BehaviorAnalyzer();
  });

  describe('analyzeUserBehavior', () => {
    it('should analyze user activity patterns', () => {
      const actions = Array.from({ length: 20 }, (_, i) => ({
        type: 'post_created',
        timestamp: Date.now() - i * 3600000,
        metadata: { quality: Math.random() }
      }));

      const analysis = analyzer.analyzeUserBehavior(mockUser.id, actions);

      expect(analysis).toEqual(
        expect.objectContaining({
          userId: mockUser.id,
          activityLevel: expect.any(String),
          consistencyScore: expect.any(Number),
          qualityTrend: expect.any(String),
          suspiciousPatterns: expect.any(Array)
        })
      );
    });

    it('should detect spam patterns', () => {
      const spamActions = Array.from({ length: 50 }, () => ({
        type: 'post_created',
        timestamp: Date.now(),
        metadata: { quality: 0.1 }
      }));

      const analysis = analyzer.analyzeUserBehavior(mockUser.id, spamActions);

      expect(analysis.suspiciousPatterns).toContain('rapid_posting');
    });

    it('should handle empty action history', () => {
      const analysis = analyzer.analyzeUserBehavior(mockUser.id, []);

      expect(analysis.activityLevel).toBe('inactive');
      expect(analysis.consistencyScore).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect unusual activity spikes', () => {
      const normalActions = Array.from({ length: 5 }, (_, i) => ({
        timestamp: Date.now() - i * 86400000,
        type: 'helpful_vote'
      }));

      const spikeActions = Array.from({ length: 100 }, () => ({
        timestamp: Date.now(),
        type: 'helpful_vote'
      }));

      const anomalies = analyzer.detectAnomalies([...normalActions, ...spikeActions]);

      expect(anomalies).toContain('activity_spike');
    });
  });
});

describe('GamificationSystem', () => {
  let gamification: GamificationSystem;

  beforeEach(() => {
    gamification = new GamificationSystem();
  });

  describe('checkAchievements', () => {
    it('should unlock achievements based on reputation', async () => {
      const reputation = {
        totalScore: 500,
        level: 5,
        dimensions: { helpfulness: 80, expertise: 70, engagement: 60 }
      };

      const achievements = await gamification.checkAchievements(mockUser.id, reputation);

      expect(achievements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            unlockedAt: expect.any(Date)
          })
        ])
      );
    });

    it('should not unlock same achievement twice', async () => {
      const reputation = { totalScore: 100, level: 2 };

      await gamification.checkAchievements(mockUser.id, reputation);
      const secondCheck = await gamification.checkAchievements(mockUser.id, reputation);

      expect(secondCheck).toHaveLength(0);
    });
  });

  describe('calculateBadges', () => {
    it('should award badges for milestones', () => {
      const badges = gamification.calculateBadges({
        totalScore: 1000,
        level: 10,
        dimensions: { helpfulness: 90, expertise: 85, engagement: 80 }
      });

      expect(badges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'milestone',
            level: expect.any(String)
          })
        ])
      );
    });

    it('should award specialization badges', () => {
      const badges = gamification.calculateBadges({
        totalScore: 500,
        level: 5,
        dimensions: { helpfulness: 95, expertise: 40, engagement: 30 }
      });

      const helpfulnessBadge = badges.find(b => b.type === 'specialization' && b.dimension === 'helpfulness');
      expect(helpfulnessBadge).toBeDefined();
    });
  });
});

describe('AntiGamingDetector', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  describe('detectGamingAttempts', () => {
    it('should detect vote manipulation', () => {
      const suspiciousActions = Array.from({ length: 20 }, () => ({
        type: 'helpful_vote',
        timestamp: Date.now(),
        sourceUserId: 'accomplice-123',
        targetUserId: mockUser.id
      }));

      const gaming = detector.detectGamingAttempts(mockUser.id, suspiciousActions);

      expect(gaming.detected).toBe(true);
      expect(gaming.patterns).toContain('vote_manipulation');
    });

    it('should detect self-promotion patterns', () => {
      const selfPromotionActions = Array.from({ length: 15 }, () => ({
        type: 'post_created',
        timestamp: Date.now(),
        metadata: { 
          content: 'Check out my amazing content',
          links: ['https://mysite.com']
        }
      }));

      const gaming = detector.detectGamingAttempts(mockUser.id, selfPromotionActions);

      expect(gaming.patterns).toContain('self_promotion');
    });

    it('should not flag normal activity', () => {
      const normalActions = [
        { type: 'helpful_vote', timestamp: Date.now() - 3600000 },
        { type: 'comment_liked', timestamp: Date.now() - 7200000 },
        { type: 'post_created', timestamp: Date.now() - 86400000 }
      ];

      const gaming = detector.detectGamingAttempts(mockUser.id, normalActions);

      expect(gaming.detected).toBe(false);
      expect(gaming.patterns).toHaveLength(0);
    });
  });

  describe('calculateTrustScore', () => {
    it('should calculate trust score based on behavior', () => {
      const trustScore = detector.calculateTrustScore(mockUser.id, {
        accountAge: 365,
        verificationLevel: 'verified',
        reportCount: 0,
        communityContributions: 50
      });

      expect(trustScore).toBeGreaterThan(0.5);
      expect(trustScore).toBeLessThanOrEqual(1.0);
    });

    it('should reduce trust score for suspicious activity', () => {
      const suspiciousTrustScore = detector.calculateTrustScore(mockUser.id, {
        accountAge: 1,
        verificationLevel: 'none',
        reportCount: 5,
        communityContributions: 1
      });

      expect(suspiciousTrustScore).toBeLessThan(0.5);
    });
  });
});

describe('ReputationMetrics', () => {
  let metrics: ReputationMetrics;

  beforeEach(() => {
    metrics = new ReputationMetrics();
  });

  describe('calculateCommunityMetrics', () => {
    it('should calculate community-wide reputation statistics', async () => {
      const communityMetrics = await metrics.calculateCommunityMetrics(mockCommunity.id);

      expect(communityMetrics).toEqual(
        expect.objectContaining({
          communityId: mockCommunity.id,
          totalUsers: expect.any(Number),
          averageScore: expect.any(Number),
          scoreDistribution: expect.any(Object),
          topContributors: expect.any(Array),
          activityTrends: expect.any(Object)
        })
      );
    });
  });

  describe('generateInsights', () => {
    it('should generate actionable reputation insights', () => {
      const insights = metrics.generateInsights(mockUser.id, {
        totalScore: 250,
        level: 4,
        dimensions: { helpfulness: 60, expertise: 80, engagement: 40 },
        trend: 'increasing'
      });

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            message: expect.any(String),
            actionable: expect.any(Boolean)
          })
        ])
      );
    });
  });
});

describe('CommunityReputationModel', () => {
  let model: CommunityReputationModel;

  beforeEach(() => {
    model = new CommunityReputationModel(mockCommunity.reputationModel);
  });

  describe('customizeWeights', () => {
    it('should customize dimension weights for community', () => {
      const customWeights = { helpfulness: 0.6, expertise: 0.3, engagement: 0.1 };
      
      model.customizeWeights(customWeights);

      expect(model.getWeights()).toEqual(customWeights);
    });

    it('should validate weight sum equals 1', () => {
      expect(() => {
        model.customizeWeights({ helpfulness: 0.8, expertise: 0.3, engagement: 0.1 });
      }).toThrow('Dimension weights must sum to 1.0');
    });
  });

  describe('applyModelToScore', () => {
    it('should apply community-specific scoring model', () => {
      const dimensionScores = { helpfulness: 80, expertise: 70, engagement: 60 };
      
      const weightedScore = model.applyModelToScore(dimensionScores);

      expect(weightedScore).toBe(72); // 80*0.4 + 70*0.4 + 60*0.2
    });

    it('should handle missing dimensions', () => {
      const incompleteScores = { helpfulness: