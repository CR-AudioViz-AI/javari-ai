/**
 * @fileoverview Enterprise Accounting Integration Service
 * 
 * Provides real-time synchronization with QuickBooks Enterprise, NetSuite, 
 * and other ERP systems with automated reconciliation and audit trails.
 * 
 * @author CR AudioViz AI Engineering Team
 * @version 1.0.0
 * @since 2024
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer, Server } from 'http';
import { EventEmitter } from 'events';
import winston from 'winston';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { z } from 'zod';

/**
 * Configuration schema for the accounting integration service
 */
const ConfigSchema = z.object({
  port: z.number().default(3010),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  database: z.object({
    host: z.string(),
    port: z.number().default(5432),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    ssl: z.boolean().default(true),
    maxConnections: z.number().default(20),
  }),
  redis: z.object({
    host: z.string(),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0),
  }),
  quickbooks: z.object({
    appId: z.string(),
    appSecret: z.string(),
    discoveryUrl: z.string(),
    redirectUri: z.string(),
  }),
  netsuite: z.object({
    accountId: z.string(),
    consumerKey: z.string(),
    consumerSecret: z.string(),
    tokenId: z.string(),
    tokenSecret: z.string(),
  }),
  sage: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    apiUrl: z.string(),
  }),
  encryption: z.object({
    algorithm: z.string().default('aes-256-gcm'),
    secretKey: z.string(),
    ivLength: z.number().default(16),
  }),
  webhooks: z.object({
    secret: z.string(),
    timeout: z.number().default(30000),
  }),
  audit: z.object({
    retention: z.number().default(2555), // 7 years in days
    batchSize: z.number().default(1000),
  }),
});

export type AccountingServiceConfig = z.infer<typeof ConfigSchema>;

/**
 * Transaction entity schema
 */
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string(),
  systemType: z.enum(['quickbooks', 'netsuite', 'sage']),
  type: z.enum(['invoice', 'payment', 'expense', 'journal']),
  amount: z.number(),
  currency: z.string().length(3),
  date: z.date(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    amount: z.number(),
    taxAmount: z.number().optional(),
  })),
  status: z.enum(['pending', 'synced', 'failed', 'reconciled']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * Reconciliation result schema
 */
export const ReconciliationResultSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  status: z.enum(['matched', 'unmatched', 'disputed']),
  confidence: z.number().min(0).max(1),
  differences: z.array(z.object({
    field: z.string(),
    expected: z.unknown(),
    actual: z.unknown(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  reconciledAt: z.date(),
  reconciledBy: z.string(),
});

export type ReconciliationResult = z.infer<typeof ReconciliationResultSchema>;

/**
 * Audit trail entry schema
 */
export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.enum(['create', 'update', 'delete', 'sync', 'reconcile']),
  changes: z.record(z.object({
    oldValue: z.unknown(),
    newValue: z.unknown(),
  })),
  userId: z.string(),
  sessionId: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/**
 * Base error class for accounting integration errors
 */
export class AccountingIntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AccountingIntegrationError';
  }
}

/**
 * Connection error for external systems
 */
export class ConnectionError extends AccountingIntegrationError {
  constructor(system: string, message: string, details?: unknown) {
    super(
      `Failed to connect to ${system}: ${message}`,
      'CONNECTION_ERROR',
      503,
      details
    );
  }
}

/**
 * Synchronization error
 */
export class SyncError extends AccountingIntegrationError {
  constructor(message: string, details?: unknown) {
    super(message, 'SYNC_ERROR', 422, details);
  }
}

/**
 * Reconciliation error
 */
export class ReconciliationError extends AccountingIntegrationError {
  constructor(message: string, details?: unknown) {
    super(message, 'RECONCILIATION_ERROR', 422, details);
  }
}

/**
 * Authentication error for external systems
 */
export class AuthenticationError extends AccountingIntegrationError {
  constructor(system: string, message: string) {
    super(
      `Authentication failed for ${system}: ${message}`,
      'AUTH_ERROR',
      401
    );
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AccountingIntegrationError {
  constructor(system: string, resetTime?: Date) {
    super(
      `Rate limit exceeded for ${system}`,
      'RATE_LIMIT_ERROR',
      429,
      { resetTime }
    );
  }
}

/**
 * Base connector interface for accounting systems
 */
export interface AccountingConnector {
  readonly systemType: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  authenticate(): Promise<boolean>;
  syncTransactions(since?: Date): Promise<Transaction[]>;
  createTransaction(transaction: Partial<Transaction>): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  getTransaction(id: string): Promise<Transaction | null>;
  validateWebhook(payload: string, signature: string): boolean;
}

/**
 * Reconciliation engine interface
 */
export interface ReconciliationEngine {
  reconcile(transactions: Transaction[]): Promise<ReconciliationResult[]>;
  autoReconcile(threshold?: number): Promise<ReconciliationResult[]>;
  manualReconcile(transactionId: string, userId: string): Promise<ReconciliationResult>;
  getReconciliationResults(filters?: Record<string, unknown>): Promise<ReconciliationResult[]>;
}

/**
 * Audit trail manager interface
 */
export interface AuditTrailManager {
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void>;
  query(filters: Record<string, unknown>): Promise<AuditEntry[]>;
  export(format: 'csv' | 'json' | 'pdf', filters?: Record<string, unknown>): Promise<Buffer>;
  purge(olderThan: Date): Promise<number>;
}

/**
 * Transaction processor interface
 */
export interface TransactionProcessor {
  process(transaction: Transaction): Promise<Transaction>;
  validate(transaction: Partial<Transaction>): Promise<boolean>;
  transform(data: unknown, systemType: string): Promise<Transaction>;
  batch(transactions: Transaction[]): Promise<Transaction[]>;
}

/**
 * Sync queue interface
 */
export interface SyncQueue {
  enqueue(job: SyncJob): Promise<void>;
  dequeue(): Promise<SyncJob | null>;
  peek(): Promise<SyncJob | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

/**
 * Sync job schema
 */
export const SyncJobSchema = z.object({
  id: z.string().uuid(),
  systemType: z.string(),
  operation: z.enum(['sync', 'reconcile', 'audit']),
  payload: z.record(z.unknown()),
  priority: z.number().min(1).max(10).default(5),
  retries: z.number().min(0).default(0),
  maxRetries: z.number().min(0).default(3),
  scheduledAt: z.date(),
  createdAt: z.date(),
});

export type SyncJob = z.infer<typeof SyncJobSchema>;

/**
 * Main accounting integration service class
 */
export class AccountingIntegrationService extends EventEmitter {
  private app: Application;
  private server?: Server;
  private db: Pool;
  private redis: Redis;
  private logger: winston.Logger;
  private connectors: Map<string, AccountingConnector> = new Map();
  private reconciliationEngine?: ReconciliationEngine;
  private auditManager?: AuditTrailManager;
  private transactionProcessor?: TransactionProcessor;
  private syncQueue?: SyncQueue;
  private isRunning = false;

  constructor(private config: AccountingServiceConfig) {
    super();
    this.app = express();
    this.db = new Pool(config.database);
    this.redis = new Redis(config.redis);
    this.logger = this.setupLogger();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Set up Winston logger
   */
  private setupLogger(): winston.Logger {
    return winston.createLogger({
      level: this.config.environment === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/accounting-service.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 10
        }),
      ],
    });
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors({
      origin: this.config.environment === 'production' 
        ? ['https://app.craudioviz.ai'] 
        : true,
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.config.environment === 'production' ? 100 : 1000,
      message: 'Too many requests from this IP',
    });
    this.app.use(limiter);

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info('Request received', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  /**
   * Set up API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        connectors: Array.from(this.connectors.keys()),
      });
    });

    // Transaction endpoints
    this.app.get('/api/transactions', this.getTransactions.bind(this));
    this.app.post('/api/transactions', this.createTransaction.bind(this));
    this.app.get('/api/transactions/:id', this.getTransaction.bind(this));
    this.app.put('/api/transactions/:id', this.updateTransaction.bind(this));
    this.app.delete('/api/transactions/:id', this.deleteTransaction.bind(this));

    // Sync endpoints
    this.app.post('/api/sync/:system', this.syncSystem.bind(this));
    this.app.get('/api/sync/status', this.getSyncStatus.bind(this));

    // Reconciliation endpoints
    this.app.post('/api/reconcile', this.reconcileTransactions.bind(this));
    this.app.get('/api/reconcile/results', this.getReconciliationResults.bind(this));

    // Webhook endpoints
    this.app.post('/api/webhooks/quickbooks', this.handleQuickBooksWebhook.bind(this));
    this.app.post('/api/webhooks/netsuite', this.handleNetSuiteWebhook.bind(this));
    this.app.post('/api/webhooks/sage', this.handleSageWebhook.bind(this));

    // Audit endpoints
    this.app.get('/api/audit', this.getAuditTrail.bind(this));
    this.app.post('/api/audit/export', this.exportAuditTrail.bind(this));
  }

  /**
   * Set up error handling middleware
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });

      if (err instanceof AccountingIntegrationError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
          details: err.details,
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    });
  }

  /**
   * Register an accounting system connector
   */
  public registerConnector(connector: AccountingConnector): void {
    this.connectors.set(connector.systemType, connector);
    this.logger.info(`Registered connector for ${connector.systemType}`);
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    try {
      // Test database connection
      await this.db.query('SELECT 1');
      this.logger.info('Database connected');

      // Test Redis connection
      await this.redis.ping();
      this.logger.info('Redis connected');

      // Initialize connectors
      for (const [system, connector] of this.connectors) {
        try {
          await connector.connect();
          this.logger.info(`Connected to ${system}`);
        } catch (error) {
          this.logger.error(`Failed to connect to ${system}`, { error });
        }
      }

      // Start HTTP server
      this.server = createServer(this.app);
      
      this.server.listen(this.config.port, () => {
        this.isRunning = true;
        this.logger.info(`Accounting integration service started on port ${this.config.port}`);
        this.emit('started');
      });

    } catch (error) {
      this.logger.error('Failed to start service', { error });
      throw error;
    }
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping accounting integration service...');

    // Close server
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Disconnect connectors
    for (const [system, connector] of this.connectors) {
      try {
        await connector.disconnect();
        this.logger.info(`Disconnected from ${system}`);
      } catch (error) {
        this.logger.error(`Failed to disconnect from ${system}`, { error });
      }
    }

    // Close database and Redis connections
    await this.db.end();
    await this.redis.quit();

    this.isRunning = false;
    this.logger.info('Service stopped');
    this.emit('stopped');
  }

  /**
   * Get transactions endpoint
   */
  private async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 50, system, status } = req.query;
      
      let query = 'SELECT * FROM transactions WHERE 1=1';
      const params: unknown[] = [];

      if (system) {
        params.push(system);
        query += ` AND system_type = $${params.length}`;
      }

      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      params.push(Number(limit));
      query += ` LIMIT $${params.length}`;
      
      params.push((Number(page) - 1) * Number(limit));
      query += ` OFFSET $${params.length}`;

      const result = await this.db.query(query, params);
      
      res.json({
        transactions: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.rowCount || 0,
        },
      });
    } catch (error) {
      throw new AccountingIntegrationError(
        'Failed to retrieve transactions',
        'DB_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Create transaction endpoint
   */
  private async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      const transactionData = TransactionSchema.parse(req.body);
      
      if (!this.transactionProcessor) {
        throw new AccountingIntegrationError(
          'Transaction processor not initialized',
          'SERVICE_ERROR'
        );
      }

      const transaction = await this.transactionProcessor.process(transactionData);
      
      // Log audit entry
      if (this.auditManager) {
        await this.auditManager.log({
          entityType: 'transaction',
          entityId: transaction.id,
          action: 'create',
          changes: {},
          userId: req.headers['user-id'] as string || 'system',
          sessionId: req.headers['session-id'] as string || '',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
      }

      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AccountingIntegrationError(
          'Invalid transaction data',
          'VALIDATION_ERROR',
          400,
          error.errors
        );
      }
      throw error;
    }
  }

  /**
   * Get single transaction endpoint
   */
  private async getTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const result = await this.db.query(
        'SELECT * FROM transactions WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AccountingIntegrationError(
          'Transaction not found',
          'NOT_FOUND',
          404
        );
      }

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update transaction endpoint
   */
  private async updateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get existing transaction
      const existing = await this.db.query(
        'SELECT * FROM transactions WHERE id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        throw new AccountingIntegrationError(
          'Transaction not found',
          'NOT_FOUND',
          404
        );
      }

      const oldTransaction = existing.rows[0];
      const updatedTransaction = { ...oldTransaction, ...updates, updatedAt: new Date() };

      await this.db.query(
        `UPDATE transactions SET 
         amount = $1, status = $2, updated_at = $3 
         WHERE id = $4`,
        [updatedTransaction.amount, updatedTransaction.status, updatedTransaction.updatedAt, id]
      );

      // Log audit entry
      if (this.auditManager) {
        const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {};
        
        Object.keys(updates).forEach(key => {
          if (oldTransaction[key] !== updates[key]) {
            changes[key] = {
              oldValue: oldTransaction[key],
              newValue: updates[key],
            };
          }
        });

        await this.auditManager.log({
          entityType: 'transaction',
          entityId: id,
          action: 'update',
          changes,
          userId: req.headers['user-id'] as string || 'system',
          sessionId: req.headers['session-id'] as string || '',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
      }

      res.json(updatedTransaction);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete transaction endpoint
   */
  private async deleteTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.db.query(
        'DELETE FROM transactions WHERE id = $1 RETURNING *',
        [id]
      );