import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';

/**
 * Interface for capacity metrics data
 */
export interface CapacityMetrics {
  id: string;
  timestamp: Date;
  cpuUtilization: number;
  memoryUtilization: number;
  storageUtilization: number;
  networkThroughput: number;
  activeUsers: number;
  requestVolume: number;
  responseTime: number;
  errorRate: number;
  metadata?: Record<string, any>;
}

/**
 * Interface for seasonal trend analysis results
 */
export interface SeasonalTrends {
  weeklyPattern: number[];
  monthlyPattern: number[];
  yearlyPattern: number[];
  peakHours: number[];
  lowUsagePeriods: number[];
  seasonalityStrength: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Interface for business growth projections
 */
export interface BusinessGrowthProjection {
  userGrowthRate: number;
  revenueGrowthRate: number;
  marketExpansionFactor: number;
  productLaunchImpact: number;
  seasonalMultiplier: number;
  confidenceLevel: number;
  projectionPeriod: number; // months
}

/**
 * Interface for capacity predictions
 */
export interface CapacityPrediction {
  timestamp: Date;
  predictedCpuUtilization: number;
  predictedMemoryUtilization: number;
  predictedStorageUtilization: number;
  predictedNetworkThroughput: number;
  predictedActiveUsers: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Interface for scaling recommendations
 */
export interface ScalingRecommendation {
  id: string;
  type: 'scale_up' | 'scale_down' | 'scale_out' | 'scale_in';
  resource: 'cpu' | 'memory' | 'storage' | 'network' | 'instances';
  currentCapacity: number;
  recommendedCapacity: number;
  urgency: 'immediate' | 'within_week' | 'within_month' | 'future_planning';
  estimatedCost: number;
  costBenefit: number;
  implementation: {
    steps: string[];
    estimatedTime: number;
    dependencies: string[];
  };
  reasoning: string;
  createdAt: Date;
}

/**
 * Interface for capacity alerts
 */
export interface CapacityAlert {
  id: string;
  type: 'threshold_exceeded' | 'capacity_shortage' | 'growth_spike' | 'cost_anomaly';
  severity: 'info' | 'warning' | 'error' | 'critical';
  resource: string;
  currentValue: number;
  thresholdValue: number;
  predictedImpact: string;
  recommendedAction: string;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Interface for model training configuration
 */
export interface ModelConfig {
  sequenceLength: number;
  predictionHorizon: number;
  features: string[];
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStoppingPatience: number;
}

/**
 * Interface for service configuration
 */
export interface PredictiveCapacityConfig {
  supabaseUrl: string;
  supabaseKey: string;
  modelConfig: ModelConfig;
  alertThresholds: Record<string, number>;
  retentionPeriod: number; // days
  predictionAccuracy: number;
}

/**
 * Collects and aggregates historical capacity metrics
 */
class CapacityMetricsCollector {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Collect historical metrics from various sources
   */
  async collectHistoricalData(
    startDate: Date,
    endDate: Date,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<CapacityMetrics[]> {
    try {
      const { data, error } = await this.supabase
        .from('capacity_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return this.aggregateByGranularity(data || [], granularity);
    } catch (error) {
      throw new Error(`Failed to collect historical data: ${error}`);
    }
  }

  /**
   * Store new capacity metrics
   */
  async storeMetrics(metrics: CapacityMetrics[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('capacity_metrics')
        .insert(metrics);

      if (error) throw error;
    } catch (error) {
      throw new Error(`Failed to store metrics: ${error}`);
    }
  }

  /**
   * Aggregate metrics by time granularity
   */
  private aggregateByGranularity(
    metrics: CapacityMetrics[],
    granularity: 'minute' | 'hour' | 'day'
  ): CapacityMetrics[] {
    const groupSize = granularity === 'minute' ? 1 : granularity === 'hour' ? 60 : 1440;
    const grouped = new Map<string, CapacityMetrics[]>();

    metrics.forEach(metric => {
      const date = new Date(metric.timestamp);
      let key: string;

      switch (granularity) {
        case 'minute':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
          break;
        case 'hour':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
          break;
        case 'day':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    return Array.from(grouped.entries()).map(([key, groupMetrics]) => {
      const avgMetric: CapacityMetrics = {
        id: `agg-${key}`,
        timestamp: groupMetrics[0].timestamp,
        cpuUtilization: this.average(groupMetrics.map(m => m.cpuUtilization)),
        memoryUtilization: this.average(groupMetrics.map(m => m.memoryUtilization)),
        storageUtilization: this.average(groupMetrics.map(m => m.storageUtilization)),
        networkThroughput: this.average(groupMetrics.map(m => m.networkThroughput)),
        activeUsers: Math.round(this.average(groupMetrics.map(m => m.activeUsers))),
        requestVolume: Math.round(this.average(groupMetrics.map(m => m.requestVolume))),
        responseTime: this.average(groupMetrics.map(m => m.responseTime)),
        errorRate: this.average(groupMetrics.map(m => m.errorRate)),
      };
      return avgMetric;
    });
  }

  private average(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

/**
 * Analyzes seasonal trends and patterns in usage data
 */
class SeasonalTrendAnalyzer {
  /**
   * Analyze seasonal trends in capacity metrics
   */
  async analyzeSeasonalTrends(metrics: CapacityMetrics[]): Promise<SeasonalTrends> {
    try {
      const weeklyPattern = this.analyzeWeeklyPattern(metrics);
      const monthlyPattern = this.analyzeMonthlyPattern(metrics);
      const yearlyPattern = this.analyzeYearlyPattern(metrics);
      const peakHours = this.identifyPeakHours(metrics);
      const lowUsagePeriods = this.identifyLowUsagePeriods(metrics);
      const seasonalityStrength = this.calculateSeasonalityStrength(metrics);
      const trendDirection = this.determineTrendDirection(metrics);

      return {
        weeklyPattern,
        monthlyPattern,
        yearlyPattern,
        peakHours,
        lowUsagePeriods,
        seasonalityStrength,
        trendDirection
      };
    } catch (error) {
      throw new Error(`Failed to analyze seasonal trends: ${error}`);
    }
  }

  private analyzeWeeklyPattern(metrics: CapacityMetrics[]): number[] {
    const weeklyData = Array(7).fill(0).map(() => []);
    
    metrics.forEach(metric => {
      const dayOfWeek = new Date(metric.timestamp).getDay();
      weeklyData[dayOfWeek].push(metric.cpuUtilization);
    });

    return weeklyData.map(dayData => 
      dayData.length > 0 ? dayData.reduce((sum: number, val: number) => sum + val, 0) / dayData.length : 0
    );
  }

  private analyzeMonthlyPattern(metrics: CapacityMetrics[]): number[] {
    const monthlyData = Array(12).fill(0).map(() => []);
    
    metrics.forEach(metric => {
      const month = new Date(metric.timestamp).getMonth();
      monthlyData[month].push(metric.cpuUtilization);
    });

    return monthlyData.map(monthData => 
      monthData.length > 0 ? monthData.reduce((sum: number, val: number) => sum + val, 0) / monthData.length : 0
    );
  }

  private analyzeYearlyPattern(metrics: CapacityMetrics[]): number[] {
    const yearlyData = new Map<number, number[]>();
    
    metrics.forEach(metric => {
      const year = new Date(metric.timestamp).getFullYear();
      if (!yearlyData.has(year)) {
        yearlyData.set(year, []);
      }
      yearlyData.get(year)!.push(metric.cpuUtilization);
    });

    return Array.from(yearlyData.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, data]) => data.reduce((sum, val) => sum + val, 0) / data.length);
  }

  private identifyPeakHours(metrics: CapacityMetrics[]): number[] {
    const hourlyUtilization = Array(24).fill(0).map(() => []);
    
    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      hourlyUtilization[hour].push(metric.cpuUtilization);
    });

    const avgHourlyUtilization = hourlyUtilization.map((hourData, hour) => ({
      hour,
      avgUtilization: hourData.length > 0 ? hourData.reduce((sum: number, val: number) => sum + val, 0) / hourData.length : 0
    }));

    const sortedByUtilization = avgHourlyUtilization
      .sort((a, b) => b.avgUtilization - a.avgUtilization);

    return sortedByUtilization.slice(0, 6).map(item => item.hour);
  }

  private identifyLowUsagePeriods(metrics: CapacityMetrics[]): number[] {
    const hourlyUtilization = Array(24).fill(0).map(() => []);
    
    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      hourlyUtilization[hour].push(metric.cpuUtilization);
    });

    const avgHourlyUtilization = hourlyUtilization.map((hourData, hour) => ({
      hour,
      avgUtilization: hourData.length > 0 ? hourData.reduce((sum: number, val: number) => sum + val, 0) / hourData.length : 0
    }));

    const sortedByUtilization = avgHourlyUtilization
      .sort((a, b) => a.avgUtilization - b.avgUtilization);

    return sortedByUtilization.slice(0, 6).map(item => item.hour);
  }

  private calculateSeasonalityStrength(metrics: CapacityMetrics[]): number {
    if (metrics.length < 2) return 0;

    const values = metrics.map(m => m.cpuUtilization);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.min(1, variance / (mean * mean));
  }

  private determineTrendDirection(metrics: CapacityMetrics[]): 'increasing' | 'decreasing' | 'stable' {
    if (metrics.length < 10) return 'stable';

    const recentMetrics = metrics.slice(-30);
    const olderMetrics = metrics.slice(-60, -30);

    const recentAvg = recentMetrics.reduce((sum, m) => sum + m.cpuUtilization, 0) / recentMetrics.length;
    const olderAvg = olderMetrics.reduce((sum, m) => sum + m.cpuUtilization, 0) / olderMetrics.length;

    const difference = (recentAvg - olderAvg) / olderAvg;

    if (difference > 0.05) return 'increasing';
    if (difference < -0.05) return 'decreasing';
    return 'stable';
  }
}

/**
 * Projects business growth and its impact on capacity requirements
 */
class BusinessGrowthProjector {
  /**
   * Calculate business growth projections
   */
  async calculateGrowthProjections(
    historicalMetrics: CapacityMetrics[],
    businessMetrics: {
      userGrowth: number[];
      revenueGrowth: number[];
      marketEvents: { date: Date; impact: number }[];
    }
  ): Promise<BusinessGrowthProjection> {
    try {
      const userGrowthRate = this.calculateGrowthRate(businessMetrics.userGrowth);
      const revenueGrowthRate = this.calculateGrowthRate(businessMetrics.revenueGrowth);
      const marketExpansionFactor = this.calculateMarketExpansionFactor(businessMetrics.marketEvents);
      const productLaunchImpact = this.estimateProductLaunchImpact(businessMetrics.marketEvents);
      const seasonalMultiplier = this.calculateSeasonalMultiplier(historicalMetrics);
      const confidenceLevel = this.calculateConfidenceLevel(historicalMetrics, businessMetrics);

      return {
        userGrowthRate,
        revenueGrowthRate,
        marketExpansionFactor,
        productLaunchImpact,
        seasonalMultiplier,
        confidenceLevel,
        projectionPeriod: 12
      };
    } catch (error) {
      throw new Error(`Failed to calculate growth projections: ${error}`);
    }
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const periods = values.length - 1;
    
    return Math.pow(lastValue / firstValue, 1 / periods) - 1;
  }

  private calculateMarketExpansionFactor(events: { date: Date; impact: number }[]): number {
    const recentEvents = events.filter(event => {
      const monthsAgo = (Date.now() - event.date.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo <= 12;
    });

    const totalImpact = recentEvents.reduce((sum, event) => sum + event.impact, 0);
    return Math.max(1, 1 + totalImpact);
  }

  private estimateProductLaunchImpact(events: { date: Date; impact: number }[]): number {
    const launchEvents = events.filter(event => event.impact > 0.1);
    if (launchEvents.length === 0) return 1;

    const avgImpact = launchEvents.reduce((sum, event) => sum + event.impact, 0) / launchEvents.length;
    return Math.max(1, 1 + avgImpact);
  }

  private calculateSeasonalMultiplier(metrics: CapacityMetrics[]): number {
    const monthlyAverages = Array(12).fill(0).map(() => []);
    
    metrics.forEach(metric => {
      const month = new Date(metric.timestamp).getMonth();
      monthlyAverages[month].push(metric.cpuUtilization);
    });

    const monthlyAvgs = monthlyAverages.map(monthData => 
      monthData.length > 0 ? monthData.reduce((sum: number, val: number) => sum + val, 0) / monthData.length : 0
    );

    const overallAvg = monthlyAvgs.reduce((sum, val) => sum + val, 0) / monthlyAvgs.length;
    const maxMonthlyAvg = Math.max(...monthlyAvgs);
    
    return maxMonthlyAvg / overallAvg;
  }

  private calculateConfidenceLevel(
    historicalMetrics: CapacityMetrics[],
    businessMetrics: { userGrowth: number[]; revenueGrowth: number[] }
  ): number {
    const historicalVariability = this.calculateVariability(historicalMetrics.map(m => m.cpuUtilization));
    const businessVariability = this.calculateVariability(businessMetrics.userGrowth);
    
    const dataQuality = Math.min(1, historicalMetrics.length / 1000);
    const stability = Math.max(0, 1 - (historicalVariability + businessVariability) / 2);
    
    return (dataQuality + stability) / 2;
  }

  private calculateVariability(values: number[]): number {
    if (values.length < 2) return 1;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean;
  }
}

/**
 * Generates capacity recommendations based on predictions
 */
class CapacityRecommendationEngine {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generate scaling recommendations based on predictions
   */
  async generateRecommendations(
    predictions: CapacityPrediction[],
    currentCapacity: Record<string, number>,
    constraints: {
      budget: number;
      timeline: number;
      riskTolerance: 'low' | 'medium' | 'high';
    }
  ): Promise<ScalingRecommendation[]> {
    try {
      const recommendations: ScalingRecommendation[] = [];

      // Analyze CPU recommendations
      const cpuRecommendations = await this.analyzeCpuRequirements(predictions, currentCapacity, constraints);
      recommendations.push(...cpuRecommendations);

      // Analyze Memory recommendations
      const memoryRecommendations = await this.analyzeMemoryRequirements(predictions, currentCapacity, constraints);
      recommendations.push(...memoryRecommendations);

      // Analyze Storage recommendations
      const storageRecommendations = await this.analyzeStorageRequirements(predictions, currentCapacity, constraints);
      recommendations.push(...storageRecommendations);

      // Prioritize recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(recommendations, constraints);

      // Store recommendations
      await this.storeRecommendations(prioritizedRecommendations);

      return prioritizedRecommendations;
    } catch (error) {
      throw new Error(`Failed to generate recommendations: ${error}`);
    }
  }

  private async analyzeCpuRequirements(
    predictions: CapacityPrediction[],
    currentCapacity: Record<string, number>,
    constraints: any
  ): Promise<ScalingRecommendation[]> {
    const recommendations: ScalingRecommendation[] = [];
    const currentCpu = currentCapacity.cpu || 0;

    predictions.forEach((prediction, index) => {
      const utilizationThreshold = constraints.riskTolerance === 'low' ? 70 : 
                                 constraints.riskTolerance === 'medium' ? 80 : 90;

      if (prediction.predictedCpuUtilization > utilizationThreshold) {
        const recommendedCapacity = Math.ceil(currentCpu * (prediction.predictedCpuUtilization / utilizationThreshold));
        const urgency = this.determineUrgency(prediction.timestamp, prediction.riskLevel);

        recommendations.push({
          id: `cpu-scale-up-${index}`,
          type: 'scale_up',
          resource: 'cpu',
          currentCapacity: currentCpu,
          recommendedCapacity,
          urgency,
          estimatedCost: this.estimateCpuScalingCost(currentCpu, recommendedCapacity),
          costBenefit: this.calculateCostBenefit(prediction.riskLevel, recommendedCapacity - currentCpu),
          implementation: {
            steps: [
              'Evaluate current CPU usage patterns',
              'Plan scaling schedule during low-usage periods',
              'Execute CPU scaling',
              'Monitor performance improvements'
            ],
            estimatedTime: 2, // hours
            dependencies: ['monitoring-system', 'auto-scaling-service']
          },
          reasoning: `CPU utilization predicted to reach ${prediction.predictedCpuUtilization}%, exceeding ${utilizationThreshold}% threshold`,
          createdAt: new Date()
        });
      }
    });

    return recommendations;
  }

  private async analyzeMemoryRequirements(
    predictions: CapacityPrediction[],
    currentCapacity: Record<string, number>,
    constraints: any
  ): Promise<ScalingRecommendation[]> {
    const recommendations: ScalingRecommendation[] = [];
    const currentMemory = currentCapacity.memory || 0;

    predictions.forEach((prediction, index) => {
      const utilizationThreshold = constraints.riskTolerance === 'low' ? 75 :