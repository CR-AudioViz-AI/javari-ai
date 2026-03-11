```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { SyncEngine } from './core/SyncEngine';
import { DeduplicationEngine } from './core/DeduplicationEngine';
import { FieldMapper } from './core/FieldMapper';
import { ConflictResolver } from './core/ConflictResolver';
import { SalesforceConnector } from './connectors/SalesforceConnector';
import { HubSpotConnector } from './connectors/HubSpotConnector';
import { DynamicsConnector } from './connectors/DynamicsConnector';
import { SyncJobQueue } from './queue/SyncJobQueue';
import { CRMWebhookHandler } from './webhooks/CRMWebhookHandler';
import syncRoutes from './api/routes/sync';
import type { CRMConnector, SyncConfiguration, ServiceHealth } from './types';

/**
 * CRM Synchronization Microservice
 * 
 * Provides bidirectional synchronization between multiple CRM systems
 * with advanced features for deduplication, field mapping, and conflict resolution.
 */
class CRMSyncService {
  private app: express.Application;
  private supabase: ReturnType<typeof createClient>;
  private redis: Redis;
  private syncEngine: SyncEngine;
  private deduplicationEngine: DeduplicationEngine;
  private fieldMapper: FieldMapper;
  private conflictResolver: ConflictResolver;
  private syncJobQueue: SyncJobQueue;
  private webhookHandler: CRMWebhookHandler;
  private connectors: Map<string, CRMConnector> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.initializeClients();
  }

  /**
   * Sets up Express middleware for security, parsing, and optimization
   */
  private setupMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Initializes external service clients
   */
  private initializeClients(): void {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Redis client
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  /**
   * Initializes all service components and CRM connectors
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize core engines
      this.fieldMapper = new FieldMapper();
      this.conflictResolver = new ConflictResolver();
      this.deduplicationEngine = new DeduplicationEngine(this.supabase);
      
      // Initialize job queue
      this.syncJobQueue = new SyncJobQueue(this.redis);

      // Initialize CRM connectors
      await this.initializeConnectors();

      // Initialize sync engine with all dependencies
      this.syncEngine = new SyncEngine({
        supabase: this.supabase,
        connectors: this.connectors,
        deduplicationEngine: this.deduplicationEngine,
        fieldMapper: this.fieldMapper,
        conflictResolver: this.conflictResolver,
        syncJobQueue: this.syncJobQueue,
      });

      // Initialize webhook handler
      this.webhookHandler = new CRMWebhookHandler({
        syncEngine: this.syncEngine,
        syncJobQueue: this.syncJobQueue,
      });

      // Setup routes
      this.setupRoutes();

      // Start background job processing
      await this.startJobProcessing();

      this.isInitialized = true;
      console.log('CRM Sync Service initialized successfully');

    } catch (error) {
      console.error('Failed to initialize CRM Sync Service:', error);
      throw error;
    }
  }

  /**
   * Initializes all CRM system connectors
   */
  private async initializeConnectors(): Promise<void> {
    const connectorConfigs = [
      {
        name: 'salesforce',
        connector: new SalesforceConnector({
          clientId: process.env.SALESFORCE_CLIENT_ID!,
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
          redirectUri: process.env.SALESFORCE_REDIRECT_URI!,
          environment: process.env.SALESFORCE_ENVIRONMENT || 'production',
        }),
      },
      {
        name: 'hubspot',
        connector: new HubSpotConnector({
          apiKey: process.env.HUBSPOT_API_KEY!,
          clientId: process.env.HUBSPOT_CLIENT_ID!,
          clientSecret: process.env.HUBSPOT_CLIENT_SECRET!,
          redirectUri: process.env.HUBSPOT_REDIRECT_URI!,
        }),
      },
      {
        name: 'dynamics',
        connector: new DynamicsConnector({
          tenantId: process.env.DYNAMICS_TENANT_ID!,
          clientId: process.env.DYNAMICS_CLIENT_ID!,
          clientSecret: process.env.DYNAMICS_CLIENT_SECRET!,
          resource: process.env.DYNAMICS_RESOURCE!,
        }),
      },
    ];

    for (const { name, connector } of connectorConfigs) {
      try {
        await connector.initialize();
        this.connectors.set(name, connector);
        console.log(`${name} connector initialized successfully`);
      } catch (error) {
        console.error(`Failed to initialize ${name} connector:`, error);
        // Continue with other connectors even if one fails
      }
    }

    if (this.connectors.size === 0) {
      throw new Error('No CRM connectors could be initialized');
    }
  }

  /**
   * Sets up API routes and webhook endpoints
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getServiceHealth();
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.getSyncMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to retrieve metrics',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // CRM webhook endpoints
    this.app.use('/webhooks', this.webhookHandler.getRouter());

    // Main sync API routes
    this.app.use('/api/sync', syncRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
      });
    });
  }

  /**
   * Starts background job processing for sync operations
   */
  private async startJobProcessing(): Promise<void> {
    // Start processing sync jobs
    this.syncJobQueue.startProcessing(async (job) => {
      try {
        console.log(`Processing sync job ${job.id} for ${job.crmSystem}`);
        await this.syncEngine.processSyncJob(job);
        console.log(`Completed sync job ${job.id}`);
      } catch (error) {
        console.error(`Failed to process sync job ${job.id}:`, error);
        throw error;
      }
    });

    // Schedule periodic full synchronization
    setInterval(async () => {
      try {
        await this.schedulePeriodicSync();
      } catch (error) {
        console.error('Failed to schedule periodic sync:', error);
      }
    }, parseInt(process.env.PERIODIC_SYNC_INTERVAL || '3600000')); // Default: 1 hour
  }

  /**
   * Schedules periodic full synchronization for all connected CRMs
   */
  private async schedulePeriodicSync(): Promise<void> {
    for (const [crmSystem, connector] of this.connectors) {
      if (await connector.isConnected()) {
        await this.syncJobQueue.enqueue({
          crmSystem,
          operation: 'full_sync',
          priority: 'low',
          scheduledAt: new Date(),
          metadata: {
            type: 'periodic',
            initiatedBy: 'system',
          },
        });
      }
    }
  }

  /**
   * Gets comprehensive service health status
   */
  private async getServiceHealth(): Promise<ServiceHealth> {
    const health: ServiceHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      metrics: {
        totalSyncJobs: 0,
        activeSyncJobs: 0,
        failedSyncJobs: 0,
        connectedCRMs: this.connectors.size,
      },
    };

    try {
      // Check database connectivity
      const { error: dbError } = await this.supabase.from('sync_jobs').select('count').limit(1);
      health.services.database = dbError ? 'unhealthy' : 'healthy';

      // Check Redis connectivity
      try {
        await this.redis.ping();
        health.services.redis = 'healthy';
      } catch {
        health.services.redis = 'unhealthy';
      }

      // Check CRM connectors
      for (const [name, connector] of this.connectors) {
        try {
          const isConnected = await connector.isConnected();
          health.services[`crm_${name}`] = isConnected ? 'healthy' : 'unhealthy';
        } catch {
          health.services[`crm_${name}`] = 'unhealthy';
        }
      }

      // Get sync job metrics
      const jobMetrics = await this.syncJobQueue.getMetrics();
      health.metrics = {
        ...health.metrics,
        ...jobMetrics,
      };

      // Determine overall health status
      const unhealthyServices = Object.values(health.services).filter(status => status !== 'healthy');
      if (unhealthyServices.length > 0) {
        health.status = unhealthyServices.length === Object.keys(health.services).length ? 'unhealthy' : 'degraded';
      }

    } catch (error) {
      console.error('Health check error:', error);
      health.status = 'error';
      health.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return health;
  }

  /**
   * Gets detailed sync metrics and statistics
   */
  private async getSyncMetrics(): Promise<Record<string, any>> {
    try {
      const [jobMetrics, syncStats] = await Promise.all([
        this.syncJobQueue.getMetrics(),
        this.syncEngine.getSyncStatistics(),
      ]);

      return {
        jobs: jobMetrics,
        sync: syncStats,
        connectors: Array.from(this.connectors.entries()).map(([name, connector]) => ({
          name,
          connected: connector.isConnected(),
          lastSync: connector.getLastSyncTime(),
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gracefully shuts down the service
   */
  private async shutdown(): Promise<void> {
    console.log('Shutting down CRM Sync Service...');

    try {
      // Stop job processing
      if (this.syncJobQueue) {
        await this.syncJobQueue.stop();
      }

      // Disconnect from external services
      if (this.redis) {
        this.redis.disconnect();
      }

      // Close CRM connections
      for (const [name, connector] of this.connectors) {
        try {
          await connector.disconnect();
          console.log(`Disconnected from ${name}`);
        } catch (error) {
          console.error(`Error disconnecting from ${name}:`, error);
        }
      }

      console.log('CRM Sync Service shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Starts the CRM synchronization service
   */
  public async start(): Promise<void> {
    try {
      await this.initializeServices();

      const port = parseInt(process.env.PORT || '3001');
      const server = this.app.listen(port, () => {
        console.log(`CRM Sync Service running on port ${port}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Connected CRMs: ${Array.from(this.connectors.keys()).join(', ')}`);
      });

      // Graceful shutdown handling
      const gracefulShutdown = async () => {
        console.log('Received shutdown signal');
        server.close(async () => {
          await this.shutdown();
          process.exit(0);
        });

        // Force shutdown after timeout
        setTimeout(() => {
          console.log('Force shutdown');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);
      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled rejection at:', promise, 'reason:', reason);
      });

      process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error);
        process.exit(1);
      });

    } catch (error) {
      console.error('Failed to start CRM Sync Service:', error);
      process.exit(1);
    }
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const service = new CRMSyncService();
  service.start();
}

export { CRMSyncService };
export default CRMSyncService;
```