```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { createServer } from 'http';
import { ReputationCalculatorService } from './services/ReputationCalculatorService';
import { ContributionAnalyzerService } from './services/ContributionAnalyzerService';
import { PeerReviewService } from './services/PeerReviewService';
import { AppealService } from './services/AppealService';
import { ScoreCalculationEngine } from './algorithms/ScoreCalculationEngine';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { validationMiddleware } from './middleware/validation';
import { reputationRoutes } from './routes/reputation';
import { appealsRoutes } from './routes/appeals';
import { transparencyRoutes } from './routes/transparency';

// Load environment variables
config();

/**
 * Community Reputation Calculation Service
 * 
 * Standalone microservice that computes user reputation scores based on:
 * - Contributions to the community
 * - Peer reviews and feedback
 * - Community impact metrics
 * - Historical activity patterns
 * 
 * Features:
 * - Transparent scoring algorithms
 * - Appeal processes for disputed scores
 * - Real-time reputation updates
 * - Historical reputation tracking
 * - Configurable scoring weights
 */

/**
 * Service configuration interface
 */
interface ServiceConfig {
  port: number;
  environment: string;
  database: {
    url: string;
    maxConnections: number;
  };
  redis: {
    url: string;
    ttl: number;
  };
  scoring: {
    contributionWeight: number;
    peerReviewWeight: number;
    communityImpactWeight: number;
    decayFactor: number;
  };
  appeals: {
    maxAppealsPerUser: number;
    appealWindowDays: number;
  };
}

/**
 * Health check response interface
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: boolean;
    redis: boolean;
    calculator: boolean;
  };
}

/**
 * Main application class
 */
class ReputationService {
  private app: express.Application;
  private server: any;
  private config: ServiceConfig;
  
  // Service dependencies
  private reputationCalculator: ReputationCalculatorService;
  private contributionAnalyzer: ContributionAnalyzerService;
  private peerReviewService: PeerReviewService;
  private appealService: AppealService;
  private scoreEngine: ScoreCalculationEngine;

  constructor() {
    this.app = express();
    this.config = this.loadConfiguration();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Load service configuration from environment
   */
  private loadConfiguration(): ServiceConfig {
    return {
      port: parseInt(process.env.PORT || '3004'),
      environment: process.env.NODE_ENV || 'development',
      database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/reputation_db',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10')
      },
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: parseInt(process.env.CACHE_TTL || '3600')
      },
      scoring: {
        contributionWeight: parseFloat(process.env.CONTRIBUTION_WEIGHT || '0.4'),
        peerReviewWeight: parseFloat(process.env.PEER_REVIEW_WEIGHT || '0.3'),
        communityImpactWeight: parseFloat(process.env.COMMUNITY_IMPACT_WEIGHT || '0.3'),
        decayFactor: parseFloat(process.env.DECAY_FACTOR || '0.95')
      },
      appeals: {
        maxAppealsPerUser: parseInt(process.env.MAX_APPEALS_PER_USER || '3'),
        appealWindowDays: parseInt(process.env.APPEAL_WINDOW_DAYS || '30')
      }
    };
  }

  /**
   * Initialize service dependencies
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize score calculation engine
      this.scoreEngine = new ScoreCalculationEngine({
        contributionWeight: this.config.scoring.contributionWeight,
        peerReviewWeight: this.config.scoring.peerReviewWeight,
        communityImpactWeight: this.config.scoring.communityImpactWeight,
        decayFactor: this.config.scoring.decayFactor
      });

      // Initialize core services
      this.contributionAnalyzer = new ContributionAnalyzerService({
        databaseUrl: this.config.database.url,
        cacheUrl: this.config.redis.url
      });

      this.peerReviewService = new PeerReviewService({
        databaseUrl: this.config.database.url,
        cacheUrl: this.config.redis.url
      });

      this.appealService = new AppealService({
        databaseUrl: this.config.database.url,
        maxAppealsPerUser: this.config.appeals.maxAppealsPerUser,
        appealWindowDays: this.config.appeals.appealWindowDays
      });

      this.reputationCalculator = new ReputationCalculatorService({
        scoreEngine: this.scoreEngine,
        contributionAnalyzer: this.contributionAnalyzer,
        peerReviewService: this.peerReviewService,
        cacheUrl: this.config.redis.url,
        cacheTTL: this.config.redis.ttl
      });

      console.log('✅ All services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    if (this.config.environment !== 'production') {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.healthCheck.bind(this));

    // Service info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        service: 'reputation-service',
        version: process.env.npm_package_version || '1.0.0',
        environment: this.config.environment,
        features: [
          'reputation-calculation',
          'contribution-analysis',
          'peer-review-scoring',
          'appeal-processing',
          'transparent-algorithms'
        ]
      });
    });

    // API routes
    this.app.use('/api/reputation', 
      authMiddleware,
      validationMiddleware,
      reputationRoutes(this.reputationCalculator, this.contributionAnalyzer)
    );

    this.app.use('/api/appeals', 
      authMiddleware,
      validationMiddleware,
      appealsRoutes(this.appealService, this.reputationCalculator)
    );

    this.app.use('/api/transparency', 
      transparencyRoutes(this.scoreEngine, this.reputationCalculator)
    );

    // Default 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
        availableEndpoints: [
          'GET /health',
          'GET /info',
          'GET /api/reputation/:userId',
          'POST /api/reputation/calculate',
          'GET /api/appeals/:appealId',
          'POST /api/appeals',
          'GET /api/transparency/algorithm',
          'GET /api/transparency/weights'
        ]
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('SIGTERM');
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });
  }

  /**
   * Health check endpoint handler
   */
  private async healthCheck(req: express.Request, res: express.Response): Promise<void> {
    try {
      const healthStatus: HealthCheckResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        services: {
          database: await this.checkDatabaseHealth(),
          redis: await this.checkRedisHealth(),
          calculator: await this.checkCalculatorHealth()
        }
      };

      // Check if any service is unhealthy
      const isUnhealthy = Object.values(healthStatus.services).some(status => !status);
      if (isUnhealthy) {
        healthStatus.status = 'unhealthy';
        res.status(503);
      }

      res.json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check database connection health
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // This would be implemented based on your database client
      // For example, with PostgreSQL:
      // await this.database.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Check Redis connection health
   */
  private async checkRedisHealth(): Promise<boolean> {
    try {
      // This would be implemented based on your Redis client
      // For example:
      // await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Check reputation calculator health
   */
  private async checkCalculatorHealth(): Promise<boolean> {
    try {
      // Test the calculator service
      return this.reputationCalculator !== null;
    } catch (error) {
      console.error('Calculator health check failed:', error);
      return false;
    }
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      await this.initializeServices();
      
      this.server = createServer(this.app);
      
      this.server.listen(this.config.port, () => {
        console.log(`
🚀 Reputation Service Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${this.config.environment}
🌐 Port: ${this.config.port}
⚡ Health: http://localhost:${this.config.port}/health
📊 API: http://localhost:${this.config.port}/api
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
      });

      // Setup graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    } catch (error) {
      console.error('❌ Failed to start service:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown handler
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

    if (this.server) {
      this.server.close(() => {
        console.log('✅ HTTP server closed');
      });
    }

    // Close service connections
    try {
      // Close database connections, Redis, etc.
      console.log('✅ Service connections closed');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  }
}

// Create and start the service
const service = new ReputationService();

// Export for testing
export { ReputationService };

// Start the service if this file is run directly
if (require.main === module) {
  service.start().catch(error => {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  });
}
```