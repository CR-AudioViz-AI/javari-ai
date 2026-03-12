```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Redis from 'ioredis';

// Validation schemas
const ForecastRequestSchema = z.object({
  metrics: z.array(z.object({
    timestamp: z.string().datetime(),
    cpu_usage: z.number().min(0).max(100),
    memory_usage: z.number().min(0).max(100),
    request_count: z.number().min(0),
    response_time: z.number().min(0),
    error_rate: z.number().min(0).max(100)
  })),
  forecast_horizon: z.number().min(1).max(168), // 1-168 hours
  service_id: z.string().uuid(),
  environment: z.enum(['production', 'staging', 'development'])
});

const ScaleRequestSchema = z.object({
  service_id: z.string().uuid(),
  scaling_action: z.enum(['scale_up', 'scale_down', 'auto']),
  target_instances: z.number().min(1).max(100).optional(),
  resource_limits: z.object({
    cpu_cores: z.number().min(1).max(64).optional(),
    memory_gb: z.number().min(1).max(512).optional(),
    max_cost_per_hour: z.number().min(0).optional()
  }).optional(),
  force: z.boolean().default(false)
});

const PolicyUpdateSchema = z.object({
  service_id: z.string().uuid(),
  policies: z.object({
    min_instances: z.number().min(1).max(10),
    max_instances: z.number().min(1).max(100),
    target_cpu: z.number().min(10).max(90),
    target_memory: z.number().min(10).max(90),
    scale_up_threshold: z.number().min(60).max(95),
    scale_down_threshold: z.number().min(10).max(50),
    cooldown_minutes: z.number().min(1).max(60),
    cost_optimization: z.boolean(),
    prediction_weight: z.number().min(0).max(1)
  })
});

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Types
interface MetricDataPoint {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  request_count: number;
  response_time: number;
  error_rate: number;
}

interface ForecastResult {
  predictions: Array<{
    timestamp: string;
    predicted_cpu: number;
    predicted_memory: number;
    predicted_requests: number;
    confidence: number;
  }>;
  recommended_scaling: {
    action: string;
    target_instances: number;
    estimated_cost: number;
    confidence: number;
  };
}

interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'maintain';
  current_instances: number;
  target_instances: number;
  resource_changes: {
    cpu_cores?: number;
    memory_gb?: number;
  };
  cost_impact: {
    current_cost_per_hour: number;
    projected_cost_per_hour: number;
    savings_percentage?: number;
  };
  confidence: number;
  reasoning: string[];
}

class PredictiveScalingEngine {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }

  async generateForecast(metrics: MetricDataPoint[], horizonHours: number): Promise<ForecastResult> {
    try {
      // Simple time-series forecasting using exponential smoothing
      const predictions = this.performTimeSeriesForecasting(metrics, horizonHours);
      const scalingRecommendation = await this.generateScalingRecommendation(predictions);
      
      return {
        predictions,
        recommended_scaling: scalingRecommendation
      };
    } catch (error) {
      throw new Error(`Forecasting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private performTimeSeriesForecasting(metrics: MetricDataPoint[], horizonHours: number) {
    const sortedMetrics = metrics.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const predictions = [];
    const alpha = 0.3; // Smoothing parameter
    
    // Get baseline values from recent metrics
    const recentMetrics = sortedMetrics.slice(-12); // Last 12 data points
    let avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu_usage, 0) / recentMetrics.length;
    let avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory_usage, 0) / recentMetrics.length;
    let avgRequests = recentMetrics.reduce((sum, m) => sum + m.request_count, 0) / recentMetrics.length;

    const lastTimestamp = new Date(sortedMetrics[sortedMetrics.length - 1].timestamp);

    for (let i = 1; i <= horizonHours; i++) {
      const futureTimestamp = new Date(lastTimestamp.getTime() + (i * 60 * 60 * 1000));
      
      // Apply seasonal patterns and trend
      const hourOfDay = futureTimestamp.getHours();
      const dayOfWeek = futureTimestamp.getDay();
      
      // Simple seasonal adjustment
      const seasonalFactor = this.getSeasonalFactor(hourOfDay, dayOfWeek);
      
      // Exponential smoothing with trend
      avgCpu = alpha * (avgCpu * seasonalFactor) + (1 - alpha) * avgCpu;
      avgMemory = alpha * (avgMemory * seasonalFactor) + (1 - alpha) * avgMemory;
      avgRequests = alpha * (avgRequests * seasonalFactor) + (1 - alpha) * avgRequests;
      
      predictions.push({
        timestamp: futureTimestamp.toISOString(),
        predicted_cpu: Math.max(0, Math.min(100, avgCpu)),
        predicted_memory: Math.max(0, Math.min(100, avgMemory)),
        predicted_requests: Math.max(0, avgRequests),
        confidence: Math.max(0.5, 1 - (i * 0.02)) // Confidence decreases over time
      });
    }

    return predictions;
  }

  private getSeasonalFactor(hour: number, dayOfWeek: number): number {
    // Business hours adjustment (higher traffic 9 AM - 5 PM on weekdays)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 9 && hour <= 17) {
        return 1.3;
      } else if (hour >= 18 && hour <= 23) {
        return 1.1;
      }
    }
    
    // Weekend patterns
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0.7;
    }
    
    // Night hours
    if (hour >= 0 && hour <= 6) {
      return 0.5;
    }
    
    return 1.0;
  }

  private async generateScalingRecommendation(predictions: any[]) {
    const peakCpu = Math.max(...predictions.map(p => p.predicted_cpu));
    const peakMemory = Math.max(...predictions.map(p => p.predicted_memory));
    const peakRequests = Math.max(...predictions.map(p => p.predicted_requests));
    
    let action = 'maintain';
    let targetInstances = 2; // Default
    let estimatedCost = 50; // Base cost
    
    if (peakCpu > 80 || peakMemory > 85) {
      action = 'scale_up';
      targetInstances = Math.ceil(peakCpu / 70);
      estimatedCost = targetInstances * 25;
    } else if (peakCpu < 30 && peakMemory < 40) {
      action = 'scale_down';
      targetInstances = Math.max(1, Math.floor(peakCpu / 50));
      estimatedCost = targetInstances * 25;
    }
    
    const confidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    
    return {
      action,
      target_instances: targetInstances,
      estimated_cost: estimatedCost,
      confidence
    };
  }

  async makeScalingDecision(serviceId: string, currentMetrics: any, policies: any): Promise<ScalingDecision> {
    // Get cached predictions
    const cacheKey = `predictions:${serviceId}`;
    const cachedPredictions = await this.redis.get(cacheKey);
    
    if (!cachedPredictions) {
      throw new Error('No predictions available. Generate forecast first.');
    }
    
    const predictions = JSON.parse(cachedPredictions);
    const nextHourPrediction = predictions.predictions[0];
    
    let action: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
    let targetInstances = policies.min_instances;
    const reasoning: string[] = [];
    
    // Decision logic based on predictions and current state
    if (nextHourPrediction.predicted_cpu > policies.scale_up_threshold) {
      action = 'scale_up';
      targetInstances = Math.min(
        policies.max_instances,
        Math.ceil(nextHourPrediction.predicted_cpu / policies.target_cpu)
      );
      reasoning.push(`Predicted CPU usage (${nextHourPrediction.predicted_cpu}%) exceeds scale-up threshold`);
    } else if (nextHourPrediction.predicted_cpu < policies.scale_down_threshold) {
      action = 'scale_down';
      targetInstances = Math.max(
        policies.min_instances,
        Math.ceil(nextHourPrediction.predicted_cpu / policies.target_cpu)
      );
      reasoning.push(`Predicted CPU usage (${nextHourPrediction.predicted_cpu}%) below scale-down threshold`);
    }
    
    // Cost optimization
    const currentCost = policies.min_instances * 25;
    const projectedCost = targetInstances * 25;
    
    return {
      action,
      current_instances: policies.min_instances,
      target_instances: targetInstances,
      resource_changes: {},
      cost_impact: {
        current_cost_per_hour: currentCost,
        projected_cost_per_hour: projectedCost,
        savings_percentage: ((currentCost - projectedCost) / currentCost) * 100
      },
      confidence: nextHourPrediction.confidence,
      reasoning
    };
  }
}

class MetricsCollector {
  static async collectMetrics(serviceId: string, timeRange: string) {
    const { data, error } = await supabase
      .from('service_metrics')
      .select('*')
      .eq('service_id', serviceId)
      .gte('created_at', timeRange)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async getScalingHistory(serviceId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('scaling_events')
      .select('*')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}

// Route handlers
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    const engine = new PredictiveScalingEngine(redis);

    if (pathname.endsWith('/forecast')) {
      const body = await request.json();
      const validatedData = ForecastRequestSchema.parse(body);

      const forecast = await engine.generateForecast(
        validatedData.metrics,
        validatedData.forecast_horizon
      );

      // Cache the forecast
      await redis.setex(
        `predictions:${validatedData.service_id}`,
        3600, // 1 hour TTL
        JSON.stringify(forecast)
      );

      // Store forecast in database
      await supabase.from('scaling_forecasts').insert({
        service_id: validatedData.service_id,
        forecast_data: forecast,
        horizon_hours: validatedData.forecast_horizon,
        environment: validatedData.environment
      });

      return NextResponse.json({
        success: true,
        data: forecast
      });
    }

    if (pathname.endsWith('/scale')) {
      const body = await request.json();
      const validatedData = ScaleRequestSchema.parse(body);

      // Get service policies
      const { data: policies } = await supabase
        .from('scaling_policies')
        .select('*')
        .eq('service_id', validatedData.service_id)
        .single();

      if (!policies) {
        return NextResponse.json({
          error: 'No scaling policies found for service'
        }, { status: 404 });
      }

      const currentMetrics = await MetricsCollector.collectMetrics(
        validatedData.service_id,
        new Date(Date.now() - 60000).toISOString()
      );

      const decision = await engine.makeScalingDecision(
        validatedData.service_id,
        currentMetrics,
        policies.policies
      );

      // Log scaling event
      await supabase.from('scaling_events').insert({
        service_id: validatedData.service_id,
        action: decision.action,
        previous_instances: decision.current_instances,
        target_instances: decision.target_instances,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        cost_impact: decision.cost_impact
      });

      return NextResponse.json({
        success: true,
        data: decision
      });
    }

    if (pathname.endsWith('/simulate')) {
      const body = await request.json();
      const validatedData = ForecastRequestSchema.parse(body);

      const forecast = await engine.generateForecast(
        validatedData.metrics,
        validatedData.forecast_horizon
      );

      // Simulate different scaling scenarios
      const scenarios = [
        { name: 'Conservative', multiplier: 0.8 },
        { name: 'Recommended', multiplier: 1.0 },
        { name: 'Aggressive', multiplier: 1.2 }
      ];

      const simulations = scenarios.map(scenario => ({
        scenario: scenario.name,
        estimated_instances: Math.ceil(forecast.recommended_scaling.target_instances * scenario.multiplier),
        estimated_cost: forecast.recommended_scaling.estimated_cost * scenario.multiplier,
        risk_level: scenario.multiplier < 1 ? 'High' : scenario.multiplier > 1 ? 'Low' : 'Medium'
      }));

      return NextResponse.json({
        success: true,
        data: {
          baseline_forecast: forecast,
          scenarios: simulations
        }
      });
    }

    return NextResponse.json({
      error: 'Invalid endpoint'
    }, { status: 404 });

  } catch (error) {
    console.error('Predictive scaling error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const serviceId = url.searchParams.get('service_id');

    if (!serviceId) {
      return NextResponse.json({
        error: 'service_id parameter required'
      }, { status: 400 });
    }

    if (pathname.endsWith('/metrics')) {
      const timeRange = url.searchParams.get('time_range') || '1h';
      const rangeMs = timeRange === '1h' ? 3600000 : 
                     timeRange === '24h' ? 86400000 : 
                     timeRange === '7d' ? 604800000 : 3600000;
      
      const metrics = await MetricsCollector.collectMetrics(
        serviceId,
        new Date(Date.now() - rangeMs).toISOString()
      );

      // Get cached predictions
      const predictions = await redis.get(`predictions:${serviceId}`);

      return NextResponse.json({
        success: true,
        data: {
          current_metrics: metrics,
          predictions: predictions ? JSON.parse(predictions) : null
        }
      });
    }

    if (pathname.endsWith('/history')) {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const history = await MetricsCollector.getScalingHistory(serviceId, limit);

      return NextResponse.json({
        success: true,
        data: history
      });
    }

    return NextResponse.json({
      error: 'Invalid endpoint'
    }, { status: 404 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    
    if (url.pathname.endsWith('/policies')) {
      const body = await request.json();
      const validatedData = PolicyUpdateSchema.parse(body);

      const { error } = await supabase
        .from('scaling_policies')
        .upsert({
          service_id: validatedData.service_id,
          policies: validatedData.policies,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Invalidate cached predictions
      await redis.del(`predictions:${validatedData.service_id}`);

      return NextResponse.json({
        success: true,
        message: 'Scaling policies updated successfully'
      });
    }

    return NextResponse.json({
      error: 'Invalid endpoint'
    }, { status: 404 });

  } catch (error) {
    console.error('PUT error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```