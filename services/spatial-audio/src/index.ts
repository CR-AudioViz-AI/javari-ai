```typescript
/**
 * CRAIverse Spatial Audio Service
 * Provides 3D spatial audio processing for virtual environments
 * Handles real-time voice chat, environmental audio, and AI agent voice positioning
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { SpatialAudioEngine } from './core/SpatialAudioEngine';
import { VoiceChatProcessor } from './processors/VoiceChatProcessor';
import { EnvironmentalAudioProcessor } from './processors/EnvironmentalAudioProcessor';
import { AIAgentVoiceProcessor } from './processors/AIAgentVoiceProcessor';
import { SpatialAudioWebSocketServer } from './websocket/SpatialAudioWebSocketServer';
import spatialAudioRoutes from './api/routes/spatial-audio';
import {
  SpatialAudioConfig,
  ServiceHealth,
  AudioSession,
  SpatialAudioError
} from './types/spatial-audio.types';

dotenv.config();

/**
 * CRAIverse Spatial Audio Service
 * Main service class orchestrating 3D spatial audio processing
 */
export class CRAIverseSpatialAudioService {
  private app: express.Application;
  private server: any;
  private wsServer: WebSocketServer;
  private spatialAudioEngine: SpatialAudioEngine;
  private voiceChatProcessor: VoiceChatProcessor;
  private environmentalAudioProcessor: EnvironmentalAudioProcessor;
  private aiAgentVoiceProcessor: AIAgentVoiceProcessor;
  private spatialAudioWS: SpatialAudioWebSocketServer;
  private redis: Redis;
  private supabase: any;
  private config: SpatialAudioConfig;
  private activeSessions: Map<string, AudioSession>;
  private isShuttingDown: boolean = false;

  constructor(config?: Partial<SpatialAudioConfig>) {
    this.config = this.initializeConfig(config);
    this.activeSessions = new Map();
    this.initializeComponents();
  }

  /**
   * Initialize service configuration
   */
  private initializeConfig(config?: Partial<SpatialAudioConfig>): SpatialAudioConfig {
    return {
      port: config?.port || parseInt(process.env.PORT || '3005'),
      wsPort: config?.wsPort || parseInt(process.env.WS_PORT || '3006'),
      redisUrl: config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      supabaseUrl: config?.supabaseUrl || process.env.SUPABASE_URL!,
      supabaseKey: config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      maxConcurrentSessions: config?.maxConcurrentSessions || 1000,
      audioSampleRate: config?.audioSampleRate || 48000,
      audioBufferSize: config?.audioBufferSize || 1024,
      maxDistance: config?.maxDistance || 100.0,
      minDistance: config?.minDistance || 1.0,
      hrtfCacheSize: config?.hrtfCacheSize || 10000,
      enableEnvironmentalAudio: config?.enableEnvironmentalAudio ?? true,
      enableAIAgentVoices: config?.enableAIAgentVoices ?? true,
      enableVoiceChat: config?.enableVoiceChat ?? true,
      compressionEnabled: config?.compressionEnabled ?? true,
      rateLimitEnabled: config?.rateLimitEnabled ?? true,
      corsOrigins: config?.corsOrigins || ['http://localhost:3000'],
      ...config
    };
  }

  /**
   * Initialize service components
   */
  private initializeComponents(): void {
    // Initialize Express app
    this.app = express();
    this.server = createServer(this.app);

    // Initialize Redis
    this.redis = new Redis(this.config.redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    // Initialize Supabase
    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey
    );

    // Initialize core spatial audio engine
    this.spatialAudioEngine = new SpatialAudioEngine(this.config, this.redis);

    // Initialize processors
    this.voiceChatProcessor = new VoiceChatProcessor(
      this.spatialAudioEngine,
      this.redis,
      this.config
    );

    this.environmentalAudioProcessor = new EnvironmentalAudioProcessor(
      this.spatialAudioEngine,
      this.redis,
      this.config
    );

    this.aiAgentVoiceProcessor = new AIAgentVoiceProcessor(
      this.spatialAudioEngine,
      this.redis,
      this.config
    );

    // Initialize WebSocket server
    this.wsServer = new WebSocketServer({ 
      server: this.server,
      path: '/spatial-audio-ws'
    });

    this.spatialAudioWS = new SpatialAudioWebSocketServer(
      this.wsServer,
      this.spatialAudioEngine,
      this.redis,
      this.config
    );
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    if (this.config.compressionEnabled) {
      this.app.use(compression());
    }

    // Rate limiting
    if (this.config.rateLimitEnabled) {
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP',
        standardHeaders: true,
        legacyHeaders: false
      });
      this.app.use(limiter);
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Configure API routes
   */
  private configureRoutes(): void {
    // Health check
    this.app.get('/health', this.handleHealthCheck.bind(this));

    // Service info
    this.app.get('/info', this.handleServiceInfo.bind(this));

    // Spatial audio routes
    this.app.use('/api/spatial-audio', spatialAudioRoutes);

    // Error handling middleware
    this.app.use(this.handleError.bind(this));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(req: express.Request, res: express.Response): Promise<void> {
    try {
      const health: ServiceHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        components: {
          spatialAudioEngine: await this.spatialAudioEngine.healthCheck(),
          redis: this.redis.status === 'ready',
          supabase: await this.checkSupabaseHealth(),
          websocket: this.wsServer.readyState === 1,
          processors: {
            voiceChat: this.voiceChatProcessor.isHealthy(),
            environmental: this.environmentalAudioProcessor.isHealthy(),
            aiAgent: this.aiAgentVoiceProcessor.isHealthy()
          }
        },
        metrics: {
          activeSessions: this.activeSessions.size,
          connectedClients: this.spatialAudioWS.getConnectedClientCount(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };

      const allHealthy = Object.values(health.components).every(component => 
        typeof component === 'boolean' ? component : Object.values(component).every(Boolean)
      );

      if (!allHealthy) {
        health.status = 'degraded';
      }

      res.status(allHealthy ? 200 : 503).json(health);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check Supabase connection health
   */
  private async checkSupabaseHealth(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Supabase health check failed:', error);
      return false;
    }
  }

  /**
   * Handle service info requests
   */
  private handleServiceInfo(req: express.Request, res: express.Response): void {
    res.json({
      name: 'CRAIverse Spatial Audio Service',
      version: process.env.npm_package_version || '1.0.0',
      description: '3D spatial audio processing for virtual environments',
      features: [
        'Real-time voice chat with 3D positioning',
        'Environmental audio processing',
        'AI agent voice spatialization',
        'HRTF-based binaural audio',
        'Distance-based audio attenuation',
        'WebRTC integration',
        'Low-latency WebSocket communication'
      ],
      endpoints: {
        health: '/health',
        info: '/info',
        api: '/api/spatial-audio',
        websocket: '/spatial-audio-ws'
      },
      config: {
        maxConcurrentSessions: this.config.maxConcurrentSessions,
        audioSampleRate: this.config.audioSampleRate,
        maxDistance: this.config.maxDistance,
        enabledFeatures: {
          voiceChat: this.config.enableVoiceChat,
          environmentalAudio: this.config.enableEnvironmentalAudio,
          aiAgentVoices: this.config.enableAIAgentVoices
        }
      }
    });
  }

  /**
   * Global error handling middleware
   */
  private handleError(
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void {
    console.error('Service error:', error);

    const spatialAudioError: SpatialAudioError = {
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || undefined,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name
      } : undefined
    };

    res.status(500).json({
      success: false,
      error: spatialAudioError
    });
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      console.log('Starting CRAIverse Spatial Audio Service...');

      // Configure middleware and routes
      this.configureMiddleware();
      this.configureRoutes();

      // Initialize components
      await this.spatialAudioEngine.initialize();
      await this.voiceChatProcessor.initialize();
      await this.environmentalAudioProcessor.initialize();
      await this.aiAgentVoiceProcessor.initialize();

      // Start WebSocket server
      await this.spatialAudioWS.initialize();

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      console.log(`🎵 CRAIverse Spatial Audio Service started successfully`);
      console.log(`📡 HTTP Server: http://localhost:${this.config.port}`);
      console.log(`🔌 WebSocket Server: ws://localhost:${this.config.port}/spatial-audio-ws`);
      console.log(`🗄️ Redis: ${this.config.redisUrl}`);
      console.log(`📊 Max Sessions: ${this.config.maxConcurrentSessions}`);

    } catch (error) {
      console.error('Failed to start CRAIverse Spatial Audio Service:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the service
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('Shutting down CRAIverse Spatial Audio Service...');

    try {
      // Stop accepting new connections
      this.server?.close();

      // Close WebSocket connections
      await this.spatialAudioWS?.shutdown();

      // Cleanup processors
      await this.voiceChatProcessor?.cleanup();
      await this.environmentalAudioProcessor?.cleanup();
      await this.aiAgentVoiceProcessor?.cleanup();

      // Cleanup spatial audio engine
      await this.spatialAudioEngine?.cleanup();

      // Close database connections
      this.redis?.disconnect();

      console.log('✅ CRAIverse Spatial Audio Service shut down successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics() {
    return {
      activeSessions: this.activeSessions.size,
      connectedClients: this.spatialAudioWS?.getConnectedClientCount() || 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }
}

// Create and export service instance
const spatialAudioService = new CRAIverseSpatialAudioService();

// Handle process signals for graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await spatialAudioService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await spatialAudioService.shutdown();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await spatialAudioService.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await spatialAudioService.shutdown();
  process.exit(1);
});

// Start service if this file is run directly
if (require.main === module) {
  spatialAudioService.start().catch(console.error);
}

export default spatialAudioService;
export { CRAIverseSpatialAudioService };
```