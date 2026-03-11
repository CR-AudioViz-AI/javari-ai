import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * Agent identifier and metadata
 */
export interface AIAgent {
  id: string;
  name: string;
  type: 'audio_analyzer' | 'visualization_generator' | 'pattern_detector' | 'quality_assessor';
  authorityLevel: number; // 1-10, higher = more authority
  capabilities: string[];
  isActive: boolean;
  lastActive: Date;
}

/**
 * Represents a disagreement between agents
 */
export interface Conflict {
  id: string;
  timestamp: Date;
  involvedAgents: string[];
  topic: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'analyzing' | 'resolving' | 'resolved' | 'escalated';
  positions: AgentPosition[];
  context?: Record<string, any>;
}

/**
 * Agent's position in a conflict
 */
export interface AgentPosition {
  agentId: string;
  stance: string;
  confidence: number; // 0-1
  reasoning: string;
  supportingData?: Record<string, any>;
  timestamp: Date;
}

/**
 * Consensus algorithm result
 */
export interface ConsensusResult {
  success: boolean;
  decision: string;
  confidence: number;
  votingBreakdown: VotingBreakdown;
  dissenterCount: number;
  reasoning: string;
}

/**
 * Voting breakdown by agent
 */
export interface VotingBreakdown {
  [agentId: string]: {
    vote: string;
    weight: number;
    influence: number;
  };
}

/**
 * Resolution attempt outcome
 */
export interface ResolutionAttempt {
  id: string;
  conflictId: string;
  method: 'weighted_voting' | 'authority_override' | 'compromise_synthesis' | 'human_intervention';
  timestamp: Date;
  success: boolean;
  result?: string;
  participatingAgents: string[];
  duration: number; // milliseconds
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  maxResolutionAttempts: number;
  timeoutMinutes: number;
  criticalSeverityAutoEscalate: boolean;
  humanOverseerIds: string[];
  notificationChannels: string[];
}

/**
 * Service configuration
 */
export interface ConflictResolutionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  websocketPort: number;
  escalationConfig: EscalationConfig;
  consensusThreshold: number; // 0-1
  maxConcurrentConflicts: number;
}

/**
 * Detects disagreements between AI agents
 */
class ConflictDetector {
  private activeMonitoring: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Analyzes agent outputs for potential conflicts
   */
  async detectConflicts(agentOutputs: Map<string, any>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const agents = Array.from(agentOutputs.keys());

    // Compare outputs pairwise
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const agentA = agents[i];
        const agentB = agents[j];
        const outputA = agentOutputs.get(agentA);
        const outputB = agentOutputs.get(agentB);

        const conflict = await this.analyzeDisagreement(agentA, agentB, outputA, outputB);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Analyzes potential disagreement between two agents
   */
  private async analyzeDisagreement(
    agentA: string,
    agentB: string,
    outputA: any,
    outputB: any
  ): Promise<Conflict | null> {
    // Check for direct contradictions
    const contradictions = this.findContradictions(outputA, outputB);
    if (contradictions.length === 0) return null;

    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const severity = this.assessSeverity(contradictions);

    return {
      id: conflictId,
      timestamp: new Date(),
      involvedAgents: [agentA, agentB],
      topic: contradictions[0].topic,
      description: `Disagreement between ${agentA} and ${agentB}: ${contradictions[0].description}`,
      severity,
      status: 'detected',
      positions: [
        {
          agentId: agentA,
          stance: contradictions[0].positionA,
          confidence: outputA.confidence || 0.5,
          reasoning: outputA.reasoning || 'No reasoning provided',
          timestamp: new Date()
        },
        {
          agentId: agentB,
          stance: contradictions[0].positionB,
          confidence: outputB.confidence || 0.5,
          reasoning: outputB.reasoning || 'No reasoning provided',
          timestamp: new Date()
        }
      ],
      context: {
        outputA,
        outputB,
        contradictions
      }
    };
  }

  /**
   * Finds contradictions between two outputs
   */
  private findContradictions(outputA: any, outputB: any): any[] {
    const contradictions = [];

    // Check for opposing boolean values
    for (const key in outputA) {
      if (typeof outputA[key] === 'boolean' && typeof outputB[key] === 'boolean') {
        if (outputA[key] !== outputB[key]) {
          contradictions.push({
            topic: key,
            description: `Boolean contradiction on ${key}`,
            positionA: outputA[key].toString(),
            positionB: outputB[key].toString()
          });
        }
      }
    }

    // Check for significant numerical differences
    for (const key in outputA) {
      if (typeof outputA[key] === 'number' && typeof outputB[key] === 'number') {
        const diff = Math.abs(outputA[key] - outputB[key]);
        const avg = (outputA[key] + outputB[key]) / 2;
        if (avg > 0 && (diff / avg) > 0.3) { // 30% difference threshold
          contradictions.push({
            topic: key,
            description: `Significant numerical difference on ${key}`,
            positionA: outputA[key].toString(),
            positionB: outputB[key].toString()
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * Assesses the severity of contradictions
   */
  private assessSeverity(contradictions: any[]): 'low' | 'medium' | 'high' | 'critical' {
    if (contradictions.length >= 5) return 'critical';
    if (contradictions.length >= 3) return 'high';
    if (contradictions.length >= 2) return 'medium';
    return 'low';
  }
}

/**
 * Implements weighted consensus algorithms
 */
class ConsensusEngine {
  /**
   * Attempts to resolve conflict using weighted voting
   */
  async resolveByWeightedVoting(
    conflict: Conflict,
    agents: Map<string, AIAgent>,
    threshold: number = 0.7
  ): Promise<ConsensusResult> {
    const votingBreakdown: VotingBreakdown = {};
    let totalWeight = 0;
    const positionScores: Map<string, number> = new Map();

    // Calculate weighted votes
    for (const position of conflict.positions) {
      const agent = agents.get(position.agentId);
      if (!agent) continue;

      const weight = this.calculateVotingWeight(agent, position.confidence);
      const influence = weight * position.confidence;

      votingBreakdown[position.agentId] = {
        vote: position.stance,
        weight,
        influence
      };

      totalWeight += weight;
      const currentScore = positionScores.get(position.stance) || 0;
      positionScores.set(position.stance, currentScore + influence);
    }

    // Find winning position
    let winningPosition = '';
    let maxScore = 0;
    let winningConfidence = 0;

    for (const [position, score] of positionScores.entries()) {
      const normalizedScore = score / totalWeight;
      if (normalizedScore > maxScore) {
        maxScore = normalizedScore;
        winningPosition = position;
        winningConfidence = normalizedScore;
      }
    }

    const success = winningConfidence >= threshold;
    const dissenterCount = conflict.positions.filter(p => p.stance !== winningPosition).length;

    return {
      success,
      decision: winningPosition,
      confidence: winningConfidence,
      votingBreakdown,
      dissenterCount,
      reasoning: success 
        ? `Consensus reached with ${(winningConfidence * 100).toFixed(1)}% weighted agreement`
        : `Insufficient consensus: only ${(winningConfidence * 100).toFixed(1)}% agreement (${threshold * 100}% required)`
    };
  }

  /**
   * Calculates voting weight for an agent
   */
  private calculateVotingWeight(agent: AIAgent, confidence: number): number {
    // Base weight from authority level (1-10)
    const authorityWeight = agent.authorityLevel / 10;
    
    // Confidence modifier (0.5 to 1.5 multiplier)
    const confidenceModifier = 0.5 + confidence;
    
    // Activity bonus (recently active agents get slight boost)
    const timeSinceActive = Date.now() - agent.lastActive.getTime();
    const activityBonus = timeSinceActive < 300000 ? 1.1 : 1.0; // 5 minute window
    
    return authorityWeight * confidenceModifier * activityBonus;
  }

  /**
   * Attempts compromise synthesis between positions
   */
  async synthesizeCompromise(conflict: Conflict): Promise<ConsensusResult> {
    // For numerical conflicts, try averaging
    if (this.isNumericalConflict(conflict)) {
      return this.synthesizeNumericalCompromise(conflict);
    }

    // For categorical conflicts, try finding middle ground
    return this.synthesizeCategoricalCompromise(conflict);
  }

  /**
   * Checks if conflict involves numerical values
   */
  private isNumericalConflict(conflict: Conflict): boolean {
    return conflict.positions.some(p => !isNaN(Number(p.stance)));
  }

  /**
   * Synthesizes compromise for numerical conflicts
   */
  private synthesizeNumericalCompromise(conflict: Conflict): ConsensusResult {
    const numericalValues = conflict.positions
      .map(p => ({ value: Number(p.stance), confidence: p.confidence, agentId: p.agentId }))
      .filter(v => !isNaN(v.value));

    if (numericalValues.length === 0) {
      return {
        success: false,
        decision: '',
        confidence: 0,
        votingBreakdown: {},
        dissenterCount: conflict.positions.length,
        reasoning: 'Cannot synthesize numerical compromise: no valid numerical values'
      };
    }

    // Weighted average based on confidence
    let weightedSum = 0;
    let totalWeight = 0;
    const votingBreakdown: VotingBreakdown = {};

    for (const value of numericalValues) {
      const weight = value.confidence;
      weightedSum += value.value * weight;
      totalWeight += weight;
      
      votingBreakdown[value.agentId] = {
        vote: value.value.toString(),
        weight,
        influence: weight
      };
    }

    const compromise = weightedSum / totalWeight;
    const confidence = Math.min(0.8, totalWeight / numericalValues.length); // Cap at 0.8 for compromises

    return {
      success: confidence > 0.5,
      decision: compromise.toString(),
      confidence,
      votingBreakdown,
      dissenterCount: 0, // Compromise includes all positions
      reasoning: `Numerical compromise: weighted average of ${numericalValues.length} positions`
    };
  }

  /**
   * Synthesizes compromise for categorical conflicts
   */
  private synthesizeCategoricalCompromise(conflict: Conflict): ConsensusResult {
    // For now, categorical compromises are harder to synthesize automatically
    return {
      success: false,
      decision: '',
      confidence: 0,
      votingBreakdown: {},
      dissenterCount: conflict.positions.length,
      reasoning: 'Categorical conflicts require human intervention for compromise synthesis'
    };
  }
}

/**
 * Manages escalation to human oversight
 */
class EscalationManager extends EventEmitter {
  constructor(private config: EscalationConfig) {
    super();
  }

  /**
   * Determines if conflict should be escalated
   */
  shouldEscalate(conflict: Conflict, resolutionAttempts: ResolutionAttempt[]): boolean {
    // Auto-escalate critical severity
    if (this.config.criticalSeverityAutoEscalate && conflict.severity === 'critical') {
      return true;
    }

    // Escalate after max attempts
    if (resolutionAttempts.length >= this.config.maxResolutionAttempts) {
      return true;
    }

    // Escalate if timeout exceeded
    const conflictAge = Date.now() - conflict.timestamp.getTime();
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;
    if (conflictAge > timeoutMs) {
      return true;
    }

    return false;
  }

  /**
   * Escalates conflict to human oversight
   */
  async escalateConflict(conflict: Conflict, attempts: ResolutionAttempt[]): Promise<void> {
    const escalationData = {
      conflict,
      attempts,
      timestamp: new Date(),
      reason: this.getEscalationReason(conflict, attempts)
    };

    // Emit escalation event
    this.emit('conflict-escalated', escalationData);

    // Notify human overseers
    await this.notifyHumanOverseers(escalationData);
  }

  /**
   * Gets the reason for escalation
   */
  private getEscalationReason(conflict: Conflict, attempts: ResolutionAttempt[]): string {
    if (conflict.severity === 'critical') {
      return 'Critical severity conflict requires human intervention';
    }
    
    if (attempts.length >= this.config.maxResolutionAttempts) {
      return `Exceeded maximum resolution attempts (${this.config.maxResolutionAttempts})`;
    }

    const conflictAge = Date.now() - conflict.timestamp.getTime();
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;
    if (conflictAge > timeoutMs) {
      return `Resolution timeout exceeded (${this.config.timeoutMinutes} minutes)`;
    }

    return 'Unknown escalation reason';
  }

  /**
   * Notifies human overseers of escalation
   */
  private async notifyHumanOverseers(escalationData: any): Promise<void> {
    // Implementation would depend on notification system
    // This is a placeholder for the actual notification logic
    console.log('Human oversight required for conflict:', escalationData.conflict.id);
  }
}

/**
 * Logs conflict resolution activities for audit trails
 */
class ConflictResolutionLogger {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Logs conflict detection
   */
  async logConflictDetection(conflict: Conflict): Promise<void> {
    await this.supabase
      .from('conflict_logs')
      .insert({
        conflict_id: conflict.id,
        event_type: 'detection',
        timestamp: conflict.timestamp.toISOString(),
        data: conflict,
        severity: conflict.severity
      });
  }

  /**
   * Logs resolution attempt
   */
  async logResolutionAttempt(attempt: ResolutionAttempt): Promise<void> {
    await this.supabase
      .from('resolution_attempts')
      .insert({
        attempt_id: attempt.id,
        conflict_id: attempt.conflictId,
        method: attempt.method,
        timestamp: attempt.timestamp.toISOString(),
        success: attempt.success,
        result: attempt.result,
        duration: attempt.duration,
        participating_agents: attempt.participatingAgents
      });
  }

  /**
   * Logs conflict resolution
   */
  async logConflictResolution(conflictId: string, resolution: string, method: string): Promise<void> {
    await this.supabase
      .from('conflict_logs')
      .insert({
        conflict_id: conflictId,
        event_type: 'resolution',
        timestamp: new Date().toISOString(),
        data: { resolution, method }
      });
  }

  /**
   * Logs escalation
   */
  async logEscalation(conflictId: string, reason: string): Promise<void> {
    await this.supabase
      .from('conflict_logs')
      .insert({
        conflict_id: conflictId,
        event_type: 'escalation',
        timestamp: new Date().toISOString(),
        data: { reason }
      });
  }
}

/**
 * Manages communication between AI agents
 */
class AgentCommunicationBridge {
  private connections: Map<string, WebSocket> = new Map();
  private server: WebSocket.Server;

  constructor(private port: number) {
    this.server = new WebSocket.Server({ port });
    this.setupServer();
  }

  /**
   * Sets up WebSocket server
   */
  private setupServer(): void {
    this.server.on('connection', (ws: WebSocket, request) => {
      const agentId = this.extractAgentId(request);
      if (agentId) {
        this.connections.set(agentId, ws);
        this.setupAgentConnection(agentId, ws);
      }
    });
  }

  /**
   * Sets up individual agent connection
   */
  private setupAgentConnection(agentId: string, ws: WebSocket): void {
    ws.on('close', () => {
      this.connections.delete(agentId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for agent ${agentId}:`, error);
      this.connections.delete(agentId);
    });
  }

  /**
   * Extracts agent ID from connection request
   */
  private extractAgentId(request: any): string | null {
    const url = new URL(request.url, `http://${request.headers.host}`);
    return url.searchParams.get('agentId');
  }

  /**
   * Broadcasts resolution decision to all involved agents
   */
  async broadcastResolution(conflictId: string, agentIds: string[], decision: string): Promise<void> {
    const message = {
      type: 'conflict_resolution',
      conflictId,
      decision,
      timestamp: new Date().toISOString()
    };

    for (const agentId of agentIds) {
      const connection = this.connections.get(agentId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Requests additional input from specific agents
   */
  async requestAgentInput(agentId: string, conflictId: string, question: string): Promise<void> {
    const connection = this.connections.get(agentId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      const message = {
        type: 'input_request',
        conflictId,
        question,
        timestamp: new Date().toISOString()
      };
      connection.send(JSON.stringify(message));
    }
  }
}

/**
 * Main AI Team Conflict Resolution Service
 */
export class AITeamConflictResolutionService {
  private supabase: SupabaseClient;
  private conflictDetector: ConflictDetector;
  private consensusEngine: ConsensusEngine;
  private escalationManager: EscalationManager;
  private logger: ConflictResolutionLogger;
  private communicationBridge: AgentCommunicationBridge;
  
  private activeConflicts: Map<string, Conflict> = new Map();
  private registeredAgents: Map<string, AIAgent> = new Map();
  private resolutionAttempts: Map<string, ResolutionAttempt[]> = new Map();

  constructor(private config: ConflictResolutionConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.conflictDetector = new ConflictDetector();
    this.consensusEngine = new ConsensusEngine();
    this.escalationManager = new EscalationManager(config.escalationConfig);
    this.logger = new ConflictResolutionLogger(this.supabase);
    this.communicationBridge = new AgentCommunicationBridge(config.websocketPort);

    this.setupEventHandlers();
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    this.escalationManager.on('conflict-escalated', async (data) => {
      await this.logger.logEscalation(data.conflict.id, data.reason);
      await this.handleEscalation(data.conflict);
    });
  }

  /**
   * Registers an AI agent in the system
   */
  async registerAgent(agent: AIAgent): Promise<void> {
    this.registeredAgents.set(agent.id, agent);
    
    await this.supabase
      .from('ai_agents')
      .upsert({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        authority_level: agent.authorityLevel,
        capabilities: agent.capabilities,
        is_active: agent.isActive,
        last_active: agent.lastActive.toISOString()
      });
  }

  /**
   * Processes agent outputs and detects conflicts
   */
  async processAgentOutputs(agentOutputs: Map<string, any>): Promise<string[]> {
    try {
      // Detect conflicts
      const conflicts = await this.conflictDetector.detectConflicts(agentOutputs);
      const resolvedConflictIds: string[] = [];

      for (const conflict of conflicts) {
        // Skip if we're at max concurrent conflicts
        if (this.activeConflicts.size >= this.config.maxConcurrentConflicts) {
          console.warn('Max concurrent conflicts reached, queuing conflict:', conflict.id);
          continue;
        }