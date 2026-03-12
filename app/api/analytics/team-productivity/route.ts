```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { z } from 'zod';

// Environment validation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Validation schemas
const ProductivityQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  configurationIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeBottlenecks: z.boolean().default(true),
  includeComparisons: z.boolean().default(false),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day')
});

// TypeScript interfaces
interface TaskExecution {
  id: string;
  agent_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  complexity_score: number;
  dependencies: string[];
}

interface CollaborationEvent {
  id: string;
  initiator_agent_id: string;
  target_agent_id: string;
  event_type: 'request' | 'response' | 'handoff' | 'conflict';
  timestamp: string;
  duration_ms: number;
  success: boolean;
}

interface TeamConfiguration {
  id: string;
  name: string;
  agent_ids: string[];
  workflow_rules: Record<string, any>;
  created_at: string;
  is_active: boolean;
}

interface PerformanceMetrics {
  taskCompletionRate: number;
  avgTaskDuration: number;
  collaborationEfficiency: number;
  bottlenecks: Bottleneck[];
  throughput: number;
  errorRate: number;
  utilization: Record<string, number>;
}

interface Bottleneck {
  type: 'agent' | 'resource' | 'workflow';
  identifier: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number;
  description: string;
  suggestions: string[];
}

interface ProductivityReport {
  teamId: string;
  configurationId: string;
  timeRange: { start: string; end: string };
  metrics: PerformanceMetrics;
  trends: Record<string, Array<{ timestamp: string; value: number }>>;
  comparisons?: Array<{
    configurationId: string;
    name: string;
    metrics: PerformanceMetrics;
    improvementAreas: string[];
  }>;
  recommendations: string[];
}

// Core analyzer classes
class TeamProductivityAnalyzer {
  private supabase: any;
  private redis: Redis;

  constructor(supabase: any, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  async analyzeTeamPerformance(
    teamId: string,
    configurationId: string,
    startDate: string,
    endDate: string,
    granularity: string
  ): Promise<ProductivityReport> {
    const cacheKey = `team_analytics:${teamId}:${configurationId}:${startDate}:${endDate}:${granularity}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const metricsAggregator = new MetricsAggregator(this.supabase);
    const bottleneckDetector = new BottleneckDetector(this.supabase);
    const collaborationCalculator = new CollaborationEfficiencyCalculator(this.supabase);
    const reportGenerator = new ProductivityReportGenerator();

    // Gather all required data
    const [taskExecutions, collaborationEvents, teamConfig] = await Promise.all([
      metricsAggregator.getTaskExecutions(configurationId, startDate, endDate),
      metricsAggregator.getCollaborationEvents(configurationId, startDate, endDate),
      this.getTeamConfiguration(configurationId)
    ]);

    // Calculate core metrics
    const metrics: PerformanceMetrics = {
      taskCompletionRate: this.calculateCompletionRate(taskExecutions),
      avgTaskDuration: this.calculateAvgDuration(taskExecutions),
      collaborationEfficiency: await collaborationCalculator.calculate(collaborationEvents),
      bottlenecks: await bottleneckDetector.identify(taskExecutions, collaborationEvents, teamConfig),
      throughput: this.calculateThroughput(taskExecutions, startDate, endDate),
      errorRate: this.calculateErrorRate(taskExecutions),
      utilization: this.calculateUtilization(taskExecutions, teamConfig.agent_ids)
    };

    // Generate trends
    const trends = await this.generateTrends(taskExecutions, collaborationEvents, granularity);

    // Create report
    const report: ProductivityReport = {
      teamId,
      configurationId,
      timeRange: { start: startDate, end: endDate },
      metrics,
      trends,
      recommendations: reportGenerator.generateRecommendations(metrics, trends)
    };

    // Cache for 15 minutes
    await this.redis.setex(cacheKey, 900, JSON.stringify(report));

    return report;
  }

  private async getTeamConfiguration(configurationId: string): Promise<TeamConfiguration> {
    const { data, error } = await this.supabase
      .from('team_configurations')
      .select('*')
      .eq('id', configurationId)
      .single();

    if (error) throw new Error(`Failed to fetch team configuration: ${error.message}`);
    return data;
  }

  private calculateCompletionRate(tasks: TaskExecution[]): number {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return (completed / tasks.length) * 100;
  }

  private calculateAvgDuration(tasks: TaskExecution[]): number {
    const completedTasks = tasks.filter(t => t.duration_ms !== null);
    if (completedTasks.length === 0) return 0;
    
    const totalDuration = completedTasks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
    return totalDuration / completedTasks.length;
  }

  private calculateThroughput(tasks: TaskExecution[], startDate: string, endDate: string): number {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const timeRangeMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const timeRangeHours = timeRangeMs / (1000 * 60 * 60);
    
    return completedTasks.length / timeRangeHours;
  }

  private calculateErrorRate(tasks: TaskExecution[]): number {
    if (tasks.length === 0) return 0;
    const failed = tasks.filter(t => t.status === 'failed').length;
    return (failed / tasks.length) * 100;
  }

  private calculateUtilization(tasks: TaskExecution[], agentIds: string[]): Record<string, number> {
    const utilization: Record<string, number> = {};
    
    agentIds.forEach(agentId => {
      const agentTasks = tasks.filter(t => t.agent_id === agentId);
      const totalWorkTime = agentTasks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
      const timeRangeMs = 24 * 60 * 60 * 1000; // 24 hours in ms
      
      utilization[agentId] = Math.min((totalWorkTime / timeRangeMs) * 100, 100);
    });

    return utilization;
  }

  private async generateTrends(
    tasks: TaskExecution[],
    events: CollaborationEvent[],
    granularity: string
  ): Promise<Record<string, Array<{ timestamp: string; value: number }>>> {
    // Group data by time periods and calculate metrics for each period
    const trends: Record<string, Array<{ timestamp: string; value: number }>> = {
      completionRate: [],
      throughput: [],
      avgDuration: [],
      errorRate: []
    };

    // Implementation would group by time periods and calculate metrics
    // This is a simplified version
    return trends;
  }
}

class MetricsAggregator {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async getTaskExecutions(configurationId: string, startDate: string, endDate: string): Promise<TaskExecution[]> {
    const { data, error } = await this.supabase
      .from('task_executions')
      .select(`
        *,
        ai_agents!inner(team_configuration_id)
      `)
      .eq('ai_agents.team_configuration_id', configurationId)
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (error) throw new Error(`Failed to fetch task executions: ${error.message}`);
    return data || [];
  }

  async getCollaborationEvents(configurationId: string, startDate: string, endDate: string): Promise<CollaborationEvent[]> {
    const { data, error } = await this.supabase
      .from('collaboration_events')
      .select(`
        *,
        initiator:ai_agents!initiator_agent_id(team_configuration_id),
        target:ai_agents!target_agent_id(team_configuration_id)
      `)
      .eq('initiator.team_configuration_id', configurationId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    if (error) throw new Error(`Failed to fetch collaboration events: ${error.message}`);
    return data || [];
  }
}

class BottleneckDetector {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async identify(
    tasks: TaskExecution[],
    events: CollaborationEvent[],
    config: TeamConfiguration
  ): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];

    // Agent bottlenecks
    bottlenecks.push(...this.identifyAgentBottlenecks(tasks, config));
    
    // Workflow bottlenecks
    bottlenecks.push(...this.identifyWorkflowBottlenecks(tasks, events));
    
    // Resource bottlenecks
    bottlenecks.push(...this.identifyResourceBottlenecks(tasks));

    return bottlenecks.sort((a, b) => b.impact_score - a.impact_score);
  }

  private identifyAgentBottlenecks(tasks: TaskExecution[], config: TeamConfiguration): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    config.agent_ids.forEach(agentId => {
      const agentTasks = tasks.filter(t => t.agent_id === agentId);
      const avgDuration = agentTasks.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / agentTasks.length;
      const errorRate = agentTasks.filter(t => t.status === 'failed').length / agentTasks.length;

      if (avgDuration > 300000) { // 5 minutes threshold
        bottlenecks.push({
          type: 'agent',
          identifier: agentId,
          severity: avgDuration > 600000 ? 'high' : 'medium',
          impact_score: avgDuration / 1000,
          description: `Agent ${agentId} has high average task duration`,
          suggestions: ['Optimize agent processing', 'Review task complexity', 'Consider load balancing']
        });
      }

      if (errorRate > 0.1) { // 10% threshold
        bottlenecks.push({
          type: 'agent',
          identifier: agentId,
          severity: errorRate > 0.2 ? 'critical' : 'high',
          impact_score: errorRate * 1000,
          description: `Agent ${agentId} has high error rate`,
          suggestions: ['Debug agent logic', 'Review input validation', 'Increase monitoring']
        });
      }
    });

    return bottlenecks;
  }

  private identifyWorkflowBottlenecks(tasks: TaskExecution[], events: CollaborationEvent[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Analyze collaboration failures
    const failedCollaborations = events.filter(e => !e.success);
    const failureRate = failedCollaborations.length / events.length;

    if (failureRate > 0.05) { // 5% threshold
      bottlenecks.push({
        type: 'workflow',
        identifier: 'collaboration',
        severity: failureRate > 0.15 ? 'critical' : 'high',
        impact_score: failureRate * 1000,
        description: 'High collaboration failure rate detected',
        suggestions: ['Review workflow design', 'Improve agent communication', 'Add retry mechanisms']
      });
    }

    return bottlenecks;
  }

  private identifyResourceBottlenecks(tasks: TaskExecution[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Analyze task queuing and delays
    const queuedTasks = tasks.filter(t => t.status === 'pending');
    const avgQueueTime = queuedTasks.reduce((sum, t) => {
      const queueTime = new Date().getTime() - new Date(t.started_at).getTime();
      return sum + queueTime;
    }, 0) / queuedTasks.length;

    if (avgQueueTime > 60000) { // 1 minute threshold
      bottlenecks.push({
        type: 'resource',
        identifier: 'queue',
        severity: avgQueueTime > 300000 ? 'critical' : 'high',
        impact_score: avgQueueTime / 1000,
        description: 'High task queue time indicates resource constraints',
        suggestions: ['Scale up resources', 'Optimize task scheduling', 'Review resource allocation']
      });
    }

    return bottlenecks;
  }
}

class CollaborationEfficiencyCalculator {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async calculate(events: CollaborationEvent[]): Promise<number> {
    if (events.length === 0) return 100;

    const successfulEvents = events.filter(e => e.success);
    const successRate = successfulEvents.length / events.length;
    
    const avgResponseTime = successfulEvents.reduce((sum, e) => sum + e.duration_ms, 0) / successfulEvents.length;
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 1000)); // Penalty for slow responses

    return (successRate * 0.7 + (responseTimeScore / 100) * 0.3) * 100;
  }
}

class TeamConfigurationComparator {
  private analyzer: TeamProductivityAnalyzer;

  constructor(analyzer: TeamProductivityAnalyzer) {
    this.analyzer = analyzer;
  }

  async compareConfigurations(
    teamId: string,
    configurationIds: string[],
    startDate: string,
    endDate: string
  ): Promise<Array<{ configurationId: string; name: string; metrics: PerformanceMetrics; improvementAreas: string[] }>> {
    const comparisons = await Promise.all(
      configurationIds.map(async (configId) => {
        const report = await this.analyzer.analyzeTeamPerformance(teamId, configId, startDate, endDate, 'day');
        
        return {
          configurationId: configId,
          name: `Configuration ${configId}`,
          metrics: report.metrics,
          improvementAreas: this.identifyImprovementAreas(report.metrics)
        };
      })
    );

    return comparisons.sort((a, b) => b.metrics.taskCompletionRate - a.metrics.taskCompletionRate);
  }

  private identifyImprovementAreas(metrics: PerformanceMetrics): string[] {
    const areas: string[] = [];
    
    if (metrics.taskCompletionRate < 90) areas.push('Task completion rate');
    if (metrics.errorRate > 5) areas.push('Error handling');
    if (metrics.collaborationEfficiency < 80) areas.push('Team collaboration');
    if (metrics.bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length > 0) {
      areas.push('Bottleneck resolution');
    }

    return areas;
  }
}

class ProductivityReportGenerator {
  generateRecommendations(metrics: PerformanceMetrics, trends: Record<string, any>): string[] {
    const recommendations: string[] = [];

    if (metrics.taskCompletionRate < 85) {
      recommendations.push('Focus on improving task completion rates through better resource allocation');
    }

    if (metrics.errorRate > 10) {
      recommendations.push('Implement enhanced error handling and monitoring systems');
    }

    if (metrics.collaborationEfficiency < 75) {
      recommendations.push('Review and optimize inter-agent communication protocols');
    }

    const criticalBottlenecks = metrics.bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      recommendations.push(`Address critical bottlenecks: ${criticalBottlenecks.map(b => b.description).join(', ')}`);
    }

    const lowUtilization = Object.entries(metrics.utilization).filter(([_, util]) => util < 50);
    if (lowUtilization.length > 0) {
      recommendations.push('Consider redistributing workload to improve agent utilization');
    }

    return recommendations;
  }
}

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Parse and validate query parameters
    const validatedParams = ProductivityQuerySchema.parse({
      ...queryParams,
      configurationIds: queryParams.configurationIds ? 
        JSON.parse(queryParams.configurationIds) : undefined,
      includeBottlenecks: queryParams.includeBottlenecks === 'true',
      includeComparisons: queryParams.includeComparisons === 'true'
    });

    const analyzer = new TeamProductivityAnalyzer(supabase, redis);
    
    // Default date range if not provided
    const endDate = validatedParams.endDate || new Date().toISOString();
    const startDate = validatedParams.startDate || 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let reports: ProductivityReport[] = [];

    if (validatedParams.configurationIds && validatedParams.configurationIds.length > 0) {
      // Analyze multiple configurations
      reports = await Promise.all(
        validatedParams.configurationIds.map(configId =>
          analyzer.analyzeTeamPerformance(
            validatedParams.teamId || 'default',
            configId,
            startDate,
            endDate,
            validatedParams.granularity
          )
        )
      );

      // Add comparisons if requested
      if (validatedParams.includeComparisons && validatedParams.configurationIds.length > 1) {
        const comparator = new TeamConfigurationComparator(analyzer);
        const comparisons = await comparator.compareConfigurations(
          validatedParams.teamId || 'default',
          validatedParams.configurationIds,
          startDate,
          endDate
        );
        
        reports.forEach(report => {
          report.comparisons = comparisons.filter(c => c.configurationId !== report.configurationId);
        });
      }
    } else {
      // Get default team configuration
      const { data: defaultConfig } = await supabase
        .from('team_configurations')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!defaultConfig) {
        return NextResponse.json({ error: 'No active team configuration found' }, { status: 404 });
      }

      const report = await analyzer.analyzeTeamPerformance(
        validatedParams.teamId || 'default',
        defaultConfig.id,
        startDate,
        endDate,
        validatedParams.granularity
      );

      reports = [report];
    }

    return NextResponse.json({
      success: true,
      data: reports,
      metadata: {
        totalConfigurations: reports.length,
        timeRange: { start: startDate, end: endDate },
        granularity: validatedParams.granularity,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Team productivity analytics error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body for real-time metrics ingestion
    const MetricsIngestionSchema = z.object({
      teamId: z.string().uuid(),
      configurationId: z.string().uuid(),
      metrics: z.object({
        taskExecutions: z.array(z.object({
          agentId: z.string().uuid(),
          taskType: z.string(),
          duration: z.number(),
          status: z.enum(['completed', 'failed']),
          timestamp: z.string().datetime()
        })),
        collaborationEvents: z.array(z.object({
          initiatorId: z.string().uuid(),
          targetId: z.string().uuid(),
          eventType: z.string(),
          success: z.boolean(),
          duration: z.number(),
          timestamp: z.string().datetime()
        }))
      })
    });

    const validatedData = MetricsIngestionSchema.parse(body);

    // Store metrics in database
    const { error: taskError } = await supabase