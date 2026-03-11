/**
 * @fileoverview Agent Health Monitoring Service
 * @description Distributed monitoring service for agent availability, response times, and quality metrics
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { WebSocketServer, WebSocket } from 'ws';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Agent health status enumeration
 */
export enum AgentHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown'
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  thresholds: {
    responseTime: number;
    errorRate: number;
    availability: number;
  };
}

/**
 * Agent health metrics
 */
export interface AgentHealthMetrics {
  agentId: string;
  status: AgentHealthStatus;
  responseTime: number;
  availability: number;
  errorRate: number;
  lastSeen: Date;
  healthScore: number;
  region: string;
  endpoint: string;
  metadata: Record<string, any>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  agentId: string;
  timestamp: Date;
  status: AgentHealthStatus;
  responseTime: number;
  error?: string;
  metadata: Record<string, any>;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  id: string;
  name: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  severity: AlertSeverity;
  enabled: boolean;
  cooldown: number;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value: number;
  duration: number;
}

/**
 * Alert action
 */
export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'slack';
  target: string;
  template?: string;
  params?: Record<string, any>;
}

/**
 * Failover configuration
 */
export interface FailoverConfig {
  enabled: boolean;
  strategy: 'round_robin' | 'weighted' | 'latency_based';
  cooldown: number;
  maxRetries: number;
  regions: string[];
}

/**
 * Monitoring dashboard data
 */
export interface DashboardData {
  overview: {
    totalAgents: number;
    healthyAgents: number;
    activeAlerts: number;
    averageResponseTime: number;
  };
  metrics: AgentHealthMetrics[];
  alerts: Alert[];
  trends: MetricTrend[];
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  configId: string;
  agentId: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Metric trend data
 */
export interface MetricTrend {
  metric: string;
  agentId: string;
  data: { timestamp: Date; value: number }[];
  trend: 'up' | 'down' | 'stable';
}

// ============================================================================
// Core Health Checker
// ============================================================================

/**
 * Core health checker implementation
 */
class HealthChecker extends EventEmitter {
  private readonly redis: Redis;
  private readonly config: HealthCheckConfig;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: Redis, config: HealthCheckConfig) {
    super();
    this.redis = redis;
    this.config = config;
  }

  /**
   * Start health checking for an agent
   */
  public async startChecking(agentId: string, endpoint: string, region: string): Promise<void> {
    if (this.checkIntervals.has(agentId)) {
      this.stopChecking(agentId);
    }

    const interval = setInterval(async () => {
      try {
        const result = await this.performHealthCheck(agentId, endpoint, region);
        await this.cacheResult(result);
        this.emit('healthCheck', result);
      } catch (error) {
        console.error(`Health check failed for agent ${agentId}:`, error);
        const failureResult: HealthCheckResult = {
          agentId,
          timestamp: new Date(),
          status: AgentHealthStatus.UNHEALTHY,
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: { region, endpoint }
        };
        await this.cacheResult(failureResult);
        this.emit('healthCheck', failureResult);
      }
    }, this.config.interval);

    this.checkIntervals.set(agentId, interval);
  }

  /**
   * Stop health checking for an agent
   */
  public stopChecking(agentId: string): void {
    const interval = this.checkIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(agentId);
    }
  }

  /**
   * Perform health check on agent
   */
  private async performHealthCheck(
    agentId: string, 
    endpoint: string, 
    region: string
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let retries = 0;

    while (retries < this.config.retries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(`${endpoint}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'CR-AudioViz-Health-Monitor/1.0'
          }
        });

        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;

        const status = this.determineHealthStatus(response.status, responseTime);

        return {
          agentId,
          timestamp: new Date(),
          status,
          responseTime,
          metadata: {
            region,
            endpoint,
            statusCode: response.status,
            attempt: retries + 1
          }
        };

      } catch (error) {
        retries++;
        if (retries >= this.config.retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }

    throw new Error(`Health check failed after ${this.config.retries} retries`);
  }

  /**
   * Determine health status based on response
   */
  private determineHealthStatus(statusCode: number, responseTime: number): AgentHealthStatus {
    if (statusCode !== 200) {
      return AgentHealthStatus.UNHEALTHY;
    }

    if (responseTime > this.config.thresholds.responseTime * 2) {
      return AgentHealthStatus.UNHEALTHY;
    }

    if (responseTime > this.config.thresholds.responseTime) {
      return AgentHealthStatus.DEGRADED;
    }

    return AgentHealthStatus.HEALTHY;
  }

  /**
   * Cache health check result
   */
  private async cacheResult(result: HealthCheckResult): Promise<void> {
    const key = `health:${result.agentId}:latest`;
    await this.redis.setex(key, 3600, JSON.stringify(result));

    // Store in time series
    const tsKey = `health:${result.agentId}:history`;
    await this.redis.zadd(tsKey, result.timestamp.getTime(), JSON.stringify(result));
    
    // Keep only last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore(tsKey, '-inf', oneDayAgo);
  }
}

// ============================================================================
// Metrics Aggregator
// ============================================================================

/**
 * Metrics aggregator for health data
 */
class MetricsAggregator {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Aggregate metrics for an agent
   */
  public async aggregateMetrics(agentId: string, timeWindow: number = 3600): Promise<AgentHealthMetrics> {
    const now = Date.now();
    const windowStart = now - (timeWindow * 1000);

    // Get historical data
    const historyKey = `health:${agentId}:history`;
    const results = await this.redis.zrangebyscore(
      historyKey, 
      windowStart, 
      now, 
      'WITHSCORES'
    );

    if (results.length === 0) {
      return this.getDefaultMetrics(agentId);
    }

    // Parse results
    const healthChecks: HealthCheckResult[] = [];
    for (let i = 0; i < results.length; i += 2) {
      try {
        const data = JSON.parse(results[i]);
        healthChecks.push(data);
      } catch (error) {
        console.warn('Failed to parse health check result:', error);
      }
    }

    return this.calculateAggregatedMetrics(agentId, healthChecks);
  }

  /**
   * Calculate aggregated metrics from health checks
   */
  private calculateAggregatedMetrics(
    agentId: string, 
    healthChecks: HealthCheckResult[]
  ): AgentHealthMetrics {
    if (healthChecks.length === 0) {
      return this.getDefaultMetrics(agentId);
    }

    const latest = healthChecks[healthChecks.length - 1];
    const totalChecks = healthChecks.length;
    const healthyChecks = healthChecks.filter(
      check => check.status === AgentHealthStatus.HEALTHY
    ).length;
    const errorChecks = healthChecks.filter(
      check => check.status === AgentHealthStatus.UNHEALTHY
    ).length;

    // Calculate averages
    const avgResponseTime = healthChecks.reduce(
      (sum, check) => sum + check.responseTime, 0
    ) / totalChecks;

    const availability = (healthyChecks / totalChecks) * 100;
    const errorRate = (errorChecks / totalChecks) * 100;

    // Calculate health score
    const healthScore = this.calculateHealthScore(availability, avgResponseTime, errorRate);

    return {
      agentId,
      status: latest.status,
      responseTime: avgResponseTime,
      availability,
      errorRate,
      lastSeen: latest.timestamp,
      healthScore,
      region: latest.metadata?.region || 'unknown',
      endpoint: latest.metadata?.endpoint || '',
      metadata: {
        totalChecks,
        healthyChecks,
        errorChecks,
        timeWindow: '1h'
      }
    };
  }

  /**
   * Calculate health score (0-100)
   */
  private calculateHealthScore(availability: number, responseTime: number, errorRate: number): number {
    let score = 100;

    // Availability weight: 50%
    score *= (availability / 100) * 0.5;

    // Response time weight: 30%
    const responseTimeScore = Math.max(0, 1 - (responseTime / 5000)); // 5s max
    score += responseTimeScore * 30;

    // Error rate weight: 20%
    const errorRateScore = Math.max(0, 1 - (errorRate / 100));
    score += errorRateScore * 20;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Get default metrics for unknown agent
   */
  private getDefaultMetrics(agentId: string): AgentHealthMetrics {
    return {
      agentId,
      status: AgentHealthStatus.UNKNOWN,
      responseTime: 0,
      availability: 0,
      errorRate: 0,
      lastSeen: new Date(),
      healthScore: 0,
      region: 'unknown',
      endpoint: '',
      metadata: {}
    };
  }
}

// ============================================================================
// Score Calculator
// ============================================================================

/**
 * Advanced health score calculator
 */
class ScoreCalculator {
  private readonly weights = {
    availability: 0.4,
    responseTime: 0.3,
    errorRate: 0.2,
    consistency: 0.1
  };

  /**
   * Calculate comprehensive health score
   */
  public calculateScore(metrics: AgentHealthMetrics, historicalData: HealthCheckResult[]): number {
    const availabilityScore = this.calculateAvailabilityScore(metrics.availability);
    const responseTimeScore = this.calculateResponseTimeScore(metrics.responseTime);
    const errorRateScore = this.calculateErrorRateScore(metrics.errorRate);
    const consistencyScore = this.calculateConsistencyScore(historicalData);

    const totalScore = (
      availabilityScore * this.weights.availability +
      responseTimeScore * this.weights.responseTime +
      errorRateScore * this.weights.errorRate +
      consistencyScore * this.weights.consistency
    );

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(availability: number): number {
    return availability;
  }

  /**
   * Calculate response time score
   */
  private calculateResponseTimeScore(responseTime: number): number {
    // Score decreases exponentially with response time
    const maxResponseTime = 5000; // 5 seconds
    return Math.max(0, 100 * Math.exp(-responseTime / (maxResponseTime / 3)));
  }

  /**
   * Calculate error rate score
   */
  private calculateErrorRateScore(errorRate: number): number {
    return Math.max(0, 100 - errorRate * 2);
  }

  /**
   * Calculate consistency score based on variance
   */
  private calculateConsistencyScore(historicalData: HealthCheckResult[]): number {
    if (historicalData.length < 2) return 100;

    const responseTimes = historicalData.map(check => check.responseTime);
    const mean = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency score
    const normalizedStdDev = Math.min(1, stdDev / mean);
    return Math.max(0, 100 * (1 - normalizedStdDev));
  }
}

// ============================================================================
// Main Service Classes
// ============================================================================

/**
 * Health metrics collector service
 */
export class HealthMetricsCollector extends EventEmitter {
  private readonly supabase: SupabaseClient;
  private readonly redis: Redis;
  private readonly healthChecker: HealthChecker;
  private readonly metricsAggregator: MetricsAggregator;
  private readonly scoreCalculator: ScoreCalculator;
  private realtimeChannel?: RealtimeChannel;

  constructor(supabaseUrl: string, supabaseKey: string, redisUrl: string) {
    super();
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisUrl);
    
    const healthConfig: HealthCheckConfig = {
      interval: 30000, // 30 seconds
      timeout: 10000,  // 10 seconds
      retries: 3,
      thresholds: {
        responseTime: 2000, // 2 seconds
        errorRate: 5,       // 5%
        availability: 95    // 95%
      }
    };

    this.healthChecker = new HealthChecker(this.redis, healthConfig);
    this.metricsAggregator = new MetricsAggregator(this.redis);
    this.scoreCalculator = new ScoreCalculator();

    this.setupEventHandlers();
  }

  /**
   * Initialize the collector
   */
  public async initialize(): Promise<void> {
    await this.setupRealtimeSubscription();
    await this.loadActiveAgents();
  }

  /**
   * Setup realtime subscription for agent changes
   */
  private async setupRealtimeSubscription(): Promise<void> {
    this.realtimeChannel = this.supabase
      .channel('agent-registry-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'agents' },
        (payload) => this.handleAgentChange(payload)
      )
      .subscribe();
  }

  /**
   * Load currently active agents
   */
  private async loadActiveAgents(): Promise<void> {
    const { data: agents, error } = await this.supabase
      .from('agents')
      .select('id, endpoint, region, status')
      .eq('status', 'active');

    if (error) {
      console.error('Failed to load active agents:', error);
      return;
    }

    for (const agent of agents || []) {
      await this.healthChecker.startChecking(agent.id, agent.endpoint, agent.region);
    }
  }

  /**
   * Handle agent registry changes
   */
  private async handleAgentChange(payload: any): Promise<void> {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        if (newRecord?.status === 'active') {
          await this.healthChecker.startChecking(
            newRecord.id, 
            newRecord.endpoint, 
            newRecord.region
          );
        }
        break;

      case 'UPDATE':
        if (newRecord?.status === 'active' && oldRecord?.status !== 'active') {
          await this.healthChecker.startChecking(
            newRecord.id, 
            newRecord.endpoint, 
            newRecord.region
          );
        } else if (newRecord?.status !== 'active' && oldRecord?.status === 'active') {
          this.healthChecker.stopChecking(newRecord.id);
        }
        break;

      case 'DELETE':
        if (oldRecord?.id) {
          this.healthChecker.stopChecking(oldRecord.id);
        }
        break;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.healthChecker.on('healthCheck', async (result: HealthCheckResult) => {
      // Aggregate metrics
      const metrics = await this.metricsAggregator.aggregateMetrics(result.agentId);
      
      // Update database
      await this.updateAgentHealth(metrics);
      
      // Emit for other services
      this.emit('metricsUpdate', metrics);
    });
  }

  /**
   * Update agent health in database
   */
  private async updateAgentHealth(metrics: AgentHealthMetrics): Promise<void> {
    const { error } = await this.supabase
      .from('agent_health')
      .upsert({
        agent_id: metrics.agentId,
        status: metrics.status,
        response_time: metrics.responseTime,
        availability: metrics.availability,
        error_rate: metrics.errorRate,
        health_score: metrics.healthScore,
        last_check: metrics.lastSeen.toISOString(),
        metadata: metrics.metadata
      });

    if (error) {
      console.error('Failed to update agent health:', error);
    }
  }

  /**
   * Get metrics for specific agent
   */
  public async getAgentMetrics(agentId: string): Promise<AgentHealthMetrics> {
    return this.metricsAggregator.aggregateMetrics(agentId);
  }

  /**
   * Get metrics for all agents
   */
  public async getAllAgentMetrics(): Promise<AgentHealthMetrics[]> {
    const { data: agents } = await this.supabase
      .from('agents')
      .select('id')
      .eq('status', 'active');

    if (!agents) return [];

    const metricsPromises = agents.map(agent => 
      this.metricsAggregator.aggregateMetrics(agent.id)
    );

    return Promise.all(metricsPromises);
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
    }
    await this.redis.quit();
  }
}

/**
 * Failover manager for automatic agent switching
 */
export class FailoverManager extends EventEmitter {
  private readonly redis: Redis;
  private readonly config: FailoverConfig;
  private readonly supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string, redisUrl: string, config: FailoverConfig) {
    super();
    this.redis = new Redis(redisUrl);
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = config;
  }

  /**
   * Handle agent failure
   */
  public async handleAgentFailure(agentId: string): Promise<void> {
    if (!this.config.enabled) return;

    console.log(`Handling failure for agent ${agentId}`);

    // Find replacement agent
    const replacement = await this.findReplacementAgent(agentId);
    if (!replacement) {
      console.warn(`No replacement found for failed agent ${agentId}`);
      this.emit('failoverFailed', { agentId, reason: 'No replacement available' });
      return;
    }

    // Execute failover
    await this.executeFailover(agentId, replacement.id);
    
    this.emit('failoverExecuted', {
      failedAgent: agentId,
      replacementAgent: replacement.id,
      strategy: this.config.strategy
    });
  }

  /**
   * Find replacement agent using configured strategy
   */
  private async findReplacementAgent(failedAgentId: string): Promise<any> {
    const { data: agents } = await this.supabase
      .from('agents')
      .select('*, agent_health(*)')
      .eq('status',