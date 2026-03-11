```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Types
interface ScalingRequest {
  service_id: string;
  target_instances?: number;
  scaling_policy?: 'aggressive' | 'conservative' | 'cost-optimized';
  max_instances?: number;
  min_instances?: number;
  cloud_provider?: 'aws' | 'gcp' | 'azure' | 'kubernetes';
}

interface DemandPrediction {
  predicted_load: number;
  confidence: number;
  recommendation: 'scale_up' | 'scale_down' | 'maintain';
  optimal_instances: number;
  cost_impact: number;
}

interface ScalingMetrics {
  service_id: string;
  current_instances: number;
  cpu_utilization: number;
  memory_utilization: number;
  request_rate: number;
  response_time: number;
  cost_per_hour: number;
  timestamp: string;
}

interface CloudProviderConfig {
  provider: string;
  credentials: Record<string, string>;
  scaling_limits: {
    min: number;
    max: number;
    cooldown_period: number;
  };
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Redis client
const redis = new Redis(process.env.REDIS_URL!);

class DemandPredictor {
  static async predictDemand(serviceId: string, historicalMetrics: ScalingMetrics[]): Promise<DemandPrediction> {
    try {
      // Implement ML-based demand prediction
      const recentMetrics = historicalMetrics.slice(-24); // Last 24 hours
      const avgCpuUtilization = recentMetrics.reduce((sum, m) => sum + m.cpu_utilization, 0) / recentMetrics.length;
      const avgRequestRate = recentMetrics.reduce((sum, m) => sum + m.request_rate, 0) / recentMetrics.length;
      
      // Simple prediction algorithm (replace with actual ML model)
      const trendFactor = this.calculateTrend(recentMetrics);
      const predictedLoad = (avgCpuUtilization + avgRequestRate / 100) * trendFactor;
      
      let recommendation: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
      let optimalInstances = recentMetrics[recentMetrics.length - 1]?.current_instances || 1;
      
      if (predictedLoad > 80) {
        recommendation = 'scale_up';
        optimalInstances = Math.ceil(optimalInstances * 1.5);
      } else if (predictedLoad < 30) {
        recommendation = 'scale_down';
        optimalInstances = Math.max(1, Math.floor(optimalInstances * 0.7));
      }
      
      const costImpact = this.calculateCostImpact(
        recentMetrics[recentMetrics.length - 1]?.current_instances || 1,
        optimalInstances,
        recentMetrics[recentMetrics.length - 1]?.cost_per_hour || 0
      );
      
      return {
        predicted_load: predictedLoad,
        confidence: 0.85,
        recommendation,
        optimal_instances: optimalInstances,
        cost_impact: costImpact
      };
    } catch (error) {
      console.error('Demand prediction error:', error);
      throw new Error('Failed to predict demand');
    }
  }
  
  private static calculateTrend(metrics: ScalingMetrics[]): number {
    if (metrics.length < 2) return 1;
    
    const recent = metrics.slice(-6);
    const older = metrics.slice(-12, -6);
    
    const recentAvg = recent.reduce((sum, m) => sum + m.cpu_utilization, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.cpu_utilization, 0) / older.length;
    
    return recentAvg / (olderAvg || 1);
  }
  
  private static calculateCostImpact(currentInstances: number, targetInstances: number, costPerHour: number): number {
    return (targetInstances - currentInstances) * costPerHour;
  }
}

class ResourceOptimizer {
  static async optimizeResources(serviceId: string, metrics: ScalingMetrics, policy: string): Promise<{
    recommended_instances: number;
    resource_allocation: Record<string, number>;
    cost_savings: number;
  }> {
    try {
      const cacheKey = `resource_optimization:${serviceId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      let recommendedInstances = metrics.current_instances;
      let resourceAllocation = {
        cpu_cores: 2,
        memory_gb: 4,
        storage_gb: 20
      };
      
      // Optimization logic based on policy
      switch (policy) {
        case 'aggressive':
          if (metrics.cpu_utilization > 70) recommendedInstances = Math.ceil(metrics.current_instances * 1.5);
          if (metrics.memory_utilization > 80) resourceAllocation.memory_gb *= 1.5;
          break;
          
        case 'conservative':
          if (metrics.cpu_utilization > 85) recommendedInstances = Math.ceil(metrics.current_instances * 1.2);
          break;
          
        case 'cost-optimized':
          if (metrics.cpu_utilization < 40 && metrics.memory_utilization < 50) {
            recommendedInstances = Math.max(1, Math.floor(metrics.current_instances * 0.8));
          }
          break;
      }
      
      const costSavings = (metrics.current_instances - recommendedInstances) * metrics.cost_per_hour;
      
      const result = {
        recommended_instances: recommendedInstances,
        resource_allocation: resourceAllocation,
        cost_savings: costSavings
      };
      
      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(result));
      
      return result;
    } catch (error) {
      console.error('Resource optimization error:', error);
      throw new Error('Failed to optimize resources');
    }
  }
}

class CostAnalyzer {
  static async analyzeCosts(serviceId: string, timeRange: string = '24h'): Promise<{
    current_cost: number;
    projected_cost: number;
    cost_breakdown: Record<string, number>;
    optimization_opportunities: string[];
  }> {
    try {
      const { data: costData, error } = await supabase
        .from('cost_optimization')
        .select('*')
        .eq('service_id', serviceId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const currentCost = costData?.reduce((sum, record) => sum + record.hourly_cost, 0) || 0;
      const projectedCost = currentCost * 1.1; // Simple projection
      
      const costBreakdown = {
        compute: currentCost * 0.6,
        storage: currentCost * 0.2,
        network: currentCost * 0.15,
        other: currentCost * 0.05
      };
      
      const optimizationOpportunities = [
        'Consider using spot instances for non-critical workloads',
        'Implement auto-shutdown for development environments',
        'Optimize storage by removing unused volumes'
      ];
      
      return {
        current_cost: currentCost,
        projected_cost: projectedCost,
        cost_breakdown: costBreakdown,
        optimization_opportunities: optimizationOpportunities
      };
    } catch (error) {
      console.error('Cost analysis error:', error);
      throw new Error('Failed to analyze costs');
    }
  }
}

class CloudProviderManager {
  static async executeScaling(
    serviceId: string,
    provider: string,
    targetInstances: number,
    config: CloudProviderConfig
  ): Promise<{ success: boolean; message: string; scaling_id: string }> {
    try {
      const scalingId = `scaling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simulate cloud provider API calls
      switch (provider) {
        case 'aws':
          // AWS Auto Scaling API call simulation
          break;
        case 'gcp':
          // Google Cloud Autoscaler API call simulation
          break;
        case 'azure':
          // Azure VM Scale Sets API call simulation
          break;
        case 'kubernetes':
          // Kubernetes HPA API call simulation
          break;
      }
      
      // Log scaling event
      const { error } = await supabase
        .from('scaling_metrics')
        .insert({
          service_id: serviceId,
          scaling_id: scalingId,
          provider,
          action: 'scale',
          target_instances: targetInstances,
          status: 'initiated',
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      return {
        success: true,
        message: `Scaling initiated for ${provider}`,
        scaling_id: scalingId
      };
    } catch (error) {
      console.error('Scaling execution error:', error);
      throw new Error('Failed to execute scaling');
    }
  }
}

class AlertManager {
  static async checkAlerts(metrics: ScalingMetrics): Promise<void> {
    try {
      const alerts = [];
      
      if (metrics.cpu_utilization > 90) {
        alerts.push({
          type: 'high_cpu',
          severity: 'critical',
          message: `CPU utilization at ${metrics.cpu_utilization}%`,
          service_id: metrics.service_id
        });
      }
      
      if (metrics.memory_utilization > 95) {
        alerts.push({
          type: 'high_memory',
          severity: 'critical',
          message: `Memory utilization at ${metrics.memory_utilization}%`,
          service_id: metrics.service_id
        });
      }
      
      if (metrics.response_time > 5000) {
        alerts.push({
          type: 'high_latency',
          severity: 'warning',
          message: `Response time at ${metrics.response_time}ms`,
          service_id: metrics.service_id
        });
      }
      
      for (const alert of alerts) {
        await supabase.from('alerts').insert(alert);
      }
    } catch (error) {
      console.error('Alert check error:', error);
    }
  }
}

// GET - Get current scaling status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    
    if (!serviceId) {
      return NextResponse.json(
        { error: 'service_id parameter is required' },
        { status: 400 }
      );
    }
    
    // Get current metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('scaling_metrics')
      .select('*')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (metricsError) throw metricsError;
    
    // Get scaling policies
    const { data: policies, error: policiesError } = await supabase
      .from('scaling_policies')
      .select('*')
      .eq('service_id', serviceId);
    
    if (policiesError) throw policiesError;
    
    // Get historical data for prediction
    const { data: historical, error: historicalError } = await supabase
      .from('scaling_metrics')
      .select('*')
      .eq('service_id', serviceId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (historicalError) throw historicalError;
    
    const currentMetrics = metrics?.[0];
    const demandPrediction = historical && historical.length > 0 
      ? await DemandPredictor.predictDemand(serviceId, historical as ScalingMetrics[])
      : null;
    
    const costAnalysis = await CostAnalyzer.analyzeCosts(serviceId);
    
    return NextResponse.json({
      service_id: serviceId,
      current_metrics: currentMetrics,
      demand_prediction: demandPrediction,
      cost_analysis: costAnalysis,
      scaling_policies: policies,
      last_updated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('GET scaling status error:', error);
    return NextResponse.json(
      { error: 'Failed to get scaling status' },
      { status: 500 }
    );
  }
}

// POST - Trigger scaling action
export async function POST(request: NextRequest) {
  try {
    const body: ScalingRequest = await request.json();
    
    // Validate request
    if (!body.service_id) {
      return NextResponse.json(
        { error: 'service_id is required' },
        { status: 400 }
      );
    }
    
    // Get current metrics
    const { data: currentMetrics, error: metricsError } = await supabase
      .from('scaling_metrics')
      .select('*')
      .eq('service_id', body.service_id)
      .order('created_at', { ascending: false })
      .limit(24);
    
    if (metricsError) throw metricsError;
    
    if (!currentMetrics || currentMetrics.length === 0) {
      return NextResponse.json(
        { error: 'No metrics found for service' },
        { status: 404 }
      );
    }
    
    const latestMetric = currentMetrics[0] as ScalingMetrics;
    
    // Get cloud provider config
    const { data: providerConfig, error: configError } = await supabase
      .from('cloud_providers')
      .select('*')
      .eq('service_id', body.service_id)
      .single();
    
    if (configError) throw configError;
    
    let targetInstances = body.target_instances;
    
    // If no target specified, use optimization recommendation
    if (!targetInstances) {
      const optimization = await ResourceOptimizer.optimizeResources(
        body.service_id,
        latestMetric,
        body.scaling_policy || 'conservative'
      );
      targetInstances = optimization.recommended_instances;
    }
    
    // Apply limits
    const minInstances = body.min_instances || providerConfig.scaling_limits?.min || 1;
    const maxInstances = body.max_instances || providerConfig.scaling_limits?.max || 10;
    
    targetInstances = Math.max(minInstances, Math.min(maxInstances, targetInstances));
    
    // Execute scaling
    const scalingResult = await CloudProviderManager.executeScaling(
      body.service_id,
      body.cloud_provider || providerConfig.provider,
      targetInstances,
      providerConfig as CloudProviderConfig
    );
    
    // Check for alerts
    await AlertManager.checkAlerts(latestMetric);
    
    // Cache scaling decision
    await redis.setex(
      `scaling_decision:${body.service_id}`,
      300,
      JSON.stringify({
        target_instances: targetInstances,
        scaling_id: scalingResult.scaling_id,
        timestamp: new Date().toISOString()
      })
    );
    
    return NextResponse.json({
      success: true,
      service_id: body.service_id,
      current_instances: latestMetric.current_instances,
      target_instances: targetInstances,
      scaling_result: scalingResult,
      estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('POST scaling error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger scaling' },
      { status: 500 }
    );
  }
}

// PUT - Update scaling policies
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.service_id) {
      return NextResponse.json(
        { error: 'service_id is required' },
        { status: 400 }
      );
    }
    
    // Update scaling policy
    const { data, error } = await supabase
      .from('scaling_policies')
      .upsert({
        service_id: body.service_id,
        min_instances: body.min_instances || 1,
        max_instances: body.max_instances || 10,
        target_cpu_utilization: body.target_cpu_utilization || 70,
        scale_up_cooldown: body.scale_up_cooldown || 300,
        scale_down_cooldown: body.scale_down_cooldown || 600,
        scaling_policy: body.scaling_policy || 'conservative',
        cost_optimization_enabled: body.cost_optimization_enabled || false,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Invalidate cache
    await redis.del(`resource_optimization:${body.service_id}`);
    
    return NextResponse.json({
      success: true,
      policy: data,
      message: 'Scaling policy updated successfully'
    });
    
  } catch (error) {
    console.error('PUT scaling policy error:', error);
    return NextResponse.json(
      { error: 'Failed to update scaling policy' },
      { status: 500 }
    );
  }
}

// DELETE - Remove scaling configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    
    if (!serviceId) {
      return NextResponse.json(
        { error: 'service_id parameter is required' },
        { status: 400 }
      );
    }
    
    // Delete scaling policies
    const { error: policyError } = await supabase
      .from('scaling_policies')
      .delete()
      .eq('service_id', serviceId);
    
    if (policyError) throw policyError;
    
    // Clear cache
    await redis.del(`resource_optimization:${serviceId}`);
    await redis.del(`scaling_decision:${serviceId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Scaling configuration removed successfully'
    });
    
  } catch (error) {
    console.error('DELETE scaling config error:', error);
    return NextResponse.json(
      { error: 'Failed to remove scaling configuration' },
      { status: 500 }
    );
  }
}
```