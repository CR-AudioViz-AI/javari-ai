```typescript
/**
 * CR AudioViz AI - Automated Payment Reconciliation Service
 * 
 * Microservice that automatically reconciles payments across multiple processors,
 * identifies discrepancies, and generates detailed financial reports for accounting systems.
 * 
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import axios from 'axios';
import Redis from 'ioredis';
import Queue from 'bull';
import express from 'express';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

// ====================== INTERFACES ======================

/**
 * Unified payment transaction interface
 */
interface UnifiedTransaction {
  id: string;
  externalId: string;
  processor: PaymentProcessor;
  amount: number;
  currency: string;
  status: TransactionStatus;
  type: TransactionType;
  merchantId?: string;
  customerId?: string;
  description?: string;
  fees?: number;
  processedAt: Date;
  settledAt?: Date;
  metadata: Record<string, any>;
}

/**
 * Reconciliation discrepancy interface
 */
interface Discrepancy {
  id: string;
  transactionId: string;
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  expectedValue: any;
  actualValue: any;
  variance?: number;
  description: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

/**
 * Reconciliation report interface
 */
interface ReconciliationReport {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  processors: PaymentProcessor[];
  totalTransactions: number;
  totalAmount: number;
  totalFees: number;
  discrepancyCount: number;
  discrepancies: Discrepancy[];
  summary: ReconciliationSummary;
  generatedAt: Date;
  status: ReportStatus;
}

/**
 * Reconciliation summary interface
 */
interface ReconciliationSummary {
  processedTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  totalVariance: number;
  feeVariance: number;
  statusMismatches: number;
  timingDiscrepancies: number;
}

/**
 * Processor configuration interface
 */
interface ProcessorConfig {
  processor: PaymentProcessor;
  apiKey: string;
  webhookSecret?: string;
  enabled: boolean;
  toleranceRules: ToleranceRules;
  rateLimits: RateLimits;
}

/**
 * Tolerance rules for discrepancy detection
 */
interface ToleranceRules {
  amountVariance: number; // Acceptable amount variance in cents
  feeVariance: number; // Acceptable fee variance in cents
  timingVariance: number; // Acceptable timing variance in minutes
  statusMismatchAllowed: boolean;
}

/**
 * Rate limiting configuration
 */
interface RateLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
}

/**
 * Accounting system integration interface
 */
interface AccountingEntry {
  entryId: string;
  transactionId: string;
  accountCode: string;
  debitAmount?: number;
  creditAmount?: number;
  description: string;
  reference: string;
  postingDate: Date;
}

// ====================== ENUMS ======================

enum PaymentProcessor {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square'
}

enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REFUNDED = 'refunded'
}

enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
  ADJUSTMENT = 'adjustment'
}

enum DiscrepancyType {
  AMOUNT_MISMATCH = 'amount_mismatch',
  FEE_MISMATCH = 'fee_mismatch',
  STATUS_MISMATCH = 'status_mismatch',
  TIMING_MISMATCH = 'timing_mismatch',
  MISSING_TRANSACTION = 'missing_transaction',
  DUPLICATE_TRANSACTION = 'duplicate_transaction'
}

enum DiscrepancySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum ReportStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// ====================== MAIN SERVICE CLASS ======================

/**
 * Automated Payment Reconciliation Service
 * 
 * Main service class that orchestrates payment reconciliation across multiple processors
 */
export class PaymentReconciliationService {
  private supabase: SupabaseClient;
  private redis: Redis;
  private reconciliationQueue: Queue.Queue;
  private processorConnectors: Map<PaymentProcessor, ProcessorConnector>;
  private discrepancyDetector: DiscrepancyDetector;
  private reportGenerator: ReportGenerator;
  private accountingIntegrator: AccountingSystemIntegrator;
  private notificationService: NotificationService;
  private auditTrail: AuditTrail;
  private app: express.Application;

  constructor() {
    this.initializeServices();
    this.setupProcessorConnectors();
    this.initializeQueue();
    this.setupSchedulers();
    this.setupExpressApp();
  }

  /**
   * Initialize core services and connections
   */
  private async initializeServices(): Promise<void> {
    // Initialize Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Initialize Redis
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Initialize service components
    this.discrepancyDetector = new DiscrepancyDetector();
    this.reportGenerator = new ReportGenerator(this.supabase);
    this.accountingIntegrator = new AccountingSystemIntegrator();
    this.notificationService = new NotificationService();
    this.auditTrail = new AuditTrail(this.supabase);

    console.log('✅ Payment Reconciliation Service initialized');
  }

  /**
   * Setup payment processor connectors
   */
  private setupProcessorConnectors(): void {
    this.processorConnectors = new Map();

    const configs: ProcessorConfig[] = [
      {
        processor: PaymentProcessor.STRIPE,
        apiKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        enabled: true,
        toleranceRules: {
          amountVariance: 1,
          feeVariance: 5,
          timingVariance: 60,
          statusMismatchAllowed: false
        },
        rateLimits: {
          requestsPerMinute: 100,
          requestsPerHour: 1000,
          burstLimit: 10
        }
      },
      {
        processor: PaymentProcessor.PAYPAL,
        apiKey: process.env.PAYPAL_CLIENT_ID!,
        enabled: true,
        toleranceRules: {
          amountVariance: 2,
          feeVariance: 10,
          timingVariance: 120,
          statusMismatchAllowed: true
        },
        rateLimits: {
          requestsPerMinute: 50,
          requestsPerHour: 500,
          burstLimit: 5
        }
      },
      {
        processor: PaymentProcessor.SQUARE,
        apiKey: process.env.SQUARE_ACCESS_TOKEN!,
        enabled: true,
        toleranceRules: {
          amountVariance: 1,
          feeVariance: 5,
          timingVariance: 30,
          statusMismatchAllowed: false
        },
        rateLimits: {
          requestsPerMinute: 75,
          requestsPerHour: 750,
          burstLimit: 8
        }
      }
    ];

    configs.forEach(config => {
      if (config.enabled) {
        const connector = ProcessorConnectorFactory.create(config);
        this.processorConnectors.set(config.processor, connector);
      }
    });
  }

  /**
   * Initialize Bull queue for background processing
   */
  private initializeQueue(): void {
    this.reconciliationQueue = new Queue('payment reconciliation', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    this.reconciliationQueue.process('reconcile-transactions', this.processReconciliation.bind(this));
    this.reconciliationQueue.process('generate-report', this.processReportGeneration.bind(this));
  }

  /**
   * Setup scheduled reconciliation tasks
   */
  private setupSchedulers(): void {
    // Daily reconciliation at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.scheduleReconciliation('daily');
    });

    // Weekly reconciliation on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      await this.scheduleReconciliation('weekly');
    });

    // Monthly reconciliation on 1st of each month at 4 AM
    cron.schedule('0 4 1 * *', async () => {
      await this.scheduleReconciliation('monthly');
    });
  }

  /**
   * Setup Express application for webhooks and API endpoints
   */
  private setupExpressApp(): void {
    this.app = express();
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Webhook endpoints
    this.app.post('/webhooks/stripe', this.handleStripeWebhook.bind(this));
    this.app.post('/webhooks/paypal', this.handlePayPalWebhook.bind(this));
    this.app.post('/webhooks/square', this.handleSquareWebhook.bind(this));

    // API endpoints
    this.app.post('/reconcile', this.triggerManualReconciliation.bind(this));
    this.app.get('/reports/:reportId', this.getReconciliationReport.bind(this));
    this.app.get('/discrepancies', this.getDiscrepancies.bind(this));
    this.app.post('/discrepancies/:id/resolve', this.resolveDiscrepancy.bind(this));
  }

  /**
   * Schedule reconciliation job
   */
  private async scheduleReconciliation(period: string): Promise<void> {
    try {
      const job = await this.reconciliationQueue.add('reconcile-transactions', {
        period,
        scheduledAt: new Date(),
        processors: Array.from(this.processorConnectors.keys())
      });

      await this.auditTrail.log({
        action: 'reconciliation_scheduled',
        details: { period, jobId: job.id },
        timestamp: new Date()
      });

      console.log(`📅 Scheduled ${period} reconciliation job: ${job.id}`);
    } catch (error) {
      console.error(`❌ Failed to schedule ${period} reconciliation:`, error);
    }
  }

  /**
   * Process reconciliation job
   */
  private async processReconciliation(job: Queue.Job): Promise<void> {
    const { period, processors } = job.data;
    const reportId = uuidv4();

    try {
      console.log(`🔄 Starting ${period} reconciliation...`);

      // Fetch transactions from all processors
      const allTransactions: UnifiedTransaction[] = [];
      
      for (const processor of processors) {
        const connector = this.processorConnectors.get(processor);
        if (connector) {
          const transactions = await connector.fetchTransactions(this.getPeriodRange(period));
          allTransactions.push(...transactions);
        }
      }

      // Fetch internal transactions from database
      const internalTransactions = await this.fetchInternalTransactions(this.getPeriodRange(period));

      // Detect discrepancies
      const discrepancies = await this.discrepancyDetector.detectDiscrepancies(
        allTransactions,
        internalTransactions
      );

      // Generate report
      const report = await this.reportGenerator.generateReport({
        id: reportId,
        period,
        transactions: allTransactions,
        discrepancies,
        summary: this.calculateSummary(allTransactions, discrepancies)
      });

      // Send notifications if discrepancies found
      if (discrepancies.length > 0) {
        await this.notificationService.sendDiscrepancyAlert(discrepancies);
      }

      // Generate accounting entries
      await this.accountingIntegrator.processTransactions(allTransactions);

      console.log(`✅ Completed ${period} reconciliation. Report ID: ${reportId}`);
    } catch (error) {
      console.error(`❌ Reconciliation job failed:`, error);
      throw error;
    }
  }

  /**
   * Process report generation job
   */
  private async processReportGeneration(job: Queue.Job): Promise<void> {
    const { reportId, format } = job.data;
    
    try {
      await this.reportGenerator.exportReport(reportId, format);
      console.log(`📊 Generated report ${reportId} in ${format} format`);
    } catch (error) {
      console.error(`❌ Report generation failed:`, error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook
   */
  private async handleStripeWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      const connector = this.processorConnectors.get(PaymentProcessor.STRIPE) as StripeConnector;
      await connector.handleWebhook(req.body, req.headers);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(400).send('Error processing webhook');
    }
  }

  /**
   * Handle PayPal webhook
   */
  private async handlePayPalWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      const connector = this.processorConnectors.get(PaymentProcessor.PAYPAL) as PayPalConnector;
      await connector.handleWebhook(req.body, req.headers);
      res.status(200).send('OK');
    } catch (error) {
      console.error('PayPal webhook error:', error);
      res.status(400).send('Error processing webhook');
    }
  }

  /**
   * Handle Square webhook
   */
  private async handleSquareWebhook(req: express.Request, res: express.Response): Promise<void> {
    try {
      const connector = this.processorConnectors.get(PaymentProcessor.SQUARE) as SquareConnector;
      await connector.handleWebhook(req.body, req.headers);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Square webhook error:', error);
      res.status(400).send('Error processing webhook');
    }
  }

  /**
   * Trigger manual reconciliation
   */
  private async triggerManualReconciliation(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { period = 'daily', processors } = req.body;
      
      const job = await this.reconciliationQueue.add('reconcile-transactions', {
        period,
        processors: processors || Array.from(this.processorConnectors.keys()),
        manual: true,
        triggeredBy: req.headers.authorization // User ID from auth token
      });

      res.json({
        success: true,
        jobId: job.id,
        message: 'Manual reconciliation triggered'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get reconciliation report
   */
  private async getReconciliationReport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const report = await this.reportGenerator.getReport(reportId);
      
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      res.json(report);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get discrepancies
   */
  private async getDiscrepancies(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { status, severity, limit = 50, offset = 0 } = req.query;
      
      const discrepancies = await this.supabase
        .from('discrepancy_logs')
        .select('*')
        .eq('resolved', status === 'resolved')
        .eq('severity', severity || undefined)
        .range(Number(offset), Number(offset) + Number(limit) - 1)
        .order('detected_at', { ascending: false });

      res.json(discrepancies.data);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resolve discrepancy
   */
  private async resolveDiscrepancy(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes, resolvedBy } = req.body;

      const { data, error } = await this.supabase
        .from('discrepancy_logs')
        .update({
          resolved: true,
          resolved_at: new Date(),
          resolved_by: resolvedBy,
          notes
        })
        .eq('id', id);

      if (error) throw error;

      await this.auditTrail.log({
        action: 'discrepancy_resolved',
        details: { discrepancyId: id, resolvedBy, notes },
        timestamp: new Date()
      });

      res.json({ success: true, message: 'Discrepancy resolved' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Fetch internal transactions from database
   */
  private async fetchInternalTransactions(period: { start: Date; end: Date }): Promise<UnifiedTransaction[]> {
    const { data, error } = await this.supabase
      .from('payment_transactions')
      .select('*')
      .gte('processed_at', period.start.toISOString())
      .lt('processed_at', period.end.toISOString());

    if (error) throw error;

    return data.map(this.mapToUnifiedTransaction);
  }

  /**
   * Map database record to unified transaction
   */
  private mapToUnifiedTransaction(record: any): UnifiedTransaction {
    return {
      id: record.id,
      externalId: record.external_id,
      processor: record.processor,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      type: record.type,
      merchantId: record.merchant_id,
      customerId: record.customer_id,
      description: record.description,
      fees: record.fees,
      processedAt: new Date(record.processed_at),
      settledAt: record.settled_at ? new Date(record.settled_at) : undefined,
      metadata: record.metadata || {}
    };
  }

  /**
   * Get period date range
   */
  private getPeriodRange(period: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }

    return { start, end };
  }

  /**
   * Calculate reconciliation summary
   */
  private calculateSummary(transactions: UnifiedTransaction[], discrepancies: Discrepancy[]): ReconciliationSummary {
    return {
      processedTransactions: transactions.length,
      matchedTransactions: transactions.length - discrepancies.filter(d => d.type === DiscrepancyType.MISSING_TRANSACTION).length,
      unmatchedTransactions: discrepancies.filter(d => d.type === DiscrepancyType.MISSING_TRANSACTION).length,
      totalVariance: discrepancies.reduce((sum, d) => sum + (d.variance || 0), 0),
      feeVariance: discrepancies.filter(d => d.type === DiscrepancyType.FEE_MISMATCH).reduce((sum, d) => sum + (d.variance || 0), 0),
      statusMismatches: discrepancies.filter(d => d.type === DiscrepancyType.STATUS_MISMATCH).length,
      timingDiscrepancies: discrepancies.filter(d => d.type === DiscrepancyType.TIMING_MISMATCH).length
    };
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    const port = process.env.PORT || 3000;
    
    this.app.listen(port, () => {
      console.log(`🚀 Payment Reconciliation Service running on port ${port}`);
    });
  }
}

// ====================== PROCESSOR CONNECTORS ======================

/**
 * Abstract base class for payment processor connectors
 */
abstract class ProcessorConnector {
  protected config: ProcessorConfig;

  constructor(config: ProcessorConfig) {
    this.config = config;
  }

  abstract fetchTransactions(period: { start: Date; end: Date }): Promise<UnifiedTransaction[]>;
  abstract handleWebhook(payload: any, headers: any): Promise<void>;
}

/**
 * Stripe payment processor connector
 */
class StripeConnector extends ProcessorConnector {
  private stripe: Stripe;

  constructor(config