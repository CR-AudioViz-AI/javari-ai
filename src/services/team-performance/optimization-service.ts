import { TensorFlowService } from '../../lib/ml/tensorflow-service';
import { TeamMetricsTable } from '../../lib/supabase/team-metrics-table';
import { PerformanceTracker } from '../../lib/analytics/performance-tracker';
import { CoordinatorService } from '../multi-agent/coordinator-service';
import { RealtimeMetrics } from '../../lib/websocket/real-time-metrics';
import * as tf from '@tensorflow/tfjs';

/**
 * Represents agent activity data for analysis
 */
export interface AgentActivity {
  agentId: string;
  taskId: string;
  timestamp: Date;
  action: 'start' | 'complete' | 'collaborate' | 'idle';
  duration: number;
  collaborators?: string[];
  performanceScore: number;
}

/**
 * Collaboration pattern between agents
 */
export interface CollaborationPattern {
  id: string;
  agentPair: [string, string];
  frequency: number;
  efficiency: number;
  avgDuration: number;
  successRate: number;
  pattern: 'sequential' | 'parallel' | 'hierarchical' | 'peer-to-peer';
}

/**
 * Identified performance bottleneck
 */
export interface PerformanceBottleneck {
  id: string;
  type: 'communication' | 'resource' | 'coordination' | 'skill-gap';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedAgents: string[];
  description: string;
  impactScore: number;
  estimatedDelay: number;
  suggestions: string[];
}

/**
 * Team performance metrics
 */
export interface TeamPerformanceMetrics {
  teamId: string;
  timestamp: Date;
  overallEfficiency: number;
  taskCompletionRate: number;
  collaborationIndex: number;
  bottleneckCount: number;
  avgTaskDuration: number;
  agentUtilization: Map<string, number>;
  performanceTrend: 'improving' | 'stable' | 'declining';
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  type: 'workflow' | 'resource-allocation' | 'skill-development' | 'team-structure';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: number;
  implementationCost: number;
  timeToImplement: number;
  affectedAgents: string[];
  metrics: string[];
  actionItems: string[];
}

/**
 * Performance report data
 */
export interface PerformanceReport {
  teamId: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: TeamPerformanceMetrics;
  collaborationPatterns: CollaborationPattern[];
  bottlenecks: PerformanceBottleneck[];
  recommendations: OptimizationRecommendation[];
  trends: {
    efficiency: number[];
    collaboration: number[];
    bottlenecks: number[];
  };
  visualizations: {
    collaborationMatrix: number[][];
    bottleneckHeatmap: number[][];
    performanceTrend: Array<{ date: Date; score: number }>;
  };
}

/**
 * Team dynamics visualization data
 */
export interface TeamDynamicsVisualization {
  nodes: Array<{
    id: string;
    label: string;
    size: number;
    color: string;
    utilization: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    weight: number;
    type: string;
    efficiency: number;
  }>;
  clusters: Array<{
    id: string;
    members: string[];
    performance: number;
  }>;
}

/**
 * Configuration for optimization analysis
 */
export interface OptimizationConfig {
  analysisWindow: number; // hours
  minCollaborationThreshold: number;
  bottleneckSensitivity: number;
  performanceWeights: {
    efficiency: number;
    collaboration: number;
    utilization: number;
    quality: number;
  };
}

/**
 * ML-powered team performance optimization service
 * Analyzes agent collaboration patterns and identifies improvement opportunities
 */
export class TeamPerformanceOptimizationService {
  private readonly tfService: TensorFlowService;
  private readonly metricsTable: TeamMetricsTable;
  private readonly performanceTracker: PerformanceTracker;
  private readonly coordinator: CoordinatorService;
  private readonly realtimeMetrics: RealtimeMetrics;
  private collaborationModel: tf.LayersModel | null = null;
  private bottleneckModel: tf.LayersModel | null = null;

  constructor(
    tfService: TensorFlowService,
    metricsTable: TeamMetricsTable,
    performanceTracker: PerformanceTracker,
    coordinator: CoordinatorService,
    realtimeMetrics: RealtimeMetrics
  ) {
    this.tfService = tfService;
    this.metricsTable = metricsTable;
    this.performanceTracker = performanceTracker;
    this.coordinator = coordinator;
    this.realtimeMetrics = realtimeMetrics;

    this.initializeMLModels();
  }

  /**
   * Initialize ML models for pattern recognition and bottleneck detection
   */
  private async initializeMLModels(): Promise<void> {
    try {
      // Collaboration pattern recognition model
      this.collaborationModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 pattern types
        ]
      });

      this.collaborationModel.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // Bottleneck detection model
      this.bottleneckModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [15], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'sigmoid' }) // 4 bottleneck types
        ]
      });

      this.bottleneckModel.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

    } catch (error) {
      console.error('Failed to initialize ML models:', error);
      throw new Error('ML model initialization failed');
    }
  }

  /**
   * Analyze team performance and generate comprehensive insights
   */
  public async analyzeTeamPerformance(
    teamId: string,
    config: OptimizationConfig = this.getDefaultConfig()
  ): Promise<TeamPerformanceMetrics> {
    try {
      const activities = await this.collectAgentActivities(teamId, config.analysisWindow);
      const collaborationPatterns = await this.detectCollaborationPatterns(activities);
      const bottlenecks = await this.identifyBottlenecks(activities, config);
      
      const metrics: TeamPerformanceMetrics = {
        teamId,
        timestamp: new Date(),
        overallEfficiency: this.calculateOverallEfficiency(activities, config.performanceWeights),
        taskCompletionRate: this.calculateCompletionRate(activities),
        collaborationIndex: this.calculateCollaborationIndex(collaborationPatterns),
        bottleneckCount: bottlenecks.length,
        avgTaskDuration: this.calculateAverageTaskDuration(activities),
        agentUtilization: this.calculateAgentUtilization(activities),
        performanceTrend: await this.analyzeTrend(teamId)
      };

      // Store metrics in database
      await this.metricsTable.insert({
        team_id: teamId,
        metrics: metrics,
        created_at: new Date()
      });

      // Send real-time updates
      await this.realtimeMetrics.broadcast('team-performance', {
        teamId,
        metrics
      });

      return metrics;

    } catch (error) {
      console.error('Team performance analysis failed:', error);
      throw new Error(`Failed to analyze team performance: ${error.message}`);
    }
  }

  /**
   * Detect collaboration patterns using ML pattern recognition
   */
  public async detectCollaborationPatterns(
    activities: AgentActivity[]
  ): Promise<CollaborationPattern[]> {
    try {
      const patterns: CollaborationPattern[] = [];
      const collaborationMatrix = this.buildCollaborationMatrix(activities);
      
      // Process each agent pair
      for (const [agentPair, interactions] of collaborationMatrix) {
        const features = this.extractCollaborationFeatures(interactions);
        
        if (this.collaborationModel) {
          const prediction = await this.tfService.predict(
            this.collaborationModel,
            tf.tensor2d([features])
          );
          
          const patternTypes = ['sequential', 'parallel', 'hierarchical', 'peer-to-peer'];
          const patternType = patternTypes[prediction.argMax(-1).dataSync()[0] as number];

          const pattern: CollaborationPattern = {
            id: `pattern-${agentPair.join('-')}-${Date.now()}`,
            agentPair: agentPair as [string, string],
            frequency: interactions.length,
            efficiency: this.calculateCollaborationEfficiency(interactions),
            avgDuration: this.calculateAverageCollaborationDuration(interactions),
            successRate: this.calculateCollaborationSuccessRate(interactions),
            pattern: patternType as CollaborationPattern['pattern']
          };

          patterns.push(pattern);
        }
      }

      return patterns;

    } catch (error) {
      console.error('Collaboration pattern detection failed:', error);
      throw new Error(`Failed to detect collaboration patterns: ${error.message}`);
    }
  }

  /**
   * Identify performance bottlenecks using sliding window analysis
   */
  public async identifyBottlenecks(
    activities: AgentActivity[],
    config: OptimizationConfig
  ): Promise<PerformanceBottleneck[]> {
    try {
      const bottlenecks: PerformanceBottleneck[] = [];
      const windowSize = Math.floor(config.analysisWindow * 0.1); // 10% of analysis window
      
      for (let i = 0; i <= activities.length - windowSize; i += windowSize) {
        const window = activities.slice(i, i + windowSize);
        const features = this.extractBottleneckFeatures(window);
        
        if (this.bottleneckModel) {
          const prediction = await this.tfService.predict(
            this.bottleneckModel,
            tf.tensor2d([features])
          );
          
          const probabilities = prediction.dataSync();
          const bottleneckTypes = ['communication', 'resource', 'coordination', 'skill-gap'];
          
          probabilities.forEach((probability, index) => {
            if (probability > config.bottleneckSensitivity) {
              const bottleneck: PerformanceBottleneck = {
                id: `bottleneck-${Date.now()}-${index}`,
                type: bottleneckTypes[index] as PerformanceBottleneck['type'],
                severity: this.calculateSeverity(probability),
                affectedAgents: this.getAffectedAgents(window),
                description: this.generateBottleneckDescription(bottleneckTypes[index], window),
                impactScore: probability,
                estimatedDelay: this.estimateDelay(window, probability),
                suggestions: this.generateBottleneckSuggestions(bottleneckTypes[index])
              };
              
              bottlenecks.push(bottleneck);
            }
          });
        }
      }

      return this.deduplicateBottlenecks(bottlenecks);

    } catch (error) {
      console.error('Bottleneck identification failed:', error);
      throw new Error(`Failed to identify bottlenecks: ${error.message}`);
    }
  }

  /**
   * Generate optimization recommendations based on analysis
   */
  public async generateOptimizationRecommendations(
    teamId: string,
    metrics: TeamPerformanceMetrics,
    patterns: CollaborationPattern[],
    bottlenecks: PerformanceBottleneck[]
  ): Promise<OptimizationRecommendation[]> {
    try {
      const recommendations: OptimizationRecommendation[] = [];

      // Workflow optimization recommendations
      if (metrics.overallEfficiency < 0.7) {
        recommendations.push({
          id: `workflow-opt-${Date.now()}`,
          type: 'workflow',
          priority: 'high',
          title: 'Optimize Task Workflow',
          description: 'Current workflow efficiency is below target. Consider restructuring task dependencies.',
          expectedImpact: 0.25,
          implementationCost: 0.3,
          timeToImplement: 168, // 1 week in hours
          affectedAgents: Array.from(metrics.agentUtilization.keys()),
          metrics: ['efficiency', 'task-completion-rate'],
          actionItems: [
            'Analyze task dependencies',
            'Implement parallel processing where possible',
            'Reduce handoff complexity'
          ]
        });
      }

      // Collaboration enhancement recommendations
      if (metrics.collaborationIndex < 0.6) {
        recommendations.push({
          id: `collab-enh-${Date.now()}`,
          type: 'team-structure',
          priority: 'medium',
          title: 'Enhance Team Collaboration',
          description: 'Low collaboration index detected. Improve communication channels and pairing strategies.',
          expectedImpact: 0.35,
          implementationCost: 0.2,
          timeToImplement: 72,
          affectedAgents: this.getUnderCollaboratingAgents(patterns),
          metrics: ['collaboration-index', 'task-completion-rate'],
          actionItems: [
            'Implement regular sync meetings',
            'Create shared knowledge bases',
            'Establish mentoring pairs'
          ]
        });
      }

      // Bottleneck-specific recommendations
      for (const bottleneck of bottlenecks.filter(b => b.severity === 'high' || b.severity === 'critical')) {
        recommendations.push({
          id: `bottleneck-fix-${bottleneck.id}`,
          type: this.mapBottleneckToRecommendationType(bottleneck.type),
          priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
          title: `Address ${bottleneck.type.replace('-', ' ')} Bottleneck`,
          description: bottleneck.description,
          expectedImpact: bottleneck.impactScore,
          implementationCost: this.estimateImplementationCost(bottleneck),
          timeToImplement: this.estimateImplementationTime(bottleneck),
          affectedAgents: bottleneck.affectedAgents,
          metrics: ['efficiency', 'bottleneck-count'],
          actionItems: bottleneck.suggestions
        });
      }

      return recommendations.sort((a, b) => 
        this.calculateRecommendationScore(b) - this.calculateRecommendationScore(a)
      );

    } catch (error) {
      console.error('Optimization recommendation generation failed:', error);
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }

  /**
   * Generate team dynamics visualization data
   */
  public async generateTeamDynamicsVisualization(
    teamId: string,
    activities: AgentActivity[],
    patterns: CollaborationPattern[]
  ): Promise<TeamDynamicsVisualization> {
    try {
      const agentMetrics = this.calculateAgentUtilization(activities);
      
      const nodes = Array.from(agentMetrics.entries()).map(([agentId, utilization]) => ({
        id: agentId,
        label: `Agent ${agentId}`,
        size: Math.max(10, utilization * 50),
        color: this.getPerformanceColor(utilization),
        utilization
      }));

      const edges = patterns.map(pattern => ({
        from: pattern.agentPair[0],
        to: pattern.agentPair[1],
        weight: pattern.frequency,
        type: pattern.pattern,
        efficiency: pattern.efficiency
      }));

      const clusters = await this.identifyTeamClusters(patterns);

      return { nodes, edges, clusters };

    } catch (error) {
      console.error('Team dynamics visualization generation failed:', error);
      throw new Error(`Failed to generate team dynamics visualization: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive performance report
   */
  public async generatePerformanceReport(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceReport> {
    try {
      const activities = await this.collectAgentActivitiesForPeriod(teamId, startDate, endDate);
      const collaborationPatterns = await this.detectCollaborationPatterns(activities);
      const bottlenecks = await this.identifyBottlenecks(activities, this.getDefaultConfig());
      const metrics = await this.analyzeTeamPerformance(teamId);
      const recommendations = await this.generateOptimizationRecommendations(
        teamId,
        metrics,
        collaborationPatterns,
        bottlenecks
      );
      
      const trends = await this.calculatePerformanceTrends(teamId, startDate, endDate);
      const visualizations = {
        collaborationMatrix: this.generateCollaborationMatrix(collaborationPatterns),
        bottleneckHeatmap: this.generateBottleneckHeatmap(bottlenecks),
        performanceTrend: trends.performanceTrend
      };

      return {
        teamId,
        period: { start: startDate, end: endDate },
        summary: metrics,
        collaborationPatterns,
        bottlenecks,
        recommendations,
        trends,
        visualizations
      };

    } catch (error) {
      console.error('Performance report generation failed:', error);
      throw new Error(`Failed to generate performance report: ${error.message}`);
    }
  }

  // Private helper methods

  private async collectAgentActivities(teamId: string, windowHours: number): Promise<AgentActivity[]> {
    const activities = await this.performanceTracker.getTeamActivities(
      teamId,
      new Date(Date.now() - windowHours * 60 * 60 * 1000),
      new Date()
    );
    return activities;
  }

  private async collectAgentActivitiesForPeriod(
    teamId: string,
    start: Date,
    end: Date
  ): Promise<AgentActivity[]> {
    return await this.performanceTracker.getTeamActivities(teamId, start, end);
  }

  private buildCollaborationMatrix(activities: AgentActivity[]): Map<string[], AgentActivity[]> {
    const matrix = new Map<string[], AgentActivity[]>();
    
    activities.forEach(activity => {
      if (activity.collaborators && activity.collaborators.length > 0) {
        activity.collaborators.forEach(collaborator => {
          const pair = [activity.agentId, collaborator].sort();
          const key = pair;
          if (!matrix.has(key)) {
            matrix.set(key, []);
          }
          matrix.get(key)!.push(activity);
        });
      }
    });

    return matrix;
  }

  private extractCollaborationFeatures(interactions: AgentActivity[]): number[] {
    return [
      interactions.length, // frequency
      interactions.reduce((sum, i) => sum + i.duration, 0) / interactions.length, // avg duration
      interactions.filter(i => i.performanceScore > 0.8).length / interactions.length, // success rate
      Math.max(...interactions.map(i => i.duration)), // max duration
      Math.min(...interactions.map(i => i.duration)), // min duration
      interactions.reduce((sum, i) => sum + i.performanceScore, 0) / interactions.length, // avg performance
      interactions.filter(i => i.action === 'collaborate').length, // collaboration count
      interactions.filter(i => i.action === 'complete').length, // completion count
      this.calculateTimeSpread(interactions), // time distribution
      this.calculateComplexityScore(interactions) // task complexity
    ];
  }

  private extractBottleneckFeatures(activities: AgentActivity[]): number[] {
    return [
      activities.length, // activity count
      activities.reduce((sum, a) => sum + a.duration, 0) / activities.length, // avg duration
      activities.filter(a => a.action === 'idle').length / activities.length, // idle ratio
      activities.filter(a => a.performanceScore < 0.5).length / activities.length, // low performance ratio
      this.calculateCommunicationGaps(activities), // communication gaps
      this.calculateResourceContention(activities), // resource contention
      this.calculateTaskComplexity(activities), // task complexity
      this.calculateAgentLoadVariance(activities), // load distribution
      this.calculateHandoffDelays(activities), // handoff efficiency
      this.calculateSkillMismatchScore(activities), // skill alignment
      this.calculateCoordinationOverhead(activities), // coordination cost
      activities.filter(a => a.collaborators && a.collaborators.length > 3).length, // high collaboration complexity
      this.calculateTimeToResolution(activities), // issue resolution time
      this.calculateQualityMetrics(activities), // output quality
      this.calculateStressIndicators(activities) // agent stress levels
    ];
  }

  private calculateOverallEfficiency(
    activities: AgentActivity[],
    weights: OptimizationConfig['performanceWeights']
  ): number {
    const efficiency = activities.filter(a => a.action === 'complete').length / activities.length;
    const collaboration = activities.filter(a => a.collaborators && a.collaborators.length > 0).length / activities.length;
    const utilization = 1 - (activities.filter(a => a.action === 'idle').length / activities.length);
    const quality = activities.reduce((sum, a) => sum + a.performanceScore, 0) / activities.length;

    return (
      efficiency * weights.efficiency +
      collaboration * weights.collaboration +
      utilization * weights.utilization +
      quality * weights.quality
    );
  }

  private calculateCompletionRate(activities: AgentActivity[]): number {
    const completed = activities.filter(a => a.action === 'complete').length;
    const started = activities.filter(a => a.action === 'start').length;
    return started > 0 ? completed / started : 0;
  }

  private calculateCollaborationIndex(patterns: CollaborationPattern[]): number {
    if (patterns.length === 0) return 0;
    return patterns.reduce((sum, p) => sum + p.efficiency,