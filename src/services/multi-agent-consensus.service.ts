import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.utils';
import { weightedVoting } from '../utils/weighted-voting.utils';

/**
 * Represents an agent's proposal or vote in the consensus process
 */
export interface AgentProposal {
  agentId: string;
  proposalId: string;
  solution: any;
  confidenceScore: number; // 0-1
  expertiseDomains: ExpertiseDomain[];
  timestamp: Date;
  reasoning?: string;
  supportingEvidence?: any[];
}

/**
 * Defines expertise domains and proficiency levels
 */
export interface ExpertiseDomain {
  domain: string;
  proficiency: number; // 0-1
  lastUpdated: Date;
}

/**
 * Configuration for consensus decision making
 */
export interface ConsensusConfig {
  consensusThreshold: ConsensusThreshold;
  minParticipants: number;
  maxDecisionTime: number; // milliseconds
  confidenceDecayRate: number; // per hour
  expertiseWeightings: Record<string, number>;
  tieBreakingMethod: 'random' | 'highest_confidence' | 'expertise_weighted' | 'human_escalation';
  enableRealTimeUpdates: boolean;
}

/**
 * Types of consensus thresholds
 */
export type ConsensusThreshold = 'simple_majority' | 'supermajority' | 'unanimous';

/**
 * Represents a weighted vote in the consensus process
 */
export interface WeightedVote {
  agentId: string;
  proposalId: string;
  weight: number;
  adjustedConfidence: number;
  expertiseScore: number;
  vote: 'support' | 'oppose' | 'abstain';
  timestamp: Date;
}

/**
 * Result of a consensus decision
 */
export interface ConsensusResult {
  decisionId: string;
  selectedProposal: AgentProposal | null;
  consensusReached: boolean;
  finalScore: number;
  participantCount: number;
  votingResults: WeightedVote[];
  dissentingOpinions: AgentProposal[];
  decisionMetadata: DecisionMetadata;
  conflictResolution?: ConflictResolution;
}

/**
 * Metadata about the decision process
 */
export interface DecisionMetadata {
  startTime: Date;
  endTime: Date;
  duration: number;
  consensusThreshold: ConsensusThreshold;
  thresholdMet: boolean;
  totalWeight: number;
  averageConfidence: number;
  expertiseCoverage: string[];
}

/**
 * Information about conflict resolution process
 */
export interface ConflictResolution {
  type: 'tie_breaking' | 'insufficient_participation' | 'conflicting_high_confidence' | 'escalation';
  resolution: string;
  resolvedBy: 'algorithm' | 'human';
  additionalInfo?: any;
}

/**
 * Service for facilitating multi-agent consensus decisions
 */
export class MultiAgentConsensusService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  private defaultConfig: ConsensusConfig = {
    consensusThreshold: 'simple_majority',
    minParticipants: 3,
    maxDecisionTime: 5 * 60 * 1000, // 5 minutes
    confidenceDecayRate: 0.1, // 10% decay per hour
    expertiseWeightings: {
      audio_processing: 1.0,
      machine_learning: 0.9,
      ui_design: 0.7,
      data_analysis: 0.8,
      system_architecture: 0.9,
      user_experience: 0.6,
      performance_optimization: 0.8
    },
    tieBreakingMethod: 'expertise_weighted',
    enableRealTimeUpdates: true
  };

  /**
   * Initiates a consensus decision process
   * @param proposals - Array of agent proposals
   * @param config - Consensus configuration
   * @returns Promise resolving to consensus result
   */
  async makeConsensusDecision(
    proposals: AgentProposal[],
    config: Partial<ConsensusConfig> = {}
  ): Promise<ConsensusResult> {
    const fullConfig = { ...this.defaultConfig, ...config };
    const decisionId = this.generateDecisionId();
    const startTime = new Date();

    try {
      logger.info(`Starting consensus decision process: ${decisionId}`, {
        proposalCount: proposals.length,
        config: fullConfig
      });

      // Validate minimum participation
      if (proposals.length < fullConfig.minParticipants) {
        throw new Error(`Insufficient participants: ${proposals.length} < ${fullConfig.minParticipants}`);
      }

      // Calculate weighted votes
      const weightedVotes = await this.calculateWeightedVotes(proposals, fullConfig);

      // Apply consensus algorithm
      const consensusResult = await this.applyConsensusAlgorithm(
        proposals,
        weightedVotes,
        fullConfig,
        decisionId,
        startTime
      );

      // Store decision in database
      await this.storeDecision(consensusResult);

      // Emit real-time updates if enabled
      if (fullConfig.enableRealTimeUpdates) {
        await this.emitConsensusUpdate(consensusResult);
      }

      logger.info(`Consensus decision completed: ${decisionId}`, {
        consensusReached: consensusResult.consensusReached,
        selectedProposal: consensusResult.selectedProposal?.proposalId
      });

      return consensusResult;

    } catch (error) {
      logger.error(`Consensus decision failed: ${decisionId}`, error);
      throw error;
    }
  }

  /**
   * Calculates weighted votes for all proposals
   * @private
   */
  private async calculateWeightedVotes(
    proposals: AgentProposal[],
    config: ConsensusConfig
  ): Promise<WeightedVote[]> {
    const votes: WeightedVote[] = [];

    for (const proposal of proposals) {
      // Calculate expertise score
      const expertiseScore = this.calculateExpertiseScore(
        proposal.expertiseDomains,
        config.expertiseWeightings
      );

      // Apply confidence decay
      const adjustedConfidence = this.applyConfidenceDecay(
        proposal.confidenceScore,
        proposal.timestamp,
        config.confidenceDecayRate
      );

      // Calculate final weight
      const weight = expertiseScore * adjustedConfidence;

      // Create weighted votes for this proposal (agents vote for their own proposals)
      votes.push({
        agentId: proposal.agentId,
        proposalId: proposal.proposalId,
        weight,
        adjustedConfidence,
        expertiseScore,
        vote: 'support',
        timestamp: new Date()
      });

      // Generate comparative votes from other agents
      const comparativeVotes = await this.generateComparativeVotes(
        proposal,
        proposals.filter(p => p.agentId !== proposal.agentId),
        config
      );

      votes.push(...comparativeVotes);
    }

    return votes;
  }

  /**
   * Calculates expertise score based on domain proficiency
   * @private
   */
  private calculateExpertiseScore(
    expertiseDomains: ExpertiseDomain[],
    weightings: Record<string, number>
  ): number {
    if (expertiseDomains.length === 0) return 0.1; // Minimum baseline

    const totalScore = expertiseDomains.reduce((sum, domain) => {
      const weighting = weightings[domain.domain] || 0.5;
      return sum + (domain.proficiency * weighting);
    }, 0);

    return Math.min(totalScore / expertiseDomains.length, 1.0);
  }

  /**
   * Applies confidence decay based on time elapsed
   * @private
   */
  private applyConfidenceDecay(
    originalConfidence: number,
    timestamp: Date,
    decayRate: number
  ): number {
    const hoursElapsed = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    const decayFactor = Math.pow(1 - decayRate, hoursElapsed);
    return Math.max(originalConfidence * decayFactor, 0.1);
  }

  /**
   * Generates comparative votes from other agents
   * @private
   */
  private async generateComparativeVotes(
    targetProposal: AgentProposal,
    otherProposals: AgentProposal[],
    config: ConsensusConfig
  ): Promise<WeightedVote[]> {
    const comparativeVotes: WeightedVote[] = [];

    for (const otherProposal of otherProposals) {
      // Simulate agent comparison logic
      const similarity = await this.calculateProposalSimilarity(targetProposal, otherProposal);
      const vote: 'support' | 'oppose' | 'abstain' = similarity > 0.7 ? 'support' : 
                                                     similarity < 0.3 ? 'oppose' : 'abstain';

      if (vote !== 'abstain') {
        const expertiseScore = this.calculateExpertiseScore(
          otherProposal.expertiseDomains,
          config.expertiseWeightings
        );

        const adjustedConfidence = this.applyConfidenceDecay(
          otherProposal.confidenceScore * similarity,
          otherProposal.timestamp,
          config.confidenceDecayRate
        );

        comparativeVotes.push({
          agentId: otherProposal.agentId,
          proposalId: targetProposal.proposalId,
          weight: expertiseScore * adjustedConfidence * (vote === 'support' ? 1 : -1),
          adjustedConfidence,
          expertiseScore,
          vote,
          timestamp: new Date()
        });
      }
    }

    return comparativeVotes;
  }

  /**
   * Calculates similarity between two proposals
   * @private
   */
  private async calculateProposalSimilarity(
    proposal1: AgentProposal,
    proposal2: AgentProposal
  ): Promise<number> {
    // Simplified similarity calculation
    // In a real implementation, this would use NLP or ML techniques
    
    const domainOverlap = this.calculateDomainOverlap(
      proposal1.expertiseDomains,
      proposal2.expertiseDomains
    );

    const confidenceSimilarity = 1 - Math.abs(proposal1.confidenceScore - proposal2.confidenceScore);
    
    return (domainOverlap + confidenceSimilarity) / 2;
  }

  /**
   * Calculates overlap between expertise domains
   * @private
   */
  private calculateDomainOverlap(
    domains1: ExpertiseDomain[],
    domains2: ExpertiseDomain[]
  ): number {
    const set1 = new Set(domains1.map(d => d.domain));
    const set2 = new Set(domains2.map(d => d.domain));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Applies consensus algorithm to determine final decision
   * @private
   */
  private async applyConsensusAlgorithm(
    proposals: AgentProposal[],
    votes: WeightedVote[],
    config: ConsensusConfig,
    decisionId: string,
    startTime: Date
  ): Promise<ConsensusResult> {
    const endTime = new Date();
    
    // Calculate scores for each proposal
    const proposalScores = this.calculateProposalScores(proposals, votes);
    
    // Apply consensus threshold
    const consensusResult = this.evaluateConsensus(
      proposalScores,
      config.consensusThreshold,
      votes
    );

    // Handle conflicts if consensus not reached
    let conflictResolution: ConflictResolution | undefined;
    let selectedProposal = consensusResult.selectedProposal;

    if (!consensusResult.consensusReached) {
      const resolution = await this.resolveConflict(
        proposalScores,
        votes,
        config
      );
      conflictResolution = resolution;
      selectedProposal = resolution.selectedProposal;
    }

    // Identify dissenting opinions
    const dissentingOpinions = this.identifyDissentingOpinions(
      proposals,
      selectedProposal,
      votes
    );

    return {
      decisionId,
      selectedProposal,
      consensusReached: consensusResult.consensusReached,
      finalScore: consensusResult.finalScore,
      participantCount: proposals.length,
      votingResults: votes,
      dissentingOpinions,
      decisionMetadata: {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        consensusThreshold: config.consensusThreshold,
        thresholdMet: consensusResult.consensusReached,
        totalWeight: votes.reduce((sum, vote) => sum + Math.abs(vote.weight), 0),
        averageConfidence: votes.reduce((sum, vote) => sum + vote.adjustedConfidence, 0) / votes.length,
        expertiseCoverage: [...new Set(proposals.flatMap(p => p.expertiseDomains.map(d => d.domain)))]
      },
      conflictResolution
    };
  }

  /**
   * Calculates scores for each proposal based on weighted votes
   * @private
   */
  private calculateProposalScores(
    proposals: AgentProposal[],
    votes: WeightedVote[]
  ): Map<string, number> {
    const scores = new Map<string, number>();

    for (const proposal of proposals) {
      const proposalVotes = votes.filter(v => v.proposalId === proposal.proposalId);
      const score = weightedVoting.calculateWeightedScore(proposalVotes);
      scores.set(proposal.proposalId, score);
    }

    return scores;
  }

  /**
   * Evaluates whether consensus has been reached
   * @private
   */
  private evaluateConsensus(
    scores: Map<string, number>,
    threshold: ConsensusThreshold,
    votes: WeightedVote[]
  ): { consensusReached: boolean; selectedProposal: AgentProposal | null; finalScore: number } {
    const sortedScores = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    
    if (sortedScores.length === 0) {
      return { consensusReached: false, selectedProposal: null, finalScore: 0 };
    }

    const [topProposalId, topScore] = sortedScores[0];
    const totalWeight = votes.reduce((sum, vote) => sum + Math.abs(vote.weight), 0);
    const scorePercentage = totalWeight > 0 ? topScore / totalWeight : 0;

    let consensusReached = false;
    
    switch (threshold) {
      case 'simple_majority':
        consensusReached = scorePercentage > 0.5;
        break;
      case 'supermajority':
        consensusReached = scorePercentage > 0.67;
        break;
      case 'unanimous':
        consensusReached = scorePercentage >= 0.95; // Allow for small rounding errors
        break;
    }

    return {
      consensusReached,
      selectedProposal: null, // Will be populated by caller
      finalScore: topScore
    };
  }

  /**
   * Resolves conflicts when consensus is not reached
   * @private
   */
  private async resolveConflict(
    scores: Map<string, number>,
    votes: WeightedVote[],
    config: ConsensusConfig
  ): Promise<ConflictResolution & { selectedProposal: AgentProposal | null }> {
    const sortedScores = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    
    // Check for ties
    if (sortedScores.length >= 2 && sortedScores[0][1] === sortedScores[1][1]) {
      return this.handleTieBreaking(sortedScores, votes, config);
    }

    // Check for insufficient participation
    if (votes.length < config.minParticipants) {
      return {
        type: 'insufficient_participation',
        resolution: 'Decision postponed due to insufficient participation',
        resolvedBy: 'algorithm',
        selectedProposal: null
      };
    }

    // Check for conflicting high-confidence votes
    const highConfidenceVotes = votes.filter(v => v.adjustedConfidence > 0.8);
    const conflictingHighConfidence = this.hasConflictingHighConfidenceVotes(highConfidenceVotes);
    
    if (conflictingHighConfidence) {
      return {
        type: 'conflicting_high_confidence',
        resolution: 'Escalated to human oversight due to conflicting high-confidence votes',
        resolvedBy: 'human',
        selectedProposal: null,
        additionalInfo: { highConfidenceVotes: highConfidenceVotes.length }
      };
    }

    // Default to top scoring proposal
    return {
      type: 'escalation',
      resolution: 'Selected top scoring proposal despite lack of consensus',
      resolvedBy: 'algorithm',
      selectedProposal: null // Will be set to top proposal by caller
    };
  }

  /**
   * Handles tie-breaking scenarios
   * @private
   */
  private handleTieBreaking(
    tiedScores: [string, number][],
    votes: WeightedVote[],
    config: ConsensusConfig
  ): ConflictResolution & { selectedProposal: AgentProposal | null } {
    const tiedProposalIds = tiedScores.filter(([, score]) => score === tiedScores[0][1]).map(([id]) => id);

    switch (config.tieBreakingMethod) {
      case 'random':
        const randomId = tiedProposalIds[Math.floor(Math.random() * tiedProposalIds.length)];
        return {
          type: 'tie_breaking',
          resolution: `Random selection from ${tiedProposalIds.length} tied proposals`,
          resolvedBy: 'algorithm',
          selectedProposal: null, // Will be resolved by proposal ID
          additionalInfo: { selectedProposalId: randomId, method: 'random' }
        };

      case 'highest_confidence':
        const highestConfidenceId = this.selectByHighestConfidence(tiedProposalIds, votes);
        return {
          type: 'tie_breaking',
          resolution: 'Selected proposal with highest confidence score',
          resolvedBy: 'algorithm',
          selectedProposal: null,
          additionalInfo: { selectedProposalId: highestConfidenceId, method: 'highest_confidence' }
        };

      case 'expertise_weighted':
        const expertiseWeightedId = this.selectByExpertiseWeight(tiedProposalIds, votes);
        return {
          type: 'tie_breaking',
          resolution: 'Selected proposal with highest expertise weighting',
          resolvedBy: 'algorithm',
          selectedProposal: null,
          additionalInfo: { selectedProposalId: expertiseWeightedId, method: 'expertise_weighted' }
        };

      case 'human_escalation':
      default:
        return {
          type: 'tie_breaking',
          resolution: 'Tie escalated to human decision maker',
          resolvedBy: 'human',
          selectedProposal: null,
          additionalInfo: { tiedProposals: tiedProposalIds.length }
        };
    }
  }

  /**
   * Selects proposal by highest confidence score
   * @private
   */
  private selectByHighestConfidence(proposalIds: string[], votes: WeightedVote[]): string {
    let highestConfidence = 0;
    let selectedId = proposalIds[0];

    for (const proposalId of proposalIds) {
      const proposalVotes = votes.filter(v => v.proposalId === proposalId && v.vote === 'support');
      const maxConfidence = Math.max(...proposalVotes.map(v => v.adjustedConfidence));
      
      if (maxConfidence > highestConfidence) {
        highestConfidence = maxConfidence;
        selectedId = proposalId;
      }
    }

    return selectedId;
  }

  /**
   * Selects proposal by expertise weighting
   * @private
   */
  private selectByExpertiseWeight(proposalIds: string[], votes: WeightedVote[]): string {
    let highestExpertise = 0;
    let selectedId = proposalIds[0];

    for (const proposalId of proposalIds) {
      const proposalVotes = votes.filter(v => v.proposalId === proposalId && v.vote === 'support');
      const maxExpertise = Math.max(...proposalVotes.map(v => v.expertiseScore));
      
      if (maxExpertise > highestExpertise) {
        highestExpertise = maxExpertise;
        selectedId = proposalId;
      }
    }

    return selectedId;
  }

  /**
   * Checks for conflicting high-confidence votes
   * @private
   */
  private hasConflictingHighConfidenceVotes(highConfidenceVotes: WeightedVote[]): boolean {
    const proposalSupport = new Map<string, number>();
    const proposalOppose = new Map<string, number>();

    for (const vote of highConfidenceVotes) {
      if (vote.vote === 'support') {
        proposalSupport.set(vote.proposalId, (proposalSupport.get(vote.proposalId) || 0) + 1);
      } else if (vote.vote === 'oppose') {
        proposalOppose.set(vote.proposalId, (proposalOppose.get(vote.proposalId) || 0) + 1);
      }
    }

    // Check if any proposal has both strong support and opposition
    for (const proposalId of proposalSupport.keys()) {
      const support = proposalSupport.get(proposalId) || 0;
      const oppose = proposalOppose.get(proposalId) || 0;
      
      if (support >= 2 && oppose >= 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identifies dissenting opinions
   * @private
   */
  private identifyDissentingOpinions(
    proposals: AgentProposal[],
    selectedProposal: AgentProposal | null,