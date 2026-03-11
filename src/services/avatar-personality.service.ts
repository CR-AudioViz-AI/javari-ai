```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

/**
 * Core personality traits based on Big Five model plus custom traits
 */
export interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  creativity: number;
  playfulness: number;
  empathy: number;
  curiosity: number;
  adaptability: number;
}

/**
 * Emotional state representation
 */
export interface EmotionalState {
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to excited)
  dominance: number; // 0 to 1 (submissive to dominant)
  confidence: number; // 0 to 1
  timestamp: Date;
}

/**
 * User interaction data structure
 */
export interface UserInteraction {
  id: string;
  userId: string;
  avatarId: string;
  type: 'voice' | 'text' | 'gesture' | 'preference';
  content: string;
  emotionalContext: EmotionalState;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Personality evolution event
 */
export interface PersonalityEvolution {
  id: string;
  avatarId: string;
  previousTraits: PersonalityTraits;
  newTraits: PersonalityTraits;
  trigger: string;
  confidence: number;
  timestamp: Date;
}

/**
 * Avatar personality configuration
 */
export interface AvatarPersonality {
  id: string;
  userId: string;
  name: string;
  traits: PersonalityTraits;
  currentEmotion: EmotionalState;
  interactionHistory: UserInteraction[];
  evolutionHistory: PersonalityEvolution[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Behavior adaptation parameters
 */
export interface BehaviorAdaptation {
  adaptationRate: number;
  stabilityThreshold: number;
  emotionalDecayRate: number;
  traitEvolutionSpeed: number;
  interactionWeights: Record<string, number>;
}

/**
 * Personality generation options
 */
export interface PersonalityGenerationOptions {
  baselineTraits?: Partial<PersonalityTraits>;
  userPreferences?: string[];
  culturalContext?: string;
  ageRange?: [number, number];
  temperament?: 'calm' | 'energetic' | 'balanced';
  creativityLevel?: 'low' | 'medium' | 'high';
}

/**
 * Service configuration
 */
export interface AvatarPersonalityConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  openaiApiKey: string;
  evolutionThreshold: number;
  maxHistorySize: number;
  cacheTtl: number;
  webSocketPort: number;
}

/**
 * Dynamic Avatar Personality Service
 * 
 * Generates and evolves AI-driven avatar personalities based on user interactions,
 * emotion modeling, and behavioral adaptation patterns.
 */
export class AvatarPersonalityService extends EventEmitter {
  private static instance: AvatarPersonalityService;
  private supabase: SupabaseClient;
  private redis: Redis;
  private openai: OpenAI;
  private config: AvatarPersonalityConfig;
  private websocketServer?: WebSocket.Server;
  private personalityCache: Map<string, AvatarPersonality> = new Map();
  private adaptationEngine: BehaviorAdaptation;

  /**
   * Initialize the Avatar Personality Service
   */
  constructor(config: AvatarPersonalityConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    
    this.adaptationEngine = {
      adaptationRate: 0.1,
      stabilityThreshold: 0.05,
      emotionalDecayRate: 0.02,
      traitEvolutionSpeed: 0.05,
      interactionWeights: {
        voice: 1.0,
        text: 0.8,
        gesture: 0.6,
        preference: 1.2
      }
    };

    this.initializeWebSocket();
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: AvatarPersonalityConfig): AvatarPersonalityService {
    if (!AvatarPersonalityService.instance && config) {
      AvatarPersonalityService.instance = new AvatarPersonalityService(config);
    }
    return AvatarPersonalityService.instance;
  }

  /**
   * Generate new avatar personality
   */
  public async generatePersonality(
    userId: string,
    options: PersonalityGenerationOptions = {}
  ): Promise<AvatarPersonality> {
    try {
      const personalityId = `avatar_${userId}_${Date.now()}`;
      
      // Generate base traits using AI
      const baseTraits = await this.generateTraitsWithAI(options);
      
      // Create initial emotional state
      const initialEmotion: EmotionalState = {
        valence: 0.1,
        arousal: 0.3,
        dominance: 0.5,
        confidence: 0.7,
        timestamp: new Date()
      };

      const personality: AvatarPersonality = {
        id: personalityId,
        userId,
        name: await this.generatePersonalityName(baseTraits),
        traits: baseTraits,
        currentEmotion: initialEmotion,
        interactionHistory: [],
        evolutionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      // Persist to database
      await this.persistPersonality(personality);
      
      // Cache the personality
      await this.cachePersonality(personality);

      this.emit('personalityGenerated', personality);
      
      return personality;
    } catch (error) {
      throw new Error(`Failed to generate personality: ${error}`);
    }
  }

  /**
   * Process user interaction and adapt personality
   */
  public async processInteraction(
    avatarId: string,
    interaction: Omit<UserInteraction, 'id' | 'timestamp'>
  ): Promise<AvatarPersonality> {
    try {
      const personality = await this.getPersonality(avatarId);
      if (!personality) {
        throw new Error(`Avatar personality not found: ${avatarId}`);
      }

      // Create full interaction record
      const fullInteraction: UserInteraction = {
        ...interaction,
        id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };

      // Process emotional context
      const emotionalImpact = await this.analyzeEmotionalImpact(
        fullInteraction,
        personality.currentEmotion
      );

      // Update current emotion
      personality.currentEmotion = this.updateEmotionalState(
        personality.currentEmotion,
        emotionalImpact
      );

      // Analyze behavior patterns
      const behaviorAnalysis = await this.analyzeBehaviorPatterns(
        personality.interactionHistory,
        fullInteraction
      );

      // Adapt personality traits
      const adaptedTraits = await this.adaptPersonalityTraits(
        personality.traits,
        fullInteraction,
        behaviorAnalysis
      );

      // Check if evolution threshold is met
      if (this.shouldEvolvePersonality(personality.traits, adaptedTraits)) {
        await this.evolvePersonality(personality, adaptedTraits, fullInteraction);
      } else {
        personality.traits = adaptedTraits;
      }

      // Add interaction to history
      personality.interactionHistory.push(fullInteraction);
      
      // Limit history size
      if (personality.interactionHistory.length > this.config.maxHistorySize) {
        personality.interactionHistory = personality.interactionHistory.slice(-this.config.maxHistorySize);
      }

      personality.updatedAt = new Date();
      personality.version += 1;

      // Persist changes
      await this.persistPersonality(personality);
      await this.cachePersonality(personality);

      // Log interaction
      await this.logInteraction(fullInteraction);

      // Broadcast updates
      await this.broadcastPersonalityUpdate(personality);

      this.emit('personalityUpdated', personality);

      return personality;
    } catch (error) {
      throw new Error(`Failed to process interaction: ${error}`);
    }
  }

  /**
   * Get avatar personality by ID
   */
  public async getPersonality(avatarId: string): Promise<AvatarPersonality | null> {
    try {
      // Check cache first
      if (this.personalityCache.has(avatarId)) {
        return this.personalityCache.get(avatarId)!;
      }

      // Try Redis cache
      const cached = await this.redis.get(`personality:${avatarId}`);
      if (cached) {
        const personality = JSON.parse(cached) as AvatarPersonality;
        this.personalityCache.set(avatarId, personality);
        return personality;
      }

      // Load from database
      const { data, error } = await this.supabase
        .from('avatar_personalities')
        .select('*')
        .eq('id', avatarId)
        .single();

      if (error || !data) {
        return null;
      }

      const personality = this.deserializePersonality(data);
      await this.cachePersonality(personality);
      
      return personality;
    } catch (error) {
      throw new Error(`Failed to get personality: ${error}`);
    }
  }

  /**
   * Generate personality traits using AI
   */
  private async generateTraitsWithAI(
    options: PersonalityGenerationOptions
  ): Promise<PersonalityTraits> {
    try {
      const prompt = this.buildPersonalityPrompt(options);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in personality psychology. Generate realistic personality traits based on the Big Five model plus custom traits. Respond with a JSON object containing trait values between 0 and 1.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const traits = JSON.parse(content) as PersonalityTraits;
      return this.validateAndNormalizeTraits(traits);
    } catch (error) {
      // Fallback to random generation with constraints
      return this.generateFallbackTraits(options);
    }
  }

  /**
   * Analyze emotional impact of interaction
   */
  private async analyzeEmotionalImpact(
    interaction: UserInteraction,
    currentEmotion: EmotionalState
  ): Promise<EmotionalState> {
    try {
      // Simple emotion analysis based on interaction type and content
      let valenceChange = 0;
      let arousalChange = 0;
      let dominanceChange = 0;
      let confidenceChange = 0;

      // Analyze based on interaction type
      switch (interaction.type) {
        case 'voice':
          // Voice interactions are more emotionally impactful
          valenceChange = interaction.emotionalContext.valence * 0.3;
          arousalChange = interaction.emotionalContext.arousal * 0.2;
          break;
        case 'text':
          valenceChange = interaction.emotionalContext.valence * 0.2;
          arousalChange = interaction.emotionalContext.arousal * 0.1;
          break;
        case 'gesture':
          dominanceChange = interaction.emotionalContext.dominance * 0.15;
          arousalChange = interaction.emotionalContext.arousal * 0.1;
          break;
        case 'preference':
          valenceChange = interaction.emotionalContext.valence * 0.4;
          confidenceChange = interaction.emotionalContext.confidence * 0.2;
          break;
      }

      return {
        valence: Math.max(-1, Math.min(1, currentEmotion.valence + valenceChange)),
        arousal: Math.max(0, Math.min(1, currentEmotion.arousal + arousalChange)),
        dominance: Math.max(0, Math.min(1, currentEmotion.dominance + dominanceChange)),
        confidence: Math.max(0, Math.min(1, currentEmotion.confidence + confidenceChange)),
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to analyze emotional impact: ${error}`);
    }
  }

  /**
   * Update emotional state with decay
   */
  private updateEmotionalState(
    current: EmotionalState,
    impact: EmotionalState
  ): EmotionalState {
    const decayRate = this.adaptationEngine.emotionalDecayRate;
    const timeDiff = (Date.now() - current.timestamp.getTime()) / (1000 * 60); // minutes
    const decay = Math.exp(-decayRate * timeDiff);

    return {
      valence: current.valence * decay + impact.valence * (1 - decay),
      arousal: current.arousal * decay + impact.arousal * (1 - decay),
      dominance: current.dominance * decay + impact.dominance * (1 - decay),
      confidence: current.confidence * decay + impact.confidence * (1 - decay),
      timestamp: new Date()
    };
  }

  /**
   * Analyze behavior patterns from interaction history
   */
  private async analyzeBehaviorPatterns(
    history: UserInteraction[],
    newInteraction: UserInteraction
  ): Promise<Record<string, number>> {
    try {
      const patterns: Record<string, number> = {
        consistency: 0,
        engagement: 0,
        emotionalStability: 0,
        adaptability: 0,
        creativity: 0
      };

      if (history.length === 0) {
        return patterns;
      }

      // Analyze consistency
      const recentInteractions = history.slice(-10);
      const typeFrequency = recentInteractions.reduce((acc, interaction) => {
        acc[interaction.type] = (acc[interaction.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      patterns.consistency = Math.max(...Object.values(typeFrequency)) / recentInteractions.length;

      // Analyze engagement
      const avgDuration = recentInteractions.reduce((sum, i) => sum + i.duration, 0) / recentInteractions.length;
      patterns.engagement = Math.min(1, avgDuration / 60); // normalized to 1 minute

      // Analyze emotional stability
      const emotions = recentInteractions.map(i => i.emotionalContext.valence);
      const emotionalVariance = this.calculateVariance(emotions);
      patterns.emotionalStability = 1 - Math.min(1, emotionalVariance);

      // Analyze adaptability
      const uniqueTypes = new Set(recentInteractions.map(i => i.type)).size;
      patterns.adaptability = uniqueTypes / 4; // 4 possible types

      // Analyze creativity
      const contentLengths = recentInteractions.map(i => i.content.length);
      const avgLength = contentLengths.reduce((sum, len) => sum + len, 0) / contentLengths.length;
      patterns.creativity = Math.min(1, avgLength / 100); // normalized to 100 chars

      return patterns;
    } catch (error) {
      throw new Error(`Failed to analyze behavior patterns: ${error}`);
    }
  }

  /**
   * Adapt personality traits based on interactions
   */
  private async adaptPersonalityTraits(
    currentTraits: PersonalityTraits,
    interaction: UserInteraction,
    behaviorAnalysis: Record<string, number>
  ): Promise<PersonalityTraits> {
    try {
      const adaptationRate = this.adaptationEngine.adaptationRate;
      const interactionWeight = this.adaptationEngine.interactionWeights[interaction.type] || 1.0;
      
      const newTraits = { ...currentTraits };

      // Adapt based on emotional context
      const emotion = interaction.emotionalContext;
      
      // Openness adaptation
      if (interaction.type === 'preference' && emotion.valence > 0.5) {
        newTraits.openness += adaptationRate * interactionWeight * behaviorAnalysis.creativity;
      }

      // Conscientiousness adaptation
      if (behaviorAnalysis.consistency > 0.7) {
        newTraits.conscientiousness += adaptationRate * interactionWeight * behaviorAnalysis.consistency;
      }

      // Extraversion adaptation
      if (interaction.duration > 30 && emotion.arousal > 0.6) {
        newTraits.extraversion += adaptationRate * interactionWeight * behaviorAnalysis.engagement;
      }

      // Agreeableness adaptation
      if (emotion.valence > 0.3 && interaction.type === 'voice') {
        newTraits.agreeableness += adaptationRate * interactionWeight * 0.5;
      }

      // Neuroticism adaptation (inverse of emotional stability)
      newTraits.neuroticism += adaptationRate * interactionWeight * (1 - behaviorAnalysis.emotionalStability) * 0.5;

      // Custom traits adaptation
      newTraits.creativity += adaptationRate * interactionWeight * behaviorAnalysis.creativity;
      newTraits.playfulness += adaptationRate * interactionWeight * (emotion.arousal * 0.5);
      newTraits.empathy += adaptationRate * interactionWeight * (emotion.valence > 0 ? 0.3 : -0.1);
      newTraits.curiosity += adaptationRate * interactionWeight * behaviorAnalysis.adaptability;
      newTraits.adaptability += adaptationRate * interactionWeight * behaviorAnalysis.adaptability;

      // Normalize traits to [0, 1] range
      return this.normalizeTraits(newTraits);
    } catch (error) {
      throw new Error(`Failed to adapt personality traits: ${error}`);
    }
  }

  /**
   * Check if personality should evolve
   */
  private shouldEvolvePersonality(
    oldTraits: PersonalityTraits,
    newTraits: PersonalityTraits
  ): boolean {
    const threshold = this.config.evolutionThreshold;
    const totalChange = Object.keys(oldTraits).reduce((sum, key) => {
      const oldValue = oldTraits[key as keyof PersonalityTraits];
      const newValue = newTraits[key as keyof PersonalityTraits];
      return sum + Math.abs(oldValue - newValue);
    }, 0);

    return totalChange / Object.keys(oldTraits).length > threshold;
  }

  /**
   * Evolve personality with AI assistance
   */
  private async evolvePersonality(
    personality: AvatarPersonality,
    newTraits: PersonalityTraits,
    trigger: UserInteraction
  ): Promise<void> {
    try {
      const evolution: PersonalityEvolution = {
        id: `evolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        avatarId: personality.id,
        previousTraits: { ...personality.traits },
        newTraits: { ...newTraits },
        trigger: `${trigger.type}:${trigger.content.substring(0, 50)}`,
        confidence: 0.8,
        timestamp: new Date()
      };

      personality.traits = newTraits;
      personality.evolutionHistory.push(evolution);

      // Log evolution to database
      await this.supabase
        .from('personality_evolution_logs')
        .insert([{
          id: evolution.id,
          avatar_id: evolution.avatarId,
          previous_traits: evolution.previousTraits,
          new_traits: evolution.newTraits,
          trigger: evolution.trigger,
          confidence: evolution.confidence,
          created_at: evolution.timestamp.toISOString()
        }]);

      this.emit('personalityEvolved', evolution);
    } catch (error) {
      throw new Error(`Failed to evolve personality: ${error}`);
    }
  }

  /**
   * Persist personality to database
   */
  private async persistPersonality(personality: AvatarPersonality): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('avatar_personalities')
        .upsert([{
          id: personality.id,
          user_id: personality.userId,
          name: personality.name,
          traits: personality.traits,
          current_emotion: personality.currentEmotion,
          interaction_history: personality.interactionHistory,
          evolution_history: personality.evolutionHistory,
          created_at: personality.createdAt.toISOString(),
          updated_at: personality.updatedAt.toISOString(),
          version: personality.version
        }]);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to persist personality: ${error}`);
    }
  }

  /**
   * Cache personality in Redis
   */
  private async cachePersonality(personality: AvatarPersonality): Promise<void> {
    try {
      await this.redis.setex(
        `personality:${personality.id}`,
        this.config.cacheTtl,
        JSON.stringify(personality)
      );
      
      this.personalityCache.set(personality.id, personality);
    } catch (error) {
      throw new Error(`Failed to cache personality: ${error}`);
    }
  }

  /**
   * Log interaction to database
   */
  private async logInteraction(interaction: UserInteraction): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_interactions')
        .insert([{
          id: interaction.id,
          user_id: interaction.userId,
          avatar_id: interaction.avatarId,
          type: interaction.type,
          content: interaction.content,
          emotional_context: interaction.emotionalContext,
          duration: interaction.duration,
          metadata: interaction.metadata,
          created_at: interaction.timestamp.toISOString()
        }]);

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to log interaction: ${error}`);
    }
  }

  /**
   * Initialize WebSocket server for real-time updates
   */
  private initializeWebSocket(): void {
    try {