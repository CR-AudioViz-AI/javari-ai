import express, { Application, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { connect, NatsConnection } from 'nats';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { SpatialAudioEngine } from './core/SpatialAudioEngine';
import { WebSocketHandler } from './handlers/WebSocketHandler';
import { WebRTCHandler } from './handlers/WebRTCHandler';
import { AudioScene } from './models/AudioScene';
import { Logger } from './utils/Logger';

/**
 * Configuration interface for the Spatial Audio Service
 */
interface ServiceConfig {
  port: number;
  redisUrl: string;
  natsUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
  corsOrigins: string[];
  metricsPort: number;
  maxConnections: number;
  audioSampleRate: number;
  audioBufferSize: number;
}

/**
 * Metrics collection for monitoring
 */
interface ServiceMetrics {
  activeConnections: Gauge<string>;
  audioProcessingLatency: Histogram<string>;
  messagesProcessed: Counter<string>;
  errorsTotal: Counter<string>;
  spatialCalculations: Counter<string>;
  voiceChatSessions: Gauge<string>;
}

/**
 * Health check status
 */
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  services: {
    redis: boolean;
    nats: boolean;
    supabase: boolean;
    webrtc: boolean;
  };
  metrics: {
    activeConnections: number;
    averageLatency: number;
    uptime: number;
  };
}

/**
 * CR AudioViz AI Spatial Audio Processing Service
 * 
 * Real-time 3D spatial audio processing microservice for CRAIverse environments
 * with dynamic acoustics, sound occlusion, and multi-user voice chat optimization.
 */
class SpatialAudioService {
  private app: Application;
  private server: Server;
  private io: SocketIOServer;
  private config: ServiceConfig;
  private logger: Logger;
  private spatialEngine: SpatialAudioEngine;
  private wsHandler: WebSocketHandler;
  private webRTCHandler: WebRTCHandler;
  private redisClient: any;
  private natsConnection: NatsConnection | null = null;
  private supabaseClient: SupabaseClient;
  private metrics: ServiceMetrics;
  private activeScenes: Map<string, AudioScene> = new Map();
  private startTime: number;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.logger = new Logger('SpatialAudioService');
    
    this.initializeApp();
    this.initializeMetrics();
    this.initializeServices();
  }

  /**
   * Initialize Express application with middleware
   */
  private initializeApp(): void {
    this.app = express();
    this.server = createServer(this.app);
    
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "ws:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }));

    // General middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
    });
    this.app.use(limiter);

    // Socket.IO initialization
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupRoutes();
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): void {
    collectDefaultMetrics();

    this.metrics = {
      activeConnections: new Gauge({
        name: 'spatial_audio_active_connections',
        help: 'Number of active WebSocket connections',
        labelNames: ['type'],
      }),
      audioProcessingLatency: new Histogram({
        name: 'spatial_audio_processing_latency_ms',
        help: 'Audio processing latency in milliseconds',
        labelNames: ['operation'],
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      }),
      messagesProcessed: new Counter({
        name: 'spatial_audio_messages_total',
        help: 'Total number of messages processed',
        labelNames: ['type'],
      }),
      errorsTotal: new Counter({
        name: 'spatial_audio_errors_total',
        help: 'Total number of errors',
        labelNames: ['type'],
      }),
      spatialCalculations: new Counter({
        name: 'spatial_audio_calculations_total',
        help: 'Total number of spatial audio calculations',
        labelNames: ['type'],
      }),
      voiceChatSessions: new Gauge({
        name: 'spatial_audio_voice_sessions',
        help: 'Number of active voice chat sessions',
      }),
    };
  }

  /**
   * Initialize external services and handlers
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize Redis client
      this.redisClient = createClient({
        url: this.config.redisUrl,
        retry_delay_on_failure: 100,
      });

      this.redisClient.on('error', (err: Error) => {
        this.logger.error('Redis connection error:', err);
        this.metrics.errorsTotal.labels('redis').inc();
      });

      await this.redisClient.connect();
      this.logger.info('Connected to Redis');

      // Initialize NATS connection
      this.natsConnection = await connect({
        servers: [this.config.natsUrl],
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 2000,
      });

      this.logger.info('Connected to NATS');

      // Initialize Supabase client
      this.supabaseClient = createSupabaseClient(
        this.config.supabaseUrl,
        this.config.supabaseKey
      );

      // Initialize spatial audio engine
      this.spatialEngine = new SpatialAudioEngine({
        sampleRate: this.config.audioSampleRate,
        bufferSize: this.config.audioBufferSize,
        maxSources: this.config.maxConnections,
      });

      // Initialize handlers
      this.wsHandler = new WebSocketHandler({
        io: this.io,
        spatialEngine: this.spatialEngine,
        redisClient: this.redisClient,
        metrics: this.metrics,
        logger: this.logger,
      });

      this.webRTCHandler = new WebRTCHandler({
        spatialEngine: this.spatialEngine,
        redisClient: this.redisClient,
        metrics: this.metrics,
        logger: this.logger,
      });

      await this.setupMessageSubscriptions();

    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      this.metrics.errorsTotal.labels('initialization').inc();
      throw error;
    }
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const healthStatus = await this.getHealthStatus();
        const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthStatus);
      } catch (error) {
        this.logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
        });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        this.logger.error('Metrics collection failed:', error);
        res.status(500).json({ error: 'Metrics collection failed' });
      }
    });

    // Scene management endpoints
    this.app.post('/scenes', this.createScene.bind(this));
    this.app.get('/scenes/:sceneId', this.getScene.bind(this));
    this.app.put('/scenes/:sceneId', this.updateScene.bind(this));
    this.app.delete('/scenes/:sceneId', this.deleteScene.bind(this));

    // Audio source management
    this.app.post('/scenes/:sceneId/sources', this.addAudioSource.bind(this));
    this.app.put('/scenes/:sceneId/sources/:sourceId', this.updateAudioSource.bind(this));
    this.app.delete('/scenes/:sceneId/sources/:sourceId', this.removeAudioSource.bind(this));

    // WebRTC signaling endpoints
    this.app.post('/webrtc/offer', this.webRTCHandler.handleOffer.bind(this.webRTCHandler));
    this.app.post('/webrtc/answer', this.webRTCHandler.handleAnswer.bind(this.webRTCHandler));
    this.app.post('/webrtc/ice-candidate', this.webRTCHandler.handleIceCandidate.bind(this.webRTCHandler));

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      this.logger.error('Unhandled error:', error);
      this.metrics.errorsTotal.labels('unhandled').inc();
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    });
  }

  /**
   * Setup NATS message subscriptions
   */
  private async setupMessageSubscriptions(): Promise<void> {
    if (!this.natsConnection) {
      throw new Error('NATS connection not established');
    }

    // Subscribe to user position updates
    const positionSub = this.natsConnection.subscribe('user.position.update');
    (async () => {
      for await (const msg of positionSub) {
        try {
          const data = JSON.parse(msg.string());
          await this.handleUserPositionUpdate(data);
          this.metrics.messagesProcessed.labels('position_update').inc();
        } catch (error) {
          this.logger.error('Error processing position update:', error);
          this.metrics.errorsTotal.labels('position_update').inc();
        }
      }
    })();

    // Subscribe to scene events
    const sceneSub = this.natsConnection.subscribe('scene.event.*');
    (async () => {
      for await (const msg of sceneSub) {
        try {
          const data = JSON.parse(msg.string());
          await this.handleSceneEvent(msg.subject, data);
          this.metrics.messagesProcessed.labels('scene_event').inc();
        } catch (error) {
          this.logger.error('Error processing scene event:', error);
          this.metrics.errorsTotal.labels('scene_event').inc();
        }
      }
    })();

    this.logger.info('Message subscriptions established');
  }

  /**
   * Handle user position updates
   */
  private async handleUserPositionUpdate(data: any): Promise<void> {
    const { userId, sceneId, position, rotation } = data;
    
    const scene = this.activeScenes.get(sceneId);
    if (scene) {
      await this.spatialEngine.updateListenerPosition(userId, position, rotation);
      
      // Broadcast position update to other users in the scene
      this.io.to(`scene:${sceneId}`).emit('user:position', {
        userId,
        position,
        rotation,
      });
    }
  }

  /**
   * Handle scene events
   */
  private async handleSceneEvent(subject: string, data: any): Promise<void> {
    const eventType = subject.split('.').pop();
    
    switch (eventType) {
      case 'created':
        await this.handleSceneCreated(data);
        break;
      case 'updated':
        await this.handleSceneUpdated(data);
        break;
      case 'deleted':
        await this.handleSceneDeleted(data);
        break;
      default:
        this.logger.warn(`Unknown scene event type: ${eventType}`);
    }
  }

  /**
   * Create a new audio scene
   */
  private async createScene(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId, acousticProperties, spatialConfig } = req.body;

      const scene = new AudioScene({
        id: sceneId,
        acousticProperties,
        spatialConfig,
      });

      this.activeScenes.set(sceneId, scene);
      await this.spatialEngine.createScene(scene);

      // Cache scene in Redis
      await this.redisClient.setEx(`scene:${sceneId}`, 3600, JSON.stringify(scene.toJSON()));

      this.logger.info(`Created audio scene: ${sceneId}`);
      res.status(201).json({ success: true, sceneId });

    } catch (error) {
      this.logger.error('Failed to create scene:', error);
      this.metrics.errorsTotal.labels('scene_creation').inc();
      res.status(500).json({ error: 'Failed to create scene' });
    }
  }

  /**
   * Get scene information
   */
  private async getScene(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId } = req.params;
      const scene = this.activeScenes.get(sceneId);

      if (!scene) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }

      res.json(scene.toJSON());

    } catch (error) {
      this.logger.error('Failed to get scene:', error);
      res.status(500).json({ error: 'Failed to get scene' });
    }
  }

  /**
   * Update scene configuration
   */
  private async updateScene(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId } = req.params;
      const updates = req.body;

      const scene = this.activeScenes.get(sceneId);
      if (!scene) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }

      scene.update(updates);
      await this.spatialEngine.updateScene(scene);

      // Update cache
      await this.redisClient.setEx(`scene:${sceneId}`, 3600, JSON.stringify(scene.toJSON()));

      res.json({ success: true });

    } catch (error) {
      this.logger.error('Failed to update scene:', error);
      this.metrics.errorsTotal.labels('scene_update').inc();
      res.status(500).json({ error: 'Failed to update scene' });
    }
  }

  /**
   * Delete an audio scene
   */
  private async deleteScene(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId } = req.params;

      this.activeScenes.delete(sceneId);
      await this.spatialEngine.destroyScene(sceneId);

      // Remove from cache
      await this.redisClient.del(`scene:${sceneId}`);

      this.logger.info(`Deleted audio scene: ${sceneId}`);
      res.json({ success: true });

    } catch (error) {
      this.logger.error('Failed to delete scene:', error);
      this.metrics.errorsTotal.labels('scene_deletion').inc();
      res.status(500).json({ error: 'Failed to delete scene' });
    }
  }

  /**
   * Add audio source to scene
   */
  private async addAudioSource(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId } = req.params;
      const sourceData = req.body;

      const scene = this.activeScenes.get(sceneId);
      if (!scene) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }

      const sourceId = await this.spatialEngine.addAudioSource(sceneId, sourceData);
      res.status(201).json({ success: true, sourceId });

    } catch (error) {
      this.logger.error('Failed to add audio source:', error);
      this.metrics.errorsTotal.labels('source_addition').inc();
      res.status(500).json({ error: 'Failed to add audio source' });
    }
  }

  /**
   * Update audio source
   */
  private async updateAudioSource(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId, sourceId } = req.params;
      const updates = req.body;

      await this.spatialEngine.updateAudioSource(sceneId, sourceId, updates);
      res.json({ success: true });

    } catch (error) {
      this.logger.error('Failed to update audio source:', error);
      this.metrics.errorsTotal.labels('source_update').inc();
      res.status(500).json({ error: 'Failed to update audio source' });
    }
  }

  /**
   * Remove audio source from scene
   */
  private async removeAudioSource(req: Request, res: Response): Promise<void> {
    try {
      const { sceneId, sourceId } = req.params;

      await this.spatialEngine.removeAudioSource(sceneId, sourceId);
      res.json({ success: true });

    } catch (error) {
      this.logger.error('Failed to remove audio source:', error);
      this.metrics.errorsTotal.labels('source_removal').inc();
      res.status(500).json({ error: 'Failed to remove audio source' });
    }
  }

  /**
   * Handle scene creation event
   */
  private async handleSceneCreated(data: any): Promise<void> {
    const { sceneId, config } = data;
    
    if (!this.activeScenes.has(sceneId)) {
      const scene = new AudioScene({
        id: sceneId,
        ...config,
      });
      
      this.activeScenes.set(sceneId, scene);
      await this.spatialEngine.createScene(scene);
      
      this.logger.info(`Scene created from event: ${sceneId}`);
    }
  }

  /**
   * Handle scene update event
   */
  private async handleSceneUpdated(data: any): Promise<void> {
    const { sceneId, updates } = data;
    
    const scene = this.activeScenes.get(sceneId);
    if (scene) {
      scene.update(updates);
      await this.spatialEngine.updateScene(scene);
      
      this.logger.info(`Scene updated from event: ${sceneId}`);
    }
  }

  /**
   * Handle scene deletion event
   */
  private async handleSceneDeleted(data: any): Promise<void> {
    const { sceneId } = data;
    
    this.activeScenes.delete(sceneId);
    await this.spatialEngine.destroyScene(sceneId);
    
    this.logger.info(`Scene deleted from event: ${sceneId}`);
  }

  /**
   * Get service health status
   */
  private async getHealthStatus(): Promise<HealthStatus> {
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        redis: false,
        nats: false,
        supabase: false,
        webrtc: false,
      },
      metrics: {
        activeConnections: this.io.sockets.sockets.size,
        averageLatency: 0,
        uptime: Date.now() - this.startTime,
      },
    };

    try {
      // Check Redis
      await this.redisClient.ping();
      status.services.redis = true;
    } catch (error) {
      this.logger.warn('Redis health check failed:', error);
    }

    try {
      // Check NATS
      status.services.nats = this.natsConnection?.isClosed() === false;
    } catch (error) {
      this.logger.warn('NATS health check failed:', error);
    }

    try {
      // Check Supabase
      const { error } = await this.supabaseClient.from('health_check').select('*').limit(1);
      status.services.supabase = !error;
    } catch (error) {
      this.logger.warn('Supabase health check failed:', error);
    }

    // Check WebRTC handler
    status.services.webrtc = this.webRTCHandler.isHealthy();

    // Overall health status
    const allServicesHealthy = Object.values(status.services).every(Boolean);
    status.status = allServicesHealthy ? 'healthy' : 'unhealthy';

    return status;
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      await this.initializeServices();
      
      this.server.listen(this.config.port, () => {
        this.logger.info(`Spatial Audio Service listening on port ${this.config.port}`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      this.logger.error('Failed to start service:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');

    try {
      // Close server
      this.server.close();

      // Close Socket.IO