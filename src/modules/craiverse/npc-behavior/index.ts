import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Redis from 'ioredis';
import * as THREE from 'three';

/**
 * Autonomous NPC Behavior Engine
 * AI-driven NPC behavior system with goal-oriented planning, emotional modeling, and adaptive learning
 */

/**
 * Basic vector3 interface for spatial calculations
 */
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Emotional state representation using VAD model
 */
interface EmotionalState {
  valence: number;    // -1 (negative) to 1 (positive)
  arousal: number;    // -1 (calm) to 1 (excited)
  dominance: number;  // -1 (submissive) to 1 (dominant)
  intensity: number;  // 0 to 1
  timestamp: number;
}

/**
 * Big Five personality traits
 */
interface PersonalityTraits {
  openness: number;        // 0 to 1
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

/**
 * Memory types for hierarchical memory system
 */
enum MemoryType {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic'
}

/**
 * Memory entry structure
 */
interface Memory {
  id: string;
  type: MemoryType;
  content: any;
  importance: number;  // 0 to 1
  timestamp: number;
  decayRate: number;
  associations: string[];
}

/**
 * Goal structure for GOAP system
 */
interface Goal {
  id: string;
  type: string;
  priority: number;
  conditions: Map<string, any>;
  deadline?: number;
  completed: boolean;
}

/**
 * Action for goal planning
 */
interface Action {
  id: string;
  name: string;
  cost: number;
  preconditions: Map<string, any>;
  effects: Map<string, any>;
  duration: number;
}

/**
 * NPC interaction data
 */
interface Interaction {
  playerId: string;
  timestamp: number;
  type: string;
  content: string;
  sentiment: number;  // -1 to 1
  context: any;
}

/**
 * NPC profile structure
 */
interface NPCProfile {
  id: string;
  name: string;
  personality: PersonalityTraits;
  emotionalState: EmotionalState;
  position: Vector3;
  goals: Goal[];
  memories: Memory[];
  relationships: Map<string, number>;
  learningRate: number;
  createdAt: number;
  lastUpdate: number;
}

/**
 * Behavior tree node types
 */
enum NodeType {
  SELECTOR = 'selector',
  SEQUENCE = 'sequence',
  CONDITION = 'condition',
  ACTION = 'action'
}

/**
 * Behavior tree node
 */
interface BehaviorNode {
  id: string;
  type: NodeType;
  children?: BehaviorNode[];
  condition?: (npc: NPCProfile, context: any) => boolean;
  action?: (npc: NPCProfile, context: any) => Promise<boolean>;
  priority?: number;
}

/**
 * Learning experience for reinforcement learning
 */
interface Experience {
  state: any;
  action: string;
  reward: number;
  nextState: any;
  done: boolean;
  timestamp: number;
}

/**
 * Behavior metrics for analytics
 */
interface BehaviorMetrics {
  npcId: string;
  timestamp: number;
  emotionalVariance: number;
  goalCompletionRate: number;
  interactionCount: number;
  learningProgress: number;
  memoryUtilization: number;
}

/**
 * Multi-dimensional emotion system with decay functions
 */
class EmotionalModel {
  private baseState: EmotionalState;
  private emotionHistory: EmotionalState[] = [];
  private readonly maxHistorySize = 100;

  constructor(baseState?: Partial<EmotionalState>) {
    this.baseState = {
      valence: baseState?.valence ?? 0,
      arousal: baseState?.arousal ?? 0,
      dominance: baseState?.dominance ?? 0.2,
      intensity: baseState?.intensity ?? 0.5,
      timestamp: Date.now()
    };
  }

  /**
   * Apply emotional stimulus to the NPC
   */
  applyStimulus(stimulus: Partial<EmotionalState>, duration: number = 1000): void {
    const now = Date.now();
    const newState: EmotionalState = {
      valence: this.clamp(this.baseState.valence + (stimulus.valence ?? 0), -1, 1),
      arousal: this.clamp(this.baseState.arousal + (stimulus.arousal ?? 0), -1, 1),
      dominance: this.clamp(this.baseState.dominance + (stimulus.dominance ?? 0), -1, 1),
      intensity: this.clamp((stimulus.intensity ?? 0.5) * 1.2, 0, 1),
      timestamp: now
    };

    this.emotionHistory.push(newState);
    this.baseState = newState;

    if (this.emotionHistory.length > this.maxHistorySize) {
      this.emotionHistory.shift();
    }
  }

  /**
   * Update emotional state with natural decay
   */
  update(deltaTime: number): void {
    const decayRate = 0.001; // Decay per millisecond
    const decay = Math.min(deltaTime * decayRate, 0.1);

    this.baseState.valence *= (1 - decay);
    this.baseState.arousal *= (1 - decay);
    this.baseState.intensity = Math.max(this.baseState.intensity - decay, 0.1);
    this.baseState.timestamp = Date.now();
  }

  /**
   * Get current emotional state
   */
  getCurrentState(): EmotionalState {
    return { ...this.baseState };
  }

  /**
   * Calculate emotional distance from another state
   */
  getEmotionalDistance(other: EmotionalState): number {
    const vDiff = this.baseState.valence - other.valence;
    const aDiff = this.baseState.arousal - other.arousal;
    const dDiff = this.baseState.dominance - other.dominance;
    
    return Math.sqrt(vDiff * vDiff + aDiff * aDiff + dDiff * dDiff);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

/**
 * Hierarchical memory system with forgetting curves
 */
class MemorySystem {
  private memories = new Map<string, Memory>();
  private readonly maxMemories = 1000;
  private readonly forgettingRate = 0.0001; // Per millisecond

  /**
   * Store a new memory
   */
  store(content: any, type: MemoryType, importance: number): string {
    const id = this.generateId();
    const memory: Memory = {
      id,
      type,
      content,
      importance: this.clamp(importance, 0, 1),
      timestamp: Date.now(),
      decayRate: this.calculateDecayRate(type, importance),
      associations: []
    };

    this.memories.set(id, memory);
    this.maintainMemoryLimit();
    
    return id;
  }

  /**
   * Retrieve memories by type and relevance
   */
  retrieve(query: any, type?: MemoryType, limit: number = 10): Memory[] {
    const now = Date.now();
    const relevantMemories: Array<{ memory: Memory; relevance: number }> = [];

    for (const memory of this.memories.values()) {
      if (type && memory.type !== type) continue;

      // Update memory strength based on forgetting curve
      const timeDelta = now - memory.timestamp;
      const strength = memory.importance * Math.exp(-memory.decayRate * timeDelta);

      if (strength < 0.01) {
        this.memories.delete(memory.id);
        continue;
      }

      const relevance = this.calculateRelevance(memory, query) * strength;
      if (relevance > 0.1) {
        relevantMemories.push({ memory, relevance });
      }
    }

    return relevantMemories
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(item => item.memory);
  }

  /**
   * Associate memories with each other
   */
  associate(memoryId1: string, memoryId2: string): void {
    const memory1 = this.memories.get(memoryId1);
    const memory2 = this.memories.get(memoryId2);

    if (memory1 && memory2) {
      if (!memory1.associations.includes(memoryId2)) {
        memory1.associations.push(memoryId2);
      }
      if (!memory2.associations.includes(memoryId1)) {
        memory2.associations.push(memoryId1);
      }
    }
  }

  /**
   * Get memory count by type
   */
  getMemoryCount(type?: MemoryType): number {
    if (!type) return this.memories.size;
    return Array.from(this.memories.values()).filter(m => m.type === type).length;
  }

  private calculateDecayRate(type: MemoryType, importance: number): number {
    const baseRate = this.forgettingRate;
    const typeMultiplier = type === MemoryType.SEMANTIC ? 0.5 : 
                          type === MemoryType.EPISODIC ? 1.0 : 2.0;
    const importanceMultiplier = 1.0 - importance * 0.8;
    
    return baseRate * typeMultiplier * importanceMultiplier;
  }

  private calculateRelevance(memory: Memory, query: any): number {
    // Simple relevance calculation - in production, use more sophisticated methods
    const contentStr = JSON.stringify(memory.content).toLowerCase();
    const queryStr = JSON.stringify(query).toLowerCase();
    
    let commonWords = 0;
    let totalWords = 0;
    
    const contentWords = contentStr.split(/\W+/).filter(w => w.length > 2);
    const queryWords = queryStr.split(/\W+/).filter(w => w.length > 2);
    
    totalWords = queryWords.length;
    
    for (const word of queryWords) {
      if (contentWords.includes(word)) {
        commonWords++;
      }
    }
    
    return totalWords > 0 ? commonWords / totalWords : 0;
  }

  private maintainMemoryLimit(): void {
    if (this.memories.size <= this.maxMemories) return;

    const memoriesArray = Array.from(this.memories.values());
    memoriesArray.sort((a, b) => {
      const aStrength = a.importance * Math.exp(-a.decayRate * (Date.now() - a.timestamp));
      const bStrength = b.importance * Math.exp(-b.decayRate * (Date.now() - b.timestamp));
      return aStrength - bStrength;
    });

    const toRemove = memoriesArray.slice(0, this.memories.size - this.maxMemories + 100);
    for (const memory of toRemove) {
      this.memories.delete(memory.id);
    }
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

/**
 * Goal-Oriented Action Planning system with A* pathfinding
 */
class GoalPlanningSystem {
  private actions: Action[] = [];
  private planCache = new Map<string, Action[]>();

  /**
   * Register available actions
   */
  registerAction(action: Action): void {
    this.actions.push(action);
  }

  /**
   * Plan sequence of actions to achieve goal
   */
  planGoal(goal: Goal, currentState: Map<string, any>): Action[] {
    const cacheKey = this.getCacheKey(goal, currentState);
    const cached = this.planCache.get(cacheKey);
    
    if (cached) return cached;

    const plan = this.aStar(currentState, goal);
    this.planCache.set(cacheKey, plan);
    
    return plan;
  }

  /**
   * A* pathfinding for action sequences
   */
  private aStar(startState: Map<string, any>, goal: Goal): Action[] {
    interface Node {
      state: Map<string, any>;
      actions: Action[];
      gCost: number;
      hCost: number;
      fCost: number;
    }

    const openSet: Node[] = [];
    const closedSet = new Set<string>();
    
    const startNode: Node = {
      state: new Map(startState),
      actions: [],
      gCost: 0,
      hCost: this.calculateHeuristic(startState, goal),
      fCost: 0
    };
    startNode.fCost = startNode.gCost + startNode.hCost;
    
    openSet.push(startNode);

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.fCost - b.fCost);
      const currentNode = openSet.shift()!;
      
      const stateKey = this.getStateKey(currentNode.state);
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      if (this.isGoalReached(currentNode.state, goal)) {
        return currentNode.actions;
      }

      for (const action of this.getValidActions(currentNode.state)) {
        const newState = this.applyAction(currentNode.state, action);
        const newStateKey = this.getStateKey(newState);
        
        if (closedSet.has(newStateKey)) continue;

        const gCost = currentNode.gCost + action.cost;
        const hCost = this.calculateHeuristic(newState, goal);
        
        const newNode: Node = {
          state: newState,
          actions: [...currentNode.actions, action],
          gCost,
          hCost,
          fCost: gCost + hCost
        };

        // Check if this path to the state is better
        const existingNode = openSet.find(n => this.getStateKey(n.state) === newStateKey);
        if (!existingNode || newNode.gCost < existingNode.gCost) {
          if (existingNode) {
            const index = openSet.indexOf(existingNode);
            openSet.splice(index, 1);
          }
          openSet.push(newNode);
        }
      }
    }

    return []; // No plan found
  }

  private getValidActions(state: Map<string, any>): Action[] {
    return this.actions.filter(action => {
      for (const [key, value] of action.preconditions) {
        if (state.get(key) !== value) return false;
      }
      return true;
    });
  }

  private applyAction(state: Map<string, any>, action: Action): Map<string, any> {
    const newState = new Map(state);
    for (const [key, value] of action.effects) {
      newState.set(key, value);
    }
    return newState;
  }

  private isGoalReached(state: Map<string, any>, goal: Goal): boolean {
    for (const [key, value] of goal.conditions) {
      if (state.get(key) !== value) return false;
    }
    return true;
  }

  private calculateHeuristic(state: Map<string, any>, goal: Goal): number {
    let distance = 0;
    for (const [key, goalValue] of goal.conditions) {
      const currentValue = state.get(key);
      if (currentValue !== goalValue) {
        distance += 1;
      }
    }
    return distance;
  }

  private getStateKey(state: Map<string, any>): string {
    const sorted = Array.from(state.entries()).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(sorted);
  }

  private getCacheKey(goal: Goal, state: Map<string, any>): string {
    return `${goal.id}_${this.getStateKey(state)}`;
  }
}

/**
 * Reinforcement learning engine with experience replay
 */
class LearningEngine {
  private experiences: Experience[] = [];
  private readonly maxExperiences = 10000;
  private qTable = new Map<string, Map<string, number>>();
  private readonly learningRate = 0.1;
  private readonly discountFactor = 0.9;
  private readonly explorationRate = 0.1;

  /**
   * Record learning experience
   */
  recordExperience(experience: Experience): void {
    this.experiences.push(experience);
    
    if (this.experiences.length > this.maxExperiences) {
      this.experiences.shift();
    }
  }

  /**
   * Update Q-table based on experience
   */
  learn(npcId: string): void {
    if (this.experiences.length < 10) return;

    // Sample random batch for experience replay
    const batchSize = Math.min(32, this.experiences.length);
    const batch = this.sampleExperiences(batchSize);

    for (const experience of batch) {
      this.updateQValue(npcId, experience);
    }
  }

  /**
   * Choose action based on current policy
   */
  chooseAction(npcId: string, state: any, availableActions: string[]): string {
    const stateKey = this.getStateKey(state);
    
    // Exploration vs exploitation
    if (Math.random() < this.explorationRate) {
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // Get Q-values for state
    const stateQValues = this.qTable.get(`${npcId}_${stateKey}`) || new Map();
    
    let bestAction = availableActions[0];
    let bestQValue = stateQValues.get(bestAction) || 0;

    for (const action of availableActions) {
      const qValue = stateQValues.get(action) || 0;
      if (qValue > bestQValue) {
        bestQValue = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Get learning progress for analytics
   */
  getLearningProgress(npcId: string): number {
    const npcEntries = Array.from(this.qTable.keys()).filter(key => key.startsWith(npcId));
    return Math.min(npcEntries.length / 100, 1.0);
  }

  private updateQValue(npcId: string, experience: Experience): void {
    const stateKey = `${npcId}_${this.getStateKey(experience.state)}`;
    const nextStateKey = `${npcId}_${this.getStateKey(experience.nextState)}`;

    const stateQValues = this.qTable.get(stateKey) || new Map();
    const nextStateQValues = this.qTable.get(nextStateKey) || new Map();

    const currentQ = stateQValues.get(experience.action) || 0;
    const maxNextQ = Math.max(...Array.from(nextStateQValues.values()), 0);

    const targetQ = experience.reward + (experience.done ? 0 : this.discountFactor * maxNextQ);
    const newQ = currentQ + this.learningRate * (targetQ - currentQ);

    stateQValues.set(experience.action, newQ);
    this.qTable.set(stateKey, stateQValues);
  }

  private sampleExperiences(count: number): Experience[] {
    const sampled: Experience[] = [];
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * this.experiences.length);
      sampled.push(this.experiences[index]);
    }
    return sampled;
  }

  private getStateKey(state: any): string {
    return JSON.stringify(state);
  }
}

/**
 * Player interaction tracking with sentiment analysis
 */
class InteractionTracker {
  private interactions = new Map<string, Interaction[]>();
  private relationships = new Map<string, Map<string, number>>();

  /**
   * Record player interaction
   */
  recordInteraction(npcId: string, interaction: Interaction): void {
    const npcInteractions = this.interactions.get(npcId) || [];
    npcInteractions.push(interaction);
    this.interactions.set(npcId, npcInteractions);

    this.updateRelationship(npcId, interaction);
  }

  /**
   * Get relationship score with player
   */
  getRelationshipScore(npcId: string, playerId: string): number {
    const npcRelationships = this.relationships.get(npcId);
    return npcRelationships?.get(playerId) || 0;
  }

  /**
   * Get interaction history
   */
  getInteractionHistory(npcId: string, playerId?: string, limit: number = 50): Interaction[] {
    const interactions = this.interactions.get(npcId) || [];
    
    const filtered = playerId ? 
      interactions.filter(i => i.playerId === playerId) : 
      interactions;

    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Analyze sentiment of interactions
   */
  analyzeSentiment(text: string): number {
    // Simple sentiment analysis - in production use more sophisticated NLP
    const positiveWords = ['good', 'great', 'awesome', 'nice', 'thanks', 'please', 'help'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'stupid', 'annoying'];
    
    const words = text.toLowerCase().split(/\W+/);
    let score = 0;
    
    for (const word of words) {
      if (positiveWords.includes(word)) score += 0.2;
      if (negativeWords.includes(word)) score -= 0.2;
    }
    
    return Math.max(-1, Math.min(1, score));
  }

  private updateRelationship(npcId: string, interaction: Interaction): void {
    const npcRelationships = this.relationships.get(npcId) || new Map();
    const currentScore = n