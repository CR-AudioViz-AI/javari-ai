```typescript
import { supabase } from '../lib/supabase/client';
import { Agent, AgentResponse, AgentCapability } from '../types/agent.types';
import { 
  Disagreement, 
  DisagreementType, 
  ResolutionMethod, 
  ConflictSeverity,
  ResolutionOutcome,
  ConsensusVote,
  ExpertDecision,
  UserPreference 
} from '../types/disagreement.types';
import { 
  calculateWeightedVote,
  performRAFTConsensus,
  computeAgreementScore 
} from '../utils/consensus-algorithms';
import { 
  applyPreferenceWeights,
  updatePreferenceLearning,
  calculateUserSatisfaction 
} from '../utils/preference-weighting';

/**
 * Configuration for disagreement resolution algorithms
 */
interface ResolutionConfig {
  consensusThreshold: number;
  expertArbitrationThreshold: number;
  maxResolutionAttempts: number;
  userPreferenceWeight: number;
  conflictTimeoutMs: number;
}

/**
 * Metrics for tracking resolution performance
 */
interface ResolutionMetrics {
  totalDisagreements: number;
  successfulResolutions: number;
  averageResolutionTime: number;
  userSatisfactionScore: number;
  consensusSuccessRate: number;
  expertArbitrationRate: number;
}

/**
 * Context for disagreement resolution
 */
interface ResolutionContext {
  teamId: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  agentResponses: AgentResponse[];
  userPreferences: UserPreference[];
  previousResolutions: ResolutionOutcome[];
}

/**
 * Core service for detecting and resolving disagreements between team agents
 * using consensus algorithms, expert arbitration, and user preference weighting
 */
export class AgentDisagreementResolutionService {
  private config: ResolutionConfig;
  private metrics: ResolutionMetrics;
  private activeResolutions: Map<string, Promise<ResolutionOutcome>>;

  constructor(config: Partial<ResolutionConfig> = {}) {
    this.config = {
      consensusThreshold: 0.7,
      expertArbitrationThreshold: 0.5,
      maxResolutionAttempts: 3,
      userPreferenceWeight: 0.3,
      conflictTimeoutMs: 30000,
      ...config
    };

    this.metrics = {
      totalDisagreements: 0,
      successfulResolutions: 0,
      averageResolutionTime: 0,
      userSatisfactionScore: 0,
      consensusSuccessRate: 0,
      expertArbitrationRate: 0
    };

    this.activeResolutions = new Map();
  }

  /**
   * Main resolution orchestrator that coordinates the entire disagreement resolution process
   */
  async resolveDisagreement(context: ResolutionContext): Promise<ResolutionOutcome> {
    const startTime = Date.now();
    const disagreementId = this.generateDisagreementId(context);

    try {
      // Prevent duplicate resolution attempts
      if (this.activeResolutions.has(disagreementId)) {
        return await this.activeResolutions.get(disagreementId)!;
      }

      const resolutionPromise = this.performResolution(context, disagreementId);
      this.activeResolutions.set(disagreementId, resolutionPromise);

      const outcome = await resolutionPromise;
      
      // Update metrics
      this.updateMetrics(outcome, Date.now() - startTime);
      
      // Log resolution
      await this.logResolution(disagreementId, context, outcome);

      return outcome;

    } catch (error) {
      console.error('Disagreement resolution failed:', error);
      throw new Error(`Resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeResolutions.delete(disagreementId);
    }
  }

  /**
   * Detects conflicts between agent responses using similarity analysis and contradiction detection
   */
  async detectConflicts(responses: AgentResponse[]): Promise<Disagreement[]> {
    if (responses.length < 2) {
      return [];
    }

    const disagreements: Disagreement[] = [];

    // Pairwise conflict detection
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const conflict = await this.analyzeResponseConflict(responses[i], responses[j]);
        if (conflict) {
          disagreements.push(conflict);
        }
      }
    }

    // Group conflicts and classify severity
    return this.classifyConflictSeverity(disagreements);
  }

  /**
   * Performs consensus-based resolution using weighted voting
   */
  async performConsensusResolution(
    disagreement: Disagreement, 
    context: ResolutionContext
  ): Promise<ConsensusVote> {
    const { agentResponses, userPreferences } = context;

    // Calculate base agreement scores
    const agreementMatrix = await this.calculateAgreementMatrix(agentResponses);
    
    // Apply user preference weighting
    const weightedScores = applyPreferenceWeights(
      agreementMatrix, 
      userPreferences, 
      this.config.userPreferenceWeight
    );

    // Perform RAFT-inspired consensus
    const consensusResult = performRAFTConsensus(
      weightedScores,
      this.config.consensusThreshold
    );

    return {
      disagreementId: disagreement.id,
      votes: consensusResult.votes,
      winningResponse: consensusResult.leader,
      consensusStrength: consensusResult.strength,
      participatingAgents: agentResponses.map(r => r.agentId),
      timestamp: new Date()
    };
  }

  /**
   * Escalates complex disputes to expert agents for arbitration
   */
  async performExpertArbitration(
    disagreement: Disagreement,
    context: ResolutionContext
  ): Promise<ExpertDecision> {
    // Identify relevant expert agents based on disagreement domain
    const expertAgents = await this.identifyExpertAgents(disagreement);
    
    if (expertAgents.length === 0) {
      throw new Error('No expert agents available for arbitration');
    }

    // Present disagreement to expert agents
    const expertResponses = await Promise.all(
      expertAgents.map(expert => this.consultExpert(expert, disagreement, context))
    );

    // Aggregate expert decisions with capability weighting
    const decision = await this.aggregateExpertDecisions(expertResponses, disagreement);

    return {
      disagreementId: disagreement.id,
      expertAgents: expertAgents.map(e => e.id),
      decision: decision.resolution,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      timestamp: new Date()
    };
  }

  /**
   * Applies user preference weighting to resolution outcomes
   */
  async applyUserPreferences(
    outcomes: ResolutionOutcome[],
    preferences: UserPreference[],
    context: ResolutionContext
  ): Promise<ResolutionOutcome> {
    if (outcomes.length === 0) {
      throw new Error('No resolution outcomes to weight');
    }

    if (outcomes.length === 1) {
      return outcomes[0];
    }

    // Calculate preference-weighted scores for each outcome
    const weightedOutcomes = outcomes.map(outcome => ({
      outcome,
      score: this.calculatePreferenceScore(outcome, preferences, context)
    }));

    // Select highest scoring outcome
    const bestOutcome = weightedOutcomes.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Update user preference learning
    await updatePreferenceLearning(preferences, bestOutcome.outcome, context);

    return bestOutcome.outcome;
  }

  /**
   * Main resolution performance logic
   */
  private async performResolution(
    context: ResolutionContext, 
    disagreementId: string
  ): Promise<ResolutionOutcome> {
    // Detect conflicts in agent responses
    const disagreements = await this.detectConflicts(context.agentResponses);
    
    if (disagreements.length === 0) {
      return this.createNoConflictOutcome(context);
    }

    this.metrics.totalDisagreements += disagreements.length;

    const resolutionAttempts: ResolutionOutcome[] = [];

    for (const disagreement of disagreements) {
      let attempt = 0;
      let resolved = false;

      while (attempt < this.config.maxResolutionAttempts && !resolved) {
        try {
          let outcome: ResolutionOutcome;

          // Try consensus first for less severe conflicts
          if (disagreement.severity !== ConflictSeverity.CRITICAL) {
            const consensusVote = await this.performConsensusResolution(disagreement, context);
            
            if (consensusVote.consensusStrength >= this.config.consensusThreshold) {
              outcome = this.createConsensusOutcome(consensusVote, disagreement);
              resolved = true;
            }
          }

          // Escalate to expert arbitration if consensus fails or conflict is critical
          if (!resolved) {
            const expertDecision = await this.performExpertArbitration(disagreement, context);
            outcome = this.createExpertOutcome(expertDecision, disagreement);
            resolved = true;
          }

          if (resolved) {
            resolutionAttempts.push(outcome!);
            break;
          }

        } catch (error) {
          console.warn(`Resolution attempt ${attempt + 1} failed:`, error);
          attempt++;
        }
      }

      if (!resolved) {
        // Create fallback outcome
        resolutionAttempts.push(this.createFallbackOutcome(disagreement, context));
      }
    }

    // Apply user preferences to select final resolution
    const finalOutcome = await this.applyUserPreferences(
      resolutionAttempts,
      context.userPreferences,
      context
    );

    this.metrics.successfulResolutions++;
    return finalOutcome;
  }

  /**
   * Analyzes potential conflicts between two agent responses
   */
  private async analyzeResponseConflict(
    response1: AgentResponse, 
    response2: AgentResponse
  ): Promise<Disagreement | null> {
    // Calculate semantic similarity
    const similarity = await computeAgreementScore(response1.content, response2.content);
    
    // Detect contradictions
    const hasContradiction = this.detectContradiction(response1, response2);
    
    // Check for conflicting recommendations
    const hasConflictingActions = this.detectConflictingActions(response1, response2);

    if (similarity < 0.3 || hasContradiction || hasConflictingActions) {
      return {
        id: this.generateConflictId(response1, response2),
        type: this.classifyDisagreementType(response1, response2),
        severity: this.calculateSeverity(similarity, hasContradiction, hasConflictingActions),
        involvedAgents: [response1.agentId, response2.agentId],
        conflictingResponses: [response1, response2],
        detectedAt: new Date(),
        context: this.extractConflictContext(response1, response2)
      };
    }

    return null;
  }

  /**
   * Identifies expert agents capable of arbitrating specific types of disagreements
   */
  private async identifyExpertAgents(disagreement: Disagreement): Promise<Agent[]> {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .contains('capabilities', [this.getRequiredCapability(disagreement.type)]);

    if (error) {
      throw new Error(`Failed to fetch expert agents: ${error.message}`);
    }

    // Sort by expertise level and availability
    return agents
      .filter(agent => this.isExpertForDisagreement(agent, disagreement))
      .sort((a, b) => this.compareExpertise(a, b, disagreement));
  }

  /**
   * Consults an expert agent for arbitration decision
   */
  private async consultExpert(
    expert: Agent, 
    disagreement: Disagreement, 
    context: ResolutionContext
  ): Promise<AgentResponse> {
    const consultation = {
      expertId: expert.id,
      disagreement,
      context: this.summarizeContextForExpert(context),
      requestedAt: new Date()
    };

    // This would typically call the agent's decision-making API
    // For now, we'll simulate expert consultation
    return this.simulateExpertConsultation(expert, consultation);
  }

  /**
   * Aggregates multiple expert decisions into a single arbitration result
   */
  private async aggregateExpertDecisions(
    expertResponses: AgentResponse[], 
    disagreement: Disagreement
  ): Promise<{ resolution: string; confidence: number; reasoning: string }> {
    if (expertResponses.length === 0) {
      throw new Error('No expert responses to aggregate');
    }

    // Weight expert opinions by their capability scores
    const weightedDecisions = expertResponses.map(response => ({
      response,
      weight: this.calculateExpertWeight(response.agentId, disagreement.type)
    }));

    // Find consensus among experts
    const consensusDecision = this.findExpertConsensus(weightedDecisions);
    
    return {
      resolution: consensusDecision.decision,
      confidence: consensusDecision.confidence,
      reasoning: this.generateAggregateReasoning(weightedDecisions)
    };
  }

  /**
   * Calculates agreement matrix between all agent responses
   */
  private async calculateAgreementMatrix(responses: AgentResponse[]): Promise<number[][]> {
    const matrix: number[][] = [];
    
    for (let i = 0; i < responses.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < responses.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = await computeAgreementScore(responses[i].content, responses[j].content);
        }
      }
    }
    
    return matrix;
  }

  /**
   * Logs resolution outcome to database
   */
  private async logResolution(
    disagreementId: string, 
    context: ResolutionContext, 
    outcome: ResolutionOutcome
  ): Promise<void> {
    const { error } = await supabase
      .from('disagreement_resolutions')
      .insert({
        disagreement_id: disagreementId,
        team_id: context.teamId,
        session_id: context.sessionId,
        user_id: context.userId,
        resolution_method: outcome.method,
        outcome_data: outcome,
        resolution_time: outcome.resolutionTime,
        user_satisfaction: calculateUserSatisfaction(outcome, context.userPreferences),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log resolution:', error);
    }
  }

  /**
   * Updates service performance metrics
   */
  private updateMetrics(outcome: ResolutionOutcome, resolutionTime: number): void {
    const previousCount = this.metrics.successfulResolutions - 1;
    const previousAverage = this.metrics.averageResolutionTime;
    
    this.metrics.averageResolutionTime = 
      (previousAverage * previousCount + resolutionTime) / this.metrics.successfulResolutions;
    
    if (outcome.method === ResolutionMethod.CONSENSUS) {
      this.metrics.consensusSuccessRate = 
        (this.metrics.consensusSuccessRate * previousCount + 1) / this.metrics.successfulResolutions;
    } else if (outcome.method === ResolutionMethod.EXPERT_ARBITRATION) {
      this.metrics.expertArbitrationRate =
        (this.metrics.expertArbitrationRate * previousCount + 1) / this.metrics.successfulResolutions;
    }
  }

  /**
   * Helper methods for conflict detection and classification
   */
  private detectContradiction(response1: AgentResponse, response2: AgentResponse): boolean {
    // Implement contradiction detection logic
    const contradictoryPhrases = [
      ['should', 'should not'],
      ['recommend', 'do not recommend'],
      ['increase', 'decrease'],
      ['enable', 'disable']
    ];

    for (const [phrase1, phrase2] of contradictoryPhrases) {
      if (response1.content.toLowerCase().includes(phrase1) && 
          response2.content.toLowerCase().includes(phrase2)) {
        return true;
      }
    }

    return false;
  }

  private detectConflictingActions(response1: AgentResponse, response2: AgentResponse): boolean {
    // Check for conflicting action recommendations
    const actions1 = this.extractActions(response1);
    const actions2 = this.extractActions(response2);
    
    return actions1.some(action1 => 
      actions2.some(action2 => this.areActionsConflicting(action1, action2))
    );
  }

  private classifyDisagreementType(response1: AgentResponse, response2: AgentResponse): DisagreementType {
    // Classify based on response content and context
    if (this.isParameterDisagreement(response1, response2)) {
      return DisagreementType.PARAMETER_CONFLICT;
    } else if (this.isMethodDisagreement(response1, response2)) {
      return DisagreementType.METHODOLOGY_CONFLICT;
    } else if (this.isPriorityDisagreement(response1, response2)) {
      return DisagreementType.PRIORITY_CONFLICT;
    }
    return DisagreementType.GENERAL_DISAGREEMENT;
  }

  private calculateSeverity(
    similarity: number, 
    hasContradiction: boolean, 
    hasConflictingActions: boolean
  ): ConflictSeverity {
    if (hasContradiction || hasConflictingActions) {
      return ConflictSeverity.CRITICAL;
    } else if (similarity < 0.2) {
      return ConflictSeverity.HIGH;
    } else if (similarity < 0.4) {
      return ConflictSeverity.MEDIUM;
    }
    return ConflictSeverity.LOW;
  }

  /**
   * Outcome creation helpers
   */
  private createNoConflictOutcome(context: ResolutionContext): ResolutionOutcome {
    return {
      id: this.generateOutcomeId(),
      method: ResolutionMethod.NO_CONFLICT,
      resolution: 'No conflicts detected between agent responses',
      confidence: 1.0,
      involvedAgents: context.agentResponses.map(r => r.agentId),
      resolutionTime: 0,
      timestamp: new Date(),
      userSatisfaction: 1.0
    };
  }

  private createConsensusOutcome(vote: ConsensusVote, disagreement: Disagreement): ResolutionOutcome {
    return {
      id: this.generateOutcomeId(),
      method: ResolutionMethod.CONSENSUS,
      resolution: vote.winningResponse.content,
      confidence: vote.consensusStrength,
      involvedAgents: vote.participatingAgents,
      resolutionTime: Date.now() - vote.timestamp.getTime(),
      timestamp: new Date(),
      metadata: { consensusVote: vote }
    };
  }

  private createExpertOutcome(decision: ExpertDecision, disagreement: Disagreement): ResolutionOutcome {
    return {
      id: this.generateOutcomeId(),
      method: ResolutionMethod.EXPERT_ARBITRATION,
      resolution: decision.decision,
      confidence: decision.confidence,
      involvedAgents: disagreement.involvedAgents,
      resolutionTime: Date.now() - decision.timestamp.getTime(),
      timestamp: new Date(),
      metadata: { expertDecision: decision }
    };
  }

  private createFallbackOutcome(disagreement: Disagreement, context: ResolutionContext): ResolutionOutcome {
    return {
      id: this.generateOutcomeId(),
      method: ResolutionMethod.FALLBACK,
      resolution: 'Unable to resolve disagreement automatically. Manual intervention required.',
      confidence: 0.0,
      involvedAgents: disagreement.involvedAgents,
      resolutionTime: this.config.conflictTimeoutMs,
      timestamp: new Date(),
      requiresManualIntervention: true
    };
  }

  /**
   * Utility methods
   */
  private generateDisagreementId(context: ResolutionContext): string {
    return `disagreement_${context.teamId}_${context.sessionId}_${Date.now()}`;
  }

  private generateConflictId(response1: AgentResponse, response2: AgentResponse): string {
    return `conflict_${response1.agentId}_${response2.agentId}_${Date.now()}`;
  }

  private generateOutcomeId(): string {
    return `outcome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePreferenceScore(
    outcome: ResolutionOutcome, 
    preferences: UserPreference[], 
    context: ResolutionContext
  ): number {
    // Implement preference scoring logic
    return preferences.reduce((score, pref) => {
      const alignment = this.calculateOutcomeAlignment(outcome, pref);
      return score + (alignment * pref.weight);
    }, 0);
  }

  private calculateOutcomeAlignment(outcome: ResolutionOutcome, preference: UserPreference): number {
    // Calculate how well the outcome aligns with user preference
    // This would involve semantic analysis and preference matching
    return 0.5; // Placeholder implementation
  }

  // Additional helper methods would be implemented here...
  private classifyConflictSeverity(disagreements: Disagreement[]): Disagreement[] { return disagreements; }
  private extractActions(response: AgentResponse): string[] { return []; }
  private areActionsConflicting(action1: string, action2: string): boolean { return false; }
  private isParameterDisagreement(r1: AgentResponse, r2: AgentResponse): boolean { return false; }
  private isMethodDisagreement(r1: AgentResponse, r2: AgentResponse): boolean { return false; }
  private isPriorityDisagreement(r1: AgentResponse, r2: AgentResponse): boolean { return false; }
  private extractConflictContext(r1: AgentResponse, r2: AgentResponse): any { return {}; }
  private getRequiredCapability(type: DisagreementType): AgentCapability { return 'analysis' as AgentCapability; }
  private isExpertForDisagreement(agent: Agent, disagreement: Disagreement): boolean { return true; }
  private compareExpertise(a: Agent, b: Agent, disagreement: Disagreement): number { return 0; }
  private summarizeContextForExpert(context: ResolutionContext): any {