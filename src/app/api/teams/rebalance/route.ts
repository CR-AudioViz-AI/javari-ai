```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateAuth } from '@/lib/auth';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const RebalanceRequestSchema = z.object({
  teamIds: z.array(z.string().uuid()).optional(),
  strategy: z.enum(['weighted_round_robin', 'least_connection', 'performance_based', 'capacity_optimized']).default('performance_based'),
  forceRebalance: z.boolean().default(false),
  maxReassignments: z.number().int().min(1).max(1000).default(100),
  thresholdOverride: z.object({
    maxUtilization: z.number().min(0).max(1).optional(),
    minPerformanceScore: z.number().min(0).max(100).optional(),
    maxResponseTime: z.number().int().min(100).optional()
  }).optional()
});

const ConfigUpdateSchema = z.object({
  autoRebalanceEnabled: z.boolean().optional(),
  rebalanceInterval: z.number().int().min(300).max(86400).optional(), // 5min to 24h
  performanceThreshold: z.number().min(0).max(100).optional(),
  utilizationThreshold: z.number().min(0).max(1).optional(),
  responseTimeThreshold: z.number().int().min(100).optional(),
  minAgentsPerTeam: z.number().int().min(1).optional(),
  maxAgentsPerTeam: z.number().int().min(1).optional()
});

// Interfaces
interface TeamMetrics {
  teamId: string;
  teamName: string;
  agentCount: number;
  activeTaskCount: number;
  avgUtilization: number;
  avgPerformanceScore: number;
  avgResponseTime: number;
  capacityUsed: number;
  totalCapacity: number;
  lastUpdated: string;
}

interface Agent {
  id: string;
  teamId: string;
  status: 'active' | 'busy' | 'idle' | 'offline';
  currentTasks: number;
  maxTasks: number;
  performanceScore: number;
  avgResponseTime: number;
  lastActive: string;
}

interface RebalancingStrategy {
  name: string;
  calculateRebalancing(teams: TeamMetrics[], agents: Agent[]): RebalanceAction[];
}

interface RebalanceAction {
  type: 'move_agent' | 'redistribute_tasks' | 'adjust_capacity';
  agentId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  taskIds?: string[];
  reason: string;
  priority: number;
}

// Rebalancing Engine
class RebalancingEngine {
  private strategies: Map<string, RebalancingStrategy> = new Map();

  constructor() {
    this.strategies.set('weighted_round_robin', new WeightedRoundRobinStrategy());
    this.strategies.set('least_connection', new LeastConnectionStrategy());
    this.strategies.set('performance_based', new PerformanceBasedStrategy());
    this.strategies.set('capacity_optimized', new CapacityOptimizedStrategy());
  }

  async executeRebalancing(
    strategy: string,
    teamIds?: string[],
    options: any = {}
  ): Promise<{
    success: boolean;
    actionsExecuted: RebalanceAction[];
    metrics: TeamMetrics[];
    summary: any;
  }> {
    try {
      // Get current team metrics
      const teams = await this.getTeamMetrics(teamIds);
      const agents = await this.getAgentData(teamIds);

      // Get rebalancing strategy
      const rebalanceStrategy = this.strategies.get(strategy);
      if (!rebalanceStrategy) {
        throw new Error(`Unknown rebalancing strategy: ${strategy}`);
      }

      // Calculate rebalancing actions
      const actions = rebalanceStrategy.calculateRebalancing(teams, agents);

      // Filter actions based on options
      const filteredActions = this.filterActions(actions, options);

      // Execute actions
      const executedActions = await this.executeActions(filteredActions);

      // Get updated metrics
      const updatedMetrics = await this.getTeamMetrics(teamIds);

      // Create summary
      const summary = this.createRebalancingSummary(teams, updatedMetrics, executedActions);

      // Log rebalancing event
      await this.logRebalancingEvent(strategy, executedActions, summary);

      return {
        success: true,
        actionsExecuted: executedActions,
        metrics: updatedMetrics,
        summary
      };

    } catch (error) {
      console.error('Rebalancing failed:', error);
      throw error;
    }
  }

  private async getTeamMetrics(teamIds?: string[]): Promise<TeamMetrics[]> {
    let query = supabase
      .from('teams')
      .select(`
        id,
        name,
        agents:agent_teams(count),
        tasks:team_tasks(
          count,
          status,
          created_at,
          assigned_agent_id
        )
      `);

    if (teamIds && teamIds.length > 0) {
      query = query.in('id', teamIds);
    }

    const { data: teams, error } = await query;
    if (error) throw error;

    // Calculate metrics for each team
    const metricsPromises = teams.map(async (team: any) => {
      const { data: teamStats } = await supabase
        .from('team_performance_metrics')
        .select('*')
        .eq('team_id', team.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const activeTasks = team.tasks?.filter((t: any) => t.status === 'active').length || 0;
      
      return {
        teamId: team.id,
        teamName: team.name,
        agentCount: team.agents?.length || 0,
        activeTaskCount: activeTasks,
        avgUtilization: teamStats?.avg_utilization || 0,
        avgPerformanceScore: teamStats?.avg_performance_score || 0,
        avgResponseTime: teamStats?.avg_response_time || 0,
        capacityUsed: teamStats?.capacity_used || 0,
        totalCapacity: teamStats?.total_capacity || 0,
        lastUpdated: teamStats?.created_at || new Date().toISOString()
      };
    });

    return Promise.all(metricsPromises);
  }

  private async getAgentData(teamIds?: string[]): Promise<Agent[]> {
    let query = supabase
      .from('agents')
      .select(`
        id,
        status,
        current_tasks,
        max_tasks,
        performance_score,
        avg_response_time,
        last_active,
        agent_teams!inner(team_id)
      `);

    if (teamIds && teamIds.length > 0) {
      query = query.in('agent_teams.team_id', teamIds);
    }

    const { data: agents, error } = await query;
    if (error) throw error;

    return agents.map((agent: any) => ({
      id: agent.id,
      teamId: agent.agent_teams.team_id,
      status: agent.status,
      currentTasks: agent.current_tasks || 0,
      maxTasks: agent.max_tasks || 10,
      performanceScore: agent.performance_score || 0,
      avgResponseTime: agent.avg_response_time || 0,
      lastActive: agent.last_active
    }));
  }

  private filterActions(actions: RebalanceAction[], options: any): RebalanceAction[] {
    let filtered = [...actions];

    if (options.maxReassignments) {
      filtered = filtered
        .sort((a, b) => b.priority - a.priority)
        .slice(0, options.maxReassignments);
    }

    if (options.thresholdOverride) {
      // Apply threshold overrides to filter actions
      // Implementation depends on specific business logic
    }

    return filtered;
  }

  private async executeActions(actions: RebalanceAction[]): Promise<RebalanceAction[]> {
    const executed: RebalanceAction[] = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'move_agent':
            await this.moveAgent(action.agentId!, action.fromTeamId!, action.toTeamId!);
            break;
          case 'redistribute_tasks':
            await this.redistributeTasks(action.taskIds!, action.toTeamId!);
            break;
          case 'adjust_capacity':
            await this.adjustTeamCapacity(action.toTeamId!);
            break;
        }
        executed.push(action);
      } catch (error) {
        console.error(`Failed to execute action:`, action, error);
      }
    }

    return executed;
  }

  private async moveAgent(agentId: string, fromTeamId: string, toTeamId: string): Promise<void> {
    const { error } = await supabase
      .from('agent_teams')
      .update({ team_id: toTeamId, updated_at: new Date().toISOString() })
      .eq('agent_id', agentId)
      .eq('team_id', fromTeamId);

    if (error) throw error;
  }

  private async redistributeTasks(taskIds: string[], toTeamId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ team_id: toTeamId, updated_at: new Date().toISOString() })
      .in('id', taskIds);

    if (error) throw error;
  }

  private async adjustTeamCapacity(teamId: string): Promise<void> {
    // Implementation for capacity adjustment
    // This could involve scaling resources, adjusting limits, etc.
  }

  private createRebalancingSummary(
    beforeMetrics: TeamMetrics[],
    afterMetrics: TeamMetrics[],
    actions: RebalanceAction[]
  ): any {
    return {
      totalActions: actions.length,
      agentsMoved: actions.filter(a => a.type === 'move_agent').length,
      tasksRedistributed: actions.filter(a => a.type === 'redistribute_tasks').length,
      capacityAdjustments: actions.filter(a => a.type === 'adjust_capacity').length,
      improvementScore: this.calculateImprovement(beforeMetrics, afterMetrics),
      timestamp: new Date().toISOString()
    };
  }

  private calculateImprovement(before: TeamMetrics[], after: TeamMetrics[]): number {
    // Calculate overall improvement score based on utilization balance
    const beforeVariance = this.calculateUtilizationVariance(before);
    const afterVariance = this.calculateUtilizationVariance(after);
    
    return Math.max(0, Math.min(100, ((beforeVariance - afterVariance) / beforeVariance) * 100));
  }

  private calculateUtilizationVariance(metrics: TeamMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const utilizations = metrics.map(m => m.avgUtilization);
    const mean = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
    const variance = utilizations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / utilizations.length;
    
    return variance;
  }

  private async logRebalancingEvent(
    strategy: string,
    actions: RebalanceAction[],
    summary: any
  ): Promise<void> {
    await supabase.from('rebalancing_logs').insert({
      strategy,
      actions_count: actions.length,
      summary,
      created_at: new Date().toISOString()
    });
  }
}

// Strategy Implementations
class WeightedRoundRobinStrategy implements RebalancingStrategy {
  name = 'weighted_round_robin';

  calculateRebalancing(teams: TeamMetrics[], agents: Agent[]): RebalanceAction[] {
    const actions: RebalanceAction[] = [];
    
    // Calculate target distribution based on team capacity
    const totalCapacity = teams.reduce((sum, team) => sum + team.totalCapacity, 0);
    const overloadedTeams = teams.filter(team => team.avgUtilization > 0.8);
    const underloadedTeams = teams.filter(team => team.avgUtilization < 0.4);

    // Move agents from overloaded to underloaded teams
    for (const overloaded of overloadedTeams) {
      const teamAgents = agents.filter(a => a.teamId === overloaded.teamId && a.status === 'active');
      const excessAgents = Math.floor(teamAgents.length * (overloaded.avgUtilization - 0.7));
      
      for (let i = 0; i < Math.min(excessAgents, underloadedTeams.length); i++) {
        const agent = teamAgents[i];
        const targetTeam = underloadedTeams[i % underloadedTeams.length];
        
        actions.push({
          type: 'move_agent',
          agentId: agent.id,
          fromTeamId: overloaded.teamId,
          toTeamId: targetTeam.teamId,
          reason: `Weighted distribution: moving from overloaded team (${overloaded.avgUtilization.toFixed(2)}) to underloaded team (${targetTeam.avgUtilization.toFixed(2)})`,
          priority: Math.floor((overloaded.avgUtilization - targetTeam.avgUtilization) * 100)
        });
      }
    }

    return actions;
  }
}

class LeastConnectionStrategy implements RebalancingStrategy {
  name = 'least_connection';

  calculateRebalancing(teams: TeamMetrics[], agents: Agent[]): RebalanceAction[] {
    const actions: RebalanceAction[] = [];
    
    // Sort teams by active task count
    const sortedTeams = [...teams].sort((a, b) => a.activeTaskCount - b.activeTaskCount);
    const highTaskTeams = sortedTeams.slice(-Math.ceil(teams.length / 3));
    const lowTaskTeams = sortedTeams.slice(0, Math.floor(teams.length / 3));

    // Redistribute tasks from high to low task teams
    for (const highTaskTeam of highTaskTeams) {
      const targetTeam = lowTaskTeams.find(t => t.activeTaskCount < highTaskTeam.activeTaskCount / 2);
      if (targetTeam) {
        const tasksToMove = Math.floor((highTaskTeam.activeTaskCount - targetTeam.activeTaskCount) / 4);
        
        // Get task IDs to redistribute (this would need actual task query)
        actions.push({
          type: 'redistribute_tasks',
          toTeamId: targetTeam.teamId,
          reason: `Load balancing: redistributing ${tasksToMove} tasks from overloaded team`,
          priority: highTaskTeam.activeTaskCount - targetTeam.activeTaskCount
        });
      }
    }

    return actions;
  }
}

class PerformanceBasedStrategy implements RebalancingStrategy {
  name = 'performance_based';

  calculateRebalancing(teams: TeamMetrics[], agents: Agent[]): RebalanceAction[] {
    const actions: RebalanceAction[] = [];
    
    // Identify underperforming teams and high-performing agents
    const underperformingTeams = teams.filter(team => team.avgPerformanceScore < 70);
    const highPerformingAgents = agents.filter(agent => 
      agent.performanceScore > 85 && 
      !underperformingTeams.some(team => team.teamId === agent.teamId)
    );

    // Move high-performing agents to underperforming teams
    underperformingTeams.forEach((team, index) => {
      if (index < highPerformingAgents.length) {
        const agent = highPerformingAgents[index];
        actions.push({
          type: 'move_agent',
          agentId: agent.id,
          fromTeamId: agent.teamId,
          toTeamId: team.teamId,
          reason: `Performance optimization: moving high-performing agent (score: ${agent.performanceScore}) to underperforming team (score: ${team.avgPerformanceScore})`,
          priority: 85 - team.avgPerformanceScore
        });
      }
    });

    return actions;
  }
}

class CapacityOptimizedStrategy implements RebalancingStrategy {
  name = 'capacity_optimized';

  calculateRebalancing(teams: TeamMetrics[], agents: Agent[]): RebalanceAction[] {
    const actions: RebalanceAction[] = [];
    
    // Calculate capacity utilization and identify imbalances
    const avgUtilization = teams.reduce((sum, team) => sum + (team.capacityUsed / team.totalCapacity), 0) / teams.length;
    
    teams.forEach(team => {
      const utilization = team.capacityUsed / team.totalCapacity;
      const deviation = Math.abs(utilization - avgUtilization);
      
      if (deviation > 0.2) { // 20% deviation threshold
        actions.push({
          type: 'adjust_capacity',
          toTeamId: team.teamId,
          reason: `Capacity optimization: ${utilization > avgUtilization ? 'increasing' : 'decreasing'} capacity for better distribution`,
          priority: Math.floor(deviation * 100)
        });
      }
    });

    return actions;
  }
}

// Team Metrics Analyzer
class TeamMetricsAnalyzer {
  async analyzeTeamBalance(teamIds?: string[]): Promise<{
    overallScore: number;
    recommendations: string[];
    criticalIssues: string[];
    metrics: TeamMetrics[];
  }> {
    const engine = new RebalancingEngine();
    const metrics = await engine['getTeamMetrics'](teamIds);
    
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    let overallScore = 100;

    // Analyze utilization balance
    const utilizationVariance = this.calculateUtilizationVariance(metrics);
    if (utilizationVariance > 0.1) {
      overallScore -= 20;
      recommendations.push('High utilization variance detected. Consider rebalancing workload.');
    }

    // Check for overloaded teams
    const overloadedTeams = metrics.filter(m => m.avgUtilization > 0.9);
    if (overloadedTeams.length > 0) {
      overallScore -= 30;
      criticalIssues.push(`${overloadedTeams.length} team(s) critically overloaded (>90% utilization)`);
    }

    // Check for underutilized teams
    const underutilizedTeams = metrics.filter(m => m.avgUtilization < 0.3);
    if (underutilizedTeams.length > 0) {
      overallScore -= 15;
      recommendations.push(`${underutilizedTeams.length} team(s) underutilized (<30% utilization)`);
    }

    // Check performance consistency
    const performanceVariance = this.calculatePerformanceVariance(metrics);
    if (performanceVariance > 15) {
      overallScore -= 25;
      recommendations.push('High performance variance across teams. Consider redistributing high-performing agents.');
    }

    return {
      overallScore: Math.max(0, overallScore),
      recommendations,
      criticalIssues,
      metrics
    };
  }

  private calculateUtilizationVariance(metrics: TeamMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const utilizations = metrics.map(m => m.avgUtilization);
    const mean = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
    const variance = utilizations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / utilizations.length;
    
    return variance;
  }

  private calculatePerformanceVariance(metrics: TeamMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const performances = metrics.map(m => m.avgPerformanceScore);
    const mean = performances.reduce((a, b) => a + b, 0) / performances.length;
    const variance = performances.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / performances.length;
    
    return Math.sqrt(variance);
  }
}

// Main API handlers
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = RebalanceRequestSchema.parse(body);

    const engine = new RebalancingEngine();
    const result = await engine.executeRebalancing(
      validatedData.strategy,
      validatedData.teamIds,
      {
        forceRebalance: validatedData.forceRebalance,
        maxReassignments: validatedData.maxReassignments,
        thresholdOverride: validatedData.thresholdOverride
      }
    );

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Rebalance API error:', error);
    
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
    // Rate limiting
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { search