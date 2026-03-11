```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * Canary deployment configuration interface
 */
export interface CanaryDeploymentConfig {
  id: string;
  applicationId: string;
  targetVersion: string;
  currentVersion: string;
  trafficSplitStrategy: TrafficSplitStrategy;
  healthChecks: HealthCheckConfig[];
  successCriteria: SuccessCriteria;
  rollbackCriteria: RollbackCriteria;
  promotionRules: PromotionRule[];
  duration: number; // minutes
  notificationChannels: NotificationChannel[];
}

/**
 * Traffic splitting strategy configuration
 */
export interface TrafficSplitStrategy {
  type: 'linear' | 'exponential' | 'custom';
  initialPercentage: number;
  incrementPercentage: number;
  incrementInterval: number; // minutes
  maxPercentage: number;
  customSteps?: number[];
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  expectedStatus: number[];
  timeout: number;
  interval: number;
  retries: number;
  headers?: Record<string, string>;
}

/**
 * Success criteria for deployment
 */
export interface SuccessCriteria {
  errorRate: { threshold: number; window: number };
  responseTime: { p95: number; p99: number; window: number };
  throughput: { minRps: number; window: number };
  availability: { threshold: number; window: number };
  customMetrics?: CustomMetric[];
}

/**
 * Rollback criteria configuration
 */
export interface RollbackCriteria {
  errorRate: { threshold: number; duration: number };
  responseTime: { p95: number; p99: number; duration: number };
  availability: { threshold: number; duration: number };
  healthCheckFailures: { consecutive: number; total: number };
  customTriggers?: CustomTrigger[];
}

/**
 * Promotion rule configuration
 */
export interface PromotionRule {
  condition: string;
  requiredDuration: number;
  weight: number;
}

/**
 * Custom metric definition
 */
export interface CustomMetric {
  name: string;
  query: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
}

/**
 * Custom trigger definition
 */
export interface CustomTrigger {
  name: string;
  condition: string;
  severity: 'warning' | 'critical';
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  type: 'slack' | 'teams' | 'email' | 'webhook';
  endpoint: string;
  events: DeploymentEvent[];
}

/**
 * Deployment event types
 */
export type DeploymentEvent = 
  | 'started'
  | 'traffic_increased'
  | 'health_check_failed'
  | 'metrics_threshold_exceeded'
  | 'rollback_initiated'
  | 'promotion_completed'
  | 'deployment_failed'
  | 'deployment_completed';

/**
 * Deployment status enumeration
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PROMOTING = 'promoting',
  ROLLING_BACK = 'rolling_back',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Canary deployment state
 */
export interface CanaryDeploymentState {
  id: string;
  config: CanaryDeploymentConfig;
  status: DeploymentStatus;
  currentTrafficPercentage: number;
  startTime: Date;
  lastUpdateTime: Date;
  metrics: DeploymentMetrics;
  healthStatus: HealthStatus;
  errors: DeploymentError[];
}

/**
 * Deployment metrics interface
 */
export interface DeploymentMetrics {
  errorRate: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  availability: number;
  customMetrics: Record<string, number>;
}

/**
 * Health status interface
 */
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'passing' | 'warning' | 'critical';
    lastCheck: Date;
    consecutiveFailures: number;
    message?: string;
  }>;
}

/**
 * Deployment error interface
 */
export interface DeploymentError {
  timestamp: Date;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

/**
 * Traffic splitter service for managing version routing
 */
class TrafficSplitter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Update traffic split percentage for deployment
   */
  async updateTrafficSplit(deploymentId: string, percentage: number): Promise<void> {
    await this.redis.hset(`traffic:${deploymentId}`, {
      percentage: percentage.toString(),
      updatedAt: Date.now().toString()
    });

    // Set expiration for cleanup
    await this.redis.expire(`traffic:${deploymentId}`, 86400);
  }

  /**
   * Get current traffic split
   */
  async getTrafficSplit(deploymentId: string): Promise<number> {
    const percentage = await this.redis.hget(`traffic:${deploymentId}`, 'percentage');
    return percentage ? parseFloat(percentage) : 0;
  }

  /**
   * Remove traffic split configuration
   */
  async removeTrafficSplit(deploymentId: string): Promise<void> {
    await this.redis.del(`traffic:${deploymentId}`);
  }
}

/**
 * Metrics collector for gathering deployment performance data
 */
class MetricsCollector {
  private redis: Redis;
  private supabase: SupabaseClient;

  constructor(redis: Redis, supabase: SupabaseClient) {
    this.redis = redis;
    this.supabase = supabase;
  }

  /**
   * Collect metrics for deployment
   */
  async collectMetrics(deploymentId: string): Promise<DeploymentMetrics> {
    const [errorRate, responseTime, throughput, availability] = await Promise.all([
      this.calculateErrorRate(deploymentId),
      this.calculateResponseTime(deploymentId),
      this.calculateThroughput(deploymentId),
      this.calculateAvailability(deploymentId)
    ]);

    const customMetrics = await this.collectCustomMetrics(deploymentId);

    const metrics: DeploymentMetrics = {
      errorRate,
      responseTime,
      throughput,
      availability,
      customMetrics
    };

    // Cache metrics
    await this.redis.setex(
      `metrics:${deploymentId}`,
      300,
      JSON.stringify(metrics)
    );

    // Store in database
    await this.supabase
      .from('deployment_metrics')
      .insert({
        deployment_id: deploymentId,
        metrics,
        created_at: new Date().toISOString()
      });

    return metrics;
  }

  /**
   * Calculate error rate from logs
   */
  private async calculateErrorRate(deploymentId: string): Promise<number> {
    const key = `errors:${deploymentId}`;
    const window = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    const errors = await this.redis.zcount(key, now - window, now);
    const total = await this.redis.zcount(`requests:${deploymentId}`, now - window, now);
    
    return total > 0 ? (errors / total) * 100 : 0;
  }

  /**
   * Calculate response time percentiles
   */
  private async calculateResponseTime(deploymentId: string): Promise<{p50: number; p95: number; p99: number}> {
    const key = `response_times:${deploymentId}`;
    const window = 5 * 60 * 1000;
    const now = Date.now();
    
    const times = await this.redis.zrangebyscore(key, now - window, now);
    
    if (times.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = times.map(Number).sort((a, b) => a - b);
    
    return {
      p50: this.getPercentile(sorted, 50),
      p95: this.getPercentile(sorted, 95),
      p99: this.getPercentile(sorted, 99)
    };
  }

  /**
   * Calculate throughput (requests per second)
   */
  private async calculateThroughput(deploymentId: string): Promise<number> {
    const key = `requests:${deploymentId}`;
    const window = 60 * 1000; // 1 minute
    const now = Date.now();
    
    const count = await this.redis.zcount(key, now - window, now);
    return count / 60; // RPS
  }

  /**
   * Calculate availability percentage
   */
  private async calculateAvailability(deploymentId: string): Promise<number> {
    const successKey = `success:${deploymentId}`;
    const totalKey = `requests:${deploymentId}`;
    const window = 5 * 60 * 1000;
    const now = Date.now();
    
    const success = await this.redis.zcount(successKey, now - window, now);
    const total = await this.redis.zcount(totalKey, now - window, now);
    
    return total > 0 ? (success / total) * 100 : 100;
  }

  /**
   * Collect custom metrics
   */
  private async collectCustomMetrics(deploymentId: string): Promise<Record<string, number>> {
    const customMetrics: Record<string, number> = {};
    
    // Implementation would depend on specific metrics system
    // This is a placeholder for custom metric collection
    
    return customMetrics;
  }

  /**
   * Get percentile value from sorted array
   */
  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }
}

/**
 * Health checker for monitoring application health
 */
class HealthChecker {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Perform health checks for deployment
   */
  async performHealthChecks(
    deploymentId: string,
    checks: HealthCheckConfig[]
  ): Promise<HealthStatus> {
    const checkResults = await Promise.all(
      checks.map(check => this.performSingleHealthCheck(deploymentId, check))
    );

    const checkStatus: Record<string, any> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    checkResults.forEach((result, index) => {
      const check = checks[index];
      checkStatus[check.name] = result;

      switch (result.status) {
        case 'passing':
          healthyCount++;
          break;
        case 'warning':
          degradedCount++;
          break;
        case 'critical':
          unhealthyCount++;
          break;
      }
    });

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const healthStatus: HealthStatus = {
      overall,
      checks: checkStatus
    };

    // Cache health status
    await this.redis.setex(
      `health:${deploymentId}`,
      60,
      JSON.stringify(healthStatus)
    );

    return healthStatus;
  }

  /**
   * Perform single health check
   */
  private async performSingleHealthCheck(
    deploymentId: string,
    check: HealthCheckConfig
  ): Promise<{
    status: 'passing' | 'warning' | 'critical';
    lastCheck: Date;
    consecutiveFailures: number;
    message?: string;
  }> {
    const failureKey = `health_failures:${deploymentId}:${check.name}`;
    let consecutiveFailures = parseInt(await this.redis.get(failureKey) || '0');

    try {
      const response = await fetch(check.endpoint, {
        method: check.method,
        headers: check.headers,
        signal: AbortSignal.timeout(check.timeout)
      });

      const isSuccess = check.expectedStatus.includes(response.status);
      
      if (isSuccess) {
        await this.redis.del(failureKey);
        consecutiveFailures = 0;
        
        return {
          status: 'passing',
          lastCheck: new Date(),
          consecutiveFailures: 0
        };
      } else {
        consecutiveFailures++;
        await this.redis.setex(failureKey, 3600, consecutiveFailures.toString());
        
        const status = consecutiveFailures >= check.retries ? 'critical' : 'warning';
        
        return {
          status,
          lastCheck: new Date(),
          consecutiveFailures,
          message: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      consecutiveFailures++;
      await this.redis.setex(failureKey, 3600, consecutiveFailures.toString());
      
      const status = consecutiveFailures >= check.retries ? 'critical' : 'warning';
      
      return {
        status,
        lastCheck: new Date(),
        consecutiveFailures,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Rollback manager for handling automatic rollbacks
 */
class RollbackManager {
  private supabase: SupabaseClient;
  private trafficSplitter: TrafficSplitter;

  constructor(supabase: SupabaseClient, trafficSplitter: TrafficSplitter) {
    this.supabase = supabase;
    this.trafficSplitter = trafficSplitter;
  }

  /**
   * Execute rollback procedure
   */
  async executeRollback(deploymentId: string, reason: string): Promise<void> {
    // Set traffic back to 0% for canary version
    await this.trafficSplitter.updateTrafficSplit(deploymentId, 0);

    // Update deployment status
    await this.supabase
      .from('canary_deployments')
      .update({
        status: DeploymentStatus.ROLLING_BACK,
        rollback_reason: reason,
        rollback_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', deploymentId);

    // Additional rollback steps would depend on deployment infrastructure
    // e.g., scaling down containers, DNS updates, etc.
  }

  /**
   * Check if rollback criteria are met
   */
  shouldRollback(
    criteria: RollbackCriteria,
    metrics: DeploymentMetrics,
    health: HealthStatus,
    errors: DeploymentError[]
  ): { should: boolean; reason?: string } {
    // Check error rate threshold
    if (metrics.errorRate > criteria.errorRate.threshold) {
      return {
        should: true,
        reason: `Error rate ${metrics.errorRate.toFixed(2)}% exceeds threshold ${criteria.errorRate.threshold}%`
      };
    }

    // Check response time thresholds
    if (metrics.responseTime.p95 > criteria.responseTime.p95) {
      return {
        should: true,
        reason: `P95 response time ${metrics.responseTime.p95}ms exceeds threshold ${criteria.responseTime.p95}ms`
      };
    }

    // Check availability threshold
    if (metrics.availability < criteria.availability.threshold) {
      return {
        should: true,
        reason: `Availability ${metrics.availability.toFixed(2)}% below threshold ${criteria.availability.threshold}%`
      };
    }

    // Check health status
    if (health.overall === 'unhealthy') {
      const failedChecks = Object.entries(health.checks)
        .filter(([_, check]) => check.status === 'critical')
        .map(([name]) => name);
      
      return {
        should: true,
        reason: `Health checks failed: ${failedChecks.join(', ')}`
      };
    }

    return { should: false };
  }
}

/**
 * Promotion engine for deployment decisions
 */
class PromotionEngine {
  /**
   * Evaluate if deployment should be promoted
   */
  shouldPromote(
    rules: PromotionRule[],
    metrics: DeploymentMetrics,
    health: HealthStatus,
    duration: number
  ): { should: boolean; score: number; reason?: string } {
    let totalScore = 0;
    let totalWeight = 0;
    const passedRules: string[] = [];

    for (const rule of rules) {
      if (duration < rule.requiredDuration) {
        continue; // Rule not eligible yet
      }

      const passed = this.evaluateRule(rule.condition, metrics, health);
      if (passed) {
        totalScore += rule.weight;
        passedRules.push(rule.condition);
      }
      totalWeight += rule.weight;
    }

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;
    const shouldPromote = score >= 0.8; // 80% threshold

    return {
      should: shouldPromote,
      score,
      reason: shouldPromote 
        ? `Promotion criteria met (${passedRules.length}/${rules.length} rules passed)`
        : `Promotion criteria not met (score: ${(score * 100).toFixed(1)}%)`
    };
  }

  /**
   * Evaluate a single promotion rule
   */
  private evaluateRule(condition: string, metrics: DeploymentMetrics, health: HealthStatus): boolean {
    try {
      // Simple rule evaluation - in production, use a proper expression evaluator
      const context = { metrics, health };
      
      // Example conditions:
      // "metrics.errorRate < 1.0"
      // "metrics.responseTime.p95 < 500"
      // "health.overall === 'healthy'"
      
      return Function('context', `return ${condition}`)(context);
    } catch (error) {
      console.warn(`Failed to evaluate rule: ${condition}`, error);
      return false;
    }
  }
}

/**
 * Advanced Canary Deployment Service
 * 
 * Manages autonomous canary deployments with automated promotion/rollback
 * based on performance metrics and health thresholds.
 */
export class CanaryDeploymentService extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private trafficSplitter: TrafficSplitter;
  private metricsCollector: MetricsCollector;
  private healthChecker: HealthChecker;
  private rollbackManager: RollbackManager;
  private promotionEngine: PromotionEngine;
  private deploymentTimers: Map<string, NodeJS.Timeout> = new Map();
  private wsServer?: WebSocket.Server;

  constructor() {
    super();
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.redis = new Redis(process.env.REDIS_URL!);
    this.trafficSplitter = new TrafficSplitter(this.redis);
    this.metricsCollector = new MetricsCollector(this.redis, this.supabase);
    this.healthChecker = new HealthChecker(this.redis);
    this.rollbackManager = new RollbackManager(this.supabase, this.trafficSplitter);
    this.promotionEngine = new PromotionEngine();
    
    this.initializeWebSocketServer();
    this.startMonitoring();
  }

  /**
   * Initialize WebSocket server for real-time updates
   */
  private initializeWebSocketServer(): void {
    this.wsServer = new WebSocket.Server({ port: 8080 });
    
    this.wsServer.on('connection', (ws) => {
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'subscribe' && data.deploymentId) {
            ws.send(JSON.stringify({
              type: 'subscribed',
              deploymentId: data.deploymentId
            }));
          }
        } catch (error) {
          console.warn('Invalid WebSocket message:', error);
        }
      });
    });
  }

  /**
   * Start deployment monitoring
   */
  private startMonitoring(): void {
    setInterval(async () => {
      try {
        await this.monitorActiveDeployments();
      } catch (error) {
        console.error('Error monitoring deployments:', error);
      }
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Initiate a new canary deployment
   */
  async initiateDeployment(config: CanaryDeploymentConfig): Promise<string> {
    try {
      // Validate configuration
      this.validateConfig(config);

      // Create deployment record
      const { data: deployment, error } = await this.supabase
        .from('canary_deployments')
        .insert({
          id: config.id,
          application_id: config.applicationId,
          target_version: config.targetVersion,
          current_version: config.currentVersion,
          config: config,
          status: DeploymentStatus.PENDING,
          current_traffic_percentage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize traffic splitting
      await this.trafficSplitter.updateTrafficSplit(
        config.id,
        config.trafficSplitStrategy.initialPercentage
      );

      // Start deployment process
      await this.startDeploymentProcess(config);

      // Send notification
      await this.sendNotification(config, 'started', {
        message: `Canary deployment started for ${config.applicationId}`,
        version