```typescript
/**
 * Agent Failover Management Microservice
 * 
 * Main entry point for containerized service that manages agent failures
 * and automatic failover to backup agents while maintaining team functionality.
 * 
 * @module AgentFailoverService
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { config } from './config/failover.config';
import { FailoverManager } from './core/FailoverManager';
import { HealthMonitor } from './core/HealthMonitor';
import { BackupAgentPool } from './core/BackupAgentPool';
import { FailoverHandler } from './handlers/FailoverHandler';
import { HealthCheckHandler } from './handlers/HealthCheckHandler';
import { 
  ServiceError, 
  FailoverEvent, 
  AgentHealthStatus,
  FailoverServiceConfig 
} from './types/agent-failover.types';

/**
 * Agent Failover Management Service
 * 
 * Monitors agent health, detects failures, and orchestrates automatic failover
 * to backup agents while maintaining team functionality.
 */
class AgentFailoverService {
  private app: Express;
  private server: any;
  private io: SocketIOServer;
  private failoverManager: FailoverManager;
  private healthMonitor: HealthMonitor;
  private backupAgentPool: BackupAgentPool;
  private failoverHandler: FailoverHandler;
  private healthCheckHandler: HealthCheckHandler;
  private isShuttingDown: boolean = false;

  constructor(private serviceConfig: FailoverServiceConfig = config) {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.serviceConfig.cors.allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize core services and dependencies
   * 
   * @private
   */
  private initializeServices(): void {
    try {
      this.backupAgentPool = new BackupAgentPool(this.serviceConfig.backupPool);
      this.healthMonitor = new HealthMonitor(this.serviceConfig.healthMonitor);
      
      this.failoverManager = new FailoverManager({
        ...this.serviceConfig.failover,
        backupAgentPool: this.backupAgentPool,
        healthMonitor: this.healthMonitor
      });

      this.failoverHandler = new FailoverHandler(this.failoverManager);
      this.healthCheckHandler = new HealthCheckHandler(this.healthMonitor);

      console.log('✅ Core services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw new ServiceError('Service initialization failed', 'INIT_ERROR', 500);
    }
  }

  /**
   * Setup Express middleware
   * 
   * @private
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.serviceConfig.cors.allowedOrigins,
      credentials: true,
      optionsSuccessStatus: 200
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.serviceConfig.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests',
        retryAfter: '15 minutes'
      }
    });
    this.app.use(limiter);

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  /**
   * Setup API routes
   * 
   * @private
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Ready check endpoint
    this.app.get('/ready', async (req: Request, res: Response) => {
      try {
        const isReady = await this.checkServiceReadiness();
        if (isReady) {
          res.json({ status: 'ready', timestamp: new Date().toISOString() });
        } else {
          res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
        }
      } catch (error) {
        res.status(503).json({ 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString() 
        });
      }
    });

    // Failover endpoints
    this.app.post('/api/failover/trigger', this.failoverHandler.triggerFailover.bind(this.failoverHandler));
    this.app.post('/api/failover/rollback', this.failoverHandler.rollbackFailover.bind(this.failoverHandler));
    this.app.get('/api/failover/status/:eventId', this.failoverHandler.getFailoverStatus.bind(this.failoverHandler));
    this.app.get('/api/failover/history', this.failoverHandler.getFailoverHistory.bind(this.failoverHandler));

    // Health monitoring endpoints
    this.app.get('/api/health/agents', this.healthCheckHandler.getAgentHealth.bind(this.healthCheckHandler));
    this.app.post('/api/health/check/:agentId', this.healthCheckHandler.performHealthCheck.bind(this.healthCheckHandler));
    this.app.get('/api/health/metrics', this.healthCheckHandler.getHealthMetrics.bind(this.healthCheckHandler));

    // Backup agent pool endpoints
    this.app.get('/api/backup/agents', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agents = await this.backupAgentPool.getAvailableAgents();
        res.json({ agents });
      } catch (error) {
        next(error);
      }
    });

    this.app.post('/api/backup/agents/:agentId/activate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { agentId } = req.params;
        const result = await this.backupAgentPool.activateBackupAgent(agentId);
        res.json({ success: true, agent: result });
      } catch (error) {
        next(error);
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const metrics = await this.getServiceMetrics();
        res.json(metrics);
      } catch (error) {
        next(error);
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup WebSocket connections for real-time monitoring
   * 
   * @private
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle agent health subscription
      socket.on('subscribe:agent-health', async (data: { agentIds?: string[] }) => {
        try {
          const agentIds = data.agentIds || [];
          await this.healthMonitor.subscribeToAgentHealth(socket.id, agentIds);
          socket.emit('subscription:confirmed', { type: 'agent-health', agentIds });
        } catch (error) {
          socket.emit('subscription:error', { 
            error: error instanceof Error ? error.message : 'Subscription failed' 
          });
        }
      });

      // Handle failover event subscription
      socket.on('subscribe:failover-events', () => {
        socket.join('failover-events');
        socket.emit('subscription:confirmed', { type: 'failover-events' });
      });

      // Handle manual health check request
      socket.on('health-check:request', async (data: { agentId: string }) => {
        try {
          const healthStatus = await this.healthMonitor.checkAgentHealth(data.agentId);
          socket.emit('health-check:result', { agentId: data.agentId, status: healthStatus });
        } catch (error) {
          socket.emit('health-check:error', { 
            agentId: data.agentId,
            error: error instanceof Error ? error.message : 'Health check failed' 
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.healthMonitor.unsubscribeFromAgentHealth(socket.id);
      });
    });

    // Setup event listeners for broadcasting
    this.setupEventBroadcasting();
  }

  /**
   * Setup event broadcasting to WebSocket clients
   * 
   * @private
   */
  private setupEventBroadcasting(): void {
    // Broadcast health status changes
    this.healthMonitor.on('agent-health-changed', (data: AgentHealthStatus) => {
      this.io.emit('agent-health-update', data);
    });

    // Broadcast failover events
    this.failoverManager.on('failover-initiated', (event: FailoverEvent) => {
      this.io.to('failover-events').emit('failover-initiated', event);
    });

    this.failoverManager.on('failover-completed', (event: FailoverEvent) => {
      this.io.to('failover-events').emit('failover-completed', event);
    });

    this.failoverManager.on('failover-failed', (event: FailoverEvent) => {
      this.io.to('failover-events').emit('failover-failed', event);
    });
  }

  /**
   * Setup error handling middleware
   * 
   * @private
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('❌ Unhandled error:', error);

      if (error instanceof ServiceError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('❌ Uncaught exception:', error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      console.error('❌ Unhandled promise rejection:', reason);
      this.shutdown(1);
    });
  }

  /**
   * Setup graceful shutdown handlers
   * 
   * @private
   */
  private setupGracefulShutdown(): void {
    process.on('SIGTERM', () => this.shutdown(0));
    process.on('SIGINT', () => this.shutdown(0));
  }

  /**
   * Check if all services are ready
   * 
   * @private
   * @returns Promise<boolean> Service readiness status
   */
  private async checkServiceReadiness(): Promise<boolean> {
    try {
      const healthMonitorReady = await this.healthMonitor.isReady();
      const backupPoolReady = await this.backupAgentPool.isReady();
      const failoverManagerReady = await this.failoverManager.isReady();

      return healthMonitorReady && backupPoolReady && failoverManagerReady;
    } catch (error) {
      console.error('Service readiness check failed:', error);
      return false;
    }
  }

  /**
   * Get comprehensive service metrics
   * 
   * @private
   * @returns Promise<object> Service metrics
   */
  private async getServiceMetrics(): Promise<object> {
    const [healthMetrics, failoverMetrics, backupPoolMetrics] = await Promise.all([
      this.healthMonitor.getMetrics(),
      this.failoverManager.getMetrics(),
      this.backupAgentPool.getMetrics()
    ]);

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      health: healthMetrics,
      failover: failoverMetrics,
      backupPool: backupPoolMetrics,
      connections: {
        websocket: this.io.engine.clientsCount
      }
    };
  }

  /**
   * Start the failover service
   * 
   * @returns Promise<void>
   */
  public async start(): Promise<void> {
    try {
      // Start core services
      await this.healthMonitor.start();
      await this.backupAgentPool.start();
      await this.failoverManager.start();

      // Start HTTP server
      this.server.listen(this.serviceConfig.port, this.serviceConfig.host, () => {
        console.log(`🚀 Agent Failover Service running on ${this.serviceConfig.host}:${this.serviceConfig.port}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔧 Process ID: ${process.pid}`);
      });
    } catch (error) {
      console.error('❌ Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the service
   * 
   * @param exitCode Exit code for process termination
   */
  private async shutdown(exitCode: number): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🛑 Initiating graceful shutdown...');

    try {
      // Stop accepting new connections
      this.server.close();

      // Close WebSocket connections
      this.io.close();

      // Stop core services
      if (this.failoverManager) {
        await this.failoverManager.stop();
      }
      if (this.healthMonitor) {
        await this.healthMonitor.stop();
      }
      if (this.backupAgentPool) {
        await this.backupAgentPool.stop();
      }

      console.log('✅ Graceful shutdown completed');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }

    process.exit(exitCode);
  }
}

/**
 * Initialize and start the Agent Failover Service
 */
async function main(): Promise<void> {
  try {
    const service = new AgentFailoverService();
    await service.start();
  } catch (error) {
    console.error('❌ Failed to start Agent Failover Service:', error);
    process.exit(1);
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { AgentFailoverService };
export default main;
```