```typescript
/**
 * Agent Usage Pattern Analysis Service
 * Real-time analysis of agent execution patterns and market insights generation
 */

import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import WebSocket from 'ws';
import { Logger } from '../../lib/logger';
import { KafkaConsumer } from './kafka-consumer';
import { PatternAnalyzer } from './pattern-analyzer';
import { TrendDetector } from './trend-detector';
import { MarketInsightsGenerator } from './market-insights-generator';
import { UsageAggregator } from './usage-aggregator';
import {
  AgentUsageEvent,
  UsagePattern,
  TrendAnalysis,
  MarketInsight,
  AggregatedUsageMetrics,
  ServiceConfig,
  AnalyticsSnapshot,
  PatternAlert,
  UsageFilter,
  TrendPrediction
} from './types';

/**
 * Configuration interface for the analytics service
 */
interface AgentUsageAnalyticsConfig extends ServiceConfig {
  kafka: {
    brokers: string[];
    groupId: string;
    topics: string[];
  };
  supabase: {
    url: string;
    key: string;
  };
  redis: {
    url: string;
  };
  websocket: {
    port: number;
  };
  analytics: {
    aggregationInterval: number;
    patternDetectionThreshold: number;
    trendAnalysisWindow: number;
    insightGenerationInterval: number;
  };
}

/**
 * Main Agent Usage Analytics Service
 * Orchestrates real-time pattern analysis and market insights generation
 */
export class AgentUsageAnalyticsService extends EventEmitter {
  private readonly logger = new Logger('AgentUsageAnalytics');
  private readonly supabase;
  private readonly redis: Redis;
  private readonly kafkaConsumer: KafkaConsumer;
  private readonly patternAnalyzer: PatternAnalyzer;
  private readonly trendDetector: TrendDetector;
  private readonly marketInsightsGenerator: MarketInsightsGenerator;
  private readonly usageAggregator: UsageAggregator;
  private wsServer: WebSocket.Server | null = null;
  private isRunning = false;
  private readonly connectedClients = new Set<WebSocket>();

  constructor(private readonly config: AgentUsageAnalyticsConfig) {
    super();
    
    // Initialize external services
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    this.redis = new Redis(config.redis.url);
    
    // Initialize service components
    this.kafkaConsumer = new KafkaConsumer(config.kafka, this.handleUsageEvent.bind(this));
    this.patternAnalyzer = new PatternAnalyzer(config.analytics);
    this.trendDetector = new TrendDetector(config.analytics);
    this.marketInsightsGenerator = new MarketInsightsGenerator(config.analytics);
    this.usageAggregator = new UsageAggregator(this.redis, config.analytics);

    this.setupEventHandlers();
  }

  /**
   * Start the analytics service
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Agent Usage Analytics Service...');
      
      // Start WebSocket server for real-time updates
      await this.startWebSocketServer();
      
      // Start Kafka consumer
      await this.kafkaConsumer.start();
      
      // Start aggregation intervals
      this.startAggregationScheduler();
      
      // Start market insights generation
      this.startInsightsScheduler();
      
      this.isRunning = true;
      this.emit('service:started');
      
      this.logger.info('Agent Usage Analytics Service started successfully');
    } catch (error) {
      this.logger.error('Failed to start analytics service:', error);
      throw new Error(`Service startup failed: ${error.message}`);
    }
  }

  /**
   * Stop the analytics service
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Agent Usage Analytics Service...');
      
      this.isRunning = false;
      
      // Stop Kafka consumer
      await this.kafkaConsumer.stop();
      
      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
        this.wsServer = null;
      }
      
      // Close Redis connection
      await this.redis.quit();
      
      this.emit('service:stopped');
      this.logger.info('Agent Usage Analytics Service stopped');
    } catch (error) {
      this.logger.error('Error stopping analytics service:', error);
      throw error;
    }
  }

  /**
   * Get current usage patterns
   */
  public async getUsagePatterns(filter?: UsageFilter): Promise<UsagePattern[]> {
    try {
      const cacheKey = `patterns:${filter ? JSON.stringify(filter) : 'all'}`;
      
      // Try to get from cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Query from database
      let query = this.supabase
        .from('usage_patterns')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter) {
        if (filter.agentId) {
          query = query.eq('agent_id', filter.agentId);
        }
        if (filter.timeRange) {
          query = query
            .gte('created_at', filter.timeRange.start)
            .lte('created_at', filter.timeRange.end);
        }
        if (filter.capability) {
          query = query.contains('capabilities', [filter.capability]);
        }
      }

      const { data, error } = await query.limit(100);
      
      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Cache results for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(data));
      
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get usage patterns:', error);
      throw error;
    }
  }

  /**
   * Get trend analysis
   */
  public async getTrendAnalysis(timeWindow?: number): Promise<TrendAnalysis> {
    try {
      const analysis = await this.trendDetector.analyzeTrends(timeWindow);
      
      // Store analysis in database
      await this.supabase
        .from('trend_analyses')
        .insert({
          analysis: analysis,
          time_window: timeWindow || this.config.analytics.trendAnalysisWindow,
          created_at: new Date().toISOString()
        });

      return analysis;
    } catch (error) {
      this.logger.error('Failed to get trend analysis:', error);
      throw error;
    }
  }

  /**
   * Get market insights
   */
  public async getMarketInsights(): Promise<MarketInsight[]> {
    try {
      const cacheKey = 'market_insights:latest';
      
      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Query from database
      const { data, error } = await this.supabase
        .from('market_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Cache for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(data));
      
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get market insights:', error);
      throw error;
    }
  }

  /**
   * Get aggregated usage metrics
   */
  public async getAggregatedMetrics(timeRange?: { start: Date; end: Date }): Promise<AggregatedUsageMetrics> {
    try {
      return await this.usageAggregator.getAggregatedMetrics(timeRange);
    } catch (error) {
      this.logger.error('Failed to get aggregated metrics:', error);
      throw error;
    }
  }

  /**
   * Get analytics snapshot
   */
  public async getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
    try {
      const [patterns, trends, insights, metrics] = await Promise.all([
        this.getUsagePatterns({ timeRange: { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() }}),
        this.getTrendAnalysis(24),
        this.getMarketInsights(),
        this.getAggregatedMetrics({ start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() })
      ]);

      return {
        timestamp: new Date(),
        recentPatterns: patterns.slice(0, 10),
        trendAnalysis: trends,
        latestInsights: insights.slice(0, 5),
        aggregatedMetrics: metrics,
        activeAgents: await this.getActiveAgentsCount(),
        totalExecutions: metrics.totalExecutions,
        averageExecutionTime: metrics.averageExecutionTime
      };
    } catch (error) {
      this.logger.error('Failed to get analytics snapshot:', error);
      throw error;
    }
  }

  /**
   * Generate trend predictions
   */
  public async generateTrendPredictions(horizon: number = 7): Promise<TrendPrediction[]> {
    try {
      return await this.trendDetector.generatePredictions(horizon);
    } catch (error) {
      this.logger.error('Failed to generate trend predictions:', error);
      throw error;
    }
  }

  /**
   * Handle incoming usage events from Kafka
   */
  private async handleUsageEvent(event: AgentUsageEvent): Promise<void> {
    try {
      this.logger.debug('Processing usage event:', event.eventId);

      // Add to aggregator
      await this.usageAggregator.addUsageEvent(event);

      // Analyze patterns
      const pattern = await this.patternAnalyzer.analyzeEvent(event);
      if (pattern) {
        await this.storePattern(pattern);
        this.broadcastUpdate('pattern', pattern);
      }

      // Check for trends
      const trendUpdate = await this.trendDetector.processEvent(event);
      if (trendUpdate) {
        this.broadcastUpdate('trend', trendUpdate);
      }

      // Generate alerts if needed
      const alert = await this.checkForAlerts(event, pattern);
      if (alert) {
        this.emit('pattern:alert', alert);
        this.broadcastUpdate('alert', alert);
      }

      this.emit('event:processed', event);
    } catch (error) {
      this.logger.error('Failed to process usage event:', error);
      this.emit('event:error', { event, error: error.message });
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.kafkaConsumer.on('error', (error) => {
      this.logger.error('Kafka consumer error:', error);
      this.emit('kafka:error', error);
    });

    this.patternAnalyzer.on('pattern:detected', (pattern) => {
      this.logger.info('New pattern detected:', pattern.id);
      this.emit('pattern:detected', pattern);
    });

    this.trendDetector.on('trend:detected', (trend) => {
      this.logger.info('New trend detected:', trend.id);
      this.emit('trend:detected', trend);
    });

    this.marketInsightsGenerator.on('insight:generated', (insight) => {
      this.logger.info('New market insight generated:', insight.id);
      this.emit('insight:generated', insight);
    });
  }

  /**
   * Start WebSocket server for real-time updates
   */
  private async startWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsServer = new WebSocket.Server({ port: this.config.websocket.port });
        
        this.wsServer.on('connection', (ws) => {
          this.connectedClients.add(ws);
          this.logger.debug('Client connected to analytics WebSocket');
          
          ws.on('close', () => {
            this.connectedClients.delete(ws);
            this.logger.debug('Client disconnected from analytics WebSocket');
          });

          ws.on('error', (error) => {
            this.logger.error('WebSocket client error:', error);
            this.connectedClients.delete(ws);
          });
        });

        this.wsServer.on('listening', () => {
          this.logger.info(`WebSocket server listening on port ${this.config.websocket.port}`);
          resolve();
        });

        this.wsServer.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start aggregation scheduler
   */
  private startAggregationScheduler(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.usageAggregator.performAggregation();
        this.logger.debug('Aggregation completed');
      } catch (error) {
        this.logger.error('Aggregation failed:', error);
      }
    }, this.config.analytics.aggregationInterval);
  }

  /**
   * Start market insights scheduler
   */
  private startInsightsScheduler(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const insights = await this.marketInsightsGenerator.generateInsights();
        
        for (const insight of insights) {
          await this.storeInsight(insight);
          this.broadcastUpdate('insight', insight);
        }
        
        this.logger.debug(`Generated ${insights.length} market insights`);
      } catch (error) {
        this.logger.error('Market insights generation failed:', error);
      }
    }, this.config.analytics.insightGenerationInterval);
  }

  /**
   * Store usage pattern in database
   */
  private async storePattern(pattern: UsagePattern): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('usage_patterns')
        .insert({
          id: pattern.id,
          agent_id: pattern.agentId,
          pattern_type: pattern.type,
          capabilities: pattern.capabilities,
          frequency: pattern.frequency,
          confidence_score: pattern.confidenceScore,
          metadata: pattern.metadata,
          created_at: pattern.detectedAt.toISOString()
        });

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to store pattern:', error);
      throw error;
    }
  }

  /**
   * Store market insight in database
   */
  private async storeInsight(insight: MarketInsight): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('market_insights')
        .insert({
          id: insight.id,
          category: insight.category,
          title: insight.title,
          description: insight.description,
          impact_score: insight.impactScore,
          confidence_level: insight.confidenceLevel,
          supporting_data: insight.supportingData,
          recommendations: insight.recommendations,
          created_at: insight.generatedAt.toISOString()
        });

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to store insight:', error);
      throw error;
    }
  }

  /**
   * Check for pattern alerts
   */
  private async checkForAlerts(event: AgentUsageEvent, pattern?: UsagePattern): Promise<PatternAlert | null> {
    try {
      // Check for anomalies
      if (event.executionTime > 10000) { // 10 seconds
        return {
          id: `alert-${Date.now()}`,
          type: 'performance_anomaly',
          severity: 'warning',
          message: `Agent ${event.agentId} execution time exceeded threshold: ${event.executionTime}ms`,
          eventId: event.eventId,
          agentId: event.agentId,
          detectedAt: new Date(),
          metadata: { executionTime: event.executionTime }
        };
      }

      // Check for unusual usage patterns
      if (pattern && pattern.confidenceScore < 0.3) {
        return {
          id: `alert-${Date.now()}`,
          type: 'unusual_pattern',
          severity: 'info',
          message: `Unusual usage pattern detected for agent ${event.agentId}`,
          eventId: event.eventId,
          agentId: event.agentId,
          detectedAt: new Date(),
          metadata: { patternId: pattern.id, confidence: pattern.confidenceScore }
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to check for alerts:', error);
      return null;
    }
  }

  /**
   * Broadcast updates to connected clients
   */
  private broadcastUpdate(type: string, data: any): void {
    if (this.connectedClients.size === 0) return;

    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    this.connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Get active agents count
   */
  private async getActiveAgentsCount(): Promise<number> {
    try {
      const activeAgents = await this.redis.scard('active_agents');
      return activeAgents;
    } catch (error) {
      this.logger.error('Failed to get active agents count:', error);
      return 0;
    }
  }

  /**
   * Get service health status
   */
  public getHealthStatus(): { status: string; uptime: number; connectedClients: number } {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      uptime: process.uptime(),
      connectedClients: this.connectedClients.size
    };
  }
}

/**
 * Default configuration
 */
export const defaultConfig: Partial<AgentUsageAnalyticsConfig> = {
  analytics: {
    aggregationInterval: 60000, // 1 minute
    patternDetectionThreshold: 0.7,
    trendAnalysisWindow: 24, // 24 hours
    insightGenerationInterval: 300000 // 5 minutes
  },
  websocket: {
    port: 8080
  }
};

/**
 * Factory function to create analytics service
 */
export const createAgentUsageAnalyticsService = (config: AgentUsageAnalyticsConfig): AgentUsageAnalyticsService => {
  return new AgentUsageAnalyticsService({ ...defaultConfig, ...config });
};

export default AgentUsageAnalyticsService;
export * from './types';
```