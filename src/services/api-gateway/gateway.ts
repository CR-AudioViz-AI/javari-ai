```typescript
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { createProxyMiddleware, ProxyOptions } from 'http-proxy-middleware';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import prometheus from 'prom-client';
import CircuitBreaker from 'opossum';
import { Logger } from 'winston';
import { createHash } from 'crypto';

/**
 * Enterprise API Gateway Configuration
 */
export interface GatewayConfig {
  /** Redis configuration for rate limiting and caching */
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    cluster?: boolean;
    nodes?: Array<{ host: string; port: number }>;
  };
  /** JWT authentication settings */
  auth: {
    secretKey: string;
    issuer: string;
    audience: string;
    algorithm: string;
    expirationTolerance: number;
  };
  /** Rate limiting configuration */
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
  };
  /** Circuit breaker settings */
  circuitBreaker: {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    volumeThreshold: number;
  };
  /** Monitoring and metrics */
  monitoring: {
    enablePrometheus: boolean;
    enableHealthCheck: boolean;
    requestTimeout: number;
  };
  /** Upstream services configuration */
  upstreams: Record<string, UpstreamConfig>;
}

/**
 * Upstream service configuration
 */
export interface UpstreamConfig {
  /** Service URL or load balancer endpoint */
  target: string;
  /** Path rewriting rules */
  pathRewrite?: Record<string, string>;
  /** Health check endpoint */
  healthCheck?: string;
  /** Authentication requirements */
  authRequired: boolean;
  /** Rate limit overrides */
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  /** Circuit breaker overrides */
  circuitBreaker?: {
    timeout: number;
    errorThresholdPercentage: number;
  };
  /** Request/response transformations */
  transformRequest?: (req: any) => any;
  transformResponse?: (res: any) => any;
}

/**
 * Request context with authentication and routing info
 */
export interface RequestContext {
  /** Authenticated user information */
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  /** Request metadata */
  requestId: string;
  timestamp: number;
  /** Rate limiting context */
  rateLimit: {
    remaining: number;
    resetTime: number;
    totalHits: number;
  };
  /** Routing information */
  route: {
    service: string;
    path: string;
    method: string;
  };
}

/**
 * Gateway metrics collected via Prometheus
 */
interface GatewayMetrics {
  requestsTotal: prometheus.Counter<string>;
  requestDuration: prometheus.Histogram<string>;
  activeConnections: prometheus.Gauge<string>;
  rateLimitHits: prometheus.Counter<string>;
  circuitBreakerState: prometheus.Gauge<string>;
  upstreamHealth: prometheus.Gauge<string>;
}

/**
 * Enterprise API Gateway Service
 * 
 * High-performance, scalable API gateway with comprehensive enterprise features:
 * - JWT-based authentication with role-based access control
 * - Redis-backed rate limiting with sliding window algorithm
 * - Circuit breaker pattern for resilience
 * - Prometheus metrics collection
 * - Request/response transformation
 * - Health monitoring and auto-scaling support
 */
export class EnterpriseApiGateway {
  private readonly config: GatewayConfig;
  private readonly redis: Redis;
  private readonly rateLimiter: RateLimiterRedis;
  private readonly router: Router;
  private readonly logger: Logger;
  private readonly metrics: GatewayMetrics;
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly upstreamHealth: Map<string, boolean> = new Map();
  private isShuttingDown = false;

  constructor(config: GatewayConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.redis = this.initializeRedis();
    this.rateLimiter = this.initializeRateLimiter();
    this.router = Router();
    this.metrics = this.initializeMetrics();
    
    this.initializeRoutes();
    this.startHealthChecks();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize Redis connection with clustering support
   */
  private initializeRedis(): Redis {
    try {
      if (this.config.redis.cluster && this.config.redis.nodes) {
        return new Redis.Cluster(this.config.redis.nodes, {
          redisOptions: {
            password: this.config.redis.password,
            retryDelayOnFailover: 100,
            enableOfflineQueue: false,
          },
        });
      }

      return new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis connection', { error });
      throw new Error('Redis initialization failed');
    }
  }

  /**
   * Initialize rate limiter with Redis backend
   */
  private initializeRateLimiter(): RateLimiterRedis {
    return new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'api_gateway_rl',
      points: this.config.rateLimit.maxRequests,
      duration: Math.floor(this.config.rateLimit.windowMs / 1000),
      execEvenly: true,
    });
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): GatewayMetrics {
    if (!this.config.monitoring.enablePrometheus) {
      return {} as GatewayMetrics;
    }

    // Register default metrics
    prometheus.collectDefaultMetrics();

    return {
      requestsTotal: new prometheus.Counter({
        name: 'gateway_requests_total',
        help: 'Total number of requests processed',
        labelNames: ['method', 'route', 'status_code', 'service'],
      }),
      requestDuration: new prometheus.Histogram({
        name: 'gateway_request_duration_seconds',
        help: 'Request duration in seconds',
        labelNames: ['method', 'route', 'service'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      }),
      activeConnections: new prometheus.Gauge({
        name: 'gateway_active_connections',
        help: 'Number of active connections',
      }),
      rateLimitHits: new prometheus.Counter({
        name: 'gateway_rate_limit_hits_total',
        help: 'Number of rate limit hits',
        labelNames: ['service', 'user_id'],
      }),
      circuitBreakerState: new prometheus.Gauge({
        name: 'gateway_circuit_breaker_state',
        help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
        labelNames: ['service'],
      }),
      upstreamHealth: new prometheus.Gauge({
        name: 'gateway_upstream_health',
        help: 'Upstream service health status',
        labelNames: ['service', 'endpoint'],
      }),
    };
  }

  /**
   * Initialize routing with middleware stack
   */
  private initializeRoutes(): void {
    // Global middleware
    this.router.use(this.requestIdMiddleware.bind(this));
    this.router.use(this.loggingMiddleware.bind(this));
    this.router.use(this.metricsMiddleware.bind(this));
    
    // Health check endpoint
    if (this.config.monitoring.enableHealthCheck) {
      this.router.get('/health', this.healthCheckHandler.bind(this));
      this.router.get('/metrics', this.metricsHandler.bind(this));
    }

    // Service-specific routes
    Object.entries(this.config.upstreams).forEach(([serviceName, config]) => {
      this.setupServiceRoute(serviceName, config);
    });

    // 404 handler
    this.router.use(this.notFoundHandler.bind(this));
    
    // Error handler
    this.router.use(this.errorHandler.bind(this));
  }

  /**
   * Setup route for specific service with middleware chain
   */
  private setupServiceRoute(serviceName: string, upstreamConfig: UpstreamConfig): void {
    const routePath = `/${serviceName}/*`;
    
    // Create circuit breaker for this service
    const circuitBreaker = new CircuitBreaker(this.proxyRequest.bind(this), {
      timeout: upstreamConfig.circuitBreaker?.timeout || this.config.circuitBreaker.timeout,
      errorThresholdPercentage: upstreamConfig.circuitBreaker?.errorThresholdPercentage || 
                                this.config.circuitBreaker.errorThresholdPercentage,
      resetTimeout: this.config.circuitBreaker.resetTimeout,
      volumeThreshold: this.config.circuitBreaker.volumeThreshold,
    });

    circuitBreaker.on('open', () => {
      this.logger.warn(`Circuit breaker opened for service: ${serviceName}`);
      this.metrics.circuitBreakerState?.labels(serviceName).set(1);
    });

    circuitBreaker.on('halfOpen', () => {
      this.logger.info(`Circuit breaker half-open for service: ${serviceName}`);
      this.metrics.circuitBreakerState?.labels(serviceName).set(2);
    });

    circuitBreaker.on('close', () => {
      this.logger.info(`Circuit breaker closed for service: ${serviceName}`);
      this.metrics.circuitBreakerState?.labels(serviceName).set(0);
    });

    this.circuitBreakers.set(serviceName, circuitBreaker);

    // Setup middleware chain for this service
    const middlewareChain = [
      this.rateLimitMiddleware.bind(this, serviceName, upstreamConfig),
    ];

    if (upstreamConfig.authRequired) {
      middlewareChain.push(this.authenticationMiddleware.bind(this));
    }

    middlewareChain.push(
      this.serviceProxyMiddleware.bind(this, serviceName, upstreamConfig, circuitBreaker)
    );

    this.router.use(routePath, ...middlewareChain);
  }

  /**
   * Request ID middleware for tracing
   */
  private requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers['x-request-id'] as string || 
                     createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16);
    
    req.context = {
      ...req.context,
      requestId,
      timestamp: Date.now(),
    };

    res.setHeader('X-Request-ID', requestId);
    next();
  }

  /**
   * Structured logging middleware
   */
  private loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logger.info('Request processed', {
        requestId: req.context?.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: req.context?.user?.id,
      });
    });

    next();
  }

  /**
   * Prometheus metrics collection middleware
   */
  private metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!this.config.monitoring.enablePrometheus) {
      return next();
    }

    const startTime = Date.now();
    this.metrics.activeConnections?.inc();

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const route = req.route?.path || req.path;
      const service = this.extractServiceName(req.path);

      this.metrics.requestsTotal?.labels(req.method, route, res.statusCode.toString(), service).inc();
      this.metrics.requestDuration?.labels(req.method, route, service).observe(duration);
      this.metrics.activeConnections?.dec();
    });

    next();
  }

  /**
   * Rate limiting middleware with Redis backend
   */
  private async rateLimitMiddleware(
    serviceName: string, 
    upstreamConfig: UpstreamConfig,
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const key = this.generateRateLimitKey(req, serviceName);
      
      const resRateLimit = await this.rateLimiter.consume(key);
      
      req.context = {
        ...req.context,
        rateLimit: {
          remaining: resRateLimit.remainingPoints || 0,
          resetTime: resRateLimit.msBeforeNext || 0,
          totalHits: resRateLimit.totalHits || 0,
        },
      };

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.rateLimit.maxRequests);
      res.setHeader('X-RateLimit-Remaining', resRateLimit.remainingPoints || 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (resRateLimit.msBeforeNext || 0)));

      next();
    } catch (rateLimitError) {
      this.metrics.rateLimitHits?.labels(serviceName, req.context?.user?.id || 'anonymous').inc();
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: Math.round((rateLimitError as any).msBeforeNext / 1000) || 60,
      });
    }
  }

  /**
   * JWT authentication middleware
   */
  private async authenticationMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Missing or invalid authorization header',
        });
      }

      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, this.config.auth.secretKey, {
        issuer: this.config.auth.issuer,
        audience: this.config.auth.audience,
        algorithms: [this.config.auth.algorithm as any],
        clockTolerance: this.config.auth.expirationTolerance,
      }) as any;

      req.context = {
        ...req.context,
        user: {
          id: decoded.sub,
          email: decoded.email,
          roles: decoded.roles || [],
          permissions: decoded.permissions || [],
        },
      };

      next();
    } catch (error) {
      this.logger.warn('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.context?.requestId,
      });

      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
    }
  }

  /**
   * Service proxy middleware with circuit breaker
   */
  private async serviceProxyMiddleware(
    serviceName: string,
    upstreamConfig: UpstreamConfig,
    circuitBreaker: CircuitBreaker,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Check upstream health
      if (!this.upstreamHealth.get(serviceName)) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: `Upstream service ${serviceName} is unhealthy`,
        });
      }

      const proxyOptions: ProxyOptions = {
        target: upstreamConfig.target,
        changeOrigin: true,
        pathRewrite: upstreamConfig.pathRewrite,
        timeout: this.config.monitoring.requestTimeout,
        onProxyReq: (proxyReq, req) => {
          // Add request context headers
          if (req.context?.requestId) {
            proxyReq.setHeader('X-Request-ID', req.context.requestId);
          }
          if (req.context?.user) {
            proxyReq.setHeader('X-User-ID', req.context.user.id);
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.context.user.roles));
          }

          // Apply request transformation
          if (upstreamConfig.transformRequest) {
            upstreamConfig.transformRequest(proxyReq);
          }
        },
        onProxyRes: (proxyRes, req, res) => {
          // Apply response transformation
          if (upstreamConfig.transformResponse) {
            upstreamConfig.transformResponse(proxyRes);
          }
        },
        onError: (err, req, res) => {
          this.logger.error('Proxy error', {
            error: err.message,
            service: serviceName,
            requestId: req.context?.requestId,
          });

          if (!res.headersSent) {
            res.status(502).json({
              error: 'Bad Gateway',
              message: 'Upstream service error',
            });
          }
        },
      };

      const proxy = createProxyMiddleware(proxyOptions);
      
      // Execute through circuit breaker
      await circuitBreaker.fire(proxy, req, res, next);
    } catch (error) {
      this.logger.error('Service proxy error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: serviceName,
        requestId: req.context?.requestId,
      });

      if (!res.headersSent) {
        res.status(503).json({
          error: 'Service unavailable',
          message: 'Circuit breaker is open',
        });
      }
    }
  }

  /**
   * Proxy request function for circuit breaker
   */
  private async proxyRequest(proxy: any, req: Request, res: Response, next: NextFunction): Promise<void> {
    return new Promise((resolve, reject) => {
      proxy(req, res, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Health check endpoint handler
   */
  private async healthCheckHandler(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        services: {} as Record<string, any>,
      };

      // Check Redis connection
      try {
        await this.redis.ping();
        health.services.redis = { status: 'healthy' };
      } catch (error) {
        health.services.redis = { 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
        health.status = 'degraded';
      }

      // Check upstream services
      for (const [serviceName, isHealthy] of this.upstreamHealth.entries()) {
        health.services[serviceName] = { 
          status: isHealthy ? 'healthy' : 'unhealthy' 
        };
        if (!isHealthy) {
          health.status = 'degraded';
        }
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Prometheus metrics endpoint handler
   */
  private async metricsHandler(req: Request, res: Response): Promise<void> {
    if (!this.config.monitoring.enablePrometheus) {
      return res.status(404).json({ error: 'Metrics not enabled' });
    }

    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  }

  /**
   * 404 handler
   */
  private notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      requestId: req.context?.requestId,
    });
  }

  /**
   * Global error handler
   */
  private errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    this.logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      requestId: req.context?.requestId,
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        requestId: req.context?.requestId,
      });
    }
  }

  /**
   * Generate rate limit key based on user or IP
   */
  private generateRateLimitKey(req: Request, serviceName: string): string {
    const userId = req.context?.user?.id;
    const ip = req.ip;
    const baseKey = userId || ip || 'anonymous';
    return `${serviceName}:${baseKey}`;
  }

  /**
   * Extract service name from request path
   */
  private extractServiceName(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] || 'unknown';
  }

  /**
   * Start health checks for upstream services
   */
  private startHealthChecks(): void {
    Object.entries(this.config.upstreams).forEach(([serviceName, config]) => {
      if (config.healthCheck) {
        this.scheduleHealthCheck(serviceName, config);
      } else {
        this.upstreamHealth.set(serviceName, true);
      }
    });
  }

  /**
   * Schedule periodic health checks for upstream service
   */
  private scheduleHealthCheck(serviceName: string, config: UpstreamConfig