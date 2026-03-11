import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

/**
 * Server configuration interface
 */
export interface ServerConfig {
  id: string;
  endpoint: string;
  region: string;
  weight: number;
  maxConnections: number;
  healthCheckInterval: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * Server health metrics interface
 */
export interface ServerHealth {
  serverId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  errorRate: number;
  lastCheck: Date;
}

/**
 * Traffic pattern data interface
 */
export interface TrafficPattern {
  timestamp: Date;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  topRegions: string[];
  peakHours: number[];
}

/**
 * Load balancing algorithm types
 */
export type LoadBalanceAlgorithm = 
  | 'weighted-round-robin'
  | 'least-connections'
  | 'response-time'
  | 'geographic-affinity'
  | 'adaptive-hybrid';

/**
 * Request context interface
 */
export interface RequestContext {
  id: string;
  clientIp: string;
  region?: string;
  userAgent?: string;
  timestamp: Date;
  headers: Record<string, string>;
}

/**
 * Routing result interface
 */
export interface RoutingResult {
  serverId: string;
  endpoint: string;
  weight: number;
  estimatedLatency: number;
  algorithm: string;
  confidence: number;
}

/**
 * Engine configuration interface
 */
export interface EngineConfig {
  algorithm: LoadBalanceAlgorithm;
  healthCheckInterval: number;
  trafficAnalysisWindow: number;
  maxRetries: number;
  failoverThreshold: number;
  adaptiveThreshold: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  supabase?: {
    url: string;
    key: string;
  };
}

/**
 * Server health monitor class
 */
class ServerHealthMonitor extends EventEmitter {
  private healthData: Map<string, ServerHealth> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private redis?: Redis;

  constructor(private servers: ServerConfig[], redis?: Redis) {
    super();
    this.redis = redis;
    this.startHealthChecks();
  }

  /**
   * Start health checks for all servers
   */
  private startHealthChecks(): void {
    this.servers.forEach(server => {
      this.startHealthCheck(server);
    });
  }

  /**
   * Start health check for a specific server
   */
  private startHealthCheck(server: ServerConfig): void {
    const interval = setInterval(async () => {
      try {
        const health = await this.checkServerHealth(server);
        this.updateHealthData(health);
        this.emit('healthUpdate', health);
      } catch (error) {
        console.error(`Health check failed for server ${server.id}:`, error);
      }
    }, server.healthCheckInterval);

    this.checkIntervals.set(server.id, interval);
  }

  /**
   * Check health of a specific server
   */
  private async checkServerHealth(server: ServerConfig): Promise<ServerHealth> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${server.endpoint}/health`, {
        method: 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'CR-LoadBalancer/1.0',
        },
      });

      const responseTime = Date.now() - startTime;
      const healthData = await response.json();

      const health: ServerHealth = {
        serverId: server.id,
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        cpuUsage: healthData.cpu || 0,
        memoryUsage: healthData.memory || 0,
        activeConnections: healthData.connections || 0,
        errorRate: healthData.errorRate || 0,
        lastCheck: new Date(),
      };

      return health;
    } catch (error) {
      return {
        serverId: server.id,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        cpuUsage: 100,
        memoryUsage: 100,
        activeConnections: 0,
        errorRate: 1,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Update health data for a server
   */
  private async updateHealthData(health: ServerHealth): Promise<void> {
    this.healthData.set(health.serverId, health);
    
    if (this.redis) {
      try {
        await this.redis.setex(
          `health:${health.serverId}`,
          60,
          JSON.stringify(health)
        );
      } catch (error) {
        console.error('Failed to cache health data:', error);
      }
    }
  }

  /**
   * Get health data for a server
   */
  public getServerHealth(serverId: string): ServerHealth | undefined {
    return this.healthData.get(serverId);
  }

  /**
   * Get all server health data
   */
  public getAllHealthData(): Map<string, ServerHealth> {
    return new Map(this.healthData);
  }

  /**
   * Stop health monitoring
   */
  public stop(): void {
    this.checkIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.checkIntervals.clear();
  }
}

/**
 * Traffic pattern analyzer class
 */
class TrafficPatternAnalyzer {
  private patterns: TrafficPattern[] = [];
  private redis?: Redis;

  constructor(redis?: Redis) {
    this.redis = redis;
  }

  /**
   * Analyze traffic patterns
   */
  public async analyzePattern(
    requests: number,
    responseTime: number,
    errorRate: number,
    regions: string[]
  ): Promise<TrafficPattern> {
    const pattern: TrafficPattern = {
      timestamp: new Date(),
      requestsPerSecond: requests,
      averageResponseTime: responseTime,
      errorRate,
      topRegions: this.getTopRegions(regions),
      peakHours: this.calculatePeakHours(),
    };

    this.patterns.push(pattern);
    
    // Keep only last 1000 patterns
    if (this.patterns.length > 1000) {
      this.patterns = this.patterns.slice(-1000);
    }

    await this.cachePattern(pattern);
    return pattern;
  }

  /**
   * Get top regions from request data
   */
  private getTopRegions(regions: string[]): string[] {
    const regionCounts = regions.reduce((acc, region) => {
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(regionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([region]) => region);
  }

  /**
   * Calculate peak hours from historical data
   */
  private calculatePeakHours(): number[] {
    const hourCounts = new Array(24).fill(0);
    
    this.patterns.forEach(pattern => {
      const hour = pattern.timestamp.getHours();
      hourCounts[hour] += pattern.requestsPerSecond;
    });

    const avgPerHour = hourCounts.reduce((sum, count) => sum + count, 0) / 24;
    
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > avgPerHour * 1.5)
      .map(({ hour }) => hour);
  }

  /**
   * Cache traffic pattern
   */
  private async cachePattern(pattern: TrafficPattern): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.zadd(
        'traffic:patterns',
        pattern.timestamp.getTime(),
        JSON.stringify(pattern)
      );
      
      // Keep only last 24 hours
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      await this.redis.zremrangebyscore('traffic:patterns', '-inf', dayAgo);
    } catch (error) {
      console.error('Failed to cache traffic pattern:', error);
    }
  }

  /**
   * Get recent patterns
   */
  public getRecentPatterns(hours: number = 1): TrafficPattern[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.patterns.filter(p => p.timestamp.getTime() > cutoff);
  }
}

/**
 * Geographic router class
 */
class GeographicRouter {
  private readonly EARTH_RADIUS = 6371; // km

  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find nearest servers to client location
   */
  public findNearestServers(
    clientLat: number,
    clientLng: number,
    servers: ServerConfig[]
  ): Array<{ server: ServerConfig; distance: number }> {
    return servers
      .filter(server => server.coordinates)
      .map(server => ({
        server,
        distance: this.calculateDistance(
          clientLat,
          clientLng,
          server.coordinates!.lat,
          server.coordinates!.lng
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get estimated latency based on distance
   */
  public estimateLatency(distance: number): number {
    // Rough estimation: 1ms per 100km + base latency
    return Math.max(10, distance / 100 + 20);
  }
}

/**
 * Adaptive algorithms class
 */
class AdaptiveAlgorithms {
  /**
   * Weighted round robin with dynamic weights
   */
  public weightedRoundRobin(
    servers: ServerConfig[],
    healthData: Map<string, ServerHealth>
  ): ServerConfig | null {
    const availableServers = servers.filter(server => {
      const health = healthData.get(server.id);
      return health && health.status !== 'unhealthy';
    });

    if (availableServers.length === 0) return null;

    // Calculate dynamic weights based on health metrics
    const weightedServers = availableServers.map(server => {
      const health = healthData.get(server.id)!;
      const responseTimeFactor = Math.max(0.1, 1 - health.responseTime / 1000);
      const cpuFactor = Math.max(0.1, 1 - health.cpuUsage / 100);
      const connectionFactor = Math.max(0.1, 1 - health.activeConnections / server.maxConnections);
      
      const dynamicWeight = server.weight * responseTimeFactor * cpuFactor * connectionFactor;
      
      return { server, weight: dynamicWeight };
    });

    // Select based on weights
    const totalWeight = weightedServers.reduce((sum, { weight }) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const { server, weight } of weightedServers) {
      currentWeight += weight;
      if (random <= currentWeight) {
        return server;
      }
    }

    return weightedServers[0].server;
  }

  /**
   * Least connections algorithm
   */
  public leastConnections(
    servers: ServerConfig[],
    healthData: Map<string, ServerHealth>
  ): ServerConfig | null {
    const availableServers = servers.filter(server => {
      const health = healthData.get(server.id);
      return health && health.status !== 'unhealthy';
    });

    if (availableServers.length === 0) return null;

    return availableServers.reduce((least, current) => {
      const leastHealth = healthData.get(least.id)!;
      const currentHealth = healthData.get(current.id)!;
      
      return currentHealth.activeConnections < leastHealth.activeConnections
        ? current
        : least;
    });
  }

  /**
   * Response time based algorithm
   */
  public responseTimeBased(
    servers: ServerConfig[],
    healthData: Map<string, ServerHealth>
  ): ServerConfig | null {
    const availableServers = servers.filter(server => {
      const health = healthData.get(server.id);
      return health && health.status !== 'unhealthy';
    });

    if (availableServers.length === 0) return null;

    return availableServers.reduce((fastest, current) => {
      const fastestHealth = healthData.get(fastest.id)!;
      const currentHealth = healthData.get(current.id)!;
      
      return currentHealth.responseTime < fastestHealth.responseTime
        ? current
        : fastest;
    });
  }
}

/**
 * Failover manager class
 */
class FailoverManager extends EventEmitter {
  private failedServers: Set<string> = new Set();
  private retryAttempts: Map<string, number> = new Map();

  constructor(private maxRetries: number = 3) {
    super();
  }

  /**
   * Mark server as failed
   */
  public markServerFailed(serverId: string): void {
    this.failedServers.add(serverId);
    const attempts = this.retryAttempts.get(serverId) || 0;
    this.retryAttempts.set(serverId, attempts + 1);
    
    this.emit('serverFailed', { serverId, attempts: attempts + 1 });
    
    // Schedule retry
    setTimeout(() => {
      this.retryServer(serverId);
    }, this.getRetryDelay(attempts + 1));
  }

  /**
   * Retry failed server
   */
  private retryServer(serverId: string): void {
    const attempts = this.retryAttempts.get(serverId) || 0;
    
    if (attempts < this.maxRetries) {
      this.failedServers.delete(serverId);
      this.emit('serverRetry', { serverId, attempts });
    } else {
      this.emit('serverAbandoned', { serverId, attempts });
    }
  }

  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 60000);
  }

  /**
   * Mark server as recovered
   */
  public markServerRecovered(serverId: string): void {
    this.failedServers.delete(serverId);
    this.retryAttempts.delete(serverId);
    this.emit('serverRecovered', { serverId });
  }

  /**
   * Check if server is failed
   */
  public isServerFailed(serverId: string): boolean {
    return this.failedServers.has(serverId);
  }
}

/**
 * Main adaptive load distribution engine
 */
export class AdaptiveLoadDistributionEngine extends EventEmitter {
  private servers: ServerConfig[] = [];
  private healthMonitor: ServerHealthMonitor;
  private trafficAnalyzer: TrafficPatternAnalyzer;
  private geographicRouter: GeographicRouter;
  private algorithms: AdaptiveAlgorithms;
  private failoverManager: FailoverManager;
  private redis?: Redis;
  private requestCount = 0;
  private startTime = Date.now();

  constructor(private config: EngineConfig) {
    super();

    // Initialize Redis if configured
    if (config.redis) {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });
    }

    // Initialize components
    this.healthMonitor = new ServerHealthMonitor(this.servers, this.redis);
    this.trafficAnalyzer = new TrafficPatternAnalyzer(this.redis);
    this.geographicRouter = new GeographicRouter();
    this.algorithms = new AdaptiveAlgorithms();
    this.failoverManager = new FailoverManager(config.maxRetries);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.healthMonitor.on('healthUpdate', (health: ServerHealth) => {
      if (health.status === 'healthy') {
        this.failoverManager.markServerRecovered(health.serverId);
      } else if (health.status === 'unhealthy') {
        this.failoverManager.markServerFailed(health.serverId);
      }
    });

    this.failoverManager.on('serverFailed', ({ serverId }) => {
      this.emit('serverFailure', { serverId, timestamp: new Date() });
    });
  }

  /**
   * Add server to the pool
   */
  public addServer(server: ServerConfig): void {
    this.servers.push(server);
    this.healthMonitor = new ServerHealthMonitor(this.servers, this.redis);
    this.emit('serverAdded', { serverId: server.id });
  }

  /**
   * Remove server from the pool
   */
  public removeServer(serverId: string): void {
    this.servers = this.servers.filter(s => s.id !== serverId);
    this.healthMonitor = new ServerHealthMonitor(this.servers, this.redis);
    this.emit('serverRemoved', { serverId });
  }

  /**
   * Route request to optimal server
   */
  public async routeRequest(context: RequestContext): Promise<RoutingResult | null> {
    this.requestCount++;
    
    try {
      const availableServers = this.getAvailableServers();
      if (availableServers.length === 0) {
        throw new Error('No available servers');
      }

      let selectedServer: ServerConfig | null = null;
      let algorithm = this.config.algorithm;

      // Auto-adapt algorithm based on conditions
      if (algorithm === 'adaptive-hybrid') {
        algorithm = await this.selectOptimalAlgorithm(context);
      }

      // Apply selected algorithm
      switch (algorithm) {
        case 'weighted-round-robin':
          selectedServer = this.algorithms.weightedRoundRobin(
            availableServers,
            this.healthMonitor.getAllHealthData()
          );
          break;
        case 'least-connections':
          selectedServer = this.algorithms.leastConnections(
            availableServers,
            this.healthMonitor.getAllHealthData()
          );
          break;
        case 'response-time':
          selectedServer = this.algorithms.responseTimeBased(
            availableServers,
            this.healthMonitor.getAllHealthData()
          );
          break;
        case 'geographic-affinity':
          selectedServer = await this.selectByGeography(context, availableServers);
          break;
        default:
          selectedServer = availableServers[0];
      }

      if (!selectedServer) {
        throw new Error('No server selected by algorithm');
      }

      const health = this.healthMonitor.getServerHealth(selectedServer.id);
      const estimatedLatency = this.estimateLatency(selectedServer, context);

      const result: RoutingResult = {
        serverId: selectedServer.id,
        endpoint: selectedServer.endpoint,
        weight: selectedServer.weight,
        estimatedLatency,
        algorithm,
        confidence: this.calculateConfidence(selectedServer, health),
      };

      this.emit('requestRouted', {
        context,
        result,
        timestamp: new Date(),
      });

      // Update traffic analysis
      await this.updateTrafficAnalysis(context, result);

      return result;
    } catch (error) {
      this.emit('routingError', {
        context,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
      return null;
    }
  }

  /**
   * Get available servers (excluding failed ones)
   */
  private getAvailableServers(): ServerConfig[] {
    return this.servers.filter(server => {
      const isFailed = this.failoverManager.isServerFailed(server.id);
      const health = this.healthMonitor.getServerHealth(server.id);
      const isHealthy = health && health.status !== 'unhealthy';
      return !isFailed && isHealthy;
    });
  }

  /**
   * Select optimal algorithm based on current conditions
   */
  private async selectOptimalAlgorithm(
    context: RequestContext
  ): Promise<LoadBalanceAlgorithm> {
    const recentPatterns = this.trafficAnalyzer.getRecentPatterns();
    
    if (recentPatterns.length === 0) {
      return 'weighted-round-robin';
    }

    const avgErrorRate = recentPatterns.reduce((sum, p) => sum + p.errorRate, 0) / recentPatterns.length;
    const avgResponseTime = recentPatterns.reduce((sum, p) => sum + p.averageResponseTime, 0) / recentPatterns.length;
    
    // High error rate -> prefer least connections
    if (avgErrorRate > 0.05) {
      return 'least-connections';
    }
    
    // High response time -> prefer response-time based
    if (avgResponseTime > 500) {
      return 'response-time';
    }
    
    // Geographic distribution matters -> prefer geographic affinity
    if (context.region && recentPat