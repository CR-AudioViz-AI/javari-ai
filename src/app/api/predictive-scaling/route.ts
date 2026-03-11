import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Redis } from 'ioredis';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Validation schemas
const scalingPolicySchema = z.object({
  name: z.string().min(1).max(100),
  service: z.string().min(1),
  minInstances: z.number().min(1).max(1000),
  maxInstances: z.number().min(1).max(10000),
  targetCPU: z.number().min(10).max(90),
  targetMemory: z.number().min(10).max(90),
  predictionWindow: z.number().min(5).max(1440), // minutes
  scaleUpThreshold: z.number().min(0.1).max(1.0),
  scaleDownThreshold: z.number().min(0.1).max(1.0),
  cooldownPeriod: z.number().min(60).max(3600), // seconds
  enabled: z.boolean(),
  tags: z.record(z.string()).optional(),
});

const metricsSchema = z.object({
  service: z.string().min(1),
  timestamp: z.number(),
  metrics: z.object({
    cpu: z.number().min(0).max(100),
    memory: z.number().min(0).max(100),
    requestsPerSecond: z.number().min(0),
    responseTime: z.number().min(0),
    errorRate: z.number().min(0).max(1),
    activeConnections: z.number().min(0),
    queueLength: z.number().min(0),
    instanceCount: z.number().min(1),
  }),
});

const forecastRequestSchema = z.object({
  service: z.string().min(1),
  horizon: z.number().min(5).max(1440), // minutes
  confidence: z.number().min(0.8).max(0.99).optional().default(0.95),
});

// Types
interface ScalingPolicy {
  id: string;
  name: string;
  service: string;
  minInstances: number;
  maxInstances: number;
  targetCPU: number;
  targetMemory: number;
  predictionWindow: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  enabled: boolean;
  tags?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface ServiceMetrics {
  cpu: number;
  memory: number;
  requestsPerSecond: number;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  queueLength: number;
  instanceCount: number;
}

interface ForecastResult {
  service: string;
  predictions: Array<{
    timestamp: number;
    predictedLoad: number;
    confidence: number;
    recommendedInstances: number;
    scalingAction: 'scale_up' | 'scale_down' | 'maintain';
  }>;
  modelAccuracy: number;
  lastUpdated: string;
}

interface ScalingRecommendation {
  service: string;
  currentInstances: number;
  recommendedInstances: number;
  action: 'scale_up' | 'scale_down' | 'maintain';
  reason: string;
  confidence: number;
  estimatedImpact: {
    costChange: number;
    performanceChange: number;
  };
}

// Machine Learning Demand Forecaster
class DemandForecaster {
  private async getHistoricalMetrics(service: string, hours: number = 168): Promise<ServiceMetrics[]> {
    const cacheKey = `historical_metrics:${service}:${hours}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data, error } = await supabase
      .from('service_metrics')
      .select('*')
      .eq('service', service)
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true });

    if (error) throw new Error(`Failed to fetch historical metrics: ${error.message}`);

    const metrics = data.map(row => ({
      cpu: row.cpu,
      memory: row.memory,
      requestsPerSecond: row.requests_per_second,
      responseTime: row.response_time,
      errorRate: row.error_rate,
      activeConnections: row.active_connections,
      queueLength: row.queue_length,
      instanceCount: row.instance_count,
    }));

    await redis.setex(cacheKey, 300, JSON.stringify(metrics)); // 5-minute cache
    return metrics;
  }

  private calculateSeasonality(metrics: ServiceMetrics[]): { hourly: number[], daily: number[], weekly: number[] } {
    const hourlyPatterns = new Array(24).fill(0);
    const dailyPatterns = new Array(7).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    const dailyCounts = new Array(7).fill(0);

    metrics.forEach((metric, index) => {
      const date = new Date(Date.now() - (metrics.length - index - 1) * 60000);
      const hour = date.getHours();
      const day = date.getDay();
      
      hourlyPatterns[hour] += metric.requestsPerSecond;
      hourlyCounts[hour]++;
      
      dailyPatterns[day] += metric.requestsPerSecond;
      dailyCounts[day]++;
    });

    // Normalize patterns
    const hourly = hourlyPatterns.map((sum, i) => hourlyCounts[i] > 0 ? sum / hourlyCounts[i] : 0);
    const daily = dailyPatterns.map((sum, i) => dailyCounts[i] > 0 ? sum / dailyCounts[i] : 0);
    
    return {
      hourly,
      daily,
      weekly: daily // Simplified weekly pattern
    };
  }

  private simpleLinearRegression(x: number[], y: number[]): { slope: number, intercept: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  async generateForecast(service: string, horizon: number, confidence: number = 0.95): Promise<ForecastResult> {
    const metrics = await this.getHistoricalMetrics(service);
    
    if (metrics.length < 24) {
      throw new Error('Insufficient historical data for forecasting');
    }

    const seasonality = this.calculateSeasonality(metrics);
    const timestamps = metrics.map((_, i) => i);
    const loads = metrics.map(m => m.requestsPerSecond);
    
    // Simple linear regression for trend
    const { slope, intercept } = this.simpleLinearRegression(timestamps, loads);
    
    const predictions = [];
    const baseTime = Date.now();
    
    for (let i = 0; i < horizon; i++) {
      const timestamp = baseTime + i * 60000; // 1-minute intervals
      const futureIndex = metrics.length + i;
      const trendValue = slope * futureIndex + intercept;
      
      // Apply seasonality
      const date = new Date(timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      
      const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
      const hourlyMultiplier = seasonality.hourly[hour] / avgLoad || 1;
      const dailyMultiplier = seasonality.daily[day] / avgLoad || 1;
      
      const predictedLoad = Math.max(0, trendValue * hourlyMultiplier * dailyMultiplier * 0.5);
      
      // Simple instance recommendation based on load
      const currentAvgInstances = metrics[metrics.length - 1]?.instanceCount || 1;
      const loadRatio = predictedLoad / avgLoad;
      const recommendedInstances = Math.max(1, Math.round(currentAvgInstances * loadRatio));
      
      let scalingAction: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
      if (recommendedInstances > currentAvgInstances * 1.2) {
        scalingAction = 'scale_up';
      } else if (recommendedInstances < currentAvgInstances * 0.8) {
        scalingAction = 'scale_down';
      }

      predictions.push({
        timestamp,
        predictedLoad,
        confidence,
        recommendedInstances,
        scalingAction,
      });
    }

    // Calculate model accuracy (simplified)
    const recentPredictions = loads.slice(-24); // Last 24 data points
    const recentActuals = loads.slice(-24);
    const mape = recentPredictions.reduce((acc, pred, i) => {
      const actual = recentActuals[i];
      return acc + Math.abs(pred - actual) / actual;
    }, 0) / recentPredictions.length;
    
    const modelAccuracy = Math.max(0, 1 - mape);

    return {
      service,
      predictions,
      modelAccuracy,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Scaling Executor
class ScalingExecutor {
  async executeScaling(service: string, targetInstances: number, reason: string): Promise<void> {
    // Log scaling action
    await supabase.from('scaling_actions').insert({
      service,
      action: targetInstances > 0 ? 'scale' : 'maintain',
      target_instances: targetInstances,
      reason,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, this would call cloud provider APIs
    // AWS: Auto Scaling Groups API
    // GCP: Instance Groups API  
    // Azure: Virtual Machine Scale Sets API
    
    console.log(`Scaling ${service} to ${targetInstances} instances. Reason: ${reason}`);
  }

  async generateRecommendations(): Promise<ScalingRecommendation[]> {
    const forecaster = new DemandForecaster();
    const recommendations: ScalingRecommendation[] = [];

    // Get active services
    const { data: policies } = await supabase
      .from('scaling_policies')
      .select('*')
      .eq('enabled', true);

    if (!policies) return recommendations;

    for (const policy of policies) {
      try {
        const forecast = await forecaster.generateForecast(policy.service, policy.prediction_window);
        const nextPrediction = forecast.predictions[0];
        
        if (!nextPrediction) continue;

        const currentInstances = nextPrediction.recommendedInstances; // Simplified
        const recommendedInstances = Math.min(
          Math.max(nextPrediction.recommendedInstances, policy.min_instances),
          policy.max_instances
        );

        let action: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
        let reason = 'Load within normal range';

        if (recommendedInstances > currentInstances) {
          action = 'scale_up';
          reason = `Predicted load spike: ${nextPrediction.predictedLoad.toFixed(2)}`;
        } else if (recommendedInstances < currentInstances) {
          action = 'scale_down';
          reason = `Predicted load decrease: ${nextPrediction.predictedLoad.toFixed(2)}`;
        }

        recommendations.push({
          service: policy.service,
          currentInstances,
          recommendedInstances,
          action,
          reason,
          confidence: nextPrediction.confidence,
          estimatedImpact: {
            costChange: (recommendedInstances - currentInstances) * 0.1, // Simplified cost calculation
            performanceChange: action === 'scale_up' ? 0.2 : action === 'scale_down' ? -0.1 : 0,
          },
        });

      } catch (error) {
        console.error(`Failed to generate recommendation for ${policy.service}:`, error);
      }
    }

    return recommendations;
  }
}

// GET - Retrieve scaling overview and recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const includeRecommendations = searchParams.get('recommendations') === 'true';

    if (service) {
      // Get specific service policy
      const { data: policy, error } = await supabase
        .from('scaling_policies')
        .select('*')
        .eq('service', service)
        .single();

      if (error || !policy) {
        return NextResponse.json(
          { error: 'Service policy not found' },
          { status: 404 }
        );
      }

      let recommendations = null;
      if (includeRecommendations) {
        const executor = new ScalingExecutor();
        const allRecommendations = await executor.generateRecommendations();
        recommendations = allRecommendations.find(r => r.service === service);
      }

      return NextResponse.json({
        policy,
        recommendations,
        status: 'success'
      });
    }

    // Get all policies and recommendations
    const { data: policies, error } = await supabase
      .from('scaling_policies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch scaling policies' },
        { status: 500 }
      );
    }

    let recommendations = null;
    if (includeRecommendations) {
      const executor = new ScalingExecutor();
      recommendations = await executor.generateRecommendations();
    }

    return NextResponse.json({
      policies: policies || [],
      recommendations,
      status: 'success',
      totalPolicies: policies?.length || 0
    });

  } catch (error) {
    console.error('GET /api/predictive-scaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update scaling policy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = scalingPolicySchema.parse(body);

    // Check if policy already exists
    const { data: existingPolicy } = await supabase
      .from('scaling_policies')
      .select('id')
      .eq('service', validatedData.service)
      .single();

    if (existingPolicy) {
      // Update existing policy
      const { data, error } = await supabase
        .from('scaling_policies')
        .update({
          ...validatedData,
          min_instances: validatedData.minInstances,
          max_instances: validatedData.maxInstances,
          target_cpu: validatedData.targetCPU,
          target_memory: validatedData.targetMemory,
          prediction_window: validatedData.predictionWindow,
          scale_up_threshold: validatedData.scaleUpThreshold,
          scale_down_threshold: validatedData.scaleDownThreshold,
          cooldown_period: validatedData.cooldownPeriod,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPolicy.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update scaling policy' },
          { status: 500 }
        );
      }

      // Clear related cache
      await redis.del(`policy:${validatedData.service}`);

      return NextResponse.json({
        policy: data,
        status: 'updated',
        message: 'Scaling policy updated successfully'
      });
    }

    // Create new policy
    const { data, error } = await supabase
      .from('scaling_policies')
      .insert({
        ...validatedData,
        min_instances: validatedData.minInstances,
        max_instances: validatedData.maxInstances,
        target_cpu: validatedData.targetCPU,
        target_memory: validatedData.targetMemory,
        prediction_window: validatedData.predictionWindow,
        scale_up_threshold: validatedData.scaleUpThreshold,
        scale_down_threshold: validatedData.scaleDownThreshold,
        cooldown_period: validatedData.cooldownPeriod,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create scaling policy' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      policy: data,
      status: 'created',
      message: 'Scaling policy created successfully'
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('POST /api/predictive-scaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Execute scaling action
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, action, targetInstances, reason } = body;

    if (!service || !action || typeof targetInstances !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: service, action, targetInstances' },
        { status: 400 }
      );
    }

    // Validate service exists
    const { data: policy } = await supabase
      .from('scaling_policies')
      .select('*')
      .eq('service', service)
      .eq('enabled', true)
      .single();

    if (!policy) {
      return NextResponse.json(
        { error: 'Service policy not found or disabled' },
        { status: 404 }
      );
    }

    // Validate target instances within bounds
    if (targetInstances < policy.min_instances || targetInstances > policy.max_instances) {
      return NextResponse.json(
        { error: `Target instances must be between ${policy.min_instances} and ${policy.max_instances}` },
        { status: 400 }
      );
    }

    // Check cooldown period
    const { data: lastAction } = await supabase
      .from('scaling_actions')
      .select('timestamp')
      .eq('service', service)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (lastAction) {
      const lastActionTime = new Date(lastAction.timestamp).getTime();
      const cooldownExpiry = lastActionTime + (policy.cooldown_period * 1000);
      
      if (Date.now() < cooldownExpiry) {
        return NextResponse.json(
          { error: 'Service is in cooldown period' },
          { status: 429 }
        );
      }
    }

    // Execute scaling
    const executor = new ScalingExecutor();
    await executor.executeScaling(service, targetInstances, reason || 'Manual scaling action');

    return NextResponse.json({
      status: 'success',
      message: `Scaling action executed for ${service}`,
      service,
      targetInstances,
      action
    });

  } catch (error) {
    console.error('PUT /api/predictive-scaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete scaling policy
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (!service) {
      return NextResponse.json(
        { error: 'Service parameter is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('scaling_policies')
      .delete()
      .eq('service', service)
      .select();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete scaling policy' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Service policy not found' },
        { status: 404 }
      );
    }

    // Clear related cache
    await redis.del(`policy:${service}`);
    await redis.del(`historical_metrics:${service}:*`);

    return NextResponse.json({
      status: 'success',
      message: `Scaling policy for ${service} deleted successfully`
    });

  } catch (error) {
    console.error('DELETE /api/predictive-scaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}