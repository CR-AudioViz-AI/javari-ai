```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PaymentProcessingService } from './payment-processing.service';
import { NotificationService } from './notification.service';
import { AnalyticsService } from './analytics.service';

/**
 * Royalty distribution calculation modes
 */
export enum DistributionMode {
  PERCENTAGE = 'percentage',
  FIXED_RATE = 'fixed_rate',
  HYBRID = 'hybrid'
}

/**
 * Stakeholder types for royalty distribution
 */
export enum StakeholderType {
  ARTIST = 'artist',
  COLLABORATOR = 'collaborator',
  PRODUCER = 'producer',
  SONGWRITER = 'songwriter',
  PUBLISHER = 'publisher',
  LABEL = 'label',
  PLATFORM = 'platform',
  EXTERNAL_LICENSEE = 'external_licensee'
}

/**
 * Distribution status tracking
 */
export enum DistributionStatus {
  PENDING = 'pending',
  CALCULATING = 'calculating',
  CALCULATED = 'calculated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISPUTED = 'disputed'
}

/**
 * Individual stakeholder in royalty distribution
 */
export interface Stakeholder {
  id: string;
  userId: string;
  type: StakeholderType;
  name: string;
  email: string;
  paymentMethod: string;
  isActive: boolean;
}

/**
 * Royalty agreement between stakeholders
 */
export interface RoyaltyAgreement {
  id: string;
  contentId: string;
  stakeholderId: string;
  percentage?: number;
  fixedRate?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  priority: number;
  mode: DistributionMode;
  effectiveDate: Date;
  expirationDate?: Date;
  conditions?: Record<string, any>;
  isActive: boolean;
}

/**
 * Revenue stream input for distribution
 */
export interface RevenueStream {
  id: string;
  contentId: string;
  source: string;
  grossAmount: number;
  netAmount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  metadata: Record<string, any>;
}

/**
 * Calculated distribution for a stakeholder
 */
export interface CalculatedDistribution {
  stakeholderId: string;
  agreementId: string;
  grossAmount: number;
  netAmount: number;
  deductions: DistributionDeduction[];
  calculationMethod: string;
  metadata: Record<string, any>;
}

/**
 * Deduction applied to distribution
 */
export interface DistributionDeduction {
  type: string;
  amount: number;
  percentage?: number;
  description: string;
}

/**
 * Complete royalty distribution record
 */
export interface RoyaltyDistribution {
  id: string;
  revenueStreamId: string;
  contentId: string;
  totalRevenue: number;
  totalDistributed: number;
  platformFee: number;
  distributions: CalculatedDistribution[];
  status: DistributionStatus;
  calculatedAt: Date;
  processedAt?: Date;
  auditTrail: DistributionAuditEntry[];
}

/**
 * Audit trail entry for distribution tracking
 */
export interface DistributionAuditEntry {
  timestamp: Date;
  action: string;
  userId?: string;
  details: Record<string, any>;
  previousValue?: any;
  newValue?: any;
}

/**
 * Batch processing job for multiple distributions
 */
export interface BatchDistributionJob {
  id: string;
  revenueStreams: RevenueStream[];
  status: DistributionStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt: Date;
  completedAt?: Date;
  errors: string[];
}

/**
 * Distribution validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalPercentage?: number;
  conflictingAgreements?: RoyaltyAgreement[];
}

/**
 * Service configuration options
 */
export interface RoyaltyDistributionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  defaultPlatformFee: number;
  minimumDistributionAmount: number;
  maxStakeholdersPerContent: number;
  enableAuditLogging: boolean;
  enableNotifications: boolean;
}

/**
 * Advanced royalty distribution service for calculating complex royalty splits
 * across multiple stakeholders with audit trails and batch processing
 */
export class RoyaltyDistributionService {
  private supabase: SupabaseClient;
  private paymentService: PaymentProcessingService;
  private notificationService: NotificationService;
  private analyticsService: AnalyticsService;
  private config: RoyaltyDistributionConfig;

  constructor(
    config: RoyaltyDistributionConfig,
    paymentService: PaymentProcessingService,
    notificationService: NotificationService,
    analyticsService: AnalyticsService
  ) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.paymentService = paymentService;
    this.notificationService = notificationService;
    this.analyticsService = analyticsService;
  }

  /**
   * Calculate royalty distribution for a revenue stream
   */
  async calculateDistribution(
    revenueAmount: number,
    contentId: string,
    metadata: Record<string, any> = {}
  ): Promise<RoyaltyDistribution> {
    try {
      // Create audit trail entry
      const auditTrail: DistributionAuditEntry[] = [{
        timestamp: new Date(),
        action: 'calculation_started',
        details: { revenueAmount, contentId, metadata }
      }];

      // Get active agreements for content
      const agreements = await this.getActiveAgreements(contentId);
      
      // Validate agreements
      const validation = await this.validateStakeholders(agreements);
      if (!validation.isValid) {
        throw new Error(`Invalid stakeholder agreements: ${validation.errors.join(', ')}`);
      }

      // Calculate platform fee
      const platformFee = revenueAmount * (this.config.defaultPlatformFee / 100);
      const distributableAmount = revenueAmount - platformFee;

      // Calculate individual distributions
      const distributions = await this.calculateIndividualDistributions(
        distributableAmount,
        agreements
      );

      // Create distribution record
      const distribution: RoyaltyDistribution = {
        id: crypto.randomUUID(),
        revenueStreamId: metadata.revenueStreamId || crypto.randomUUID(),
        contentId,
        totalRevenue: revenueAmount,
        totalDistributed: distributions.reduce((sum, d) => sum + d.netAmount, 0),
        platformFee,
        distributions,
        status: DistributionStatus.CALCULATED,
        calculatedAt: new Date(),
        auditTrail: [
          ...auditTrail,
          {
            timestamp: new Date(),
            action: 'calculation_completed',
            details: { 
              distributionsCount: distributions.length,
              totalDistributed: distributions.reduce((sum, d) => sum + d.netAmount, 0)
            }
          }
        ]
      };

      // Save to database
      await this.saveDistribution(distribution);

      // Track analytics
      await this.analyticsService.trackEvent('royalty_distribution_calculated', {
        contentId,
        revenueAmount,
        stakeholderCount: distributions.length,
        platformFee
      });

      return distribution;

    } catch (error) {
      throw new Error(`Failed to calculate distribution: ${error.message}`);
    }
  }

  /**
   * Process and execute a calculated distribution
   */
  async processDistribution(distributionId: string): Promise<void> {
    try {
      // Get distribution record
      const distribution = await this.getDistribution(distributionId);
      if (!distribution) {
        throw new Error('Distribution not found');
      }

      if (distribution.status !== DistributionStatus.CALCULATED) {
        throw new Error(`Cannot process distribution with status: ${distribution.status}`);
      }

      // Update status
      await this.updateDistributionStatus(distributionId, DistributionStatus.PROCESSING);

      // Process each distribution
      const processedDistributions = [];
      for (const dist of distribution.distributions) {
        try {
          // Get stakeholder payment details
          const stakeholder = await this.getStakeholder(dist.stakeholderId);
          
          // Skip if amount is below minimum
          if (dist.netAmount < this.config.minimumDistributionAmount) {
            continue;
          }

          // Process payment
          await this.paymentService.processPayment({
            recipientId: stakeholder.userId,
            amount: dist.netAmount,
            currency: 'USD', // TODO: Make configurable
            reference: `royalty_${distributionId}_${dist.stakeholderId}`,
            metadata: {
              contentId: distribution.contentId,
              distributionId,
              stakeholderType: stakeholder.type
            }
          });

          processedDistributions.push(dist);

          // Send notification
          if (this.config.enableNotifications) {
            await this.notificationService.send({
              userId: stakeholder.userId,
              type: 'royalty_payment',
              title: 'Royalty Payment Processed',
              message: `You've received a royalty payment of $${dist.netAmount.toFixed(2)}`,
              metadata: {
                amount: dist.netAmount,
                contentId: distribution.contentId,
                distributionId
              }
            });
          }

        } catch (error) {
          // Log individual distribution failure but continue processing others
          console.error(`Failed to process distribution for stakeholder ${dist.stakeholderId}:`, error);
        }
      }

      // Update distribution status
      const finalStatus = processedDistributions.length === distribution.distributions.length 
        ? DistributionStatus.COMPLETED 
        : DistributionStatus.FAILED;

      await this.updateDistributionStatus(distributionId, finalStatus);

      // Add audit entry
      await this.addAuditEntry(distributionId, {
        timestamp: new Date(),
        action: 'distribution_processed',
        details: {
          processedCount: processedDistributions.length,
          totalCount: distribution.distributions.length,
          status: finalStatus
        }
      });

      // Track analytics
      await this.analyticsService.trackEvent('royalty_distribution_processed', {
        distributionId,
        processedCount: processedDistributions.length,
        totalAmount: processedDistributions.reduce((sum, d) => sum + d.netAmount, 0)
      });

    } catch (error) {
      await this.updateDistributionStatus(distributionId, DistributionStatus.FAILED);
      throw new Error(`Failed to process distribution: ${error.message}`);
    }
  }

  /**
   * Validate stakeholder agreements for a content piece
   */
  async validateStakeholders(agreements: RoyaltyAgreement[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const conflictingAgreements: RoyaltyAgreement[] = [];

    // Check for duplicate stakeholders
    const stakeholderIds = agreements.map(a => a.stakeholderId);
    const duplicates = stakeholderIds.filter((id, index) => stakeholderIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate stakeholders found: ${duplicates.join(', ')}`);
    }

    // Calculate total percentage for percentage-based agreements
    const percentageAgreements = agreements.filter(a => a.mode === DistributionMode.PERCENTAGE);
    const totalPercentage = percentageAgreements.reduce((sum, a) => sum + (a.percentage || 0), 0);

    if (totalPercentage > 100) {
      errors.push(`Total percentage exceeds 100%: ${totalPercentage}%`);
    } else if (totalPercentage < 100 && percentageAgreements.length > 0) {
      warnings.push(`Total percentage is less than 100%: ${totalPercentage}%`);
    }

    // Check for conflicting priorities
    const priorities = agreements.map(a => a.priority);
    const conflictingPriorities = priorities.filter((p, index) => priorities.indexOf(p) !== index);
    if (conflictingPriorities.length > 0) {
      const conflicting = agreements.filter(a => conflictingPriorities.includes(a.priority));
      conflictingAgreements.push(...conflicting);
      warnings.push(`Conflicting priorities found: ${conflictingPriorities.join(', ')}`);
    }

    // Check date validity
    const now = new Date();
    const expiredAgreements = agreements.filter(a => 
      a.expirationDate && a.expirationDate < now
    );
    if (expiredAgreements.length > 0) {
      errors.push(`Expired agreements found: ${expiredAgreements.map(a => a.id).join(', ')}`);
    }

    // Check stakeholder limits
    if (agreements.length > this.config.maxStakeholdersPerContent) {
      errors.push(`Too many stakeholders: ${agreements.length} (max: ${this.config.maxStakeholdersPerContent})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalPercentage: percentageAgreements.length > 0 ? totalPercentage : undefined,
      conflictingAgreements: conflictingAgreements.length > 0 ? conflictingAgreements : undefined
    };
  }

  /**
   * Process multiple revenue streams in batch
   */
  async batchProcess(revenueStreams: RevenueStream[]): Promise<BatchDistributionJob> {
    const job: BatchDistributionJob = {
      id: crypto.randomUUID(),
      revenueStreams,
      status: DistributionStatus.PROCESSING,
      progress: 0,
      totalItems: revenueStreams.length,
      processedItems: 0,
      failedItems: 0,
      startedAt: new Date(),
      errors: []
    };

    try {
      // Save job to database
      await this.saveBatchJob(job);

      // Process each revenue stream
      for (let i = 0; i < revenueStreams.length; i++) {
        const stream = revenueStreams[i];
        
        try {
          // Calculate distribution
          const distribution = await this.calculateDistribution(
            stream.netAmount,
            stream.contentId,
            { revenueStreamId: stream.id, batchJobId: job.id }
          );

          // Process distribution
          await this.processDistribution(distribution.id);
          
          job.processedItems++;
        } catch (error) {
          job.failedItems++;
          job.errors.push(`Stream ${stream.id}: ${error.message}`);
        }

        // Update progress
        job.progress = Math.round((i + 1) / revenueStreams.length * 100);
        await this.updateBatchJob(job);
      }

      // Complete job
      job.status = job.failedItems === 0 ? DistributionStatus.COMPLETED : DistributionStatus.FAILED;
      job.completedAt = new Date();
      await this.updateBatchJob(job);

      // Track analytics
      await this.analyticsService.trackEvent('batch_distribution_completed', {
        jobId: job.id,
        totalItems: job.totalItems,
        processedItems: job.processedItems,
        failedItems: job.failedItems
      });

      return job;

    } catch (error) {
      job.status = DistributionStatus.FAILED;
      job.errors.push(`Batch processing failed: ${error.message}`);
      await this.updateBatchJob(job);
      throw error;
    }
  }

  /**
   * Calculate individual distributions based on agreements
   */
  private async calculateIndividualDistributions(
    distributableAmount: number,
    agreements: RoyaltyAgreement[]
  ): Promise<CalculatedDistribution[]> {
    // Sort by priority
    const sortedAgreements = [...agreements].sort((a, b) => a.priority - b.priority);
    const distributions: CalculatedDistribution[] = [];
    let remainingAmount = distributableAmount;

    for (const agreement of sortedAgreements) {
      const distribution = await this.calculateSingleDistribution(
        remainingAmount,
        distributableAmount,
        agreement
      );

      distributions.push(distribution);
      
      // For fixed-rate agreements, deduct from remaining amount
      if (agreement.mode === DistributionMode.FIXED_RATE) {
        remainingAmount -= distribution.grossAmount;
      }
    }

    return distributions;
  }

  /**
   * Calculate distribution for a single stakeholder
   */
  private async calculateSingleDistribution(
    remainingAmount: number,
    totalAmount: number,
    agreement: RoyaltyAgreement
  ): Promise<CalculatedDistribution> {
    let grossAmount = 0;
    const deductions: DistributionDeduction[] = [];
    
    // Calculate gross amount based on distribution mode
    switch (agreement.mode) {
      case DistributionMode.PERCENTAGE:
        grossAmount = totalAmount * ((agreement.percentage || 0) / 100);
        break;
        
      case DistributionMode.FIXED_RATE:
        grossAmount = Math.min(agreement.fixedRate || 0, remainingAmount);
        break;
        
      case DistributionMode.HYBRID:
        const percentageAmount = totalAmount * ((agreement.percentage || 0) / 100);
        const fixedAmount = agreement.fixedRate || 0;
        grossAmount = Math.max(percentageAmount, fixedAmount);
        break;
    }

    // Apply minimum/maximum constraints
    if (agreement.minimumAmount && grossAmount < agreement.minimumAmount) {
      grossAmount = agreement.minimumAmount;
    }
    if (agreement.maximumAmount && grossAmount > agreement.maximumAmount) {
      grossAmount = agreement.maximumAmount;
    }

    // Calculate net amount (after deductions)
    let netAmount = grossAmount;

    // Apply any additional deductions based on agreement conditions
    if (agreement.conditions) {
      const additionalDeductions = await this.calculateConditionalDeductions(
        grossAmount,
        agreement.conditions
      );
      deductions.push(...additionalDeductions);
      netAmount -= additionalDeductions.reduce((sum, d) => sum + d.amount, 0);
    }

    return {
      stakeholderId: agreement.stakeholderId,
      agreementId: agreement.id,
      grossAmount,
      netAmount: Math.max(0, netAmount), // Ensure non-negative
      deductions,
      calculationMethod: agreement.mode,
      metadata: {
        priority: agreement.priority,
        originalPercentage: agreement.percentage,
        originalFixedRate: agreement.fixedRate
      }
    };
  }

  /**
   * Calculate conditional deductions based on agreement terms
   */
  private async calculateConditionalDeductions(
    amount: number,
    conditions: Record<string, any>
  ): Promise<DistributionDeduction[]> {
    const deductions: DistributionDeduction[] = [];

    // Example: Transaction fee
    if (conditions.transactionFee) {
      const fee = amount * (conditions.transactionFee / 100);
      deductions.push({
        type: 'transaction_fee',
        amount: fee,
        percentage: conditions.transactionFee,
        description: 'Transaction processing fee'
      });
    }

    // Example: Tax withholding
    if (conditions.taxWithholding) {
      const tax = amount * (conditions.taxWithholding / 100);
      deductions.push({
        type: 'tax_withholding',
        amount: tax,
        percentage: conditions.taxWithholding,
        description: 'Tax withholding'
      });
    }

    return deductions;
  }

  // Database operations
  private async getActiveAgreements(contentId: string): Promise<RoyaltyAgreement[]> {
    const { data, error } = await this.supabase
      .from('stakeholder_agreements')
      .select('*')
      .eq('content_id', contentId)
      .eq('is_active', true)
      .lte('effective_date', new Date().toISOString())
      .or('expiration_date.is.null,expiration_date.gte.' + new Date().toISOString());

    if (error) throw error;
    return data || [];
  }

  private async getStakeholder(stakeholderId: string): Promise<Stakeholder> {
    const { data, error } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('id', stakeholderId)
      .single();

    if (error) throw error;
    return data;
  }

  private async saveDistribution(distribution: RoyaltyDistribution): Promise<void> {
    const { error } = await this.supabase
      .from('royalty_distributions')
      .insert(distribution);

    if (error) throw error;
  }

  private async getDistribution(distributionId: string): Promise<RoyaltyDistribution | null> {
    const { data, error } = await this.supabase
      .from('royalty_distributions')
      .select('*')
      .eq('id', distributionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  private async updateDistributionStatus(
    distributionId: string, 
    status: DistributionStatus
  ): Promise<void> {
    const updateData: any = { status };
    if (status === DistributionStatus.COMPLETED) {
      updateData.processed_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('royalty_distributions')
      .update(updateData)
      .eq('id', distributionId);

    if (error) throw error;
  }

  private async addAuditEntry(
    distributionId: string,
    entry: DistributionAuditEntry
  ): Promise<void> {
    if (!this.config.enableAuditLogging) return;

    const { error } = await this.supabase
      .from('audit_logs')
      .insert({
        entity_type: 'royalty_distribution',
        entity_id: distributionId,
        action: entry.action,
        user_id: entry.userId,
        details: entry.details,
        previous_value: entry.previousValue,
        new_value: entry.newValue,
        created_at: entry.timestamp.toISOString()
      });

    if (error) throw error;