```typescript
/**
 * CRAIverse NPC Behavior Engine
 * 
 * Advanced AI-driven microservice for managing non-player character behaviors
 * with natural interactions, adaptive learning, and emergent storytelling.
 * 
 * Features:
 * - Custom behavior trees and scripting
 * - AI-powered natural language interactions
 * - Adaptive learning from user interactions
 * - Emergent storytelling capabilities
 * - Memory and context management
 * 
 * @module NPCBehaviorEngine
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * NPC Entity configuration
 */
export interface NPCEntity {
  id: string;
  name: string;
  personality: PersonalityTraits;
  appearance: AppearanceConfig;
  backstory: string;
  goals: string[];
  relationships: Record<string, RelationshipData>;
  currentState: NPCState;
  behaviorTreeId: string;
  memoryCapacity: number;
  learningRate: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Personality traits affecting NPC behavior
 */
export interface PersonalityTraits {
  openness: number;        // 0-1
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  creativity: number;
  empathy: number;
  curiosity: number;
}

/**
 * NPC appearance configuration
 */
export interface AppearanceConfig {
  avatar: string;
  style: string;
  animations: Record<string, string>;
  voice: VoiceConfig;
}

/**
 * Voice configuration for NPC
 */
export interface VoiceConfig {
  model: string;
  pitch: number;
  speed: number;
  tone: string;
  accent?: string;
}

/**
 * Relationship data between NPCs or players
 */
export interface RelationshipData {
  type: 'friend' | 'enemy' | 'neutral' | 'romantic' | 'family' | 'professional';
  strength: number; // -1 to 1
  trust: number;    // 0 to 1
  history: InteractionSummary[];
  lastInteraction: Date;
}

/**
 * Current NPC state
 */
export interface NPCState {
  emotion: EmotionalState;
  activity: string;
  location: string;
  health: number;
  energy: number;
  mood: number;
  attention: string[];
  currentGoal?: string;
  isInteracting: boolean;
  lastAction: Date;
}

/**
 * Emotional state representation
 */
export interface EmotionalState {
  valence: number;  // -1 (negative) to 1 (positive)
  arousal: number;  // 0 (calm) to 1 (excited)
  dominance: number; // 0 (submissive) to 1 (dominant)
  primaryEmotion: string;
  intensity: number;
}

/**
 * Behavior tree node types
 */
export type BehaviorNodeType = 
  | 'sequence' | 'selector' | 'parallel' | 'decorator'
  | 'condition' | 'action' | 'wait' | 'random';

/**
 * Behavior tree node
 */
export interface BehaviorNode {
  id: string;
  type: BehaviorNodeType;
  name: string;
  parameters: Record<string, any>;
  children?: BehaviorNode[];
  condition?: string;
  priority?: number;
  cooldown?: number;
  lastExecuted?: Date;
}

/**
 * Complete behavior tree
 */
export interface BehaviorTree {
  id: string;
  name: string;
  description: string;
  root: BehaviorNode;
  variables: Record<string, any>;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interaction context
 */
export interface InteractionContext {
  participantId: string;
  participantType: 'player' | 'npc';
  environment: EnvironmentContext;
  history: InteractionHistory[];
  currentTopic?: string;
  intent?: string;
  sentiment?: SentimentAnalysis;
  urgency?: number;
}

/**
 * Environment context
 */
export interface EnvironmentContext {
  location: string;
  time: Date;
  weather?: string;
  ambiance: string;
  nearbyEntities: string[];
  events: EnvironmentEvent[];
}

/**
 * Environment event
 */
export interface EnvironmentEvent {
  type: string;
  description: string;
  timestamp: Date;
  impact: number;
}

/**
 * Interaction history entry
 */
export interface InteractionHistory {
  id: string;
  timestamp: Date;
  participantId: string;
  message: string;
  response: string;
  emotion: EmotionalState;
  outcome: InteractionOutcome;
  context: Partial<InteractionContext>;
}

/**
 * Interaction outcome
 */
export interface InteractionOutcome {
  success: boolean;
  satisfaction: number;
  relationshipChange: number;
  emotionalImpact: number;
  memoryStrength: number;
  learningValue: number;
}

/**
 * Interaction summary for relationships
 */
export interface InteractionSummary {
  date: Date;
  type: string;
  outcome: 'positive' | 'negative' | 'neutral';
  impact: number;
  summary: string;
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysis {
  polarity: number;    // -1 to 1
  subjectivity: number; // 0 to 1
  emotions: Record<string, number>;
  confidence: number;
}

/**
 * Learning data point
 */
export interface LearningDataPoint {
  id: string;
  npcId: string;
  context: string;
  action: string;
  outcome: number;
  timestamp: Date;
  features: Record<string, number>;
}

/**
 * Story element for emergent storytelling
 */
export interface StoryElement {
  id: string;
  type: 'plot' | 'character' | 'setting' | 'conflict' | 'theme';
  content: string;
  relevance: number;
  connections: string[];
  timestamp: Date;
}

/**
 * Generated story arc
 */
export interface StoryArc {
  id: string;
  title: string;
  description: string;
  participants: string[];
  elements: StoryElement[];
  currentPhase: string;
  progression: number;
  estimatedDuration: number;
  createdAt: Date;
}

/**
 * Custom behavior script
 */
export interface CustomBehaviorScript {
  id: string;
  name: string;
  description: string;
  code: string;
  language: 'javascript' | 'lua' | 'python';
  parameters: Record<string, any>;
  dependencies: string[];
  version: string;
  author: string;
  createdAt: Date;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  npcId: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'emotional';
  content: string;
  importance: number;
  timestamp: Date;
  decay: number;
  associations: string[];
  accessed: number;
  lastAccessed: Date;
}

/**
 * Service configuration
 */
export interface NPCBehaviorEngineConfig {
  supabaseUrl: string;
  supabaseKey: string;
  aiOrchestratorUrl: string;
  maxConcurrentNPCs: number;
  memoryCleanupInterval: number;
  learningUpdateInterval: number;
  behaviorTreeUpdateRate: number;
  interactionTimeout: number;
  debugMode: boolean;
}

/**
 * Service events
 */
export interface NPCBehaviorEngineEvents {
  'npc-spawned': (npc: NPCEntity) => void;
  'npc-despawned': (npcId: string) => void;
  'interaction-started': (npcId: string, context: InteractionContext) => void;
  'interaction-completed': (npcId: string, outcome: InteractionOutcome) => void;
  'behavior-updated': (npcId: string, behaviorId: string) => void;
  'story-generated': (arc: StoryArc) => void;
  'learning-updated': (npcId: string, data: LearningDataPoint) => void;
  'emotion-changed': (npcId: string, emotion: EmotionalState) => void;
  'memory-stored': (npcId: string, memory: MemoryEntry) => void;
  'error': (error: Error) => void;
}

// ============================================================================
// Core Behavior Engine
// ============================================================================

/**
 * Main NPC Behavior Engine service class
 */
export class NPCBehaviorEngine extends EventEmitter {
  private supabase: SupabaseClient;
  private activeNPCs: Map<string, NPCEntity> = new Map();
  private behaviorTrees: Map<string, BehaviorTree> = new Map();
  private interactionModels: Map<string, any> = new Map();
  private memoryStores: Map<string, MemoryEntry[]> = new Map();
  private customScripts: Map<string, CustomBehaviorScript> = new Map();
  private storyArcs: Map<string, StoryArc> = new Map();
  private learningData: Map<string, LearningDataPoint[]> = new Map();
  
  private updateInterval?: NodeJS.Timeout;
  private memoryCleanupInterval?: NodeJS.Timeout;
  private learningUpdateInterval?: NodeJS.Timeout;

  constructor(private config: NPCBehaviorEngineConfig) {
    super();
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.initialize();
  }

  /**
   * Initialize the behavior engine
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadBehaviorTrees();
      await this.loadCustomScripts();
      await this.startUpdateLoop();
      
      this.emit('service-initialized');
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Load behavior trees from database
   */
  private async loadBehaviorTrees(): Promise<void> {
    const { data, error } = await this.supabase
      .from('behavior_trees')
      .select('*')
      .eq('active', true);

    if (error) throw error;

    for (const tree of data || []) {
      this.behaviorTrees.set(tree.id, {
        id: tree.id,
        name: tree.name,
        description: tree.description,
        root: JSON.parse(tree.root_node),
        variables: JSON.parse(tree.variables || '{}'),
        version: tree.version,
        createdAt: new Date(tree.created_at),
        updatedAt: new Date(tree.updated_at)
      });
    }
  }

  /**
   * Load custom behavior scripts
   */
  private async loadCustomScripts(): Promise<void> {
    const { data, error } = await this.supabase
      .from('custom_behavior_scripts')
      .select('*')
      .eq('active', true);

    if (error) throw error;

    for (const script of data || []) {
      this.customScripts.set(script.id, {
        id: script.id,
        name: script.name,
        description: script.description,
        code: script.code,
        language: script.language,
        parameters: JSON.parse(script.parameters || '{}'),
        dependencies: JSON.parse(script.dependencies || '[]'),
        version: script.version,
        author: script.author,
        createdAt: new Date(script.created_at)
      });
    }
  }

  /**
   * Start the main update loop
   */
  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateAllNPCs();
    }, this.config.behaviorTreeUpdateRate);

    this.memoryCleanupInterval = setInterval(() => {
      this.cleanupMemories();
    }, this.config.memoryCleanupInterval);

    this.learningUpdateInterval = setInterval(() => {
      this.updateLearningModels();
    }, this.config.learningUpdateInterval);
  }

  /**
   * Spawn a new NPC
   */
  public async spawnNPC(npcData: Partial<NPCEntity>): Promise<NPCEntity> {
    try {
      if (this.activeNPCs.size >= this.config.maxConcurrentNPCs) {
        throw new Error('Maximum concurrent NPCs reached');
      }

      const npc: NPCEntity = {
        id: npcData.id || this.generateId(),
        name: npcData.name || 'Unnamed NPC',
        personality: npcData.personality || this.generateRandomPersonality(),
        appearance: npcData.appearance || this.getDefaultAppearance(),
        backstory: npcData.backstory || '',
        goals: npcData.goals || [],
        relationships: npcData.relationships || {},
        currentState: npcData.currentState || this.getInitialState(),
        behaviorTreeId: npcData.behaviorTreeId || 'default',
        memoryCapacity: npcData.memoryCapacity || 1000,
        learningRate: npcData.learningRate || 0.1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in database
      const { error } = await this.supabase
        .from('npc_entities')
        .insert({
          id: npc.id,
          name: npc.name,
          personality: JSON.stringify(npc.personality),
          appearance: JSON.stringify(npc.appearance),
          backstory: npc.backstory,
          goals: JSON.stringify(npc.goals),
          relationships: JSON.stringify(npc.relationships),
          current_state: JSON.stringify(npc.currentState),
          behavior_tree_id: npc.behaviorTreeId,
          memory_capacity: npc.memoryCapacity,
          learning_rate: npc.learningRate,
          created_at: npc.createdAt.toISOString(),
          updated_at: npc.updatedAt.toISOString()
        });

      if (error) throw error;

      // Initialize NPC systems
      this.activeNPCs.set(npc.id, npc);
      this.memoryStores.set(npc.id, []);
      this.learningData.set(npc.id, []);

      // Load existing memories
      await this.loadNPCMemories(npc.id);

      this.emit('npc-spawned', npc);
      return npc;

    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Despawn an NPC
   */
  public async despawnNPC(npcId: string): Promise<void> {
    try {
      const npc = this.activeNPCs.get(npcId);
      if (!npc) {
        throw new Error(`NPC ${npcId} not found`);
      }

      // Save final state
      await this.saveNPCState(npcId);

      // Cleanup
      this.activeNPCs.delete(npcId);
      this.memoryStores.delete(npcId);
      this.learningData.delete(npcId);

      this.emit('npc-despawned', npcId);

    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Process interaction with NPC
   */
  public async processInteraction(
    npcId: string,
    message: string,
    context: Partial<InteractionContext>
  ): Promise<string> {
    try {
      const npc = this.activeNPCs.get(npcId);
      if (!npc) {
        throw new Error(`NPC ${npcId} not found`);
      }

      const fullContext: InteractionContext = {
        participantId: context.participantId || 'unknown',
        participantType: context.participantType || 'player',
        environment: context.environment || this.getDefaultEnvironment(),
        history: context.history || await this.getInteractionHistory(npcId),
        currentTopic: context.currentTopic,
        intent: context.intent,
        sentiment: context.sentiment || await this.analyzeSentiment(message),
        urgency: context.urgency || 0.5
      };

      this.emit('interaction-started', npcId, fullContext);

      // Update NPC state
      npc.currentState.isInteracting = true;
      npc.currentState.attention = [fullContext.participantId];

      // Process through AI interaction model
      const response = await this.generateResponse(npc, message, fullContext);

      // Update relationship
      await this.updateRelationship(npc, fullContext.participantId, fullContext);

      // Store interaction in memory
      const memory = await this.storeInteractionMemory(npc, message, response, fullContext);

      // Update emotional state
      await this.updateEmotionalState(npc, fullContext);

      // Generate learning data
      await this.generateLearningData(npc, message, response, fullContext);

      const outcome: InteractionOutcome = {
        success: true,
        satisfaction: 0.8, // TODO: Calculate based on response quality
        relationshipChange: 0.1,
        emotionalImpact: fullContext.sentiment?.polarity || 0,
        memoryStrength: memory.importance,
        learningValue: 0.5
      };

      npc.currentState.isInteracting = false;
      this.emit('interaction-completed', npcId, outcome);

      return response;

    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Update NPC behavior tree execution
   */
  private async updateNPCBehavior(npc: NPCEntity): Promise<void> {
    try {
      const behaviorTree = this.behaviorTrees.get(npc.behaviorTreeId);
      if (!behaviorTree) return;

      const context = {
        npc,
        environment: await this.getCurrentEnvironment(npc.id),
        memories: this.memoryStores.get(npc.id) || [],
        relationships: npc.relationships
      };

      const result = await this.executeBehaviorNode(behaviorTree.root, context);
      
      if (result.action) {
        await this.executeNPCAction(npc, result.action);
      }

    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Execute a behavior tree node
   */
  private async executeBehaviorNode(node: BehaviorNode, context: any): Promise<any> {
    switch (node.type) {
      case 'sequence':
        return this.executeSequenceNode(node, context);
      case 'selector':
        return this.executeSelectorNode(node, context);
      case 'condition':
        return this.executeConditionNode(node, context);
      case 'action':
        return this.executeActionNode(node, context);
      default:
        return { success: false };
    }
  }

  /**
   * Execute sequence behavior node
   */
  private async executeSequenceNode(node: BehaviorNode, context: any): Promise<any> {
    for (const child of node.children || []) {
      const result = await this.executeBehaviorNode(child, context);
      if (!result.success) {
        return { success: false };
      }
    }
    return { success: true };
  }

  /**
   * Execute selector behavior node
   */
  private async executeSelectorNode(node: BehaviorNode, context: any): Promise<any> {
    for (const child of node.children || []) {
      const result = await this.executeBehaviorNode(child, context);
      if (result.success) {
        return result;
      }
    }
    return { success: false };
  }

  /**
   * Execute condition behavior node
   */
  private async executeConditionNode(node: BehaviorNode, context: any): Promise<any> {
    // Evaluate condition script
    const condition = node.condition || 'true';
    try {
      const result = eval(`(${condition})`);
      return { success: Boolean(result) };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Execute action behavior node
   */
  private async executeActionNode(node: BehaviorNode, context: any): Promise<any> {
    return {
      success: true,
      action: {
        type: node.name,
        parameters: node.parameters
      }
    };
  }

  /**
   * Generate AI response for interaction
   */
  private async generateResponse(
    npc: NPCEntity,
    message: string,
    context: InteractionContext
  ): Promise<string> {
    try {
      // Prepare context for AI model
      const aiContext = {
        npc: {
          name: npc.name,
          personality: npc.personality,
          backstory: npc.backstory,
          currentEmotion: npc.currentState.emotion,
          goals: npc.goals
        },
        conversation: {
          message,
          history: context.history.slice(-10), // Last 10 interactions
          topic: context.currentTopic,
          sentiment: context.sentiment
        },
        environment: context.environment,
        relationships: npc.relationships[context.participantId] || {
          type: 'neutral',
          strength: 0,
          trust: 0.5,
          history: []
        }
      };

      // Call AI orchestrator for response generation
      const response = await fetch(`${this.config.aiOrchestratorUrl}/generate-npc-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(aiContext)
      });

      if (!response.ok) {
        throw new Error('AI response generation failed');
      }

      const result = await response.json();
      return result.response || 'I understand.';

    } catch (error) {
      // Fallback response based on personality
      return this.generateFallbackResponse(npc, message, context);
    }
  }

  /**
   * Generate fallback response when AI is unavailable
   */
  private generateFallbackResponse(
    npc: NPCEntity,
    message: string,
    context: InteractionContext
  ): string {
    const personality = npc.personality;
    const sentiment = context.sentiment?.polarity || 0;

    if (sentiment > 0.3) {
      if (personality.extraversion > 0.