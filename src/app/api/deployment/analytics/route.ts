```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import Redis from 'ioredis';

// Types
interface DeploymentMetrics {
  id: string;
  deployment_id: string;
  success_rate: number;
  performance_impact: number;
  reliability_score: number;
  failure_prediction: number;
  timestamp: string;
  environment: string;
  service_name: string;
}

interface AnalyticsQuery {
  timeRange: '24h' | '7d' | '30d' | '90d';
  environment?: string;
  service?: string;
  metric?: 'success_rate' | 'performance' | 'reliability' | 'predictions';
}

interface PredictiveAnalysis {
  failure_probability: number;
  risk_factors: string[];
  recommended_actions: string[];
  confidence_level: number;
}

// Validation schemas
const analyticsQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d']).default('24h'),
  environment: z.string().optional(),
  service: z.string().optional(),
  metric: z.enum(['success_rate', 'performance', 'reliability', 'predictions']).optional(),
});

const alertConfigSchema = z.object({
  metric: z.string(),
  threshold: z.number().min(0).max(100),
  environment: z.string(),
  notification_channels: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

// Redis client
const redis = new Redis(process.env.REDIS_URL!);

class DeploymentAnalyticsService {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async getAnalyticsDashboard(query: AnalyticsQuery) {
    const cacheKey = `analytics:dashboard:${JSON.stringify(query)}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const timeFilter = this.getTimeFilter(query.timeRange);
    
    // Get deployment success rates
    const successRates = await this.getSuccessRates(timeFilter, query);
    
    // Get performance impact metrics
    const performanceMetrics = await this.getPerformanceMetrics(timeFilter, query);
    
    // Get reliability scores
    const reliabilityScores = await this.getReliabilityScores(timeFilter, query);
    
    // Get predictive analysis
    const predictions = await this.getPredictiveAnalysis(query);

    const dashboard = {
      success_rates: successRates,
      performance_metrics: performanceMetrics,
      reliability_scores: reliabilityScores,
      predictions,
      summary: {
        total_deployments: successRates.total_deployments,
        overall_success_rate: successRates.overall_success_rate,
        average_performance_impact: performanceMetrics.average_impact,
        system_reliability: reliabilityScores.overall_score,
        risk_level: predictions.overall_risk_level,
      },
      generated_at: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(dashboard));
    
    return dashboard;
  }

  async getSuccessRates(timeFilter: string, query: AnalyticsQuery) {
    let queryBuilder = this.supabase
      .from('deployment_logs')
      .select(`
        id,
        status,
        environment,
        service_name,
        created_at,
        duration,
        error_message
      `)
      .gte('created_at', timeFilter);

    if (query.environment) {
      queryBuilder = queryBuilder.eq('environment', query.environment);
    }

    if (query.service) {
      queryBuilder = queryBuilder.eq('service_name', query.service);
    }

    const { data: deployments, error } = await queryBuilder;

    if (error) {
      throw new Error(`Failed to fetch deployment data: ${error.message}`);
    }

    const totalDeployments = deployments.length;
    const successfulDeployments = deployments.filter(d => d.status === 'success').length;
    const failedDeployments = deployments.filter(d => d.status === 'failed').length;
    
    // Group by environment and service
    const byEnvironment = this.groupByField(deployments, 'environment');
    const byService = this.groupByField(deployments, 'service_name');
    
    // Calculate trends
    const trends = this.calculateTrends(deployments, query.timeRange);

    return {
      total_deployments: totalDeployments,
      successful_deployments: successfulDeployments,
      failed_deployments: failedDeployments,
      overall_success_rate: totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0,
      by_environment: byEnvironment,
      by_service: byService,
      trends,
      failure_reasons: this.analyzeFailureReasons(deployments),
    };
  }

  async getPerformanceMetrics(timeFilter: string, query: AnalyticsQuery) {
    let queryBuilder = this.supabase
      .from('system_metrics')
      .select(`
        deployment_id,
        cpu_usage,
        memory_usage,
        response_time,
        error_rate,
        throughput,
        timestamp,
        environment,
        service_name
      `)
      .gte('timestamp', timeFilter);

    if (query.environment) {
      queryBuilder = queryBuilder.eq('environment', query.environment);
    }

    if (query.service) {
      queryBuilder = queryBuilder.eq('service_name', query.service);
    }

    const { data: metrics, error } = await queryBuilder;

    if (error) {
      throw new Error(`Failed to fetch performance metrics: ${error.message}`);
    }

    // Calculate performance impact scores
    const performanceScores = metrics.map(metric => this.calculatePerformanceScore(metric));
    
    return {
      average_impact: this.calculateAverage(performanceScores),
      cpu_utilization: {
        average: this.calculateAverage(metrics.map(m => m.cpu_usage)),
        peak: Math.max(...metrics.map(m => m.cpu_usage)),
        trend: this.calculateTrend(metrics.map(m => m.cpu_usage)),
      },
      memory_utilization: {
        average: this.calculateAverage(metrics.map(m => m.memory_usage)),
        peak: Math.max(...metrics.map(m => m.memory_usage)),
        trend: this.calculateTrend(metrics.map(m => m.memory_usage)),
      },
      response_times: {
        average: this.calculateAverage(metrics.map(m => m.response_time)),
        p95: this.calculatePercentile(metrics.map(m => m.response_time), 95),
        p99: this.calculatePercentile(metrics.map(m => m.response_time), 99),
      },
      error_rates: {
        average: this.calculateAverage(metrics.map(m => m.error_rate)),
        peak: Math.max(...metrics.map(m => m.error_rate)),
      },
      throughput: {
        average: this.calculateAverage(metrics.map(m => m.throughput)),
        peak: Math.max(...metrics.map(m => m.throughput)),
      },
    };
  }

  async getReliabilityScores(timeFilter: string, query: AnalyticsQuery) {
    let queryBuilder = this.supabase
      .from('reliability_scores')
      .select('*')
      .gte('calculated_at', timeFilter);

    if (query.environment) {
      queryBuilder = queryBuilder.eq('environment', query.environment);
    }

    if (query.service) {
      queryBuilder = queryBuilder.eq('service_name', query.service);
    }

    const { data: scores, error } = await queryBuilder;

    if (error) {
      throw new Error(`Failed to fetch reliability scores: ${error.message}`);
    }

    const overallScore = this.calculateAverage(scores.map(s => s.reliability_score));
    
    return {
      overall_score: overallScore,
      availability: this.calculateAverage(scores.map(s => s.availability_score)),
      stability: this.calculateAverage(scores.map(s => s.stability_score)),
      recovery_time: this.calculateAverage(scores.map(s => s.mean_recovery_time)),
      incident_frequency: this.calculateAverage(scores.map(s => s.incident_frequency)),
      by_component: this.groupReliabilityByComponent(scores),
      trends: this.calculateReliabilityTrends(scores),
    };
  }

  async getPredictiveAnalysis(query: AnalyticsQuery): Promise<PredictiveAnalysis & { overall_risk_level: string }> {
    // Fetch historical data for ML prediction
    const { data: historicalData, error } = await this.supabase
      .from('deployment_analytics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to fetch historical data: ${error.message}`);
    }

    // Simple predictive model (in production, use proper ML models)
    const riskFactors = await this.identifyRiskFactors(historicalData);
    const failureProbability = this.calculateFailureProbability(historicalData, riskFactors);
    
    return {
      failure_probability: failureProbability,
      risk_factors: riskFactors,
      recommended_actions: this.generateRecommendations(riskFactors, failureProbability),
      confidence_level: this.calculateConfidenceLevel(historicalData.length),
      overall_risk_level: this.categorizeRiskLevel(failureProbability),
    };
  }

  async configureAlerts(config: any) {
    const { data, error } = await this.supabase
      .from('deployment_alerts')
      .insert({
        metric: config.metric,
        threshold: config.threshold,
        environment: config.environment,
        notification_channels: config.notification_channels,
        severity: config.severity,
        created_at: new Date().toISOString(),
        is_active: true,
      });

    if (error) {
      throw new Error(`Failed to configure alert: ${error.message}`);
    }

    return data;
  }

  private getTimeFilter(timeRange: string): string {
    const now = new Date();
    const hours = {
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30,
      '90d': 24 * 90,
    };

    return new Date(now.getTime() - hours[timeRange] * 60 * 60 * 1000).toISOString();
  }

  private groupByField(data: any[], field: string) {
    return data.reduce((acc, item) => {
      const key = item[field] || 'unknown';
      if (!acc[key]) {
        acc[key] = { total: 0, successful: 0, failed: 0 };
      }
      acc[key].total++;
      if (item.status === 'success') acc[key].successful++;
      if (item.status === 'failed') acc[key].failed++;
      acc[key].success_rate = (acc[key].successful / acc[key].total) * 100;
      return acc;
    }, {});
  }

  private calculateTrends(deployments: any[], timeRange: string) {
    // Implementation for trend calculation
    const timeSlices = this.createTimeSlices(deployments, timeRange);
    return timeSlices.map(slice => ({
      period: slice.period,
      success_rate: slice.successful / slice.total * 100,
      total_deployments: slice.total,
    }));
  }

  private createTimeSlices(deployments: any[], timeRange: string) {
    // Group deployments by time periods
    const sliceSize = timeRange === '24h' ? 1 : timeRange === '7d' ? 6 : 24; // hours
    const slices = [];
    
    for (let i = 0; i < 24 / sliceSize; i++) {
      slices.push({
        period: `Slice ${i}`,
        total: 0,
        successful: 0,
        failed: 0,
      });
    }
    
    return slices;
  }

  private calculatePerformanceScore(metric: any): number {
    // Weighted performance scoring
    const cpuWeight = 0.3;
    const memoryWeight = 0.3;
    const responseTimeWeight = 0.2;
    const errorRateWeight = 0.2;

    const cpuScore = Math.max(0, 100 - metric.cpu_usage);
    const memoryScore = Math.max(0, 100 - metric.memory_usage);
    const responseTimeScore = Math.max(0, 100 - (metric.response_time / 10));
    const errorRateScore = Math.max(0, 100 - metric.error_rate);

    return (
      cpuScore * cpuWeight +
      memoryScore * memoryWeight +
      responseTimeScore * responseTimeWeight +
      errorRateScore * errorRateWeight
    );
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    const first = values[0];
    const last = values[values.length - 1];
    const threshold = 0.05; // 5% threshold
    
    if ((last - first) / first > threshold) return 'increasing';
    if ((first - last) / first > threshold) return 'decreasing';
    return 'stable';
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private analyzeFailureReasons(deployments: any[]) {
    const failedDeployments = deployments.filter(d => d.status === 'failed');
    const reasons = failedDeployments.reduce((acc, deployment) => {
      const reason = deployment.error_message || 'Unknown error';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(reasons)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));
  }

  private groupReliabilityByComponent(scores: any[]) {
    return scores.reduce((acc, score) => {
      const component = score.component_name || 'unknown';
      if (!acc[component]) {
        acc[component] = [];
      }
      acc[component].push(score.reliability_score);
      return acc;
    }, {});
  }

  private calculateReliabilityTrends(scores: any[]) {
    // Calculate reliability trends over time
    return scores.map(score => ({
      timestamp: score.calculated_at,
      reliability_score: score.reliability_score,
      availability: score.availability_score,
      stability: score.stability_score,
    }));
  }

  private async identifyRiskFactors(historicalData: any[]): Promise<string[]> {
    const riskFactors = [];
    
    // Analyze patterns in historical failures
    const recentFailures = historicalData.filter(d => d.status === 'failed').slice(0, 50);
    
    if (recentFailures.length > historicalData.length * 0.1) {
      riskFactors.push('High recent failure rate');
    }
    
    // Check for performance degradation patterns
    const avgPerformance = this.calculateAverage(historicalData.map(d => d.performance_score || 0));
    if (avgPerformance < 70) {
      riskFactors.push('Performance degradation detected');
    }
    
    // Check deployment frequency
    const deploymentFrequency = historicalData.length / 30; // per day
    if (deploymentFrequency > 10) {
      riskFactors.push('High deployment frequency');
    }
    
    return riskFactors;
  }

  private calculateFailureProbability(historicalData: any[], riskFactors: string[]): number {
    let baseProbability = 0.1; // 10% base failure rate
    
    // Adjust based on risk factors
    baseProbability += riskFactors.length * 0.05;
    
    // Adjust based on recent failure rate
    const recentFailures = historicalData.slice(0, 100);
    const failureRate = recentFailures.filter(d => d.status === 'failed').length / recentFailures.length;
    baseProbability += failureRate * 0.3;
    
    return Math.min(baseProbability * 100, 95); // Cap at 95%
  }

  private generateRecommendations(riskFactors: string[], failureProbability: number): string[] {
    const recommendations = [];
    
    if (failureProbability > 50) {
      recommendations.push('Implement canary deployments');
      recommendations.push('Increase monitoring and alerting');
    }
    
    if (riskFactors.includes('Performance degradation detected')) {
      recommendations.push('Review resource allocation');
      recommendations.push('Optimize application performance');
    }
    
    if (riskFactors.includes('High deployment frequency')) {
      recommendations.push('Consider batch deployments');
      recommendations.push('Implement deployment throttling');
    }
    
    return recommendations;
  }

  private calculateConfidenceLevel(dataPoints: number): number {
    return Math.min((dataPoints / 1000) * 100, 95);
  }

  private categorizeRiskLevel(probability: number): string {
    if (probability > 70) return 'critical';
    if (probability > 40) return 'high';
    if (probability > 20) return 'medium';
    return 'low';
  }
}

// GET - Retrieve deployment analytics
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      timeRange: (searchParams.get('timeRange') as AnalyticsQuery['timeRange']) || '24h',
      environment: searchParams.get('environment') || undefined,
      service: searchParams.get('service') || undefined,
      metric: (searchParams.get('metric') as AnalyticsQuery['metric']) || undefined,
    };

    const validatedQuery = analyticsQuerySchema.parse(queryParams);
    const analyticsService = new DeploymentAnalyticsService(supabase);

    // Handle specific metric requests
    if (validatedQuery.metric) {
      const timeFilter = new Date(Date.now() - 
        ({ '24h': 24, '7d': 168, '30d': 720, '90d': 2160 }[validatedQuery.timeRange] * 60 * 60 * 1000)
      ).toISOString();

      let result;
      switch (validatedQuery.metric) {
        case 'success_rate':
          result = await analyticsService.getSuccessRates(timeFilter, validatedQuery);
          break;
        case 'performance':
          result = await analyticsService.getPerformanceMetrics(timeFilter, validatedQuery);
          break;
        case 'reliability':
          result = await analyticsService.getReliabilityScores(timeFilter, validatedQuery);
          break;
        case 'predictions':
          result = await analyticsService.getPredictiveAnalysis(validatedQuery);
          break;
      }
      
      return NextResponse.json({ 
        success: true, 
        data: result,
        metric: validatedQuery.metric,
        query: validatedQuery 
      });
    }

    // Get full dashboard analytics
    const analytics = await analyticsService.getAnalyticsDashboard(validatedQuery);

    return NextResponse.json({ 
      success: true, 
      data: analytics,
      query: validatedQuery 
    });

  } catch (error) {
    console.error('Deployment analytics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve deployment analytics' 
      },
      { status: 500 }
    );
  }
}

// POST - Configure deployment alerts
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedConfig = alertConfigSchema.parse(body);

    const analyticsService = new DeploymentAnalyticsService(supabase);
    const result = await analyticsService.configureAlerts(validatedConfig);

    return NextResponse.json({ 
      success: true, 
      data: result,
      message: 'Alert configuration saved successfully' 
    });

  } catch (error) {
    console.error('Alert configuration error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid alert configuration',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to configure alert' 
      },
      { status: 500 }
    );
  }
}
```