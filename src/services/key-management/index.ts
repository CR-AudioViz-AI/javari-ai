```typescript
/**
 * Key Management Microservice
 * 
 * Secure key management microservice for CR AudioViz AI that handles:
 * - Encryption key generation, rotation, and distribution
 * - Hardware Security Module (HSM) integration
 * - Key escrow capabilities with audit logging
 * - High-availability key distribution with caching
 * 
 * @fileoverview Main entry point for the Key Management microservice
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Core Components
import { KeyManager } from './core/KeyManager';
import { HSMConnector } from './core/HSMConnector';
import { KeyRotationScheduler } from './core/KeyRotationScheduler';
import { KeyEscrowService } from './core/KeyEscrowService';

// Storage & Utilities
import { KeyVault } from './storage/KeyVault';
import { AuditLogger } from './storage/AuditLogger';
import { CryptoUtils } from './utils/crypto';
import { ValidationUtils } from './utils/validation';

// Configuration
import { HSMConfig } from './config/hsm';
import { SecurityPolicies } from './config/policies';

// Types & Interfaces
import {
  KeyManagementConfig,
  KeyType,
  KeyMetadata,
  KeyGenerationRequest,
  KeyRotationRequest,
  KeyEscrowRequest,
  KeyDistributionRequest,
  ServiceHealthStatus,
  AuditEvent,
  HSMConnectionStatus,
  KeyOperationResult,
  ServiceMetrics
} from './types';

/**
 * Key Management Service Configuration Interface
 */
interface KeyManagementServiceConfig extends KeyManagementConfig {
  supabase: {
    url: string;
    serviceKey: string;
  };
  redis: {
    url: string;
    password?: string;
    keyPrefix: string;
  };
  hsm: HSMConfig;
  security: SecurityPolicies;
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
  };
  monitoring: {
    metricsPort: number;
    tracingEndpoint?: string;
  };
}

/**
 * Main Key Management Service Class
 * 
 * Orchestrates all key management operations with enterprise-grade security,
 * HSM integration, and comprehensive audit logging.
 */
export class KeyManagementService {
  private readonly config: KeyManagementServiceConfig;
  private readonly app: Application;
  private readonly supabase: ReturnType<typeof createClient>;
  private readonly redis: Redis;
  private readonly tracer = trace.getTracer('key-management-service');

  // Core Components
  private keyManager: KeyManager;
  private hsmConnector: HSMConnector;
  private rotationScheduler: KeyRotationScheduler;
  private escrowService: KeyEscrowService;
  private keyVault: KeyVault;
  private auditLogger: AuditLogger;
  private cryptoUtils: CryptoUtils;
  private validationUtils: ValidationUtils;

  // Metrics
  private readonly metrics = {
    keyOperations: new Counter({
      name: 'key_operations_total',
      help: 'Total number of key operations',
      labelNames: ['operation', 'key_type', 'status']
    }),
    keyRotations: new Counter({
      name: 'key_rotations_total',
      help: 'Total number of key rotations',
      labelNames: ['key_type', 'status']
    }),
    hsmOperations: new Counter({
      name: 'hsm_operations_total',
      help: 'Total number of HSM operations',
      labelNames: ['operation', 'status']
    }),
    operationDuration: new Histogram({
      name: 'key_operation_duration_seconds',
      help: 'Duration of key operations',
      labelNames: ['operation', 'key_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    }),
    activeKeys: new Gauge({
      name: 'active_keys_count',
      help: 'Number of active keys by type',
      labelNames: ['key_type']
    }),
    hsmConnections: new Gauge({
      name: 'hsm_connections_active',
      help: 'Number of active HSM connections'
    })
  };

  private isHealthy = false;
  private isShuttingDown = false;

  /**
   * Initialize Key Management Service
   * 
   * @param config - Service configuration
   */
  constructor(config: KeyManagementServiceConfig) {
    this.config = config;
    this.app = express();

    // Initialize Supabase client
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: { persistSession: false },
        db: { schema: 'key_management' }
      }
    );

    // Initialize Redis client
    this.redis = new Redis({
      host: new URL(config.redis.url).hostname,
      port: parseInt(new URL(config.redis.url).port) || 6379,
      password: config.redis.password,
      keyPrefix: config.redis.keyPrefix,
      retryDelayOnFailover: 1000,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.initializeComponents();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupMetrics();
  }

  /**
   * Initialize core service components
   */
  private async initializeComponents(): Promise<void> {
    const span = this.tracer.startSpan('initialize_components');
    
    try {
      // Initialize utilities
      this.cryptoUtils = new CryptoUtils(this.config.security);
      this.validationUtils = new ValidationUtils(this.config.security);

      // Initialize storage components
      this.keyVault = new KeyVault(this.supabase, this.redis, this.config);
      this.auditLogger = new AuditLogger(this.supabase, this.config);

      // Initialize HSM connector
      this.hsmConnector = new HSMConnector(this.config.hsm, this.auditLogger);
      await this.hsmConnector.initialize();

      // Initialize core services
      this.keyManager = new KeyManager(
        this.keyVault,
        this.hsmConnector,
        this.cryptoUtils,
        this.auditLogger,
        this.config
      );

      this.rotationScheduler = new KeyRotationScheduler(
        this.keyManager,
        this.auditLogger,
        this.config
      );

      this.escrowService = new KeyEscrowService(
        this.keyVault,
        this.hsmConnector,
        this.auditLogger,
        this.config
      );

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging and tracing
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const span = this.tracer.startSpan(`${req.method} ${req.path}`);
      
      span.setAttributes({
        'http.method': req.method,
        'http.url': req.url,
        'http.user_agent': req.get('User-Agent') || '',
        'http.remote_addr': req.ip
      });

      res.on('finish', () => {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_size': res.get('Content-Length') || 0
        });
        
        if (res.statusCode >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        
        span.end();
      });

      next();
    });

    // Authentication middleware
    this.app.use('/api/', this.authenticateRequest.bind(this));

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.healthCheck.bind(this));

    // Key generation
    this.app.post('/api/keys/generate', this.generateKey.bind(this));

    // Key retrieval
    this.app.get('/api/keys/:keyId', this.getKey.bind(this));

    // Key rotation
    this.app.post('/api/keys/:keyId/rotate', this.rotateKey.bind(this));

    // Key distribution
    this.app.post('/api/keys/distribute', this.distributeKeys.bind(this));

    // Key escrow
    this.app.post('/api/keys/:keyId/escrow', this.escrowKey.bind(this));
    this.app.post('/api/keys/:keyId/recover', this.recoverKey.bind(this));

    // Key revocation
    this.app.post('/api/keys/:keyId/revoke', this.revokeKey.bind(this));

    // Service status
    this.app.get('/api/status', this.getServiceStatus.bind(this));

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });
  }

  /**
   * Setup Prometheus metrics collection
   */
  private setupMetrics(): void {
    collectDefaultMetrics({ register });
    
    // Update active keys metrics periodically
    setInterval(async () => {
      if (!this.isHealthy) return;
      
      try {
        const keyTypes: KeyType[] = ['AES', 'RSA', 'ECDSA', 'HMAC'];
        
        for (const keyType of keyTypes) {
          const count = await this.keyVault.getActiveKeyCount(keyType);
          this.metrics.activeKeys.set({ key_type: keyType }, count);
        }
        
        const hsmStatus = await this.hsmConnector.getConnectionStatus();
        this.metrics.hsmConnections.set(hsmStatus.activeConnections);
      } catch (error) {
        console.error('Error updating metrics:', error);
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Authenticate incoming requests
   */
  private async authenticateRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        res.status(401).json({ error: 'Invalid authentication token' });
        return;
      }

      // Attach user to request for downstream use
      (req as any).user = user;
      
      await this.auditLogger.logEvent({
        eventType: 'authentication',
        userId: user.id,
        resourceId: req.path,
        action: `${req.method} ${req.path}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date()
      });

      next();
    } catch (error) {
      res.status(500).json({ error: 'Authentication error' });
    }
  }

  /**
   * Generate encryption key
   */
  private async generateKey(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('generate_key');
    const timer = this.metrics.operationDuration.startTimer({
      operation: 'generate',
      key_type: req.body.keyType || 'unknown'
    });

    try {
      const request: KeyGenerationRequest = req.body;
      
      // Validate request
      const validation = this.validationUtils.validateKeyGenerationRequest(request);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.errors });
        return;
      }

      const result = await this.keyManager.generateKey(request);
      
      this.metrics.keyOperations.inc({
        operation: 'generate',
        key_type: request.keyType,
        status: 'success'
      });

      res.status(201).json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      this.metrics.keyOperations.inc({
        operation: 'generate',
        key_type: req.body.keyType || 'unknown',
        status: 'error'
      });

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(500).json({ error: 'Key generation failed' });
    } finally {
      timer();
      span.end();
    }
  }

  /**
   * Retrieve key by ID
   */
  private async getKey(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('get_key');
    const timer = this.metrics.operationDuration.startTimer({
      operation: 'get',
      key_type: 'unknown'
    });

    try {
      const { keyId } = req.params;
      const includeKeyMaterial = req.query.includeMaterial === 'true';

      if (!this.validationUtils.isValidKeyId(keyId)) {
        res.status(400).json({ error: 'Invalid key ID format' });
        return;
      }

      const result = await this.keyManager.getKey(keyId, includeKeyMaterial);
      
      this.metrics.keyOperations.inc({
        operation: 'get',
        key_type: result.metadata.keyType,
        status: 'success'
      });

      res.json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      this.metrics.keyOperations.inc({
        operation: 'get',
        key_type: 'unknown',
        status: 'error'
      });

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(404).json({ error: 'Key not found' });
    } finally {
      timer();
      span.end();
    }
  }

  /**
   * Rotate encryption key
   */
  private async rotateKey(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('rotate_key');
    const timer = this.metrics.operationDuration.startTimer({
      operation: 'rotate',
      key_type: 'unknown'
    });

    try {
      const { keyId } = req.params;
      const request: KeyRotationRequest = { keyId, ...req.body };

      const validation = this.validationUtils.validateKeyRotationRequest(request);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.errors });
        return;
      }

      const result = await this.rotationScheduler.rotateKey(request);
      
      this.metrics.keyRotations.inc({
        key_type: result.newKeyMetadata.keyType,
        status: 'success'
      });

      res.json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      this.metrics.keyRotations.inc({
        key_type: 'unknown',
        status: 'error'
      });

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(500).json({ error: 'Key rotation failed' });
    } finally {
      timer();
      span.end();
    }
  }

  /**
   * Distribute keys to authorized services
   */
  private async distributeKeys(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('distribute_keys');

    try {
      const request: KeyDistributionRequest = req.body;
      
      const validation = this.validationUtils.validateKeyDistributionRequest(request);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.errors });
        return;
      }

      const result = await this.keyManager.distributeKeys(request);
      res.json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(500).json({ error: 'Key distribution failed' });
    } finally {
      span.end();
    }
  }

  /**
   * Escrow key for recovery purposes
   */
  private async escrowKey(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('escrow_key');

    try {
      const { keyId } = req.params;
      const request: KeyEscrowRequest = { keyId, ...req.body };

      const result = await this.escrowService.escrowKey(request);
      res.json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(500).json({ error: 'Key escrow failed' });
    } finally {
      span.end();
    }
  }

  /**
   * Recover escrowed key
   */
  private async recoverKey(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('recover_key');

    try {
      const { keyId } = req.params;
      const { recoveryToken, justification } = req.body;

      const result = await this.escrowService.recoverKey(
        keyId,
        recoveryToken,
        justification
      );
      
      res.json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(500).json({ error: 'Key recovery failed' });
    } finally {
      span.end();
    }
  }

  /**
   * Revoke key and update dependent systems
   */
  private async revokeKey(req: Request, res: Response): Promise<void> {
    const span = this.tracer.startSpan('revoke_key');

    try {
      const { keyId } = req.params;
      const { reason } = req.body;

      const result = await this.keyManager.revokeKey(keyId, reason);
      res.json(result);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(500).json({ error: 'Key revocation failed' });
    } finally {
      span.end();
    }
  }

  /**
   * Health check endpoint
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health: ServiceHealthStatus = {
        status: this.isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        components: {
          database: await this.checkDatabaseHealth(),
          redis: await this.checkRedisHealth(),
          hsm: await this.checkHSMHealth()
        },
        metrics: await this.getServiceMetrics()
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  }

  /**
   * Get service status and metrics
   */
  private async getServiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.getServiceMetrics();
      const hsmStatus = await this.hsmConnector.getConnectionStatus();
      
      res.json({
        service: 'key-management',
        version: '1.0.0',
        uptime: process.uptime(),
        metrics,
        hsmStatus,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get service status' });
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseHealth(): Promise<{ status: string; responseTime?: number }> {
    try {
      const start = Date.now();
      await this.supabase.from('key_metadata').select('id').limit(1);
      const responseTime = Date.now() - start;
      
      return { status: 'healthy', responseTime };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedisHealth(): Promise<{ status: string; responseTime?: number }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start