/**
 * @fileoverview Intelligent NPC Behavior Engine
 * @description Autonomous NPCs with persistent personalities, goals, and adaptive behavior patterns
 * @version 1.0.0
 * @author CR AudioViz AI Platform
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { WebSocket } from 'ws';

/**
 * NPC personality traits and characteristics
 */
export interface NPCPersonality {
  id: string;
  name: string;
  traits: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  values: {
    [key: string]: number;
  };
  quirks: string[];
  backstory: string;
  speechPatterns: string[];
  preferredTopics: string[];
  dislikes: string[];
}

/**
 * NPC goal structure with priority and context
 */
export interface NPCGoal {
  id: string;
  type: 'survival' | 'social' | 'achievement' | 'exploration' | 'creative';
  description: string;
  priority: number;
  deadline?: Date;
  prerequisites: string[];
  progress: number;
  context: {
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Player interaction record
 */
export interface InteractionRecord {
  id: string;
  playerId: string;
  npcId: string;
  type: 'dialogue' | 'action' | 'gift' | 'trade' | 'combat' | 'help';
  content: string;
  sentiment: number;
  context: {
    location: string;
    timestamp: Date;
    witnesses: string[];
    outcomes: string[];
  };
  playerResponse?: string;
  npcResponse: string;
  emotionalImpact: number;
  memoryStrength: number;
}

/**
 * NPC emotional state
 */
export interface EmotionalState {
  happiness: number;
  anger: number;
  fear: number;
  sadness: number;
  surprise: number;
  trust: number;
  energy: number;
  stress: number;
}

/**
 * Behavior tree node interface
 */
export interface BehaviorNode {
  id: string;
  type: 'sequence' | 'selector' | 'condition' | 'action' | 'decorator';
  name: string;
  children?: BehaviorNode[];
  condition?: (context: any) => boolean;
  action?: (context: any) => Promise<any>;
  decorator?: {
    type: 'repeat' | 'invert' | 'cooldown' | 'probability';
    config: any;
  };
}

/**
 * NPC evolution metrics
 */
export interface EvolutionMetrics {
  totalInteractions: number;
  positiveInteractions: number;
  negativeInteractions: number;
  personalityShift: {
    [trait: string]: number;
  };
  learnedBehaviors: string[];
  forgottenBehaviors: string[];
  relationshipStrengths: {
    [playerId: string]: number;
  };
  evolutionTimeline: {
    timestamp: Date;
    changes: string[];
  }[];
}

/**
 * NPC Analytics data
 */
export interface NPCAnalytics {
  npcId: string;
  interactionFrequency: number;
  averageSentiment: number;
  goalCompletionRate: number;
  personalityStability: number;
  playerRetentionRate: number;
  dialogueEffectiveness: number;
  behaviorAdaptationRate: number;
}

/**
 * Core NPC personality and behavior management
 */
class NPCPersonalityCore extends EventEmitter {
  private personality: NPCPersonality;
  private emotionalState: EmotionalState;
  private baseTraits: NPCPersonality['traits'];

  constructor(personality: NPCPersonality) {
    super();
    this.personality = { ...personality };
    this.baseTraits = { ...personality.traits };
    this.emotionalState = this.initializeEmotionalState();
  }

  /**
   * Initialize emotional state based on personality
   */
  private initializeEmotionalState(): EmotionalState {
    return {
      happiness: 0.5 + (this.personality.traits.extraversion * 0.3),
      anger: 0.2 + (this.personality.traits.neuroticism * 0.3),
      fear: 0.3 + (this.personality.traits.neuroticism * 0.2),
      sadness: 0.2,
      surprise: 0.1,
      trust: 0.6 + (this.personality.traits.agreeableness * 0.4),
      energy: 0.7 + (this.personality.traits.extraversion * 0.3),
      stress: 0.3 + (this.personality.traits.neuroticism * 0.2)
    };
  }

  /**
   * Update personality based on interaction
   */
  public updatePersonality(interaction: InteractionRecord): void {
    const impact = interaction.emotionalImpact * 0.1;
    const traits = this.personality.traits;

    // Adjust traits based on interaction type and sentiment
    if (interaction.sentiment > 0) {
      traits.agreeableness += impact * 0.1;
      traits.extraversion += impact * 0.05;
      this.emotionalState.happiness += impact * 0.2;
      this.emotionalState.trust += impact * 0.15;
    } else {
      traits.neuroticism += impact * 0.1;
      traits.agreeableness -= impact * 0.05;
      this.emotionalState.anger += impact * 0.2;
      this.emotionalState.stress += impact * 0.15;
    }

    // Normalize traits
    this.normalizeTraits();
    this.normalizeEmotionalState();

    this.emit('personalityUpdated', this.personality);
  }

  /**
   * Normalize personality traits to valid ranges
   */
  private normalizeTraits(): void {
    Object.keys(this.personality.traits).forEach(trait => {
      const key = trait as keyof NPCPersonality['traits'];
      this.personality.traits[key] = Math.max(0, Math.min(1, this.personality.traits[key]));
    });
  }

  /**
   * Normalize emotional state values
   */
  private normalizeEmotionalState(): void {
    Object.keys(this.emotionalState).forEach(emotion => {
      const key = emotion as keyof EmotionalState;
      this.emotionalState[key] = Math.max(0, Math.min(1, this.emotionalState[key]));
    });
  }

  /**
   * Get current personality
   */
  public getPersonality(): NPCPersonality {
    return { ...this.personality };
  }

  /**
   * Get current emotional state
   */
  public getEmotionalState(): EmotionalState {
    return { ...this.emotionalState };
  }

  /**
   * Calculate personality compatibility with player
   */
  public calculateCompatibility(playerTraits: Partial<NPCPersonality['traits']>): number {
    let compatibility = 0;
    let count = 0;

    Object.keys(playerTraits).forEach(trait => {
      const key = trait as keyof NPCPersonality['traits'];
      if (this.personality.traits[key] !== undefined) {
        const diff = Math.abs(this.personality.traits[key] - (playerTraits[key] || 0));
        compatibility += 1 - diff;
        count++;
      }
    });

    return count > 0 ? compatibility / count : 0.5;
  }
}

/**
 * Dynamic goal generation and priority management
 */
class GoalManagementSystem extends EventEmitter {
  private goals: Map<string, NPCGoal> = new Map();
  private activeGoals: Set<string> = new Set();
  private goalTemplates: NPCGoal[] = [];

  constructor() {
    super();
    this.initializeGoalTemplates();
  }

  /**
   * Initialize common goal templates
   */
  private initializeGoalTemplates(): void {
    this.goalTemplates = [
      {
        id: 'social_connection',
        type: 'social',
        description: 'Build meaningful relationships with others',
        priority: 0.7,
        prerequisites: [],
        progress: 0,
        context: { requiredInteractions: 5 },
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'skill_improvement',
        type: 'achievement',
        description: 'Improve personal skills and abilities',
        priority: 0.6,
        prerequisites: [],
        progress: 0,
        context: { targetSkill: 'random' },
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'explore_world',
        type: 'exploration',
        description: 'Discover new places and experiences',
        priority: 0.5,
        prerequisites: [],
        progress: 0,
        context: { unexploredAreas: [] },
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Generate goals based on personality and context
   */
  public generateGoals(personality: NPCPersonality, context: any): NPCGoal[] {
    const newGoals: NPCGoal[] = [];

    this.goalTemplates.forEach(template => {
      const personalityBonus = this.calculatePersonalityBonus(template, personality);
      const contextRelevance = this.calculateContextRelevance(template, context);

      if (personalityBonus + contextRelevance > 0.6) {
        const goal: NPCGoal = {
          ...template,
          id: `${template.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          priority: template.priority + personalityBonus + contextRelevance,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        newGoals.push(goal);
        this.goals.set(goal.id, goal);
      }
    });

    return newGoals;
  }

  /**
   * Calculate personality bonus for goal
   */
  private calculatePersonalityBonus(goal: NPCGoal, personality: NPCPersonality): number {
    let bonus = 0;

    switch (goal.type) {
      case 'social':
        bonus += personality.traits.extraversion * 0.3;
        bonus += personality.traits.agreeableness * 0.2;
        break;
      case 'achievement':
        bonus += personality.traits.conscientiousness * 0.4;
        bonus += personality.traits.openness * 0.1;
        break;
      case 'exploration':
        bonus += personality.traits.openness * 0.4;
        bonus += personality.traits.extraversion * 0.1;
        break;
      case 'creative':
        bonus += personality.traits.openness * 0.5;
        break;
      case 'survival':
        bonus += personality.traits.neuroticism * 0.3;
        bonus += personality.traits.conscientiousness * 0.2;
        break;
    }

    return Math.min(0.4, bonus);
  }

  /**
   * Calculate context relevance for goal
   */
  private calculateContextRelevance(goal: NPCGoal, context: any): number {
    let relevance = 0;

    if (context.recentInteractions?.length > 0) {
      relevance += 0.2;
    }

    if (context.currentLocation) {
      relevance += 0.1;
    }

    if (context.timeOfDay === 'day' && goal.type === 'exploration') {
      relevance += 0.1;
    }

    if (context.playerPresence && goal.type === 'social') {
      relevance += 0.2;
    }

    return Math.min(0.3, relevance);
  }

  /**
   * Update goal progress
   */
  public updateGoalProgress(goalId: string, progress: number): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.progress = Math.min(1, Math.max(0, progress));
      goal.updatedAt = new Date();

      if (goal.progress >= 1) {
        this.completeGoal(goalId);
      }

      this.emit('goalUpdated', goal);
    }
  }

  /**
   * Complete a goal
   */
  private completeGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.isActive = false;
      this.activeGoals.delete(goalId);
      this.emit('goalCompleted', goal);
    }
  }

  /**
   * Get active goals sorted by priority
   */
  public getActiveGoals(): NPCGoal[] {
    return Array.from(this.activeGoals)
      .map(id => this.goals.get(id))
      .filter((goal): goal is NPCGoal => goal !== undefined)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Activate goal
   */
  public activateGoal(goalId: string): boolean {
    const goal = this.goals.get(goalId);
    if (goal && !goal.isActive) {
      goal.isActive = true;
      this.activeGoals.add(goalId);
      this.emit('goalActivated', goal);
      return true;
    }
    return false;
  }
}

/**
 * Machine learning behavior adaptation engine
 */
class LearningEngine extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private trainingData: Array<{ input: number[]; output: number[] }> = [];
  private isTraining = false;

  constructor() {
    super();
    this.initializeModel();
  }

  /**
   * Initialize TensorFlow model for behavior learning
   */
  private async initializeModel(): Promise<void> {
    try {
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [20], units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'softmax' })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.emit('modelReady');
    } catch (error) {
      console.error('Failed to initialize learning model:', error);
      this.emit('modelError', error);
    }
  }

  /**
   * Add training data from interaction
   */
  public addTrainingData(interaction: InteractionRecord, personality: NPCPersonality, outcome: string): void {
    const input = this.encodeInteractionFeatures(interaction, personality);
    const output = this.encodeOutcome(outcome);

    this.trainingData.push({ input, output });

    // Limit training data size
    if (this.trainingData.length > 1000) {
      this.trainingData = this.trainingData.slice(-800);
    }

    // Train periodically
    if (this.trainingData.length % 50 === 0) {
      this.trainModel();
    }
  }

  /**
   * Encode interaction features for ML input
   */
  private encodeInteractionFeatures(interaction: InteractionRecord, personality: NPCPersonality): number[] {
    const features: number[] = [];

    // Personality traits
    features.push(...Object.values(personality.traits));

    // Interaction features
    features.push(
      interaction.sentiment,
      interaction.emotionalImpact,
      interaction.memoryStrength,
      this.encodeInteractionType(interaction.type),
      Date.now() - interaction.context.timestamp.getTime()
    );

    // Context features
    features.push(
      interaction.context.witnesses.length,
      interaction.context.outcomes.length
    );

    // Pad or trim to 20 features
    while (features.length < 20) {
      features.push(0);
    }

    return features.slice(0, 20);
  }

  /**
   * Encode interaction type as number
   */
  private encodeInteractionType(type: InteractionRecord['type']): number {
    const typeMap = {
      dialogue: 0.1,
      action: 0.2,
      gift: 0.3,
      trade: 0.4,
      combat: 0.5,
      help: 0.6
    };
    return typeMap[type] || 0;
  }

  /**
   * Encode outcome as one-hot vector
   */
  private encodeOutcome(outcome: string): number[] {
    const outcomes = ['positive', 'negative', 'neutral', 'learning', 'growth', 'conflict', 'bonding', 'achievement'];
    const encoded = new Array(8).fill(0);
    const index = outcomes.indexOf(outcome);
    if (index >= 0) {
      encoded[index] = 1;
    }
    return encoded;
  }

  /**
   * Train the model with accumulated data
   */
  private async trainModel(): Promise<void> {
    if (!this.model || this.isTraining || this.trainingData.length < 10) {
      return;
    }

    this.isTraining = true;

    try {
      const inputs = tf.tensor2d(this.trainingData.map(d => d.input));
      const outputs = tf.tensor2d(this.trainingData.map(d => d.output));

      await this.model.fit(inputs, outputs, {
        epochs: 5,
        batchSize: 16,
        verbose: 0
      });

      inputs.dispose();
      outputs.dispose();

      this.emit('modelTrained', {
        dataPoints: this.trainingData.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Model training error:', error);
      this.emit('trainingError', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Predict best behavior for given context
   */
  public async predictBehavior(interaction: InteractionRecord, personality: NPCPersonality): Promise<string[]> {
    if (!this.model) {
      return ['neutral'];
    }

    try {
      const input = tf.tensor2d([this.encodeInteractionFeatures(interaction, personality)]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const probabilities = await prediction.data();

      input.dispose();
      prediction.dispose();

      const outcomes = ['positive', 'negative', 'neutral', 'learning', 'growth', 'conflict', 'bonding', 'achievement'];
      const sortedIndices = Array.from(probabilities)
        .map((prob, index) => ({ prob, index }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3)
        .map(item => outcomes[item.index]);

      return sortedIndices;
    } catch (error) {
      console.error('Prediction error:', error);
      return ['neutral'];
    }
  }

  /**
   * Get model performance metrics
   */
  public getPerformanceMetrics(): any {
    return {
      trainingDataSize: this.trainingData.length,
      isTraining: this.isTraining,
      modelReady: !!this.model
    };
  }
}

/**
 * Persistent memory system for player interactions
 */
class InteractionMemory extends EventEmitter {
  private memories: Map<string, InteractionRecord[]> = new Map();
  private memoryIndex: Map<string, Set<string>> = new Map();
  private maxMemoriesPerNPC = 500;
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabaseUrl: string, supabaseKey: string, redisUrl: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisUrl);
    this.loadMemoriesFromStorage();
  }

  /**
   * Load memories from persistent storage
   */
  private async loadMemoriesFromStorage(): Promise<void> {
    try {
      const { data: memories, error } = await this.supabase
        .from('npc_memories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      memories?.forEach(memory => {
        this.addMemoryToCache(memory);
      });

      this.emit('memoriesLoaded', memories?.length || 0);
    } catch (error) {
      console.error('Failed to load memories:', error);
      this.emit('memoryError', error);
    }
  }

  /**
   * Add memory to local cache
   */
  private addMemoryToCache(memory: InteractionRecord): void {
    if (!this.memories.has(memory.npcId)) {
      this.memories.set(memory.npcId, []);
      this.memoryIndex.set(memory.npcId, new Set());
    }

    const npcMemories = this.memories.get(memory.npcId)!;
    const npcIndex = this.memoryIndex.get(memory.npcId)!;

    npcMemories.push(memory);
    npcIndex.add(memory.playerId);

    // Limit memory size
    if (npcMemories.length > this.maxMemoriesPerNPC) {
      const removed = npcMemories.shift();
      if (removed) {
        npcIndex.delete(removed.playerId);
      }
    }
  }

  /**
   * Store new interaction memory
   */
  public async storeInteraction(interaction: InteractionRecord): Promise<void> {
    try {
      // Store in database
      const { error } = await this.supabase
        .from('npc_memories')
        .insert([interaction]);

      if (error) throw error;

      // Store in Redis cache
      await this.redis.setex(
        `npc_memory:${interaction.npcId}:${interaction.id}`,
        3600,
        JSON.stringify(interaction)
      );

      // Add to local cache
      this.addMemoryToCache(interaction);

      this.emit('memoryStored', interaction);
    } catch (error) {
      console.error('Failed to store memory:', error);
      this.emit('memoryError', error);
    }
  }

  /**
   * Retrieve memories for NPC
   */
  public