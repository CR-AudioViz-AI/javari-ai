import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { ReconciliationEngine } from './core/reconciliation-engine';
import { DiscrepancyDetector } from './core/discrepancy-detector';
import { CurrencyConverter } from './core/currency-converter';
import { StripeProcessor } from './processors/stripe-processor';
import { PayPalProcessor } from './processors/paypal-processor';
import { AdyenProcessor } from './processors/adyen-processor';
import { SettlementWebhookHandler } from './webhooks/settlement-webhook-handler';
import { ReconciliationAPI } from './api/reconciliation-api';
import { DailyReconciliationJob } from './jobs/daily-reconciliation-job';
import { SettlementQueries } from './database/settlement-queries';
import { CurrencyRates } from './utils/currency-rates';
import { SettlementRecord, ProcessorType, SettlementStatus } from './models/settlement-record';
import { DiscrepancyReport, DiscrepancyType } from './models/discrepancy-report';

/**
 * Configuration interface for the Settlement Reconciliation Service
 */
export interface SettlementReconciliationConfig {
  port: number;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
  };
  processors: {
    stripe: {
      secretKey: string;
      webhookSecret: string;
    };
    paypal: {
      clientId: string;
      clientSecret: string;
      webhookId: string;
    };
    adyen: {
      apiKey: string;
      merchantAccount: string;
      hmacKey: string;
    };
  };
  currency: {
    baseCurrency: string;
    ratesApiKey: string;
  };
  jobs: {
    reconciliationSchedule: string; // cron format
    discrepancyThreshold: number; // percentage
  };
  logging: {
    level: string;
    enableConsole: boolean;
    enableFile: boolean;
    filePath?: string;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  websocket: {
    enabled: boolean;
    pingInterval: number;
  };
}

/**
 * Real-time settlement reconciliation event
 */
export interface ReconciliationEvent {
  type: 'settlement_processed' | 'discrepancy_detected' | 'reconciliation_complete' | 'currency_updated';
  timestamp: Date;
  processorType?: ProcessorType;
  settlementId?: string;
  discrepancyId?: string;
  data: Record<string, any>;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  version: string;
  uptime: number;
  components: {
    database: boolean;
    processors: Record<ProcessorType, boolean>;
    currencyService: boolean;
    reconciliationEngine: boolean;
  };
  metrics: {
    totalSettlements: number;
    pendingReconciliations: number;
    activeDiscrepancies: number;
    lastReconciliationRun: Date;
  };
}

/**
 * Main Settlement Reconciliation Service
 * Handles automated payment reconciliation across multiple processors
 */
export class SettlementReconciliationService {
  private app: express.Application;
  private server: any;
  private wsServer?: WebSocketServer;
  private logger: Logger;
  private config: SettlementReconciliationConfig;
  private reconciliationEngine: ReconciliationEngine;
  private discrepancyDetector: DiscrepancyDetector;
  private currencyConverter: CurrencyConverter;
  private processors: Map<ProcessorType, any>;
  private webhookHandler: SettlementWebhookHandler;
  private api: ReconciliationAPI;
  private dailyJob: DailyReconciliationJob;
  private queries: SettlementQueries;
  private currencyRates: CurrencyRates;
  private isShuttingDown: boolean = false;
  private connectedClients: Set<any> = new Set();

  constructor(config: SettlementReconciliationConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.logger = this.createLogger();
    
    this.initializeComponents();
    this.setupMiddleware();
    this.setupWebSocket();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Create Winston logger instance
   */
  private createLogger(): Logger {
    const logger = createLogger({
      level: this.config.logging.level,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: []
    });

    if (this.config.logging.enableConsole) {
      logger.add(new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      }));
    }

    if (this.config.logging.enableFile && this.config.logging.filePath) {
      logger.add(new transports.File({
        filename: this.config.logging.filePath,
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }));
    }

    return logger;
  }

  /**
   * Initialize service components
   */
  private async initializeComponents(): Promise<void> {
    try {
      this.logger.info('Initializing settlement reconciliation service components');

      // Initialize database queries
      this.queries = new SettlementQueries(this.config.database, this.logger);
      await this.queries.initialize();

      // Initialize currency utilities
      this.currencyRates = new CurrencyRates(
        this.config.currency.ratesApiKey,
        this.logger
      );
      
      this.currencyConverter = new CurrencyConverter(
        this.config.currency.baseCurrency,
        this.currencyRates,
        this.logger
      );

      // Initialize payment processors
      this.processors = new Map();
      
      const stripeProcessor = new StripeProcessor(
        this.config.processors.stripe.secretKey,
        this.logger
      );
      this.processors.set(ProcessorType.STRIPE, stripeProcessor);

      const paypalProcessor = new PayPalProcessor(
        this.config.processors.paypal.clientId,
        this.config.processors.paypal.clientSecret,
        this.logger
      );
      this.processors.set(ProcessorType.PAYPAL, paypalProcessor);

      const adyenProcessor = new AdyenProcessor(
        this.config.processors.adyen.apiKey,
        this.config.processors.adyen.merchantAccount,
        this.logger
      );
      this.processors.set(ProcessorType.ADYEN, adyenProcessor);

      // Initialize core engines
      this.discrepancyDetector = new DiscrepancyDetector(
        this.config.jobs.discrepancyThreshold,
        this.logger
      );

      this.reconciliationEngine = new ReconciliationEngine(
        this.processors,
        this.discrepancyDetector,
        this.currencyConverter,
        this.queries,
        this.logger
      );

      // Initialize webhook handler
      this.webhookHandler = new SettlementWebhookHandler(
        this.config.processors,
        this.reconciliationEngine,
        this.logger
      );

      // Initialize API routes
      this.api = new ReconciliationAPI(
        this.reconciliationEngine,
        this.queries,
        this.logger
      );

      // Initialize scheduled jobs
      this.dailyJob = new DailyReconciliationJob(
        this.config.jobs.reconciliationSchedule,
        this.reconciliationEngine,
        this.logger
      );

      // Set up event listeners
      this.setupEventListeners();

      this.logger.info('All service components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize service components', { error });
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
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Setup WebSocket server for real-time updates
   */
  private setupWebSocket(): void {
    if (!this.config.websocket.enabled) {
      return;
    }

    this.wsServer = new WebSocketServer({
      server: this.server,
      path: '/ws'
    });

    this.wsServer.on('connection', (ws, req) => {
      this.logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
      this.connectedClients.add(ws);

      ws.on('close', () => {
        this.logger.info('WebSocket client disconnected');
        this.connectedClients.delete(ws);
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error });
        this.connectedClients.delete(ws);
      });

      // Send ping periodically
      const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, this.config.websocket.pingInterval);
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getServiceHealth();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 206 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: 'Health check failed'
        });
      }
    });

    // Webhook endpoints
    this.app.use('/webhooks', this.webhookHandler.getRouter());

    // API endpoints
    this.app.use('/api', this.api.getRouter());

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.getServiceMetrics();
        res.json(metrics);
      } catch (error) {
        this.logger.error('Failed to get metrics', { error });
        res.status(500).json({ error: 'Failed to retrieve metrics' });
      }
    });

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Settlement Reconciliation Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running'
      });
    });
  }

  /**
   * Setup event listeners for real-time updates
   */
  private setupEventListeners(): void {
    // Listen for reconciliation events
    this.reconciliationEngine.on('settlement_processed', (settlement: SettlementRecord) => {
      this.broadcastEvent({
        type: 'settlement_processed',
        timestamp: new Date(),
        processorType: settlement.processorType,
        settlementId: settlement.id,
        data: { settlement }
      });
    });

    this.reconciliationEngine.on('discrepancy_detected', (discrepancy: DiscrepancyReport) => {
      this.broadcastEvent({
        type: 'discrepancy_detected',
        timestamp: new Date(),
        discrepancyId: discrepancy.id,
        data: { discrepancy }
      });
    });

    this.reconciliationEngine.on('reconciliation_complete', (summary: any) => {
      this.broadcastEvent({
        type: 'reconciliation_complete',
        timestamp: new Date(),
        data: { summary }
      });
    });

    this.currencyConverter.on('rates_updated', (rates: any) => {
      this.broadcastEvent({
        type: 'currency_updated',
        timestamp: new Date(),
        data: { rates }
      });
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date()
      });
    });

    // Global error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });

      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 
          'Something went wrong' : err.message,
        timestamp: new Date()
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
      this.shutdown(1);
    });

    // Handle termination signals
    process.on('SIGTERM', () => {
      this.logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown(0);
    });

    process.on('SIGINT', () => {
      this.logger.info('SIGINT received, shutting down gracefully');
      this.shutdown(0);
    });
  }

  /**
   * Broadcast event to all connected WebSocket clients
   */
  private broadcastEvent(event: ReconciliationEvent): void {
    if (!this.wsServer) {
      return;
    }

    const message = JSON.stringify(event);
    this.connectedClients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Get service health status
   */
  private async getServiceHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check database connectivity
      const dbHealth = await this.queries.healthCheck();
      
      // Check processors
      const processorHealth: Record<ProcessorType, boolean> = {
        [ProcessorType.STRIPE]: await this.processors.get(ProcessorType.STRIPE)?.healthCheck() || false,
        [ProcessorType.PAYPAL]: await this.processors.get(ProcessorType.PAYPAL)?.healthCheck() || false,
        [ProcessorType.ADYEN]: await this.processors.get(ProcessorType.ADYEN)?.healthCheck() || false
      };

      // Check currency service
      const currencyHealth = await this.currencyRates.healthCheck();

      // Check reconciliation engine
      const engineHealth = this.reconciliationEngine.isHealthy();

      // Get metrics
      const metrics = await this.getServiceMetrics();

      const allHealthy = dbHealth && 
                        Object.values(processorHealth).every(h => h) &&
                        currencyHealth && 
                        engineHealth;

      const someHealthy = dbHealth || 
                         Object.values(processorHealth).some(h => h) ||
                         currencyHealth || 
                         engineHealth;

      return {
        status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        components: {
          database: dbHealth,
          processors: processorHealth,
          currencyService: currencyHealth,
          reconciliationEngine: engineHealth
        },
        metrics: {
          totalSettlements: metrics.totalSettlements,
          pendingReconciliations: metrics.pendingReconciliations,
          activeDiscrepancies: metrics.activeDiscrepancies,
          lastReconciliationRun: metrics.lastReconciliationRun
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        components: {
          database: false,
          processors: {
            [ProcessorType.STRIPE]: false,
            [ProcessorType.PAYPAL]: false,
            [ProcessorType.ADYEN]: false
          },
          currencyService: false,
          reconciliationEngine: false
        },
        metrics: {
          totalSettlements: 0,
          pendingReconciliations: 0,
          activeDiscrepancies: 0,
          lastReconciliationRun: new Date()
        }
      };
    }
  }

  /**
   * Get service metrics
   */
  private async getServiceMetrics(): Promise<any> {
    try {
      const [
        totalSettlements,
        pendingReconciliations,
        activeDiscrepancies,
        lastReconciliationRun
      ] = await Promise.all([
        this.queries.getTotalSettlementsCount(),
        this.queries.getPendingReconciliationsCount(),
        this.queries.getActiveDiscrepanciesCount(),
        this.queries.getLastReconciliationRun()
      ]);

      return {
        totalSettlements,
        pendingReconciliations,
        activeDiscrepancies,
        lastReconciliationRun,
        connectedClients: this.connectedClients.size,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
    } catch (error) {
      this.logger.error('Failed to get service metrics', { error });
      throw error;
    }
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Settlement Reconciliation Service', {
        port: this.config.port,
        nodeEnv: process.env.NODE_ENV
      });

      await this.initializeComponents();
      
      // Start scheduled jobs
      await this.dailyJob.start();

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, (err?: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`Settlement Reconciliation Service started on port ${this.config.port}`);
    } catch (error) {
      this.logger.error('Failed to start service', { error });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(code: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Starting graceful shutdown');

    try {
      // Stop accepting new connections
      this.server.close();

      // Close WebSocket connections
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Stop scheduled jobs
      if (this.dailyJob) {
        await this.dailyJob.stop();
      }

      // Close database connections
      if (this.queries) {
        await this.queries.close();
      }

      this.logger.info('Graceful shutdown completed');
      process.exit(code);
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }
}

/**
 * Factory function to create and configure the service
 */
export function createSettlementReconciliationService(
  config: SettlementReconciliationConfig
): SettlementReconciliationService {
  return new SettlementReconciliationService(config);
}

/**
 * Default configuration
 */
export const defaultConfig: Partial<SettlementReconciliationConfig> = {
  corsOrigins: ['http://localhost:3000'],
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  websocket: {
    enabled: true,
    pingInterval: 30000
  },
  jobs: {
    reconciliationSchedule: '0 2 * * *', // Daily at 2 AM
    discrepancyThreshold: 0.01 // 1%
  },
  currency: {
    baseCurrency: 'USD'
  }
};

// Export types
export * from './models/settlement-record';
export * from './models/discrepancy-report';
export { Reconcili