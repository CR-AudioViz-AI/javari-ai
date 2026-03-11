```typescript
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Interface for agent health status
 */
export interface AgentHealth {
  agentId: string;
  status: 'online' | 'offline' | 'busy' | 'idle' | 'error';
  lastHeartbeat: Date;
  responseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  errorRate: number;
  throughput: number;
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
  agentId: string;
  timestamp: Date;
  requestsPerSecond: number;
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  queueLength: number;
  processingTime: number;
}

/**
 * Interface for workload distribution analysis
 */
export interface WorkloadAnalysis {
  totalAgents: number;
  activeAgents: number;
  averageLoad: number;
  imbalanceScore: number;
  recommendations: string[];
  criticalAgents: string[];
}

/**
 * Interface for health alerts
 */
export interface HealthAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  agentId?: string;
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  resolved: boolean;
  suggestions: string[];
}

/**
 * Interface for recovery recommendations
 */
export interface RecoveryRecommendation {
  id: string;
  type: 'scale_up' | 'scale_down' | 'redistribute' | 'restart' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedImpact: string;
  automatable: boolean;
  steps: string[];
}

/**
 * Interface for health thresholds
 */
export interface HealthThresholds {
  responseTimeWarning: number;
  responseTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  cpuUsageWarning: number;
  cpuUsageCritical: number;
  memoryUsageWarning: number;
  memoryUsageCritical: number;
  heartbeatTimeout: number;
}

/**
 * Interface for monitoring configuration
 */
export interface MonitoringConfig {
  thresholds: HealthThresholds;
  alertingEnabled: boolean;
  autoRecoveryEnabled: boolean;
  metricsRetentionDays: number;
  aggregationInterval: number;
  websocketPort: number;
  redisUrl: string;
}

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: MonitoringConfig = {
  thresholds: {
    responseTimeWarning: 1000,
    responseTimeCritical: 3000,
    errorRateWarning: 0.05,
    errorRateCritical: 0.1,
    cpuUsageWarning: 0.7,
    cpuUsageCritical: 0.9,
    memoryUsageWarning: 0.8,
    memoryUsageCritical: 0.95,
    heartbeatTimeout: 30000,
  },
  alertingEnabled: true,
  autoRecoveryEnabled: false,
  metricsRetentionDays: 30,
  aggregationInterval: 10000,
  websocketPort: 8080,
  redisUrl: 'redis://localhost:6379',
};

/**
 * Agent metrics collector for gathering performance data
 */
export class AgentMetricsCollector {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Collect metrics from an agent
   */
  async collectMetrics(agentId: string): Promise<PerformanceMetrics> {
    try {
      // Simulate metric collection - in real implementation, this would
      // make API calls to the agent or read from monitoring endpoints
      const metrics: PerformanceMetrics = {
        agentId,
        timestamp: new Date(),
        requestsPerSecond: Math.random() * 100,
        averageResponseTime: Math.random() * 2000,
        successRate: 0.95 + Math.random() * 0.05,
        errorCount: Math.floor(Math.random() * 10),
        queueLength: Math.floor(Math.random() * 20),
        processingTime: Math.random() * 500,
      };

      // Store metrics in local cache
      if (!this.metrics.has(agentId)) {
        this.metrics.set(agentId, []);
      }
      this.metrics.get(agentId)!.push(metrics);

      // Persist to database
      await this.supabase
        .from('performance_metrics')
        .insert(metrics);

      return metrics;
    } catch (error) {
      throw new Error(`Failed to collect metrics for agent ${agentId}: ${error}`);
    }
  }

  /**
   * Get historical metrics for an agent
   */
  getHistoricalMetrics(agentId: string, limit = 100): PerformanceMetrics[] {
    const agentMetrics = this.metrics.get(agentId) || [];
    return agentMetrics.slice(-limit);
  }
}

/**
 * Workload distribution analyzer for load balancing insights
 */
export class WorkloadDistributionAnalyzer {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Analyze current workload distribution
   */
  async analyzeDistribution(agentHealthMap: Map<string, AgentHealth>): Promise<WorkloadAnalysis> {
    try {
      const agents = Array.from(agentHealthMap.values());
      const activeAgents = agents.filter(a => a.status === 'online' || a.status === 'busy');
      
      const loads = activeAgents.map(a => a.activeConnections);
      const averageLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length || 0;
      
      // Calculate imbalance score (coefficient of variation)
      const variance = loads.reduce((sum, load) => sum + Math.pow(load - averageLoad, 2), 0) / loads.length;
      const standardDeviation = Math.sqrt(variance);
      const imbalanceScore = averageLoad > 0 ? standardDeviation / averageLoad : 0;

      // Identify critical agents (high load or poor performance)
      const criticalAgents = agents
        .filter(a => 
          a.activeConnections > averageLoad * 1.5 || 
          a.responseTime > 2000 || 
          a.errorRate > 0.1
        )
        .map(a => a.agentId);

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (imbalanceScore > 0.5) {
        recommendations.push('Consider redistributing workload - high imbalance detected');
      }
      
      if (activeAgents.length < 2) {
        recommendations.push('Scale up - insufficient agent redundancy');
      }
      
      if (averageLoad > 50) {
        recommendations.push('High average load detected - consider scaling up');
      }
      
      if (criticalAgents.length > 0) {
        recommendations.push(`${criticalAgents.length} agents require attention`);
      }

      return {
        totalAgents: agents.length,
        activeAgents: activeAgents.length,
        averageLoad,
        imbalanceScore,
        recommendations,
        criticalAgents,
      };
    } catch (error) {
      throw new Error(`Failed to analyze workload distribution: ${error}`);
    }
  }
}

/**
 * Alerting engine for threshold-based notifications
 */
export class AlertingEngine extends EventEmitter {
  private alerts: Map<string, HealthAlert> = new Map();
  private thresholds: HealthThresholds;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, thresholds: HealthThresholds) {
    super();
    this.supabase = supabase;
    this.thresholds = thresholds;
  }

  /**
   * Check agent health against thresholds and generate alerts
   */
  async checkThresholds(agentHealth: AgentHealth): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = [];

    try {
      // Check response time
      if (agentHealth.responseTime > this.thresholds.responseTimeCritical) {
        alerts.push(this.createAlert(
          'critical',
          agentHealth.agentId,
          'Critical response time exceeded',
          this.thresholds.responseTimeCritical,
          agentHealth.responseTime,
          ['Restart agent', 'Scale up infrastructure', 'Check network connectivity']
        ));
      } else if (agentHealth.responseTime > this.thresholds.responseTimeWarning) {
        alerts.push(this.createAlert(
          'warning',
          agentHealth.agentId,
          'Response time warning threshold exceeded',
          this.thresholds.responseTimeWarning,
          agentHealth.responseTime,
          ['Monitor closely', 'Check resource usage']
        ));
      }

      // Check error rate
      if (agentHealth.errorRate > this.thresholds.errorRateCritical) {
        alerts.push(this.createAlert(
          'critical',
          agentHealth.agentId,
          'Critical error rate exceeded',
          this.thresholds.errorRateCritical,
          agentHealth.errorRate,
          ['Investigate logs', 'Restart agent', 'Rollback recent changes']
        ));
      }

      // Check CPU usage
      if (agentHealth.cpuUsage > this.thresholds.cpuUsageCritical) {
        alerts.push(this.createAlert(
          'critical',
          agentHealth.agentId,
          'Critical CPU usage exceeded',
          this.thresholds.cpuUsageCritical,
          agentHealth.cpuUsage,
          ['Scale up resources', 'Optimize processes', 'Load balance traffic']
        ));
      }

      // Check memory usage
      if (agentHealth.memoryUsage > this.thresholds.memoryUsageCritical) {
        alerts.push(this.createAlert(
          'critical',
          agentHealth.agentId,
          'Critical memory usage exceeded',
          this.thresholds.memoryUsageCritical,
          agentHealth.memoryUsage,
          ['Restart agent', 'Increase memory allocation', 'Check for memory leaks']
        ));
      }

      // Store alerts in database
      for (const alert of alerts) {
        await this.supabase.from('health_alerts').insert(alert);
        this.alerts.set(alert.id, alert);
        this.emit('alert', alert);
      }

      return alerts;
    } catch (error) {
      throw new Error(`Failed to check thresholds: ${error}`);
    }
  }

  /**
   * Create a health alert
   */
  private createAlert(
    type: 'warning' | 'critical' | 'info',
    agentId: string,
    message: string,
    threshold: number,
    currentValue: number,
    suggestions: string[]
  ): HealthAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      agentId,
      message,
      threshold,
      currentValue,
      timestamp: new Date(),
      resolved: false,
      suggestions,
    };
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alert = this.alerts.get(alertId);
      if (alert) {
        alert.resolved = true;
        await this.supabase
          .from('health_alerts')
          .update({ resolved: true })
          .eq('id', alertId);
        
        this.emit('alertResolved', alert);
      }
    } catch (error) {
      throw new Error(`Failed to resolve alert ${alertId}: ${error}`);
    }
  }
}

/**
 * Recovery recommendation engine for automated suggestions
 */
export class RecoveryRecommendationEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Generate recovery recommendations based on system state
   */
  async generateRecommendations(
    workloadAnalysis: WorkloadAnalysis,
    alerts: HealthAlert[]
  ): Promise<RecoveryRecommendation[]> {
    const recommendations: RecoveryRecommendation[] = [];

    try {
      // High imbalance - redistribute workload
      if (workloadAnalysis.imbalanceScore > 0.5) {
        recommendations.push({
          id: `rec_${Date.now()}_redistribute`,
          type: 'redistribute',
          priority: 'high',
          description: 'Redistribute workload to balance load across agents',
          estimatedImpact: 'Improved response times and reduced hotspots',
          automatable: true,
          steps: [
            'Identify overloaded agents',
            'Redirect traffic to underutilized agents',
            'Monitor load distribution',
          ],
        });
      }

      // Low agent count - scale up
      if (workloadAnalysis.activeAgents < 2) {
        recommendations.push({
          id: `rec_${Date.now()}_scaleup`,
          type: 'scale_up',
          priority: 'critical',
          description: 'Scale up agent instances for redundancy',
          estimatedImpact: 'Improved availability and fault tolerance',
          automatable: true,
          steps: [
            'Launch additional agent instances',
            'Register new agents with load balancer',
            'Verify health checks',
          ],
        });
      }

      // High average load - scale up
      if (workloadAnalysis.averageLoad > 50) {
        recommendations.push({
          id: `rec_${Date.now()}_capacity`,
          type: 'scale_up',
          priority: 'high',
          description: 'Increase capacity to handle current load',
          estimatedImpact: 'Reduced response times and improved throughput',
          automatable: true,
          steps: [
            'Calculate required capacity',
            'Launch additional instances',
            'Update load balancer configuration',
          ],
        });
      }

      // Critical alerts - immediate action needed
      const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.resolved);
      if (criticalAlerts.length > 0) {
        recommendations.push({
          id: `rec_${Date.now()}_critical`,
          type: 'restart',
          priority: 'critical',
          description: `Address ${criticalAlerts.length} critical alerts`,
          estimatedImpact: 'Restore system stability and performance',
          automatable: false,
          steps: [
            'Review critical alerts',
            'Implement suggested fixes',
            'Monitor system recovery',
          ],
        });
      }

      // Store recommendations
      for (const rec of recommendations) {
        await this.supabase.from('recovery_recommendations').insert(rec);
      }

      return recommendations;
    } catch (error) {
      throw new Error(`Failed to generate recommendations: ${error}`);
    }
  }
}

/**
 * Metrics aggregator for statistical analysis
 */
export class MetricsAggregator {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Aggregate metrics for analysis
   */
  async aggregateMetrics(
    agentId?: string,
    timeRange = 3600000 // 1 hour in milliseconds
  ): Promise<any> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeRange);

      let query = this.supabase
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', endTime.toISOString());

      if (agentId) {
        query = query.eq('agentId', agentId);
      }

      const { data: metrics, error } = await query;

      if (error) {
        throw error;
      }

      if (!metrics || metrics.length === 0) {
        return {
          count: 0,
          averageResponseTime: 0,
          averageSuccessRate: 0,
          totalErrors: 0,
          throughput: 0,
        };
      }

      // Calculate aggregated statistics
      const count = metrics.length;
      const totalResponseTime = metrics.reduce((sum, m) => sum + m.averageResponseTime, 0);
      const totalSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0);
      const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
      const totalRequests = metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0);

      return {
        count,
        averageResponseTime: totalResponseTime / count,
        averageSuccessRate: totalSuccessRate / count,
        totalErrors,
        throughput: totalRequests / count,
        timeRange: timeRange / 1000, // Convert to seconds
      };
    } catch (error) {
      throw new Error(`Failed to aggregate metrics: ${error}`);
    }
  }
}

/**
 * Failover coordinator for automatic recovery actions
 */
export class FailoverCoordinator extends EventEmitter {
  private supabase: SupabaseClient;
  private autoRecoveryEnabled: boolean;

  constructor(supabase: SupabaseClient, autoRecoveryEnabled = false) {
    super();
    this.supabase = supabase;
    this.autoRecoveryEnabled = autoRecoveryEnabled;
  }

  /**
   * Execute failover for a failed agent
   */
  async executeFailover(failedAgentId: string): Promise<void> {
    if (!this.autoRecoveryEnabled) {
      this.emit('failoverRequested', { agentId: failedAgentId });
      return;
    }

    try {
      // Mark agent as failed
      await this.supabase
        .from('agent_health')
        .update({ status: 'error' })
        .eq('agentId', failedAgentId);

      // Find healthy agents to redistribute workload
      const { data: healthyAgents } = await this.supabase
        .from('agent_health')
        .select('agentId')
        .eq('status', 'online');

      if (!healthyAgents || healthyAgents.length === 0) {
        throw new Error('No healthy agents available for failover');
      }

      // Redistribute workload (simplified implementation)
      this.emit('workloadRedistributed', {
        failedAgent: failedAgentId,
        healthyAgents: healthyAgents.map(a => a.agentId),
      });

      // Log failover action
      await this.supabase.from('failover_actions').insert({
        failedAgentId,
        timestamp: new Date().toISOString(),
        action: 'workload_redistributed',
        targetAgents: healthyAgents.map(a => a.agentId),
      });

    } catch (error) {
      throw new Error(`Failed to execute failover for agent ${failedAgentId}: ${error}`);
    }
  }
}

/**
 * Main health monitoring service
 */
export class HealthMonitoringService extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private wsServer?: WebSocket.Server;
  private realtimeChannel?: RealtimeChannel;
  
  private config: MonitoringConfig;
  private agentHealthMap: Map<string, AgentHealth> = new Map();
  
  // Service components
  private metricsCollector: AgentMetricsCollector;
  private workloadAnalyzer: WorkloadDistributionAnalyzer;
  private alertingEngine: AlertingEngine;
  private recommendationEngine: RecoveryRecommendationEngine;
  private metricsAggregator: MetricsAggregator;
  private failoverCoordinator: FailoverCoordinator;
  
  private monitoringInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<MonitoringConfig> = {}
  ) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(this.config.redisUrl);
    
    // Initialize components
    this.metricsCollector = new AgentMetricsCollector(this.supabase);
    this.workloadAnalyzer = new WorkloadDistributionAnalyzer(this.supabase);
    this.alertingEngine = new AlertingEngine(this.supabase, this.config.thresholds);
    this.recommendationEngine = new RecoveryRecommendationEngine(this.supabase);
    this.metricsAggregator = new MetricsAggregator(this.supabase);
    this.failoverCoordinator = new FailoverCoordinator(this.supabase, this.config.autoRecoveryEnabled);
    
    this.setupEventHandlers();
  }

  /**
   * Start the monitoring service
   */
  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        throw new Error('Monitoring service is already running');
      }

      // Initialize WebSocket server
      await this.initializeWebSocket();
      
      // Setup Supabase real-time subscriptions
      await this.initializeRealtimeSubscriptions();
      
      // Start monitoring loop
      this.startMonitoringLoop();
      
      this.isRunning = true;
      this.emit('started');
      
      console.log('Health monitoring service started');
    } catch (error) {
      throw new Error(`Failed to start monitoring service: ${error}`);
    }
  }

  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      if (this.realtimeChannel) {
        await this.supabase.removeChannel(this.realtimeChannel);
      }