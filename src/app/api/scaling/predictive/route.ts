```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const analyzeSchema = z.object({
  service_id: z.string().uuid(),
  time_range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  metrics: z.array(z.enum(['cpu', 'memory', 'requests', 'response_time'])),
  forecast_horizon: z.number().min(1).max(168) // hours
});

const scaleSchema = z.object({
  service_id: z.string().uuid(),
  action: z.enum(['scale_up', 'scale_down', 'auto']),
  target_instances: z.number().min(1).max(100).optional(),
  trigger_reason: z.string().optional()
});

const configureSchema = z.object({
  service_id: z.string().uuid(),
  config: z.object({
    cpu_threshold_up: z.number().min(0).max(100),
    cpu_threshold_down: z.number().min(0).max(100),
    memory_threshold_up: z.number().min(0).max(100),
    memory_threshold_down: z.number().min(0).max(100),
    min_instances: z.number().min(1).max(10),
    max_instances: z.number().min(1).max(100),
    cooldown_period: z.number().min(60).max(3600), // seconds
    prediction_confidence: z.number().min(0.5).max(1.0),
    enable_predictive: z.boolean()
  })
});

// Time series forecasting service
class ForecastingService {
  private static async generateForecast(
    historicalData: any[],
    horizonHours: number
  ): Promise<any[]> {
    try {
      // Simplified time series forecasting logic
      // In production, integrate with ML service like AWS Forecast, Azure ML, or TensorFlow
      const trends = this.calculateTrends(historicalData);
      const seasonality = this.detectSeasonality(historicalData);
      
      const forecast = [];
      const now = new Date();
      
      for (let i = 1; i <= horizonHours; i++) {
        const timestamp = new Date(now.getTime() + i * 60 * 60 * 1000);
        const predicted_value = this.predictValue(trends, seasonality, i);
        const confidence = Math.max(0.6, 1 - (i / horizonHours) * 0.4);
        
        forecast.push({
          timestamp: timestamp.toISOString(),
          predicted_value,
          confidence,
          trend: trends.slope > 0 ? 'increasing' : 'decreasing',
          seasonal_factor: seasonality.factor
        });
      }
      
      return forecast;
    } catch (error) {
      console.error('Forecasting error:', error);
      throw new Error('Failed to generate forecast');
    }
  }

  private static calculateTrends(data: any[]): { slope: number; intercept: number } {
    if (data.length < 2) return { slope: 0, intercept: 0 };
    
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  private static detectSeasonality(data: any[]): { factor: number; period: number } {
    // Simplified seasonality detection
    // In production, use more sophisticated algorithms like FFT or autocorrelation
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    data.forEach(d => {
      const hour = new Date(d.timestamp).getHours();
      hourlyAverages[hour] += d.value;
      hourlyCounts[hour]++;
    });
    
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }
    
    const maxAvg = Math.max(...hourlyAverages);
    const minAvg = Math.min(...hourlyAverages);
    const factor = maxAvg > 0 ? (maxAvg - minAvg) / maxAvg : 0;
    
    return { factor, period: 24 };
  }

  private static predictValue(
    trends: { slope: number; intercept: number },
    seasonality: { factor: number; period: number },
    hourOffset: number
  ): number {
    const baseValue = trends.intercept + trends.slope * hourOffset;
    const seasonalAdjustment = 1 + Math.sin((2 * Math.PI * hourOffset) / seasonality.period) * seasonality.factor;
    return Math.max(0, baseValue * seasonalAdjustment);
  }
}

// Scaling decision engine
class ScalingEngine {
  static async makeScalingDecision(
    serviceId: string,
    forecast: any[],
    currentMetrics: any,
    config: any
  ): Promise<{
    action: 'scale_up' | 'scale_down' | 'maintain';
    target_instances: number;
    confidence: number;
    reasoning: string;
  }> {
    try {
      const nearTermForecast = forecast.slice(0, 6); // Next 6 hours
      const avgPredictedCpu = nearTermForecast.reduce((sum, f) => sum + f.predicted_value, 0) / nearTermForecast.length;
      const maxPredictedCpu = Math.max(...nearTermForecast.map(f => f.predicted_value));
      const minConfidence = Math.min(...nearTermForecast.map(f => f.confidence));
      
      let action: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
      let targetInstances = currentMetrics.current_instances;
      let reasoning = 'No scaling needed based on predictions';

      // Check if we should scale up
      if (maxPredictedCpu > config.cpu_threshold_up && minConfidence > config.prediction_confidence) {
        const scaleFactor = Math.ceil(maxPredictedCpu / config.cpu_threshold_up);
        targetInstances = Math.min(
          currentMetrics.current_instances * scaleFactor,
          config.max_instances
        );
        action = 'scale_up';
        reasoning = `Predicted CPU spike to ${maxPredictedCpu.toFixed(1)}% (threshold: ${config.cpu_threshold_up}%)`;
      }
      // Check if we should scale down
      else if (avgPredictedCpu < config.cpu_threshold_down && minConfidence > config.prediction_confidence) {
        const scaleFactor = Math.max(0.5, avgPredictedCpu / config.cpu_threshold_down);
        targetInstances = Math.max(
          Math.floor(currentMetrics.current_instances * scaleFactor),
          config.min_instances
        );
        action = 'scale_down';
        reasoning = `Predicted low CPU usage: ${avgPredictedCpu.toFixed(1)}% (threshold: ${config.cpu_threshold_down}%)`;
      }

      return {
        action,
        target_instances: targetInstances,
        confidence: minConfidence,
        reasoning
      };
    } catch (error) {
      console.error('Scaling decision error:', error);
      throw new Error('Failed to make scaling decision');
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'analyze': {
        const body = await request.json();
        const validatedData = analyzeSchema.parse(body);

        // Fetch historical metrics
        const { data: metricsData, error: metricsError } = await supabase
          .from('metrics_history')
          .select('*')
          .eq('service_id', validatedData.service_id)
          .gte('timestamp', validatedData.time_range.start)
          .lte('timestamp', validatedData.time_range.end)
          .order('timestamp', { ascending: true });

        if (metricsError) throw metricsError;

        // Generate forecast for each metric
        const analysis = {};
        for (const metric of validatedData.metrics) {
          const metricData = metricsData?.filter(m => m.metric_type === metric) || [];
          if (metricData.length > 0) {
            const forecast = await ForecastingService.generateForecast(
              metricData,
              validatedData.forecast_horizon
            );
            
            analysis[metric] = {
              historical_points: metricData.length,
              forecast,
              patterns: {
                trend: forecast.length > 0 ? forecast[0].trend : 'stable',
                seasonality_detected: forecast.some(f => f.seasonal_factor > 0.1)
              }
            };
          }
        }

        // Store analysis results
        const { error: insertError } = await supabase
          .from('scaling_predictions')
          .insert({
            service_id: validatedData.service_id,
            analysis_timestamp: new Date().toISOString(),
            forecast_horizon: validatedData.forecast_horizon,
            analysis_results: analysis,
            created_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        return NextResponse.json({
          success: true,
          service_id: validatedData.service_id,
          analysis,
          forecast_horizon_hours: validatedData.forecast_horizon,
          generated_at: new Date().toISOString()
        });
      }

      case 'scale': {
        const body = await request.json();
        const validatedData = scaleSchema.parse(body);

        // Get current scaling configuration
        const { data: configData, error: configError } = await supabase
          .from('scaling_configs')
          .select('*')
          .eq('service_id', validatedData.service_id)
          .single();

        if (configError && configError.code !== 'PGRST116') throw configError;

        if (!configData?.enable_predictive && validatedData.action === 'auto') {
          return NextResponse.json({
            success: false,
            error: 'Predictive scaling is disabled for this service'
          }, { status: 400 });
        }

        // Check cooldown period
        const { data: recentEvents, error: eventsError } = await supabase
          .from('scaling_events')
          .select('timestamp')
          .eq('service_id', validatedData.service_id)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (eventsError) throw eventsError;

        if (recentEvents?.length > 0) {
          const lastScaling = new Date(recentEvents[0].timestamp);
          const cooldownEnd = new Date(lastScaling.getTime() + (configData?.cooldown_period || 300) * 1000);
          
          if (new Date() < cooldownEnd) {
            return NextResponse.json({
              success: false,
              error: 'Scaling action is in cooldown period',
              cooldown_ends_at: cooldownEnd.toISOString()
            }, { status:429 });
          }
        }

        // Execute scaling action
        const scalingResult = await this.executeScaling(validatedData);

        // Log scaling event
        const { error: logError } = await supabase
          .from('scaling_events')
          .insert({
            service_id: validatedData.service_id,
            action: validatedData.action,
            target_instances: validatedData.target_instances || scalingResult.instances,
            trigger_reason: validatedData.trigger_reason || 'Manual trigger',
            timestamp: new Date().toISOString(),
            success: scalingResult.success,
            metadata: scalingResult
          });

        if (logError) throw logError;

        return NextResponse.json({
          success: true,
          scaling_result: scalingResult,
          logged_at: new Date().toISOString()
        });
      }

      case 'configure': {
        const body = await request.json();
        const validatedData = configureSchema.parse(body);

        // Upsert scaling configuration
        const { data, error } = await supabase
          .from('scaling_configs')
          .upsert({
            service_id: validatedData.service_id,
            ...validatedData.config,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          config: data,
          updated_at: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Predictive scaling API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();
    const searchParams = url.searchParams;
    
    const serviceId = searchParams.get('service_id');
    if (!serviceId) {
      return NextResponse.json({
        success: false,
        error: 'service_id is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'forecast': {
        const timeRange = searchParams.get('time_range') || '24'; // hours
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + parseInt(timeRange) * 60 * 60 * 1000);

        // Get latest prediction results
        const { data: predictionData, error: predictionError } = await supabase
          .from('scaling_predictions')
          .select('*')
          .eq('service_id', serviceId)
          .order('analysis_timestamp', { ascending: false })
          .limit(1);

        if (predictionError) throw predictionError;

        if (!predictionData?.length) {
          return NextResponse.json({
            success: false,
            error: 'No forecast data available. Run analysis first.'
          }, { status: 404 });
        }

        const forecast = predictionData[0];
        
        return NextResponse.json({
          success: true,
          service_id: serviceId,
          forecast: forecast.analysis_results,
          generated_at: forecast.analysis_timestamp,
          valid_until: endTime.toISOString()
        });
      }

      case 'metrics': {
        const period = searchParams.get('period') || '24h';
        
        // Calculate time range based on period
        const endTime = new Date();
        const startTime = new Date();
        
        switch (period) {
          case '1h':
            startTime.setHours(startTime.getHours() - 1);
            break;
          case '6h':
            startTime.setHours(startTime.getHours() - 6);
            break;
          case '24h':
            startTime.setDate(startTime.getDate() - 1);
            break;
          case '7d':
            startTime.setDate(startTime.getDate() - 7);
            break;
          default:
            startTime.setDate(startTime.getDate() - 1);
        }

        // Fetch scaling events and metrics
        const [eventsResult, metricsResult] = await Promise.all([
          supabase
            .from('scaling_events')
            .select('*')
            .eq('service_id', serviceId)
            .gte('timestamp', startTime.toISOString())
            .order('timestamp', { ascending: false }),
          
          supabase
            .from('metrics_history')
            .select('*')
            .eq('service_id', serviceId)
            .gte('timestamp', startTime.toISOString())
            .order('timestamp', { ascending: true })
        ]);

        if (eventsResult.error) throw eventsResult.error;
        if (metricsResult.error) throw metricsResult.error;

        // Calculate scaling efficiency metrics
        const events = eventsResult.data || [];
        const metrics = metricsResult.data || [];
        
        const scalingEfficiency = {
          total_scaling_events: events.length,
          successful_scalings: events.filter(e => e.success).length,
          scale_up_events: events.filter(e => e.action === 'scale_up').length,
          scale_down_events: events.filter(e => e.action === 'scale_down').length,
          avg_response_time: this.calculateAverageResponseTime(metrics),
          resource_utilization: this.calculateResourceUtilization(metrics)
        };

        return NextResponse.json({
          success: true,
          service_id: serviceId,
          period,
          scaling_events: events,
          metrics_summary: scalingEfficiency,
          time_range: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          }
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Predictive scaling GET API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// Helper methods for the class
async function executeScaling(scalingData: any): Promise<any> {
  try {
    // This would integrate with your container orchestration system
    // Example: Docker Swarm, Kubernetes, AWS ECS, etc.
    
    // Placeholder implementation
    return {
      success: true,
      instances: scalingData.target_instances || 1,
      action_taken: scalingData.action,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

function calculateAverageResponseTime(metrics: any[]): number {
  const responseTimes = metrics.filter(m => m.metric_type === 'response_time');
  if (responseTimes.length === 0) return 0;
  
  return responseTimes.reduce((sum, m) => sum + m.value, 0) / responseTimes.length;
}

function calculateResourceUtilization(metrics: any[]): any {
  const cpuMetrics = metrics.filter(m => m.metric_type === 'cpu');
  const memoryMetrics = metrics.filter(m => m.metric_type === 'memory');
  
  return {
    avg_cpu: cpuMetrics.length > 0 ? cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length : 0,
    avg_memory: memoryMetrics.length > 0 ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length : 0,
    peak_cpu: cpuMetrics.length > 0 ? Math.max(...cpuMetrics.map(m => m.value)) : 0,
    peak_memory: memoryMetrics.length > 0 ? Math.max(...memoryMetrics.map(m => m.value)) : 0
  };
}
```