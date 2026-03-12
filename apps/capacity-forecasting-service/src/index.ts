```typescript
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import * as tf from '@tensorflow/tfjs-node';
import { createPrometheusMetrics } from 'prom-client';
import { KubeConfig, AppsV1Api } from '@kubernetes/client-node';

import { ForecastController } from './controllers/ForecastController';
import { TimeSeriesAnalyzer } from './services/TimeSeriesAnalyzer';
import { MLPredictor } from './services/MLPredictor';
import { ResourceProvisioner } from './services/ResourceProvisioner';
import { MetricsCollector } from './services/MetricsCollector';
import { ValidationMiddleware } from './middleware/ValidationMiddleware';
import { DatabaseConfig } from './config/database';
import { ForecastConfig, ServiceHealth } from './types/forecast.types';
import { logger } from './utils/logger';

/**
 * Main capacity forecasting service application
 * Provides ML-powered capacity prediction and automated resource provisioning
 */
export class CapacityForecastingService {
  private app: Application;
  private supabase: ReturnType<typeof createClient>;
  private redis: Redis;
  private kubeConfig: KubeConfig;
  private k8sApi: AppsV1Api;
  
  // Core services
  private timeSeriesAnalyzer: TimeSeriesAnalyzer;
  private mlPredictor: MLPredictor;
  private resourceProvisioner: ResourceProvisioner;
  private metricsCollector: MetricsCollector;
  private forecastController: ForecastController;
  
  // Configuration
  private config: ForecastConfig;
  private port: number;
  private isHealthy: boolean = false;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.config = this.loadConfiguration();
    
    this.initializeClients();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Load service configuration from environment variables
   */
  private loadConfiguration(): ForecastConfig {
    return {
      database: {
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
      },
      ml: {
        modelPath: process.env.ML_MODEL_PATH || './models/capacity-forecaster',
        trainingInterval: parseInt(process.env.TRAINING_INTERVAL || '86400', 10), // 24 hours
        predictionHorizon: parseInt(process.env.PREDICTION_HORIZON || '3600', 10), // 1 hour
        minTrainingData: parseInt(process.env.MIN_TRAINING_DATA || '168', 10) // 1 week of hourly data
      },
      forecasting: {
        forecastWindow: parseInt(process.env.FORECAST_WINDOW || '7200', 10), // 2 hours
        thresholds: {
          cpu: parseFloat(process.env.CPU_THRESHOLD || '0.8'),
          memory: parseFloat(process.env.MEMORY_THRESHOLD || '0.85'),
          storage: parseFloat(process.env.STORAGE_THRESHOLD || '0.9')
        },
        scalingFactors: {
          cpu: parseFloat(process.env.CPU_SCALING_FACTOR || '1.5'),
          memory: parseFloat(process.env.MEMORY_SCALING_FACTOR || '1.3'),
          storage: parseFloat(process.env.STORAGE_SCALING_FACTOR || '1.2')
        }
      },
      kubernetes: {
        namespace: process.env.K8S_NAMESPACE || 'default',
        maxReplicas: parseInt(process.env.MAX_REPLICAS || '20', 10),
        minReplicas: parseInt(process.env.MIN_REPLICAS || '1', 10)
      }
    };
  }

  /**
   * Initialize external clients (Supabase, Redis, Kubernetes)
   */
  private async initializeClients(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabase = createClient(
        this.config.database.supabaseUrl,
        this.config.database.supabaseKey,
        {
          auth: { persistSession: false },
          db: { schema: 'capacity_forecasting' }
        }
      );

      // Initialize Redis client
      this.redis = new Redis(this.config.database.redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      // Initialize Kubernetes client
      this.kubeConfig = new KubeConfig();
      
      if (process.env.NODE_ENV === 'production') {
        this.kubeConfig.loadFromCluster();
      } else {
        this.kubeConfig.loadFromDefault();
      }
      
      this.k8sApi = this.kubeConfig.makeApiClient(AppsV1Api);

      // Test connections
      await this.redis.ping();
      await this.supabase.from('metrics').select('count').limit(1);

      logger.info('External clients initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize clients:', error);
      throw new Error('Client initialization failed');
    }
  }

  /**
   * Initialize core services
   */
  private initializeServices(): void {
    try {
      // Initialize database configuration
      const dbConfig = new DatabaseConfig(this.supabase, this.redis);
      
      // Initialize core services
      this.timeSeriesAnalyzer = new TimeSeriesAnalyzer(this.config, this.redis);
      this.mlPredictor = new MLPredictor(this.config, this.supabase);
      this.resourceProvisioner = new ResourceProvisioner(
        this.config,
        this.k8sApi,
        this.supabase
      );
      this.metricsCollector = new MetricsCollector(
        this.config,
        this.supabase,
        this.redis
      );
      
      // Initialize controller
      this.forecastController = new ForecastController(
        this.timeSeriesAnalyzer,
        this.mlPredictor,
        this.resourceProvisioner,
        this.metricsCollector
      );

      logger.info('Core services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw new Error('Service initialization failed');
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Performance middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
      next();
    });

    // Validation middleware
    this.app.use('/api/v1', ValidationMiddleware.validateRequest);
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this));
    
    // Metrics endpoint for Prometheus
    this.app.get('/metrics', this.handleMetrics.bind(this));
    
    // API routes
    this.app.use('/api/v1/forecast', this.forecastController.getRouter());
    
    // Webhook endpoints for external triggers
    this.app.post('/webhooks/metrics', this.handleMetricsWebhook.bind(this));
    this.app.post('/webhooks/scaling', this.handleScalingWebhook.bind(this));
    
    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        service: 'CR AudioViz AI - Capacity Forecasting Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'operational',
        endpoints: {
          health: '/health',
          metrics: '/metrics',
          forecast: '/api/v1/forecast',
          webhooks: {
            metrics: '/webhooks/metrics',
            scaling: '/webhooks/scaling'
          }
        }
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID')
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
      logger.error('Unhandled promise rejection:', { reason, promise });
      this.gracefulShutdown('SIGTERM');
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
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: await this.checkDatabaseHealth(),
          redis: await this.checkRedisHealth(),
          kubernetes: await this.checkKubernetesHealth(),
          mlModel: await this.checkMLModelHealth()
        }
      };

      const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
      health.status = isHealthy ? 'healthy' : 'unhealthy';

      res.status(isHealthy ? 200 : 503).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle Prometheus metrics requests
   */
  private async handleMetrics(req: express.Request, res: express.Response): Promise<void> {
    try {
      const metrics = await this.metricsCollector.getPrometheusMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      res.status(500).send('# Failed to collect metrics\n');
    }
  }

  /**
   * Handle incoming metrics webhook
   */
  private async handleMetricsWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { metrics, timestamp, source } = req.body;
      
      await this.metricsCollector.ingestMetrics(metrics, {
        timestamp: timestamp || new Date().toISOString(),
        source: source || 'webhook'
      });
      
      res.status(200).json({ 
        status: 'success', 
        processed: metrics.length 
      });
    } catch (error) {
      logger.error('Metrics webhook failed:', error);
      res.status(500).json({ 
        error: 'Failed to process metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle scaling webhook
   */
  private async handleScalingWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { action, resource, parameters } = req.body;
      
      const result = await this.resourceProvisioner.executeScalingAction(
        action,
        resource,
        parameters
      );
      
      res.status(200).json({
        status: 'success',
        result
      });
    } catch (error) {
      logger.error('Scaling webhook failed:', error);
      res.status(500).json({
        error: 'Failed to execute scaling action',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<{ status: string; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.supabase.from('metrics').select('count').limit(1);
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<{ status: string; latency?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check Kubernetes API health
   */
  private async checkKubernetesHealth(): Promise<{ status: string; error?: string }> {
    try {
      await this.k8sApi.listNamespacedDeployment(this.config.kubernetes.namespace);
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check ML model health
   */
  private async checkMLModelHealth(): Promise<{ status: string; error?: string }> {
    try {
      const isModelReady = await this.mlPredictor.isModelReady();
      return { 
        status: isModelReady ? 'healthy' : 'initializing'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start the forecasting service
   */
  public async start(): Promise<void> {
    try {
      // Start background services
      await this.startBackgroundServices();
      
      // Start HTTP server
      const server = this.app.listen(this.port, '0.0.0.0', () => {
        logger.info(`Capacity Forecasting Service started on port ${this.port}`);
        this.isHealthy = true;
      });

      // Graceful shutdown handling
      const shutdown = (signal: string) => {
        logger.info(`Received ${signal}, initiating graceful shutdown`);
        server.close(() => {
          this.gracefulShutdown(signal);
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
      logger.error('Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Start background services
   */
  private async startBackgroundServices(): Promise<void> {
    try {
      // Initialize ML model
      await this.mlPredictor.initializeModel();
      
      // Start metrics collection
      await this.metricsCollector.startCollection();
      
      // Start forecast generation
      await this.startForecastLoop();
      
      logger.info('Background services started successfully');
    } catch (error) {
      logger.error('Failed to start background services:', error);
      throw error;
    }
  }

  /**
   * Start the main forecasting loop
   */
  private async startForecastLoop(): Promise<void> {
    const forecastInterval = this.config.ml.predictionHorizon * 1000; // Convert to milliseconds
    
    const runForecast = async () => {
      try {
        logger.info('Running capacity forecast cycle');
        
        // Generate forecasts for all monitored resources
        const forecasts = await this.forecastController.generateForecasts();
        
        // Process provisioning recommendations
        for (const forecast of forecasts) {
          if (forecast.recommendedAction !== 'none') {
            await this.resourceProvisioner.processRecommendation(forecast);
          }
        }
        
        logger.info(`Forecast cycle completed, processed ${forecasts.length} forecasts`);
      } catch (error) {
        logger.error('Forecast cycle failed:', error);
      }
    };

    // Run initial forecast
    await runForecast();
    
    // Schedule recurring forecasts
    setInterval(runForecast, forecastInterval);
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Graceful shutdown initiated by ${signal}`);
    this.isHealthy = false;

    try {
      // Stop accepting new requests
      logger.info('Stopping background services...');
      
      // Stop metrics collection
      await this.metricsCollector.stopCollection();
      
      // Close database connections
      await this.redis.disconnect();
      
      // Save any pending ML model state
      await this.mlPredictor.saveModelState();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get service configuration
   */
  public getConfig(): ForecastConfig {
    return { ...this.config };
  }

  /**
   * Check if service is healthy
   */
  public isServiceHealthy(): boolean {
    return this.isHealthy;
  }
}

// Create and export service instance
const service = new CapacityForecastingService();

// Start service if this file is run directly
if (require.main === module) {
  service.start().catch((error) => {
    logger.error('Failed to start Capacity Forecasting Service:', error);
    process.exit(1);
  });
}

export default service;
export { CapacityForecastingService };
```