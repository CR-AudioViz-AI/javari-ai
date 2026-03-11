```typescript
import Redis from 'ioredis';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Cache layer types supported by the orchestration engine
 */
export enum CacheLayer {
  APPLICATION = 'application',
  REDIS = 'redis',
  CDN = 'cdn'
}

/**
 * Cache operation types for metrics tracking
 */
export enum CacheOperation {
  GET = 'get',
  SET = 'set',
  DELETE = 'delete',
  CLEAR = 'clear',
  WARM = 'warm'
}

/**
 * Cache invalidation strategies
 */
export enum InvalidationStrategy {
  CASCADE = 'cascade',
  SELECTIVE = 'selective',
  IMMEDIATE = 'immediate',
  LAZY = 'lazy',
  TTL_BASED = 'ttl_based'
}

/**
 * Cache warming strategies
 */
export enum WarmingStrategy {
  PREDICTIVE = 'predictive',
  ON_DEMAND = 'on_demand',
  SCHEDULED = 'scheduled',
  ACCESS_PATTERN = 'access_pattern',
  PRIORITY_BASED = 'priority_based'
}

/**
 * Cache entry metadata interface
 */
interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  layer: CacheLayer;
  priority: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  namespace: string;
  tags: string[];
}

/**
 * Cache metrics data structure
 */
interface CacheMetrics {
  layer: CacheLayer;
  hits: number;
  misses: number;
  hitRatio: number;
  avgResponseTime: number;
  totalSize: number;
  totalKeys: number;
  errorRate: number;
  timestamp: number;
}

/**
 * Cache configuration interface
 */
interface CacheConfig {
  redis: {
    cluster: string[];
    password: string;
    keyPrefix: string;
    maxRetries: number;
    retryDelayOnFailover: number;
  };
  cdn: {
    apiToken: string;
    zoneId: string;
    baseUrl: string;
    purgeEndpoint: string;
  };
  application: {
    maxSize: number;
    maxAge: number;
    checkInterval: number;
  };
  warming: {
    enabled: boolean;
    batchSize: number;
    concurrency: number;
    strategies: WarmingStrategy[];
  };
  invalidation: {
    strategy: InvalidationStrategy;
    webhookUrl?: string;
    retryAttempts: number;
    retryDelay: number;
  };
}

/**
 * Cache warming job interface
 */
interface WarmingJob {
  id: string;
  keys: string[];
  priority: number;
  strategy: WarmingStrategy;
  batchSize: number;
  createdAt: number;
  scheduledFor?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

/**
 * Cache layer manager responsible for individual cache layer operations
 */
export class CacheLayerManager {
  private applicationCache = new Map<string, CacheEntry>();
  private redisCluster: Redis.Cluster | null = null;
  private config: CacheConfig;
  private metrics = new Map<CacheLayer, CacheMetrics>();

  constructor(config: CacheConfig) {
    this.config = config;
    this.initializeMetrics();
    this.initializeRedis();
    this.setupApplicationCacheCleanup();
  }

  /**
   * Initialize metrics for all cache layers
   */
  private initializeMetrics(): void {
    Object.values(CacheLayer).forEach(layer => {
      this.metrics.set(layer, {
        layer,
        hits: 0,
        misses: 0,
        hitRatio: 0,
        avgResponseTime: 0,
        totalSize: 0,
        totalKeys: 0,
        errorRate: 0,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Initialize Redis cluster connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisCluster = new Redis.Cluster(this.config.redis.cluster, {
        redisOptions: {
          password: this.config.redis.password,
          keyPrefix: this.config.redis.keyPrefix
        },
        maxRetriesPerRequest: this.config.redis.maxRetries,
        retryDelayOnFailover: this.config.redis.retryDelayOnFailover
      });

      this.redisCluster.on('error', (error) => {
        console.error('Redis cluster error:', error);
        this.updateErrorMetrics(CacheLayer.REDIS);
      });

      await this.redisCluster.ping();
    } catch (error) {
      console.error('Failed to initialize Redis cluster:', error);
      throw new Error(`Redis initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup periodic application cache cleanup
   */
  private setupApplicationCacheCleanup(): void {
    setInterval(() => {
      this.cleanupApplicationCache();
    }, this.config.application.checkInterval);
  }

  /**
   * Clean up expired entries from application cache
   */
  private cleanupApplicationCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.applicationCache.entries()) {
      if (now - entry.createdAt > entry.ttl * 1000) {
        this.applicationCache.delete(key);
      }
    }
    this.updateCacheSizeMetrics(CacheLayer.APPLICATION);
  }

  /**
   * Get value from specified cache layer
   */
  async get<T>(key: string, layer: CacheLayer): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      let value: T | null = null;

      switch (layer) {
        case CacheLayer.APPLICATION:
          value = await this.getFromApplication<T>(key);
          break;
        case CacheLayer.REDIS:
          value = await this.getFromRedis<T>(key);
          break;
        case CacheLayer.CDN:
          value = await this.getFromCDN<T>(key);
          break;
      }

      const responseTime = performance.now() - startTime;
      this.updateMetrics(layer, CacheOperation.GET, value !== null, responseTime);

      return value;
    } catch (error) {
      this.updateErrorMetrics(layer);
      throw error;
    }
  }

  /**
   * Set value in specified cache layer
   */
  async set<T>(key: string, value: T, layer: CacheLayer, ttl: number = 3600, options: Partial<CacheEntry> = {}): Promise<void> {
    const startTime = performance.now();

    try {
      const entry: CacheEntry<T> = {
        key,
        value,
        ttl,
        layer,
        priority: options.priority || 1,
        accessCount: options.accessCount || 0,
        lastAccessed: Date.now(),
        createdAt: Date.now(),
        namespace: options.namespace || 'default',
        tags: options.tags || []
      };

      switch (layer) {
        case CacheLayer.APPLICATION:
          await this.setInApplication(entry);
          break;
        case CacheLayer.REDIS:
          await this.setInRedis(entry);
          break;
        case CacheLayer.CDN:
          await this.setInCDN(entry);
          break;
      }

      const responseTime = performance.now() - startTime;
      this.updateMetrics(layer, CacheOperation.SET, true, responseTime);
    } catch (error) {
      this.updateErrorMetrics(layer);
      throw error;
    }
  }

  /**
   * Delete key from specified cache layer
   */
  async delete(key: string, layer: CacheLayer): Promise<void> {
    const startTime = performance.now();

    try {
      switch (layer) {
        case CacheLayer.APPLICATION:
          this.applicationCache.delete(key);
          break;
        case CacheLayer.REDIS:
          if (this.redisCluster) {
            await this.redisCluster.del(key);
          }
          break;
        case CacheLayer.CDN:
          await this.purgeFromCDN(key);
          break;
      }

      const responseTime = performance.now() - startTime;
      this.updateMetrics(layer, CacheOperation.DELETE, true, responseTime);
    } catch (error) {
      this.updateErrorMetrics(layer);
      throw error;
    }
  }

  /**
   * Get value from application cache
   */
  private async getFromApplication<T>(key: string): Promise<T | null> {
    const entry = this.applicationCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.createdAt > entry.ttl * 1000) {
      this.applicationCache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = now;
    return entry.value as T;
  }

  /**
   * Get value from Redis cache
   */
  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.redisCluster) return null;

    const value = await this.redisCluster.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Get value from CDN cache
   */
  private async getFromCDN<T>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.config.cdn.baseUrl}/${key}`, {
        headers: {
          'Authorization': `Bearer ${this.config.cdn.apiToken}`
        }
      });

      if (!response.ok) return null;

      return await response.json() as T;
    } catch {
      return null;
    }
  }

  /**
   * Set value in application cache
   */
  private async setInApplication<T>(entry: CacheEntry<T>): Promise<void> {
    if (this.applicationCache.size >= this.config.application.maxSize) {
      this.evictLeastRecentlyUsed();
    }
    this.applicationCache.set(entry.key, entry);
  }

  /**
   * Set value in Redis cache
   */
  private async setInRedis<T>(entry: CacheEntry<T>): Promise<void> {
    if (!this.redisCluster) return;

    const value = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
    await this.redisCluster.setex(entry.key, entry.ttl, value);
  }

  /**
   * Set value in CDN cache
   */
  private async setInCDN<T>(entry: CacheEntry<T>): Promise<void> {
    try {
      await fetch(this.config.cdn.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.cdn.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: entry.key,
          value: entry.value,
          ttl: entry.ttl
        })
      });
    } catch (error) {
      throw new Error(`CDN cache set failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Purge key from CDN cache
   */
  private async purgeFromCDN(key: string): Promise<void> {
    try {
      await fetch(this.config.cdn.purgeEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.cdn.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [key]
        })
      });
    } catch (error) {
      throw new Error(`CDN purge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evict least recently used entry from application cache
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.applicationCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.applicationCache.delete(oldestKey);
    }
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(layer: CacheLayer, operation: CacheOperation, success: boolean, responseTime: number): void {
    const metrics = this.metrics.get(layer);
    if (!metrics) return;

    if (operation === CacheOperation.GET) {
      if (success) {
        metrics.hits++;
      } else {
        metrics.misses++;
      }
      metrics.hitRatio = metrics.hits / (metrics.hits + metrics.misses);
    }

    metrics.avgResponseTime = (metrics.avgResponseTime + responseTime) / 2;
    metrics.timestamp = Date.now();

    this.updateCacheSizeMetrics(layer);
  }

  /**
   * Update cache size metrics
   */
  private updateCacheSizeMetrics(layer: CacheLayer): void {
    const metrics = this.metrics.get(layer);
    if (!metrics) return;

    switch (layer) {
      case CacheLayer.APPLICATION:
        metrics.totalKeys = this.applicationCache.size;
        metrics.totalSize = this.calculateApplicationCacheSize();
        break;
      case CacheLayer.REDIS:
        // Redis size would be fetched separately
        break;
      case CacheLayer.CDN:
        // CDN metrics would be fetched from CDN API
        break;
    }
  }

  /**
   * Calculate application cache size in bytes
   */
  private calculateApplicationCacheSize(): number {
    let size = 0;
    for (const entry of this.applicationCache.values()) {
      size += JSON.stringify(entry).length;
    }
    return size;
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(layer: CacheLayer): void {
    const metrics = this.metrics.get(layer);
    if (metrics) {
      metrics.errorRate++;
    }
  }

  /**
   * Get metrics for specified layer
   */
  getMetrics(layer?: CacheLayer): CacheMetrics | Map<CacheLayer, CacheMetrics> {
    if (layer) {
      return this.metrics.get(layer)!;
    }
    return this.metrics;
  }
}

/**
 * Cache health monitor for tracking cache layer health
 */
export class CacheHealthMonitor extends EventEmitter {
  private healthStatus = new Map<CacheLayer, boolean>();
  private checkIntervals = new Map<CacheLayer, NodeJS.Timeout>();
  private layerManager: CacheLayerManager;

  constructor(layerManager: CacheLayerManager) {
    super();
    this.layerManager = layerManager;
    this.initializeHealthChecks();
  }

  /**
   * Initialize health checks for all cache layers
   */
  private initializeHealthChecks(): void {
    Object.values(CacheLayer).forEach(layer => {
      this.healthStatus.set(layer, true);
      const interval = setInterval(() => {
        this.checkLayerHealth(layer);
      }, 30000); // Check every 30 seconds
      this.checkIntervals.set(layer, interval);
    });
  }

  /**
   * Check health of specific cache layer
   */
  private async checkLayerHealth(layer: CacheLayer): Promise<void> {
    try {
      const testKey = `health-check-${layer}-${Date.now()}`;
      await this.layerManager.set(testKey, 'health-check', layer, 10);
      const value = await this.layerManager.get(testKey, layer);
      await this.layerManager.delete(testKey, layer);

      const isHealthy = value === 'health-check';
      const wasHealthy = this.healthStatus.get(layer);

      this.healthStatus.set(layer, isHealthy);

      if (isHealthy !== wasHealthy) {
        this.emit('healthStatusChanged', { layer, isHealthy, timestamp: Date.now() });
      }
    } catch (error) {
      this.healthStatus.set(layer, false);
      this.emit('healthCheckError', { layer, error, timestamp: Date.now() });
    }
  }

  /**
   * Get health status for all layers
   */
  getHealthStatus(): Map<CacheLayer, boolean> {
    return new Map(this.healthStatus);
  }

  /**
   * Cleanup health monitor
   */
  destroy(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    this.removeAllListeners();
  }
}

/**
 * Multi-tier cache orchestration engine
 */
export class CacheOrchestrationEngine extends EventEmitter {
  private static instance: CacheOrchestrationEngine | null = null;
  private layerManager: CacheLayerManager;
  private healthMonitor: CacheHealthMonitor;
  private warmingQueue: WarmingJob[] = [];
  private config: CacheConfig;
  private supabaseClient: any;
  private websocketServer: WebSocket.Server | null = null;

  private constructor(config: CacheConfig) {
    super();
    this.config = config;
    this.layerManager = new CacheLayerManager(config);
    this.healthMonitor = new CacheHealthMonitor(this.layerManager);
    this.initializeSupabase();
    this.setupWebSocketServer();
    this.startWarmingWorker();
  }

  /**
   * Get singleton instance of cache orchestration engine
   */
  static getInstance(config?: CacheConfig): CacheOrchestrationEngine {
    if (!CacheOrchestrationEngine.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      CacheOrchestrationEngine.instance = new CacheOrchestrationEngine(config);
    }
    return CacheOrchestrationEngine.instance;
  }

  /**
   * Initialize Supabase client for configuration storage
   */
  private initializeSupabase(): void {
    try {
      this.supabaseClient = createSupabaseClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      );
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
    }
  }

  /**
   * Setup WebSocket server for real-time cache invalidation
   */
  private setupWebSocketServer(): void {
    try {
      this.websocketServer = new WebSocket.Server({ port: 8080 });
      this.websocketServer.on('connection', (ws) => {
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'invalidate') {
              await this.invalidateKey(data.key, data.strategy || InvalidationStrategy.CASCADE);
            }
          } catch (error) {
            console.error('WebSocket message processing error:', error);
          }
        });
      });
    } catch (error) {
      console.error('Failed to setup WebSocket server:', error);
    }
  }

  /**
   * Start cache warming worker
   */
  private startWarmingWorker(): void {
    if (!this.config.warming.enabled) return;

    setInterval(() => {
      this.processWarmingQueue();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Get value from cache with intelligent layer selection
   */
  async get<T>(key: string, options: { layers?: CacheLayer[], promote?: boolean } = {}): Promise<T | null> {
    const layers = options.layers || [CacheLayer.APPLICATION, CacheLayer.REDIS, CacheLayer.CDN];
    
    for (const layer of layers) {
      try {
        const value = await this.layerManager.get<T>(key, layer);
        if (value !== null) {
          // Promote to higher tier if enabled
          if (options.promote && layer !== CacheLayer.APPLICATION) {
            await this.promoteToHigherTier(key, value, layer);
          }
          return value;
        }
      } catch (error) {
        console.error(`Error getting from ${layer}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Set value in cache with intelligent layer distribution
   */
  async set<T>(key: string, value: T, options: {
    ttl?: number;
    layers?: CacheLayer[];
    priority?: number;
    namespace?: string;
    tags?: string[];
  } = {}): Promise<void> {
    const {
      ttl = 3600,
      layers = [CacheLayer.APPLICATION, CacheLayer.REDIS],
      priority = 1,
      namespace = 'default',
      tags = []
    } = options;

    const promises = layers.map(layer =>
      this.layerManager.set(key, value, layer, ttl, {
        priority,
        namespace,
        tags
      }).catch(error => {
        console.error(`Error setting in ${layer}:`, error);
      })
    );

    await Promise.allSettled(promises);

    // Emit cache set event
    this.emit('cacheSet', { key, layers, timestamp: Date.now() });
  }

  /**
   * Invalidate key across cache layers
   */
  async invalidateKey(key: string, strategy: InvalidationStrategy = InvalidationStrategy.CASCADE): Promise<void> {
    switch (strategy) {
      case InvalidationStrategy.CASCADE:
        await this.cascadeInvalidation(key);
        break;
      case InvalidationStrategy.SELECTIVE:
        await this.selectiveInvalidation(key);
        break;
      case InvalidationStrategy.IMMEDIATE:
        await this.immediateInvalidation(key);
        break;
      case InvalidationStrategy.LAZY:
        await this.lazyInvalidation(key);
        break;
      case InvalidationStrategy.TTL_BASED:
        await this.ttlBasedInvalidation(key);
        break;
    }

    this.emit('keyInvalidated', { key, strategy, timestamp: Date.now() });
  }

  /**
   * Invalidate keys by namespace
   */
  async invalidateNamespace(namespace: string): Promise<void> {
    // Implementation would depend on