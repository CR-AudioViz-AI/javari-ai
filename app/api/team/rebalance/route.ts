```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import Redis from 'ioredis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { authenticate } from '@/lib/auth';

// Types and Schemas
const RebalanceRequestSchema = z.object({
  teamId: z.string().uuid(),
  trigger: z.enum(['manual', 'performance', 'requirement_change']),
  targetMetrics: z.object({
    efficiency: z.number().min(0).max(1).optional(),
    accuracy: z.number().min(0).max(1).optional(),
    responseTime: z.number().positive().optional(),
  }).optional(),
  constraints: z.object({
    maxSwaps: z.number().int().positive().default(3),
    preserveCore: z.boolean().default(true),
    allowDowngrade: z.boolean().default(false),
  }).optional(),
});

const AgentMetricsSchema = z.object({
  agentId: z.string().uuid(),
  efficiency: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  responseTime: z.number().positive(),
  errorRate: z.number().min(0).max(1),
  resourceUsage: z.number().min(0).max(1),
  compatibility: z.array(z.string()),
});

interface Team {
  id: string;
  name: string;
  agents: Agent[];
  configuration: TeamConfiguration;
  performance: TeamPerformance;
  status: 'active' | 'rebalancing' | 'paused' | 'error';
}

interface Agent {
  id: string;
  type: string;
  role: string;
  status: 'active' | 'standby' | 'swapping' | 'error';
  metrics: AgentMetrics;
  capabilities: string[];
  requirements: Record<string, any>;
}

interface AgentMetrics {
  efficiency: number;
  accuracy: number;
  responseTime: number;
  errorRate: number;
  resourceUsage: number;
  uptime: number;
  lastUpdated: Date;
}

interface TeamConfiguration {
  minAgents: number;
  maxAgents: number;
  requiredRoles: string[];
  performanceThresholds: PerformanceThresholds;
  rebalancePolicy: RebalancePolicy;
}

interface PerformanceThresholds {
  efficiency: { min: number; target: number };
  accuracy: { min: number; target: number };
  responseTime: { max: number; target: number };
  errorRate: { max: number; target: number };
}

interface RebalancePolicy {
  autoRebalance: boolean;
  checkInterval: number;
  cooldownPeriod: number;
  maxSwapsPerRebalance: number;
  requireApproval: boolean;
}

interface TeamPerformance {
  overall: number;
  efficiency: number;
  accuracy: number;
  responseTime: number;
  errorRate: number;
  trend: 'improving' | 'stable' | 'declining';
  lastRebalance: Date | null;
}

interface RebalanceDecision {
  shouldRebalance: boolean;
  confidence: number;
  recommendations: SwapRecommendation[];
  reasoning: string[];
  estimatedImpact: PerformanceImpact;
}

interface SwapRecommendation {
  removeAgent: string;
  addAgent: string;
  priority: number;
  reason: string;
  compatibility: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface PerformanceImpact {
  expectedImprovement: number;
  riskFactors: string[];
  rollbackPlan: RollbackPlan;
}

interface RollbackPlan {
  steps: RollbackStep[];
  triggers: string[];
  timeout: number;
}

interface RollbackStep {
  action: string;
  agentId: string;
  order: number;
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Circuit Breaker for agent swaps
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000,
    private monitorWindow = 300000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is open');
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

class TeamRebalancer {
  private circuitBreaker = new CircuitBreaker();
  
  async rebalanceTeam(
    teamId: string,
    trigger: string,
    constraints?: any
  ): Promise<RebalanceDecision> {
    try {
      return await this.circuitBreaker.execute(async () => {
        // Get current team state
        const team = await this.getTeam(teamId);
        if (!team) {
          throw new Error('Team not found');
        }

        // Collect and analyze performance metrics
        const metrics = await this.collectMetrics(teamId);
        const analysis = await this.analyzePerformance(team, metrics);

        // Generate rebalance decision
        const decision = await this.generateRebalanceDecision(
          team,
          analysis,
          trigger,
          constraints
        );

        // Execute rebalancing if recommended
        if (decision.shouldRebalance) {
          await this.executeRebalancing(team, decision);
        }

        return decision;
      });
    } catch (error) {
      console.error('Team rebalancing failed:', error);
      throw error;
    }
  }

  private async getTeam(teamId: string): Promise<Team | null> {
    // Try cache first
    const cached = await redis.get(`team:${teamId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        agents:team_agents(
          agent_id,
          agents(*)
        ),
        configuration:team_configurations(*),
        performance:team_performance(*)
      `)
      .eq('id', teamId)
      .single();

    if (error || !data) return null;

    const team = this.mapToTeam(data);
    
    // Cache for 5 minutes
    await redis.setex(`team:${teamId}`, 300, JSON.stringify(team));
    
    return team;
  }

  private async collectMetrics(teamId: string): Promise<AgentMetrics[]> {
    const { data, error } = await supabase
      .from('agent_metrics')
      .select('*')
      .in('agent_id', 
        supabase
          .from('team_agents')
          .select('agent_id')
          .eq('team_id', teamId)
      )
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to collect metrics: ${error.message}`);
    }

    return data?.map(this.mapToAgentMetrics) || [];
  }

  private async analyzePerformance(
    team: Team,
    metrics: AgentMetrics[]
  ): Promise<any> {
    const analysis = {
      overallPerformance: 0,
      agentPerformance: new Map<string, number>(),
      bottlenecks: [] as string[],
      underperforming: [] as string[],
      recommendations: [] as string[],
    };

    // Calculate overall team performance
    const avgEfficiency = metrics.reduce((sum, m) => sum + m.efficiency, 0) / metrics.length;
    const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracy, 0) / metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;

    analysis.overallPerformance = (avgEfficiency + avgAccuracy) / 2 - (avgErrorRate * 0.5);

    // Identify underperforming agents
    const thresholds = team.configuration.performanceThresholds;
    metrics.forEach(metric => {
      const score = (metric.efficiency + metric.accuracy) / 2 - (metric.errorRate * 0.5);
      analysis.agentPerformance.set(metric.agentId, score);

      if (
        metric.efficiency < thresholds.efficiency.min ||
        metric.accuracy < thresholds.accuracy.min ||
        metric.errorRate > thresholds.errorRate.max ||
        metric.responseTime > thresholds.responseTime.max
      ) {
        analysis.underperforming.push(metric.agentId);
      }
    });

    return analysis;
  }

  private async generateRebalanceDecision(
    team: Team,
    analysis: any,
    trigger: string,
    constraints?: any
  ): Promise<RebalanceDecision> {
    const decision: RebalanceDecision = {
      shouldRebalance: false,
      confidence: 0,
      recommendations: [],
      reasoning: [],
      estimatedImpact: {
        expectedImprovement: 0,
        riskFactors: [],
        rollbackPlan: { steps: [], triggers: [], timeout: 300000 }
      }
    };

    // Check if rebalancing is needed
    const performanceThreshold = 0.7;
    const cooldownPeriod = team.configuration.rebalancePolicy.cooldownPeriod;
    const lastRebalance = team.performance.lastRebalance;

    if (analysis.overallPerformance < performanceThreshold) {
      decision.shouldRebalance = true;
      decision.reasoning.push(`Overall performance (${analysis.overallPerformance.toFixed(2)}) below threshold (${performanceThreshold})`);
    }

    if (analysis.underperforming.length > 0) {
      decision.shouldRebalance = true;
      decision.reasoning.push(`${analysis.underperforming.length} underperforming agents detected`);
    }

    // Check cooldown period
    if (lastRebalance && Date.now() - lastRebalance.getTime() < cooldownPeriod) {
      decision.shouldRebalance = false;
      decision.reasoning.push('Cooldown period still active');
    }

    if (decision.shouldRebalance) {
      // Generate swap recommendations
      decision.recommendations = await this.generateSwapRecommendations(
        team,
        analysis,
        constraints
      );
      
      decision.confidence = this.calculateConfidence(team, analysis, decision.recommendations);
      decision.estimatedImpact = await this.estimateImpact(team, decision.recommendations);
    }

    return decision;
  }

  private async generateSwapRecommendations(
    team: Team,
    analysis: any,
    constraints?: any
  ): Promise<SwapRecommendation[]> {
    const recommendations: SwapRecommendation[] = [];
    const availableAgents = await this.getAvailableAgents(team);
    const compatibilityMatrix = await this.getCompatibilityMatrix();

    // For each underperforming agent, find better replacements
    for (const agentId of analysis.underperforming) {
      const agent = team.agents.find(a => a.id === agentId);
      if (!agent) continue;

      const candidates = availableAgents.filter(candidate => 
        candidate.type === agent.type &&
        candidate.capabilities.some(cap => agent.capabilities.includes(cap)) &&
        this.isCompatible(candidate, team.agents, compatibilityMatrix)
      );

      // Sort by performance potential
      candidates.sort((a, b) => this.calculateAgentScore(b) - this.calculateAgentScore(a));

      if (candidates.length > 0) {
        const bestCandidate = candidates[0];
        recommendations.push({
          removeAgent: agentId,
          addAgent: bestCandidate.id,
          priority: this.calculatePriority(agent, bestCandidate, analysis),
          reason: `Replace underperforming ${agent.role} with higher-performance alternative`,
          compatibility: this.getCompatibilityScore(bestCandidate, team.agents, compatibilityMatrix),
          riskLevel: this.assessRiskLevel(agent, bestCandidate, team)
        });
      }
    }

    // Sort by priority and limit by constraints
    recommendations.sort((a, b) => b.priority - a.priority);
    const maxSwaps = constraints?.maxSwaps || team.configuration.rebalancePolicy.maxSwapsPerRebalance;
    
    return recommendations.slice(0, maxSwaps);
  }

  private async executeRebalancing(
    team: Team,
    decision: RebalanceDecision
  ): Promise<void> {
    // Update team status
    await this.updateTeamStatus(team.id, 'rebalancing');

    try {
      // Create rollback checkpoint
      await this.createRollbackCheckpoint(team);

      // Execute swaps in priority order
      for (const recommendation of decision.recommendations) {
        await this.executeAgentSwap(team, recommendation);
        
        // Verify swap success
        const swapSuccess = await this.verifySwap(recommendation);
        if (!swapSuccess) {
          throw new Error(`Failed to verify swap: ${recommendation.removeAgent} -> ${recommendation.addAgent}`);
        }

        // Brief pause between swaps
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Update team status and performance tracking
      await this.updateTeamStatus(team.id, 'active');
      await this.recordRebalanceEvent(team.id, decision);
      
      // Broadcast update
      await this.broadcastTeamUpdate(team.id, 'rebalance_completed');

    } catch (error) {
      console.error('Rebalancing failed, initiating rollback:', error);
      await this.initiateRollback(team.id, decision.estimatedImpact.rollbackPlan);
      await this.updateTeamStatus(team.id, 'error');
      throw error;
    }
  }

  private async executeAgentSwap(
    team: Team,
    recommendation: SwapRecommendation
  ): Promise<void> {
    const hotSwapManager = new HotSwapManager();
    
    // Prepare new agent
    await hotSwapManager.prepareAgent(recommendation.addAgent, team);
    
    // Graceful shutdown of old agent
    await hotSwapManager.gracefulShutdown(recommendation.removeAgent);
    
    // Hot swap
    await hotSwapManager.executeSwap(recommendation.removeAgent, recommendation.addAgent);
    
    // Update database
    await supabase.rpc('execute_agent_swap', {
      team_id: team.id,
      old_agent_id: recommendation.removeAgent,
      new_agent_id: recommendation.addAgent,
      reason: recommendation.reason
    });
  }

  // Helper methods
  private mapToTeam(data: any): Team {
    // Implementation for mapping database data to Team interface
    return data as Team;
  }

  private mapToAgentMetrics(data: any): AgentMetrics {
    // Implementation for mapping database data to AgentMetrics interface
    return data as AgentMetrics;
  }

  private async getAvailableAgents(team: Team): Promise<Agent[]> {
    const { data } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'available')
      .not('id', 'in', `(${team.agents.map(a => a.id).join(',')})`);
    
    return data || [];
  }

  private async getCompatibilityMatrix(): Promise<Map<string, string[]>> {
    const { data } = await supabase
      .from('agent_compatibility')
      .select('*');
    
    const matrix = new Map<string, string[]>();
    data?.forEach(row => {
      matrix.set(row.agent_id, row.compatible_agents);
    });
    
    return matrix;
  }

  private isCompatible(
    agent: Agent,
    teamAgents: Agent[],
    matrix: Map<string, string[]>
  ): boolean {
    const compatibleIds = matrix.get(agent.id) || [];
    return teamAgents.every(teamAgent => 
      compatibleIds.includes(teamAgent.id) || teamAgent.id === agent.id
    );
  }

  private calculateAgentScore(agent: Agent): number {
    return (agent.metrics.efficiency + agent.metrics.accuracy) / 2 - agent.metrics.errorRate;
  }

  private calculatePriority(
    oldAgent: Agent,
    newAgent: Agent,
    analysis: any
  ): number {
    const scoreDiff = this.calculateAgentScore(newAgent) - this.calculateAgentScore(oldAgent);
    const agentPerformance = analysis.agentPerformance.get(oldAgent.id) || 0;
    return scoreDiff * (1 - agentPerformance);
  }

  private getCompatibilityScore(
    agent: Agent,
    teamAgents: Agent[],
    matrix: Map<string, string[]>
  ): number {
    const compatibleIds = matrix.get(agent.id) || [];
    const compatibleCount = teamAgents.filter(ta => compatibleIds.includes(ta.id)).length;
    return compatibleCount / teamAgents.length;
  }

  private assessRiskLevel(
    oldAgent: Agent,
    newAgent: Agent,
    team: Team
  ): 'low' | 'medium' | 'high' {
    if (oldAgent.role in team.configuration.requiredRoles) return 'high';
    if (this.calculateAgentScore(newAgent) - this.calculateAgentScore(oldAgent) < 0.1) return 'medium';
    return 'low';
  }

  private calculateConfidence(
    team: Team,
    analysis: any,
    recommendations: SwapRecommendation[]
  ): number {
    const avgCompatibility = recommendations.reduce((sum, r) => sum + r.compatibility, 0) / recommendations.length;
    const highRiskCount = recommendations.filter(r => r.riskLevel === 'high').length;
    const performanceGap = Math.abs(0.8 - analysis.overallPerformance);
    
    let confidence = avgCompatibility * 0.4 + (1 - performanceGap) * 0.4;
    confidence -= highRiskCount * 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private async estimateImpact(
    team: Team,
    recommendations: SwapRecommendation[]
  ): Promise<PerformanceImpact> {
    // Implementation for estimating performance impact
    return {
      expectedImprovement: 0.15, // Placeholder
      riskFactors: ['Agent compatibility', 'Role transition time'],
      rollbackPlan: {
        steps: recommendations.map((r, i) => ({
          action: 'restore_agent',
          agentId: r.removeAgent,
          order: i
        })),
        triggers: ['performance_degradation', 'error_threshold_exceeded'],
        timeout: 300000
      }
    };
  }

  private async updateTeamStatus(teamId: string, status: string): Promise<void> {
    await supabase
      .from('teams')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', teamId);
    
    // Update cache
    await redis.del(`team:${teamId}`);
  }

  private async createRollbackCheckpoint(team: Team): Promise<void> {
    await supabase
      .from('team_snapshots')
      .insert({
        team_id: team.id,
        snapshot_data: team,
        created_at: new Date().toISOString(),
        type: 'pre_rebalance'
      });
  }

  private async verifySwap(recommendation: SwapRecommendation): Promise<boolean> {
    // Implementation for verifying successful swap
    return true; // Placeholder
  }

  private async recordRebalanceEvent(teamId: string, decision: RebalanceDecision): Promise<void> {
    await supabase
      .from('rebalance_events')
      .insert({
        team_id: teamId,
        decision_data: decision,
        created_at: new Date().toISOString()
      });
  }

  private async broadcastTeamUpdate(teamId: string, event: string): Promise<void> {
    // Implementation for WebSocket broadcast
  }

  private async initiateRollback(teamId: string, rollbackPlan: RollbackPlan): Promise<void> {
    // Implementation for rollback logic
  }
}

class HotSwapManager {
  async prepareAgent(agentId: string, team: Team): Promise<void> {
    // Implementation for agent preparation
  }

  async gracefulShutdown(agentId: string): Promise<void> {
    // Implementation for graceful agent shutdown
  }

  async executeSwap(oldAgentId: string, newAgentId: string): Promise<void> {
    // Implementation for hot swap execution
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, { maxRequests: 10, windowMs: 60000 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await authenticate(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validated