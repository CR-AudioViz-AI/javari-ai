```typescript
/**
 * Key Management Service - Main Entry Point
 * 
 * A highly secure microservice for managing encryption keys, certificates, and secrets
 * with hardware security module integration and automatic key rotation.
 * 
 * @fileoverview Main application entry point for CR AudioViz Key Management Service
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';
import { Server } from 'http';
import { promisify } from 'util';
import cluster from 'cluster';
import os from 'os';

// Internal imports
import { KeyController } from './controllers/KeyController';
import { CertificateController } from './controllers/CertificateController';
import { SecretController } from './controllers/SecretController';
import { HSMService } from './services/HSMService';
import { KeyRotationService } from './services/KeyRotationService';
import { EncryptionService } from './services/EncryptionService';
import { AuthMiddleware } from './middleware/AuthMiddleware';
import { RateLimitMiddleware } from './middleware/RateLimitMiddleware';
import { HSMConfig } from './config/hsm.config';
import { CryptoUtils } from './utils/CryptoUtils';

/**
 * Application configuration interface
 */
interface AppConfig {
  port: number;
  nodeEnv: string;
  serviceName: string;
  version: string;
  supabaseUrl: string;
  supabaseKey: string;
  hsmConfig: HSMConfig;
  logLevel: string;
  enableClustering: boolean;
  healthCheckInterval: number;
  keyRotationInterval: number;
}

/**
 * Health check response interface
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    hsm: 'connected' | 'disconnected' | 'error';
    database: 'connected' | 'disconnected' | 'error';
    keyRotation: 'active' | 'inactive' | 'error';
  };
  metrics: {
    totalKeys: number;
    activeCertificates: number;
    secretsCount: number;
    lastRotation: string | null;
  };
}

/**
 * Main Key Management Service Application Class
 */
class KeyManagementService {
  private app: Application;
  private server: Server | null = null;
  private config: AppConfig;
  private logger: winston.Logger;
  private supabaseClient: any;
  private hsmService: HSMService;
  private keyRotationService: KeyRotationService;
  private encryptionService: EncryptionService;
  private keyController: KeyController;
  private certificateController: CertificateController;
  private secretController: SecretController;
  private authMiddleware: AuthMiddleware;
  private rateLimitMiddleware: RateLimitMiddleware;
  private startTime: Date;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = new Date();
    this.config = this.loadConfiguration();
    this.logger = this.initializeLogger();
    this.app = express();
    
    // Initialize core services
    this.initializeServices();
  }

  /**
   * Load application configuration from environment variables
   */
  private loadConfiguration(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      serviceName: process.env.SERVICE_NAME || 'key-management-service',
      version: process.env.SERVICE_VERSION || '1.0.0',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_ANON_KEY || '',
      hsmConfig: {
        provider: process.env.HSM_PROVIDER as 'aws' | 'azure' | 'mock' || 'mock',
        endpoint: process.env.HSM_ENDPOINT || '',
        credentials: {
          accessKeyId: process.env.HSM_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.HSM_SECRET_ACCESS_KEY || '',
          region: process.env.HSM_REGION || 'us-east-1'
        },
        clusterId: process.env.HSM_CLUSTER_ID || '',
        keySpecification: process.env.HSM_KEY_SPEC || 'AES_256',
        enableAuditLogging: process.env.HSM_AUDIT_LOGGING === 'true'
      },
      logLevel: process.env.LOG_LEVEL || 'info',
      enableClustering: process.env.ENABLE_CLUSTERING === 'true',
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
      keyRotationInterval: parseInt(process.env.KEY_ROTATION_INTERVAL || '86400000', 10) // 24 hours
    };
  }

  /**
   * Initialize Winston logger with structured logging
   */
  private initializeLogger(): winston.Logger {
    return winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            service: this.config.serviceName,
            version: this.config.version,
            message,
            ...meta
          });
        })
      ),
      defaultMeta: {
        service: this.config.serviceName,
        version: this.config.version
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    });
  }

  /**
   * Initialize all core services
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabaseClient = createClient(
        this.config.supabaseUrl,
        this.config.supabaseKey
      );

      // Initialize HSM Service
      this.hsmService = new HSMService(this.config.hsmConfig, this.logger);
      await this.hsmService.initialize();

      // Initialize Encryption Service
      this.encryptionService = new EncryptionService(this.hsmService, this.logger);
      await this.encryptionService.initialize();

      // Initialize Key Rotation Service
      this.keyRotationService = new KeyRotationService(
        this.hsmService,
        this.encryptionService,
        this.supabaseClient,
        this.logger
      );

      // Initialize Middleware
      this.authMiddleware = new AuthMiddleware(this.supabaseClient, this.logger);
      this.rateLimitMiddleware = new RateLimitMiddleware(this.logger);

      // Initialize Controllers
      this.keyController = new KeyController(
        this.hsmService,
        this.encryptionService,
        this.supabaseClient,
        this.logger
      );
      this.certificateController = new CertificateController(
        this.hsmService,
        this.supabaseClient,
        this.logger
      );
      this.secretController = new SecretController(
        this.encryptionService,
        this.supabaseClient,
        this.logger
      );

      this.logger.info('All services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services', { error: error.message });
      throw error;
    }
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('HTTP Request', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      next();
    });
  }

  /**
   * Configure application routes
   */
  private configureRoutes(): void {
    // Health check endpoints
    this.app.get('/health', this.handleHealthCheck.bind(this));
    this.app.get('/health/live', this.handleLivenessProbe.bind(this));
    this.app.get('/health/ready', this.handleReadinessProbe.bind(this));

    // API versioning
    const apiV1 = express.Router();
    
    // Authentication middleware for protected routes
    apiV1.use(this.authMiddleware.authenticate.bind(this.authMiddleware));
    apiV1.use(this.rateLimitMiddleware.apply.bind(this.rateLimitMiddleware));

    // Key management routes
    apiV1.use('/keys', this.keyController.getRouter());
    apiV1.use('/certificates', this.certificateController.getRouter());
    apiV1.use('/secrets', this.secretController.getRouter());

    this.app.use('/api/v1', apiV1);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        service: this.config.serviceName,
        version: this.config.version,
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: '/api/v1'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Configure global error handling
   */
  private configureErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      const statusCode = (error as any).statusCode || 500;
      const message = this.config.nodeEnv === 'production' 
        ? 'Internal Server Error' 
        : error.message;

      res.status(statusCode).json({
        error: 'Internal Server Error',
        message,
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID')
      });
    });
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus: HealthCheckResponse = await this.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  /**
   * Handle liveness probe
   */
  private handleLivenessProbe(req: Request, res: Response): void {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime.getTime()
    });
  }

  /**
   * Handle readiness probe
   */
  private async handleReadinessProbe(req: Request, res: Response): Promise<void> {
    try {
      const isReady = await this.checkReadiness();
      if (isReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  /**
   * Get comprehensive health status
   */
  private async getHealthStatus(): Promise<HealthCheckResponse> {
    const [hsmStatus, dbStatus, keyRotationStatus, metrics] = await Promise.allSettled([
      this.checkHSMStatus(),
      this.checkDatabaseStatus(),
      this.checkKeyRotationStatus(),
      this.getServiceMetrics()
    ]);

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (hsmStatus.status === 'rejected' || dbStatus.status === 'rejected') {
      overallStatus = 'unhealthy';
    } else if (keyRotationStatus.status === 'rejected') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.config.version,
      uptime: Date.now() - this.startTime.getTime(),
      services: {
        hsm: hsmStatus.status === 'fulfilled' ? hsmStatus.value : 'error',
        database: dbStatus.status === 'fulfilled' ? dbStatus.value : 'error',
        keyRotation: keyRotationStatus.status === 'fulfilled' ? keyRotationStatus.value : 'error'
      },
      metrics: metrics.status === 'fulfilled' ? metrics.value : {
        totalKeys: 0,
        activeCertificates: 0,
        secretsCount: 0,
        lastRotation: null
      }
    };
  }

  /**
   * Check HSM service status
   */
  private async checkHSMStatus(): Promise<'connected' | 'disconnected' | 'error'> {
    try {
      await this.hsmService.healthCheck();
      return 'connected';
    } catch (error) {
      return 'error';
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseStatus(): Promise<'connected' | 'disconnected' | 'error'> {
    try {
      const { data, error } = await this.supabaseClient
        .from('service_health')
        .select('id')
        .limit(1);
      
      if (error) throw error;
      return 'connected';
    } catch (error) {
      return 'error';
    }
  }

  /**
   * Check key rotation service status
   */
  private async checkKeyRotationStatus(): Promise<'active' | 'inactive' | 'error'> {
    try {
      return await this.keyRotationService.getStatus();
    } catch (error) {
      return 'error';
    }
  }

  /**
   * Get service metrics
   */
  private async getServiceMetrics(): Promise<{
    totalKeys: number;
    activeCertificates: number;
    secretsCount: number;
    lastRotation: string | null;
  }> {
    try {
      const [keysResult, certsResult, secretsResult, rotationResult] = await Promise.all([
        this.supabaseClient.from('encryption_keys').select('id', { count: 'exact', head: true }),
        this.supabaseClient.from('certificates').select('id', { count: 'exact', head: true }),
        this.supabaseClient.from('secrets').select('id', { count: 'exact', head: true }),
        this.supabaseClient
          .from('key_rotations')
          .select('rotated_at')
          .order('rotated_at', { ascending: false })
          .limit(1)
          .single()
      ]);

      return {
        totalKeys: keysResult.count || 0,
        activeCertificates: certsResult.count || 0,
        secretsCount: secretsResult.count || 0,
        lastRotation: rotationResult.data?.rotated_at || null
      };
    } catch (error) {
      throw new Error(`Failed to retrieve service metrics: ${error.message}`);
    }
  }

  /**
   * Check if service is ready to handle requests
   */
  private async checkReadiness(): Promise<boolean> {
    try {
      await Promise.all([
        this.hsmService.healthCheck(),
        this.checkDatabaseStatus()
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        this.logger.info('Health check completed', { status: health.status });
        
        if (health.status === 'unhealthy') {
          this.logger.error('Service is unhealthy', { health });
        }
      } catch (error) {
        this.logger.error('Health monitoring failed', { error: error.message });
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Start the key rotation scheduler
   */
  private startKeyRotationScheduler(): void {
    setInterval(async () => {
      try {
        await this.keyRotationService.performScheduledRotations();
        this.logger.info('Scheduled key rotations completed');
      } catch (error) {
        this.logger.error('Key rotation scheduler failed', { error: error.message });
      }
    }, this.config.keyRotationInterval);
  }

  /**
   * Graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully`);
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      if (this.server) {
        const serverClose = promisify(this.server.close.bind(this.server));
        await serverClose();
      }

      // Clean up services
      await Promise.all([
        this.hsmService?.cleanup?.(),
        this.keyRotationService?.cleanup?.(),
        this.encryptionService?.cleanup?.()
      ]);

      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Start the application server
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Key Management Service', {
        version: this.config.version,
        nodeEnv: this.config.nodeEnv,
        port: this.config.port
      });

      // Configure application
      this.configureMiddleware();
      this.configureRoutes();
      this.configureErrorHandling();

      // Start server
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`Server listening on port ${this.config.port}`);
      });

      // Start background services
      this.startHealthMonitoring();
      this.startKeyRotationScheduler();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.logger.info('Key Management Service started successfully');
    } catch (error) {
      this.logger.error('Failed to start service', { error: error.message });
      throw error;
    }
  }

  /**
   * Get the Express application instance
   */
  public getApp(): Application {
    return this.app;
  }
}

/**
 * Application entry point
 */
async function main(): Promise<void> {
  try {
    // Enable clustering in production
    const enableClustering = process.env.ENABLE_CLUSTERING === 'true';
    const numCPUs = os.cpus().length;

    if (enableClustering && cluster.isPrimary && process.env.NODE_ENV === 'production') {
      console.log(`Primary ${process.pid} is running`);
      
      // Fork workers
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Restart worker
      });
    } else {
      // Worker process or single instance
      const service = new KeyManagementService();
      await service.start();
    }
  } catch (error) {
    console.error('Failed to start Key Management Service:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main ===