import { EventEmitter } from 'events';
import { Logger } from '../logging/Logger';
import { MetricsCollector } from '../metrics/MetricsCollector';

/**
 * Represents a learned pattern from team interactions
 */
export interface Pattern {
  id: string;
  name: string;
  description: string;
  context: PatternContext;
  strategy: Strategy;
  outcomes: OutcomeData[];
  confidence: number;
  usage_count: number;
  success_rate: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Context information for pattern application
 */
export interface PatternContext {
  team_size: number;
  roles: string[];
  task_type: string;
  complexity_level: number;
  domain: string;
  constraints: Record<string, any>;
}

/**
 * Problem-solving strategy definition
 */
export interface Strategy {
  id: string;
  name: string;
  steps: StrategyStep[];
  prerequisites: string[];
  expected_outcomes: string[];
  risk_factors: string[];
  adaptations: StrategyAdaptation[];
}

/**
 * Individual step in a strategy
 */
export interface StrategyStep {
  order: number;
  action: string;
  description: string;
  required_roles: string[];
  expected_duration: number;
  success_criteria: string[];
}

/**
 * Strategy adaptation based on context
 */
export interface StrategyAdaptation {
  condition: string;
  modification: string;
  impact_assessment: string;
}

/**
 * Outcome data from strategy execution
 */
export interface OutcomeData {
  execution_id: string;
  success: boolean;
  performance_metrics: Record<string, number>;
  duration: number;
  resource_usage: Record<string, number>;
  feedback: string[];
  lessons_learned: string[];
  timestamp: Date;
}

/**
 * Knowledge graph node representing relationships
 */
export interface KnowledgeNode {
  id: string;
  type: 'pattern' | 'strategy' | 'context' | 'outcome';
  data: any;
  relationships: KnowledgeRelationship[];
}

/**
 * Relationship between knowledge graph nodes
 */
export interface KnowledgeRelationship {
  target_id: string;
  type: string;
  strength: number;
  metadata: Record<string, any>;
}

/**
 * Cross-team learning recommendation
 */
export interface LearningRecommendation {
  pattern_id: string;
  confidence: number;
  applicability_score: number;
  required_adaptations: string[];
  expected_benefits: string[];
  risk_assessment: string;
}

/**
 * Intelligence metrics for measuring collective learning effectiveness
 */
export interface IntelligenceMetrics {
  pattern_discovery_rate: number;
  knowledge_transfer_success: number;
  adaptation_effectiveness: number;
  collective_performance_improvement: number;
  cross_team_learning_score: number;
}

/**
 * Collective memory entry for persistent storage
 */
export interface MemoryEntry {
  id: string;
  type: string;
  content: any;
  metadata: Record<string, any>;
  access_count: number;
  last_accessed: Date;
  retention_score: number;
}

/**
 * Pattern extraction configuration
 */
export interface ExtractionConfig {
  min_success_rate: number;
  min_usage_count: number;
  confidence_threshold: number;
  pattern_similarity_threshold: number;
  outcome_weight_factors: Record<string, number>;
}

/**
 * Extracts successful patterns from team interactions and outcomes
 */
class PatternExtractor {
  private logger: Logger;
  private config: ExtractionConfig;

  constructor(config: ExtractionConfig) {
    this.logger = Logger.getInstance();
    this.config = config;
  }

  /**
   * Extracts patterns from team execution data
   */
  public async extractPatterns(executionData: any[]): Promise<Pattern[]> {
    try {
      const patterns: Pattern[] = [];
      const groupedData = this.groupExecutionsByContext(executionData);

      for (const [contextKey, executions] of groupedData) {
        const pattern = await this.analyzeExecutionGroup(contextKey, executions);
        if (pattern && this.validatePattern(pattern)) {
          patterns.push(pattern);
        }
      }

      this.logger.info('PatternExtractor: Extracted patterns', { count: patterns.length });
      return patterns;
    } catch (error) {
      this.logger.error('PatternExtractor: Failed to extract patterns', { error });
      throw error;
    }
  }

  private groupExecutionsByContext(executions: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const execution of executions) {
      const contextKey = this.generateContextKey(execution.context);
      if (!groups.has(contextKey)) {
        groups.set(contextKey, []);
      }
      groups.get(contextKey)!.push(execution);
    }

    return groups;
  }

  private generateContextKey(context: PatternContext): string {
    return `${context.task_type}_${context.team_size}_${context.complexity_level}`;
  }

  private async analyzeExecutionGroup(contextKey: string, executions: any[]): Promise<Pattern | null> {
    if (executions.length < this.config.min_usage_count) {
      return null;
    }

    const successfulExecutions = executions.filter(e => e.outcome.success);
    const successRate = successfulExecutions.length / executions.length;

    if (successRate < this.config.min_success_rate) {
      return null;
    }

    const commonStrategy = this.extractCommonStrategy(successfulExecutions);
    const outcomes = executions.map(e => e.outcome);

    return {
      id: this.generatePatternId(contextKey),
      name: this.generatePatternName(contextKey, commonStrategy),
      description: this.generatePatternDescription(contextKey, commonStrategy),
      context: executions[0].context,
      strategy: commonStrategy,
      outcomes,
      confidence: this.calculateConfidence(executions),
      usage_count: executions.length,
      success_rate: successRate,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  private extractCommonStrategy(executions: any[]): Strategy {
    // Analyze common steps and approaches across successful executions
    const stepFrequency = new Map<string, number>();
    const allSteps: StrategyStep[] = [];

    for (const execution of executions) {
      if (execution.strategy && execution.strategy.steps) {
        for (const step of execution.strategy.steps) {
          const stepKey = `${step.action}_${step.description}`;
          stepFrequency.set(stepKey, (stepFrequency.get(stepKey) || 0) + 1);
          allSteps.push(step);
        }
      }
    }

    const commonSteps = allSteps.filter(step => {
      const stepKey = `${step.action}_${step.description}`;
      return (stepFrequency.get(stepKey) || 0) >= Math.ceil(executions.length * 0.6);
    });

    return {
      id: this.generateId(),
      name: 'Extracted Strategy',
      steps: commonSteps.sort((a, b) => a.order - b.order),
      prerequisites: [],
      expected_outcomes: [],
      risk_factors: [],
      adaptations: []
    };
  }

  private validatePattern(pattern: Pattern): boolean {
    return pattern.confidence >= this.config.confidence_threshold &&
           pattern.success_rate >= this.config.min_success_rate &&
           pattern.usage_count >= this.config.min_usage_count;
  }

  private calculateConfidence(executions: any[]): number {
    const successRate = executions.filter(e => e.outcome.success).length / executions.length;
    const sampleSize = Math.min(executions.length / 100, 1);
    const consistency = this.calculateConsistency(executions);
    
    return (successRate * 0.4 + sampleSize * 0.3 + consistency * 0.3);
  }

  private calculateConsistency(executions: any[]): number {
    // Calculate variance in performance metrics
    const metrics = executions.map(e => e.outcome.performance_metrics);
    if (metrics.length === 0) return 0;

    const avgVariance = Object.keys(metrics[0] || {}).reduce((sum, key) => {
      const values = metrics.map(m => m[key] || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      return sum + variance;
    }, 0);

    return Math.max(0, 1 - (avgVariance / 100)); // Normalize to 0-1 range
  }

  private generatePatternId(contextKey: string): string {
    return `pattern_${contextKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePatternName(contextKey: string, strategy: Strategy): string {
    return `Pattern for ${contextKey}`;
  }

  private generatePatternDescription(contextKey: string, strategy: Strategy): string {
    return `Successful pattern extracted from ${contextKey} executions`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Maintains relationships between patterns, strategies, and contexts
 */
class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Adds a node to the knowledge graph
   */
  public addNode(node: KnowledgeNode): void {
    try {
      this.nodes.set(node.id, node);
      this.logger.debug('KnowledgeGraph: Added node', { nodeId: node.id, type: node.type });
    } catch (error) {
      this.logger.error('KnowledgeGraph: Failed to add node', { error, nodeId: node.id });
      throw error;
    }
  }

  /**
   * Creates a relationship between two nodes
   */
  public addRelationship(sourceId: string, targetId: string, type: string, strength: number, metadata: Record<string, any> = {}): void {
    try {
      const sourceNode = this.nodes.get(sourceId);
      if (!sourceNode) {
        throw new Error(`Source node not found: ${sourceId}`);
      }

      const relationship: KnowledgeRelationship = {
        target_id: targetId,
        type,
        strength,
        metadata
      };

      sourceNode.relationships.push(relationship);
      this.logger.debug('KnowledgeGraph: Added relationship', { sourceId, targetId, type, strength });
    } catch (error) {
      this.logger.error('KnowledgeGraph: Failed to add relationship', { error, sourceId, targetId });
      throw error;
    }
  }

  /**
   * Finds related nodes by relationship type
   */
  public findRelatedNodes(nodeId: string, relationshipType: string, maxDepth: number = 2): KnowledgeNode[] {
    try {
      const visited = new Set<string>();
      const result: KnowledgeNode[] = [];
      
      this.traverseGraph(nodeId, relationshipType, maxDepth, visited, result);
      
      this.logger.debug('KnowledgeGraph: Found related nodes', { 
        nodeId, 
        relationshipType, 
        count: result.length 
      });
      
      return result;
    } catch (error) {
      this.logger.error('KnowledgeGraph: Failed to find related nodes', { error, nodeId });
      throw error;
    }
  }

  private traverseGraph(nodeId: string, relationshipType: string, depth: number, visited: Set<string>, result: KnowledgeNode[]): void {
    if (depth === 0 || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    for (const relationship of node.relationships) {
      if (relationship.type === relationshipType || relationshipType === '*') {
        const relatedNode = this.nodes.get(relationship.target_id);
        if (relatedNode && !result.find(n => n.id === relatedNode.id)) {
          result.push(relatedNode);
        }
        this.traverseGraph(relationship.target_id, relationshipType, depth - 1, visited, result);
      }
    }
  }

  /**
   * Gets all nodes of a specific type
   */
  public getNodesByType(type: string): KnowledgeNode[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  /**
   * Calculates the strength of connection between two nodes
   */
  public calculateConnectionStrength(sourceId: string, targetId: string): number {
    const paths = this.findAllPaths(sourceId, targetId, 3);
    if (paths.length === 0) return 0;

    return paths.reduce((maxStrength, path) => {
      const pathStrength = path.reduce((strength, nodeId, index) => {
        if (index === path.length - 1) return strength;
        
        const node = this.nodes.get(nodeId);
        const relationship = node?.relationships.find(r => r.target_id === path[index + 1]);
        return strength * (relationship?.strength || 0);
      }, 1);
      
      return Math.max(maxStrength, pathStrength);
    }, 0);
  }

  private findAllPaths(sourceId: string, targetId: string, maxDepth: number): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    this.findPathsDFS(sourceId, targetId, maxDepth, [sourceId], visited, paths);
    return paths;
  }

  private findPathsDFS(currentId: string, targetId: string, depth: number, currentPath: string[], visited: Set<string>, paths: string[][]): void {
    if (depth === 0 || visited.has(currentId)) {
      return;
    }

    if (currentId === targetId) {
      paths.push([...currentPath]);
      return;
    }

    visited.add(currentId);
    const node = this.nodes.get(currentId);
    if (!node) return;

    for (const relationship of node.relationships) {
      if (!visited.has(relationship.target_id)) {
        currentPath.push(relationship.target_id);
        this.findPathsDFS(relationship.target_id, targetId, depth - 1, currentPath, visited, paths);
        currentPath.pop();
      }
    }

    visited.delete(currentId);
  }
}

/**
 * Stores and indexes successful problem-solving approaches
 */
class StrategyRepository {
  private strategies: Map<string, Strategy> = new Map();
  private contextIndex: Map<string, string[]> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Stores a strategy in the repository
   */
  public storeStrategy(strategy: Strategy, context: PatternContext): void {
    try {
      this.strategies.set(strategy.id, strategy);
      this.indexStrategy(strategy.id, context);
      
      this.logger.info('StrategyRepository: Stored strategy', { 
        strategyId: strategy.id, 
        name: strategy.name 
      });
    } catch (error) {
      this.logger.error('StrategyRepository: Failed to store strategy', { 
        error, 
        strategyId: strategy.id 
      });
      throw error;
    }
  }

  /**
   * Retrieves strategies applicable to a given context
   */
  public getApplicableStrategies(context: PatternContext): Strategy[] {
    try {
      const contextKey = this.generateContextKey(context);
      const applicableIds = this.findApplicableStrategyIds(contextKey);
      
      const strategies = applicableIds
        .map(id => this.strategies.get(id))
        .filter((strategy): strategy is Strategy => strategy !== undefined);

      this.logger.debug('StrategyRepository: Found applicable strategies', {
        contextKey,
        count: strategies.length
      });

      return strategies;
    } catch (error) {
      this.logger.error('StrategyRepository: Failed to get applicable strategies', { error });
      throw error;
    }
  }

  /**
   * Updates a strategy with new information
   */
  public updateStrategy(strategyId: string, updates: Partial<Strategy>): void {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      const updatedStrategy = { ...strategy, ...updates };
      this.strategies.set(strategyId, updatedStrategy);

      this.logger.info('StrategyRepository: Updated strategy', { strategyId });
    } catch (error) {
      this.logger.error('StrategyRepository: Failed to update strategy', { error, strategyId });
      throw error;
    }
  }

  /**
   * Searches strategies by name or description
   */
  public searchStrategies(query: string): Strategy[] {
    try {
      const normalizedQuery = query.toLowerCase();
      const matchingStrategies = Array.from(this.strategies.values()).filter(strategy => 
        strategy.name.toLowerCase().includes(normalizedQuery) ||
        strategy.steps.some(step => 
          step.action.toLowerCase().includes(normalizedQuery) ||
          step.description.toLowerCase().includes(normalizedQuery)
        )
      );

      this.logger.debug('StrategyRepository: Search completed', {
        query,
        results: matchingStrategies.length
      });

      return matchingStrategies;
    } catch (error) {
      this.logger.error('StrategyRepository: Search failed', { error, query });
      throw error;
    }
  }

  private indexStrategy(strategyId: string, context: PatternContext): void {
    const contextKeys = this.generateContextKeys(context);
    
    for (const key of contextKeys) {
      if (!this.contextIndex.has(key)) {
        this.contextIndex.set(key, []);
      }
      this.contextIndex.get(key)!.push(strategyId);
    }
  }

  private generateContextKeys(context: PatternContext): string[] {
    return [
      `type_${context.task_type}`,
      `size_${context.team_size}`,
      `complexity_${context.complexity_level}`,
      `domain_${context.domain}`,
      this.generateContextKey(context)
    ];
  }

  private generateContextKey(context: PatternContext): string {
    return `${context.task_type}_${context.team_size}_${context.complexity_level}`;
  }

  private findApplicableStrategyIds(contextKey: string): string[] {
    const directMatches = this.contextIndex.get(contextKey) || [];
    const partialMatches: string[] = [];

    // Find partial matches for similar contexts
    for (const [key, strategyIds] of this.contextIndex) {
      if (key !== contextKey && this.calculateContextSimilarity(contextKey, key) > 0.7) {
        partialMatches.push(...strategyIds);
      }
    }

    return [...new Set([...directMatches, ...partialMatches])];
  }

  private calculateContextSimilarity(context1: string, context2: string): number {
    const parts1 = context1.split('_');
    const parts2 = context2.split('_');
    
    if (parts1.length !== parts2.length) return 0;
    
    let matches = 0;
    for (let i = 0; i < parts1.length; i++) {
      if (parts1[i] === parts2[i]) {
        matches++;
      }
    }
    
    return matches / parts1.length;
  }
}

/**
 * Facilitates knowledge transfer between different team configurations
 */
class CrossTeamLearner {
  private logger: Logger;
  private knowledgeGraph: KnowledgeGraph;
  private strategyRepository: StrategyRepository;

  constructor(knowledgeGraph: KnowledgeGraph, strategyRepository: StrategyRepository) {
    this.logger = Logger.getInstance();
    this.knowledgeGraph = knowledgeGraph;
    this.strategyRepository = strategyRepository;
  }

  /**
   * Generates learning recommendations for a team configuration
   */
  public generateRecommendations(targetContext: PatternContext, availablePatterns: Pattern[]): LearningRecommendation[] {
    try {
      const recommendations: LearningRecommendation[] = [];

      for (const pattern of availablePatterns) {
        const applicabilityScore = this.calculateApplicability(pattern.context, targetContext);
        
        if (applicabilityScore > 0.5) {
          const recommendation: LearningRecommendation = {
            pattern_id: pattern.id,
            confidence: pattern.confidence,
            applicability_score: applicabilityScore,
            required_adaptations: this.identifyRequiredAdaptations(pattern.context, targetContext),
            expected_benefits: this.predictBenefits(pattern, targetContext),
            risk_assessment: this.assessRisks(pattern, targetContext)
          };

          recommendations.push(recommendation);
        }
      }

      // Sort by combined score
      recommendations.sort((a, b) => {
        const scoreA = a.confidence * a.applicability_score;
        const scoreB = b.confidence * b.applicability_score;
        return scoreB - scoreA;
      });

      this.logger.info('CrossTeamLearner: Generated recommendations', {
        targetContext: targetContext.task_type,
        count: recommendations.length
      });

      return recommendations;
    } catch (error) {
      this.logger.error('CrossTeamLearner: Failed to generate recommendations', { error });
      throw error;
    }
  }

  /**
   * Adapts a pattern for a specific team configuration
   */
  public adaptPattern(pattern: Pattern, targetContext: PatternContext): Pattern {
    try {
      const adaptedStrategy = this.adaptStrategy(pattern.strategy, pattern.context, targetContext);
      
      const adaptedPattern: Pattern = {
        ...pattern,
        id: `adapted_${pattern.id}_${Date.now()}`,
        context: targetContext,
        strategy: adaptedStrategy,
        confidence: pattern.confidence * 0.8, // Reduce confidence for adapted patterns
        usage_count: 0,
        success_rate: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      this.logger.info('CrossTeamLearner: Adapted pattern', {