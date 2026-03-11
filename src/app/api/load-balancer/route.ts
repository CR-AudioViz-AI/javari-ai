```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Redis from 'ioredis';

// Types and Interfaces
interface LoadBalancerConfig {
  id: string;
  name: string;
  algorithm: 'round_robin' | 'weighted_round_robin' | 'least_connections' | 'ip_hash' | 'predictive';
  health_check_interval: number;
  failure_threshold: number;
  recovery_threshold: number;
  sticky_sessions: boolean;
  created_at: string;
  updated_at: string;
}

interface NodeMetrics {
  node_id: string;
  cpu_usage: number;
  memory_usage: number;
  active_connections: number;
  response_time: number;
  error_rate: number;
  throughput: number;
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

interface RoutingPolicy {
  id: string;
  load_balancer_id: string;
  node_id: string;
  weight: number;
  max_connections: number;
  backup: boolean;
  enabled: boolean;
  priority: number;
}

interface PredictiveAnalysis {
  node_id: string;
  predicted_load: number;
  confidence: number;
  recommendation: 'increase_weight' | 'decrease_weight' | 'maintain' | 'remove';
  factors: string[];
}

// Validation Schemas
const WeightUpdateSchema = z.object({
  node_id: z.string().uuid(),
  weight: z.number().min(0).max(100),
  reason: z.string().optional()
});

const PolicyUpdateSchema = z.object({
  load_balancer_id: z.string().uuid(),
  algorithm: z.enum(['round_robin', 'weighted_round_robin', 'least_connections', 'ip_hash', 'predictive']),
  health_check_interval: z.number().min(1000).max(300000),
  failure_threshold: z.number().min(1).max(10),
  recovery_threshold: z.number().min(1).max(10)
});

const HealthCheckSchema = z.object({
  nodes: z.array(z.string().uuid()).optional(),
  force_check: z.boolean().default(false)
});

// Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Redis Client
const redis = new Redis(process.env.REDIS_URL!);

class LoadBalancerController {
  private static instance: LoadBalancerController;
  private metricsCollector: MetricsCollector;
  private predictiveAnalyzer: PredictiveAnalyzer;
  private routingEngine: RoutingPolicyEngine;
  private weightCalculator: WeightCalculator;
  private healthChecker: HealthChecker;

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.predictiveAnalyzer = new PredictiveAnalyzer();
    this.routingEngine = new RoutingPolicyEngine();
    this.weightCalculator = new WeightCalculator();
    this.healthChecker = new HealthChecker();
  }

  static getInstance(): LoadBalancerController {
    if (!LoadBalancerController.instance) {
      LoadBalancerController.instance = new LoadBalancerController();
    }
    return LoadBalancerController.instance;
  }

  async getStatus(loadBalancerId?: string) {
    try {
      const query = supabase
        .from('load_balancers')
        .select(`
          *,
          routing_policies (*),
          node_metrics (*)
        `);

      if (loadBalancerId) {
        query.eq('id', loadBalancerId);
      }

      const { data: loadBalancers, error } = await query;

      if (error) throw error;

      const status = await Promise.all(
        loadBalancers.map(async (lb) => {
          const cachedMetrics = await redis.get(`lb:${lb.id}:metrics`);
          const realtimeMetrics = cachedMetrics 
            ? JSON.parse(cachedMetrics) 
            : await this.metricsCollector.getCurrentMetrics(lb.id);

          return {
            ...lb,
            current_metrics: realtimeMetrics,
            health_summary: await this.healthChecker.getHealthSummary(lb.id),
            predictive_insights: await this.predictiveAnalyzer.getInsights(lb.id)
          };
        })
      );

      return status;
    } catch (error) {
      throw new Error(`Failed to get load balancer status: ${error}`);
    }
  }

  async updateWeights(updates: z.infer<typeof WeightUpdateSchema>[]) {
    try {
      const results = await Promise.all(
        updates.map(async (update) => {
          // Validate current node status
          const nodeHealth = await this.healthChecker.checkNode(update.node_id);
          if (nodeHealth.status === 'unhealthy' && update.weight > 0) {
            throw new Error(`Cannot assign weight to unhealthy node: ${update.node_id}`);
          }

          // Calculate optimal weight based on metrics
          const optimalWeight = await this.weightCalculator.calculateOptimalWeight(
            update.node_id,
            update.weight
          );

          // Update routing policy
          const { data, error } = await supabase
            .from('routing_policies')
            .update({
              weight: optimalWeight,
              updated_at: new Date().toISOString()
            })
            .eq('node_id', update.node_id)
            .select();

          if (error) throw error;

          // Cache the update
          await redis.setex(
            `lb:policy:${update.node_id}`,
            300,
            JSON.stringify({ weight: optimalWeight, timestamp: Date.now() })
          );

          // Trigger real-time update
          await supabase.realtime.channel('load-balancer-updates').send({
            type: 'broadcast',
            event: 'weight_updated',
            payload: {
              node_id: update.node_id,
              old_weight: data[0]?.weight,
              new_weight: optimalWeight,
              reason: update.reason || 'Manual update'
            }
          });

          return {
            node_id: update.node_id,
            old_weight: data[0]?.weight,
            new_weight: optimalWeight,
            status: 'updated'
          };
        })
      );

      return results;
    } catch (error) {
      throw new Error(`Failed to update weights: ${error}`);
    }
  }

  async updatePolicy(policyUpdate: z.infer<typeof PolicyUpdateSchema>) {
    try {
      // Validate policy configuration
      const isValid = await ConfigValidator.validatePolicy(policyUpdate);
      if (!isValid.valid) {
        throw new Error(`Invalid policy configuration: ${isValid.errors.join(', ')}`);
      }

      const { data, error } = await supabase
        .from('load_balancers')
        .update({
          ...policyUpdate,
          updated_at: new Date().toISOString()
        })
        .eq('id', policyUpdate.load_balancer_id)
        .select();

      if (error) throw error;

      // Update routing engine
      await this.routingEngine.updateAlgorithm(
        policyUpdate.load_balancer_id,
        policyUpdate.algorithm
      );

      // Clear relevant caches
      await redis.del(`lb:${policyUpdate.load_balancer_id}:*`);

      return data[0];
    } catch (error) {
      throw new Error(`Failed to update policy: ${error}`);
    }
  }

  async performHealthCheck(request: z.infer<typeof HealthCheckSchema>) {
    try {
      const results = await this.healthChecker.checkNodes(
        request.nodes,
        request.force_check
      );

      // Update node statuses based on health check results
      await Promise.all(
        results.map(async (result) => {
          if (result.status_changed) {
            await supabase
              .from('node_metrics')
              .upsert({
                node_id: result.node_id,
                health_status: result.status,
                last_check: new Date().toISOString(),
                response_time: result.response_time,
                error_rate: result.error_rate
              });

            // Trigger automatic weight adjustment for unhealthy nodes
            if (result.status === 'unhealthy') {
              await this.weightCalculator.adjustForUnhealthyNode(result.node_id);
            }
          }
        })
      );

      return results;
    } catch (error) {
      throw new Error(`Health check failed: ${error}`);
    }
  }
}

class MetricsCollector {
  async getCurrentMetrics(loadBalancerId: string): Promise<NodeMetrics[]> {
    const { data, error } = await supabase
      .from('node_metrics')
      .select('*')
      .eq('load_balancer_id', loadBalancerId)
      .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async streamMetrics(loadBalancerId: string, callback: (metrics: NodeMetrics[]) => void) {
    const subscription = supabase
      .channel(`metrics:${loadBalancerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'node_metrics',
          filter: `load_balancer_id=eq.${loadBalancerId}`
        },
        callback
      )
      .subscribe();

    return subscription;
  }
}

class PredictiveAnalyzer {
  async getInsights(loadBalancerId: string): Promise<PredictiveAnalysis[]> {
    try {
      // Simplified ML prediction - in production, use TensorFlow.js or external ML service
      const historicalData = await this.getHistoricalMetrics(loadBalancerId);
      const predictions: PredictiveAnalysis[] = [];

      for (const nodeData of historicalData) {
        const trend = this.calculateTrend(nodeData.metrics);
        const prediction = this.predictLoad(trend);

        predictions.push({
          node_id: nodeData.node_id,
          predicted_load: prediction.load,
          confidence: prediction.confidence,
          recommendation: this.generateRecommendation(prediction),
          factors: prediction.factors
        });
      }

      return predictions;
    } catch (error) {
      throw new Error(`Predictive analysis failed: ${error}`);
    }
  }

  private async getHistoricalMetrics(loadBalancerId: string) {
    const { data, error } = await supabase
      .from('node_metrics')
      .select('*')
      .eq('load_balancer_id', loadBalancerId)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Group by node_id
    const groupedData = data?.reduce((acc, metric) => {
      if (!acc[metric.node_id]) {
        acc[metric.node_id] = { node_id: metric.node_id, metrics: [] };
      }
      acc[metric.node_id].metrics.push(metric);
      return acc;
    }, {} as Record<string, { node_id: string; metrics: NodeMetrics[] }>);

    return Object.values(groupedData || {});
  }

  private calculateTrend(metrics: NodeMetrics[]) {
    if (metrics.length < 2) return { direction: 'stable', magnitude: 0 };

    const recent = metrics.slice(0, Math.ceil(metrics.length / 3));
    const older = metrics.slice(Math.floor(metrics.length * 2 / 3));

    const recentAvg = recent.reduce((sum, m) => sum + m.cpu_usage + m.memory_usage, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.cpu_usage + m.memory_usage, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    return {
      direction: change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable',
      magnitude: Math.abs(change)
    };
  }

  private predictLoad(trend: any) {
    // Simplified prediction logic
    let predictedLoad = 50; // Base load percentage
    let confidence = 0.7;
    const factors = ['historical_trend'];

    if (trend.direction === 'increasing') {
      predictedLoad += trend.magnitude * 100;
      factors.push('increasing_trend');
    } else if (trend.direction === 'decreasing') {
      predictedLoad -= trend.magnitude * 50;
      factors.push('decreasing_trend');
    }

    return {
      load: Math.max(0, Math.min(100, predictedLoad)),
      confidence,
      factors
    };
  }

  private generateRecommendation(prediction: any): PredictiveAnalysis['recommendation'] {
    if (prediction.load > 80) return 'decrease_weight';
    if (prediction.load < 20) return 'increase_weight';
    if (prediction.confidence < 0.5) return 'maintain';
    return 'maintain';
  }
}

class RoutingPolicyEngine {
  async updateAlgorithm(loadBalancerId: string, algorithm: LoadBalancerConfig['algorithm']) {
    // Cache the new algorithm
    await redis.setex(`lb:${loadBalancerId}:algorithm`, 3600, algorithm);

    // Trigger policy recalculation based on algorithm
    switch (algorithm) {
      case 'predictive':
        await this.enablePredictiveRouting(loadBalancerId);
        break;
      case 'weighted_round_robin':
        await this.recalculateWeights(loadBalancerId);
        break;
      default:
        await this.applyStandardAlgorithm(loadBalancerId, algorithm);
    }
  }

  private async enablePredictiveRouting(loadBalancerId: string) {
    // Implementation for predictive routing logic
    const analyzer = new PredictiveAnalyzer();
    const insights = await analyzer.getInsights(loadBalancerId);

    // Apply insights to routing weights
    const weightUpdates = insights.map(insight => ({
      node_id: insight.node_id,
      weight: this.calculatePredictiveWeight(insight),
      reason: `Predictive adjustment: ${insight.recommendation}`
    }));

    // Apply updates
    for (const update of weightUpdates) {
      await supabase
        .from('routing_policies')
        .update({ weight: update.weight })
        .eq('node_id', update.node_id);
    }
  }

  private calculatePredictiveWeight(insight: PredictiveAnalysis): number {
    const baseWeight = 50;
    const loadFactor = (100 - insight.predicted_load) / 100;
    const confidenceFactor = insight.confidence;

    return Math.max(0, Math.min(100, baseWeight * loadFactor * confidenceFactor));
  }

  private async recalculateWeights(loadBalancerId: string) {
    const metrics = await new MetricsCollector().getCurrentMetrics(loadBalancerId);
    const calculator = new WeightCalculator();

    for (const metric of metrics) {
      const optimalWeight = await calculator.calculateOptimalWeight(metric.node_id);
      await supabase
        .from('routing_policies')
        .update({ weight: optimalWeight })
        .eq('node_id', metric.node_id);
    }
  }

  private async applyStandardAlgorithm(loadBalancerId: string, algorithm: string) {
    // Reset to equal weights for round_robin, etc.
    if (algorithm === 'round_robin') {
      await supabase
        .from('routing_policies')
        .update({ weight: 100 })
        .eq('load_balancer_id', loadBalancerId);
    }
  }
}

class WeightCalculator {
  async calculateOptimalWeight(nodeId: string, targetWeight?: number): Promise<number> {
    const metrics = await this.getNodeMetrics(nodeId);
    if (!metrics) return targetWeight || 50;

    // Calculate weight based on performance metrics
    const cpuScore = Math.max(0, 100 - metrics.cpu_usage);
    const memoryScore = Math.max(0, 100 - metrics.memory_usage);
    const responseScore = Math.max(0, 100 - (metrics.response_time / 10));
    const errorScore = Math.max(0, 100 - (metrics.error_rate * 100));

    const performanceScore = (cpuScore + memoryScore + responseScore + errorScore) / 4;

    // If target weight provided, blend with performance score
    if (targetWeight !== undefined) {
      return Math.round((performanceScore * 0.7) + (targetWeight * 0.3));
    }

    return Math.round(performanceScore);
  }

  async adjustForUnhealthyNode(nodeId: string) {
    await supabase
      .from('routing_policies')
      .update({ weight: 0, enabled: false })
      .eq('node_id', nodeId);

    // Cache the adjustment
    await redis.setex(`lb:node:${nodeId}:unhealthy`, 300, 'true');
  }

  private async getNodeMetrics(nodeId: string): Promise<NodeMetrics | null> {
    const { data, error } = await supabase
      .from('node_metrics')
      .select('*')
      .eq('node_id', nodeId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  }
}

class HealthChecker {
  async checkNodes(nodeIds?: string[], forceCheck = false): Promise<any[]> {
    const query = supabase.from('routing_policies').select(`
      node_id,
      load_balancers!inner(health_check_interval, failure_threshold)
    `);

    if (nodeIds?.length) {
      query.in('node_id', nodeIds);
    }

    const { data: policies, error } = await query;
    if (error) throw error;

    const results = await Promise.all(
      policies.map(async (policy) => {
        const lastCheck = await redis.get(`health:${policy.node_id}:last_check`);
        const shouldCheck = forceCheck || 
          !lastCheck || 
          (Date.now() - parseInt(lastCheck)) > policy.load_balancers.health_check_interval;

        if (!shouldCheck) {
          return { node_id: policy.node_id, status: 'cached', status_changed: false };
        }

        return await this.checkNode(policy.node_id);
      })
    );

    return results;
  }

  async checkNode(nodeId: string): Promise<any> {
    try {
      // Simulate health check - in production, make actual HTTP requests to nodes
      const startTime = Date.now();
      
      // Get node endpoint from database
      const { data: node, error } = await supabase
        .from('load_balancer_nodes')
        .select('endpoint, health_check_path')
        .eq('id', nodeId)
        .single();

      if (error) throw error;

      // Perform health check
      const response = await fetch(`${node.endpoint}${node.health_check_path || '/health'}`, {
        method: 'GET',
        timeout: 5000
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok && responseTime < 5000;

      const currentStatus = isHealthy ? 'healthy' : 'unhealthy';
      const previousStatus = await redis.get(`health:${nodeId}:status`);
      const statusChanged = previousStatus !== currentStatus;

      // Update cache
      await redis.setex(`health:${nodeId}:status`, 300, currentStatus);
      await redis.setex(`health:${nodeId}:last_check`, 300, Date.now().toString());
      await redis.setex(`health:${nodeId}:response_time`, 300, responseTime.toString());

      return {
        node_id: nodeId,
        status: currentStatus,
        response_time: responseTime,
        error_rate: isHealthy ? 0 : 1,
        status_changed: statusChanged,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      await redis.setex(`health:${nodeId}:status`, 300, 'unhealthy');
      return {
        node_id: nodeId,
        status: 'unhealthy',
        response_time: 5000,
        error_rate: 1,
        status_changed: true,
        error: error.message
      };
    }
  }

  async getHealthSummary(loadBalancerId: string) {
    const { data: policies, error } = await supabase
      .from('routing_policies')
      .select('node_id')
      .eq('load_balancer_id', loadBalancerId);

    if (error) throw error;

    const healthStatuses = await Promise.all(
      policies.map(async (policy) => {
        const status = await redis.get(`health:${policy.node_id}:status`) || 'unknown';
        return { node_id: policy.node_id, status };
      })
    );

    const summary = healthStatuses.reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_nodes: healthStatuses.length,
      healthy: summary.healthy || 0,
      unhealthy: summary.unhealthy || 0,
      degraded: summary.degraded || 0,
      unknown: summary.unknown || 0,
      health_percentage: ((summary.healthy || 0) / healthStatuses.length) * 100
    };
  }
}

class ConfigValidator {
  static async validatePolicy(policy: z.infer<typeof PolicyUpdateSchema>): Promise<{valid: boolean, errors: string[]}> {
    const errors: string[] = [];

    // Validate load balancer exists
    const { data: lb, error } = await supabase
      .from('load_balancers')
      .select('id')
      .eq('id', policy.load_balancer_id)
      .single();

    if (error || !lb) {
      errors.push('Load balancer not found');
    }