```typescript
import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { AgentManager } from '../ai-agents/agent-manager.js';
import { AgentPool } from '../ai-agents/agent-pool.js';
import { DecisionTree } from '../decision-engine/decision-tree.js';
import { TeamPerformance } from '../analytics/team-performance.js';

/**
 * Represents an insight from an AI agent
 */
export interface AgentInsight {
  agentId: string;
  agentType: string;
  timestamp: number;
  content: string;
  confidence: number;
  metadata: Record<string, any>;
  tags: string[];
  weight: number;
}

/**
 * Represents consensus data for a set of insights
 */
export interface ConsensusData {
  topic: string;
  agreementScore: number;
  participantCount: number;
  majorityView: string;
  minorityViews: string[];
  convergenceTime: number;
  conflictAreas: string[];
}

/**
 * Represents a collective decision with confidence scoring
 */
export interface CollectiveDecision {
  id: string;
  topic: string;
  decision: string;
  confidenceScore: number;
  consensusScore: number;
  participatingAgents: string[];
  supportingInsights: AgentInsight[];
  dissendingViews: AgentInsight[];
  timestamp: number;
  validationScore: number;
  risks: string[];
  recommendations: string[];
}

/**
 * Configuration for consensus calculation
 */
export interface ConsensusConfig {
  minimumParticipants: number;
  agreementThreshold: number;
  confidenceWeighting: boolean;
  timeDecayFactor: number;
  convergenceTimeout: number;
}

/**
 * Weighting factors for different agent types
 */
export interface WeightingConfig {
  expertWeight: number;
  specialistWeight: number;
  generalistWeight: number;
  experienceMultiplier: number;
  accuracyMultiplier: number;
}

/**
 * Calculates consensus scores and agreements from multiple agent insights
 */
export class ConsensusCalculator {
  private config: ConsensusConfig;

  constructor(config: ConsensusConfig) {
    this.config = config;
  }

  /**
   * Calculate consensus from a collection of insights
   */
  public calculateConsensus(insights: AgentInsight[], topic: string): ConsensusData {
    try {
      if (insights.length < this.config.minimumParticipants) {
        throw new Error(`Insufficient participants: ${insights.length} < ${this.config.minimumParticipants}`);
      }

      const groupedInsights = this.groupSimilarInsights(insights);
      const weightedGroups = this.applyWeighting(groupedInsights);
      const agreementScore = this.calculateAgreementScore(weightedGroups);
      
      const majorityView = this.identifyMajorityView(weightedGroups);
      const minorityViews = this.identifyMinorityViews(weightedGroups, majorityView);
      const conflictAreas = this.identifyConflicts(insights);

      return {
        topic,
        agreementScore,
        participantCount: insights.length,
        majorityView,
        minorityViews,
        convergenceTime: this.calculateConvergenceTime(insights),
        conflictAreas
      };
    } catch (error) {
      throw new Error(`Consensus calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Group similar insights together using content similarity
   */
  private groupSimilarInsights(insights: AgentInsight[]): Map<string, AgentInsight[]> {
    const groups = new Map<string, AgentInsight[]>();
    const similarityThreshold = 0.7;

    for (const insight of insights) {
      let foundGroup = false;
      
      for (const [key, group] of groups.entries()) {
        const similarity = this.calculateContentSimilarity(insight.content, group[0].content);
        if (similarity > similarityThreshold) {
          group.push(insight);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.set(`group_${groups.size}`, [insight]);
      }
    }

    return groups;
  }

  /**
   * Calculate content similarity between two strings
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Apply weighting to grouped insights
   */
  private applyWeighting(groups: Map<string, AgentInsight[]>): Map<string, number> {
    const weightedGroups = new Map<string, number>();

    for (const [key, insights] of groups.entries()) {
      const totalWeight = insights.reduce((sum, insight) => {
        let weight = insight.weight * insight.confidence;
        if (this.config.confidenceWeighting) {
          weight *= insight.confidence;
        }
        return sum + weight;
      }, 0);
      
      weightedGroups.set(key, totalWeight);
    }

    return weightedGroups;
  }

  /**
   * Calculate overall agreement score
   */
  private calculateAgreementScore(weightedGroups: Map<string, number>): number {
    const weights = Array.from(weightedGroups.values());
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    if (totalWeight === 0) return 0;
    
    const maxWeight = Math.max(...weights);
    return maxWeight / totalWeight;
  }

  /**
   * Identify the majority view
   */
  private identifyMajorityView(weightedGroups: Map<string, number>): string {
    let maxWeight = 0;
    let majorityKey = '';

    for (const [key, weight] of weightedGroups.entries()) {
      if (weight > maxWeight) {
        maxWeight = weight;
        majorityKey = key;
      }
    }

    return majorityKey;
  }

  /**
   * Identify minority views
   */
  private identifyMinorityViews(weightedGroups: Map<string, number>, majorityView: string): string[] {
    return Array.from(weightedGroups.keys()).filter(key => key !== majorityView);
  }

  /**
   * Identify areas of conflict
   */
  private identifyConflicts(insights: AgentInsight[]): string[] {
    const conflicts: string[] = [];
    const tags = insights.flatMap(insight => insight.tags);
    const tagCounts = new Map<string, number>();

    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }

    for (const [tag, count] of tagCounts.entries()) {
      if (count >= 2 && count < insights.length * 0.8) {
        conflicts.push(tag);
      }
    }

    return conflicts;
  }

  /**
   * Calculate convergence time
   */
  private calculateConvergenceTime(insights: AgentInsight[]): number {
    if (insights.length === 0) return 0;
    
    const timestamps = insights.map(i => i.timestamp).sort();
    return timestamps[timestamps.length - 1] - timestamps[0];
  }
}

/**
 * Scores confidence levels for collective decisions
 */
export class ConfidenceScorer {
  private weightingConfig: WeightingConfig;

  constructor(weightingConfig: WeightingConfig) {
    this.weightingConfig = weightingConfig;
  }

  /**
   * Calculate confidence score for a collective decision
   */
  public calculateConfidenceScore(
    insights: AgentInsight[],
    consensusData: ConsensusData
  ): number {
    try {
      const baseConfidence = this.calculateBaseConfidence(insights);
      const consensusBoost = this.calculateConsensusBoost(consensusData);
      const diversityFactor = this.calculateDiversityFactor(insights);
      const experienceFactor = this.calculateExperienceFactor(insights);

      const confidenceScore = Math.min(1.0, 
        baseConfidence * consensusBoost * diversityFactor * experienceFactor
      );

      return Math.max(0, confidenceScore);
    } catch (error) {
      throw new Error(`Confidence scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate base confidence from individual agent confidence scores
   */
  private calculateBaseConfidence(insights: AgentInsight[]): number {
    if (insights.length === 0) return 0;

    const weightedConfidences = insights.map(insight => ({
      confidence: insight.confidence,
      weight: this.getAgentWeight(insight.agentType)
    }));

    const totalWeightedConfidence = weightedConfidences.reduce(
      (sum, wc) => sum + (wc.confidence * wc.weight), 0
    );
    const totalWeight = weightedConfidences.reduce(
      (sum, wc) => sum + wc.weight, 0
    );

    return totalWeight > 0 ? totalWeightedConfidence / totalWeight : 0;
  }

  /**
   * Calculate consensus boost factor
   */
  private calculateConsensusBoost(consensusData: ConsensusData): number {
    const baseBoost = 1.0;
    const consensusMultiplier = 0.5;
    
    return baseBoost + (consensusData.agreementScore * consensusMultiplier);
  }

  /**
   * Calculate diversity factor
   */
  private calculateDiversityFactor(insights: AgentInsight[]): number {
    const uniqueAgentTypes = new Set(insights.map(i => i.agentType));
    const diversityRatio = uniqueAgentTypes.size / insights.length;
    
    return 0.8 + (diversityRatio * 0.4);
  }

  /**
   * Calculate experience factor based on agent metadata
   */
  private calculateExperienceFactor(insights: AgentInsight[]): number {
    const experienceScores = insights.map(insight => 
      insight.metadata.experience || 1.0
    );
    
    const averageExperience = experienceScores.reduce(
      (sum, exp) => sum + exp, 0
    ) / experienceScores.length;

    return Math.min(1.5, 0.8 + (averageExperience * this.weightingConfig.experienceMultiplier * 0.2));
  }

  /**
   * Get weight for agent type
   */
  private getAgentWeight(agentType: string): number {
    switch (agentType.toLowerCase()) {
      case 'expert':
        return this.weightingConfig.expertWeight;
      case 'specialist':
        return this.weightingConfig.specialistWeight;
      case 'generalist':
        return this.weightingConfig.generalistWeight;
      default:
        return 1.0;
    }
  }
}

/**
 * Aggregates insights from multiple AI agents
 */
export class InsightAggregator {
  private agentManager: AgentManager;
  private agentPool: AgentPool;

  constructor(agentManager: AgentManager, agentPool: AgentPool) {
    this.agentManager = agentManager;
    this.agentPool = agentPool;
  }

  /**
   * Collect insights from all available agents on a topic
   */
  public async collectInsights(
    topic: string,
    context: Record<string, any> = {},
    timeout: number = 30000
  ): Promise<AgentInsight[]> {
    try {
      const availableAgents = await this.agentPool.getAvailableAgents();
      const insightPromises = availableAgents.map(agent =>
        this.collectAgentInsight(agent.id, topic, context, timeout)
      );

      const results = await Promise.allSettled(insightPromises);
      const insights: AgentInsight[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          insights.push(result.value);
        }
      }

      return this.deduplateInsights(insights);
    } catch (error) {
      throw new Error(`Insight collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect insight from a specific agent
   */
  private async collectAgentInsight(
    agentId: string,
    topic: string,
    context: Record<string, any>,
    timeout: number
  ): Promise<AgentInsight | null> {
    try {
      const agent = await this.agentManager.getAgent(agentId);
      if (!agent) return null;

      const response = await Promise.race([
        agent.generateInsight(topic, context),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      if (!response) return null;

      return {
        agentId: agent.id,
        agentType: agent.type,
        timestamp: Date.now(),
        content: response.content,
        confidence: response.confidence || 0.5,
        metadata: response.metadata || {},
        tags: response.tags || [],
        weight: this.calculateAgentWeight(agent)
      };
    } catch (error) {
      console.warn(`Failed to collect insight from agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Calculate weight for an agent based on its properties
   */
  private calculateAgentWeight(agent: any): number {
    let weight = 1.0;
    
    if (agent.accuracy) {
      weight *= agent.accuracy;
    }
    
    if (agent.experience) {
      weight *= Math.min(2.0, 1.0 + (agent.experience * 0.1));
    }

    if (agent.specialization) {
      weight *= 1.2;
    }

    return weight;
  }

  /**
   * Remove duplicate insights
   */
  private deduplateInsights(insights: AgentInsight[]): AgentInsight[] {
    const uniqueInsights = new Map<string, AgentInsight>();
    
    for (const insight of insights) {
      const key = `${insight.agentId}_${insight.content.substring(0, 100)}`;
      if (!uniqueInsights.has(key)) {
        uniqueInsights.set(key, insight);
      }
    }

    return Array.from(uniqueInsights.values());
  }
}

/**
 * Validates collective decisions before finalization
 */
export class DecisionValidator {
  private decisionTree: DecisionTree;
  private validationRules: Map<string, (decision: CollectiveDecision) => boolean>;

  constructor(decisionTree: DecisionTree) {
    this.decisionTree = decisionTree;
    this.validationRules = new Map();
    this.initializeValidationRules();
  }

  /**
   * Validate a collective decision
   */
  public validateDecision(decision: CollectiveDecision): {
    isValid: boolean;
    validationScore: number;
    issues: string[];
    recommendations: string[];
  } {
    try {
      const issues: string[] = [];
      const recommendations: string[] = [];
      let validationScore = 1.0;

      // Run all validation rules
      for (const [ruleName, rule] of this.validationRules.entries()) {
        try {
          if (!rule(decision)) {
            issues.push(`Failed validation rule: ${ruleName}`);
            validationScore -= 0.1;
          }
        } catch (error) {
          issues.push(`Validation rule ${ruleName} threw error: ${error}`);
          validationScore -= 0.05;
        }
      }

      // Check confidence threshold
      if (decision.confidenceScore < 0.6) {
        issues.push('Low confidence score');
        recommendations.push('Consider gathering more insights or expert review');
        validationScore -= 0.2;
      }

      // Check consensus threshold
      if (decision.consensusScore < 0.7) {
        issues.push('Low consensus score');
        recommendations.push('Address conflicting viewpoints before proceeding');
        validationScore -= 0.15;
      }

      // Check participant diversity
      const uniqueAgentTypes = new Set(
        decision.supportingInsights.map(i => i.agentType)
      );
      if (uniqueAgentTypes.size < 2) {
        issues.push('Insufficient agent diversity');
        recommendations.push('Include insights from different agent types');
        validationScore -= 0.1;
      }

      validationScore = Math.max(0, validationScore);

      return {
        isValid: issues.length === 0 || validationScore > 0.5,
        validationScore,
        issues,
        recommendations
      };
    } catch (error) {
      throw new Error(`Decision validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules.set('hasContent', (decision) => 
      decision.decision && decision.decision.length > 0
    );

    this.validationRules.set('hasParticipants', (decision) => 
      decision.participatingAgents.length >= 2
    );

    this.validationRules.set('hasSupportingInsights', (decision) => 
      decision.supportingInsights.length > 0
    );

    this.validationRules.set('confidenceInRange', (decision) => 
      decision.confidenceScore >= 0 && decision.confidenceScore <= 1
    );

    this.validationRules.set('consensusInRange', (decision) => 
      decision.consensusScore >= 0 && decision.consensusScore <= 1
    );

    this.validationRules.set('recentTimestamp', (decision) => 
      Date.now() - decision.timestamp < 24 * 60 * 60 * 1000 // Within 24 hours
    );
  }

  /**
   * Add custom validation rule
   */
  public addValidationRule(
    name: string, 
    rule: (decision: CollectiveDecision) => boolean
  ): void {
    this.validationRules.set(name, rule);
  }
}

/**
 * Resolves conflicts between different agent viewpoints
 */
export class ConflictResolver {
  /**
   * Resolve conflicts in insights and generate resolution strategies
   */
  public resolveConflicts(
    insights: AgentInsight[],
    consensusData: ConsensusData
  ): {
    resolutionStrategy: string;
    mediatedInsights: AgentInsight[];
    conflictSeverity: number;
    recommendations: string[];
  } {
    try {
      const conflictSeverity = this.assessConflictSeverity(insights, consensusData);
      const conflictType = this.identifyConflictType(insights);
      const resolutionStrategy = this.selectResolutionStrategy(conflictType, conflictSeverity);
      const mediatedInsights = this.applyResolutionStrategy(insights, resolutionStrategy);
      const recommendations = this.generateRecommendations(conflictType, conflictSeverity);

      return {
        resolutionStrategy,
        mediatedInsights,
        conflictSeverity,
        recommendations
      };
    } catch (error) {
      throw new Error(`Conflict resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assess the severity of conflicts
   */
  private assessConflictSeverity(insights: AgentInsight[], consensusData: ConsensusData): number {
    const disagreementScore = 1 - consensusData.agreementScore;
    const confidenceVariance = this.calculateConfidenceVariance(insights);
    const conflictAreaCount = consensusData.conflictAreas.length;

    return Math.min(1.0, (disagreementScore + confidenceVariance + (conflictAreaCount * 0.1)) / 3);
  }

  /**
   * Calculate variance in confidence scores
   */
  private calculateConfidenceVariance(insights: AgentInsight[]): number {
    if (insights.length === 0) return 0;

    const confidences = insights.map(i => i.confidence);
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;

    return Math.sqrt(variance);
  }

  /**
   * Identify the type of conflict
   */
  private identifyConflictType(insights: AgentInsight[]): string {
    const contentSimilarities = this.calculateContentSimilarities(insights);
    const confidenceGaps = this.calculateConfidenceGaps(insights);

    if (contentSimilarities.some(s => s < 0.3)) {
      return 'fundamental_disagreement';
    } else if (confidenceGaps.some(g => g > 0.4)) {
      return 'confidence_conflict';
    } else {
      return 'minor_disagreement';
    }
  }

  /**
   * Calculate content similarities between all pairs of insights
   */
  private calculateContentSimilarities(insights: AgentInsight[]): number[] {
    const similarities: number[] = [];
    
    for (let i = 0; i < insights.length; i++) {
      for (let j = i + 1; j < insights.length; j++) {
        const similarity = this.calculateContentSimilarity(
          insights[i].content, 
          insights[j].content
        );
        similarities.push(similarity);
      }
    }

    return similarities;
  }

  /**
   * Calculate content similarity (simple implementation)
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate confidence gaps between insights
   */
  private calculateConfidenceGaps(insights: AgentInsight[]): number[] {
    const confidences = insights.map(i => i.confidence).sort((a, b) => b - a);
    const gaps: number[] = [];

    for (let i = 0; i < confidences.length - 1; i++) {
      gaps