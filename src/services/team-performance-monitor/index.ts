/**
 * Team Performance Monitoring Microservice
 * Tracks team-level KPIs including task completion rates, collaboration efficiency,
 * and goal achievement metrics with real-time alerts and optimization suggestions.
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Types and Interfaces
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
  isActive: boolean;
}

export interface Task {
  id: string;
  title: string;
  assigneeId: string;
  teamId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  completedAt?: Date;
  estimatedHours: number;
  actualHours?: number;
}

export interface Goal {
  id: string;
  title: string;
  teamId: string;
  targetValue: number;
  currentValue: number;
  metric: string;
  deadline: Date;
  status: 'active' | 'completed' | 'failed' | 'paused';
}

export interface TeamKPI {
  teamId: string;
  timestamp: Date;
  taskCompletionRate: number;
  averageTaskTime: number;
  collaborationScore: number;
  goalAchievementRate: number;
  productivity: number;
  burnoutRisk: number;
  velocity: number;
}

export interface Alert {
  id: string;
  teamId: string;
  type: 'performance' | 'deadline' | 'burnout' | 'collaboration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  isRead: boolean;
  actionRequired: boolean;
}

export interface OptimizationSuggestion {
  id: string;
  teamId: string;
  category: 'workflow' | 'resources' | 'communication' | 'goals';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'minimal' | 'moderate' | 'significant';
  expectedImprovement: string;
  actionItems: string[];
}

export interface PerformanceConfig {
  alertThresholds: {
    taskCompletionRateMin: number;
    collaborationScoreMin: number;
    burnoutRiskMax: number;
    velocityVarianceMax: number;
  };
  monitoringIntervals: {
    kpiCalculation: number;
    alertCheck: number;
    optimizationAnalysis: number;
  };
  retentionPeriod: number;
}

// Metrics Collector
class MetricsCollector extends EventEmitter {
  private supabase: SupabaseClient;
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.setupRealtimeSubscriptions();
  }

  /**
   * Set up real-time subscriptions for team activity data
   */
  private setupRealtimeSubscriptions(): void {
    // Subscribe to task updates
    this.supabase
      .channel('task-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => this.handleTaskUpdate(payload)
      )
      .subscribe();

    // Subscribe to goal updates
    this.supabase
      .channel('goal-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'goals' },
        (payload) => this.handleGoalUpdate(payload)
      )
      .subscribe();
  }

  /**
   * Collect team activity metrics for KPI calculation
   */
  public async collectTeamMetrics(teamId: string): Promise<{
    tasks: Task[];
    goals: Goal[];
    members: TeamMember[];
    interactions: any[];
  }> {
    const cacheKey = `team-metrics-${teamId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const [tasksResult, goalsResult, membersResult, interactionsResult] = await Promise.all([
        this.supabase
          .from('tasks')
          .select('*')
          .eq('team_id', teamId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        
        this.supabase
          .from('goals')
          .select('*')
          .eq('team_id', teamId),
        
        this.supabase
          .from('team_members')
          .select('*')
          .eq('team_id', teamId)
          .eq('is_active', true),
        
        this.supabase
          .from('team_interactions')
          .select('*')
          .eq('team_id', teamId)
          .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const metrics = {
        tasks: tasksResult.data || [],
        goals: goalsResult.data || [],
        members: membersResult.data || [],
        interactions: interactionsResult.data || []
      };

      this.cache.set(cacheKey, { data: metrics, timestamp: Date.now() });
      this.emit('metricsCollected', { teamId, metrics });

      return metrics;
    } catch (error) {
      console.error('Error collecting team metrics:', error);
      throw new Error(`Failed to collect metrics for team ${teamId}: ${error}`);
    }
  }

  private handleTaskUpdate(payload: any): void {
    this.invalidateCache(`team-metrics-${payload.new?.team_id || payload.old?.team_id}`);
    this.emit('taskUpdated', payload);
  }

  private handleGoalUpdate(payload: any): void {
    this.invalidateCache(`team-metrics-${payload.new?.team_id || payload.old?.team_id}`);
    this.emit('goalUpdated', payload);
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }
}

// KPI Calculator
class KPICalculator {
  /**
   * Calculate comprehensive team KPIs
   */
  public calculateKPIs(metrics: {
    tasks: Task[];
    goals: Goal[];
    members: TeamMember[];
    interactions: any[];
  }): TeamKPI {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Task completion rate
    const recentTasks = metrics.tasks.filter(task => task.createdAt >= thirtyDaysAgo);
    const completedTasks = recentTasks.filter(task => task.status === 'completed');
    const taskCompletionRate = recentTasks.length > 0 
      ? completedTasks.length / recentTasks.length * 100 
      : 0;

    // Average task completion time
    const completedTasksWithTime = completedTasks.filter(task => 
      task.completedAt && task.actualHours
    );
    const averageTaskTime = completedTasksWithTime.length > 0
      ? completedTasksWithTime.reduce((sum, task) => sum + (task.actualHours || 0), 0) / completedTasksWithTime.length
      : 0;

    // Collaboration score based on interactions
    const recentInteractions = metrics.interactions.filter(
      interaction => new Date(interaction.timestamp) >= sevenDaysAgo
    );
    const collaborationScore = this.calculateCollaborationScore(recentInteractions, metrics.members);

    // Goal achievement rate
    const activeGoals = metrics.goals.filter(goal => goal.status === 'active');
    const achievedGoals = metrics.goals.filter(goal => goal.status === 'completed');
    const goalAchievementRate = (activeGoals.length + achievedGoals.length) > 0
      ? achievedGoals.length / (activeGoals.length + achievedGoals.length) * 100
      : 0;

    // Productivity score
    const productivity = this.calculateProductivity(recentTasks, metrics.members);

    // Burnout risk assessment
    const burnoutRisk = this.calculateBurnoutRisk(recentTasks, metrics.interactions, metrics.members);

    // Velocity (tasks completed per day)
    const velocity = completedTasks.length / 30;

    return {
      teamId: metrics.tasks[0]?.teamId || '',
      timestamp: now,
      taskCompletionRate,
      averageTaskTime,
      collaborationScore,
      goalAchievementRate,
      productivity,
      burnoutRisk,
      velocity
    };
  }

  private calculateCollaborationScore(interactions: any[], members: TeamMember[]): number {
    if (interactions.length === 0 || members.length === 0) return 0;

    const interactionsPerMember = interactions.length / members.length;
    const uniqueInteractionPairs = new Set(
      interactions.map(i => [i.fromUserId, i.toUserId].sort().join('-'))
    ).size;
    const maxPossiblePairs = (members.length * (members.length - 1)) / 2;
    
    const pairCoverage = maxPossiblePairs > 0 ? uniqueInteractionPairs / maxPossiblePairs : 0;
    
    return Math.min(100, (interactionsPerMember * 10 + pairCoverage * 50));
  }

  private calculateProductivity(tasks: Task[], members: TeamMember[]): number {
    if (tasks.length === 0 || members.length === 0) return 0;

    const completedTasks = tasks.filter(task => task.status === 'completed');
    const totalEstimatedHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    const totalActualHours = completedTasks.reduce((sum, task) => sum + (task.actualHours || task.estimatedHours), 0);
    
    const efficiency = totalActualHours > 0 ? totalEstimatedHours / totalActualHours : 0;
    const throughput = completedTasks.length / members.length;
    
    return Math.min(100, (efficiency * 50 + throughput * 10));
  }

  private calculateBurnoutRisk(tasks: Task[], interactions: any[], members: TeamMember[]): number {
    const highPriorityTasks = tasks.filter(task => task.priority === 'high' || task.priority === 'critical');
    const overdueTasks = tasks.filter(task => 
      task.status !== 'completed' && 
      task.createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    const workloadPressure = (highPriorityTasks.length + overdueTasks.length) / Math.max(members.length, 1);
    const recentInteractionRate = interactions.length / Math.max(members.length, 1);
    
    // Lower interaction rate might indicate stress/isolation
    const communicationHealth = Math.max(0, 10 - recentInteractionRate);
    
    return Math.min(100, workloadPressure * 20 + communicationHealth * 5);
  }
}

// Alert Engine
class AlertEngine extends EventEmitter {
  private supabase: SupabaseClient;
  private config: PerformanceConfig;

  constructor(supabase: SupabaseClient, config: PerformanceConfig) {
    super();
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * Analyze KPIs and generate alerts if thresholds are exceeded
   */
  public async analyzeAndAlert(teamId: string, kpis: TeamKPI): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Task completion rate alert
      if (kpis.taskCompletionRate < this.config.alertThresholds.taskCompletionRateMin) {
        alerts.push(await this.createAlert(teamId, {
          type: 'performance',
          severity: 'high',
          message: `Team task completion rate (${kpis.taskCompletionRate.toFixed(1)}%) is below target (${this.config.alertThresholds.taskCompletionRateMin}%)`,
          actionRequired: true
        }));
      }

      // Collaboration score alert
      if (kpis.collaborationScore < this.config.alertThresholds.collaborationScoreMin) {
        alerts.push(await this.createAlert(teamId, {
          type: 'collaboration',
          severity: 'medium',
          message: `Team collaboration score (${kpis.collaborationScore.toFixed(1)}) is below healthy threshold`,
          actionRequired: true
        }));
      }

      // Burnout risk alert
      if (kpis.burnoutRisk > this.config.alertThresholds.burnoutRiskMax) {
        alerts.push(await this.createAlert(teamId, {
          type: 'burnout',
          severity: 'critical',
          message: `High burnout risk detected (${kpis.burnoutRisk.toFixed(1)}%). Immediate attention required.`,
          actionRequired: true
        }));
      }

      // Goal achievement alert
      if (kpis.goalAchievementRate < 50) {
        alerts.push(await this.createAlert(teamId, {
          type: 'performance',
          severity: 'medium',
          message: `Goal achievement rate (${kpis.goalAchievementRate.toFixed(1)}%) needs improvement`,
          actionRequired: false
        }));
      }

      // Save alerts to database
      if (alerts.length > 0) {
        await this.saveAlerts(alerts);
        this.emit('alertsGenerated', { teamId, alerts });
      }

      return alerts;
    } catch (error) {
      console.error('Error analyzing and creating alerts:', error);
      throw new Error(`Failed to analyze KPIs for team ${teamId}: ${error}`);
    }
  }

  private async createAlert(teamId: string, alertData: Partial<Alert>): Promise<Alert> {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teamId,
      timestamp: new Date(),
      isRead: false,
      ...alertData
    } as Alert;
  }

  private async saveAlerts(alerts: Alert[]): Promise<void> {
    const { error } = await this.supabase
      .from('team_alerts')
      .insert(alerts);

    if (error) {
      throw new Error(`Failed to save alerts: ${error.message}`);
    }
  }
}

// Optimization Engine
class OptimizationEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Generate optimization suggestions based on team performance data
   */
  public async generateOptimizations(
    teamId: string, 
    kpis: TeamKPI, 
    alerts: Alert[]
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    try {
      // Task completion optimization
      if (kpis.taskCompletionRate < 80) {
        suggestions.push({
          id: `opt_${Date.now()}_taskcompletion`,
          teamId,
          category: 'workflow',
          title: 'Improve Task Completion Rate',
          description: 'Task completion rate is below optimal levels. Consider workflow improvements.',
          impact: 'high',
          effort: 'moderate',
          expectedImprovement: 'Increase completion rate by 15-20%',
          actionItems: [
            'Review task assignment process',
            'Implement daily standup meetings',
            'Break down large tasks into smaller chunks',
            'Provide additional training or resources'
          ]
        });
      }

      // Collaboration optimization
      if (kpis.collaborationScore < 60) {
        suggestions.push({
          id: `opt_${Date.now()}_collaboration`,
          teamId,
          category: 'communication',
          title: 'Enhance Team Collaboration',
          description: 'Team collaboration metrics indicate room for improvement in cross-team communication.',
          impact: 'medium',
          effort: 'minimal',
          expectedImprovement: 'Improve collaboration score by 25%',
          actionItems: [
            'Schedule regular team building activities',
            'Implement pair programming sessions',
            'Create shared communication channels',
            'Establish cross-functional project teams'
          ]
        });
      }

      // Burnout prevention
      if (kpis.burnoutRisk > 60) {
        suggestions.push({
          id: `opt_${Date.now()}_burnout`,
          teamId,
          category: 'resources',
          title: 'Burnout Risk Mitigation',
          description: 'High burnout risk detected. Implement stress reduction measures.',
          impact: 'high',
          effort: 'moderate',
          expectedImprovement: 'Reduce burnout risk by 30-40%',
          actionItems: [
            'Redistribute workload more evenly',
            'Implement flexible working hours',
            'Provide stress management resources',
            'Schedule regular one-on-ones with team leads',
            'Consider hiring additional team members'
          ]
        });
      }

      // Goal achievement optimization
      if (kpis.goalAchievementRate < 70) {
        suggestions.push({
          id: `opt_${Date.now()}_goals`,
          teamId,
          category: 'goals',
          title: 'Goal Achievement Strategy',
          description: 'Goal achievement rate suggests need for better goal setting and tracking.',
          impact: 'medium',
          effort: 'moderate',
          expectedImprovement: 'Increase goal achievement by 20%',
          actionItems: [
            'Review and adjust goal difficulty',
            'Implement regular goal progress reviews',
            'Provide clearer success criteria',
            'Align individual goals with team objectives'
          ]
        });
      }

      // Save suggestions to database
      if (suggestions.length > 0) {
        await this.saveOptimizations(suggestions);
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating optimizations:', error);
      throw new Error(`Failed to generate optimizations for team ${teamId}: ${error}`);
    }
  }

  private async saveOptimizations(suggestions: OptimizationSuggestion[]): Promise<void> {
    const { error } = await this.supabase
      .from('team_optimizations')
      .insert(suggestions);

    if (error) {
      throw new Error(`Failed to save optimizations: ${error.message}`);
    }
  }
}

// Real-time Monitor
class RealtimeMonitor extends EventEmitter {
  private metricsCollector: MetricsCollector;
  private kpiCalculator: KPICalculator;
  private alertEngine: AlertEngine;
  private optimizationEngine: OptimizationEngine;
  private wsServer: WebSocket.Server;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: PerformanceConfig;

  constructor(
    metricsCollector: MetricsCollector,
    kpiCalculator: KPICalculator,
    alertEngine: AlertEngine,
    optimizationEngine: OptimizationEngine,
    config: PerformanceConfig,
    port: number = 8080
  ) {
    super();
    this.metricsCollector = metricsCollector;
    this.kpiCalculator = kpiCalculator;
    this.alertEngine = alertEngine;
    this.optimizationEngine = optimizationEngine;
    this.config = config;
    
    this.wsServer = new WebSocket.Server({ port });
    this.setupWebSocketHandlers();
  }

  /**
   * Start monitoring a team
   */
  public startTeamMonitoring(teamId: string): void {
    this.stopTeamMonitoring(teamId); // Clear any existing monitoring

    const interval = setInterval(async () => {
      try {
        await this.performMonitoringCycle(teamId);
      } catch (error) {
        console.error(`Error in monitoring cycle for team ${teamId}:`, error);
        this.emit('monitoringError', { teamId, error });
      }
    }, this.config.monitoringIntervals.kpiCalculation);

    this.monitoringIntervals.set(teamId, interval);
    this.emit('monitoringStarted', { teamId });
  }

  /**
   * Stop monitoring a team
   */
  public stopTeamMonitoring(teamId: string): void {
    const interval = this.monitoringIntervals.get(teamId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(teamId);
      this.emit('monitoringStopped', { teamId });
    }
  }

  private async performMonitoringCycle(teamId: string): Promise<void> {
    // Collect metrics
    const metrics = await this.metricsCollector.collectTeamMetrics(teamId);
    
    // Calculate KPIs
    const kpis = this.kpiCalculator.calculateKPIs(metrics);
    
    // Generate alerts
    const alerts = await this.alertEngine.analyzeAndAlert(teamId, kpis);
    
    // Generate optimizations
    const optimizations = await this.optimizationEngine.generateOptimizations(teamId, kpis, alerts);

    // Broadcast updates via WebSocket
    this.broadcastUpdate(teamId, {
      type: 'performance_update',
      data: {
        kpis,
        alerts,
        optimizations,
        timestamp: new Date()
      }
    });

    this.emit('monitoringCycleCompleted', {
      teamId,
      kpis,
      alerts: alerts.length,
      optimizations: optimizations.length
    });
  }

  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '', 'http://localhost');
      const teamId = url.searchParams.get('teamId');

      if (teamId) {
        ws.on('message', (message: string) => {
          try {
            const data