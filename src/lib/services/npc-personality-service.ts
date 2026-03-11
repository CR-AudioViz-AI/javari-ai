```typescript
/**
 * @fileoverview Autonomous NPC Personality Service
 * Generates, maintains, and evolves NPC personalities with memory, emotions, and adaptive behaviors
 * @version 1.0.0
 * @author CR AudioViz AI
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import OpenAI from 'openai';
import { EventEmitter } from 'events';

/**
 * Core personality trait configuration
 */
export interface PersonalityTraits {
  openness: number;           // 0-100
  conscientiousness: number;  // 0-100
  extraversion: number;      // 0-100
  agreeableness: number;     // 0-100
  neuroticism: number;       // 0-100
  creativity: number;        // 0-100
  empathy: number;          // 0-100
  ambition: number;         // 0-100
}

/**
 * Dynamic emotional state representation
 */
export interface EmotionalState {
  primary: EmotionType;
  secondary?: EmotionType;
  intensity: number;        // 0-100
  stability: number;        // 0-100
  timestamp: Date;
  triggers: string[];
}

/**
 * Available emotion types
 */
export enum EmotionType {
  JOY = 'joy',
  SADNESS = 'sadness',
  ANGER = 'anger',
  FEAR = 'fear',
  SURPRISE = 'surprise',
  DISGUST = 'disgust',
  TRUST = 'trust',
  ANTICIPATION = 'anticipation',
  NEUTRAL = 'neutral'
}

/**
 * NPC memory entry
 */
export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;       // 0-100
  emotionalImpact: number; // -100 to 100
  timestamp: Date;
  associatedEntities: string[];
  tags: string[];
}

/**
 * Memory classification types
 */
export enum MemoryType {
  INTERACTION = 'interaction',
  WORLD_EVENT = 'world_event',
  PERSONAL_EXPERIENCE = 'personal_experience',
  RELATIONSHIP = 'relationship',
  LEARNING = 'learning',
  TRAUMA = 'trauma',
  ACHIEVEMENT = 'achievement'
}

/**
 * Behavioral adaptation parameters
 */
export interface BehaviorPattern {
  id: string;
  name: string;
  conditions: BehaviorCondition[];
  actions: BehaviorAction[];
  priority: number;
  adaptationRate: number;  // How quickly this behavior evolves
  effectiveness: number;   // Success rate of this behavior
}

/**
 * Behavior trigger conditions
 */
export interface BehaviorCondition {
  type: 'emotion' | 'memory' | 'relationship' | 'world_state' | 'time';
  target: string;
  operator: '>' | '<' | '=' | '!=' | 'contains' | 'exists';
  value: any;
}

/**
 * Behavior response actions
 */
export interface BehaviorAction {
  type: 'dialogue' | 'emotion_change' | 'memory_create' | 'relationship_modify' | 'world_interact';
  parameters: Record<string, any>;
  weight: number;
}

/**
 * Player interaction data
 */
export interface PlayerInteraction {
  playerId: string;
  npcId: string;
  type: InteractionType;
  content: string;
  context: Record<string, any>;
  emotionalTone: number;    // -100 to 100
  timestamp: Date;
}

/**
 * Interaction classification
 */
export enum InteractionType {
  DIALOGUE = 'dialogue',
  TRADE = 'trade',
  COMBAT = 'combat',
  HELP_REQUEST = 'help_request',
  GIFT = 'gift',
  THREAT = 'threat',
  COMPLIMENT = 'compliment',
  INSULT = 'insult'
}

/**
 * NPC relationship tracking
 */
export interface Relationship {
  entityId: string;
  entityType: 'player' | 'npc' | 'faction';
  trust: number;           // -100 to 100
  respect: number;         // -100 to 100
  affection: number;       // -100 to 100
  fear: number;           // 0 to 100
  history: RelationshipEvent[];
  lastInteraction: Date;
}

/**
 * Relationship event tracking
 */
export interface RelationshipEvent {
  type: InteractionType;
  impact: Record<string, number>;
  description: string;
  timestamp: Date;
}

/**
 * World event data
 */
export interface WorldEvent {
  id: string;
  type: string;
  description: string;
  location?: string;
  participants: string[];
  impact: Record<string, number>;
  timestamp: Date;
}

/**
 * NPC personality profile
 */
export interface NPCPersonality {
  id: string;
  name: string;
  traits: PersonalityTraits;
  currentEmotion: EmotionalState;
  memories: MemoryEntry[];
  relationships: Map<string, Relationship>;
  behaviors: BehaviorPattern[];
  backstory: string;
  goals: string[];
  fears: string[];
  values: string[];
  speechPatterns: Record<string, any>;
  createdAt: Date;
  lastEvolution: Date;
  version: number;
}

/**
 * Dialogue generation context
 */
export interface DialogueContext {
  npcId: string;
  playerId: string;
  situation: string;
  recentMemories: MemoryEntry[];
  currentEmotion: EmotionalState;
  relationship: Relationship;
  worldContext: Record<string, any>;
}

/**
 * Service configuration options
 */
export interface NPCPersonalityServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  openaiApiKey: string;
  evolutionInterval: number;    // Minutes between personality evolution checks
  memoryRetentionDays: number;  // Days to keep detailed memories
  emotionalDecayRate: number;   // Rate at which emotions return to baseline
}

/**
 * Service error types
 */
export enum NPCPersonalityError {
  NPC_NOT_FOUND = 'NPC_NOT_FOUND',
  INVALID_PERSONALITY_DATA = 'INVALID_PERSONALITY_DATA',
  MEMORY_STORAGE_FAILED = 'MEMORY_STORAGE_FAILED',
  EMOTION_UPDATE_FAILED = 'EMOTION_UPDATE_FAILED',
  BEHAVIOR_ADAPTATION_FAILED = 'BEHAVIOR_ADAPTATION_FAILED',
  DIALOGUE_GENERATION_FAILED = 'DIALOGUE_GENERATION_FAILED',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  CACHE_OPERATION_FAILED = 'CACHE_OPERATION_FAILED'
}

/**
 * Custom service error class
 */
export class NPCPersonalityServiceError extends Error {
  constructor(
    public code: NPCPersonalityError,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'NPCPersonalityServiceError';
  }
}

/**
 * Autonomous NPC Personality Service
 * 
 * Comprehensive service for managing dynamic NPC personalities with:
 * - Adaptive personality traits and emotional states
 * - Persistent memory and relationship tracking
 * - Behavioral evolution based on interactions
 * - Contextual dialogue generation
 * - Real-time emotion processing
 */
export class NPCPersonalityService extends EventEmitter {
  private supabase: SupabaseClient;
  private redis: Redis;
  private openai: OpenAI;
  private personalities: Map<string, NPCPersonality>;
  private evolutionTimer?: NodeJS.Timeout;
  private emotionDecayTimer?: NodeJS.Timeout;

  constructor(private config: NPCPersonalityServiceConfig) {
    super();
    this.personalities = new Map();
    this.initializeConnections();
    this.startEvolutionCycle();
    this.startEmotionDecay();
  }

  /**
   * Initialize database and cache connections
   */
  private initializeConnections(): void {
    try {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
      this.redis = new Redis(this.config.redisUrl);
      this.openai = new OpenAI({
        apiKey: this.config.openaiApiKey
      });

      // Set up error handlers
      this.redis.on('error', (error) => {
        this.emit('error', new NPCPersonalityServiceError(
          NPCPersonalityError.CACHE_OPERATION_FAILED,
          'Redis connection error',
          { error: error.message }
        ));
      });

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.DATABASE_CONNECTION_FAILED,
        'Failed to initialize service connections',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate a new NPC personality with randomized traits and backstory
   * 
   * @param npcId - Unique identifier for the NPC
   * @param baseTraits - Optional base personality traits
   * @param contextPrompt - Optional context for personality generation
   * @returns Promise<NPCPersonality>
   */
  async generatePersonality(
    npcId: string,
    baseTraits?: Partial<PersonalityTraits>,
    contextPrompt?: string
  ): Promise<NPCPersonality> {
    try {
      // Generate personality traits
      const traits = this.generatePersonalityTraits(baseTraits);
      
      // Generate backstory and characteristics using AI
      const personalityData = await this.generatePersonalityData(traits, contextPrompt);
      
      // Create initial emotional state
      const initialEmotion: EmotionalState = {
        primary: EmotionType.NEUTRAL,
        intensity: 50,
        stability: 70,
        timestamp: new Date(),
        triggers: []
      };

      // Create personality profile
      const personality: NPCPersonality = {
        id: npcId,
        name: personalityData.name,
        traits,
        currentEmotion: initialEmotion,
        memories: [],
        relationships: new Map(),
        behaviors: this.generateDefaultBehaviors(traits),
        backstory: personalityData.backstory,
        goals: personalityData.goals,
        fears: personalityData.fears,
        values: personalityData.values,
        speechPatterns: personalityData.speechPatterns,
        createdAt: new Date(),
        lastEvolution: new Date(),
        version: 1
      };

      // Store in database and cache
      await this.persistPersonality(personality);
      this.personalities.set(npcId, personality);

      this.emit('personalityCreated', { npcId, personality });
      return personality;

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.INVALID_PERSONALITY_DATA,
        'Failed to generate NPC personality',
        { npcId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Process player interaction and update NPC emotional state and memory
   * 
   * @param interaction - Player interaction data
   */
  async processPlayerInteraction(interaction: PlayerInteraction): Promise<void> {
    try {
      const personality = await this.getPersonality(interaction.npcId);
      
      // Analyze interaction emotional impact
      const emotionalImpact = await this.analyzeInteractionEmotion(interaction, personality);
      
      // Update emotional state
      await this.updateEmotionalState(personality, emotionalImpact);
      
      // Create memory entry
      const memory = await this.createMemoryFromInteraction(interaction, emotionalImpact);
      await this.storeMemory(personality.id, memory);
      
      // Update relationship
      await this.updateRelationship(personality, interaction.playerId, interaction);
      
      // Trigger behavior adaptation
      await this.adaptBehavior(personality, interaction);
      
      // Persist changes
      await this.persistPersonality(personality);
      
      this.emit('interactionProcessed', { interaction, personality });

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.EMOTION_UPDATE_FAILED,
        'Failed to process player interaction',
        { interaction, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Process world event and update affected NPCs
   * 
   * @param worldEvent - World event data
   */
  async processWorldEvent(worldEvent: WorldEvent): Promise<void> {
    try {
      // Find affected NPCs
      const affectedNPCs = await this.findAffectedNPCs(worldEvent);
      
      for (const npcId of affectedNPCs) {
        const personality = await this.getPersonality(npcId);
        
        // Calculate event impact on this NPC
        const impact = await this.calculateWorldEventImpact(worldEvent, personality);
        
        // Update emotional state based on event
        await this.updateEmotionalStateFromEvent(personality, worldEvent, impact);
        
        // Create memory of the event
        const memory = await this.createMemoryFromWorldEvent(worldEvent, impact);
        await this.storeMemory(personality.id, memory);
        
        // Adapt behavior based on event
        await this.adaptBehaviorFromEvent(personality, worldEvent, impact);
        
        await this.persistPersonality(personality);
      }
      
      this.emit('worldEventProcessed', { worldEvent, affectedNPCs });

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.BEHAVIOR_ADAPTATION_FAILED,
        'Failed to process world event',
        { worldEvent, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate contextual dialogue based on current personality state
   * 
   * @param context - Dialogue generation context
   * @returns Promise<string>
   */
  async generateDialogue(context: DialogueContext): Promise<string> {
    try {
      const personality = await this.getPersonality(context.npcId);
      
      // Prepare dialogue prompt with personality context
      const prompt = this.buildDialoguePrompt(personality, context);
      
      // Generate dialogue using AI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: prompt.system
          },
          {
            role: 'user',
            content: prompt.user
          }
        ],
        temperature: 0.8,
        max_tokens: 300
      });

      const dialogue = response.choices[0]?.message?.content || 'I have nothing to say.';
      
      // Create memory of this dialogue
      const memory: MemoryEntry = {
        id: `dialogue_${Date.now()}`,
        type: MemoryType.INTERACTION,
        content: `Said to ${context.playerId}: "${dialogue}"`,
        importance: 30,
        emotionalImpact: 0,
        timestamp: new Date(),
        associatedEntities: [context.playerId],
        tags: ['dialogue', 'conversation']
      };
      
      await this.storeMemory(personality.id, memory);
      
      this.emit('dialogueGenerated', { context, dialogue });
      return dialogue;

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.DIALOGUE_GENERATION_FAILED,
        'Failed to generate dialogue',
        { context, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get NPC personality by ID
   * 
   * @param npcId - NPC identifier
   * @returns Promise<NPCPersonality>
   */
  async getPersonality(npcId: string): Promise<NPCPersonality> {
    try {
      // Check cache first
      let personality = this.personalities.get(npcId);
      
      if (!personality) {
        // Load from database
        const { data, error } = await this.supabase
          .from('npc_personalities')
          .select('*')
          .eq('id', npcId)
          .single();

        if (error) throw error;
        if (!data) {
          throw new NPCPersonalityServiceError(
            NPCPersonalityError.NPC_NOT_FOUND,
            `NPC personality not found: ${npcId}`
          );
        }

        personality = this.deserializePersonality(data);
        this.personalities.set(npcId, personality);
      }

      return personality;

    } catch (error) {
      if (error instanceof NPCPersonalityServiceError) throw error;
      
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.NPC_NOT_FOUND,
        'Failed to retrieve NPC personality',
        { npcId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get NPC's current emotional state
   * 
   * @param npcId - NPC identifier
   * @returns Promise<EmotionalState>
   */
  async getEmotionalState(npcId: string): Promise<EmotionalState> {
    const personality = await this.getPersonality(npcId);
    return personality.currentEmotion;
  }

  /**
   * Get NPC's memories filtered by criteria
   * 
   * @param npcId - NPC identifier
   * @param filters - Optional memory filters
   * @returns Promise<MemoryEntry[]>
   */
  async getMemories(
    npcId: string,
    filters?: {
      type?: MemoryType;
      minImportance?: number;
      entityId?: string;
      tags?: string[];
      limit?: number;
    }
  ): Promise<MemoryEntry[]> {
    const personality = await this.getPersonality(npcId);
    let memories = personality.memories;

    // Apply filters
    if (filters) {
      if (filters.type) {
        memories = memories.filter(m => m.type === filters.type);
      }
      if (filters.minImportance) {
        memories = memories.filter(m => m.importance >= filters.minImportance!);
      }
      if (filters.entityId) {
        memories = memories.filter(m => m.associatedEntities.includes(filters.entityId!));
      }
      if (filters.tags) {
        memories = memories.filter(m => 
          filters.tags!.some(tag => m.tags.includes(tag))
        );
      }
    }

    // Sort by importance and recency
    memories.sort((a, b) => {
      const aScore = a.importance + (Date.now() - a.timestamp.getTime()) / 86400000; // Age in days
      const bScore = b.importance + (Date.now() - b.timestamp.getTime()) / 86400000;
      return bScore - aScore;
    });

    return filters?.limit ? memories.slice(0, filters.limit) : memories;
  }

  /**
   * Get relationship data for specific entity
   * 
   * @param npcId - NPC identifier
   * @param entityId - Entity to get relationship for
   * @returns Promise<Relationship | null>
   */
  async getRelationship(npcId: string, entityId: string): Promise<Relationship | null> {
    const personality = await this.getPersonality(npcId);
    return personality.relationships.get(entityId) || null;
  }

  /**
   * Force personality evolution cycle
   * 
   * @param npcId - Optional specific NPC to evolve
   */
  async evolvePersonality(npcId?: string): Promise<void> {
    try {
      const npcsToEvolve = npcId ? [npcId] : Array.from(this.personalities.keys());
      
      for (const id of npcsToEvolve) {
        const personality = await this.getPersonality(id);
        
        // Analyze recent experiences and interactions
        const evolutionData = await this.analyzePersonalityEvolution(personality);
        
        if (evolutionData.shouldEvolve) {
          await this.applyPersonalityEvolution(personality, evolutionData);
          personality.lastEvolution = new Date();
          personality.version += 1;
          
          await this.persistPersonality(personality);
          this.emit('personalityEvolved', { npcId: id, personality, evolutionData });
        }
      }

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.BEHAVIOR_ADAPTATION_FAILED,
        'Failed to evolve personality',
        { npcId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Clean up old memories and optimize storage
   * 
   * @param npcId - Optional specific NPC to clean
   */
  async cleanupMemories(npcId?: string): Promise<void> {
    try {
      const npcsToClean = npcId ? [npcId] : Array.from(this.personalities.keys());
      
      for (const id of npcsToClean) {
        const personality = await this.getPersonality(id);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.memoryRetentionDays);
        
        // Keep important memories and recent memories
        personality.memories = personality.memories.filter(memory => 
          memory.importance > 70 || memory.timestamp > cutoffDate
        );
        
        // Limit total memory count
        if (personality.memories.length > 1000) {
          personality.memories.sort((a, b) => b.importance - a.importance);
          personality.memories = personality.memories.slice(0, 1000);
        }
        
        await this.persistPersonality(personality);
      }

    } catch (error) {
      throw new NPCPersonalityServiceError(
        NPCPersonalityError.MEMORY_STORAGE_FAILED,
        'Failed to cleanup memories',
        { npcId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get personality analytics and insights
   * 
   * @param npcId - NPC identifier
   * @returns Promise<Record<string, any>>
   */
  async getPersonalityAnalytics(npcId: string): Promise<Record<string, any>> {
    const personality = await this.getPersonality(npcId);
    
    const analytics = {
      basicStats: {
        age: Math.floor((Date.now() - personality.createdAt.getTime()) / 86400000), // Days
        version: personality.version,
        totalMemories: personality.memories.length,
        totalRelationships: personality.relationships.size,
        lastEvolution: personality.last