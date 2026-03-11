```typescript
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Purchase event data structure
 */
export interface PurchaseEvent {
  id: string;
  content_id: string;
  creator_id: string;
  buyer_id: string;
  purchase_type: 'purchase' | 'license';
  amount: number;
  currency: string;
  platform_fee_rate: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Creator payout configuration
 */
export interface CreatorPayoutConfig {
  creator_id: string;
  stripe_account_id: string;
  tax_id?: string;
  tax_jurisdiction: string;
  minimum_payout_threshold: number;
  payout_schedule: 'instant' | 'daily' | 'weekly' | 'monthly';
  revenue_share_rate: number;
}

/**
 * Tax calculation result
 */
export interface TaxCalculation {
  gross_amount: number;
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
  tax_jurisdiction: string;
  tax_breakdown: {
    federal?: number;
    state?: number;
    local?: number;
  };
}

/**
 * Payout transaction record
 */
export interface PayoutTransaction {
  id: string;
  creator_id: string;
  purchase_event_id: string;
  gross_amount: number;
  platform_fee: number;
  tax_amount: number;
  net_amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripe_transfer_id?: string;
  processed_at?: Date;
  error_message?: string;
  tax_calculation: TaxCalculation;
  metadata?: Record<string, any>;
}

/**
 * Payout history aggregation
 */
export interface PayoutSummary {
  creator_id: string;
  period_start: Date;
  period_end: Date;
  total_gross: number;
  total_fees: number;
  total_taxes: number;
  total_net: number;
  transaction_count: number;
  currency: string;
}

/**
 * Tax report data
 */
export interface TaxReport {
  report_id: string;
  creator_id: string;
  reporting_period: {
    start: Date;
    end: Date;
  };
  total_earnings: number;
  total_taxes_withheld: number;
  tax_breakdown: Record<string, number>;
  transactions: PayoutTransaction[];
  generated_at: Date;
}

/**
 * Service configuration
 */
export interface InstantPayoutServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  stripeSecretKey: string;
  taxApiKey: string;
  taxApiProvider: 'taxjar' | 'avalara';
  webhookEndpoint?: string;
  defaultCurrency: string;
  platformFeeRate: number;
}

/**
 * Real-time payment distribution service that automatically calculates and disburses
 * payments to creators upon content purchase/licensing, with integrated tax calculation
 * and compliance reporting.
 */
export class InstantPayoutService {
  private supabase: SupabaseClient;
  private stripe: Stripe;
  private realtimeChannel: RealtimeChannel | null = null;
  private taxApiKey: string;
  private taxApiProvider: 'taxjar' | 'avalara';
  private config: InstantPayoutServiceConfig;

  constructor(config: InstantPayoutServiceConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    this.taxApiKey = config.taxApiKey;
    this.taxApiProvider = config.taxApiProvider;
  }

  /**
   * Initialize the service and start listening to purchase events
   */
  async initialize(): Promise<void> {
    try {
      // Set up real-time subscription for purchase events
      this.realtimeChannel = this.supabase
        .channel('purchase-events')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'purchases',
          },
          this.handlePurchaseEvent.bind(this)
        )
        .subscribe();

      console.log('InstantPayoutService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize InstantPayoutService:', error);
      throw new Error(`Service initialization failed: ${error}`);
    }
  }

  /**
   * Handle incoming purchase events and trigger payout processing
   */
  private async handlePurchaseEvent(payload: any): Promise<void> {
    try {
      const purchaseEvent: PurchaseEvent = payload.new;
      console.log(`Processing purchase event: ${purchaseEvent.id}`);

      await this.processInstantPayout(purchaseEvent);
    } catch (error) {
      console.error(`Failed to handle purchase event:`, error);
      await this.logPayoutError(payload.new?.id, error);
    }
  }

  /**
   * Process instant payout for a purchase event
   */
  async processInstantPayout(purchaseEvent: PurchaseEvent): Promise<PayoutTransaction> {
    try {
      // Get creator payout configuration
      const creatorConfig = await this.getCreatorPayoutConfig(purchaseEvent.creator_id);
      if (!creatorConfig) {
        throw new Error(`No payout configuration found for creator: ${purchaseEvent.creator_id}`);
      }

      // Calculate revenue share and platform fees
      const revenueCalculation = this.calculateRevenue(purchaseEvent, creatorConfig);

      // Calculate taxes
      const taxCalculation = await this.calculateTaxes(
        revenueCalculation.creatorAmount,
        creatorConfig.tax_jurisdiction,
        creatorConfig.tax_id
      );

      // Create payout transaction record
      const payoutTransaction: Omit<PayoutTransaction, 'id'> = {
        creator_id: purchaseEvent.creator_id,
        purchase_event_id: purchaseEvent.id,
        gross_amount: revenueCalculation.creatorAmount,
        platform_fee: revenueCalculation.platformFee,
        tax_amount: taxCalculation.tax_amount,
        net_amount: taxCalculation.net_amount,
        currency: purchaseEvent.currency,
        status: 'pending',
        tax_calculation: taxCalculation,
        metadata: {
          purchase_type: purchaseEvent.purchase_type,
          original_amount: purchaseEvent.amount,
        },
      };

      // Save transaction to database
      const savedTransaction = await this.savePayoutTransaction(payoutTransaction);

      // Check minimum payout threshold
      if (taxCalculation.net_amount < creatorConfig.minimum_payout_threshold) {
        await this.addToCreatorBalance(purchaseEvent.creator_id, taxCalculation.net_amount);
        await this.updateTransactionStatus(savedTransaction.id, 'completed');
        console.log(`Amount below threshold, added to creator balance: ${purchaseEvent.creator_id}`);
        return savedTransaction;
      }

      // Process payout via Stripe
      await this.processStripeTransfer(savedTransaction, creatorConfig);

      // Send notification
      await this.sendPayoutNotification(savedTransaction, creatorConfig);

      return savedTransaction;
    } catch (error) {
      console.error('Failed to process instant payout:', error);
      throw new Error(`Payout processing failed: ${error}`);
    }
  }

  /**
   * Calculate revenue split between creator and platform
   */
  private calculateRevenue(
    purchaseEvent: PurchaseEvent,
    creatorConfig: CreatorPayoutConfig
  ): { creatorAmount: number; platformFee: number } {
    const platformFee = purchaseEvent.amount * purchaseEvent.platform_fee_rate;
    const remainingAmount = purchaseEvent.amount - platformFee;
    const creatorAmount = remainingAmount * creatorConfig.revenue_share_rate;

    return {
      creatorAmount,
      platformFee,
    };
  }

  /**
   * Calculate taxes for payout amount
   */
  async calculateTaxes(
    amount: number,
    jurisdiction: string,
    taxId?: string
  ): Promise<TaxCalculation> {
    try {
      if (this.taxApiProvider === 'taxjar') {
        return await this.calculateTaxesWithTaxJar(amount, jurisdiction, taxId);
      } else {
        return await this.calculateTaxesWithAvalara(amount, jurisdiction, taxId);
      }
    } catch (error) {
      console.error('Tax calculation failed:', error);
      // Fallback to basic calculation
      return this.calculateBasicTaxes(amount, jurisdiction);
    }
  }

  /**
   * Calculate taxes using TaxJar API
   */
  private async calculateTaxesWithTaxJar(
    amount: number,
    jurisdiction: string,
    taxId?: string
  ): Promise<TaxCalculation> {
    const response = await fetch('https://api.taxjar.com/v2/taxes', {
      method: 'POST',
      headers: {
        'Authorization': `Token token="${this.taxApiKey}"`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        shipping: 0,
        to_country: 'US',
        to_state: jurisdiction,
        line_items: [
          {
            quantity: 1,
            unit_price: amount,
            product_tax_code: '31000', // Digital goods
          },
        ],
      }),
    });

    const taxData = await response.json();

    return {
      gross_amount: amount,
      tax_rate: taxData.tax.rate,
      tax_amount: taxData.tax.amount_to_collect,
      net_amount: amount - taxData.tax.amount_to_collect,
      tax_jurisdiction: jurisdiction,
      tax_breakdown: {
        federal: taxData.tax.breakdown?.federal_amount || 0,
        state: taxData.tax.breakdown?.state_amount || 0,
        local: taxData.tax.breakdown?.local_amount || 0,
      },
    };
  }

  /**
   * Calculate taxes using Avalara API
   */
  private async calculateTaxesWithAvalara(
    amount: number,
    jurisdiction: string,
    taxId?: string
  ): Promise<TaxCalculation> {
    // Avalara implementation would go here
    // For now, return basic calculation
    return this.calculateBasicTaxes(amount, jurisdiction);
  }

  /**
   * Fallback basic tax calculation
   */
  private calculateBasicTaxes(amount: number, jurisdiction: string): TaxCalculation {
    const taxRate = 0.15; // 15% default tax rate
    const taxAmount = amount * taxRate;

    return {
      gross_amount: amount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      net_amount: amount - taxAmount,
      tax_jurisdiction: jurisdiction,
      tax_breakdown: {
        federal: taxAmount,
      },
    };
  }

  /**
   * Process Stripe transfer to creator
   */
  private async processStripeTransfer(
    transaction: PayoutTransaction,
    creatorConfig: CreatorPayoutConfig
  ): Promise<void> {
    try {
      await this.updateTransactionStatus(transaction.id, 'processing');

      const transfer = await this.stripe.transfers.create({
        amount: Math.round(transaction.net_amount * 100), // Convert to cents
        currency: transaction.currency.toLowerCase(),
        destination: creatorConfig.stripe_account_id,
        description: `Payout for purchase ${transaction.purchase_event_id}`,
        metadata: {
          creator_id: transaction.creator_id,
          payout_transaction_id: transaction.id,
        },
      });

      await this.updateTransactionWithStripeId(transaction.id, transfer.id);
      await this.updateTransactionStatus(transaction.id, 'completed');

      console.log(`Stripe transfer completed: ${transfer.id}`);
    } catch (error) {
      await this.updateTransactionStatus(transaction.id, 'failed');
      await this.updateTransactionError(transaction.id, error.toString());
      throw error;
    }
  }

  /**
   * Get creator payout configuration
   */
  async getCreatorPayoutConfig(creatorId: string): Promise<CreatorPayoutConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_payout_configs')
        .select('*')
        .eq('creator_id', creatorId)
        .single();

      if (error) {
        console.error('Error fetching creator config:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to get creator payout config:', error);
      return null;
    }
  }

  /**
   * Save payout transaction to database
   */
  private async savePayoutTransaction(
    transaction: Omit<PayoutTransaction, 'id'>
  ): Promise<PayoutTransaction> {
    try {
      const { data, error } = await this.supabase
        .from('payout_transactions')
        .insert(transaction)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save payout transaction: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error saving payout transaction:', error);
      throw error;
    }
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(transactionId: string, status: PayoutTransaction['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('payout_transactions')
        .update({ 
          status,
          ...(status === 'completed' && { processed_at: new Date().toISOString() })
        })
        .eq('id', transactionId);

      if (error) {
        throw new Error(`Failed to update transaction status: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating transaction status:', error);
      throw error;
    }
  }

  /**
   * Update transaction with Stripe transfer ID
   */
  private async updateTransactionWithStripeId(transactionId: string, stripeTransferId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('payout_transactions')
        .update({ stripe_transfer_id: stripeTransferId })
        .eq('id', transactionId);

      if (error) {
        throw new Error(`Failed to update Stripe transfer ID: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating Stripe transfer ID:', error);
      throw error;
    }
  }

  /**
   * Update transaction error message
   */
  private async updateTransactionError(transactionId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('payout_transactions')
        .update({ error_message: errorMessage })
        .eq('id', transactionId);

      if (error) {
        throw new Error(`Failed to update transaction error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating transaction error:', error);
      throw error;
    }
  }

  /**
   * Add amount to creator balance for amounts below threshold
   */
  private async addToCreatorBalance(creatorId: string, amount: number): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('add_to_creator_balance', {
        creator_id: creatorId,
        amount: amount,
      });

      if (error) {
        throw new Error(`Failed to add to creator balance: ${error.message}`);
      }
    } catch (error) {
      console.error('Error adding to creator balance:', error);
      throw error;
    }
  }

  /**
   * Send payout notification to creator
   */
  private async sendPayoutNotification(
    transaction: PayoutTransaction,
    creatorConfig: CreatorPayoutConfig
  ): Promise<void> {
    try {
      if (this.config.webhookEndpoint) {
        await fetch(this.config.webhookEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'payout.completed',
            creator_id: transaction.creator_id,
            transaction_id: transaction.id,
            amount: transaction.net_amount,
            currency: transaction.currency,
            timestamp: new Date().toISOString(),
          }),
        });
      }

      console.log(`Payout notification sent for transaction: ${transaction.id}`);
    } catch (error) {
      console.error('Failed to send payout notification:', error);
      // Don't throw here as notification failure shouldn't fail the payout
    }
  }

  /**
   * Get payout history for a creator
   */
  async getPayoutHistory(
    creatorId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<PayoutTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('payout_transactions')
        .select('*')
        .eq('creator_id', creatorId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get payout history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting payout history:', error);
      throw error;
    }
  }

  /**
   * Generate payout summary for a period
   */
  async generatePayoutSummary(
    creatorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PayoutSummary> {
    try {
      const transactions = await this.getPayoutHistory(creatorId, startDate, endDate, 1000);

      const summary: PayoutSummary = {
        creator_id: creatorId,
        period_start: startDate,
        period_end: endDate,
        total_gross: 0,
        total_fees: 0,
        total_taxes: 0,
        total_net: 0,
        transaction_count: transactions.length,
        currency: this.config.defaultCurrency,
      };

      for (const transaction of transactions) {
        summary.total_gross += transaction.gross_amount;
        summary.total_fees += transaction.platform_fee;
        summary.total_taxes += transaction.tax_amount;
        summary.total_net += transaction.net_amount;
      }

      return summary;
    } catch (error) {
      console.error('Error generating payout summary:', error);
      throw error;
    }
  }

  /**
   * Generate tax report for a creator
   */
  async generateTaxReport(
    creatorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TaxReport> {
    try {
      const transactions = await this.getPayoutHistory(creatorId, startDate, endDate, 1000);
      
      const taxBreakdown: Record<string, number> = {};
      let totalEarnings = 0;
      let totalTaxes = 0;

      for (const transaction of transactions) {
        totalEarnings += transaction.gross_amount;
        totalTaxes += transaction.tax_amount;

        const jurisdiction = transaction.tax_calculation.tax_jurisdiction;
        if (!taxBreakdown[jurisdiction]) {
          taxBreakdown[jurisdiction] = 0;
        }
        taxBreakdown[jurisdiction] += transaction.tax_amount;
      }

      const report: TaxReport = {
        report_id: `tax-report-${creatorId}-${Date.now()}`,
        creator_id: creatorId,
        reporting_period: {
          start: startDate,
          end: endDate,
        },
        total_earnings: totalEarnings,
        total_taxes_withheld: totalTaxes,
        tax_breakdown: taxBreakdown,
        transactions,
        generated_at: new Date(),
      };

      // Save report to database
      await this.saveTaxReport(report);

      return report;
    } catch (error) {
      console.error('Error generating tax report:', error);
      throw error;
    }
  }

  /**
   * Save tax report to database
   */
  private async saveTaxReport(report: TaxReport): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('tax_reports')
        .insert(report);

      if (error) {
        throw new Error(`Failed to save tax report: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving tax report:', error);
      throw error;
    }
  }

  /**
   * Log payout processing errors
   */
  private async logPayoutError(purchaseEventId: string, error: any): Promise<void> {
    try {
      const { error: logError } = await this.supabase
        .from('payout_error_logs')
        .insert({
          purchase_event_id: purchaseEventId,
          error_message: error.toString(),
          error_stack: error.stack,
          timestamp: new Date().toISOString(),
        });

      if (logError) {
        console.error('Failed to log payout error:', logError);
      }
    } catch (logErr) {
      console.error('Error logging payout error:', logErr);
    }
  }

  /**
   * Clean up resources and stop listening to events
   */
  async destroy(): Promise<void> {
    try {
      if (this.realtimeChannel) {
        await this.supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
      console.log('InstantPayoutService destroyed successfully');
    } catch (error) {
      console.error('Error destroying InstantPayoutService:', error);
      throw error;
    }
  }
}

export default InstantPayoutService;
```