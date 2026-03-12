```typescript
/**
 * Agent Conflict Resolution Service
 * 
 * Intelligent service that detects and resolves conflicts between competing
 * agent decisions using consensus algorithms and priority scoring mechanisms.
 * 
 * @module AgentConflictResolutionService
 */

import { EventEmitter } from 'events';
import { supabase } from '../../lib/supabase/client';
import { logger } from '../../lib/logger';
import { RealtimeEventsService } from '../realtime-events';

// Types and Interfaces
export interface AgentDecision {
  id: string;
  agent_id: string;
  agent_type: string;
  decision_type: string;
  decision_data: Record<string, any>;
  confidence_score: number;
  timestamp: Date;
  context_hash: string;
  resource_targets: string[];
  priority_level: number;
}

export interface ConflictInfo {
  id: string;
  conflict_type: 'resource_contention' | 'decision_contradiction' | 'priority_clash';
  involved_agents: string[];
  involved_decisions: AgentDecision[];
  severity_score: number;
  detected_at: Date;
  context: Record<string, any>;
  resolution_strategy?: string;
  resolved_at?: Date;
  resolution_outcome?: Record<string, any>;
}

export interface AgentPerformanceMetrics {
  agent_id: string;
  success_rate: number;
  average_confidence: number;
  decision_accuracy: number;
  resolution_compliance: number;
  uptime_percentage: number;
  last_updated: Date;
}

export interface ConsensusResult {
  winning_decision: AgentDecision;
  consensus_score: number;
  voting_results: Record<string, number>;
  strategy_used: 'majority_vote' | 'weighted_consensus' | 'performance_based' | 'priority_override';
  confidence_level: number;
}

export interface ConflictResolutionOptions {
  enable_consensus_voting: boolean;
  use_performance_weighting: boolean;
  priority_override_threshold: number;
  max_resolution_time_ms: number;
  auto_escalate_unresolved: boolean;
  notification_channels: string[];
}

export interface ConflictPattern {
  pattern_id: string;
  conflict_signature: string;
  frequency: number;
  common_agents: string[];
  typical_resolution: string;
  success_rate: number;
}

/**
 * Conflict Detection Engine
 * Monitors agent decisions for potential conflicts
 */
class ConflictDetectionEngine extends EventEmitter {
  private pendingDecisions: Map<string, AgentDecision[]> = new Map();
  private detectionRules: Map<string, (decisions: AgentDecision[]) => ConflictInfo | null> = new Map();

  constructor() {
    super();
    this.initializeDetectionRules();
  }

  /**
   * Initialize conflict detection rules
   */
  private initializeDetectionRules(): void {
    // Resource contention detection
    this.detectionRules.set('resource_contention', (decisions) => {
      const resourceMap = new Map<string, AgentDecision[]>();
      
      decisions.forEach(decision => {
        decision.resource_targets.forEach(resource => {
          if (!resourceMap.has(resource)) {
            resourceMap.set(resource, []);
          }
          resourceMap.get(resource)!.push(decision);
        });
      });

      for (const [resource, conflictingDecisions] of resourceMap) {
        if (conflictingDecisions.length > 1) {
          return {
            id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conflict_type: 'resource_contention',
            involved_agents: conflictingDecisions.map(d => d.agent_id),
            involved_decisions: conflictingDecisions,
            severity_score: this.calculateSeverityScore(conflictingDecisions),
            detected_at: new Date(),
            context: { contested_resource: resource }
          };
        }
      }
      return null;
    });

    // Decision contradiction detection
    this.detectionRules.set('decision_contradiction', (decisions) => {
      const contextGroups = new Map<string, AgentDecision[]>();
      
      decisions.forEach(decision => {
        if (!contextGroups.has(decision.context_hash)) {
          contextGroups.set(decision.context_hash, []);
        }
        contextGroups.get(decision.context_hash)!.push(decision);
      });

      for (const [contextHash, contextDecisions] of contextGroups) {
        if (contextDecisions.length > 1) {
          const contradictory = this.detectContradictions(contextDecisions);
          if (contradictory.length > 0) {
            return {
              id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              conflict_type: 'decision_contradiction',
              involved_agents: contradictory.map(d => d.agent_id),
              involved_decisions: contradictory,
              severity_score: this.calculateSeverityScore(contradictory),
              detected_at: new Date(),
              context: { context_hash: contextHash }
            };
          }
        }
      }
      return null;
    });

    // Priority clash detection
    this.detectionRules.set('priority_clash', (decisions) => {
      const highPriorityDecisions = decisions.filter(d => d.priority_level >= 8);
      if (highPriorityDecisions.length > 1) {
        return {
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conflict_type: 'priority_clash',
          involved_agents: highPriorityDecisions.map(d => d.agent_id),
          involved_decisions: highPriorityDecisions,
          severity_score: Math.max(...highPriorityDecisions.map(d => d.priority_level)),
          detected_at: new Date(),
          context: { priority_threshold: 8 }
        };
      }
      return null;
    });
  }

  /**
   * Add decision for conflict monitoring
   */
  public addDecision(decision: AgentDecision): void {
    const contextKey = `${decision.decision_type}_${decision.context_hash}`;
    
    if (!this.pendingDecisions.has(contextKey)) {
      this.pendingDecisions.set(contextKey, []);
    }
    
    this.pendingDecisions.get(contextKey)!.push(decision);
    
    // Check for conflicts after adding decision
    this.checkForConflicts(contextKey);
  }

  /**
   * Check for conflicts in specific context
   */
  private checkForConflicts(contextKey: string): void {
    const decisions = this.pendingDecisions.get(contextKey) || [];
    
    if (decisions.length < 2) return;

    for (const [ruleName, rule] of this.detectionRules) {
      const conflict = rule(decisions);
      if (conflict) {
        logger.info(`Conflict detected: ${conflict.conflict_type}`, {
          conflictId: conflict.id,
          involvedAgents: conflict.involved_agents,
          severity: conflict.severity_score
        });
        
        this.emit('conflictDetected', conflict);
        break; // Only emit first detected conflict per context
      }
    }
  }

  /**
   * Calculate severity score for conflict
   */
  private calculateSeverityScore(decisions: AgentDecision[]): number {
    const maxPriority = Math.max(...decisions.map(d => d.priority_level));
    const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence_score, 0) / decisions.length;
    const agentCount = decisions.length;
    
    return Math.min(10, (maxPriority * 0.4 + avgConfidence * 0.3 + agentCount * 0.3));
  }

  /**
   * Detect contradictory decisions
   */
  private detectContradictions(decisions: AgentDecision[]): AgentDecision[] {
    // Simplified contradiction detection - can be enhanced based on decision types
    const decisionTypes = new Set(decisions.map(d => d.decision_type));
    if (decisionTypes.size > 1) {
      return decisions; // Different decision types in same context = contradiction
    }
    
    // Check for opposing decision data
    const contradictory: AgentDecision[] = [];
    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        if (this.areDecisionsContradictory(decisions[i], decisions[j])) {
          if (!contradictory.includes(decisions[i])) contradictory.push(decisions[i]);
          if (!contradictory.includes(decisions[j])) contradictory.push(decisions[j]);
        }
      }
    }
    
    return contradictory;
  }

  /**
   * Check if two decisions are contradictory
   */
  private areDecisionsContradictory(d1: AgentDecision, d2: AgentDecision): boolean {
    // Implement decision-specific contradiction logic
    if (d1.decision_type !== d2.decision_type) return true;
    
    // Example: opposite boolean values
    if (typeof d1.decision_data.value === 'boolean' && 
        typeof d2.decision_data.value === 'boolean') {
      return d1.decision_data.value !== d2.decision_data.value;
    }
    
    return false;
  }

  /**
   * Clear resolved decisions
   */
  public clearResolvedDecisions(conflictId: string): void {
    // Remove decisions that were part of resolved conflict
    this.pendingDecisions.clear(); // Simplified - could be more targeted
  }
}

/**
 * Consensus Algorithm Manager
 * Implements voting and weighted consensus mechanisms
 */
class ConsensusAlgorithmManager {
  private performanceMetrics: Map<string, AgentPerformanceMetrics> = new Map();

  /**
   * Run consensus algorithm on conflicting decisions
   */
  public async runConsensus(
    conflict: ConflictInfo,
    options: ConflictResolutionOptions
  ): Promise<ConsensusResult> {
    const decisions = conflict.involved_decisions;
    
    // Load performance metrics for involved agents
    await this.loadPerformanceMetrics(conflict.involved_agents);

    // Try different consensus strategies
    if (options.use_performance_weighting) {
      return this.performanceBasedConsensus(decisions);
    } else if (options.enable_consensus_voting) {
      return this.majorityVoteConsensus(decisions);
    } else {
      return this.priorityBasedConsensus(decisions);
    }
  }

  /**
   * Performance-based weighted consensus
   */
  private performanceBasedConsensus(decisions: AgentDecision[]): ConsensusResult {
    const weights = new Map<string, number>();
    let totalWeight = 0;

    // Calculate weights based on performance metrics
    decisions.forEach(decision => {
      const metrics = this.performanceMetrics.get(decision.agent_id);
      const weight = metrics 
        ? (metrics.success_rate * 0.4 + metrics.decision_accuracy * 0.4 + metrics.resolution_compliance * 0.2)
        : 0.5; // Default weight for agents without metrics
      
      weights.set(decision.id, weight);
      totalWeight += weight;
    });

    // Find decision with highest weighted score
    let bestDecision = decisions[0];
    let bestScore = 0;

    decisions.forEach(decision => {
      const weight = weights.get(decision.id) || 0;
      const score = (weight / totalWeight) * decision.confidence_score;
      
      if (score > bestScore) {
        bestScore = score;
        bestDecision = decision;
      }
    });

    return {
      winning_decision: bestDecision,
      consensus_score: bestScore,
      voting_results: Object.fromEntries(
        decisions.map(d => [d.agent_id, weights.get(d.id) || 0])
      ),
      strategy_used: 'performance_based',
      confidence_level: bestScore
    };
  }

  /**
   * Majority vote consensus
   */
  private majorityVoteConsensus(decisions: AgentDecision[]): ConsensusResult {
    const votes = new Map<string, number>();
    
    // Each agent gets one vote weighted by confidence
    decisions.forEach(decision => {
      const voteWeight = decision.confidence_score;
      votes.set(decision.id, voteWeight);
    });

    const sortedVotes = Array.from(votes.entries()).sort((a, b) => b[1] - a[1]);
    const winningDecisionId = sortedVotes[0][0];
    const winningDecision = decisions.find(d => d.id === winningDecisionId)!;

    return {
      winning_decision: winningDecision,
      consensus_score: sortedVotes[0][1],
      voting_results: Object.fromEntries(
        decisions.map(d => [d.agent_id, votes.get(d.id) || 0])
      ),
      strategy_used: 'majority_vote',
      confidence_level: sortedVotes[0][1]
    };
  }

  /**
   * Priority-based consensus
   */
  private priorityBasedConsensus(decisions: AgentDecision[]): ConsensusResult {
    const sorted = [...decisions].sort((a, b) => {
      // Sort by priority first, then by confidence
      if (a.priority_level !== b.priority_level) {
        return b.priority_level - a.priority_level;
      }
      return b.confidence_score - a.confidence_score;
    });

    const winningDecision = sorted[0];

    return {
      winning_decision: winningDecision,
      consensus_score: winningDecision.priority_level,
      voting_results: Object.fromEntries(
        decisions.map(d => [d.agent_id, d.priority_level])
      ),
      strategy_used: 'priority_override',
      confidence_level: winningDecision.confidence_score
    };
  }

  /**
   * Load performance metrics for agents
   */
  private async loadPerformanceMetrics(agentIds: string[]): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('agent_performance_metrics')
        .select('*')
        .in('agent_id', agentIds);

      if (error) throw error;

      data?.forEach(metrics => {
        this.performanceMetrics.set(metrics.agent_id, {
          agent_id: metrics.agent_id,
          success_rate: metrics.success_rate,
          average_confidence: metrics.average_confidence,
          decision_accuracy: metrics.decision_accuracy,
          resolution_compliance: metrics.resolution_compliance,
          uptime_percentage: metrics.uptime_percentage,
          last_updated: new Date(metrics.last_updated)
        });
      });
    } catch (error) {
      logger.error('Failed to load performance metrics', { error, agentIds });
    }
  }
}

/**
 * Priority Scorer
 * Calculates agent priority scores based on performance metrics
 */
class PriorityScorer {
  /**
   * Calculate priority score for agent
   */
  public calculatePriorityScore(
    agentId: string,
    metrics: AgentPerformanceMetrics,
    context: Record<string, any>
  ): number {
    const baseScore = (
      metrics.success_rate * 0.25 +
      metrics.decision_accuracy * 0.25 +
      metrics.resolution_compliance * 0.20 +
      metrics.uptime_percentage * 0.15 +
      metrics.average_confidence * 0.15
    );

    // Apply contextual modifiers
    let contextMultiplier = 1.0;
    
    // Boost score for agents with relevant expertise
    if (context.domain && this.hasExpertise(agentId, context.domain)) {
      contextMultiplier *= 1.2;
    }

    // Reduce score for recently conflicted agents
    if (context.recent_conflicts && context.recent_conflicts.includes(agentId)) {
      contextMultiplier *= 0.8;
    }

    return Math.min(10, baseScore * contextMultiplier);
  }

  /**
   * Check if agent has expertise in domain
   */
  private hasExpertise(agentId: string, domain: string): boolean {
    // Implement domain expertise checking logic
    // This would typically check agent capabilities/specializations
    return false; // Simplified implementation
  }

  /**
   * Update performance metrics
   */
  public async updatePerformanceMetrics(
    agentId: string,
    resolution: ConsensusResult,
    success: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_agent_performance', {
        p_agent_id: agentId,
        p_success: success,
        p_confidence: resolution.confidence_level,
        p_compliance: resolution.winning_decision.agent_id === agentId ? 1 : 0
      });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to update performance metrics', { error, agentId });
    }
  }
}

/**
 * Conflict Logger
 * Tracks conflict patterns and resolutions
 */
class ConflictLogger {
  private conflictPatterns: Map<string, ConflictPattern> = new Map();

  /**
   * Log conflict and resolution
   */
  public async logConflictResolution(
    conflict: ConflictInfo,
    resolution: ConsensusResult
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('conflict_logs')
        .insert({
          conflict_id: conflict.id,
          conflict_type: conflict.conflict_type,
          involved_agents: conflict.involved_agents,
          severity_score: conflict.severity_score,
          resolution_strategy: resolution.strategy_used,
          resolution_confidence: resolution.confidence_level,
          winning_agent: resolution.winning_decision.agent_id,
          detected_at: conflict.detected_at.toISOString(),
          resolved_at: new Date().toISOString(),
          context: conflict.context
        });

      if (error) throw error;

      // Update conflict patterns
      this.updateConflictPatterns(conflict, resolution);

    } catch (error) {
      logger.error('Failed to log conflict resolution', { error, conflict: conflict.id });
    }
  }

  /**
   * Update conflict pattern tracking
   */
  private updateConflictPatterns(conflict: ConflictInfo, resolution: ConsensusResult): void {
    const signature = this.generateConflictSignature(conflict);
    
    if (this.conflictPatterns.has(signature)) {
      const pattern = this.conflictPatterns.get(signature)!;
      pattern.frequency++;
      pattern.typical_resolution = resolution.strategy_used;
      // Update success rate based on resolution confidence
      pattern.success_rate = (pattern.success_rate + resolution.confidence_level) / 2;
    } else {
      this.conflictPatterns.set(signature, {
        pattern_id: `pattern_${Date.now()}`,
        conflict_signature: signature,
        frequency: 1,
        common_agents: conflict.involved_agents,
        typical_resolution: resolution.strategy_used,
        success_rate: resolution.confidence_level
      });
    }
  }

  /**
   * Generate conflict signature for pattern matching
   */
  private generateConflictSignature(conflict: ConflictInfo): string {
    const sortedAgents = [...conflict.involved_agents].sort();
    return `${conflict.conflict_type}_${sortedAgents.join('_')}_${Object.keys(conflict.context).sort().join('_')}`;
  }

  /**
   * Get conflict patterns for analysis
   */
  public getConflictPatterns(): ConflictPattern[] {
    return Array.from(this.conflictPatterns.values());
  }
}

/**
 * Main Agent Conflict Resolution Service
 */
export class AgentConflictResolutionService extends EventEmitter {
  private conflictDetector: ConflictDetectionEngine;
  private consensusManager: ConsensusAlgorithmManager;
  private priorityScorer: PriorityScorer;
  private conflictLogger: ConflictLogger;
  private realtimeService: RealtimeEventsService;
  
  private activeConflicts: Map<string, ConflictInfo> = new Map();
  private resolutionQueue: ConflictInfo[] = [];
  private isProcessingQueue = false;

  private readonly defaultOptions: ConflictResolutionOptions = {
    enable_consensus_voting: true,
    use_performance_weighting: true,
    priority_override_threshold: 9,
    max_resolution_time_ms: 5000,
    auto_escalate_unresolved: true,
    notification_channels: ['websocket', 'database']
  };

  constructor(
    options: Partial<ConflictResolutionOptions> = {},
    realtimeService?: RealtimeEventsService
  ) {
    super();
    
    this.conflictDetector = new ConflictDetectionEngine();
    this.consensusManager = new ConsensusAlgorithmManager();
    this.priorityScorer = new PriorityScorer();
    this.conflictLogger = new ConflictLogger();
    this.realtimeService = realtimeService || new RealtimeEventsService();

    // Merge options with defaults
    Object.assign(this.defaultOptions, options);

    this.setupEventListeners();
    this.startQueueProcessor();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.conflictDetector.on('conflictDetected', (conflict: ConflictInfo) => {
      this.handleDetectedConflict(conflict);
    });
  }

  /**
   * Handle detected conflict
   */
  private async handleDetectedConflict(conflict: ConflictInfo): Promise<void> {
    logger.info('Handling detected conflict', { 
      conflictId: conflict.id,
      type: conflict.conflict_type,
      severity: conflict.severity_score 
    });

    this.activeConflicts.set(conflict.id, conflict);
    this.resolutionQueue.push(conflict);
    
    // Emit conflict event for external listeners
    this.emit('conflictDetected', conflict);
    
    // Broadcast conflict detection if enabled
    if (this.defaultOptions.notification_channels.includes('websocket')) {
      await this.realtimeService.broadcastEvent('conflict_detected', {
        conflict_id: conflict.id,
        type: conflict.conflict_type,
        involved_agents: conflict.involved_agents,
        severity: conflict.severity_score
      });
    }
  }

  /**
   * Process agent decision and check for conflicts
   */
  public async processAgentDecision(decision: AgentDecision): Promise<void> {
    try {
      // Store decision in database
      const { error } = await supabase
        .from('agent_decisions')
        .insert({
          id: decision.