```typescript
/**
 * Infrastructure Cost Optimizer Service
 * Continuously analyzes resource usage patterns and automatically optimizes cloud infrastructure costs
 * through rightsizing and scheduling.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  EC2Client,
  DescribeInstancesCommand,
  ModifyInstanceAttributeCommand,
  StopInstancesCommand,
  StartInstancesCommand,
  DescribeInstanceTypesCommand,
} from '@aws-sdk/client-ec2';
import {
  RDSClient,
  DescribeDBInstancesCommand,
  ModifyDBInstanceCommand,
} from '@aws-sdk/client-rds';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  MetricDataQuery,
  GetMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetUsageReportCommand,
} from '@aws-sdk/client-cost-explorer';
import { WebhookClient } from 'discord.js';
import { IncomingWebhook } from '@slack/webhook';
import axios from 'axios';

/**
 * Resource usage metrics interface
 */
interface ResourceMetrics {
  instanceId: string;
  instanceType: string;
  cpuUtilization: number;
  memoryUtilization: number;
  networkUtilization: number;
  diskUtilization: number;
  costPerHour: number;
  region: string;
  tags: Record<string, string>;
  lastUpdated: Date;
}

/**
 * Usage pattern analysis result
 */
interface UsagePattern {
  resourceId: string;
  avgCpuUtilization: number;
  avgMemoryUtilization: number;
  peakUsageHours: number[];
  lowUsageHours: number[];
  weekendUsage: number;
  seasonality: 'low' | 'medium' | 'high';
  predictability: number; // 0-1 scale
  wasteScore: number; // 0-100 scale
}

/**
 * Rightsizing recommendation
 */
interface RightsizingRecommendation {
  resourceId: string;
  currentInstanceType: string;
  recommendedInstanceType: string;
  currentCost: number;
  projectedCost: number;
  savings: number;
  confidence: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  implementationComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Workload scheduling recommendation
 */
interface SchedulingRecommendation {
  workloadId: string;
  currentSchedule: string;
  recommendedSchedule: string;
  savingsOpportunity: number;
  businessImpact: 'none' | 'low' | 'medium' | 'high';
  schedulingStrategy: 'spot' | 'reserved' | 'on-demand' | 'hybrid';
}

/**
 * Cost prediction result
 */
interface CostPrediction {
  timeframe: '7d' | '30d' | '90d' | '1y';
  predictedCost: number;
  confidenceInterval: [number, number];
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  anomalies: CostAnomaly[];
  seasonalFactors: Record<string, number>;
}

/**
 * Cost anomaly detection
 */
interface CostAnomaly {
  date: Date;
  expectedCost: number;
  actualCost: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'compute' | 'storage' | 'network' | 'data-transfer' | 'other';
  rootCause?: string;
}

/**
 * Optimization rule configuration
 */
interface OptimizationRule {
  id: string;
  name: string;
  type: 'rightsizing' | 'scheduling' | 'reserved-instance' | 'spot-instance';
  conditions: Record<string, any>;
  actions: Record<string, any>;
  enabled: boolean;
  autoExecute: boolean;
  approvalRequired: boolean;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Optimization execution result
 */
interface OptimizationResult {
  recommendationId: string;
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'rolled-back';
  executedAt?: Date;
  actualSavings?: number;
  error?: string;
  rollbackPlan?: Record<string, any>;
}

/**
 * Cost report configuration
 */
interface CostReport {
  id: string;
  title: string;
  type: 'summary' | 'detailed' | 'trend-analysis' | 'recommendations';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  filters: Record<string, any>;
  recipients: string[];
  format: 'pdf' | 'excel' | 'json' | 'dashboard';
  scheduledDelivery: boolean;
  nextRun?: Date;
}

/**
 * Service configuration interface
 */
interface CostOptimizerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  openaiApiKey: string;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  optimizationThresholds: {
    cpuWasteThreshold: number;
    memoryWasteThreshold: number;
    minimumSavingsThreshold: number;
    confidenceThreshold: number;
  };
  schedulingConfig: {
    enabledRegions: string[];
    offPeakHours: number[];
    weekendScheduling: boolean;
    holidayCalendar: string[];
  };
  alertConfig: {
    slackWebhookUrl?: string;
    teamsWebhookUrl?: string;
    emailConfig?: {
      smtpServer: string;
      username: string;
      password: string;
    };
  };
  automationLevel: 'advisory' | 'semi-automatic' | 'fully-automatic';
  maxDailySavingsTarget: number;
}

/**
 * Resource Analyzer - Analyzes CPU, memory, storage usage patterns
 */
class ResourceAnalyzer {
  private cloudWatchClient: CloudWatchClient;

  constructor(private config: CostOptimizerConfig) {
    this.cloudWatchClient = new CloudWatchClient({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }

  /**
   * Collect resource metrics from CloudWatch
   */
  async collectResourceMetrics(resourceIds: string[], days: number = 30): Promise<ResourceMetrics[]> {
    try {
      const metrics: ResourceMetrics[] = [];
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

      for (const resourceId of resourceIds) {
        const metricQueries: MetricDataQuery[] = [
          {
            Id: 'cpu',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/EC2',
                MetricName: 'CPUUtilization',
                Dimensions: [{ Name: 'InstanceId', Value: resourceId }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
          {
            Id: 'memory',
            MetricStat: {
              Metric: {
                Namespace: 'CWAgent',
                MetricName: 'mem_used_percent',
                Dimensions: [{ Name: 'InstanceId', Value: resourceId }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
          {
            Id: 'network',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/EC2',
                MetricName: 'NetworkIn',
                Dimensions: [{ Name: 'InstanceId', Value: resourceId }],
              },
              Period: 3600,
              Stat: 'Average',
            },
          },
        ];

        const command = new GetMetricDataCommand({
          MetricDataQueries: metricQueries,
          StartTime: startTime,
          EndTime: endTime,
        });

        const response = await this.cloudWatchClient.send(command);
        
        if (response.MetricDataResults) {
          const cpuData = response.MetricDataResults.find(r => r.Id === 'cpu');
          const memoryData = response.MetricDataResults.find(r => r.Id === 'memory');
          const networkData = response.MetricDataResults.find(r => r.Id === 'network');

          metrics.push({
            instanceId: resourceId,
            instanceType: await this.getInstanceType(resourceId),
            cpuUtilization: this.calculateAverage(cpuData?.Values || []),
            memoryUtilization: this.calculateAverage(memoryData?.Values || []),
            networkUtilization: this.calculateAverage(networkData?.Values || []),
            diskUtilization: 0, // Placeholder for disk metrics
            costPerHour: await this.getInstanceCostPerHour(resourceId),
            region: this.config.awsRegion,
            tags: await this.getInstanceTags(resourceId),
            lastUpdated: new Date(),
          });
        }
      }

      return metrics;
    } catch (error) {
      console.error('Error collecting resource metrics:', error);
      throw new Error(`Failed to collect resource metrics: ${error}`);
    }
  }

  /**
   * Analyze usage patterns from metrics
   */
  async analyzeUsagePatterns(metrics: ResourceMetrics[]): Promise<UsagePattern[]> {
    try {
      const patterns: UsagePattern[] = [];

      for (const metric of metrics) {
        // Get detailed hourly data for pattern analysis
        const hourlyData = await this.getHourlyUsageData(metric.instanceId, 30);
        
        const pattern: UsagePattern = {
          resourceId: metric.instanceId,
          avgCpuUtilization: metric.cpuUtilization,
          avgMemoryUtilization: metric.memoryUtilization,
          peakUsageHours: this.identifyPeakHours(hourlyData),
          lowUsageHours: this.identifyLowUsageHours(hourlyData),
          weekendUsage: this.calculateWeekendUsage(hourlyData),
          seasonality: this.detectSeasonality(hourlyData),
          predictability: this.calculatePredictability(hourlyData),
          wasteScore: this.calculateWasteScore(metric),
        };

        patterns.push(pattern);
      }

      return patterns;
    } catch (error) {
      console.error('Error analyzing usage patterns:', error);
      throw new Error(`Failed to analyze usage patterns: ${error}`);
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private async getInstanceType(instanceId: string): Promise<string> {
    // Implementation to get instance type from EC2
    return 't3.medium'; // Placeholder
  }

  private async getInstanceCostPerHour(instanceId: string): Promise<number> {
    // Implementation to calculate cost per hour
    return 0.05; // Placeholder
  }

  private async getInstanceTags(instanceId: string): Promise<Record<string, string>> {
    // Implementation to get instance tags
    return {}; // Placeholder
  }

  private async getHourlyUsageData(instanceId: string, days: number): Promise<number[][]> {
    // Implementation to get detailed hourly usage data
    return []; // Placeholder
  }

  private identifyPeakHours(hourlyData: number[][]): number[] {
    // Implementation to identify peak usage hours
    return [9, 10, 11, 14, 15, 16]; // Placeholder
  }

  private identifyLowUsageHours(hourlyData: number[][]): number[] {
    // Implementation to identify low usage hours
    return [0, 1, 2, 3, 4, 5, 22, 23]; // Placeholder
  }

  private calculateWeekendUsage(hourlyData: number[][]): number {
    // Implementation to calculate weekend usage
    return 0.3; // Placeholder
  }

  private detectSeasonality(hourlyData: number[][]): 'low' | 'medium' | 'high' {
    // Implementation to detect seasonality
    return 'low'; // Placeholder
  }

  private calculatePredictability(hourlyData: number[][]): number {
    // Implementation to calculate predictability score
    return 0.8; // Placeholder
  }

  private calculateWasteScore(metric: ResourceMetrics): number {
    const cpuWaste = Math.max(0, 100 - metric.cpuUtilization);
    const memoryWaste = Math.max(0, 100 - metric.memoryUtilization);
    return (cpuWaste + memoryWaste) / 2;
  }
}

/**
 * Rightsizing Engine - Calculates optimal instance sizes
 */
class RightsizingEngine {
  private ec2Client: EC2Client;

  constructor(private config: CostOptimizerConfig) {
    this.ec2Client = new EC2Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }

  /**
   * Generate rightsizing recommendations
   */
  async generateRecommendations(patterns: UsagePattern[]): Promise<RightsizingRecommendation[]> {
    try {
      const recommendations: RightsizingRecommendation[] = [];

      for (const pattern of patterns) {
        if (pattern.wasteScore >= this.config.optimizationThresholds.cpuWasteThreshold) {
          const recommendation = await this.calculateOptimalSize(pattern);
          if (recommendation.savings >= this.config.optimizationThresholds.minimumSavingsThreshold) {
            recommendations.push(recommendation);
          }
        }
      }

      return recommendations.sort((a, b) => b.savings - a.savings);
    } catch (error) {
      console.error('Error generating rightsizing recommendations:', error);
      throw new Error(`Failed to generate recommendations: ${error}`);
    }
  }

  private async calculateOptimalSize(pattern: UsagePattern): Promise<RightsizingRecommendation> {
    // Get current instance details
    const currentInstance = await this.getInstanceDetails(pattern.resourceId);
    const availableTypes = await this.getAvailableInstanceTypes();
    
    // Calculate required capacity
    const requiredCpu = Math.max(pattern.avgCpuUtilization * 1.2, 20); // 20% buffer
    const requiredMemory = Math.max(pattern.avgMemoryUtilization * 1.2, 20);
    
    // Find optimal instance type
    const optimalType = this.findOptimalInstanceType(
      availableTypes,
      requiredCpu,
      requiredMemory
    );
    
    const currentCost = await this.getInstanceCost(currentInstance.type);
    const newCost = await this.getInstanceCost(optimalType);
    
    return {
      resourceId: pattern.resourceId,
      currentInstanceType: currentInstance.type,
      recommendedInstanceType: optimalType,
      currentCost: currentCost * 24 * 30, // Monthly cost
      projectedCost: newCost * 24 * 30,
      savings: (currentCost - newCost) * 24 * 30,
      confidence: this.calculateConfidence(pattern),
      reasoning: this.generateReasoning(pattern, currentInstance.type, optimalType),
      riskLevel: this.assessRiskLevel(pattern, currentInstance.type, optimalType),
      implementationComplexity: this.assessComplexity(currentInstance.type, optimalType),
    };
  }

  private async getInstanceDetails(instanceId: string): Promise<{ type: string; state: string }> {
    // Implementation to get instance details
    return { type: 't3.large', state: 'running' }; // Placeholder
  }

  private async getAvailableInstanceTypes(): Promise<string[]> {
    // Implementation to get available instance types
    return ['t3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge']; // Placeholder
  }

  private findOptimalInstanceType(
    types: string[],
    requiredCpu: number,
    requiredMemory: number
  ): string {
    // Implementation to find optimal instance type based on requirements
    return 't3.medium'; // Placeholder
  }

  private async getInstanceCost(instanceType: string): Promise<number> {
    // Implementation to get instance cost per hour
    return 0.05; // Placeholder
  }

  private calculateConfidence(pattern: UsagePattern): number {
    return Math.min(pattern.predictability * 0.7 + (1 - pattern.wasteScore / 100) * 0.3, 1);
  }

  private generateReasoning(pattern: UsagePattern, current: string, recommended: string): string {
    return `Resource ${pattern.resourceId} shows ${pattern.wasteScore.toFixed(1)}% waste with average CPU utilization of ${pattern.avgCpuUtilization.toFixed(1)}%. Downsizing from ${current} to ${recommended} will maintain performance while reducing costs.`;
  }

  private assessRiskLevel(
    pattern: UsagePattern,
    current: string,
    recommended: string
  ): 'low' | 'medium' | 'high' {
    if (pattern.predictability > 0.8 && pattern.wasteScore > 50) return 'low';
    if (pattern.predictability > 0.6) return 'medium';
    return 'high';
  }

  private assessComplexity(current: string, recommended: string): 'simple' | 'moderate' | 'complex' {
    // Simple logic for complexity assessment
    const currentFamily = current.split('.')[0];
    const recommendedFamily = recommended.split('.')[0];
    
    if (currentFamily === recommendedFamily) return 'simple';
    return 'moderate';
  }
}

/**
 * Workload Scheduler - Manages time-based workload optimization
 */
class WorkloadScheduler {
  constructor(private config: CostOptimizerConfig) {}

  /**
   * Generate scheduling recommendations
   */
  async generateSchedulingRecommendations(patterns: UsagePattern[]): Promise<SchedulingRecommendation[]> {
    try {
      const recommendations: SchedulingRecommendation[] = [];

      for (const pattern of patterns) {
        if (this.isSchedulingCandidate(pattern)) {
          const recommendation = this.createSchedulingRecommendation(pattern);
          recommendations.push(recommendation);
        }
      }

      return recommendations.sort((a, b) => b.savingsOpportunity - a.savingsOpportunity);
    } catch (error) {
      console.error('Error generating scheduling recommendations:', error);
      throw new Error(`Failed to generate scheduling recommendations: ${error}`);
    }
  }

  /**
   * Execute scheduling changes
   */
  async executeScheduling(recommendation: SchedulingRecommendation): Promise<boolean> {
    try {
      // Implementation depends on the scheduling strategy
      switch (recommendation.schedulingStrategy) {
        case 'spot':
          return await this.implementSpotScheduling(recommendation);
        case 'reserved':
          return await this.implementReservedScheduling(recommendation);
        case 'on-demand':
          return await this.implementOnDemandScheduling(recommendation);
        case 'hybrid':
          return await this.implementHybridScheduling(recommendation);
        default:
          throw new Error(`Unknown scheduling strategy: ${recommendation.schedulingStrategy}`);
      }
    } catch (error) {
      console.error('Error executing scheduling:', error);
      return false;
    }
  }

  private isSchedulingCandidate(pattern: UsagePattern): boolean {
    // Check if workload has predictable patterns and low business impact during off-hours
    return (
      pattern.predictability > 0.7 &&
      pattern.lowUsageHours.length >= 8 &&
      pattern.weekendUsage < 0.5
    );
  }

  private createSchedulingRecommendation(pattern: UsagePattern): SchedulingRecommendation {
    const strategy = this.determineOptimalStrategy(pattern);
    const savings = this.calculateSchedulingSavings(pattern, strategy);

    return {
      workloadId: pattern.resourceId,
      currentSchedule: '24/7',
      recommendedSchedule: this.generateSchedule(pattern),
      savingsOpportunity: savings,
      businessImpact: this.assessBusinessImpact(pattern),
      schedulingStrategy: strategy,
    };
  }

  private determineOptimalStrategy(pattern: UsagePattern): 'spot' | 'reserved' | 'on-demand' | 'hybrid' {
    if (pattern.predictability > 0.9) return 'reserved';
    if (pattern.predictability > 0.7) return 'hybrid';
    return 'spot';
  }

  private calculateSchedulingSavings(
    pattern: UsagePattern,
    strategy: 'spot' | 'reserved' | 'on-demand' | 'hybrid'
  ): number {
    // Calculate potential savings based on strategy
    const baseCost = 100; // Placeholder base cost
    
    switch (strategy) {
      case 'spot':
        return baseCost * 0.7; // 70% savings
      case 'reserved':
        return baseCost * 0.4; // 40% savings
      case 'hybrid':
        return baseCost * 0.5; // 50% savings
      default:
        return baseCost * 0.1; // 10% savings
    }
  }

  private generateSchedule(pattern: UsagePattern): string {
    // Generate cron-like schedule based on usage pattern
    const peakHours = pattern.peakUsageHours.join(',');
    return `* ${peakHours} * * 1-5`; // Run during peak hours on weekdays
  }

  private assessBusinessImpact(pattern: UsagePattern): 'none' | 'low' | 'medium' | 'high' {
    if (pattern.weekendUsage < 0.1) return 'none';
    if (pattern.weekendUsage < 0.3) return 'low';
    if (pattern.weekendUsage < 0.7) return 'medium';
    return 'high';
  }

  private async implementSpotScheduling(recommendation: SchedulingRecommendation): Promise<boolean>