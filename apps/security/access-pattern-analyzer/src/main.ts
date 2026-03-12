```typescript
/**
 * Real-Time Access Pattern Analyzer Microservice
 * 
 * Continuously analyzes access patterns to detect:
 * - Privilege escalation attempts
 * - Unusual data access patterns
 * - Potential insider threats
 * 
 * @module AccessPatternAnalyzer
 * @version 1.0.0
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Logger } from 'winston';
import { EventEmitter } from 'events';

// Internal imports
import { PrivilegeEscalationDetector } from './analyzers/PrivilegeEscalationDetector';
import { DataAccessAnomalyDetector } from './analyzers/DataAccessAnomalyDetector';
import { InsiderThreatDetector } from './analyzers/InsiderThreatDetector';
import { AccessPatternProcessor } from './processors/AccessPatternProcessor';
import { UserBehaviorModel } from './models/UserBehaviorModel';
import { AccessEventCollector } from './collectors/AccessEventCollector';
import { ThreatAlertManager } from './alerting/ThreatAlertManager';
import { PatternHistoryStore } from './storage/PatternHistoryStore';
import { AnalysisEndpoints } from './api/AnalysisEndpoints';

// Shared imports
import { SecurityEventType, AccessEvent, ThreatAlert } from '../../../packages/shared/src/types/security-events';
import { SupabaseRealtimeClient } from '../../../packages/shared/src/services/supabase-realtime';
import { AnomalyDetectionService } from '../../../packages/shared/src/ml/anomaly-detection';
import { NotificationService } from '../../../packages/shared/src/alerting/notification-service';

/**
 * Configuration interface for the access pattern analyzer
 */
interface AnalyzerConfig {
  port: number;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
  analysis: {
    batchSize: number;
    processingInterval: number;
    alertThresholds: {
      privilegeEscalation: number;
      dataAccessAnomaly: number;
      insiderThreat: number;
    };
  };
  ml: {
    modelUpdateInterval: number;
    trainingDataWindow: number;
  };
  database: {
    url: string;
    maxConnections: number;
  };
}

/**
 * Service health status interface
 */
interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  components: {
    database: boolean;
    realtime: boolean;
    ml: boolean;
    alerting: boolean;
  };
  metrics: {
    eventsProcessed: number;
    threatsDetected: number;
    averageProcessingTime: number;
    uptime: number;
  };
}

/**
 * Main Access Pattern Analyzer Service
 */
export class AccessPatternAnalyzerService extends EventEmitter {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private logger: Logger;
  private config: AnalyzerConfig;

  // Core analyzers
  private privilegeDetector: PrivilegeEscalationDetector;
  private anomalyDetector: DataAccessAnomalyDetector;
  private insiderThreatDetector: InsiderThreatDetector;

  // Processing components
  private patternProcessor: AccessPatternProcessor;
  private behaviorModel: UserBehaviorModel;
  private eventCollector: AccessEventCollector;
  private alertManager: ThreatAlertManager;
  private historyStore: PatternHistoryStore;

  // External services
  private realtimeClient: SupabaseRealtimeClient;
  private mlService: AnomalyDetectionService;
  private notificationService: NotificationService;

  // Service state
  private isRunning: boolean = false;
  private startTime: Date;
  private processingStats: {
    eventsProcessed: number;
    threatsDetected: number;
    totalProcessingTime: number;
  };

  constructor(config: AnalyzerConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.startTime = new Date();
    this.processingStats = {
      eventsProcessed: 0,
      threatsDetected: 0,
      totalProcessingTime: 0
    };

    this.initializeExpress();
    this.initializeServices();
    this.setupEventHandlers();
  }

  /**
   * Initialize Express application with middleware
   */
  private initializeExpress(): void {
    this.app = express();
    
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({ 
      origin: this.config.corsOrigins,
      credentials: true 
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Create HTTP server and Socket.IO
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.corsOrigins,
        methods: ['GET', 'POST']
      }
    });
  }

  /**
   * Initialize all service components
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize storage
      this.historyStore = new PatternHistoryStore(this.config.database);
      await this.historyStore.initialize();

      // Initialize ML and external services
      this.mlService = new AnomalyDetectionService();
      this.notificationService = new NotificationService();
      this.realtimeClient = new SupabaseRealtimeClient();

      // Initialize behavior model
      this.behaviorModel = new UserBehaviorModel(this.mlService, this.historyStore);
      await this.behaviorModel.initialize();

      // Initialize analyzers
      this.privilegeDetector = new PrivilegeEscalationDetector(
        this.behaviorModel,
        this.config.analysis.alertThresholds.privilegeEscalation
      );

      this.anomalyDetector = new DataAccessAnomalyDetector(
        this.behaviorModel,
        this.mlService,
        this.config.analysis.alertThresholds.dataAccessAnomaly
      );

      this.insiderThreatDetector = new InsiderThreatDetector(
        this.behaviorModel,
        this.mlService,
        this.config.analysis.alertThresholds.insiderThreat
      );

      // Initialize processing components
      this.eventCollector = new AccessEventCollector(this.realtimeClient);
      this.patternProcessor = new AccessPatternProcessor(
        [this.privilegeDetector, this.anomalyDetector, this.insiderThreatDetector],
        this.config.analysis.batchSize
      );

      this.alertManager = new ThreatAlertManager(
        this.notificationService,
        this.historyStore
      );

      // Initialize API endpoints
      const apiEndpoints = new AnalysisEndpoints(
        this.patternProcessor,
        this.behaviorModel,
        this.historyStore
      );
      apiEndpoints.setupRoutes(this.app);

      this.logger.info('All services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services', { error });
      throw error;
    }
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // Access event collection
    this.eventCollector.on('accessEvent', this.handleAccessEvent.bind(this));
    this.eventCollector.on('batchReady', this.processBatch.bind(this));

    // Pattern processing results
    this.patternProcessor.on('threatDetected', this.handleThreatDetection.bind(this));
    this.patternProcessor.on('patternAnalyzed', this.handlePatternAnalysis.bind(this));

    // Alert management
    this.alertManager.on('alertSent', this.handleAlertSent.bind(this));
    this.alertManager.on('alertFailed', this.handleAlertFailed.bind(this));

    // Model updates
    this.behaviorModel.on('modelUpdated', this.handleModelUpdate.bind(this));

    // WebSocket connections
    this.io.on('connection', this.handleSocketConnection.bind(this));

    // Process monitoring
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  /**
   * Handle individual access events
   */
  private async handleAccessEvent(event: AccessEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Update user behavior model
      await this.behaviorModel.updateWithEvent(event);

      // Store event for historical analysis
      await this.historyStore.storeAccessEvent(event);

      // Emit real-time updates
      this.io.emit('accessEvent', {
        id: event.id,
        userId: event.userId,
        timestamp: event.timestamp,
        type: event.type
      });

      this.processingStats.eventsProcessed++;
      this.processingStats.totalProcessingTime += Date.now() - startTime;

    } catch (error) {
      this.logger.error('Failed to handle access event', { 
        eventId: event.id,
        error 
      });
    }
  }

  /**
   * Process batch of events for pattern analysis
   */
  private async processBatch(events: AccessEvent[]): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Processing batch of ${events.length} events`);

      // Run pattern analysis
      const results = await this.patternProcessor.processBatch(events);

      // Handle any threats detected
      for (const result of results) {
        if (result.threatLevel > 0) {
          await this.handleThreatDetection(result);
        }
      }

      this.logger.debug(`Batch processed in ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error('Failed to process event batch', { 
        batchSize: events.length,
        error 
      });
    }
  }

  /**
   * Handle threat detection results
   */
  private async handleThreatDetection(threat: ThreatAlert): Promise<void> {
    try {
      this.logger.warn('Threat detected', { 
        type: threat.type,
        severity: threat.severity,
        userId: threat.userId
      });

      // Send alert
      await this.alertManager.sendAlert(threat);

      // Store threat for analysis
      await this.historyStore.storeThreatAlert(threat);

      // Emit real-time threat alert
      this.io.emit('threatDetected', threat);

      this.processingStats.threatsDetected++;
      this.emit('threatDetected', threat);

    } catch (error) {
      this.logger.error('Failed to handle threat detection', { 
        threatId: threat.id,
        error 
      });
    }
  }

  /**
   * Handle pattern analysis results
   */
  private async handlePatternAnalysis(analysis: any): Promise<void> {
    try {
      // Store analysis results
      await this.historyStore.storePatternAnalysis(analysis);

      // Emit real-time updates
      this.io.emit('patternAnalysis', analysis);

    } catch (error) {
      this.logger.error('Failed to handle pattern analysis', { error });
    }
  }

  /**
   * Handle successful alert sending
   */
  private handleAlertSent(alertId: string): void {
    this.logger.info(`Alert sent successfully: ${alertId}`);
    this.io.emit('alertSent', { alertId, status: 'sent' });
  }

  /**
   * Handle failed alert sending
   */
  private handleAlertFailed(alertId: string, error: Error): void {
    this.logger.error(`Failed to send alert: ${alertId}`, { error });
    this.io.emit('alertFailed', { alertId, error: error.message });
  }

  /**
   * Handle behavior model updates
   */
  private handleModelUpdate(modelInfo: any): void {
    this.logger.info('Behavior model updated', { modelInfo });
    this.io.emit('modelUpdated', modelInfo);
  }

  /**
   * Handle WebSocket connections
   */
  private handleSocketConnection(socket: any): void {
    this.logger.info(`Client connected: ${socket.id}`);

    socket.on('subscribe', (channel: string) => {
      socket.join(channel);
      this.logger.debug(`Client ${socket.id} subscribed to ${channel}`);
    });

    socket.on('unsubscribe', (channel: string) => {
      socket.leave(channel);
      this.logger.debug(`Client ${socket.id} unsubscribed from ${channel}`);
    });

    socket.on('disconnect', () => {
      this.logger.info(`Client disconnected: ${socket.id}`);
    });
  }

  /**
   * Start the access pattern analyzer service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Service is already running');
    }

    try {
      // Start event collection
      await this.eventCollector.start();

      // Start pattern processing
      await this.patternProcessor.start();

      // Start periodic model updates
      this.startModelUpdateScheduler();

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isRunning = true;
      this.logger.info(`Access Pattern Analyzer started on port ${this.config.port}`);

    } catch (error) {
      this.logger.error('Failed to start service', { error });
      throw error;
    }
  }

  /**
   * Stop the access pattern analyzer service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop event collection
      await this.eventCollector.stop();

      // Stop pattern processing
      await this.patternProcessor.stop();

      // Close WebSocket connections
      this.io.close();

      // Close HTTP server
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });

      this.isRunning = false;
      this.logger.info('Access Pattern Analyzer stopped');

    } catch (error) {
      this.logger.error('Error stopping service', { error });
      throw error;
    }
  }

  /**
   * Start periodic model update scheduler
   */
  private startModelUpdateScheduler(): void {
    setInterval(async () => {
      try {
        await this.behaviorModel.updateModel();
      } catch (error) {
        this.logger.error('Failed to update behavior model', { error });
      }
    }, this.config.ml.modelUpdateInterval);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<ServiceHealth> {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();

    try {
      const components = {
        database: await this.historyStore.isHealthy(),
        realtime: await this.realtimeClient.isConnected(),
        ml: await this.mlService.isHealthy(),
        alerting: await this.alertManager.isHealthy()
      };

      const allHealthy = Object.values(components).every(Boolean);
      const status: ServiceHealth['status'] = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: now,
        components,
        metrics: {
          eventsProcessed: this.processingStats.eventsProcessed,
          threatsDetected: this.processingStats.threatsDetected,
          averageProcessingTime: this.processingStats.eventsProcessed > 0 
            ? this.processingStats.totalProcessingTime / this.processingStats.eventsProcessed 
            : 0,
          uptime
        }
      };

    } catch (error) {
      this.logger.error('Failed to get health status', { error });
      return {
        status: 'unhealthy',
        timestamp: now,
        components: {
          database: false,
          realtime: false,
          ml: false,
          alerting: false
        },
        metrics: {
          eventsProcessed: this.processingStats.eventsProcessed,
          threatsDetected: this.processingStats.threatsDetected,
          averageProcessingTime: 0,
          uptime
        }
      };
    }
  }

  /**
   * Graceful shutdown handler
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Received shutdown signal, starting graceful shutdown...');

    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  }
}

/**
 * Default configuration
 */
const defaultConfig: AnalyzerConfig = {
  port: parseInt(process.env.PORT || '3005', 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // requests per window
  },
  analysis: {
    batchSize: parseInt(process.env.ANALYSIS_BATCH_SIZE || '100', 10),
    processingInterval: parseInt(process.env.PROCESSING_INTERVAL || '5000', 10),
    alertThresholds: {
      privilegeEscalation: parseFloat(process.env.PRIVILEGE_ESCALATION_THRESHOLD || '0.8'),
      dataAccessAnomaly: parseFloat(process.env.DATA_ACCESS_ANOMALY_THRESHOLD || '0.7'),
      insiderThreat: parseFloat(process.env.INSIDER_THREAT_THRESHOLD || '0.85')
    }
  },
  ml: {
    modelUpdateInterval: parseInt(process.env.MODEL_UPDATE_INTERVAL || '3600000', 10), // 1 hour
    trainingDataWindow: parseInt(process.env.TRAINING_DATA_WINDOW || '2592000000', 10) // 30 days
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/audioviz',
    maxConnections: parseInt(process.env.MAX_DB_CONNECTIONS || '20', 10)
  }
};

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const { createLogger, format, transports } = require('winston');
  
  const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json()
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: 'access-pattern-analyzer.log' })
    ]
  });

  try {
    const service = new AccessPatternAnalyzerService(defaultConfig, logger);
    await service.start();

    // Setup health check endpoint
    process.on('SIGUSR1', async () => {
      const health = await service.getHealthStatus();
      logger.info('Health check requested', { health });
    });

  } catch (error) {
    logger.error('Failed to start Access Pattern Analyzer service', { error });
    process.exit(1);
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  main().catch(console.error);
}

export { AccessPatternAnalyzerService, AnalyzerConfig, ServiceHealth };
```