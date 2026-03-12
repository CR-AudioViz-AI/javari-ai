```typescript
/**
 * CR AudioViz AI - Avatar Companion Service
 * 
 * AI-powered avatar companion service that provides personalized virtual assistants
 * with emotional intelligence, learning user preferences and delivering contextual
 * assistance within CR AudioViz virtual environments.
 * 
 * @author CR AudioViz AI Engineering Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Emotional state representation for avatar companions
 */
export interface EmotionalState {
  id: string;
  companionId: string;
  primary: EmotionalPrimary;
  secondary?: EmotionalSecondary[];
  intensity: number; // 0.0 - 1.0
  valence: number; // -1.0 to 1.0 (negative to positive)
  arousal: number; // 0.0 to 1.0 (calm to excited)
  timestamp: Date;
  context?: string;
}

export type EmotionalPrimary = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'trust' | 'anticipation';
export type EmotionalSecondary = 'curiosity' | 'confusion' | 'empathy' | 'enthusiasm' | 'concern' | 'pride' | 'gratitude';

/**
 * User interaction data structure
 */
export interface UserInteraction {
  id: string;
  userId: string;
  companionId: string;
  type: InteractionType;
  content: string;
  sentiment: number; // -1.0 to 1.0
  intent: string;
  context: InteractionContext;
  response?: CompanionResponse;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type InteractionType = 'text' | 'voice' | 'gesture' | 'spatial' | 'emotional';

export interface InteractionContext {
  environment: string;
  spatialPosition: [number, number, number];
  audioContext: string;
  nearbyUsers: string[];
  currentActivity: string;
  timeOfDay: string;
  sessionDuration: number;
}

/**
 * Companion personality configuration
 */
export interface CompanionPersonality {
  id: string;
  name: string;
  archetype: PersonalityArchetype;
  traits: PersonalityTraits;
  communicationStyle: CommunicationStyle;
  expertise: string[];
  backstory: string;
  goals: string[];
  quirks: string[];
  emotionalRange: EmotionalRange;
  adaptability: number; // 0.0 - 1.0
  createdAt: Date;
  updatedAt: Date;
}

export type PersonalityArchetype = 'mentor' | 'friend' | 'assistant' | 'explorer' | 'creator' | 'guardian' | 'entertainer';

export interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface CommunicationStyle {
  formality: number; // 0.0 (casual) to 1.0 (formal)
  verbosity: number; // 0.0 (concise) to 1.0 (elaborate)
  humor: number; // 0.0 (serious) to 1.0 (playful)
  supportiveness: number; // 0.0 (neutral) to 1.0 (encouraging)
}

export interface EmotionalRange {
  expressiveness: number; // 0.0 to 1.0
  stability: number; // 0.0 to 1.0
  empathy: number; // 0.0 to 1.0
  reactivity: number; // 0.0 to 1.0
}

/**
 * Companion response structure
 */
export interface CompanionResponse {
  id: string;
  content: string;
  type: ResponseType;
  emotionalState: EmotionalState;
  actions?: CompanionAction[];
  audioUrl?: string;
  spatialAudio?: SpatialAudioConfig;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type ResponseType = 'text' | 'voice' | 'action' | 'gesture' | 'spatial_movement';

export interface CompanionAction {
  type: 'gesture' | 'movement' | 'environmental_interaction' | 'ui_interaction';
  parameters: Record<string, unknown>;
  duration?: number;
}

export interface SpatialAudioConfig {
  position: [number, number, number];
  direction: [number, number, number];
  volume: number;
  tone: 'neutral' | 'warm' | 'energetic' | 'calm' | 'excited';
}

/**
 * Learning and adaptation data
 */
export interface UserPreference {
  userId: string;
  companionId: string;
  category: PreferenceCategory;
  key: string;
  value: unknown;
  confidence: number; // 0.0 - 1.0
  learnedAt: Date;
  lastUpdated: Date;
  interactions: number;
}

export type PreferenceCategory = 'communication' | 'activities' | 'topics' | 'assistance' | 'emotional' | 'spatial';

/**
 * Service configuration
 */
export interface AvatarCompanionConfig {
  supabase: {
    url: string;
    key: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  anthropic: {
    apiKey: string;
  };
  websocket: {
    port: number;
    heartbeatInterval: number;
  };
  learning: {
    adaptationRate: number;
    memoryRetention: number;
    preferencesThreshold: number;
  };
  emotional: {
    decayRate: number;
    responsiveness: number;
    memoryDuration: number;
  };
}

// ============================================================================
// Core Service Implementation
// ============================================================================

/**
 * Main Avatar Companion Service
 * 
 * Orchestrates AI-powered avatar companions with emotional intelligence,
 * preference learning, and contextual assistance capabilities.
 */
export class AvatarCompanionService extends EventEmitter {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private anthropic: Anthropic;
  private companions: Map<string, CompanionEngine> = new Map();
  private websocketServer?: WebSocket.Server;
  private clientConnections: Map<string, WebSocket> = new Map();

  constructor(private config: AvatarCompanionConfig) {
    super();
    this.initializeClients();
  }

  /**
   * Initialize external service clients
   */
  private initializeClients(): void {
    this.supabase = createClient(
      this.config.supabase.url,
      this.config.supabase.key
    );

    this.openai = new OpenAI({
      apiKey: this.config.openai.apiKey,
    });

    this.anthropic = new Anthropic({
      apiKey: this.config.anthropic.apiKey,
    });
  }

  /**
   * Start the avatar companion service
   */
  public async start(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.startWebSocketServer();
      await this.loadActiveCompanions();
      
      this.emit('service:started');
      console.log('Avatar Companion Service started successfully');
    } catch (error) {
      console.error('Failed to start Avatar Companion Service:', error);
      throw error;
    }
  }

  /**
   * Stop the avatar companion service
   */
  public async stop(): Promise<void> {
    try {
      if (this.websocketServer) {
        this.websocketServer.close();
      }

      // Gracefully shutdown all companions
      for (const [companionId, companion] of this.companions) {
        await companion.shutdown();
      }

      this.companions.clear();
      this.clientConnections.clear();
      
      this.emit('service:stopped');
      console.log('Avatar Companion Service stopped successfully');
    } catch (error) {
      console.error('Error stopping Avatar Companion Service:', error);
      throw error;
    }
  }

  /**
   * Create a new avatar companion
   */
  public async createCompanion(
    userId: string,
    personalityConfig: Partial<CompanionPersonality>
  ): Promise<string> {
    try {
      const personality = await this.generatePersonality(personalityConfig);
      
      const { data, error } = await this.supabase
        .from('companions')
        .insert([{
          user_id: userId,
          personality: personality,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      const companionEngine = new CompanionEngine(
        data.id,
        personality,
        this.config,
        this.supabase,
        this.openai,
        this.anthropic
      );

      await companionEngine.initialize();
      this.companions.set(data.id, companionEngine);

      this.emit('companion:created', { companionId: data.id, userId });
      return data.id;
    } catch (error) {
      console.error('Error creating companion:', error);
      throw error;
    }
  }

  /**
   * Process user interaction with companion
   */
  public async processInteraction(
    userId: string,
    companionId: string,
    interaction: Omit<UserInteraction, 'id' | 'timestamp'>
  ): Promise<CompanionResponse> {
    try {
      const companion = this.companions.get(companionId);
      if (!companion) {
        throw new Error(`Companion ${companionId} not found`);
      }

      const fullInteraction: UserInteraction = {
        ...interaction,
        id: this.generateId(),
        timestamp: new Date(),
      };

      const response = await companion.processInteraction(fullInteraction);
      
      // Store interaction and response
      await this.storeInteraction(fullInteraction, response);
      
      // Broadcast to connected clients
      this.broadcastToClients(userId, {
        type: 'companion:response',
        data: { companionId, response },
      });

      this.emit('interaction:processed', { 
        userId, 
        companionId, 
        interaction: fullInteraction, 
        response 
      });

      return response;
    } catch (error) {
      console.error('Error processing interaction:', error);
      throw error;
    }
  }

  /**
   * Update companion's emotional state
   */
  public async updateEmotionalState(
    companionId: string,
    emotionalTrigger: Partial<EmotionalState>
  ): Promise<EmotionalState> {
    try {
      const companion = this.companions.get(companionId);
      if (!companion) {
        throw new Error(`Companion ${companionId} not found`);
      }

      const newState = await companion.updateEmotionalState(emotionalTrigger);
      
      this.emit('emotional:updated', { companionId, state: newState });
      return newState;
    } catch (error) {
      console.error('Error updating emotional state:', error);
      throw error;
    }
  }

  /**
   * Get companion's learned preferences for a user
   */
  public async getUserPreferences(
    userId: string,
    companionId: string
  ): Promise<UserPreference[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  /**
   * Train companion with conversation history
   */
  public async trainCompanion(
    companionId: string,
    trainingData: UserInteraction[]
  ): Promise<void> {
    try {
      const companion = this.companions.get(companionId);
      if (!companion) {
        throw new Error(`Companion ${companionId} not found`);
      }

      await companion.train(trainingData);
      this.emit('companion:trained', { companionId });
    } catch (error) {
      console.error('Error training companion:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize database schema
   */
  private async initializeDatabase(): Promise<void> {
    const schema = `
      -- Companions table
      CREATE TABLE IF NOT EXISTS companions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        personality JSONB NOT NULL,
        emotional_state JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- User interactions table
      CREATE TABLE IF NOT EXISTS user_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        companion_id UUID NOT NULL REFERENCES companions(id),
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        sentiment REAL,
        intent TEXT,
        context JSONB,
        response JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB
      );

      -- User preferences table
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        companion_id UUID NOT NULL REFERENCES companions(id),
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        confidence REAL DEFAULT 0.0,
        learned_at TIMESTAMPTZ DEFAULT NOW(),
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        interactions INTEGER DEFAULT 1,
        UNIQUE(user_id, companion_id, category, key)
      );

      -- Emotional states table
      CREATE TABLE IF NOT EXISTS emotional_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        companion_id UUID NOT NULL REFERENCES companions(id),
        primary_emotion TEXT NOT NULL,
        secondary_emotions TEXT[],
        intensity REAL NOT NULL,
        valence REAL NOT NULL,
        arousal REAL NOT NULL,
        context TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_companions_user_id ON companions(user_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_companion_id ON user_interactions(companion_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON user_interactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_preferences_user_companion ON user_preferences(user_id, companion_id);
      CREATE INDEX IF NOT EXISTS idx_emotional_states_companion ON emotional_states(companion_id);
    `;

    try {
      await this.supabase.rpc('exec_sql', { sql: schema });
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Start WebSocket server for real-time communication
   */
  private async startWebSocketServer(): Promise<void> {
    const WebSocketServer = require('ws').Server;
    
    this.websocketServer = new WebSocketServer({
      port: this.config.websocket.port,
    });

    this.websocketServer.on('connection', (ws: WebSocket, request: any) => {
      const userId = this.extractUserIdFromRequest(request);
      if (userId) {
        this.clientConnections.set(userId, ws);
        
        ws.on('close', () => {
          this.clientConnections.delete(userId);
        });

        ws.on('message', async (data: string) => {
          try {
            const message = JSON.parse(data);
            await this.handleWebSocketMessage(userId, message);
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        });
      }
    });
  }

  /**
   * Load active companions from database
   */
  private async loadActiveCompanions(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('companions')
        .select('*')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      for (const companionData of data || []) {
        const companion = new CompanionEngine(
          companionData.id,
          companionData.personality,
          this.config,
          this.supabase,
          this.openai,
          this.anthropic
        );

        await companion.initialize();
        this.companions.set(companionData.id, companion);
      }
    } catch (error) {
      console.error('Error loading active companions:', error);
      throw error;
    }
  }

  /**
   * Generate personality configuration
   */
  private async generatePersonality(
    config: Partial<CompanionPersonality>
  ): Promise<CompanionPersonality> {
    const defaultPersonality: CompanionPersonality = {
      id: this.generateId(),
      name: config.name || 'Avatar',
      archetype: config.archetype || 'assistant',
      traits: {
        openness: 0.7,
        conscientiousness: 0.8,
        extraversion: 0.6,
        agreeableness: 0.9,
        neuroticism: 0.2,
      },
      communicationStyle: {
        formality: 0.5,
        verbosity: 0.6,
        humor: 0.4,
        supportiveness: 0.8,
      },
      expertise: config.expertise || ['general assistance'],
      backstory: config.backstory || 'A helpful AI companion designed to assist and learn.',
      goals: config.goals || ['help user', 'learn preferences', 'provide support'],
      quirks: config.quirks || [],
      emotionalRange: {
        expressiveness: 0.7,
        stability: 0.8,
        empathy: 0.9,
        reactivity: 0.6,
      },
      adaptability: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config,
    };

    return defaultPersonality;
  }

  /**
   * Store interaction and response in database
   */
  private async storeInteraction(
    interaction: UserInteraction,
    response: CompanionResponse
  ): Promise<void> {
    try {
      await this.supabase
        .from('user_interactions')
        .insert([{
          id: interaction.id,
          user_id: interaction.userId,
          companion_id: interaction.companionId,
          type: interaction.type,
          content: interaction.content,
          sentiment: interaction.sentiment,
          intent: interaction.intent,
          context: interaction.context,
          response: response,
          timestamp: interaction.timestamp.toISOString(),
          metadata: interaction.metadata,
        }]);
    } catch (error) {
      console.error('Error storing interaction:', error);
    }
  }

  /**
   * Broadcast message to connected clients
   */
  private broadcastToClients(userId: string, message: any): void {
    const ws = this.clientConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(userId: string, message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'companion:interact':
          await this.processInteraction(
            userId,
            message.companionId,
            message.interaction
          );
          break;
        
        case 'companion:emotional_trigger':
          await this.updateEmotionalState(
            message.companionId,
            message.trigger
          );
          break;
        
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('WebSocket message handling error:', error);
    }
  }

  /**
   * Extract user ID from WebSocket request
   */
  private extractUserIdFromRequest(request: any): string | null {
    // Implementation would depend on authentication strategy
    const url = new URL(request.url, 'http://localhost');
    return url.searchParams.get('userId');
  }

  /**
   * Generate unique identifier
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Companion Engine - Core AI Logic
// ============================================================================

/**
 * Individual companion engine managing AI behavior, learning, and responses
 */
class CompanionEngine {
  private emotionalIntelligence: EmotionalIntelligence;
  private preferenceLearning: PreferenceLearning;
  private contextualAssistant: ContextualAssistant;
  private currentEmotionalState: EmotionalState;

  constructor(
    public readonly id: string,
    public readonly personality: CompanionPersonality,
    private config: AvatarCompanionConfig,
    private supabase: SupabaseClient,
    private openai: OpenAI,
    private anthropic: Anthropic
  ) {
    this.emotionalIntelligence = new EmotionalIntelligence(personality, anthropic);
    this.preferenceLearning = new PreferenceLearning(supabase, config.learning);
    this.contextualAssistant = new ContextualAssistant(openai, personality);
    
    this.currentEmotionalState = {
      id: this.generateId(),
      companionId: id,
      primary: 'trust',
      intensity: 0.5,
      valence: 0.3,
      arousal: 0.4,
      timestamp: new Date(),
    };
  }

  /**
   * Initialize companion engine
   */
  public async initialize(): Promise<void> {
    await this.loadEmotionalState();
    await this.preferenceLearning.initialize(this.id);
  }

  /**
   * Process user interaction and generate response
   */
  public async processInteraction(interaction: UserInteraction): Promise<CompanionResponse> {
    try {
      // Analyze emotional context
      const emotionalContext = await this.emotionalIntelligence.analyzeInteraction(
        interaction,
        this.currentEmotionalState
      );

      // Update emotional state based on interaction
      this.currentEmotionalState = await this.updateEmotionalState(emotionalContext);

      // Learn from interaction
      await this.preferenceLearning.learnFromInteraction(interaction);

      // Generate contextual response
      const response = await this.contextualAssistant.generateResponse(
        interaction,
        this.currentEmotionalState,