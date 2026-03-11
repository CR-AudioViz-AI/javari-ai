import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { Queue } from 'bull';

/**
 * Team Performance Monitoring Microservice
 * Real-time monitoring of team efficiency, bottlenecks, and resource utilization
 * with automated alerting and performance optimization suggestions
 */

// Validation Schemas
const TeamMetricsSchema = z.object({
  teamId: z.string().uuid(),
  timestamp: z.date(),
  activeMembers: z.number().min(0),
  completedTasks: z.number().min(0),
  averageResponseTime: z.number().min(0),
  resourceUtilization: z.number().min(0).max(100),
  errorRate: z.number().min(0).max(100),
  throughput: z.number().min(0),
});

const AlertConfigSchema = z.object({
  teamId: z.string().uuid(),
  thresholds: z.object({
    responseTime: z.number().min(0),
    errorRate: z.number().min(0).max(100),
    resourceUtilization: z.number().min(0).max(100),
    throughput: z.number().min(0),
  }),
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook'])),
  enabled: z.boolean(),
});

const OptimizationRequestSchema = z.object({
  teamId: z.string().uuid(),
  timeframe: z.enum(['1h', '24h', '7d', '30d']),
  includeRecommendations: z.boolean().default(true),
});

// Type Definitions
export type TeamMetrics = z.infer<typeof TeamMetricsSchema>;
export type AlertConfig = z.infer<typeof AlertConfigSchema>;
export type OptimizationRequest = z.infer<typeof OptimizationRequestSchema>;

export interface PerformanceAlert {
  id: string;
  teamId: string;
  type: 'bottleneck' | 'resource_usage' | 'error_rate' | 'response_time';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata: Record<string, any>;
}

export interface BottleneckDetection {
  teamId: string;
  type: 'cpu' | 'memory' | 'network' | 'task_queue' | 'dependency';
  location: string;
  impact: number;
  suggestions: string[];
  timestamp: Date;
}

export interface OptimizationRecommendation {
  teamId: string;
  category: 'resource' | 'workflow' | 'automation' | 'scaling';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImprovement: number;
  implementationEffort: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
}

export interface TeamEfficiencyMetrics {
  teamId: string;
  period: string;
  efficiency: number;
  productivity: number;
  qualityScore: number;
  collaborationIndex: number;
  burnoutRisk: number;
  trends: {
    efficiency: number;
    productivity: number;
    quality: number;
  };
}

/**
 * Metrics Collection Service
 * Collects and aggregates team performance metrics in real-time
 */
export class MetricsCollector {
  private supabase: SupabaseClient;
  private redis: Redis;
  private eventEmitter: EventEmitter;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Collect team metrics and store in database
   */
  async collectMetrics(metrics: TeamMetrics): Promise<void> {
    try {
      // Validate metrics
      const validatedMetrics = TeamMetricsSchema.parse(metrics);

      // Store in Supabase
      const { error } = await this.supabase
        .from('team_metrics')
        .insert({
          team_id: validatedMetrics.teamId,
          timestamp: validatedMetrics.timestamp.toISOString(),
          active_members: validatedMetrics.activeMembers,
          completed_tasks: validatedMetrics.completedTasks,
          average_response_time: validatedMetrics.averageResponseTime,
          resource_utilization: validatedMetrics.resourceUtilization,
          error_rate: validatedMetrics.errorRate,
          throughput: validatedMetrics.throughput,
        });

      if (error) throw error;

      // Cache in Redis for real-time access
      const cacheKey = `metrics:${validatedMetrics.teamId}:latest`;
      await this.redis.setex(
        cacheKey,
        300, // 5 minutes TTL
        JSON.stringify(validatedMetrics)
      );

      // Emit event for real-time updates
      this.eventEmitter.emit('metricsCollected', validatedMetrics);
    } catch (error) {
      throw new Error(`Failed to collect metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get latest metrics for a team
   */
  async getLatestMetrics(teamId: string): Promise<TeamMetrics | null> {
    try {
      // Try cache first
      const cacheKey = `metrics:${teamId}:latest`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to database
      const { data, error } = await this.supabase
        .from('team_metrics')
        .select('*')
        .eq('team_id', teamId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        teamId: data.team_id,
        timestamp: new Date(data.timestamp),
        activeMembers: data.active_members,
        completedTasks: data.completed_tasks,
        averageResponseTime: data.average_response_time,
        resourceUtilization: data.resource_utilization,
        errorRate: data.error_rate,
        throughput: data.throughput,
      };
    } catch (error) {
      throw new Error(`Failed to get latest metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsUpdate(callback: (metrics: TeamMetrics) => void): void {
    this.eventEmitter.on('metricsCollected', callback);
  }
}

/**
 * Bottleneck Detection Service
 * Identifies performance bottlenecks and their impact
 */
export class BottleneckDetector {
  private metricsCollector: MetricsCollector;
  private redis: Redis;

  constructor(metricsCollector: MetricsCollector, redis: Redis) {
    this.metricsCollector = metricsCollector;
    this.redis = redis;
  }

  /**
   * Analyze metrics to detect bottlenecks
   */
  async detectBottlenecks(teamId: string): Promise<BottleneckDetection[]> {
    try {
      const metrics = await this.metricsCollector.getLatestMetrics(teamId);
      if (!metrics) return [];

      const bottlenecks: BottleneckDetection[] = [];

      // CPU bottleneck detection
      if (metrics.resourceUtilization > 90) {
        bottlenecks.push({
          teamId,
          type: 'cpu',
          location: 'Team resource utilization',
          impact: (metrics.resourceUtilization - 90) / 10,
          suggestions: [
            'Scale up compute resources',
            'Optimize resource-intensive tasks',
            'Implement task scheduling',
          ],
          timestamp: new Date(),
        });
      }

      // Response time bottleneck
      if (metrics.averageResponseTime > 5000) {
        bottlenecks.push({
          teamId,
          type: 'network',
          location: 'Team response times',
          impact: Math.min((metrics.averageResponseTime - 5000) / 10000, 1),
          suggestions: [
            'Optimize API endpoints',
            'Implement caching',
            'Review database queries',
          ],
          timestamp: new Date(),
        });
      }

      // Task queue bottleneck
      const queueDepth = await this.getTaskQueueDepth(teamId);
      if (queueDepth > 100) {
        bottlenecks.push({
          teamId,
          type: 'task_queue',
          location: 'Task processing queue',
          impact: Math.min(queueDepth / 1000, 1),
          suggestions: [
            'Add more workers',
            'Optimize task processing',
            'Implement task prioritization',
          ],
          timestamp: new Date(),
        });
      }

      // Cache results
      const cacheKey = `bottlenecks:${teamId}:latest`;
      await this.redis.setex(cacheKey, 60, JSON.stringify(bottlenecks));

      return bottlenecks;
    } catch (error) {
      throw new Error(`Failed to detect bottlenecks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get task queue depth for bottleneck analysis
   */
  private async getTaskQueueDepth(teamId: string): Promise<number> {
    // Simulate queue depth check - would integrate with actual queue system
    const cacheKey = `queue:${teamId}:depth`;
    const depth = await this.redis.get(cacheKey);
    return depth ? parseInt(depth, 10) : 0;
  }
}

/**
 * Resource Utilization Tracking Service
 * Monitors and tracks resource usage patterns
 */
export class ResourceUtilizationTracker {
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Track resource utilization
   */
  async trackUtilization(teamId: string, resources: Record<string, number>): Promise<void> {
    try {
      const timestamp = new Date();

      // Store in database
      const { error } = await this.supabase
        .from('resource_utilization')
        .insert({
          team_id: teamId,
          timestamp: timestamp.toISOString(),
          cpu_usage: resources.cpu || 0,
          memory_usage: resources.memory || 0,
          network_usage: resources.network || 0,
          storage_usage: resources.storage || 0,
        });

      if (error) throw error;

      // Update real-time cache
      const cacheKey = `resources:${teamId}:current`;
      await this.redis.setex(cacheKey, 60, JSON.stringify({
        teamId,
        timestamp,
        ...resources,
      }));
    } catch (error) {
      throw new Error(`Failed to track utilization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get resource utilization trends
   */
  async getUtilizationTrends(teamId: string, timeframe: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('resource_utilization')
        .select('*')
        .eq('team_id', teamId)
        .gte('timestamp', this.getTimeframeStart(timeframe))
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw new Error(`Failed to get utilization trends: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getTimeframeStart(timeframe: string): string {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }
  }
}

/**
 * Alert Management Service
 * Manages performance alerts and notifications
 */
export class AlertManager {
  private supabase: SupabaseClient;
  private redis: Redis;
  private eventEmitter: EventEmitter;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create performance alert
   */
  async createAlert(alert: Omit<PerformanceAlert, 'id'>): Promise<PerformanceAlert> {
    try {
      const alertId = crypto.randomUUID();
      const fullAlert: PerformanceAlert = {
        id: alertId,
        ...alert,
      };

      // Store in database
      const { error } = await this.supabase
        .from('performance_alerts')
        .insert({
          id: alertId,
          team_id: alert.teamId,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          resolved: false,
          metadata: alert.metadata,
        });

      if (error) throw error;

      // Cache active alerts
      const cacheKey = `alerts:${alert.teamId}:active`;
      await this.redis.sadd(cacheKey, alertId);
      await this.redis.expire(cacheKey, 3600); // 1 hour TTL

      // Emit alert event
      this.eventEmitter.emit('alertCreated', fullAlert);

      return fullAlert;
    } catch (error) {
      throw new Error(`Failed to create alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active alerts for team
   */
  async getActiveAlerts(teamId: string): Promise<PerformanceAlert[]> {
    try {
      const { data, error } = await this.supabase
        .from('performance_alerts')
        .select('*')
        .eq('team_id', teamId)
        .eq('resolved', false)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(alert => ({
        id: alert.id,
        teamId: alert.team_id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: new Date(alert.timestamp),
        resolved: alert.resolved,
        metadata: alert.metadata || {},
      }));
    } catch (error) {
      throw new Error(`Failed to get active alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('performance_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      // Remove from active alerts cache
      const { data: alert } = await this.supabase
        .from('performance_alerts')
        .select('team_id')
        .eq('id', alertId)
        .single();

      if (alert) {
        const cacheKey = `alerts:${alert.team_id}:active`;
        await this.redis.srem(cacheKey, alertId);
      }

      this.eventEmitter.emit('alertResolved', alertId);
    } catch (error) {
      throw new Error(`Failed to resolve alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to alert events
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.eventEmitter.on('alertCreated', callback);
  }
}

/**
 * Optimization Engine
 * Generates performance optimization recommendations
 */
export class OptimizationEngine {
  private metricsCollector: MetricsCollector;
  private bottleneckDetector: BottleneckDetector;
  private utilizationTracker: ResourceUtilizationTracker;

  constructor(
    metricsCollector: MetricsCollector,
    bottleneckDetector: BottleneckDetector,
    utilizationTracker: ResourceUtilizationTracker
  ) {
    this.metricsCollector = metricsCollector;
    this.bottleneckDetector = bottleneckDetector;
    this.utilizationTracker = utilizationTracker;
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(request: OptimizationRequest): Promise<OptimizationRecommendation[]> {
    try {
      const validatedRequest = OptimizationRequestSchema.parse(request);
      const recommendations: OptimizationRecommendation[] = [];

      // Get current metrics and bottlenecks
      const metrics = await this.metricsCollector.getLatestMetrics(validatedRequest.teamId);
      const bottlenecks = await this.bottleneckDetector.detectBottlenecks(validatedRequest.teamId);
      const trends = await this.utilizationTracker.getUtilizationTrends(
        validatedRequest.teamId,
        validatedRequest.timeframe
      );

      if (!metrics) return recommendations;

      // Resource optimization recommendations
      if (metrics.resourceUtilization > 80) {
        recommendations.push({
          teamId: validatedRequest.teamId,
          category: 'resource',
          priority: 'high',
          title: 'Scale Up Resources',
          description: 'Team resource utilization is consistently high. Consider scaling up compute resources.',
          expectedImprovement: 25,
          implementationEffort: 'medium',
          metadata: {
            currentUtilization: metrics.resourceUtilization,
            recommendedIncrease: '20-30%',
          },
        });
      }

      // Workflow optimization
      if (metrics.errorRate > 5) {
        recommendations.push({
          teamId: validatedRequest.teamId,
          category: 'workflow',
          priority: 'high',
          title: 'Improve Error Handling',
          description: 'High error rate detected. Review error handling and implement better monitoring.',
          expectedImprovement: 40,
          implementationEffort: 'high',
          metadata: {
            currentErrorRate: metrics.errorRate,
            targetErrorRate: '<2%',
          },
        });
      }

      // Automation recommendations
      if (trends.length > 10 && this.detectRepetitivePatterns(trends)) {
        recommendations.push({
          teamId: validatedRequest.teamId,
          category: 'automation',
          priority: 'medium',
          title: 'Automate Repetitive Tasks',
          description: 'Detected repetitive patterns in team activities. Consider implementing automation.',
          expectedImprovement: 30,
          implementationEffort: 'medium',
          metadata: {
            detectedPatterns: 'Task scheduling, Resource allocation',
            automationOpportunities: ['CI/CD', 'Testing', 'Deployment'],
          },
        });
      }

      // Scaling recommendations based on bottlenecks
      for (const bottleneck of bottlenecks) {
        if (bottleneck.impact > 0.7) {
          recommendations.push({
            teamId: validatedRequest.teamId,
            category: 'scaling',
            priority: 'high',
            title: `Address ${bottleneck.type} Bottleneck`,
            description: `Critical bottleneck detected in ${bottleneck.location}. Immediate action required.`,
            expectedImprovement: Math.round(bottleneck.impact * 50),
            implementationEffort: 'high',
            metadata: {
              bottleneckType: bottleneck.type,
              location: bottleneck.location,
              suggestions: bottleneck.suggestions,
            },
          });
        }
      }

      return recommendations;
    } catch (error) {
      throw new Error(`Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect repetitive patterns in utilization data
   */
  private detectRepetitivePatterns(trends: any[]): boolean {
    if (trends.length < 10) return false;
    
    // Simple pattern detection - could be enhanced with ML
    const cpuValues = trends.map(t => t.cpu_usage || 0);
    const pattern = cpuValues.slice(0, 5);
    
    for (let i = 5; i < cpuValues.length - 5; i++) {
      const segment = cpuValues.slice(i, i + 5);
      const similarity = this.calculateSimilarity(pattern, segment);
      if (similarity > 0.8) return true;
    }
    
    return false;
  }

  /**
   * Calculate similarity between two arrays
   */
  private calculateSimilarity(arr1: number[], arr2: number[]): number {
    if (arr1.length !== arr2.length) return 0;
    
    const differences = arr1.map((val, i) => Math.abs(val - arr2[i]));
    const avgDifference = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
    
    return Math.max(0, 1 - avgDifference / 100);
  }
}

/**
 * Team Efficiency Analyzer
 * Analyzes team efficiency and provides insights
 */
export class TeamEfficiencyAnalyzer {
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Analyze team efficiency
   */
  async analyzeEfficiency(teamId: string, period: string): Promise<TeamEfficiencyMetrics> {
    try {
      const cacheKey = `efficiency:${teamId}:${period}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached