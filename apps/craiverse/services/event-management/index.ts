```typescript
/**
 * CRAIverse Event Management Service
 * 
 * Microservice for managing virtual events, gatherings, and experiences within CRAIverse.
 * Provides comprehensive event lifecycle management with real-time coordination.
 * 
 * @fileoverview Main service entry point for event management microservice
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventManager } from './core/EventManager';
import { InvitationSystem } from './core/InvitationSystem';
import { SchedulingEngine } from './core/SchedulingEngine';
import { RealtimeCoordinator } from './core/RealtimeCoordinator';
import { EventHandlers } from './handlers/EventHandlers';
import { InvitationHandlers } from './handlers/InvitationHandlers';
import { EventAuth } from './middleware/EventAuth';
import { RateLimiter } from './middleware/RateLimiter';
import { ServiceConfig } from './config/ServiceConfig';
import {
  EventServiceError,
  EventServiceResponse,
  ServiceHealth,
  EventMetrics,
  DatabaseError,
  ValidationError,
  AuthorizationError,
  NotFoundError
} from './types/EventTypes';

/**
 * Event Management Service Configuration Interface
 */
interface EventServiceConfig {
  port: number;
  supabaseUrl: string;
  supabaseKey: string;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Service Dependencies Interface
 */
interface ServiceDependencies {
  supabase: SupabaseClient;
  eventManager: EventManager;
  invitationSystem: InvitationSystem;
  schedulingEngine: SchedulingEngine;
  realtimeCoordinator: RealtimeCoordinator;
  eventHandlers: EventHandlers;
  invitationHandlers: InvitationHandlers;
  eventAuth: EventAuth;
  rateLimiter: RateLimiter;
}

/**
 * Main Event Management Service Class
 * 
 * Orchestrates all event management functionality including:
 * - Event creation, modification, and deletion
 * - Invitation system and participant management
 * - Real-time event coordination
 * - Scheduling and calendar integration
 * - Spatial event placement in CRAIverse
 */
export class EventManagementService {
  private app: Express;
  private server: any;
  private io: SocketIOServer;
  private config: EventServiceConfig;
  private dependencies: ServiceDependencies;
  private metrics: EventMetrics;
  private isShuttingDown: boolean = false;

  /**
   * Initialize Event Management Service
   * 
   * @param config - Service configuration
   */
  constructor(config: EventServiceConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });

    this.metrics = {
      totalEvents: 0,
      activeEvents: 0,
      totalInvitations: 0,
      activeConnections: 0,
      errorRate: 0,
      averageResponseTime: 0,
      lastHealthCheck: new Date()
    };

    this.initializeDependencies();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSockets();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize service dependencies
   * 
   * @private
   */
  private initializeDependencies(): void {
    try {
      // Initialize Supabase client
      const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

      // Initialize core services
      const eventManager = new EventManager(supabase);
      const invitationSystem = new InvitationSystem(supabase);
      const schedulingEngine = new SchedulingEngine(supabase);
      const realtimeCoordinator = new RealtimeCoordinator(this.io, supabase);

      // Initialize handlers
      const eventHandlers = new EventHandlers(eventManager, schedulingEngine);
      const invitationHandlers = new InvitationHandlers(invitationSystem);

      // Initialize middleware
      const eventAuth = new EventAuth(supabase);
      const rateLimiter = new RateLimiter({
        windowMs: this.config.rateLimitWindow,
        max: this.config.rateLimitMax
      });

      this.dependencies = {
        supabase,
        eventManager,
        invitationSystem,
        schedulingEngine,
        realtimeCoordinator,
        eventHandlers,
        invitationHandlers,
        eventAuth,
        rateLimiter
      };

      console.log('✅ Event Management Service dependencies initialized');
    } catch (error) {
      console.error('❌ Failed to initialize dependencies:', error);
      throw new EventServiceError('DEPENDENCY_INIT_FAILED', 'Failed to initialize service dependencies');
    }
  }

  /**
   * Setup Express middleware
   * 
   * @private
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true
    }));

    // Performance middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    this.app.use('/api/', this.dependencies.rateLimiter.getMiddleware());

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.updateMetrics('responseTime', duration);
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
    this.app.get('/health', this.getHealthCheck.bind(this));
    this.app.get('/metrics', this.getMetrics.bind(this));

    // Event management routes
    this.app.post('/api/events', 
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.createEvent.bind(this.dependencies.eventHandlers)
    );

    this.app.get('/api/events/:eventId',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.getEvent.bind(this.dependencies.eventHandlers)
    );

    this.app.put('/api/events/:eventId',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventAuth.authorizeEventAccess.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.updateEvent.bind(this.dependencies.eventHandlers)
    );

    this.app.delete('/api/events/:eventId',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventAuth.authorizeEventAccess.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.deleteEvent.bind(this.dependencies.eventHandlers)
    );

    this.app.get('/api/events',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.listEvents.bind(this.dependencies.eventHandlers)
    );

    // Invitation management routes
    this.app.post('/api/events/:eventId/invitations',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventAuth.authorizeEventAccess.bind(this.dependencies.eventAuth),
      this.dependencies.invitationHandlers.sendInvitation.bind(this.dependencies.invitationHandlers)
    );

    this.app.put('/api/invitations/:invitationId/respond',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.invitationHandlers.respondToInvitation.bind(this.dependencies.invitationHandlers)
    );

    this.app.get('/api/invitations',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.invitationHandlers.getUserInvitations.bind(this.dependencies.invitationHandlers)
    );

    // Event participation routes
    this.app.post('/api/events/:eventId/join',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.joinEvent.bind(this.dependencies.eventHandlers)
    );

    this.app.post('/api/events/:eventId/leave',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventHandlers.leaveEvent.bind(this.dependencies.eventHandlers)
    );

    // Scheduling routes
    this.app.get('/api/schedule/:userId',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.getUserSchedule.bind(this)
    );

    this.app.post('/api/events/:eventId/reschedule',
      this.dependencies.eventAuth.authenticate.bind(this.dependencies.eventAuth),
      this.dependencies.eventAuth.authorizeEventAccess.bind(this.dependencies.eventAuth),
      this.rescheduleEvent.bind(this)
    );
  }

  /**
   * Setup WebSocket connections for real-time coordination
   * 
   * @private
   */
  private setupWebSockets(): void {
    this.io.use(this.dependencies.eventAuth.authenticateSocket.bind(this.dependencies.eventAuth));

    this.io.on('connection', (socket) => {
      this.metrics.activeConnections++;
      console.log(`User connected: ${socket.data.userId}`);

      // Join event rooms
      socket.on('join-event', async (eventId: string) => {
        try {
          const hasAccess = await this.dependencies.eventAuth.checkEventAccess(
            socket.data.userId, 
            eventId
          );
          
          if (hasAccess) {
            socket.join(`event-${eventId}`);
            await this.dependencies.realtimeCoordinator.handleUserJoined(eventId, socket.data.userId);
            
            socket.emit('event-joined', { eventId, success: true });
            socket.to(`event-${eventId}`).emit('user-joined', {
              userId: socket.data.userId,
              eventId
            });
          } else {
            socket.emit('event-join-error', { error: 'Access denied' });
          }
        } catch (error) {
          socket.emit('event-join-error', { error: 'Failed to join event' });
        }
      });

      // Leave event rooms
      socket.on('leave-event', async (eventId: string) => {
        socket.leave(`event-${eventId}`);
        await this.dependencies.realtimeCoordinator.handleUserLeft(eventId, socket.data.userId);
        
        socket.to(`event-${eventId}`).emit('user-left', {
          userId: socket.data.userId,
          eventId
        });
      });

      // Handle event updates
      socket.on('event-update', async (data: any) => {
        try {
          const hasAccess = await this.dependencies.eventAuth.checkEventAccess(
            socket.data.userId, 
            data.eventId
          );
          
          if (hasAccess) {
            await this.dependencies.realtimeCoordinator.broadcastEventUpdate(data);
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to update event' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.metrics.activeConnections--;
        console.log(`User disconnected: ${socket.data.userId}`);
      });
    });
  }

  /**
   * Setup error handling
   * 
   * @private
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.updateMetrics('error', 1);

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details
        });
      }

      if (error instanceof AuthorizationError) {
        return res.status(403).json({
          success: false,
          error: 'AUTHORIZATION_ERROR',
          message: error.message
        });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: error.message
        });
      }

      if (error instanceof DatabaseError) {
        console.error('Database error:', error);
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Internal database error occurred'
        });
      }

      console.error('Unhandled error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      });
    });

    // Handle 404 routes
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      });
    });
  }

  /**
   * Setup graceful shutdown
   * 
   * @private
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      this.isShuttingDown = true;

      try {
        // Stop accepting new connections
        this.server.close(() => {
          console.log('✅ HTTP server closed');
        });

        // Close WebSocket connections
        this.io.close(() => {
          console.log('✅ WebSocket server closed');
        });

        // Cleanup dependencies
        await this.dependencies.realtimeCoordinator.cleanup();
        console.log('✅ Real-time coordinator cleaned up');

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Get health check status
   * 
   * @param req - Express request
   * @param res - Express response
   */
  private async getHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health: ServiceHealth = {
        status: this.isShuttingDown ? 'shutting-down' : 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        dependencies: {
          database: await this.checkDatabaseHealth(),
          realtime: this.dependencies.realtimeCoordinator.isHealthy(),
          scheduling: this.dependencies.schedulingEngine.isHealthy()
        },
        metrics: this.metrics
      };

      this.metrics.lastHealthCheck = new Date();
      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get service metrics
   * 
   * @param req - Express request
   * @param res - Express response
   */
  private getMetrics(req: Request, res: Response): void {
    res.json({
      success: true,
      data: this.metrics
    });
  }

  /**
   * Get user schedule
   * 
   * @param req - Express request
   * @param res - Express response
   */
  private async getUserSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const schedule = await this.dependencies.schedulingEngine.getUserSchedule(
        userId,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: schedule
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reschedule event
   * 
   * @param req - Express request
   * @param res - Express response
   */
  private async rescheduleEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const { newStartTime, newEndTime, reason } = req.body;

      const result = await this.dependencies.schedulingEngine.rescheduleEvent(
        eventId,
        new Date(newStartTime),
        new Date(newEndTime),
        reason
      );

      if (result.success) {
        // Notify participants of reschedule
        await this.dependencies.realtimeCoordinator.broadcastEventReschedule({
          eventId,
          newStartTime,
          newEndTime,
          reason
        });
      }

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check database connectivity
   * 
   * @private
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      const { data, error } = await this.dependencies.supabase
        .from('craiverse_events')
        .select('count(*)')
        .limit(1);

      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update service metrics
   * 
   * @private
   */
  private updateMetrics(metric: string, value: number): void {
    switch (metric) {
      case 'event':
        this.metrics.totalEvents += value;
        break;
      case 'invitation':
        this.metrics.totalInvitations += value;
        break;
      case 'error':
        this.metrics.errorRate = (this.metrics.errorRate + value) / 2;
        break;
      case 'responseTime':
        this.metrics.averageResponseTime = 
          (this.metrics.averageResponseTime + value) / 2;
        break;
    }
  }

  /**
   * Start the service
   * 
   * @returns Promise that resolves when service is running
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, () => {
          console.log(`🚀 Event Management Service started on port ${this.config.port}`);
          console.log(`📊 Metrics available at http://localhost:${this.config.port}/metrics`);
          console.log(`❤️  Health check at http://localhost:${this.config.port}/health`);
          resolve();
        });
      } catch (error) {
        console.error('❌ Failed to start Event Management Service:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the service
   * 
   * @returns Promise that resolves when service is stopped
   */
  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('✅ Event Management Service stopped');
        resolve();
      });
    });
  }
}

/**
 * Service factory function
 * 
 * @param config - Service configuration
 * @returns Configured service instance
 */
export function createEventManagementService(
  config?: Partial<EventServiceConfig>
): EventManagementService {
  const serviceConfig = ServiceConfig.load(config);
  return new EventManagementService(serviceConfig);
}

/**
 * Default export for service instance
 */
export default EventManagementService;

// Auto-start service if run directly
if (require.main === module) {
  const service = createEventManagementService();
  service.start().catch(console.error);
}
```