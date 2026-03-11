/**
 * Global CDN Optimization Service - Main Entry Point
 * 
 * This microservice provides dynamic CDN optimization capabilities including:
 * - Intelligent traffic routing based on geographic and performance metrics
 * - Dynamic cache placement optimization
 * - Edge computing resource allocation
 * - Real-time performance monitoring and adjustment
 * 
 * @author CR AudioViz AI Engineering Team
 * @version 1.0.0
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import prometheus from 'prom-client';
import winston from 'winston';

// Core Services
import { CDNOptimizer } from './core/optimizer';
import { GeographicRouter } from './routing/geographic-router';
import { CachePlacementEngine } from './cache/placement-engine';
import { EdgeResourceAllocator } from './edge/resource-allocator';
import { PerformanceTracker } from './monitoring/performance-tracker';
import { OptimizationController } from './api/optimization-controller';

// Types
import {
  CDNConfig,
  OptimizationRequest,
  PerformanceMetrics,
  EdgeLocation,
  CacheStrategy,
  RouterConfiguration,
  ServiceHealth,
  OptimizationResponse
} from './types/cdn-types';

// Utilities
import { LatencyCalculator } from './utils/latency-calculator';

/**
 * CDN Optimization Service Configuration Interface
 */
interface ServiceConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  supabase: {
    url: string;
    key: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    cluster?: boolean;
  };
  cdn: {
    cloudflare: {
      apiKey: string;
      zoneId: string;
    };
    aws: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };
    googleCloud: {
      projectId: string;
      keyFile: string;
    };
  };
  monitoring: {
    metricsPort: number;
    logLevel: string;
  };
}

/**
 * Main CDN Optimization Service Class
 */
export class CDNOptimizationService {
  private app: Application;
  private config: ServiceConfig;
  private logger: winston.Logger;
  private supabase: any;
  private redis: Redis;
  private metricsRegistry: prometheus.Registry;
  
  // Core Components
  private optimizer: CDNOptimizer;
  private geographicRouter: GeographicRouter;
  private cachePlacementEngine: CachePlacementEngine;
  private edgeResourceAllocator: EdgeResourceAllocator;
  private performanceTracker: PerformanceTracker;
  private optimizationController: OptimizationController;
  private latencyCalculator: LatencyCalculator;

  // Metrics
  private requestCounter: prometheus.Counter;
  private optimizationLatency: prometheus.Histogram;
  private cacheHitRate: prometheus.Gauge;
  private edgeResourceUtilization: prometheus.Gauge;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.app = express();
    this.initializeLogger();
    this.initializeMetrics();
    this.initializeConnections();
    this.initializeComponents();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize Winston logger
   */
  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.monitoring.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ filename: 'logs/cdn-optimization.log' })
      ]
    });
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): void {
    this.metricsRegistry = new prometheus.Registry();
    
    this.requestCounter = new prometheus.Counter({
      name: 'cdn_optimization_requests_total',
      help: 'Total number of CDN optimization requests',
      labelNames: ['method', 'route', 'status']
    });

    this.optimizationLatency = new prometheus.Histogram({
      name: 'cdn_optimization_duration_seconds',
      help: 'Duration of CDN optimization operations',
      labelNames: ['operation_type']
    });

    this.cacheHitRate = new prometheus.Gauge({
      name: 'cdn_cache_hit_rate',
      help: 'Current cache hit rate across all edge locations'
    });

    this.edgeResourceUtilization = new prometheus.Gauge({
      name: 'cdn_edge_resource_utilization',
      help: 'Current edge computing resource utilization',
      labelNames: ['location', 'resource_type']
    });

    this.metricsRegistry.registerMetric(this.requestCounter);
    this.metricsRegistry.registerMetric(this.optimizationLatency);
    this.metricsRegistry.registerMetric(this.cacheHitRate);
    this.metricsRegistry.registerMetric(this.edgeResourceUtilization);
  }

  /**
   * Initialize external connections
   */
  private async initializeConnections(): Promise<void> {
    try {
      // Initialize Supabase
      this.supabase = createClient(
        this.config.supabase.url,
        this.config.supabase.key
      );

      // Initialize Redis
      if (this.config.redis.cluster) {
        this.redis = new Redis.Cluster([{
          host: this.config.redis.host,
          port: this.config.redis.port
        }], {
          redisOptions: {
            password: this.config.redis.password
          }
        });
      } else {
        this.redis = new Redis({
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3
        });
      }

      await this.redis.ping();
      this.logger.info('External connections initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize connections:', error);
      throw error;
    }
  }

  /**
   * Initialize core service components
   */
  private initializeComponents(): void {
    try {
      this.latencyCalculator = new LatencyCalculator();
      
      this.performanceTracker = new PerformanceTracker({
        redis: this.redis,
        logger: this.logger,
        metricsRegistry: this.metricsRegistry
      });

      this.geographicRouter = new GeographicRouter({
        redis: this.redis,
        latencyCalculator: this.latencyCalculator,
        logger: this.logger
      });

      this.cachePlacementEngine = new CachePlacementEngine({
        redis: this.redis,
        performanceTracker: this.performanceTracker,
        logger: this.logger
      });

      this.edgeResourceAllocator = new EdgeResourceAllocator({
        redis: this.redis,
        performanceTracker: this.performanceTracker,
        cdnConfig: this.config.cdn,
        logger: this.logger
      });

      this.optimizer = new CDNOptimizer({
        geographicRouter: this.geographicRouter,
        cachePlacementEngine: this.cachePlacementEngine,
        edgeResourceAllocator: this.edgeResourceAllocator,
        performanceTracker: this.performanceTracker,
        logger: this.logger
      });

      this.optimizationController = new OptimizationController({
        optimizer: this.optimizer,
        logger: this.logger,
        metricsRegistry: this.metricsRegistry
      });

      this.logger.info('Core components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize components:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Body parsing and compression
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(compression());

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });

    // Metrics middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        this.requestCounter.inc({
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode.toString()
        });
      });
      
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this));
    
    // Metrics endpoint
    this.app.get('/metrics', this.handleMetrics.bind(this));
    
    // CDN Optimization endpoints
    this.app.post('/api/v1/optimize', this.handleOptimizeRequest.bind(this));
    this.app.get('/api/v1/performance', this.handlePerformanceMetrics.bind(this));
    this.app.post('/api/v1/route', this.handleRouteOptimization.bind(this));
    this.app.post('/api/v1/cache/placement', this.handleCachePlacement.bind(this));
    this.app.post('/api/v1/edge/allocate', this.handleEdgeAllocation.bind(this));
    
    // Configuration endpoints
    this.app.get('/api/v1/config', this.handleGetConfiguration.bind(this));
    this.app.post('/api/v1/config', this.handleUpdateConfiguration.bind(this));
    
    // Analytics endpoints
    this.app.get('/api/v1/analytics/latency', this.handleLatencyAnalytics.bind(this));
    this.app.get('/api/v1/analytics/cache', this.handleCacheAnalytics.bind(this));
    this.app.get('/api/v1/analytics/edge', this.handleEdgeAnalytics.bind(this));

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', error);
      
      const statusCode = (error as any).statusCode || 500;
      const message = this.config.environment === 'production' 
        ? 'Internal server error' 
        : error.message;

      res.status(statusCode).json({
        error: message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    });
  }

  /**
   * Health check handler
   */
  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health: ServiceHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
          redis: await this.checkRedisHealth(),
          supabase: await this.checkSupabaseHealth(),
          optimizer: this.optimizer.getHealthStatus()
        }
      };

      res.status(200).json(health);
    } catch (error) {
      this.logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Metrics handler
   */
  private async handleMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsRegistry.metrics();
      res.set('Content-Type', this.metricsRegistry.contentType);
      res.send(metrics);
    } catch (error) {
      this.logger.error('Failed to retrieve metrics:', error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  }

  /**
   * CDN optimization request handler
   */
  private async handleOptimizeRequest(req: Request, res: Response): Promise<void> {
    const timer = this.optimizationLatency.startTimer({ operation_type: 'full_optimization' });
    
    try {
      const optimizationRequest: OptimizationRequest = req.body;
      
      if (!this.validateOptimizationRequest(optimizationRequest)) {
        res.status(400).json({ error: 'Invalid optimization request' });
        return;
      }

      const result = await this.optimizer.optimize(optimizationRequest);
      
      res.status(200).json(result);
      this.logger.info('Optimization completed successfully', { requestId: req.headers['x-request-id'] });
    } catch (error) {
      this.logger.error('Optimization failed:', error);
      res.status(500).json({
        error: 'Optimization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      timer();
    }
  }

  /**
   * Performance metrics handler
   */
  private async handlePerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.performanceTracker.getCurrentMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      this.logger.error('Failed to retrieve performance metrics:', error);
      res.status(500).json({ error: 'Failed to retrieve performance metrics' });
    }
  }

  /**
   * Route optimization handler
   */
  private async handleRouteOptimization(req: Request, res: Response): Promise<void> {
    try {
      const { userLocation, contentType, priority } = req.body;
      const routeConfig = await this.geographicRouter.optimizeRoute(userLocation, contentType, priority);
      res.status(200).json(routeConfig);
    } catch (error) {
      this.logger.error('Route optimization failed:', error);
      res.status(500).json({ error: 'Route optimization failed' });
    }
  }

  /**
   * Cache placement handler
   */
  private async handleCachePlacement(req: Request, res: Response): Promise<void> {
    try {
      const { contentId, contentSize, accessPatterns } = req.body;
      const placement = await this.cachePlacementEngine.optimizePlacement(contentId, contentSize, accessPatterns);
      res.status(200).json(placement);
    } catch (error) {
      this.logger.error('Cache placement optimization failed:', error);
      res.status(500).json({ error: 'Cache placement optimization failed' });
    }
  }

  /**
   * Edge resource allocation handler
   */
  private async handleEdgeAllocation(req: Request, res: Response): Promise<void> {
    try {
      const { workloadType, requirements, constraints } = req.body;
      const allocation = await this.edgeResourceAllocator.allocateResources(workloadType, requirements, constraints);
      res.status(200).json(allocation);
    } catch (error) {
      this.logger.error('Edge resource allocation failed:', error);
      res.status(500).json({ error: 'Edge resource allocation failed' });
    }
  }

  /**
   * Configuration handlers
   */
  private async handleGetConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.optimizer.getConfiguration();
      res.status(200).json(config);
    } catch (error) {
      this.logger.error('Failed to retrieve configuration:', error);
      res.status(500).json({ error: 'Failed to retrieve configuration' });
    }
  }

  private async handleUpdateConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const newConfig: CDNConfig = req.body;
      await this.optimizer.updateConfiguration(newConfig);
      res.status(200).json({ message: 'Configuration updated successfully' });
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  /**
   * Analytics handlers
   */
  private async handleLatencyAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange, regions } = req.query;
      const analytics = await this.performanceTracker.getLatencyAnalytics(timeRange as string, regions as string[]);
      res.status(200).json(analytics);
    } catch (error) {
      this.logger.error('Failed to retrieve latency analytics:', error);
      res.status(500).json({ error: 'Failed to retrieve latency analytics' });
    }
  }

  private async handleCacheAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange } = req.query;
      const analytics = await this.cachePlacementEngine.getAnalytics(timeRange as string);
      res.status(200).json(analytics);
    } catch (error) {
      this.logger.error('Failed to retrieve cache analytics:', error);
      res.status(500).json({ error: 'Failed to retrieve cache analytics' });
    }
  }

  private async handleEdgeAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange, locations } = req.query;
      const analytics = await this.edgeResourceAllocator.getAnalytics(timeRange as string, locations as string[]);
      res.status(200).json(analytics);
    } catch (error) {
      this.logger.error('Failed to retrieve edge analytics:', error);
      res.status(500).json({ error: 'Failed to retrieve edge analytics' });
    }
  }

  /**
   * Validation helpers
   */
  private validateOptimizationRequest(request: OptimizationRequest): boolean {
    return !!(
      request &&
      request.contentId &&
      request.userLocation &&
      request.contentType &&
      typeof request.priority === 'number'
    );
  }

  /**
   * Health check helpers
   */
  private async checkRedisHealth(): Promise<string> {
    try {
      await this.redis.ping();
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  private async checkSupabaseHealth(): Promise<string> {
    try {
      const { data, error } = await this.supabase.from('health_check').select('*').limit(1);
      return error ? 'unhealthy' : 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      await this.initializeConnections();
      
      // Start background optimization tasks
      this.startBackgroundTasks();
      
      // Start HTTP server
      const server = this.app.listen(this.config.port, () => {
        this.logger.info(`CDN Optimization Service started on port ${this.config.port}`);
        this.logger.info(`Environment: ${this.config.environment}`);
        this.logger.info('Service is ready to handle requests');
      });

      // Start metrics server
      const metricsApp = express();
      metricsApp.get('/metrics', this.handleMetrics.bind(this));
      metricsApp.listen(this.config.monitoring.metricsPort, () => {
        this.logger.info(`Metrics server started on port ${this.config.monitoring.metricsPort}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown(server));
      process.on('SIGINT', () => this.gracefulShutdown(server));
    } catch (error) {
      this.logger.error('Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Start background optimization tasks
   */
  private startBackgroundTasks(): void {
    // Performance monitoring task (every 30 seconds)
    setInterval(async () => {
      try {
        await this.performanceTracker.collectMetrics();
      } catch (error) {
        this.logger.error('Performance monitoring task failed:', error);
      }
    }, 30000);

    // Cache optimization task (every 5 minutes)
    setInterval(async () => {
      try {
        await this.cachePlacementEngine.optimizeGlobal();
      } catch (error) {
        this.logger.error('Cache optimization task failed:', error);
      }
    }, 300000);

    // Edge resource rebalancing task (every 10 minutes)
    setInterval(async () => {
      try {
        await this.edgeResourceAllocator.rebalanceResources();
      } catch (error) {
        this.logger.error('Edge resource rebalancing task failed:', error);
      }
    }, 600000);

    this.logger.info('Background