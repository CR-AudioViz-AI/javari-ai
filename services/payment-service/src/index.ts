```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import Stripe from 'stripe';
import { PaymentController } from './controllers/PaymentController';
import { CurrencyService } from './services/CurrencyService';
import { PaymentProcessorService } from './services/PaymentProcessorService';
import { RegionalPaymentService } from './services/RegionalPaymentService';
import { ValidationMiddleware } from './middleware/ValidationMiddleware';
import { PaymentConfig } from './config/PaymentConfig';
import { Logger } from './utils/Logger';

/**
 * Multi-Currency Payment Service
 * 
 * Containerized microservice for processing payments in multiple currencies
 * with automatic conversion and regional payment method support.
 * 
 * Features:
 * - Multi-currency payment processing
 * - Automatic currency conversion
 * - Regional payment methods (Stripe, PayPal, local gateways)
 * - Real-time exchange rates
 * - Payment transaction logging
 * - Webhook handling for payment status updates
 * - Rate limiting and security middleware
 * 
 * @version 1.0.0
 */

interface ServiceDependencies {
  supabase: ReturnType<typeof createClient>;
  redis: Redis;
  stripe: Stripe;
  logger: Logger;
}

interface PaymentServiceConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
}

class PaymentService {
  private app: Express;
  private dependencies: ServiceDependencies;
  private config: PaymentServiceConfig;
  private paymentController: PaymentController;
  private currencyService: CurrencyService;
  private paymentProcessor: PaymentProcessorService;
  private regionalPaymentService: RegionalPaymentService;
  private validationMiddleware: ValidationMiddleware;

  constructor() {
    this.app = express();
    this.config = this.loadConfiguration();
    this.dependencies = this.initializeDependencies();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Load service configuration from environment variables
   */
  private loadConfiguration(): PaymentServiceConfig {
    return {
      port: parseInt(process.env.PORT || '3001', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
      }
    };
  }

  /**
   * Initialize external service dependencies
   */
  private initializeDependencies(): ServiceDependencies {
    const logger = new Logger('PaymentService');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Initialize Redis client
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    // Initialize Stripe client
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
      timeout: 10000,
      maxNetworkRetries: 3
    });

    logger.info('Service dependencies initialized successfully');

    return { supabase, redis, stripe, logger };
  }

  /**
   * Initialize business logic services
   */
  private initializeServices(): void {
    const paymentConfig = new PaymentConfig();
    
    this.currencyService = new CurrencyService(
      this.dependencies.redis,
      this.dependencies.logger
    );

    this.paymentProcessor = new PaymentProcessorService(
      this.dependencies.stripe,
      paymentConfig,
      this.dependencies.logger
    );

    this.regionalPaymentService = new RegionalPaymentService(
      this.dependencies.stripe,
      paymentConfig,
      this.dependencies.logger
    );

    this.validationMiddleware = new ValidationMiddleware();

    this.paymentController = new PaymentController(
      this.currencyService,
      this.paymentProcessor,
      this.regionalPaymentService,
      this.dependencies.supabase,
      this.dependencies.logger
    );

    this.dependencies.logger.info('Business logic services initialized');
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
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.stripe.com"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      message: {
        error: 'Too many requests',
        retryAfter: Math.ceil(this.config.rateLimiting.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.dependencies.logger.info('Request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    this.dependencies.logger.info('Middleware stack configured');
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
        environment: this.config.nodeEnv
      });
    });

    // Payment processing endpoints
    this.app.post(
      '/api/payments/process',
      this.validationMiddleware.validatePaymentRequest,
      this.paymentController.processPayment.bind(this.paymentController)
    );

    this.app.get(
      '/api/payments/methods/:region',
      this.validationMiddleware.validateRegion,
      this.paymentController.getPaymentMethods.bind(this.paymentController)
    );

    this.app.get(
      '/api/payments/:paymentId',
      this.validationMiddleware.validatePaymentId,
      this.paymentController.getPaymentStatus.bind(this.paymentController)
    );

    this.app.post(
      '/api/payments/:paymentId/refund',
      this.validationMiddleware.validateRefundRequest,
      this.paymentController.processRefund.bind(this.paymentController)
    );

    // Currency conversion endpoints
    this.app.get(
      '/api/currency/rates',
      this.paymentController.getExchangeRates.bind(this.paymentController)
    );

    this.app.post(
      '/api/currency/convert',
      this.validationMiddleware.validateCurrencyConversion,
      this.paymentController.convertCurrency.bind(this.paymentController)
    );

    // Webhook endpoints
    this.app.post(
      '/api/webhooks/stripe',
      express.raw({ type: 'application/json' }),
      this.paymentController.handleStripeWebhook.bind(this.paymentController)
    );

    this.app.post(
      '/api/webhooks/paypal',
      this.paymentController.handlePayPalWebhook.bind(this.paymentController)
    );

    // Subscription management endpoints
    this.app.post(
      '/api/subscriptions/create',
      this.validationMiddleware.validateSubscriptionRequest,
      this.paymentController.createSubscription.bind(this.paymentController)
    );

    this.app.put(
      '/api/subscriptions/:subscriptionId',
      this.validationMiddleware.validateSubscriptionUpdate,
      this.paymentController.updateSubscription.bind(this.paymentController)
    );

    this.app.delete(
      '/api/subscriptions/:subscriptionId',
      this.paymentController.cancelSubscription.bind(this.paymentController)
    );

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    this.dependencies.logger.info('API routes configured');
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.dependencies.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      // Don't expose internal errors in production
      const isDevelopment = this.config.nodeEnv === 'development';
      const errorResponse = {
        error: 'Internal server error',
        ...(isDevelopment && {
          message: error.message,
          stack: error.stack
        })
      };

      res.status(500).json(errorResponse);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.dependencies.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.dependencies.logger.error('Unhandled promise rejection', {
        reason: reason?.message || reason,
        promise: promise.toString()
      });
      process.exit(1);
    });

    this.dependencies.logger.info('Error handling configured');
  }

  /**
   * Start the payment service
   */
  public async start(): Promise<void> {
    try {
      // Test database connection
      const { error: dbError } = await this.dependencies.supabase
        .from('payment_transactions')
        .select('count')
        .limit(1);

      if (dbError) {
        throw new Error(`Database connection failed: ${dbError.message}`);
      }

      // Test Redis connection
      await this.dependencies.redis.ping();

      // Initialize currency rates cache
      await this.currencyService.initializeRatesCache();

      // Start HTTP server
      const server = this.app.listen(this.config.port, () => {
        this.dependencies.logger.info('Payment service started', {
          port: this.config.port,
          environment: this.config.nodeEnv,
          nodeVersion: process.version,
          pid: process.pid
        });
      });

      // Graceful shutdown handling
      const gracefulShutdown = async (signal: string) => {
        this.dependencies.logger.info(`Received ${signal}, starting graceful shutdown`);
        
        server.close(async () => {
          try {
            await this.dependencies.redis.disconnect();
            this.dependencies.logger.info('Payment service shut down successfully');
            process.exit(0);
          } catch (error) {
            this.dependencies.logger.error('Error during shutdown', { error });
            process.exit(1);
          }
        });
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
      this.dependencies.logger.error('Failed to start payment service', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  }

  /**
   * Get Express app instance for testing
   */
  public getApp(): Express {
    return this.app;
  }
}

// Initialize and start the service
const paymentService = new PaymentService();

// Start service if not in test environment
if (process.env.NODE_ENV !== 'test') {
  paymentService.start().catch((error) => {
    console.error('Failed to start payment service:', error);
    process.exit(1);
  });
}

export default paymentService;
export { PaymentService };
```