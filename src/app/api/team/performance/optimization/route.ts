import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Request validation schema
const OptimizationRequestSchema = z.object({
  teamId: z.string().uuid(),
  timeWindow: z.number().min(1).max(24).default(1), // hours
  includeRecommendations: z.boolean().default(true),
  analysisType: z.enum(['real-time', 'historical', 'predictive']).default('real-time')
});

// Types
interface AgentMetrics {
  agentId: string;
  tasksCompleted: number;
  averageExecutionTime: number;
  successRate: number;
  collaborationScore: number;
  currentLoad: number;
  lastActive: Date;
}

interface CollaborationPattern {
  agentPair: [string, string];
  interactionCount: number;
  successRate: number;
  averageResponseTime: number;
  patternType: 'sequential' | 'parallel' | 'dependent';
}

interface Bottleneck {
  type: 'agent_overload' | 'resource_constraint' | 'communication_delay' | 'dependency_chain';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedAgents: string[];
  impactScore: number;
  suggestedResolution: string;
}

interface OptimizationRecommendation {
  id: string;
  type: 'load_rebalance' | 'task_reassign' | 'workflow_optimize' | 'capacity_scale';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImprovement: number;
  implementationSteps: string[];
  estimatedImpact: {
    throughputIncrease: number;
    latencyReduction: number;
    resourceOptimization: number;
  };
}

class PerformanceAnalyzer {
  private teamId: string;
  private timeWindow: number;

  constructor(teamId: string, timeWindow: number) {
    this.teamId = teamId;
    this.timeWindow = timeWindow;
  }

  async calculateMetrics(): Promise<AgentMetrics[]> {
    const cutoffTime = new Date(Date.now() - this.timeWindow * 60 * 60 * 1000);

    const { data: executions, error } = await supabase
      .from('agent_executions')
      .select(`
        agent_id,
        status,
        execution_time,
        created_at,
        metadata
      `)
      .eq('team_id', this.teamId)
      .gte('created_at', cutoffTime.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch execution data: ${error.message}`);

    const agentGroups = executions?.reduce((acc, exec) => {
      if (!acc[exec.agent_id]) {
        acc[exec.agent_id] = [];
      }
      acc[exec.agent_id].push(exec);
      return acc;
    }, {} as Record<string, any[]>) || {};

    return Object.entries(agentGroups).map(([agentId, execs]) => {
      const completedTasks = execs.filter(e => e.status === 'completed').length;
      const totalTasks = execs.length;
      const avgExecutionTime = execs.reduce((sum, e) => sum + (e.execution_time || 0), 0) / execs.length;
      const successRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

      return {
        agentId,
        tasksCompleted: completedTasks,
        averageExecutionTime: avgExecutionTime,
        successRate,
        collaborationScore: this.calculateCollaborationScore(agentId, execs),
        currentLoad: this.calculateCurrentLoad(agentId),
        lastActive: new Date(execs[0]?.created_at || Date.now())
      };
    });
  }

  private calculateCollaborationScore(agentId: string, executions: any[]): number {
    const collaborativeTasks = executions.filter(e => 
      e.metadata?.collaborators && e.metadata.collaborators.length > 0
    );
    return collaborativeTasks.length / Math.max(executions.length, 1);
  }

  private async calculateCurrentLoad(agentId: string): Promise<number> {
    const { data: queuedTasks } = await supabase
      .from('task_queues')
      .select('count')
      .eq('assigned_agent_id', agentId)
      .eq('status', 'queued')
      .single();

    return queuedTasks?.count || 0;
  }
}

class CollaborationPatternDetector {
  constructor(private teamId: string, private timeWindow: number) {}

  async detectPatterns(): Promise<CollaborationPattern[]> {
    const cutoffTime = new Date(Date.now() - this.timeWindow * 60 * 60 * 1000);

    const { data: collaborations, error } = await supabase
      .from('agent_executions')
      .select(`
        agent_id,
        metadata,
        status,
        execution_time,
        created_at
      `)
      .eq('team_id', this.teamId)
      .gte('created_at', cutoffTime.toISOString())
      .not('metadata->collaborators', 'is', null);

    if (error) throw new Error(`Failed to fetch collaboration data: ${error.message}`);

    const patterns = new Map<string, CollaborationPattern>();

    collaborations?.forEach(exec => {
      const collaborators = exec.metadata?.collaborators || [];
      collaborators.forEach((collaboratorId: string) => {
        const pairKey = [exec.agent_id, collaboratorId].sort().join('-');
        
        if (!patterns.has(pairKey)) {
          patterns.set(pairKey, {
            agentPair: [exec.agent_id, collaboratorId],
            interactionCount: 0,
            successRate: 0,
            averageResponseTime: 0,
            patternType: 'sequential'
          });
        }

        const pattern = patterns.get(pairKey)!;
        pattern.interactionCount++;
        
        if (exec.status === 'completed') {
          pattern.successRate = (pattern.successRate * (pattern.interactionCount - 1) + 1) / pattern.interactionCount;
        } else {
          pattern.successRate = (pattern.successRate * (pattern.interactionCount - 1)) / pattern.interactionCount;
        }

        pattern.averageResponseTime = (pattern.averageResponseTime * (pattern.interactionCount - 1) + (exec.execution_time || 0)) / pattern.interactionCount;
      });
    });

    return Array.from(patterns.values());
  }
}

class BottleneckIdentifier {
  constructor(private metrics: AgentMetrics[], private patterns: CollaborationPattern[]) {}

  identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Identify overloaded agents
    this.metrics.forEach(metric => {
      if (metric.currentLoad > 10 && metric.averageExecutionTime > 5000) {
        bottlenecks.push({
          type: 'agent_overload',
          severity: metric.currentLoad > 20 ? 'critical' : 'high',
          affectedAgents: [metric.agentId],
          impactScore: metric.currentLoad * (1 - metric.successRate),
          suggestedResolution: `Redistribute tasks from ${metric.agentId} to available agents`
        });
      }
    });

    // Identify communication delays
    this.patterns.forEach(pattern => {
      if (pattern.averageResponseTime > 10000 && pattern.successRate < 0.8) {
        bottlenecks.push({
          type: 'communication_delay',
          severity: pattern.averageResponseTime > 30000 ? 'critical' : 'medium',
          affectedAgents: Array.from(pattern.agentPair),
          impactScore: pattern.averageResponseTime * (1 - pattern.successRate),
          suggestedResolution: `Optimize communication protocol between ${pattern.agentPair.join(' and ')}`
        });
      }
    });

    // Identify dependency chains
    const dependencyChains = this.findDependencyChains();
    dependencyChains.forEach(chain => {
      if (chain.length > 5) {
        bottlenecks.push({
          type: 'dependency_chain',
          severity: 'medium',
          affectedAgents: chain,
          impactScore: chain.length * 2,
          suggestedResolution: `Break dependency chain: ${chain.join(' -> ')}`
        });
      }
    });

    return bottlenecks.sort((a, b) => b.impactScore - a.impactScore);
  }

  private findDependencyChains(): string[][] {
    // Simplified dependency chain detection
    const chains: string[][] = [];
    const visited = new Set<string>();

    this.patterns.forEach(pattern => {
      if (pattern.patternType === 'dependent') {
        const chain = this.buildChain(pattern.agentPair[0], visited);
        if (chain.length > 2) {
          chains.push(chain);
        }
      }
    });

    return chains;
  }

  private buildChain(startAgent: string, visited: Set<string>): string[] {
    if (visited.has(startAgent)) return [startAgent];
    
    visited.add(startAgent);
    const chain = [startAgent];

    const dependentPattern = this.patterns.find(p => 
      p.agentPair.includes(startAgent) && p.patternType === 'dependent'
    );

    if (dependentPattern) {
      const nextAgent = dependentPattern.agentPair.find(id => id !== startAgent);
      if (nextAgent && !visited.has(nextAgent)) {
        chain.push(...this.buildChain(nextAgent, visited));
      }
    }

    return chain;
  }
}

class TaskDistributionOptimizer {
  constructor(
    private metrics: AgentMetrics[],
    private bottlenecks: Bottleneck[]
  ) {}

  generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Load balancing recommendations
    const overloadedAgents = this.bottlenecks
      .filter(b => b.type === 'agent_overload')
      .map(b => b.affectedAgents[0]);

    const underutilizedAgents = this.metrics
      .filter(m => m.currentLoad < 5 && m.successRate > 0.9)
      .map(m => m.agentId);

    if (overloadedAgents.length > 0 && underutilizedAgents.length > 0) {
      recommendations.push({
        id: `rebalance-${Date.now()}`,
        type: 'load_rebalance',
        priority: 'high',
        description: `Redistribute tasks from overloaded agents (${overloadedAgents.join(', ')}) to available agents (${underutilizedAgents.join(', ')})`,
        expectedImprovement: 0.3,
        implementationSteps: [
          'Pause new task assignment to overloaded agents',
          'Reassign queued tasks to underutilized agents',
          'Monitor performance for 30 minutes',
          'Adjust thresholds based on results'
        ],
        estimatedImpact: {
          throughputIncrease: 25,
          latencyReduction: 40,
          resourceOptimization: 20
        }
      });
    }

    // Workflow optimization recommendations
    const criticalBottlenecks = this.bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      recommendations.push({
        id: `workflow-${Date.now()}`,
        type: 'workflow_optimize',
        priority: 'critical',
        description: 'Optimize critical workflow bottlenecks affecting team performance',
        expectedImprovement: 0.5,
        implementationSteps: [
          'Identify critical path dependencies',
          'Implement parallel processing where possible',
          'Add circuit breakers for failing components',
          'Enable graceful degradation modes'
        ],
        estimatedImpact: {
          throughputIncrease: 50,
          latencyReduction: 60,
          resourceOptimization: 35
        }
      });
    }

    // Capacity scaling recommendations
    const totalLoad = this.metrics.reduce((sum, m) => sum + m.currentLoad, 0);
    const avgLoad = totalLoad / this.metrics.length;

    if (avgLoad > 15) {
      recommendations.push({
        id: `scale-${Date.now()}`,
        type: 'capacity_scale',
        priority: 'medium',
        description: 'Consider scaling team capacity due to high average load',
        expectedImprovement: 0.4,
        implementationSteps: [
          'Analyze peak usage patterns',
          'Deploy additional agent instances',
          'Configure auto-scaling policies',
          'Monitor resource utilization'
        ],
        estimatedImpact: {
          throughputIncrease: 40,
          latencyReduction: 30,
          resourceOptimization: 15
        }
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

class RealtimeMetricsCollector {
  constructor(private teamId: string) {}

  async collectLiveMetrics(): Promise<any> {
    const cacheKey = `team:${this.teamId}:live-metrics`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Collect live metrics from various sources
    const metrics = {
      timestamp: new Date().toISOString(),
      activeAgents: await this.getActiveAgentCount(),
      queueLength: await this.getQueueLength(),
      throughput: await this.getCurrentThroughput(),
      errorRate: await this.getCurrentErrorRate()
    };

    await redis.setex(cacheKey, 30, JSON.stringify(metrics));
    return metrics;
  }

  private async getActiveAgentCount(): Promise<number> {
    const { count } = await supabase
      .from('agent_executions')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .eq('status', 'running');

    return count || 0;
  }

  private async getQueueLength(): Promise<number> {
    const { count } = await supabase
      .from('task_queues')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .eq('status', 'queued');

    return count || 0;
  }

  private async getCurrentThroughput(): Promise<number> {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const { count } = await supabase
      .from('agent_executions')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .eq('status', 'completed')
      .gte('created_at', oneMinuteAgo.toISOString());

    return count || 0;
  }

  private async getCurrentErrorRate(): Promise<number> {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const { data: executions } = await supabase
      .from('agent_executions')
      .select('status')
      .eq('team_id', this.teamId)
      .gte('created_at', oneMinuteAgo.toISOString());

    if (!executions || executions.length === 0) return 0;

    const errors = executions.filter(e => e.status === 'failed').length;
    return errors / executions.length;
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(clientIP, 10); // 10 requests per minute
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { teamId, timeWindow, includeRecommendations, analysisType } = OptimizationRequestSchema.parse(body);

    // Verify team access
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        { error: 'Team not found or access denied' },
        { status: 404 }
      );
    }

    // Initialize components
    const analyzer = new PerformanceAnalyzer(teamId, timeWindow);
    const patternDetector = new CollaborationPatternDetector(teamId, timeWindow);
    const metricsCollector = new RealtimeMetricsCollector(teamId);

    // Collect and analyze data
    const [metrics, patterns, liveMetrics] = await Promise.all([
      analyzer.calculateMetrics(),
      patternDetector.detectPatterns(),
      analysisType === 'real-time' ? metricsCollector.collectLiveMetrics() : null
    ]);

    // Identify bottlenecks
    const bottleneckIdentifier = new BottleneckIdentifier(metrics, patterns);
    const bottlenecks = bottleneckIdentifier.identifyBottlenecks();

    // Generate recommendations
    let recommendations: OptimizationRecommendation[] = [];
    if (includeRecommendations) {
      const optimizer = new TaskDistributionOptimizer(metrics, bottlenecks);
      recommendations = optimizer.generateRecommendations();
    }

    // Calculate overall performance score
    const averageSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length;
    const averageLoad = metrics.reduce((sum, m) => sum + m.currentLoad, 0) / metrics.length;
    const performanceScore = Math.round((averageSuccessRate * 0.6 + (1 - Math.min(averageLoad / 20, 1)) * 0.4) * 100);

    // Cache results
    const cacheKey = `team:${teamId}:optimization:${analysisType}`;
    const result = {
      teamId,
      analysisTimestamp: new Date().toISOString(),
      analysisType,
      timeWindow,
      performanceScore,
      metrics,
      collaborationPatterns: patterns,
      bottlenecks,
      recommendations,
      liveMetrics,
      summary: {
        totalAgents: metrics.length,
        activeCollaborations: patterns.length,
        criticalBottlenecks: bottlenecks.filter(b => b.severity === 'critical').length,
        highPriorityRecommendations: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical').length
      }
    };

    await redis.setex(cacheKey, 300, JSON.stringify(result)); // Cache for 5 minutes

    // Publish real-time updates
    if (analysisType === 'real-time') {
      await redis.publish(`team:${teamId}:optimization-updates`, JSON.stringify({
        type: 'optimization_analysis',
        data: result
      }));
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Team optimization analysis error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(clientIP, 20); // 20 requests per minute for GET
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Try to get cached results first
    const cacheKey = `team:${teamId}:optimization:real-time`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    // If no cached data, return minimal live metrics
    const metricsCollector = new RealtimeMetricsCollector(teamId);
    const liveMetrics = await metricsCollector.collectLiveMetrics();

    return NextResponse.json({
      teamId,
      analysisTimestamp: new Date().toISOString(),
      analysisType: 'real-time',
      liveMetrics,
      message: 'Run full optimization analysis via POST for detailed recommendations'
    });

  } catch (error) {
    console.error('Team optimization GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}