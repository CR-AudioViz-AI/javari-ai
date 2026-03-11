```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import OpenAI from 'openai';
import WebSocket from 'ws';

// Types
interface AgentDecision {
  agentId: string;
  agentType: string;
  recommendation: any;
  confidence: number;
  reasoning: string;
  timestamp: Date;
  contextId: string;
  metadata?: Record<string, any>;
}

interface ConflictMetrics {
  conflictId: string;
  decisions: AgentDecision[];
  conflictType: 'recommendation' | 'priority' | 'approach' | 'value';
  severity: 'low' | 'medium' | 'high' | 'critical';
  contextId: string;
  detectedAt: Date;
}

interface ResolutionCandidate {
  candidateId: string;
  resolution: any;
  supportingAgents: string[];
  opposingAgents: string[];
  weightedScore: number;
  confidence: number;
  reasoning: string;
}

interface ScoredResolution {
  resolutionId: string;
  finalRecommendation: any;
  confidenceScore: number;
  consensusLevel: number;
  riskAssessment: string;
  supportingEvidence: string[];
}

interface EscalationRequest {
  escalationId: string;
  conflictId: string;
  severity: string;
  humanRequired: boolean;
  deadline: Date;
  context: Record<string, any>;
}

interface AgentPerformance {
  agentId: string;
  accuracyScore: number;
  consensusAlignment: number;
  conflictResolutionRate: number;
  reputationWeight: number;
  lastUpdated: Date;
}

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class ConflictDetectionEngine {
  async detectConflicts(decisions: AgentDecision[]): Promise<ConflictMetrics[]> {
    const conflicts: ConflictMetrics[] = [];
    const contextGroups = this.groupByContext(decisions);

    for (const [contextId, contextDecisions] of contextGroups.entries()) {
      if (contextDecisions.length < 2) continue;

      const conflictTypes = await this.analyzeConflictTypes(contextDecisions);
      
      for (const conflictType of conflictTypes) {
        const severity = this.calculateSeverity(contextDecisions, conflictType);
        
        conflicts.push({
          conflictId: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          decisions: contextDecisions,
          conflictType,
          severity,
          contextId,
          detectedAt: new Date()
        });
      }
    }

    return conflicts;
  }

  private groupByContext(decisions: AgentDecision[]): Map<string, AgentDecision[]> {
    return decisions.reduce((groups, decision) => {
      const key = decision.contextId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(decision);
      return groups;
    }, new Map<string, AgentDecision[]>());
  }

  private async analyzeConflictTypes(decisions: AgentDecision[]): Promise<ConflictMetrics['conflictType'][]> {
    const recommendations = decisions.map(d => d.recommendation);
    const types: ConflictMetrics['conflictType'][] = [];

    // Check for recommendation conflicts
    if (this.hasRecommendationConflict(recommendations)) {
      types.push('recommendation');
    }

    // Check for priority conflicts
    if (this.hasPriorityConflict(decisions)) {
      types.push('priority');
    }

    // Check for approach conflicts
    if (this.hasApproachConflict(decisions)) {
      types.push('approach');
    }

    // Check for value conflicts
    if (this.hasValueConflict(decisions)) {
      types.push('value');
    }

    return types;
  }

  private hasRecommendationConflict(recommendations: any[]): boolean {
    return new Set(recommendations.map(r => JSON.stringify(r))).size > 1;
  }

  private hasPriorityConflict(decisions: AgentDecision[]): boolean {
    const priorities = decisions
      .map(d => d.metadata?.priority)
      .filter(p => p !== undefined);
    return new Set(priorities).size > 1 && priorities.length > 1;
  }

  private hasApproachConflict(decisions: AgentDecision[]): boolean {
    const approaches = decisions
      .map(d => d.metadata?.approach)
      .filter(a => a !== undefined);
    return new Set(approaches).size > 1 && approaches.length > 1;
  }

  private hasValueConflict(decisions: AgentDecision[]): boolean {
    const confidenceVariance = this.calculateVariance(
      decisions.map(d => d.confidence)
    );
    return confidenceVariance > 0.3; // High variance indicates value conflict
  }

  private calculateSeverity(
    decisions: AgentDecision[],
    conflictType: ConflictMetrics['conflictType']
  ): ConflictMetrics['severity'] {
    const confidenceSpread = Math.max(...decisions.map(d => d.confidence)) - 
                           Math.min(...decisions.map(d => d.confidence));
    const agentCount = decisions.length;
    
    if (confidenceSpread > 0.7 || agentCount > 5) return 'critical';
    if (confidenceSpread > 0.5 || agentCount > 3) return 'high';
    if (confidenceSpread > 0.3 || agentCount > 2) return 'medium';
    return 'low';
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }
}

class WeightedVotingSystem {
  async generateResolutionCandidates(
    conflict: ConflictMetrics,
    agentWeights: Map<string, number>
  ): Promise<ResolutionCandidate[]> {
    const candidates: ResolutionCandidate[] = [];
    const decisionGroups = this.groupSimilarDecisions(conflict.decisions);

    for (const [recommendation, decisions] of decisionGroups.entries()) {
      const supportingAgents = decisions.map(d => d.agentId);
      const opposingAgents = conflict.decisions
        .filter(d => !supportingAgents.includes(d.agentId))
        .map(d => d.agentId);

      const weightedScore = this.calculateWeightedScore(decisions, agentWeights);
      const confidence = this.calculateGroupConfidence(decisions);

      candidates.push({
        candidateId: `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resolution: recommendation,
        supportingAgents,
        opposingAgents,
        weightedScore,
        confidence,
        reasoning: this.generateReasoningText(decisions)
      });
    }

    return candidates.sort((a, b) => b.weightedScore - a.weightedScore);
  }

  private groupSimilarDecisions(decisions: AgentDecision[]): Map<any, AgentDecision[]> {
    const groups = new Map();
    
    for (const decision of decisions) {
      const key = JSON.stringify(decision.recommendation);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(decision);
    }

    return groups;
  }

  private calculateWeightedScore(decisions: AgentDecision[], weights: Map<string, number>): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const decision of decisions) {
      const weight = weights.get(decision.agentId) || 1.0;
      totalScore += decision.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private calculateGroupConfidence(decisions: AgentDecision[]): number {
    const confidences = decisions.map(d => d.confidence);
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - mean, 2), 0) / confidences.length;
    
    // Lower variance = higher group confidence
    return Math.max(0, 1 - variance);
  }

  private generateReasoningText(decisions: AgentDecision[]): string {
    const reasonings = decisions.map(d => d.reasoning).filter(r => r);
    return reasonings.length > 0 ? reasonings.join('; ') : 'No reasoning provided';
  }
}

class ConfidenceScorer {
  async scoreResolution(candidate: ResolutionCandidate, historicalData?: any[]): Promise<ScoredResolution> {
    const confidenceScore = await this.calculateConfidenceScore(candidate, historicalData);
    const consensusLevel = this.calculateConsensusLevel(candidate);
    const riskAssessment = await this.assessRisk(candidate);
    const supportingEvidence = await this.gatherSupportingEvidence(candidate);

    return {
      resolutionId: `resolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      finalRecommendation: candidate.resolution,
      confidenceScore,
      consensusLevel,
      riskAssessment,
      supportingEvidence
    };
  }

  private async calculateConfidenceScore(
    candidate: ResolutionCandidate,
    historicalData?: any[]
  ): Promise<number> {
    let baseScore = candidate.confidence * candidate.weightedScore;
    
    // Adjust based on historical performance
    if (historicalData && historicalData.length > 0) {
      const historicalAccuracy = historicalData
        .filter(h => h.resolution === candidate.resolution)
        .reduce((sum, h) => sum + h.accuracy, 0) / historicalData.length;
      
      baseScore = (baseScore + historicalAccuracy) / 2;
    }

    // Penalize if too few supporting agents
    if (candidate.supportingAgents.length < 2) {
      baseScore *= 0.8;
    }

    return Math.min(Math.max(baseScore, 0), 1);
  }

  private calculateConsensusLevel(candidate: ResolutionCandidate): number {
    const totalAgents = candidate.supportingAgents.length + candidate.opposingAgents.length;
    return totalAgents > 0 ? candidate.supportingAgents.length / totalAgents : 0;
  }

  private async assessRisk(candidate: ResolutionCandidate): Promise<string> {
    const consensusLevel = this.calculateConsensusLevel(candidate);
    const confidenceLevel = candidate.confidence;

    if (consensusLevel >= 0.8 && confidenceLevel >= 0.8) return 'low';
    if (consensusLevel >= 0.6 && confidenceLevel >= 0.6) return 'medium';
    if (consensusLevel >= 0.4 || confidenceLevel >= 0.4) return 'high';
    return 'critical';
  }

  private async gatherSupportingEvidence(candidate: ResolutionCandidate): Promise<string[]> {
    const evidence: string[] = [];
    
    evidence.push(`${candidate.supportingAgents.length} agents support this resolution`);
    evidence.push(`Weighted confidence score: ${candidate.weightedScore.toFixed(3)}`);
    evidence.push(`Consensus level: ${this.calculateConsensusLevel(candidate).toFixed(3)}`);
    
    if (candidate.reasoning) {
      evidence.push(`Agent reasoning: ${candidate.reasoning}`);
    }

    return evidence;
  }
}

class EscalationManager {
  async processResolution(
    scoredResolution: ScoredResolution,
    conflict: ConflictMetrics
  ): Promise<{ decision?: any; escalation?: EscalationRequest }> {
    const shouldEscalate = this.shouldEscalate(scoredResolution, conflict);

    if (shouldEscalate) {
      const escalation = await this.createEscalationRequest(scoredResolution, conflict);
      await this.notifyHumans(escalation);
      return { escalation };
    }

    return { decision: scoredResolution.finalRecommendation };
  }

  private shouldEscalate(resolution: ScoredResolution, conflict: ConflictMetrics): boolean {
    // Escalate if confidence is too low
    if (resolution.confidenceScore < 0.6) return true;
    
    // Escalate if consensus is too low
    if (resolution.consensusLevel < 0.5) return true;
    
    // Escalate if risk is critical
    if (resolution.riskAssessment === 'critical') return true;
    
    // Escalate if conflict severity is high or critical
    if (['high', 'critical'].includes(conflict.severity)) return true;

    return false;
  }

  private async createEscalationRequest(
    resolution: ScoredResolution,
    conflict: ConflictMetrics
  ): Promise<EscalationRequest> {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + this.getDeadlineHours(conflict.severity));

    return {
      escalationId: `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conflictId: conflict.conflictId,
      severity: conflict.severity,
      humanRequired: true,
      deadline,
      context: {
        conflictType: conflict.conflictType,
        agentCount: conflict.decisions.length,
        confidenceScore: resolution.confidenceScore,
        consensusLevel: resolution.consensusLevel,
        riskAssessment: resolution.riskAssessment
      }
    };
  }

  private getDeadlineHours(severity: ConflictMetrics['severity']): number {
    switch (severity) {
      case 'critical': return 1;
      case 'high': return 4;
      case 'medium': return 12;
      case 'low': return 24;
      default: return 24;
    }
  }

  private async notifyHumans(escalation: EscalationRequest): Promise<void> {
    try {
      // Store escalation request
      await redis.setex(
        `escalation:${escalation.escalationId}`,
        60 * 60 * 24, // 24 hours
        JSON.stringify(escalation)
      );

      // Notification logic would go here (Slack, email, etc.)
      console.log(`Escalation created: ${escalation.escalationId}`);
    } catch (error) {
      console.error('Failed to notify humans:', error);
    }
  }
}

class AgentReputationTracker {
  async updateAgentPerformance(
    agentId: string,
    conflictOutcome: 'resolved' | 'escalated',
    wasCorrect?: boolean
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    let performance: AgentPerformance;

    if (existing) {
      performance = {
        agentId,
        accuracyScore: this.updateAccuracy(existing.accuracy_score, wasCorrect),
        consensusAlignment: this.updateConsensus(existing.consensus_alignment, conflictOutcome),
        conflictResolutionRate: this.updateResolutionRate(existing.conflict_resolution_rate, conflictOutcome),
        reputationWeight: 0, // Will be calculated
        lastUpdated: new Date()
      };
    } else {
      performance = {
        agentId,
        accuracyScore: wasCorrect ? 1.0 : 0.5,
        consensusAlignment: conflictOutcome === 'resolved' ? 1.0 : 0.5,
        conflictResolutionRate: conflictOutcome === 'resolved' ? 1.0 : 0.0,
        reputationWeight: 0, // Will be calculated
        lastUpdated: new Date()
      };
    }

    performance.reputationWeight = this.calculateReputationWeight(performance);

    await supabase
      .from('agent_performance_metrics')
      .upsert({
        agent_id: performance.agentId,
        accuracy_score: performance.accuracyScore,
        consensus_alignment: performance.consensusAlignment,
        conflict_resolution_rate: performance.conflictResolutionRate,
        reputation_weight: performance.reputationWeight,
        last_updated: performance.lastUpdated.toISOString()
      });
  }

  async getAgentWeights(): Promise<Map<string, number>> {
    const { data: metrics } = await supabase
      .from('agent_performance_metrics')
      .select('agent_id, reputation_weight');

    const weights = new Map<string, number>();
    
    if (metrics) {
      for (const metric of metrics) {
        weights.set(metric.agent_id, metric.reputation_weight || 1.0);
      }
    }

    return weights;
  }

  private updateAccuracy(current: number, wasCorrect?: boolean): number {
    if (wasCorrect === undefined) return current;
    return (current * 0.9) + (wasCorrect ? 0.1 : 0.0);
  }

  private updateConsensus(current: number, outcome: 'resolved' | 'escalated'): number {
    const adjustment = outcome === 'resolved' ? 0.05 : -0.05;
    return Math.max(0, Math.min(1, current + adjustment));
  }

  private updateResolutionRate(current: number, outcome: 'resolved' | 'escalated'): number {
    const adjustment = outcome === 'resolved' ? 0.05 : -0.02;
    return Math.max(0, Math.min(1, current + adjustment));
  }

  private calculateReputationWeight(performance: AgentPerformance): number {
    return (
      performance.accuracyScore * 0.4 +
      performance.consensusAlignment * 0.3 +
      performance.conflictResolutionRate * 0.3
    );
  }
}

class ResolutionLogger {
  async logResolution(
    conflict: ConflictMetrics,
    resolution: ScoredResolution,
    outcome: 'auto_resolved' | 'escalated'
  ): Promise<void> {
    await supabase
      .from('conflict_resolutions')
      .insert({
        conflict_id: conflict.conflictId,
        context_id: conflict.contextId,
        conflict_type: conflict.conflictType,
        severity: conflict.severity,
        agent_decisions: conflict.decisions,
        final_recommendation: resolution.finalRecommendation,
        confidence_score: resolution.confidenceScore,
        consensus_level: resolution.consensusLevel,
        risk_assessment: resolution.riskAssessment,
        supporting_evidence: resolution.supportingEvidence,
        outcome,
        resolved_at: new Date().toISOString()
      });
  }
}

// Main service orchestrator
class ConflictResolutionService {
  private conflictDetector = new ConflictDetectionEngine();
  private votingSystem = new WeightedVotingSystem();
  private confidenceScorer = new ConfidenceScorer();
  private escalationManager = new EscalationManager();
  private reputationTracker = new AgentReputationTracker();
  private logger = new ResolutionLogger();

  async resolveConflicts(decisions: AgentDecision[]): Promise<any> {
    try {
      // Step 1: Detect conflicts
      const conflicts = await this.conflictDetector.detectConflicts(decisions);
      
      if (conflicts.length === 0) {
        return { message: 'No conflicts detected', decisions };
      }

      const results = [];

      // Step 2: Process each conflict
      for (const conflict of conflicts) {
        // Get agent weights
        const agentWeights = await this.reputationTracker.getAgentWeights();
        
        // Generate resolution candidates
        const candidates = await this.votingSystem.generateResolutionCandidates(
          conflict, 
          agentWeights
        );

        if (candidates.length === 0) continue;

        // Score the best candidate
        const bestCandidate = candidates[0];
        const scoredResolution = await this.confidenceScorer.scoreResolution(bestCandidate);

        // Process through escalation manager
        const result = await this.escalationManager.processResolution(
          scoredResolution,
          conflict
        );

        // Log the resolution
        const outcome = result.escalation ? 'escalated' : 'auto_resolved';
        await this.logger.logResolution(conflict, scoredResolution, outcome);

        // Update agent performance
        for (const decision of conflict.decisions) {
          await this.reputationTracker.updateAgentPerformance(
            decision.agentId,
            outcome,
            result.decision ? true : undefined
          );
        }

        results.push({
          conflictId: conflict.conflictId,
          outcome,
          resolution: result.decision,
          escalation: result.escalation,
          confidence: scoredResolution.confidenceScore
        });
      }

      return {
        totalConflicts: conflicts.length,
        resolutions: results
      };

    } catch (error) {
      console.error('Conflict resolution error:', error);
      throw error;
    }
  }
}

// API Routes
export async function POST(request: NextRequest) {
  try {
    const { decisions } = await request.json();

    if (!Array.isArray(decisions)) {
      return NextResponse.json(
        { error: 'Invalid input: decisions must be an array' },
        { status: 400 }
      );
    }

    const service = new ConflictResolutionService();
    const result = await service.resolveConflicts(decisions);

    return NextResponse.json(result);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toI