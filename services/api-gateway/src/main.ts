```typescript
/**
 * CR AudioViz AI - Enterprise API Gateway Microservice
 * Main application entry point with comprehensive gateway functionality
 * 
 * @fileoverview Bootstrap and configure the enterprise API gateway with authentication,
 * rate limiting, monitoring, policy enforcement, and service routing capabilities.
 * 
 * @author CR AudioViz AI Engineering Team
 * @version 1.0.0
 * @since 2024
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import prometheus from 'prom-client';
import winston from 'winston';
import { z } from 'zod';

/**
 * Configuration schema for the API Gateway
 */
const ConfigSchema = z.object({
  port: z.number().default(8080),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  cors: z.object({
    origins: z.array(z.string()).default(['*']),
    credentials: z.boolean().default(true)
  }),
  supabase: z.object({
    url: z.string(),
    anonKey: z.string(),
    serviceKey: z.string()
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0)
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPath: z.string().default('/metrics'),
    collectDefaultMetrics: z.boolean().default(true)
  }),
  rateLimit: z.object({
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    maxRequests: z.number().default(1000),
    skipSuccessfulRequests: z.boolean().default(false)
  }),
  services: z.record(z.object({
    target: z.string(),
    pathRewrite: z.record(z.string()).optional(),
    changeOrigin: z.boolean().default(true),
    timeout: z.number().default(30000),
    retries: z.number().default(3)
  }))
});

type GatewayConfig = z.infer<typeof ConfigSchema>;

/**
 * Interface for authentication middleware context
 */
interface AuthContext {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  token?: string;
  isAuthenticated: boolean;
}

/**
 * Extended Express Request with authentication context
 */
interface AuthenticatedRequest extends Request {
  auth: AuthContext;
  correlationId: string;
  startTime: number;
}

/**
 * Service registry interface for dynamic routing
 */
interface ServiceRegistry {
  name: string;
  version: string;
  endpoint: string;
  health: string;
  status: 'active' | 'inactive' | 'maintenance';
  lastCheck: Date;
}

/**
 * Rate limiting store interface
 */
interface RateLimitStore {
  increment(key: string): Promise<number>;
  decrement(key: string): Promise<number>;
  reset(key: string): Promise<void>;
  get(key: string): Promise<number>;
}

/**
 * Enterprise API Gateway class
 * Manages all gateway functionality including auth, routing, monitoring
 */
class EnterpriseAPIGateway {
  private app: Application;
  private config: GatewayConfig;
  private logger: winston.Logger;
  private redis: Redis;
  private supabase: any;
  private serviceRegistry: Map<string, ServiceRegistry>;
  private metrics: {
    requestTotal: prometheus.Counter;
    requestDuration: prometheus.Histogram;
    activeConnections: prometheus.Gauge;
    errorTotal: prometheus.Counter;
    rateLimitHits: prometheus.Counter;
  };

  constructor() {
    this.app = express();
    this.serviceRegistry = new Map();
    this.initializeConfig();
    this.initializeLogger();
    this.initializeRedis();
    this.initializeSupabase();
    this.initializeMetrics();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupProxyRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize configuration from environment variables
   */
  private initializeConfig(): void {
    this.config = ConfigSchema.parse({
      port: parseInt(process.env.PORT || '8080'),
      environment: process.env.NODE_ENV || 'development',
      cors: {
        origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
        credentials: process.env.CORS_CREDENTIALS === 'true'
      },
      supabase: {
        url: process.env.SUPABASE_URL!,
        anonKey: process.env.SUPABASE_ANON_KEY!,
        serviceKey: process.env.SUPABASE_SERVICE_KEY!
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metricsPath: process.env.METRICS_PATH || '/metrics',
        collectDefaultMetrics: process.env.COLLECT_DEFAULT_METRICS !== 'false'
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
      },
      services: JSON.parse(process.env.SERVICE_CONFIG || '{}')
    });
  }

  /**
   * Initialize Winston logger with structured logging
   */
  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.environment === 'production' ? 'info' : 'debug',
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
        })
      ]
    });

    if (this.config.environment === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/gateway-error.log',
        level: 'error'
      }));
      this.logger.add(new winston.transports.File({
        filename: 'logs/gateway-combined.log'
      }));
    }
  }

  /**
   * Initialize Redis connection for caching and rate limiting
   */
  private initializeRedis(): void {
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  /**
   * Initialize Supabase client for authentication
   */
  private initializeSupabase(): void {
    this.supabase = createClient(
      this.config.supabase.url,
      this.config.supabase.serviceKey
    );
  }

  /**
   * Initialize Prometheus metrics collection
   */
  private initializeMetrics(): void {
    if (this.config.monitoring.collectDefaultMetrics) {
      prometheus.collectDefaultMetrics();
    }

    this.metrics = {
      requestTotal: new prometheus.Counter({
        name: 'api_gateway_requests_total',
        help: 'Total number of requests',
        labelNames: ['method', 'route', 'status_code', 'service']
      }),
      requestDuration: new prometheus.Histogram({
        name: 'api_gateway_request_duration_seconds',
        help: 'Request duration in seconds',
        labelNames: ['method', 'route', 'service'],
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      }),
      activeConnections: new prometheus.Gauge({
        name: 'api_gateway_active_connections',
        help: 'Number of active connections'
      }),
      errorTotal: new prometheus.Counter({
        name: 'api_gateway_errors_total',
        help: 'Total number of errors',
        labelNames: ['type', 'service']
      }),
      rateLimitHits: new prometheus.Counter({
        name: 'api_gateway_rate_limit_hits_total',
        help: 'Total number of rate limit hits',
        labelNames: ['service', 'endpoint']
      })
    };
  }

  /**
   * Setup Express middleware stack
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
      origin: this.config.cors.origins.includes('*') ? true : this.config.cors.origins,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-ID']
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request correlation and timing
    this.app.use(this.correlationMiddleware.bind(this));
    this.app.use(this.timingMiddleware.bind(this));

    // Rate limiting
    this.app.use(this.rateLimitMiddleware.bind(this));

    // Authentication middleware
    this.app.use(this.authenticationMiddleware.bind(this));

    // Request logging
    this.app.use(this.requestLoggingMiddleware.bind(this));
  }

  /**
   * Correlation ID middleware for request tracking
   */
  private correlationMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    req.correlationId = req.headers['x-correlation-id'] as string || 
      `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
  }

  /**
   * Request timing middleware for performance monitoring
   */
  private timingMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    req.startTime = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - req.startTime) / 1000;
      this.metrics.requestDuration
        .labels(req.method, req.route?.path || req.path, 'gateway')
        .observe(duration);
    });
    next();
  }

  /**
   * Rate limiting middleware with Redis backend
   */
  private async rateLimitMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = `rate_limit:${req.ip}:${req.path}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, Math.floor(this.config.rateLimit.windowMs / 1000));
      }

      if (current > this.config.rateLimit.maxRequests) {
        this.metrics.rateLimitHits.labels('gateway', req.path).inc();
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.floor(this.config.rateLimit.windowMs / 1000),
          correlationId: req.correlationId
        });
        return;
      }

      res.setHeader('X-RateLimit-Limit', this.config.rateLimit.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.rateLimit.maxRequests - current));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + this.config.rateLimit.windowMs).toISOString());
      
      next();
    } catch (error) {
      this.logger.error('Rate limiting error:', error);
      next(); // Continue on rate limit service error
    }
  }

  /**
   * JWT authentication middleware with Supabase integration
   */
  private async authenticationMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      req.auth = { isAuthenticated: false };

      // Skip auth for health checks and public endpoints
      if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.auth = { isAuthenticated: false };
        return next();
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        req.auth = { isAuthenticated: false };
        return next();
      }

      // Get user permissions from cache or database
      const permissions = await this.getUserPermissions(user.id);

      req.auth = {
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email!,
          role: user.user_metadata?.role || 'user',
          permissions
        },
        token
      };

      next();
    } catch (error) {
      this.logger.error('Authentication error:', error);
      req.auth = { isAuthenticated: false };
      next();
    }
  }

  /**
   * Request logging middleware
   */
  private requestLoggingMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    this.logger.info('Request received', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      authenticated: req.auth?.isAuthenticated,
      userId: req.auth?.user?.id
    });

    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      this.metrics.requestTotal
        .labels(req.method, req.route?.path || req.path, res.statusCode.toString(), 'gateway')
        .inc();

      this.logger.info('Request completed', {
        correlationId: req.correlationId,
        statusCode: res.statusCode,
        duration,
        contentLength: res.getHeader('content-length')
      });
    });

    next();
  }

  /**
   * Setup gateway routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const redisStatus = this.redis.status === 'ready' ? 'healthy' : 'unhealthy';
        const supabaseStatus = await this.checkSupabaseHealth();
        
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          services: {
            redis: redisStatus,
            supabase: supabaseStatus
          },
          uptime: process.uptime()
        };

        res.json(health);
      } catch (error) {
        this.logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: 'Service health check failed'
        });
      }
    });

    // Metrics endpoint for Prometheus
    if (this.config.monitoring.enabled) {
      this.app.get(this.config.monitoring.metricsPath, async (req: Request, res: Response) => {
        try {
          res.set('Content-Type', prometheus.register.contentType);
          res.end(await prometheus.register.metrics());
        } catch (error) {
          this.logger.error('Metrics collection failed:', error);
          res.status(500).json({ error: 'Metrics collection failed' });
        }
      });
    }

    // Service registry endpoint
    this.app.get('/services', this.requireAuth.bind(this), (req: Request, res: Response) => {
      const services = Array.from(this.serviceRegistry.values());
      res.json({ services });
    });

    // Gateway configuration endpoint
    this.app.get('/gateway/config', this.requireAuth.bind(this), (req: Request, res: Response) => {
      const safeConfig = {
        ...this.config,
        supabase: { url: this.config.supabase.url }, // Hide keys
        redis: { host: this.config.redis.host, port: this.config.redis.port }
      };
      res.json(safeConfig);
    });
  }

  /**
   * Setup proxy routes for microservices
   */
  private setupProxyRoutes(): void {
    Object.entries(this.config.services).forEach(([serviceName, serviceConfig]) => {
      const proxyOptions: ProxyOptions = {
        target: serviceConfig.target,
        changeOrigin: serviceConfig.changeOrigin,
        pathRewrite: serviceConfig.pathRewrite,
        timeout: serviceConfig.timeout,
        onError: this.handleProxyError.bind(this),
        onProxyReq: this.handleProxyRequest.bind(this),
        onProxyRes: this.handleProxyResponse.bind(this),
        router: async (req) => {
          // Dynamic routing based on service registry
          const service = this.serviceRegistry.get(serviceName);
          return service?.endpoint || serviceConfig.target;
        }
      };

      this.app.use(`/${serviceName}`, createProxyMiddleware(proxyOptions));
      this.logger.info(`Proxy route configured for ${serviceName} -> ${serviceConfig.target}`);
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: Error, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        correlationId: req.correlationId,
        path: req.path
      });

      this.metrics.errorTotal.labels('unhandled', 'gateway').inc();

      res.status(500).json({
        error: 'Internal server error',
        correlationId: req.correlationId,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Authentication requirement middleware
   */
  private requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    if (!req.auth?.isAuthenticated) {
      res.status(401).json({
        error: 'Authentication required',
        correlationId: req.correlationId
      });
      return;
    }
    next();
  }

  /**
   * Get user permissions from cache or database
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const cacheKey = `permissions:${userId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from Supabase
      const { data, error } = await this.supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Failed to fetch user permissions:', error);
        return [];
      }

      const permissions = data?.map(p => p.permission) || [];
      await this.redis.setex(cacheKey, 300, JSON.stringify(permissions)); // Cache for 5 minutes
      
      return permissions;
    } catch (error) {
      this.logger.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Check Supabase health
   */
  private async checkSupabaseHealth(): Promise<string> {
    try {
      const { error } = await this.supabase.from('health_check').select('*').limit(1);
      return error ? 'unhealthy' : 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Handle proxy errors
   */
  private handleProxyError(err: Error, req: AuthenticatedRequest, res: Response): void {
    this.logger.error('Proxy error:', {
      error: err.message,
      correlationId: req.correlationId,
      target: req.url
    });

    this.metrics.errorTotal.labels('proxy', 'gateway').inc();

    res.status(502).json({
      error: 'Service unavailable',
      correlationId: req.correlationId
    });
  }

  /**
   * Handle proxy requests
   */
  private handleProxyRequest(proxyReq: any, req: AuthenticatedRequest): void {
    proxyReq.setHeader('X-Correlation-ID', req.correlationId);
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    
    if (req.auth?.user) {
      proxyReq.setHeader('X-User-ID', req.auth.user.id);
      proxyReq.setHeader('X-User-Role', req.auth.user.role);