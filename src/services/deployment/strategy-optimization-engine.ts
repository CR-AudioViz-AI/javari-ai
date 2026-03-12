```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface DeploymentMetrics {
  deployment_id: string;
  cost_per_hour: number;
  response_time_p95: number;
  error_rate: number;
  availability: number;
  resource_utilization: number;
  scaling_events: number;
  timestamp: string;
}

interface DeploymentContext {
  environment: 'development' | 'staging' | 'production';
  service_type: string;
  expected_load: number;
  budget_constraints: number;
  performance_requirements: {
    max_response_time: number;
    min_availability: number;
    max_error_rate: number;
  };
  infrastructure_preferences: string[];
}

interface DeploymentStrategy {
  id: string;
  strategy_type: 'blue_green' | 'canary' | 'rolling' | 'recreate';
  resource_allocation: {
    cpu: number;
    memory: number;
    replicas: number;
  };
  scaling_config: {
    min_replicas: number;
    max_replicas: number;
    target_cpu_utilization: number;
  };
  rollback_config: {
    enabled: boolean;
    threshold_error_rate: number;
    rollback_timeout: number;
  };
  cost_optimization: {
    spot_instances: boolean;
    reserved_capacity: number;
    auto_scaling_policy: string;
  };
}

interface RLState {
  current_load: number;
  resource_utilization: number;
  cost_trend: number;
  error_rate: number;
  response_time: number;
  availability: number;
  time_of_day: number;
  day_of_week: number;
}

interface RLAction {
  strategy_id: string;
  resource_adjustment: number;
  scaling_factor: number;
  cost_optimization_level: number;
}

class ReinforcementLearningAgent {
  private qTable: Map<string, Map<string, number>> = new Map();
  private epsilon = 0.1; // Exploration rate
  private alpha = 0.1;   // Learning rate
  private gamma = 0.95;  // Discount factor

  private stateToKey(state: RLState): string {
    return `${Math.round(state.current_load/10)}_${Math.round(state.resource_utilization*10)}_${Math.round(state.cost_trend*10)}_${Math.round(state.error_rate*100)}_${Math.round(state.response_time/100)}_${Math.round(state.availability*100)}_${state.time_of_day}_${state.day_of_week}`;
  }

  private actionToKey(action: RLAction): string {
    return `${action.strategy_id}_${Math.round(action.resource_adjustment*10)}_${Math.round(action.scaling_factor*10)}_${Math.round(action.cost_optimization_level*10)}`;
  }

  selectAction(state: RLState, possibleActions: RLAction[]): RLAction {
    const stateKey = this.stateToKey(state);
    
    if (Math.random() < this.epsilon) {
      // Exploration: random action
      return possibleActions[Math.floor(Math.random() * possibleActions.length)];
    }
    
    // Exploitation: best known action
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    
    const stateActions = this.qTable.get(stateKey)!;
    let bestAction = possibleActions[0];
    let bestValue = -Infinity;
    
    for (const action of possibleActions) {
      const actionKey = this.actionToKey(action);
      const value = stateActions.get(actionKey) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return bestAction;
  }

  updateQValue(state: RLState, action: RLAction, reward: number, nextState: RLState, nextActions: RLAction[]): void {
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    const nextStateKey = this.stateToKey(nextState);
    
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    if (!this.qTable.has(nextStateKey)) {
      this.qTable.set(nextStateKey, new Map());
    }
    
    const currentQ = this.qTable.get(stateKey)!.get(actionKey) || 0;
    
    // Find max Q-value for next state
    let maxNextQ = 0;
    const nextStateActions = this.qTable.get(nextStateKey)!;
    for (const nextAction of nextActions) {
      const nextActionKey = this.actionToKey(nextAction);
      const nextQ = nextStateActions.get(nextActionKey) || 0;
      maxNextQ = Math.max(maxNextQ, nextQ);
    }
    
    // Q-learning update rule
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    this.qTable.get(stateKey)!.set(actionKey, newQ);
  }

  async saveModel(): Promise<void> {
    const modelData = {
      q_table: Object.fromEntries(
        Array.from(this.qTable.entries()).map(([state, actions]) => [
          state,
          Object.fromEntries(actions.entries())
        ])
      ),
      epsilon: this.epsilon,
      updated_at: new Date().toISOString()
    };

    await supabase.from('ml_models').upsert({
      model_id: 'deployment_strategy_rl',
      model_type: 'q_learning',
      model_data: modelData,
      version: Date.now().toString()
    });
  }

  async loadModel(): Promise<void> {
    const { data } = await supabase
      .from('ml_models')
      .select('model_data')
      .eq('model_id', 'deployment_strategy_rl')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (data?.model_data) {
      const modelData = data.model_data;
      this.qTable.clear();
      
      for (const [state, actions] of Object.entries(modelData.q_table)) {
        this.qTable.set(state, new Map(Object.entries(actions as Record<string, number>)));
      }
      
      this.epsilon = modelData.epsilon;
    }
  }
}

class DeploymentPatternAnalyzer {
  async analyzeDeploymentPatterns(timeRange: string = '30d'): Promise<any> {
    const { data: deployments } = await supabase
      .from('deployments')
      .select(`
        *,
        deployment_metrics(*)
      `)
      .gte('created_at', new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString());

    if (!deployments) return {};

    const patterns = {
      peak_hours: this.identifyPeakHours(deployments),
      failure_patterns: this.analyzeFailurePatterns(deployments),
      cost_patterns: this.analyzeCostPatterns(deployments),
      performance_patterns: this.analyzePerformancePatterns(deployments),
      scaling_patterns: this.analyzeScalingPatterns(deployments)
    };

    return patterns;
  }

  private parseTimeRange(range: string): number {
    const unit = range.slice(-1);
    const value = parseInt(range.slice(0, -1));
    
    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private identifyPeakHours(deployments: any[]): number[] {
    const hourCounts = new Array(24).fill(0);
    
    deployments.forEach(deployment => {
      if (deployment.deployment_metrics) {
        deployment.deployment_metrics.forEach((metric: DeploymentMetrics) => {
          const hour = new Date(metric.timestamp).getHours();
          hourCounts[hour] += metric.resource_utilization;
        });
      }
    });

    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(item => item.hour);
  }

  private analyzeFailurePatterns(deployments: any[]): any {
    const failures = deployments.filter(d => 
      d.deployment_metrics?.some((m: DeploymentMetrics) => m.error_rate > 0.05)
    );

    return {
      failure_rate: failures.length / deployments.length,
      common_failure_times: this.identifyPeakHours(failures),
      failure_causes: this.categorizeFailures(failures)
    };
  }

  private analyzeCostPatterns(deployments: any[]): any {
    const costs = deployments.flatMap(d => 
      d.deployment_metrics?.map((m: DeploymentMetrics) => m.cost_per_hour) || []
    );

    return {
      average_cost: costs.reduce((a, b) => a + b, 0) / costs.length,
      cost_variance: this.calculateVariance(costs),
      cost_trends: this.analyzeTrends(costs)
    };
  }

  private analyzePerformancePatterns(deployments: any[]): any {
    const responseTimes = deployments.flatMap(d => 
      d.deployment_metrics?.map((m: DeploymentMetrics) => m.response_time_p95) || []
    );

    return {
      average_response_time: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      performance_variance: this.calculateVariance(responseTimes),
      performance_trends: this.analyzeTrends(responseTimes)
    };
  }

  private analyzeScalingPatterns(deployments: any[]): any {
    const scalingEvents = deployments.flatMap(d => 
      d.deployment_metrics?.map((m: DeploymentMetrics) => m.scaling_events) || []
    );

    return {
      average_scaling_events: scalingEvents.reduce((a, b) => a + b, 0) / scalingEvents.length,
      scaling_frequency: scalingEvents.filter(e => e > 0).length / scalingEvents.length
    };
  }

  private categorizeFailures(failures: any[]): Record<string, number> {
    // Simplified failure categorization
    return {
      resource_exhaustion: Math.floor(failures.length * 0.4),
      network_issues: Math.floor(failures.length * 0.3),
      configuration_errors: Math.floor(failures.length * 0.2),
      external_dependencies: Math.floor(failures.length * 0.1)
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return variance;
  }

  private analyzeTrends(values: number[]): string {
    if (values.length < 2) return 'insufficient_data';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }
}

class CostOptimizer {
  calculateCostScore(metrics: DeploymentMetrics, strategy: DeploymentStrategy): number {
    const baseCost = metrics.cost_per_hour;
    const utilizationEfficiency = metrics.resource_utilization;
    const scalingCost = metrics.scaling_events * 0.1; // Cost penalty for frequent scaling
    
    let optimizationFactor = 1;
    
    if (strategy.cost_optimization.spot_instances) {
      optimizationFactor *= 0.7; // 30% savings with spot instances
    }
    
    if (strategy.cost_optimization.reserved_capacity > 0) {
      optimizationFactor *= (1 - strategy.cost_optimization.reserved_capacity * 0.2);
    }
    
    const totalCost = (baseCost + scalingCost) * optimizationFactor;
    const efficiency = utilizationEfficiency > 0 ? utilizationEfficiency : 0.1;
    
    return totalCost / efficiency; // Lower is better
  }

  generateCostOptimizationRecommendations(
    currentMetrics: DeploymentMetrics,
    currentStrategy: DeploymentStrategy
  ): string[] {
    const recommendations: string[] = [];
    
    if (currentMetrics.resource_utilization < 0.5) {
      recommendations.push('Consider reducing resource allocation - current utilization is low');
    }
    
    if (!currentStrategy.cost_optimization.spot_instances && currentMetrics.availability > 0.99) {
      recommendations.push('Consider using spot instances for cost savings');
    }
    
    if (currentMetrics.scaling_events > 10) {
      recommendations.push('Frequent scaling detected - consider adjusting scaling thresholds');
    }
    
    if (currentStrategy.cost_optimization.reserved_capacity < 0.3 && currentMetrics.resource_utilization > 0.8) {
      recommendations.push('Consider reserved capacity for consistent high utilization workloads');
    }
    
    return recommendations;
  }
}

class PerformanceAnalyzer {
  calculatePerformanceScore(metrics: DeploymentMetrics, requirements: DeploymentContext['performance_requirements']): number {
    let score = 100;
    
    // Response time penalty
    if (metrics.response_time_p95 > requirements.max_response_time) {
      const penalty = (metrics.response_time_p95 - requirements.max_response_time) / requirements.max_response_time;
      score -= Math.min(penalty * 50, 50);
    }
    
    // Error rate penalty
    if (metrics.error_rate > requirements.max_error_rate) {
      const penalty = (metrics.error_rate - requirements.max_error_rate) / requirements.max_error_rate;
      score -= Math.min(penalty * 30, 30);
    }
    
    // Availability penalty
    if (metrics.availability < requirements.min_availability) {
      const penalty = (requirements.min_availability - metrics.availability) / requirements.min_availability;
      score -= Math.min(penalty * 40, 40);
    }
    
    return Math.max(score, 0);
  }

  analyzePerformanceBottlenecks(metrics: DeploymentMetrics[]): string[] {
    const bottlenecks: string[] = [];
    
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.response_time_p95, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.error_rate, 0) / metrics.length;
    const avgUtilization = metrics.reduce((sum, m) => sum + m.resource_utilization, 0) / metrics.length;
    
    if (avgResponseTime > 1000) {
      bottlenecks.push('High response times detected');
    }
    
    if (avgErrorRate > 0.01) {
      bottlenecks.push('Elevated error rates observed');
    }
    
    if (avgUtilization > 0.9) {
      bottlenecks.push('Resource utilization consistently high');
    }
    
    return bottlenecks;
  }
}

class ReliabilityScorer {
  calculateReliabilityScore(metrics: DeploymentMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const avgAvailability = metrics.reduce((sum, m) => sum + m.availability, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.error_rate, 0) / metrics.length;
    const consistencyScore = this.calculateConsistency(metrics);
    
    return (avgAvailability * 0.4 + (1 - avgErrorRate) * 0.4 + consistencyScore * 0.2) * 100;
  }

  private calculateConsistency(metrics: DeploymentMetrics[]): number {
    if (metrics.length < 2) return 1;
    
    const availabilities = metrics.map(m => m.availability);
    const mean = availabilities.reduce((a, b) => a + b, 0) / availabilities.length;
    const variance = availabilities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / availabilities.length;
    const standardDeviation = Math.sqrt(variance);
    
    return Math.max(0, 1 - standardDeviation);
  }
}

class DeploymentStrategyEngine {
  private rlAgent: ReinforcementLearningAgent;
  private patternAnalyzer: DeploymentPatternAnalyzer;
  private costOptimizer: CostOptimizer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private reliabilityScorer: ReliabilityScorer;

  constructor() {
    this.rlAgent = new ReinforcementLearningAgent();
    this.patternAnalyzer = new DeploymentPatternAnalyzer();
    this.costOptimizer = new CostOptimizer();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.reliabilityScorer = new ReliabilityScorer();
  }

  async initialize(): Promise<void> {
    await this.rlAgent.loadModel();
  }

  async optimizeDeploymentStrategy(context: DeploymentContext): Promise<{
    recommendedStrategy: DeploymentStrategy;
    confidence: number;
    reasoning: string[];
    alternatives: DeploymentStrategy[];
  }> {
    // Get current state
    const currentMetrics = await this.getCurrentMetrics(context);
    const state = this.buildRLState(currentMetrics, context);
    
    // Generate possible strategies
    const possibleStrategies = this.generatePossibleStrategies(context);
    const possibleActions = possibleStrategies.map(s => this.strategyToAction(s));
    
    // Use RL agent to select best action
    const selectedAction = this.rlAgent.selectAction(state, possibleActions);
    const recommendedStrategy = possibleStrategies.find(s => 
      this.strategyToAction(s).strategy_id === selectedAction.strategy_id
    )!;
    
    // Calculate confidence and reasoning
    const confidence = await this.calculateConfidence(recommendedStrategy, context);
    const reasoning = await this.generateReasoning(recommendedStrategy, context);
    
    // Get alternative strategies
    const alternatives = possibleStrategies
      .filter(s => s.id !== recommendedStrategy.id)
      .slice(0, 3);

    return {
      recommendedStrategy,
      confidence,
      reasoning,
      alternatives
    };
  }

  async updateFromDeploymentOutcome(
    context: DeploymentContext,
    strategy: DeploymentStrategy,
    outcome: DeploymentMetrics
  ): Promise<void> {
    const initialState = this.buildRLState(await this.getCurrentMetrics(context), context);
    const action = this.strategyToAction(strategy);
    const reward = this.calculateReward(outcome, context);
    
    // Simulate next state after deployment
    const nextState = this.buildRLState(outcome, context);
    const nextActions = this.generatePossibleStrategies(context).map(s => this.strategyToAction(s));
    
    // Update RL agent
    this.rlAgent.updateQValue(initialState, action, reward, nextState, nextActions);
    
    // Save updated model
    await this.rlAgent.saveModel();
    
    // Store outcome for future analysis
    await supabase.from('deployment_outcomes').insert({
      deployment_id: `deploy_${Date.now()}`,
      context,
      strategy,
      outcome,
      reward,
      timestamp: new Date().toISOString()
    });
  }

  private async getCurrentMetrics(context: DeploymentContext): Promise<DeploymentMetrics> {
    const { data } = await supabase
      .from('deployment_metrics')
      .select('*')
      .eq('environment', context.environment)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return data || {
      deployment_id: 'current',
      cost_per_hour: 10,
      response_time_p95: 500,
      error_rate: 0.01,
      availability: 0.99,
      resource_utilization: 0.7,
      scaling_events: 2,
      timestamp: new Date().toISOString()
    };
  }

  private buildRLState(metrics: DeploymentMetrics, context: DeploymentContext): RLState {
    const now = new Date();
    return {
      current_load: context.expected_load,
      resource_utilization: metrics.resource_utilization,
      cost_trend: metrics.cost_per_hour / 20, // Normalize
      error_rate: metrics.error_rate,
      response_time: metrics.response_time_p95 / 1000, // Normalize
      availability: metrics.availability,
      time_of_day: now.getHours(),
      day_of_week: now.getDay()
    };
  }

  private generatePossibleStrategies(context: DeploymentContext): DeploymentStrategy[] {
    const baseStrategies: DeploymentStrategy[] = [
      {
        id: 'conservative',
        strategy_type: 'rolling',
        resource_allocation: {
          cpu: 2,
          memory: 4096,
          replicas: 3
        },
        scaling_config: {
          min_replicas: