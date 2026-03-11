```typescript
import { createClient as createClickHouse } from '@clickhouse/client';
import { createClient as createSupabase } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';

/**
 * Agent execution metrics interface
 */
export interface AgentExecutionMetrics {
  agentId: string;
  userId: string;
  sessionId: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'success' | 'error' | 'timeout';
  errorMessage?: string;
  inputSize: number;
  outputSize?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  tokensUsed?: number;
  cost?: number;
  metadata?: Record<string, any>;
}

/**
 * Aggregated usage statistics interface
 */
export interface UsageStatistics {
  agentId: string;
  timeframe: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  totalDuration: number;
  successRate: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  totalTokensUsed: number;
  totalCost: number;
  peakConcurrency: number;
  lastExecuted: Date;
}

/**
 * Real-time usage metrics for WebSocket broadcasting
 */
export interface RealtimeUsageMetrics {
  timestamp: Date;
  activeExecutions: number;
  executionsPerMinute: number;
  averageResponseTime: number;
  currentSuccessRate: number;
  topAgentsByUsage: Array<{
    agentId: string;
    executionCount: number;
    avgDuration: number;
  }>;
}

/**
 * Usage tracking configuration interface
 */
export interface UsageTrackingConfig {
  clickhouseConfig: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  supabaseConfig: {
    url: string;
    key: string;
  };
  redisConfig: {
    host: string;
    port: number;
    password?: string;
  };
  batchSize: number;
  flushInterval: number;
  realtimeUpdateInterval: number;
  metricsRetentionDays: number;
}

/**
 * Analytics query builder for complex metrics queries
 */
export class UsageAnalyticsQuery {
  private query: string[] = [];
  private params: Record<string, any> = {};

  /**
   * Filter by agent ID
   */
  public forAgent(agentId: string): UsageAnalyticsQuery {
    this.query.push('agent_id = {agentId:String}');
    this.params.agentId = agentId;
    return this;
  }

  /**
   * Filter by user ID
   */
  public forUser(userId: string): UsageAnalyticsQuery {
    this.query.push('user_id = {userId:String}');
    this.params.userId = userId;
    return this;
  }

  /**
   * Filter by time range
   */
  public timeRange(startTime: Date, endTime: Date): UsageAnalyticsQuery {
    this.query.push('start_time BETWEEN {startTime:DateTime} AND {endTime:DateTime}');
    this.params.startTime = startTime.toISOString().slice(0, 19);
    this.params.endTime = endTime.toISOString().slice(0, 19);
    return this;
  }

  /**
   * Filter by status
   */
  public withStatus(status: AgentExecutionMetrics['status']): UsageAnalyticsQuery {
    this.query.push('status = {status:String}');
    this.params.status = status;
    return this;
  }

  /**
   * Build the WHERE clause
   */
  public buildWhere(): { where: string; params: Record<string, any> } {
    return {
      where: this.query.length > 0 ? `WHERE ${this.query.join(' AND ')}` : '',
      params: this.params
    };
  }
}

/**
 * Statistical aggregation functions for metrics
 */
export class MetricsAggregator {
  /**
   * Calculate percentiles for duration metrics
   */
  public static async calculatePercentiles(
    clickhouse: any,
    agentId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ p50: number; p90: number; p95: number; p99: number }> {
    const query = `
      SELECT
        quantile(0.5)(duration) as p50,
        quantile(0.9)(duration) as p90,
        quantile(0.95)(duration) as p95,
        quantile(0.99)(duration) as p99
      FROM agent_usage_metrics
      WHERE agent_id = {agentId:String}
        AND start_time BETWEEN {startTime:DateTime} AND {endTime:DateTime}
        AND status = 'success'
    `;

    const result = await clickhouse.query({
      query,
      query_params: {
        agentId,
        startTime: timeRange.start.toISOString().slice(0, 19),
        endTime: timeRange.end.toISOString().slice(0, 19)
      }
    });

    const rows = await result.json();
    return rows.data[0] || { p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  /**
   * Calculate hourly usage trends
   */
  public static async calculateHourlyTrends(
    clickhouse: any,
    agentId: string,
    days: number = 7
  ): Promise<Array<{ hour: string; count: number; avgDuration: number }>> {
    const query = `
      SELECT
        toHour(start_time) as hour,
        count(*) as count,
        avg(duration) as avgDuration
      FROM agent_usage_metrics
      WHERE agent_id = {agentId:String}
        AND start_time >= now() - INTERVAL {days:UInt8} DAY
      GROUP BY hour
      ORDER BY hour
    `;

    const result = await clickhouse.query({
      query,
      query_params: { agentId, days }
    });

    const rows = await result.json();
    return rows.data;
  }
}

/**
 * ClickHouse metrics storage layer
 */
export class ClickHouseMetricsStore {
  private client: any;

  constructor(config: UsageTrackingConfig['clickhouseConfig']) {
    this.client = createClickHouse({
      host: `http://${config.host}:${config.port}`,
      username: config.username,
      password: config.password,
      database: config.database,
    });
  }

  /**
   * Initialize database schema
   */
  public async initializeSchema(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS agent_usage_metrics (
        agent_id String,
        user_id String,
        session_id String,
        execution_id String,
        start_time DateTime,
        end_time Nullable(DateTime),
        duration Nullable(UInt32),
        status Enum('running', 'success', 'error', 'timeout'),
        error_message Nullable(String),
        input_size UInt32,
        output_size Nullable(UInt32),
        cpu_usage Nullable(Float32),
        memory_usage Nullable(Float32),
        tokens_used Nullable(UInt32),
        cost Nullable(Float32),
        metadata String DEFAULT '{}',
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (agent_id, start_time)
      TTL created_at + INTERVAL {retentionDays:UInt16} DAY
    `;

    await this.client.exec({
      query: createTableQuery,
      query_params: { retentionDays: 90 }
    });
  }

  /**
   * Insert metrics batch
   */
  public async insertMetrics(metrics: AgentExecutionMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    const values = metrics.map(metric => [
      metric.agentId,
      metric.userId,
      metric.sessionId,
      metric.executionId,
      metric.startTime.toISOString().slice(0, 19),
      metric.endTime ? metric.endTime.toISOString().slice(0, 19) : null,
      metric.duration || null,
      metric.status,
      metric.errorMessage || null,
      metric.inputSize,
      metric.outputSize || null,
      metric.cpuUsage || null,
      metric.memoryUsage || null,
      metric.tokensUsed || null,
      metric.cost || null,
      JSON.stringify(metric.metadata || {})
    ]);

    await this.client.insert({
      table: 'agent_usage_metrics',
      values,
      format: 'JSONEachRow'
    });
  }

  /**
   * Get usage statistics
   */
  public async getUsageStatistics(
    agentId: string,
    timeframe: string
  ): Promise<UsageStatistics> {
    const interval = this.getTimeframeInterval(timeframe);
    
    const query = `
      SELECT
        agent_id,
        '{timeframe:String}' as timeframe,
        count(*) as total_executions,
        countIf(status = 'success') as successful_executions,
        countIf(status IN ('error', 'timeout')) as failed_executions,
        avg(duration) as average_duration,
        sum(duration) as total_duration,
        successful_executions / total_executions as success_rate,
        avg(cpu_usage) as average_cpu_usage,
        avg(memory_usage) as average_memory_usage,
        sum(tokens_used) as total_tokens_used,
        sum(cost) as total_cost,
        max(start_time) as last_executed
      FROM agent_usage_metrics
      WHERE agent_id = {agentId:String}
        AND start_time >= now() - INTERVAL ${interval}
      GROUP BY agent_id
    `;

    const result = await this.client.query({
      query,
      query_params: { agentId, timeframe }
    });

    const rows = await result.json();
    return rows.data[0] || this.getEmptyStatistics(agentId, timeframe);
  }

  private getTimeframeInterval(timeframe: string): string {
    switch (timeframe) {
      case '1h': return '1 HOUR';
      case '24h': return '1 DAY';
      case '7d': return '7 DAY';
      case '30d': return '30 DAY';
      default: return '1 DAY';
    }
  }

  private getEmptyStatistics(agentId: string, timeframe: string): UsageStatistics {
    return {
      agentId,
      timeframe,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      totalDuration: 0,
      successRate: 0,
      averageCpuUsage: 0,
      averageMemoryUsage: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      peakConcurrency: 0,
      lastExecuted: new Date()
    };
  }
}

/**
 * Metric collection utilities
 */
export class UsageMetricsCollector {
  private pendingMetrics: AgentExecutionMetrics[] = [];
  private activeExecutions = new Map<string, AgentExecutionMetrics>();

  constructor(private store: ClickHouseMetricsStore, private batchSize: number) {}

  /**
   * Start tracking an agent execution
   */
  public startExecution(
    agentId: string,
    userId: string,
    sessionId: string,
    inputSize: number,
    metadata?: Record<string, any>
  ): string {
    const executionId = `${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const metrics: AgentExecutionMetrics = {
      agentId,
      userId,
      sessionId,
      executionId,
      startTime: new Date(),
      status: 'running',
      inputSize,
      metadata
    };

    this.activeExecutions.set(executionId, metrics);
    return executionId;
  }

  /**
   * End tracking an agent execution
   */
  public async endExecution(
    executionId: string,
    status: 'success' | 'error' | 'timeout',
    outputSize?: number,
    errorMessage?: string,
    resourceUsage?: { cpu: number; memory: number; tokens: number; cost: number }
  ): Promise<void> {
    const metrics = this.activeExecutions.get(executionId);
    if (!metrics) return;

    const endTime = new Date();
    metrics.endTime = endTime;
    metrics.duration = endTime.getTime() - metrics.startTime.getTime();
    metrics.status = status;
    metrics.outputSize = outputSize;
    metrics.errorMessage = errorMessage;
    
    if (resourceUsage) {
      metrics.cpuUsage = resourceUsage.cpu;
      metrics.memoryUsage = resourceUsage.memory;
      metrics.tokensUsed = resourceUsage.tokens;
      metrics.cost = resourceUsage.cost;
    }

    this.activeExecutions.delete(executionId);
    this.pendingMetrics.push(metrics);

    if (this.pendingMetrics.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Get active executions count
   */
  public getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Flush pending metrics to storage
   */
  public async flush(): Promise<void> {
    if (this.pendingMetrics.length === 0) return;

    const metricsToFlush = [...this.pendingMetrics];
    this.pendingMetrics = [];

    try {
      await this.store.insertMetrics(metricsToFlush);
    } catch (error) {
      // Re-add metrics to pending if insertion fails
      this.pendingMetrics.unshift(...metricsToFlush);
      throw error;
    }
  }
}

/**
 * Real-time usage updates via WebSocket
 */
export class RealtimeUsageUpdater extends EventEmitter {
  private wss?: WebSocketServer;
  private updateInterval?: NodeJS.Timeout;

  constructor(
    private redis: Redis,
    private collector: UsageMetricsCollector,
    private updateIntervalMs: number
  ) {
    super();
  }

  /**
   * Initialize WebSocket server
   */
  public initializeWebSocket(port: number): void {
    this.wss = new WebSocketServer({ port });
    
    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'subscribe') {
            ws.send(JSON.stringify({ type: 'subscribed', success: true }));
          }
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });
    });
  }

  /**
   * Start real-time updates
   */
  public startRealtimeUpdates(): void {
    this.updateInterval = setInterval(async () => {
      try {
        const metrics = await this.collectRealtimeMetrics();
        await this.broadcastMetrics(metrics);
        await this.cacheMetrics(metrics);
      } catch (error) {
        this.emit('error', error);
      }
    }, this.updateIntervalMs);
  }

  /**
   * Stop real-time updates
   */
  public stopRealtimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Collect current real-time metrics
   */
  private async collectRealtimeMetrics(): Promise<RealtimeUsageMetrics> {
    const activeExecutions = this.collector.getActiveExecutionsCount();
    
    // Get cached metrics from Redis
    const cachedMetrics = await this.redis.hmget(
      'realtime_metrics',
      'executions_per_minute',
      'avg_response_time',
      'success_rate',
      'top_agents'
    );

    return {
      timestamp: new Date(),
      activeExecutions,
      executionsPerMinute: parseInt(cachedMetrics[0] || '0'),
      averageResponseTime: parseFloat(cachedMetrics[1] || '0'),
      currentSuccessRate: parseFloat(cachedMetrics[2] || '100'),
      topAgentsByUsage: JSON.parse(cachedMetrics[3] || '[]')
    };
  }

  /**
   * Broadcast metrics to connected WebSocket clients
   */
  private async broadcastMetrics(metrics: RealtimeUsageMetrics): Promise<void> {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'usage_update',
      data: metrics
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
  }

  /**
   * Cache metrics in Redis
   */
  private async cacheMetrics(metrics: RealtimeUsageMetrics): Promise<void> {
    await this.redis.hmset('realtime_metrics_cache', {
      timestamp: metrics.timestamp.toISOString(),
      active_executions: metrics.activeExecutions.toString(),
      executions_per_minute: metrics.executionsPerMinute.toString(),
      avg_response_time: metrics.averageResponseTime.toString(),
      success_rate: metrics.currentSuccessRate.toString(),
      top_agents: JSON.stringify(metrics.topAgentsByUsage)
    });

    // Set expiration
    await this.redis.expire('realtime_metrics_cache', 300); // 5 minutes
  }
}

/**
 * Main Agent Usage Tracking Service
 * Singleton service for comprehensive agent usage monitoring
 */
export class AgentUsageTrackingService extends EventEmitter {
  private static instance: AgentUsageTrackingService;
  private store: ClickHouseMetricsStore;
  private collector: UsageMetricsCollector;
  private realtimeUpdater: RealtimeUsageUpdater;
  private redis: Redis;
  private supabase: any;
  private flushInterval?: NodeJS.Timeout;
  private isInitialized = false;

  private constructor(private config: UsageTrackingConfig) {
    super();
    
    this.redis = new Redis(config.redisConfig);
    this.supabase = createSupabase(config.supabaseConfig.url, config.supabaseConfig.key);
    this.store = new ClickHouseMetricsStore(config.clickhouseConfig);
    this.collector = new UsageMetricsCollector(this.store, config.batchSize);
    this.realtimeUpdater = new RealtimeUsageUpdater(
      this.redis,
      this.collector,
      config.realtimeUpdateInterval
    );

    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: UsageTrackingConfig): AgentUsageTrackingService {
    if (!AgentUsageTrackingService.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      AgentUsageTrackingService.instance = new AgentUsageTrackingService(config);
    }
    return AgentUsageTrackingService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.store.initializeSchema();
      
      // Start periodic flushing
      this.flushInterval = setInterval(async () => {
        try {
          await this.collector.flush();
        } catch (error) {
          this.emit('error', new Error(`Flush failed: ${error}`));
        }
      }, this.config.flushInterval);

      // Start real-time updates
      this.realtimeUpdater.startRealtimeUpdates();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize AgentUsageTrackingService: ${error}`);
    }
  }

  /**
   * Start tracking an agent execution
   */
  public startTracking(
    agentId: string,
    userId: string,
    sessionId: string,
    inputSize: number,
    metadata?: Record<string, any>
  ): string {
    return this.collector.startExecution(agentId, userId, sessionId, inputSize, metadata);
  }

  /**
   * End tracking an agent execution
   */
  public async endTracking(
    executionId: string,
    status: 'success' | 'error' | 'timeout',
    outputSize?: number,
    errorMessage?: string,
    resourceUsage?: { cpu: number; memory: number; tokens: number; cost: number }
  ): Promise<void> {
    await this.collector.endExecution(executionId, status, outputSize, errorMessage, resourceUsage);
  }

  /**
   * Get usage statistics for an agent
   */
  public async getAgentUsageStats(agentId: string, timeframe: string): Promise<UsageStatistics> {
    return await this.store.getUsageStatistics(agentId, timeframe);
  }

  /**
   * Get analytics query builder
   */
  public createAnalyticsQuery(): UsageAnalyticsQuery {
    return new UsageAnalyticsQuery();
  }

  /**
   * Get metrics aggregator
   */
  public getMetricsAggregator(): typeof MetricsAggregator {
    return MetricsAggregator;
  }

  /**
   * Initialize WebSocket server for real-time updates
   */
  public initializeWebSocket(port: number): void {
    this.realtimeUpdater.initializeWebSocket(port);
  }

  /**
   * Get current active executions count
   */
  public getActiveExecutionsCount(): number {
    return this.collector.getActiveExecutionsCount();
  }

  /**
   * Force flush pending metrics
   */
  public async flush(): Promise<void> {
    await this.collector.flush();
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.re