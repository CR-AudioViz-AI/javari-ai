```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Validation schemas
const PredictScalingSchema = z.object({
  projectId: z.string().uuid(),
  timeHorizon: z.number().min(1).max(168), // 1-168 hours
  includeExternalFactors: z.boolean().default(true),
  resourceTypes: z.array(z.enum(['cpu', 'memory', 'storage', 'bandwidth'])).default(['cpu', 'memory']),
});

const ExecuteScalingSchema = z.object({
  projectId: z.string().uuid(),
  scalingActions: z.array(z.object({
    resourceType: z.enum(['cpu', 'memory', 'storage', 'bandwidth']),
    action: z.enum(['scale_up', 'scale_down', 'maintain']),
    targetCapacity: z.number().min(0),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    scheduledTime: z.string().datetime().optional(),
  })),
  dryRun: z.boolean().default(false),
});

// Types
interface UsageMetrics {
  timestamp: string;
  cpu_utilization: number;
  memory_utilization: number;
  storage_usage: number;
  bandwidth_usage: number;
  active_users: number;
  request_rate: number;
}

interface SeasonalPattern {
  pattern_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  peak_hours: number[];
  base_multiplier: number;
  seasonal_multiplier: number;
  confidence_score: number;
}

interface ExternalFactor {
  factor_type: 'weather' | 'events' | 'holidays' | 'marketing' | 'social_trends';
  impact_score: number;
  correlation_coefficient: number;
  forecast_data: any;
}

interface PredictionResult {
  predicted_demand: {
    cpu: number[];
    memory: number[];
    storage: number[];
    bandwidth: number[];
  };
  confidence_intervals: {
    lower_bound: number[];
    upper_bound: number[];
  };
  anomaly_detection: {
    anomaly_score: number;
    anomaly_threshold: number;
    is_anomalous: boolean;
  };
  recommended_actions: ScalingAction[];
}

interface ScalingAction {
  resource_type: string;
  action: string;
  target_capacity: number;
  priority: string;
  estimated_cost_impact: number;
  execution_time: string;
  rollback_plan: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class PredictiveScalingEngine {
  private async getHistoricalUsage(projectId: string, hours: number): Promise<UsageMetrics[]> {
    const { data, error } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('project_id', projectId)
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true });

    if (error) throw new Error(`Failed to fetch usage data: ${error.message}`);
    return data || [];
  }

  private async analyzeUsagePatterns(usageData: UsageMetrics[]): Promise<SeasonalPattern[]> {
    if (usageData.length < 24) {
      throw new Error('Insufficient data for pattern analysis (minimum 24 hours required)');
    }

    const patterns: SeasonalPattern[] = [];
    
    // Daily pattern analysis
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    usageData.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      hourlyAverages[hour] += metric.cpu_utilization;
      hourlyCounts[hour]++;
    });
    
    const dailyPattern = hourlyAverages.map((sum, hour) => 
      hourlyCounts[hour] > 0 ? sum / hourlyCounts[hour] : 0
    );
    
    const avgUtilization = dailyPattern.reduce((a, b) => a + b, 0) / 24;
    const peakHours = dailyPattern
      .map((util, hour) => ({ hour, util }))
      .filter(({ util }) => util > avgUtilization * 1.2)
      .map(({ hour }) => hour);

    patterns.push({
      pattern_type: 'daily',
      peak_hours: peakHours,
      base_multiplier: avgUtilization / 100,
      seasonal_multiplier: Math.max(...dailyPattern) / avgUtilization,
      confidence_score: this.calculateConfidenceScore(dailyPattern),
    });

    return patterns;
  }

  private calculateConfidenceScore(pattern: number[]): number {
    const mean = pattern.reduce((a, b) => a + b, 0) / pattern.length;
    const variance = pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pattern.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(1, 1 - (stdDev / mean)));
  }

  private async getExternalFactors(projectId: string): Promise<ExternalFactor[]> {
    try {
      const factors: ExternalFactor[] = [];
      
      // Weather factor (if applicable for the project type)
      const { data: projectData } = await supabase
        .from('projects')
        .select('location, industry')
        .eq('id', projectId)
        .single();

      if (projectData?.location) {
        const weatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${projectData.location}&appid=${process.env.OPENWEATHER_API_KEY}`
        );
        
        if (weatherResponse.ok) {
          const weatherData = await weatherResponse.json();
          factors.push({
            factor_type: 'weather',
            impact_score: this.calculateWeatherImpact(weatherData),
            correlation_coefficient: 0.3, // Historical correlation
            forecast_data: weatherData,
          });
        }
      }

      // Holiday/events factor
      const now = new Date();
      const isHoliday = this.checkHolidayPeriod(now);
      if (isHoliday) {
        factors.push({
          factor_type: 'holidays',
          impact_score: 1.5,
          correlation_coefficient: 0.7,
          forecast_data: { is_holiday: true, multiplier: 1.5 },
        });
      }

      return factors;
    } catch (error) {
      console.error('Error fetching external factors:', error);
      return [];
    }
  }

  private calculateWeatherImpact(weatherData: any): number {
    // Simplified weather impact calculation
    const avgTemp = weatherData.list
      .slice(0, 8) // Next 24 hours
      .reduce((sum: number, item: any) => sum + item.main.temp, 0) / 8;
    
    // Extreme temperatures might increase usage (more indoor activity)
    const tempImpact = Math.abs(avgTemp - 295) / 20; // 295K ≈ 22°C
    return Math.min(2, 1 + tempImpact);
  }

  private checkHolidayPeriod(date: Date): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Simplified holiday detection
    const holidays = [
      { month: 12, day: 25 }, // Christmas
      { month: 1, day: 1 },   // New Year
      { month: 7, day: 4 },   // Independence Day
      { month: 11, day: 24 }, // Thanksgiving (simplified)
    ];
    
    return holidays.some(holiday => 
      month === holiday.month && Math.abs(day - holiday.day) <= 1
    );
  }

  private async generatePredictions(
    usageData: UsageMetrics[],
    patterns: SeasonalPattern[],
    externalFactors: ExternalFactor[],
    timeHorizon: number,
    resourceTypes: string[]
  ): Promise<PredictionResult> {
    const predictions: PredictionResult = {
      predicted_demand: {
        cpu: [],
        memory: [],
        storage: [],
        bandwidth: [],
      },
      confidence_intervals: {
        lower_bound: [],
        upper_bound: [],
      },
      anomaly_detection: {
        anomaly_score: 0,
        anomaly_threshold: 0.8,
        is_anomalous: false,
      },
      recommended_actions: [],
    };

    // Time series forecasting using exponential smoothing
    for (const resourceType of resourceTypes) {
      const historicalValues = this.extractResourceValues(usageData, resourceType);
      const forecastValues = this.exponentialSmoothing(historicalValues, timeHorizon);
      
      // Apply seasonal patterns
      const seasonalAdjusted = this.applySeasonalAdjustment(forecastValues, patterns);
      
      // Apply external factor adjustments
      const factorAdjusted = this.applyExternalFactors(seasonalAdjusted, externalFactors);
      
      predictions.predicted_demand[resourceType as keyof typeof predictions.predicted_demand] = factorAdjusted;
      
      // Calculate confidence intervals (±20% for demonstration)
      predictions.confidence_intervals.lower_bound = factorAdjusted.map(val => val * 0.8);
      predictions.confidence_intervals.upper_bound = factorAdjusted.map(val => val * 1.2);
    }

    // Anomaly detection
    predictions.anomaly_detection = this.detectAnomalies(usageData);
    
    // Generate scaling recommendations
    predictions.recommended_actions = this.generateScalingRecommendations(predictions);

    return predictions;
  }

  private extractResourceValues(usageData: UsageMetrics[], resourceType: string): number[] {
    return usageData.map(metric => {
      switch (resourceType) {
        case 'cpu': return metric.cpu_utilization;
        case 'memory': return metric.memory_utilization;
        case 'storage': return metric.storage_usage;
        case 'bandwidth': return metric.bandwidth_usage;
        default: return 0;
      }
    });
  }

  private exponentialSmoothing(data: number[], periods: number, alpha: number = 0.3): number[] {
    if (data.length === 0) return [];
    
    const smoothed = [data[0]];
    for (let i = 1; i < data.length; i++) {
      smoothed[i] = alpha * data[i] + (1 - alpha) * smoothed[i - 1];
    }
    
    const forecast = [];
    let lastSmoothed = smoothed[smoothed.length - 1];
    
    for (let i = 0; i < periods; i++) {
      forecast.push(lastSmoothed);
    }
    
    return forecast;
  }

  private applySeasonalAdjustment(values: number[], patterns: SeasonalPattern[]): number[] {
    return values.map((value, index) => {
      let adjustment = 1;
      const hour = (new Date().getHours() + index) % 24;
      
      patterns.forEach(pattern => {
        if (pattern.pattern_type === 'daily' && pattern.peak_hours.includes(hour)) {
          adjustment *= pattern.seasonal_multiplier;
        }
      });
      
      return value * adjustment;
    });
  }

  private applyExternalFactors(values: number[], factors: ExternalFactor[]): number[] {
    return values.map(value => {
      let factorMultiplier = 1;
      
      factors.forEach(factor => {
        factorMultiplier *= factor.impact_score * Math.abs(factor.correlation_coefficient);
      });
      
      return value * factorMultiplier;
    });
  }

  private detectAnomalies(usageData: UsageMetrics[]): PredictionResult['anomaly_detection'] {
    if (usageData.length < 10) {
      return {
        anomaly_score: 0,
        anomaly_threshold: 0.8,
        is_anomalous: false,
      };
    }

    const recentData = usageData.slice(-5);
    const historicalData = usageData.slice(0, -5);
    
    const recentAvg = recentData.reduce((sum, m) => sum + m.cpu_utilization, 0) / recentData.length;
    const historicalAvg = historicalData.reduce((sum, m) => sum + m.cpu_utilization, 0) / historicalData.length;
    
    const anomalyScore = Math.abs(recentAvg - historicalAvg) / historicalAvg;
    
    return {
      anomaly_score: anomalyScore,
      anomaly_threshold: 0.8,
      is_anomalous: anomalyScore > 0.8,
    };
  }

  private generateScalingRecommendations(predictions: PredictionResult): ScalingAction[] {
    const actions: ScalingAction[] = [];
    
    Object.entries(predictions.predicted_demand).forEach(([resourceType, values]) => {
      const maxPredicted = Math.max(...values);
      const avgPredicted = values.reduce((a, b) => a + b, 0) / values.length;
      
      if (maxPredicted > 80) { // 80% threshold
        actions.push({
          resource_type: resourceType,
          action: 'scale_up',
          target_capacity: Math.ceil(maxPredicted * 1.2),
          priority: maxPredicted > 90 ? 'high' : 'medium',
          estimated_cost_impact: this.calculateCostImpact(resourceType, 'scale_up'),
          execution_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          rollback_plan: `Scale down to ${avgPredicted}% after demand peak`,
        });
      } else if (maxPredicted < 30) { // 30% threshold
        actions.push({
          resource_type: resourceType,
          action: 'scale_down',
          target_capacity: Math.max(40, Math.ceil(avgPredicted * 1.1)),
          priority: 'low',
          estimated_cost_impact: this.calculateCostImpact(resourceType, 'scale_down'),
          execution_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          rollback_plan: `Scale up immediately if utilization exceeds 70%`,
        });
      }
    });
    
    return actions;
  }

  private calculateCostImpact(resourceType: string, action: string): number {
    const baseCosts = {
      cpu: 0.05,     // per hour per unit
      memory: 0.02,  // per hour per GB
      storage: 0.10, // per hour per GB
      bandwidth: 0.01, // per hour per Mbps
    };
    
    const cost = baseCosts[resourceType as keyof typeof baseCosts] || 0;
    return action === 'scale_up' ? cost * 24 : -cost * 24; // Daily impact
  }

  async predictScalingNeeds(params: z.infer<typeof PredictScalingSchema>): Promise<PredictionResult> {
    const usageData = await this.getHistoricalUsage(params.projectId, Math.max(168, params.timeHorizon * 2));
    const patterns = await this.analyzeUsagePatterns(usageData);
    const externalFactors = params.includeExternalFactors 
      ? await this.getExternalFactors(params.projectId)
      : [];

    return this.generatePredictions(
      usageData,
      patterns,
      externalFactors,
      params.timeHorizon,
      params.resourceTypes
    );
  }

  async executeScalingActions(params: z.infer<typeof ExecuteScalingSchema>): Promise<any> {
    const results = [];
    
    for (const action of params.scalingActions) {
      try {
        if (params.dryRun) {
          results.push({
            action,
            status: 'simulated',
            message: 'Dry run - no actual scaling performed',
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Log scaling action
        const { error } = await supabase
          .from('scaling_actions')
          .insert({
            project_id: params.projectId,
            resource_type: action.resourceType,
            action: action.action,
            target_capacity: action.targetCapacity,
            priority: action.priority,
            scheduled_time: action.scheduledTime || new Date().toISOString(),
            status: 'pending',
          });

        if (error) throw error;

        // Here you would integrate with actual infrastructure APIs
        // For demonstration, we'll simulate the scaling action
        results.push({
          action,
          status: 'executed',
          message: 'Scaling action queued successfully',
          timestamp: new Date().toISOString(),
          estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });

      } catch (error) {
        results.push({
          action,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }
}

// Initialize the predictive scaling engine
const scalingEngine = new PredictiveScalingEngine();

// POST /api/predictive-auto-scaling/predict
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const params = PredictScalingSchema.parse(body);

    const predictions = await scalingEngine.predictScalingNeeds(params);

    return NextResponse.json({
      success: true,
      data: predictions,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Predictive scaling error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/predictive-auto-scaling/predict-scaling-needs
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const timeHorizon = parseInt(searchParams.get('timeHorizon') || '24');
    const includeExternalFactors = searchParams.get('includeExternalFactors') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const params = {
      projectId,
      timeHorizon,
      includeExternalFactors,
      resourceTypes: ['cpu', 'memory'] as const,
    };

    const predictions = await scalingEngine.predictScalingNeeds(params);

    return NextResponse.json({
      success: true,
      data: predictions,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get scaling predictions error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/predictive-auto-scaling/execute-scaling
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const params = ExecuteScalingSchema.parse(body);

    const results = await scalingEngine.executeScalingActions(params);

    return NextResponse.json({
      success: true,
      data: {
        execution_results: results,
        summary: {
          total_actions: params.scalingActions.length,
          successful: results.filter(r => r.status === 'executed').length,
          failed: results.filter(r => r.status === 'failed').length,
          simulated: results.filter(r => r.status === 'simulated').length,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Execute scaling error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```