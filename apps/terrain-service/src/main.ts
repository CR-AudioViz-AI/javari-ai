```typescript
/**
 * @fileoverview CRAIverse Terrain Generation Service - Main Entry Point
 * @description Scalable microservice for procedural terrain generation using advanced 
 * noise algorithms, supporting real-time world expansion and dynamic detail adjustment
 * @author CR AudioViz AI
 * @version 1.0.0
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'minio';
import prometheus from 'prom-client';
import winston from 'winston';
import { config } from 'dotenv';
import { TerrainController } from './controllers/TerrainController';
import { NoiseGenerationService } from './services/NoiseGenerationService';
import { ChunkManagementService } from './services/ChunkManagementService';
import { DetailLevelService } from './services/DetailLevelService';
import { RedisTerrainCache } from './cache/RedisTerrainCache';
import { TerrainChunk, ChunkStatus } from './models/TerrainChunk';
import { BiomeConfig } from './models/BiomeConfig';

// Load environment variables
config();

/**
 * Environment Configuration Interface
 */
interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  REDIS_URL: string;
  REDIS_CLUSTER_NODES: string[];
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MINIO_ENDPOINT: string;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;
  MAX_CONCURRENT_GENERATIONS: number;
  CHUNK_CACHE_TTL: number;
  METRICS_PORT: number;
  LOG_LEVEL: string;
}

/**
 * Service Health Status Interface
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  services: {
    redis: boolean;
    database: boolean;
    storage: boolean;
  };
  metrics: {
    activeGenerations: number;
    cachedChunks: number;
    totalGenerations: number;
    averageGenerationTime: number;
  };
}

/**
 * WebSocket Event Types
 */
interface TerrainWebSocketEvents {
  'terrain:chunk:request': (data: { x: number; y: number; lod: number }) => void;
  'terrain:chunk:generated': (data: { chunk: TerrainChunk }) => void;
  'terrain:generation:progress': (data: { progress: number; chunkId: string }) => void;
  'terrain:error': (data: { error: string; chunkId?: string }) => void;
}

/**
 * Main CRAIverse Terrain Generation Service Application
 */
class TerrainService {
  private app: Application;
  private server: Server;
  private io: SocketIOServer;
  private redis: Redis;
  private supabase: any;
  private minio: Client;
  private logger: winston.Logger;
  private config: EnvironmentConfig;

  // Service components
  private terrainController: TerrainController;
  private noiseService: NoiseGenerationService;
  private chunkService: ChunkManagementService;
  private detailService: DetailLevelService;
  private terrainCache: RedisTerrainCache;

  // Metrics
  private metricsRegistry: prometheus.Registry;
  private httpRequestDuration: prometheus.Histogram;
  private terrainGenerationDuration: prometheus.Histogram;
  private activeGenerationsGauge: prometheus.Gauge;
  private cacheHitRate: prometheus.Counter;
  private errorCounter: prometheus.Counter;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      }
    });

    this.initializeConfig();
    this.initializeLogger();
    this.initializeMetrics();
  }

  /**
   * Initialize environment configuration
   */
  private initializeConfig(): void {
    this.config = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: parseInt(process.env.PORT || '3001', 10),
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      REDIS_CLUSTER_NODES: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
      MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || '',
      MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || '',
      MINIO_BUCKET: process.env.MINIO_BUCKET || 'terrain-data',
      MAX_CONCURRENT_GENERATIONS: parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '10', 10),
      CHUNK_CACHE_TTL: parseInt(process.env.CHUNK_CACHE_TTL || '3600', 10),
      METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090', 10),
      LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    };
  }

  /**
   * Initialize Winston logger
   */
  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'terrain-service' },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): void {
    this.metricsRegistry = new prometheus.Registry();
    prometheus.collectDefaultMetrics({ register: this.metricsRegistry });

    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.terrainGenerationDuration = new prometheus.Histogram({
      name: 'terrain_generation_duration_seconds',
      help: 'Duration of terrain generation operations',
      labelNames: ['chunk_size', 'lod', 'noise_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.activeGenerationsGauge = new prometheus.Gauge({
      name: 'active_terrain_generations',
      help: 'Number of active terrain generation operations'
    });

    this.cacheHitRate = new prometheus.Counter({
      name: 'terrain_cache_hits_total',
      help: 'Total number of terrain cache hits',
      labelNames: ['cache_type']
    });

    this.errorCounter = new prometheus.Counter({
      name: 'terrain_errors_total',
      help: 'Total number of terrain generation errors',
      labelNames: ['error_type']
    });

    this.metricsRegistry.registerMetric(this.httpRequestDuration);
    this.metricsRegistry.registerMetric(this.terrainGenerationDuration);
    this.metricsRegistry.registerMetric(this.activeGenerationsGauge);
    this.metricsRegistry.registerMetric(this.cacheHitRate);
    this.metricsRegistry.registerMetric(this.errorCounter);
  }

  /**
   * Initialize external service connections
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize Redis connection
      if (this.config.REDIS_CLUSTER_NODES.length > 0) {
        this.redis = new Redis.Cluster(
          this.config.REDIS_CLUSTER_NODES.map(node => ({ host: node.split(':')[0], port: parseInt(node.split(':')[1]) })),
          {
            redisOptions: {
              password: process.env.REDIS_PASSWORD
            }
          }
        );
      } else {
        this.redis = new Redis(this.config.REDIS_URL);
      }

      // Initialize Supabase client
      this.supabase = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_ANON_KEY);

      // Initialize MinIO client
      this.minio = new Client({
        endPoint: this.config.MINIO_ENDPOINT,
        accessKey: this.config.MINIO_ACCESS_KEY,
        secretKey: this.config.MINIO_SECRET_KEY,
        useSSL: this.config.NODE_ENV === 'production'
      });

      // Ensure MinIO bucket exists
      const bucketExists = await this.minio.bucketExists(this.config.MINIO_BUCKET);
      if (!bucketExists) {
        await this.minio.makeBucket(this.config.MINIO_BUCKET);
      }

      this.logger.info('External services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize external services:', error);
      throw error;
    }
  }

  /**
   * Initialize service components
   */
  private async initializeComponents(): Promise<void> {
    try {
      // Initialize cache
      this.terrainCache = new RedisTerrainCache(this.redis, this.config.CHUNK_CACHE_TTL);

      // Initialize services
      this.noiseService = new NoiseGenerationService();
      this.detailService = new DetailLevelService();
      this.chunkService = new ChunkManagementService(
        this.supabase,
        this.minio,
        this.terrainCache,
        this.config.MINIO_BUCKET
      );

      // Initialize controller
      this.terrainController = new TerrainController(
        this.noiseService,
        this.chunkService,
        this.detailService,
        this.terrainCache
      );

      this.logger.info('Service components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize service components:', error);
      throw error;
    }
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Performance middleware
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later'
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging and metrics
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        this.httpRequestDuration
          .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
          .observe(duration);
      });

      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    });
  }

  /**
   * Configure API routes
   */
  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const healthStatus: HealthStatus = await this.getHealthStatus();
        res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
      } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      res.set('Content-Type', this.metricsRegistry.contentType);
      res.end(await this.metricsRegistry.metrics());
    });

    // Terrain API routes
    this.app.use('/api/v1/terrain', this.terrainController.getRouter());

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', error);
      this.errorCounter.labels('unhandled').inc();
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Configure WebSocket handlers
   */
  private configureWebSocket(): void {
    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);

      // Handle terrain chunk requests
      socket.on('terrain:chunk:request', async (data: { x: number; y: number; lod: number }) => {
        try {
          const startTime = Date.now();
          this.activeGenerationsGauge.inc();

          // Generate terrain chunk
          const chunk = await this.chunkService.getOrGenerateChunk(data.x, data.y, data.lod);
          
          const duration = (Date.now() - startTime) / 1000;
          this.terrainGenerationDuration
            .labels(chunk.size.toString(), data.lod.toString(), 'mixed')
            .observe(duration);

          socket.emit('terrain:chunk:generated', { chunk });
          this.activeGenerationsGauge.dec();

        } catch (error) {
          this.logger.error('Terrain generation error:', error);
          this.errorCounter.labels('generation').inc();
          socket.emit('terrain:error', { 
            error: error.message, 
            chunkId: `${data.x}_${data.y}_${data.lod}` 
          });
          this.activeGenerationsGauge.dec();
        }
      });

      // Handle client disconnection
      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Get service health status
   */
  private async getHealthStatus(): Promise<HealthStatus> {
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
      services: {
        redis: false,
        database: false,
        storage: false
      },
      metrics: {
        activeGenerations: 0,
        cachedChunks: 0,
        totalGenerations: 0,
        averageGenerationTime: 0
      }
    };

    try {
      // Check Redis
      await this.redis.ping();
      status.services.redis = true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
    }

    try {
      // Check Supabase
      const { data, error } = await this.supabase.from('terrain_metadata').select('count').limit(1);
      if (!error) {
        status.services.database = true;
      }
    } catch (error) {
      this.logger.error('Database health check failed:', error);
    }

    try {
      // Check MinIO
      await this.minio.bucketExists(this.config.MINIO_BUCKET);
      status.services.storage = true;
    } catch (error) {
      this.logger.error('Storage health check failed:', error);
    }

    // Update overall status
    const healthyServices = Object.values(status.services).filter(Boolean).length;
    if (healthyServices === 3) {
      status.status = 'healthy';
    } else if (healthyServices >= 2) {
      status.status = 'degraded';
    } else {
      status.status = 'unhealthy';
    }

    return status;
  }

  /**
   * Start the terrain service
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting CRAIverse Terrain Generation Service...');

      // Initialize services and components
      await this.initializeServices();
      await this.initializeComponents();

      // Configure Express app
      this.configureMiddleware();
      this.configureRoutes();
      this.configureWebSocket();

      // Start HTTP server
      this.server.listen(this.config.PORT, () => {
        this.logger.info(`Terrain service listening on port ${this.config.PORT}`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

      this.logger.info('CRAIverse Terrain Generation Service started successfully');

    } catch (error) {
      this.logger.error('Failed to start terrain service:', error);
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the service
   */
  private async shutdown(): Promise<void> {
    this.logger.info('Shutting down terrain service...');

    try {
      // Close HTTP server
      this.server.close();

      // Close WebSocket connections
      this.io.close();

      // Close Redis connection
      if (this.redis) {
        this.redis.disconnect();
      }

      this.logger.info('Terrain service shut down gracefully');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

/**
 * Start the service if this file is run directly
 */
if (require.main === module) {
  const terrainService = new TerrainService();
  terrainService.start().catch((error) => {
    console.error('Failed to start terrain service:', error);
    process.exit(1);
  });
}

export { TerrainService };
export default TerrainService;
```