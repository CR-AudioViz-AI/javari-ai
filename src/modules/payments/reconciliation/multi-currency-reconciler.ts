import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';

/**
 * Supported currency codes
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY';

/**
 * Payment provider identifiers
 */
export type PaymentProvider = 'stripe' | 'paypal' | 'square' | 'adyen' | 'checkout';

/**
 * Transaction status enumeration
 */
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';

/**
 * Reconciliation status enumeration
 */
export type ReconciliationStatus = 'pending' | 'matched' | 'discrepant' | 'resolved' | 'disputed';

/**
 * Discrepancy types
 */
export type DiscrepancyType = 'amount_mismatch' | 'missing_transaction' | 'duplicate' | 'fx_rate_variance' | 'timing_mismatch';

/**
 * Raw transaction from payment provider
 */
export interface ProviderTransaction {
  id: string;
  provider: PaymentProvider;
  reference: string;
  amount: number;
  currency: CurrencyCode;
  status: TransactionStatus;
  timestamp: Date;
  metadata: Record<string, any>;
  fees: number;
  netAmount: number;
}

/**
 * Normalized transaction for reconciliation
 */
export interface NormalizedTransaction {
  id: string;
  providerId: string;
  provider: PaymentProvider;
  reference: string;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  baseCurrencyAmount: number;
  baseCurrency: CurrencyCode;
  fxRate: number;
  fxRateTimestamp: Date;
  status: TransactionStatus;
  timestamp: Date;
  fees: number;
  netAmount: number;
  metadata: Record<string, any>;
  reconciliationStatus: ReconciliationStatus;
  matchedTransactions: string[];
}

/**
 * Transaction matching configuration
 */
export interface MatchingConfig {
  amountTolerancePercent: number;
  timestampToleranceMinutes: number;
  enableReferenceMatching: boolean;
  enableFuzzyMatching: boolean;
  baseCurrency: CurrencyCode;
  minimumConfidenceScore: number;
}

/**
 * FX rate information
 */
export interface FXRate {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  timestamp: Date;
  provider: string;
  isRealTime: boolean;
}

/**
 * Detected discrepancy
 */
export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  transactions: string[];
  description: string;
  expectedAmount?: number;
  actualAmount?: number;
  variance?: number;
  detectedAt: Date;
  assignedTo?: string;
  status: 'open' | 'investigating' | 'resolved' | 'disputed';
  resolution?: string;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

/**
 * Reconciliation match result
 */
export interface MatchResult {
  primaryTransaction: string;
  matchedTransactions: string[];
  confidenceScore: number;
  matchingFactors: string[];
  discrepancies: Discrepancy[];
}

/**
 * Reconciliation report
 */
export interface ReconciliationReport {
  id: string;
  period: {
    start: Date;
    end: Date;
  };
  providers: PaymentProvider[];
  summary: {
    totalTransactions: number;
    matchedTransactions: number;
    discrepancies: number;
    resolvedDiscrepancies: number;
    totalVolume: Record<CurrencyCode, number>;
    reconciliationRate: number;
  };
  discrepancies: Discrepancy[];
  generatedAt: Date;
  generatedBy: string;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  entityType: 'transaction' | 'discrepancy' | 'reconciliation';
  entityId: string;
  previousState?: any;
  newState?: any;
  metadata: Record<string, any>;
}

/**
 * Real-time FX rate handler with caching
 */
export class FXRateHandler extends EventEmitter {
  private rateCache = new Map<string, FXRate>();
  private cacheExpiry = new Map<string, Date>();
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(private providers: string[] = ['exchangerates-api', 'fixer']) {
    super();
    this.startRateRefreshTimer();
  }

  /**
   * Get current FX rate with caching
   */
  async getRate(from: CurrencyCode, to: CurrencyCode): Promise<FXRate> {
    if (from === to) {
      return {
        fromCurrency: from,
        toCurrency: to,
        rate: 1,
        timestamp: new Date(),
        provider: 'internal',
        isRealTime: true
      };
    }

    const cacheKey = `${from}-${to}`;
    const cached = this.rateCache.get(cacheKey);
    const expiry = this.cacheExpiry.get(cacheKey);

    if (cached && expiry && new Date() < expiry) {
      return cached;
    }

    try {
      const rate = await this.fetchRealTimeRate(from, to);
      this.rateCache.set(cacheKey, rate);
      this.cacheExpiry.set(cacheKey, new Date(Date.now() + this.cacheDuration));
      this.emit('rateUpdated', rate);
      return rate;
    } catch (error) {
      if (cached) {
        console.warn(`Using stale rate for ${cacheKey}:`, error);
        return cached;
      }
      throw new Error(`Failed to get FX rate ${from}/${to}: ${error}`);
    }
  }

  /**
   * Convert amount using current FX rate
   */
  async convertAmount(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<{ amount: number; rate: FXRate }> {
    const rate = await this.getRate(from, to);
    return {
      amount: Math.round(amount * rate.rate * 100) / 100,
      rate
    };
  }

  /**
   * Fetch real-time rate from external provider
   */
  private async fetchRealTimeRate(from: CurrencyCode, to: CurrencyCode): Promise<FXRate> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        const response = await fetch(
          `https://api.exchangerates-api.io/v1/latest?access_key=${process.env.EXCHANGE_RATES_API_KEY}&base=${from}&symbols=${to}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.info || 'API Error');
        }

        return {
          fromCurrency: from,
          toCurrency: to,
          rate: data.rates[to],
          timestamp: new Date(),
          provider,
          isRealTime: true
        };
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new Error(`All FX providers failed: ${errors.map(e => e.message).join(', ')}`);
  }

  /**
   * Start periodic rate refresh timer
   */
  private startRateRefreshTimer(): void {
    setInterval(() => {
      this.refreshExpiredRates();
    }, 60000); // Check every minute
  }

  /**
   * Refresh expired rates
   */
  private async refreshExpiredRates(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const [from, to] = key.split('-') as [CurrencyCode, CurrencyCode];
      try {
        await this.getRate(from, to);
      } catch (error) {
        console.warn(`Failed to refresh rate ${key}:`, error);
      }
    }
  }
}

/**
 * Transaction matching engine
 */
export class TransactionMatcher {
  constructor(private config: MatchingConfig) {}

  /**
   * Find matching transactions using multiple algorithms
   */
  async findMatches(
    transactions: NormalizedTransaction[]
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    const processed = new Set<string>();

    for (const transaction of transactions) {
      if (processed.has(transaction.id)) continue;

      const candidates = transactions.filter(t => 
        t.id !== transaction.id && 
        !processed.has(t.id) &&
        t.reconciliationStatus === 'pending'
      );

      const matchResult = await this.matchTransaction(transaction, candidates);
      
      if (matchResult.matchedTransactions.length > 0) {
        matches.push(matchResult);
        processed.add(transaction.id);
        matchResult.matchedTransactions.forEach(id => processed.add(id));
      }
    }

    return matches;
  }

  /**
   * Match a single transaction against candidates
   */
  private async matchTransaction(
    primary: NormalizedTransaction,
    candidates: NormalizedTransaction[]
  ): Promise<MatchResult> {
    const matchedTransactions: string[] = [];
    const matchingFactors: string[] = [];
    const discrepancies: Discrepancy[] = [];
    let confidenceScore = 0;

    for (const candidate of candidates) {
      const score = this.calculateMatchScore(primary, candidate);
      
      if (score.total >= this.config.minimumConfidenceScore) {
        matchedTransactions.push(candidate.id);
        matchingFactors.push(...score.factors);
        confidenceScore = Math.max(confidenceScore, score.total);

        // Check for discrepancies
        const candidateDiscrepancies = this.detectDiscrepancies(primary, candidate);
        discrepancies.push(...candidateDiscrepancies);
      }
    }

    return {
      primaryTransaction: primary.id,
      matchedTransactions,
      confidenceScore,
      matchingFactors: [...new Set(matchingFactors)],
      discrepancies
    };
  }

  /**
   * Calculate match score between two transactions
   */
  private calculateMatchScore(
    tx1: NormalizedTransaction,
    tx2: NormalizedTransaction
  ): { total: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];

    // Reference matching (highest weight)
    if (this.config.enableReferenceMatching && tx1.reference === tx2.reference) {
      score += 40;
      factors.push('reference_match');
    }

    // Amount matching
    const amountVariance = Math.abs(tx1.baseCurrencyAmount - tx2.baseCurrencyAmount);
    const amountTolerance = tx1.baseCurrencyAmount * (this.config.amountTolerancePercent / 100);
    
    if (amountVariance <= amountTolerance) {
      score += 30;
      factors.push('amount_match');
    }

    // Timestamp proximity
    const timeDiff = Math.abs(tx1.timestamp.getTime() - tx2.timestamp.getTime());
    const timeToleranceMs = this.config.timestampToleranceMinutes * 60 * 1000;
    
    if (timeDiff <= timeToleranceMs) {
      const timeScore = Math.max(0, 20 * (1 - timeDiff / timeToleranceMs));
      score += timeScore;
      factors.push('time_proximity');
    }

    // Provider diversity (bonus for cross-provider matches)
    if (tx1.provider !== tx2.provider) {
      score += 10;
      factors.push('cross_provider');
    }

    return { total: score, factors };
  }

  /**
   * Detect discrepancies between matched transactions
   */
  private detectDiscrepancies(
    tx1: NormalizedTransaction,
    tx2: NormalizedTransaction
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    // Amount discrepancy
    const amountVariance = Math.abs(tx1.baseCurrencyAmount - tx2.baseCurrencyAmount);
    const amountTolerance = tx1.baseCurrencyAmount * (this.config.amountTolerancePercent / 100);
    
    if (amountVariance > amountTolerance) {
      discrepancies.push({
        id: `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'amount_mismatch',
        severity: amountVariance > tx1.baseCurrencyAmount * 0.1 ? 'high' : 'medium',
        transactions: [tx1.id, tx2.id],
        description: `Amount mismatch: ${tx1.baseCurrencyAmount} vs ${tx2.baseCurrencyAmount}`,
        expectedAmount: tx1.baseCurrencyAmount,
        actualAmount: tx2.baseCurrencyAmount,
        variance: amountVariance,
        detectedAt: new Date(),
        status: 'open',
        metadata: { providers: [tx1.provider, tx2.provider] }
      });
    }

    // FX rate variance
    if (tx1.originalCurrency !== tx2.originalCurrency) {
      const expectedRate = tx1.fxRate;
      const actualRate = tx2.fxRate;
      const rateVariance = Math.abs(expectedRate - actualRate) / expectedRate;
      
      if (rateVariance > 0.02) { // 2% variance threshold
        discrepancies.push({
          id: `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'fx_rate_variance',
          severity: rateVariance > 0.05 ? 'high' : 'medium',
          transactions: [tx1.id, tx2.id],
          description: `FX rate variance: ${expectedRate} vs ${actualRate}`,
          variance: rateVariance * 100,
          detectedAt: new Date(),
          status: 'open',
          metadata: { 
            currencies: [tx1.originalCurrency, tx2.originalCurrency],
            rates: [expectedRate, actualRate]
          }
        });
      }
    }

    return discrepancies;
  }
}

/**
 * Discrepancy resolution workflow manager
 */
export class DiscrepancyResolver extends EventEmitter {
  private resolutionWorkflows = new Map<string, any>();
  private assignmentQueue: Discrepancy[] = [];

  constructor() {
    super();
    this.startAssignmentProcessor();
  }

  /**
   * Process and assign discrepancies for resolution
   */
  async processDiscrepancy(discrepancy: Discrepancy): Promise<void> {
    try {
      // Auto-resolve low severity discrepancies
      if (discrepancy.severity === 'low' && await this.canAutoResolve(discrepancy)) {
        await this.autoResolve(discrepancy);
        return;
      }

      // Add to assignment queue for manual review
      this.assignmentQueue.push(discrepancy);
      this.emit('discrepancyDetected', discrepancy);
    } catch (error) {
      console.error('Error processing discrepancy:', error);
      this.emit('processingError', { discrepancy, error });
    }
  }

  /**
   * Check if discrepancy can be auto-resolved
   */
  private async canAutoResolve(discrepancy: Discrepancy): Promise<boolean> {
    switch (discrepancy.type) {
      case 'fx_rate_variance':
        return discrepancy.variance !== undefined && discrepancy.variance < 1; // < 1% variance
      case 'timing_mismatch':
        return true; // Timing mismatches are usually acceptable
      default:
        return false;
    }
  }

  /**
   * Auto-resolve eligible discrepancies
   */
  private async autoResolve(discrepancy: Discrepancy): Promise<void> {
    discrepancy.status = 'resolved';
    discrepancy.resolution = 'Auto-resolved: Within acceptable tolerance';
    discrepancy.resolvedAt = new Date();
    
    this.emit('discrepancyResolved', discrepancy);
  }

  /**
   * Manually resolve discrepancy
   */
  async resolveDiscrepancy(
    discrepancyId: string,
    resolution: string,
    resolvedBy: string
  ): Promise<void> {
    const discrepancy = await this.getDiscrepancy(discrepancyId);
    if (!discrepancy) {
      throw new Error(`Discrepancy ${discrepancyId} not found`);
    }

    discrepancy.status = 'resolved';
    discrepancy.resolution = resolution;
    discrepancy.resolvedAt = new Date();
    discrepancy.assignedTo = resolvedBy;

    this.emit('discrepancyResolved', discrepancy);
  }

  /**
   * Start assignment processor
   */
  private startAssignmentProcessor(): void {
    setInterval(() => {
      this.processAssignmentQueue();
    }, 10000); // Process every 10 seconds
  }

  /**
   * Process assignment queue
   */
  private async processAssignmentQueue(): Promise<void> {
    while (this.assignmentQueue.length > 0) {
      const discrepancy = this.assignmentQueue.shift();
      if (discrepancy) {
        await this.assignDiscrepancy(discrepancy);
      }
    }
  }

  /**
   * Assign discrepancy to appropriate resolver
   */
  private async assignDiscrepancy(discrepancy: Discrepancy): Promise<void> {
    // Simple round-robin assignment logic
    const resolvers = ['finance_team', 'payments_team', 'ops_team'];
    const assignedTo = resolvers[Math.floor(Math.random() * resolvers.length)];
    
    discrepancy.assignedTo = assignedTo;
    discrepancy.status = 'investigating';
    
    this.emit('discrepancyAssigned', discrepancy);
  }

  /**
   * Get discrepancy by ID
   */
  private async getDiscrepancy(id: string): Promise<Discrepancy | null> {
    // In a real implementation, this would query the database
    return null;
  }
}

/**
 * Audit logger for reconciliation activities
 */
export class AuditLogger {
  private logBuffer: AuditLogEntry[] = [];
  private readonly bufferSize = 100;

  constructor(private supabase: any) {
    this.startLogFlush();
  }

  /**
   * Log reconciliation activity
   */
  async log(
    action: string,
    entityType: 'transaction' | 'discrepancy' | 'reconciliation',
    entityId: string,
    options: {
      userId?: string;
      previousState?: any;
      newState?: any;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId: options.userId,
      action,
      entityType,
      entityId,
      previousState: options.previousState,
      newState: options.newState,
      metadata: options.metadata || {}
    };

    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.bufferSize) {
      await this.flushLogs();
    }
  }

  /**
   * Start periodic log flush
   */
  private startLogFlush(): void {
    setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flushLogs();
      }
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Flush log buffer to database
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert(entries);

      if (error) {
        console.error('Failed to flush audit logs:', error);
        // Re-add to buffer for retry
        this.logBuffer.unshift(...entries);
      }
    } catch (error) {
      console.error('Error flushing audit logs:', error);
      this.logBuffer.unshift(...entries);
    }
  }
}

/**
 * Main multi-currency reconciliation system
 */
export class MultiCurrencyReconciler extends EventEmitter {
  private fxRateHandler: FXRateHandler;
  private transactionMatcher: TransactionMatcher;
  private discrepancyResolver: DiscrepancyResolver;
  private auditLogger: AuditLogger;
  private isReconciling = false;
  private reconciliationInterval?: NodeJS.Timeout;

  constructor(
    private config: MatchingConfig,
    private supabase: any
  ) {
    super();
    
    this.fxRateHandler = new FXRateHandler();
    this.transactionMatcher = new TransactionMatcher(config);
    this.discrepancyResolver = new DiscrepancyResolver();
    this.auditLogger = new AuditLogger(supabase);

    this.setupEventHandlers();
  }

  /**
   * Start continuous reconciliation process
   */
  async startReconciliation(intervalMinutes: number = 15): Promise<void> {
    if (this.isReconciling) {
      throw new Error('Reconciliation is already running');
    }

    this.isReconciling = true;
    
    // Initial reconciliation
    await this.performReconciliation();
    
    // Set up periodic reconciliation
    this.reconciliationInterval = setInterval(async () => {
      try {
        await this.performReconciliation();
      } catch (error) {
        console.error('Reconciliation error:', error);
        this.emit('reconciliationError', error);
      }
    }, intervalMinutes * 60 * 1000);