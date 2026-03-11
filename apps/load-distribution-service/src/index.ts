```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import { LoadBalancer } from './core/LoadBalancer.js';
import { GeolocationRouter } from './core/GeolocationRouter.js';
import { CapacityMonitor } from './core/CapacityMonitor.js';
import { NetworkAnalyzer } from './core/NetworkAnalyzer.js';
import { FailoverManager } from './core/FailoverManager.js';
import { HealthChecker } from './core/HealthChecker.js';
import { RegionManager } from './services/RegionManager.js';
import { MetricsCollector } from './services/MetricsCollector.js';
import { DisasterRecovery } from './services/DisasterRecovery.js';
import { RateLimiter } from './middleware/RateLimiter.js';
import { RequestLogger } from './middleware/RequestLogger.js';
import { LoadDistributionRequest, LoadDistributionResponse, ServerInstance } from './types/distribution.js';

/**
 * Global Load Distribution Service
 * 
 * Intelligently distributes load across global infrastructure based on:
 * - User geolocation and proximity
 * - Server capacity and performance metrics
 * - Network conditions and latency
 * - Real-time health checks and failover capabilities
 * 
 * Features:
 * - Multi-region load balancing
 * - Automatic failover and disaster recovery
 * - Real-time capacity monitoring
 * - Network-aware routing decisions
 * - Rate limiting and request logging
 */
export class LoadDistributionService {
  private readonly app: Express;
  private readonly supabase: ReturnType<typeof createClient>;
  private readonly loadBalancer: LoadBalancer;
  private readonly geolocationRouter: GeolocationRouter;
  private readonly capacityMonitor: CapacityMonitor;
  private readonly networkAnalyzer: NetworkAnalyzer;
  private readonly failoverManager: FailoverManager;
  private readonly healthChecker: HealthChecker;
  private readonly regionManager: RegionManager;
  private readonly metricsCollector: MetricsCollector;
  private readonly disasterRecovery: DisasterRecovery;
  private readonly rateLimiter: RateLimiter;
  private readonly requestLogger: RequestLogger;
  private readonly port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Initialize core services
    this.regionManager = new RegionManager();
    this.metricsCollector = new MetricsCollector(this.supabase);
    this.healthChecker = new HealthChecker();
    this.capacityMonitor = new CapacityMonitor(this.metricsCollector);
    this.networkAnalyzer = new NetworkAnalyzer();
    this.geolocationRouter = new GeolocationRouter(this.regionManager);
    this.failoverManager = new FailoverManager(this.healthChecker);
    this.disasterRecovery = new DisasterRecovery(this.regionManager, this.metricsCollector);
    this.loadBalancer = new LoadBalancer(
      this.geolocationRouter,
      this.capacityMonitor,
      this.networkAnalyzer,
      this.failoverManager
    );

    // Initialize middleware
    this.rateLimiter = new RateLimiter();
    this.requestLogger = new RequestLogger(this.metricsCollector);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware stack
   */
  private setupMiddleware(): void {
    // Security and compression
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(this.requestLogger.middleware.bind(this.requestLogger));
    this.app.use(this.rateLimiter.middleware.bind(this.rateLimiter));
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const health = await this.healthChecker.getOverallHealth();
        res.status(health.healthy ? 200 : 503).json(health);
      } catch (error) {
        res.status(500).json({
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Load distribution endpoint
    this.app.post('/distribute', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const distributionRequest: LoadDistributionRequest = req.body;
        
        // Validate request
        if (!distributionRequest.clientIp || !distributionRequest.requestType) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request: clientIp and requestType are required'
          });
        }

        // Perform load distribution
        const result = await this.loadBalancer.distribute(distributionRequest);
        
        const response: LoadDistributionResponse = {
          success: true,
          targetServer: result.targetServer,
          routingDecision: result.routingDecision,
          failoverApplied: result.failoverApplied,
          estimatedLatency: result.estimatedLatency,
          loadBalancingAlgorithm: result.algorithm,
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    });

    // Server registration endpoint
    this.app.post('/servers/register', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const serverInstance: ServerInstance = req.body;
        
        // Validate server instance
        if (!serverInstance.id || !serverInstance.endpoint || !serverInstance.region) {
          return res.status(400).json({
            success: false,
            error: 'Invalid server instance: id, endpoint, and region are required'
          });
        }

        await this.regionManager.registerServer(serverInstance);
        
        res.json({
          success: true,
          message: 'Server registered successfully',
          serverId: serverInstance.id
        });
      } catch (error) {
        next(error);
      }
    });

    // Server deregistration endpoint
    this.app.delete('/servers/:serverId', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { serverId } = req.params;
        await this.regionManager.deregisterServer(serverId);
        
        res.json({
          success: true,
          message: 'Server deregistered successfully'
        });
      } catch (error) {
        next(error);
      }
    });

    // Capacity metrics endpoint
    this.app.get('/metrics/capacity', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const capacityMetrics = await this.capacityMonitor.getGlobalCapacity();
        res.json(capacityMetrics);
      } catch (error) {
        next(error);
      }
    });

    // Network metrics endpoint
    this.app.get('/metrics/network', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const networkMetrics = await this.networkAnalyzer.getGlobalNetworkStatus();
        res.json(networkMetrics);
      } catch (error) {
        next(error);
      }
    });

    // Failover status endpoint
    this.app.get('/failover/status', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const failoverStatus = await this.failoverManager.getFailoverStatus();
        res.json(failoverStatus);
      } catch (error) {
        next(error);
      }
    });

    // Manual failover trigger endpoint
    this.app.post('/failover/trigger', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { serverId, reason } = req.body;
        
        if (!serverId) {
          return res.status(400).json({
            success: false,
            error: 'Server ID is required'
          });
        }

        await this.failoverManager.triggerFailover(serverId, reason || 'Manual failover');
        
        res.json({
          success: true,
          message: 'Failover triggered successfully'
        });
      } catch (error) {
        next(error);
      }
    });

    // Disaster recovery status endpoint
    this.app.get('/disaster-recovery/status', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const drStatus = await this.disasterRecovery.getRecoveryStatus();
        res.json(drStatus);
      } catch (error) {
        next(error);
      }
    });

    // Disaster recovery activation endpoint
    this.app.post('/disaster-recovery/activate', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { region, reason } = req.body;
        
        if (!region) {
          return res.status(400).json({
            success: false,
            error: 'Region is required'
          });
        }

        await this.disasterRecovery.activateRecovery(region, reason || 'Manual activation');
        
        res.json({
          success: true,
          message: 'Disaster recovery activated successfully'
        });
      } catch (error) {
        next(error);
      }
    });

    // Regions information endpoint
    this.app.get('/regions', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const regions = await this.regionManager.getAllRegions();
        res.json(regions);
      } catch (error) {
        next(error);
      }
    });

    // Global metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const metrics = await this.metricsCollector.getGlobalMetrics();
        res.json(metrics);
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Configure error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Global error handler:', error);

      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Initialize and start background services
   */
  private async initializeServices(): Promise<void> {
    try {
      console.log('Initializing load distribution services...');

      // Initialize region manager and load initial configuration
      await this.regionManager.initialize();
      console.log('✓ Region manager initialized');

      // Start health checking
      await this.healthChecker.startHealthChecking();
      console.log('✓ Health checker started');

      // Start capacity monitoring
      await this.capacityMonitor.startMonitoring();
      console.log('✓ Capacity monitor started');

      // Start network analysis
      await this.networkAnalyzer.startAnalysis();
      console.log('✓ Network analyzer started');

      // Initialize metrics collection
      await this.metricsCollector.initialize();
      console.log('✓ Metrics collector initialized');

      // Initialize disaster recovery
      await this.disasterRecovery.initialize();
      console.log('✓ Disaster recovery initialized');

      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Start the load distribution service
   */
  public async start(): Promise<void> {
    try {
      // Initialize all services
      await this.initializeServices();

      // Start HTTP server
      const server = this.app.listen(this.port, () => {
        console.log(`🚀 Load Distribution Service running on port ${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🌍 Load distribution: http://localhost:${this.port}/distribute`);
      });

      // Graceful shutdown handling
      const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        
        server.close(async () => {
          try {
            await this.healthChecker.stopHealthChecking();
            await this.capacityMonitor.stopMonitoring();
            await this.networkAnalyzer.stopAnalysis();
            await this.metricsCollector.shutdown();
            console.log('✓ Load Distribution Service shut down successfully');
            process.exit(0);
          } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
          }
        });

        // Force exit after 30 seconds
        setTimeout(() => {
          console.log('Force shutting down...');
          process.exit(1);
        }, 30000);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
      console.error('Failed to start Load Distribution Service:', error);
      process.exit(1);
    }
  }

  /**
   * Get service instance for testing
   */
  public getApp(): Express {
    return this.app;
  }
}

// Auto-start service if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new LoadDistributionService();
  service.start().catch((error) => {
    console.error('Failed to start service:', error);
    process.exit(1);
  });
}

export default LoadDistributionService;
```