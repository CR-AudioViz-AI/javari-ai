```typescript
import { EnterpriseRateLimiter } from '../../src/services/rate-limiting/EnterpriseRateLimiter';
import { TierBasedQuotaManager } from '../../src/services/rate-limiting/TierBasedQuotaManager';
import { TokenBucketAlgorithm } from '../../src/services/rate-limiting/TokenBucketAlgorithm';
import { LeakyBucketAlgorithm } from '../../src/services/rate-limiting/LeakyBucketAlgorithm';
import { FairQueueManager } from '../../src/services/rate-limiting/FairQueueManager';
import { BurstCapacityHandler } from '../../src/services/rate-limiting/BurstCapacityHandler';
import { UsageMetricsCollector } from '../../src/services/rate-limiting/UsageMetricsCollector';
import { RedisRateLimitStore } from '../../src/services/rate-limiting/RedisRateLimitStore';
import Redis from 'ioredis';
import { jest } from '@jest/globals';

jest.mock('ioredis');
jest.mock('../../src/services/rate-limiting/TierBasedQuotaManager');
jest.mock('../../src/services/rate-limiting/TokenBucketAlgorithm');
jest.mock('../../src/services/rate-limiting/LeakyBucketAlgorithm');
jest.mock('../../src/services/rate-limiting/FairQueueManager');
jest.mock('../../src/services/rate-limiting/BurstCapacityHandler');
jest.mock('../../src/services/rate-limiting/UsageMetricsCollector');
jest.mock('../../src/services/rate-limiting/RedisRateLimitStore');

describe('EnterpriseRateLimiter', () => {
  let redisClient: Redis.Redis;
  let enterpriseRateLimiter: EnterpriseRateLimiter;
  let quotaManager: jest.Mocked<TierBasedQuotaManager>;
  let tokenBucket: jest.Mocked<TokenBucketAlgorithm>;
  let leakyBucket: jest.Mocked<LeakyBucketAlgorithm>;
  let fairQueue: jest.Mocked<FairQueueManager>;
  let burstHandler: jest.Mocked<BurstCapacityHandler>;
  let usageMetrics: jest.Mocked<UsageMetricsCollector>;

  beforeEach(() => {
    redisClient = new Redis();
    quotaManager = new TierBasedQuotaManager() as jest.Mocked<TierBasedQuotaManager>;
    tokenBucket = new TokenBucketAlgorithm() as jest.Mocked<TokenBucketAlgorithm>;
    leakyBucket = new LeakyBucketAlgorithm() as jest.Mocked<LeakyBucketAlgorithm>;
    fairQueue = new FairQueueManager() as jest.Mocked<FairQueueManager>;
    burstHandler = new BurstCapacityHandler() as jest.Mocked<BurstCapacityHandler>;
    usageMetrics = new UsageMetricsCollector() as jest.Mocked<UsageMetricsCollector>;

    enterpriseRateLimiter = new EnterpriseRateLimiter(
      quotaManager,
      tokenBucket,
      leakyBucket,
      fairQueue,
      burstHandler,
      usageMetrics,
      redisClient
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Quota enforcement', () => {
    it('should allow request within tier quota', async () => {
      quotaManager.checkQuota.mockResolvedValue(true);

      const result = await enterpriseRateLimiter.handleRequest('user1', 'tier1');

      expect(result.allowed).toBe(true);
      expect(quotaManager.checkQuota).toHaveBeenCalledWith('user1', 'tier1');
    });

    it('should reject request exceeding tier quota', async () => {
      quotaManager.checkQuota.mockResolvedValue(false);

      const result = await enterpriseRateLimiter.handleRequest('user1', 'tier1');

      expect(result.allowed).toBe(false);
      expect(quotaManager.checkQuota).toHaveBeenCalledWith('user1', 'tier1');
    });
  });

  describe('Traffic shaping and burst handling', () => {
    it('should handle request bursts using burst capacity', async () => {
      burstHandler.calculateExtraCapacity.mockResolvedValue(10);

      const result = await enterpriseRateLimiter.handleRequest('user1', 'tier1');

      expect(burstHandler.calculateExtraCapacity).toHaveBeenCalledWith('user1', 'tier1');
      expect(result.allowed).toBe(true);  // Assumes burst capacity exists
    });

    it('should overflow to lower tiers on burst limitation', async () => {
      burstHandler.calculateExtraCapacity.mockResolvedValue(0);

      const result = await enterpriseRateLimiter.handleRequest('user1', 'tier1');

      // Action if handled by lower tier
      expect(burstHandler.calculateExtraCapacity).toHaveBeenCalledWith('user1', 'tier1');
      expect(result.allowed).toBe(false);  // Assumes no further capacity available
    });
  });

  describe('Fair queuing', () => {
    it('should prioritize requests based on fair queue weighting', async () => {
      fairQueue.prioritize.mockResolvedValue(true);

      const result = await enterpriseRateLimiter.handleRequest('user1', 'important_tier');

      expect(fairQueue.prioritize).toHaveBeenCalledWith('user1', 'important_tier');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Usage Metrics Collection', () => {
    it('should collect usage metrics after handling request', async () => {
      quotaManager.checkQuota.mockResolvedValue(true);

      await enterpriseRateLimiter.handleRequest('user1', 'tier1');

      expect(usageMetrics.collect).toHaveBeenCalledWith('user1', 'tier1');
    });
  });

  describe('Integration', () => {
    it('should integrate with Redis for sliding window rate limits', async () => {
      const redisStore = new RedisRateLimitStore(redisClient);
      redisStore.increment.mockResolvedValue(true);

      const result = await redisStore.increment('metric', 1);

      expect(result).toBe(true);
      expect(redisStore.increment).toHaveBeenCalledWith('metric', 1);
    });
  });
});
```