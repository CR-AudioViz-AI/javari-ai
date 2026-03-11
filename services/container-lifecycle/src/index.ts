```typescript
/**
 * @fileoverview Container Lifecycle Management Microservice
 * @description Main entry point for the container lifecycle management microservice
 * that handles automated updates, health checks, resource optimization, and security scanning.
 * @version 1.0.0
 * @author CR AudioViz AI
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { register } from 'prom-client';
import { createLogger, transports, format } from 'winston';
import { LifecycleController } from './controllers/LifecycleController';
import { ContainerManager } from './services/ContainerManager';
import { HealthMonitor } from './services/HealthMonitor';
import { ResourceOptimizer } from './services/ResourceOptimizer';
import { SecurityScanner } from './services/SecurityScanner';
import { UpdateManager } from './services/UpdateManager';
import { AuthMiddleware } from './middleware/AuthMiddleware';
import { DockerClient } from './utils/DockerClient';
import { MetricsCollector } from './utils/MetricsCollector';

/**
 * Service configuration interface
 */
interface ServiceConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  database: {
    supabaseUrl: string;
    supabaseKey: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  docker: {
    socketPath: string;
    apiVersion: string;
  };
  security: {
    trivyPath: string;
    scanInterval: number;
  };
  monitoring: {
    metricsPort: number;
    healthCheckInterval: number;
  };
}

/**
 * Main Container Lifecycle Management Service
 */
export class ContainerLifecycleService {
  private app: Application;
  private config: ServiceConfig;
  private supabase: any;
  private redis: Redis;
  private kafka: Kafka;
  private kafkaProducer: Producer;
  private kafkaConsumer: Consumer;
  private dockerClient: DockerClient;
  private containerManager: ContainerManager;
  private healthMonitor: HealthMonitor;
  private resourceOptimizer: ResourceOptimizer;
  private securityScanner: SecurityScanner;
  private updateManager: UpdateManager;
  private metricsCollector: MetricsCollector;
  private lifecycleController: LifecycleController;
  private authMiddleware: AuthMiddleware;
  private logger: any;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.config = this.loadConfiguration();
    this.logger = this.setupLogger();
    this.initializeComponents();
  }

  /**
   * Load service configuration from environment variables
   */
  private loadConfiguration(): ServiceConfig {
    return {
      port: parseInt(process.env.PORT || '3000', 10),
      environment: (process.env.NODE_ENV as any) || 'development',
      database: {
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_ANON_KEY || '',
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: process.env.KAFKA_CLIENT_ID || 'container-lifecycle-service',
        groupId: process.env.KAFKA_GROUP_ID || 'container-lifecycle-group',
      },
      docker: {
        socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
        apiVersion: process.env.DOCKER_API_VERSION || 'v1.41',
      },
      security: {
        trivyPath: process.env.TRIVY_PATH || '/usr/local/bin/trivy',
        scanInterval: parseInt(process.env.SECURITY_SCAN_INTERVAL || '3600000', 10), // 1 hour
      },
      monitoring: {
        metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
      },
    };
  }

  /**
   * Setup Winston logger
   */
  private setupLogger() {
    return createLogger({
      level: this.config.environment === 'production' ? 'info' : 'debug',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/combined.log' }),
      ],
    });
  }

  /**
   * Initialize all service components
   */
  private async initializeComponents(): Promise<void> {
    try {
      // Initialize database connection
      this.supabase = createClient(
        this.config.database.supabaseUrl,
        this.config.database.supabaseKey
      );

      // Initialize Redis connection
      this.redis = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // Initialize Kafka
      this.kafka = new Kafka({
        clientId: this.config.kafka.clientId,
        brokers: this.config.kafka.brokers,
      });

      this.kafkaProducer = this.kafka.producer();
      this.kafkaConsumer = this.kafka.consumer({ 
        groupId: this.config.kafka.groupId 
      });

      // Initialize Docker client
      this.dockerClient = new DockerClient({
        socketPath: this.config.docker.socketPath,
        version: this.config.docker.apiVersion,
      });

      // Initialize metrics collector
      this.metricsCollector = new MetricsCollector();

      // Initialize core services
      this.containerManager = new ContainerManager(
        this.dockerClient,
        this.supabase,
        this.redis,
        this.kafkaProducer,
        this.logger
      );

      this.healthMonitor = new HealthMonitor(
        this.dockerClient,
        this.redis,
        this.metricsCollector,
        this.config.monitoring.healthCheckInterval,
        this.logger
      );

      this.resourceOptimizer = new ResourceOptimizer(
        this.dockerClient,
        this.metricsCollector,
        this.redis,
        this.logger
      );

      this.securityScanner = new SecurityScanner(
        this.dockerClient,
        this.config.security.trivyPath,
        this.supabase,
        this.kafkaProducer,
        this.logger
      );

      this.updateManager = new UpdateManager(
        this.dockerClient,
        this.containerManager,
        this.healthMonitor,
        this.kafkaProducer,
        this.redis,
        this.logger
      );

      // Initialize middleware and controller
      this.authMiddleware = new AuthMiddleware(this.supabase, this.redis);

      this.lifecycleController = new LifecycleController(
        this.containerManager,
        this.healthMonitor,
        this.resourceOptimizer,
        this.securityScanner,
        this.updateManager,
        this.logger
      );

      this.logger.info('All service components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize service components:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
    });
    this.app.use('/api', limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });

    // Authentication middleware
    this.app.use('/api', this.authMiddleware.authenticate.bind(this.authMiddleware));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: this.config.environment,
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    });

    // Container lifecycle management routes
    this.app.use('/api/v1/containers', this.lifecycleController.getRouter());

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: this.config.environment === 'development' ? error.message : 'Something went wrong',
        requestId: req.headers['x-request-id'],
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.originalUrl,
      });
    });
  }

  /**
   * Setup Kafka event consumers
   */
  private async setupEventConsumers(): Promise<void> {
    await this.kafkaConsumer.subscribe({
      topics: [
        'container-events',
        'security-alerts',
        'resource-alerts',
        'update-requests',
      ],
    });

    await this.kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value?.toString() || '{}');
          
          switch (topic) {
            case 'container-events':
              await this.handleContainerEvent(data);
              break;
            case 'security-alerts':
              await this.handleSecurityAlert(data);
              break;
            case 'resource-alerts':
              await this.handleResourceAlert(data);
              break;
            case 'update-requests':
              await this.handleUpdateRequest(data);
              break;
          }
        } catch (error) {
          this.logger.error(`Error processing message from topic ${topic}:`, error);
        }
      },
    });
  }

  /**
   * Handle container events
   */
  private async handleContainerEvent(data: any): Promise<void> {
    await this.containerManager.handleEvent(data);
  }

  /**
   * Handle security alerts
   */
  private async handleSecurityAlert(data: any): Promise<void> {
    await this.securityScanner.handleAlert(data);
  }

  /**
   * Handle resource alerts
   */
  private async handleResourceAlert(data: any): Promise<void> {
    await this.resourceOptimizer.handleAlert(data);
  }

  /**
   * Handle update requests
   */
  private async handleUpdateRequest(data: any): Promise<void> {
    await this.updateManager.handleUpdateRequest(data);
  }

  /**
   * Start background services
   */
  private async startBackgroundServices(): Promise<void> {
    // Start health monitoring
    await this.healthMonitor.start();

    // Start resource optimization
    await this.resourceOptimizer.start();

    // Start security scanning
    await this.securityScanner.start();

    // Start update management
    await this.updateManager.start();

    this.logger.info('All background services started');
  }

  /**
   * Setup graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      this.logger.info(`Received ${signal}, starting graceful shutdown`);
      this.isShuttingDown = true;

      try {
        // Stop accepting new connections
        const server = this.app.listen();
        server.close();

        // Stop background services
        await Promise.all([
          this.healthMonitor.stop(),
          this.resourceOptimizer.stop(),
          this.securityScanner.stop(),
          this.updateManager.stop(),
        ]);

        // Close external connections
        await Promise.all([
          this.kafkaProducer.disconnect(),
          this.kafkaConsumer.disconnect(),
          this.redis.disconnect(),
        ]);

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Container Lifecycle Management Service');

      // Setup middleware and routes
      this.setupMiddleware();
      this.setupRoutes();

      // Connect to external services
      await this.kafkaProducer.connect();
      await this.kafkaConsumer.connect();
      await this.setupEventConsumers();

      // Start background services
      await this.startBackgroundServices();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Start HTTP server
      this.app.listen(this.config.port, () => {
        this.logger.info(`Service listening on port ${this.config.port}`);
        this.logger.info(`Environment: ${this.config.environment}`);
        this.logger.info(`Metrics available on port ${this.config.monitoring.metricsPort}`);
      });

      // Start metrics server
      const metricsApp = express();
      metricsApp.get('/metrics', async (req: Request, res: Response) => {
        try {
          res.set('Content-Type', register.contentType);
          res.end(await register.metrics());
        } catch (error) {
          res.status(500).json({ error: 'Failed to generate metrics' });
        }
      });
      
      metricsApp.listen(this.config.monitoring.metricsPort, () => {
        this.logger.info(`Metrics server listening on port ${this.config.monitoring.metricsPort}`);
      });

    } catch (error) {
      this.logger.error('Failed to start service:', error);
      throw error;
    }
  }
}

/**
 * Service factory function
 */
export function createContainerLifecycleService(): ContainerLifecycleService {
  return new ContainerLifecycleService();
}

/**
 * Main entry point
 */
if (require.main === module) {
  const service = createContainerLifecycleService();
  
  service.start().catch((error) => {
    console.error('Failed to start Container Lifecycle Service:', error);
    process.exit(1);
  });
}

export default ContainerLifecycleService;
```