```typescript
/**
 * CR AudioViz AI - Advanced Encryption Management Microservice
 * 
 * Enterprise-grade encryption service providing HSM integration, key lifecycle management,
 * certificate management, cryptographic operations, automated key rotation, and compliance reporting.
 * 
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import winston from 'winston';
import { config } from 'dotenv';
import cluster from 'cluster';
import os from 'os';

// Import controllers
import { KeyManagementController } from './controllers/KeyManagementController';
import { CertificateController } from './controllers/CertificateController';
import { CryptoOperationsController } from './controllers/CryptoOperationsController';
import { ComplianceController } from './controllers/ComplianceController';

// Import services
import { HSMService } from './services/HSMService';
import { KeyRotationService } from './services/KeyRotationService';
import { CertificateAuthorityService } from './services/CertificateAuthorityService';
import { EncryptionService } from './services/EncryptionService';
import { AuditService } from './services/AuditService';

// Import middleware
import { SecurityMiddleware } from './middleware/SecurityMiddleware';
import { RateLimitingMiddleware } from './middleware/RateLimitingMiddleware';

// Import utilities
import { HSMConnector } from './utils/HSMConnector';
import { DatabaseConnector } from './utils/DatabaseConnector';
import { MetricsCollector } from './utils/MetricsCollector';

// Load environment variables
config();

/**
 * Application configuration interface
 */
interface AppConfig {
  port: number;
  nodeEnv: string;
  hsmConfig: HSMConfig;
  database: DatabaseConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

/**
 * HSM configuration interface
 */
interface HSMConfig {
  provider: string;
  endpoint: string;
  partition: string;
  username: string;
  password: string;
  timeout: number;
}

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
}

/**
 * Security configuration interface
 */
interface SecurityConfig {
  jwtSecret: string;
  encryptionAlgorithm: string;
  keySize: number;
  sessionTimeout: number;
  maxLoginAttempts: number;
}

/**
 * Monitoring configuration interface
 */
interface MonitoringConfig {
  metricsEnabled: boolean;
  logLevel: string;
  auditEnabled: boolean;
  alertingEnabled: boolean;
}

/**
 * Main encryption service application class
 */
class EncryptionServiceApp {
  private readonly app: Application;
  private readonly server: any;
  private readonly io: SocketIOServer;
  private readonly logger: winston.Logger;
  private readonly config: AppConfig;

  // Service instances
  private hsmService!: HSMService;
  private keyRotationService!: KeyRotationService;
  private certificateAuthorityService!: CertificateAuthorityService;
  private encryptionService!: EncryptionService;
  private auditService!: AuditService;

  // Controller instances
  private keyManagementController!: KeyManagementController;
  private certificateController!: CertificateController;
  private cryptoOperationsController!: CryptoOperationsController;
  private complianceController!: ComplianceController;

  // Middleware instances
  private securityMiddleware!: SecurityMiddleware;
  private rateLimitingMiddleware!: RateLimitingMiddleware;

  // Utility instances
  private hsmConnector!: HSMConnector;
  private databaseConnector!: DatabaseConnector;
  private metricsCollector!: MetricsCollector;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.config = this.loadConfiguration();
    this.logger = this.initializeLogger();

    this.logger.info('Encryption Service initializing...', {
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform
    });
  }

  /**
   * Load application configuration from environment variables
   */
  private loadConfiguration(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3001'),
      nodeEnv: process.env.NODE_ENV || 'development',
      hsmConfig: {
        provider: process.env.HSM_PROVIDER || 'safenet',
        endpoint: process.env.HSM_ENDPOINT || 'https://hsm.internal',
        partition: process.env.HSM_PARTITION || 'craviz',
        username: process.env.HSM_USERNAME || '',
        password: process.env.HSM_PASSWORD || '',
        timeout: parseInt(process.env.HSM_TIMEOUT || '30000')
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'encryption_service',
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10')
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'default-secret',
        encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'AES-256-GCM',
        keySize: parseInt(process.env.KEY_SIZE || '256'),
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600'),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5')
      },
      monitoring: {
        metricsEnabled: process.env.METRICS_ENABLED === 'true',
        logLevel: process.env.LOG_LEVEL || 'info',
        auditEnabled: process.env.AUDIT_ENABLED === 'true',
        alertingEnabled: process.env.ALERTING_ENABLED === 'true'
      }
    };
  }

  /**
   * Initialize Winston logger with proper configuration
   */
  private initializeLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          service: 'encryption-service',
          ...meta
        });
      })
    );

    return winston.createLogger({
      level: this.config.monitoring.logLevel,
      format: logFormat,
      defaultMeta: { service: 'encryption-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/encryption-service-error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/encryption-service-combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 10
        })
      ]
    });
  }

  /**
   * Initialize all service dependencies
   */
  private async initializeServices(): Promise<void> {
    try {
      this.logger.info('Initializing service dependencies...');

      // Initialize connectors
      this.hsmConnector = new HSMConnector(this.config.hsmConfig, this.logger);
      this.databaseConnector = new DatabaseConnector(this.config.database, this.logger);
      this.metricsCollector = new MetricsCollector(this.logger);

      // Connect to HSM
      await this.hsmConnector.connect();
      this.logger.info('HSM connection established');

      // Connect to database
      await this.databaseConnector.connect();
      this.logger.info('Database connection established');

      // Initialize core services
      this.hsmService = new HSMService(this.hsmConnector, this.logger);
      this.encryptionService = new EncryptionService(this.hsmService, this.logger);
      this.auditService = new AuditService(this.databaseConnector, this.logger);
      
      this.keyRotationService = new KeyRotationService(
        this.hsmService,
        this.auditService,
        this.logger
      );
      
      this.certificateAuthorityService = new CertificateAuthorityService(
        this.hsmService,
        this.databaseConnector,
        this.logger
      );

      // Initialize middleware
      this.securityMiddleware = new SecurityMiddleware(
        this.config.security,
        this.auditService,
        this.logger
      );
      
      this.rateLimitingMiddleware = new RateLimitingMiddleware(
        this.databaseConnector,
        this.logger
      );

      // Initialize controllers
      this.keyManagementController = new KeyManagementController(
        this.hsmService,
        this.keyRotationService,
        this.auditService,
        this.logger
      );
      
      this.certificateController = new CertificateController(
        this.certificateAuthorityService,
        this.auditService,
        this.logger
      );
      
      this.cryptoOperationsController = new CryptoOperationsController(
        this.encryptionService,
        this.auditService,
        this.logger
      );
      
      this.complianceController = new ComplianceController(
        this.auditService,
        this.hsmService,
        this.logger
      );

      this.logger.info('All service dependencies initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"]
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
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }));

    // Custom middleware
    this.app.use(this.securityMiddleware.authenticate.bind(this.securityMiddleware));
    this.app.use(this.rateLimitingMiddleware.limit.bind(this.rateLimitingMiddleware));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random()}`;
      req.headers['x-request-id'] = requestId as string;
      
      this.logger.info('Incoming request', {
        requestId,
        method: req.method,
        url: req.url,
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
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/v1/keys', this.keyManagementController.getRouter());
    this.app.use('/api/v1/certificates', this.certificateController.getRouter());
    this.app.use('/api/v1/crypto', this.cryptoOperationsController.getRouter());
    this.app.use('/api/v1/compliance', this.complianceController.getRouter());

    // Metrics endpoint
    if (this.config.monitoring.metricsEnabled) {
      this.app.get('/metrics', async (req: Request, res: Response) => {
        try {
          const metrics = await this.metricsCollector.getMetrics();
          res.set('Content-Type', 'text/plain');
          res.send(metrics);
        } catch (error) {
          this.logger.error('Failed to retrieve metrics:', error);
          res.status(500).json({ error: 'Failed to retrieve metrics' });
        }
      });
    }

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'];
      
      this.logger.error('Unhandled error:', {
        requestId,
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: this.config.nodeEnv === 'production' 
          ? 'An error occurred processing your request' 
          : error.message,
        requestId,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Configure WebSocket connections for real-time updates
   */
  private configureWebSocket(): void {
    this.io.use(async (socket, next) => {
      try {
        // Authenticate WebSocket connection
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Validate token using security middleware
        const isValid = await this.securityMiddleware.validateToken(token);
        if (!isValid) {
          return next(new Error('Invalid authentication token'));
        }

        next();
      } catch (error) {
        this.logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.logger.info('WebSocket client connected', {
        socketId: socket.id,
        clientIp: socket.handshake.address
      });

      // Join compliance monitoring room
      socket.join('compliance-monitoring');

      // Handle client disconnection
      socket.on('disconnect', (reason) => {
        this.logger.info('WebSocket client disconnected', {
          socketId: socket.id,
          reason
        });
      });
    });
  }

  /**
   * Start background tasks
   */
  private async startBackgroundTasks(): Promise<void> {
    try {
      // Start key rotation service
      await this.keyRotationService.start();
      this.logger.info('Key rotation service started');

      // Start metrics collection
      if (this.config.monitoring.metricsEnabled) {
        this.metricsCollector.start();
        this.logger.info('Metrics collection started');
      }

      // Start HSM health monitoring
      this.hsmConnector.startHealthMonitoring();
      this.logger.info('HSM health monitoring started');

    } catch (error) {
      this.logger.error('Failed to start background tasks:', error);
      throw error;
    }
  }

  /**
   * Initialize and start the application
   */
  public async start(): Promise<void> {
    try {
      // Initialize services
      await this.initializeServices();

      // Configure middleware and routes
      this.configureMiddleware();
      this.configureRoutes();
      this.configureWebSocket();

      // Start background tasks
      await this.startBackgroundTasks();

      // Start server
      this.server.listen(this.config.port, () => {
        this.logger.info(`Encryption Service started successfully`, {
          port: this.config.port,
          environment: this.config.nodeEnv,
          processId: process.pid
        });
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        this.server.close(() => {
          this.logger.info('HTTP server closed');
        });

        // Stop background services
        await this.keyRotationService.stop();
        this.metricsCollector.stop();
        this.hsmConnector.stopHealthMonitoring();

        // Close database connections
        await this.databaseConnector.disconnect();
        this.logger.info('Database connections closed');

        // Close HSM connection
        await this.hsmConnector.disconnect();
        this.logger.info('HSM connection closed');

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection:', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  }
}

/**
 * Cluster management for production environments
 */
function startCluster(): void {
  const numCPUs = os.cpus().length;
  const maxWorkers = Math.min(numCPUs, 4); // Limit to 4 workers max

  if (cluster.isPrimary) {
    console.log(`Master process ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < maxWorkers; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
      console.log('Starting a new worker...');
      cluster.fork();
    });
  } else {
    // Worker process
    const app = new EncryptionServiceApp();
    app.start().catch((error) => {
      console.error('Failed to start worker:', error);
      process.exit(1);
    });
  }
}

// Start the application
if (require.main === module) {
  const isProduction = process.env.NODE_ENV === 'production';
  const enableClustering = process.env.ENABLE_CLUSTERING === 'true';

  if (isProduction && enableClustering) {
    startCluster();
  } else {
    const app = new EncryptionServiceApp();
    app.start().catch((error) => {
      console.error('Failed to start application:', error);
      process.exit(1);
    });
  }
}

export { EncryptionServiceApp };
```