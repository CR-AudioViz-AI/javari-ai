```typescript
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { eventEmitter } from '@/lib/events';

/**
 * Affiliate marketing platform for creators
 * Provides comprehensive referral tracking, commission calculation, and payout management
 */

// Types and Schemas
export const AffiliateStatus = z.enum(['pending', 'active', 'suspended', 'terminated']);
export const CommissionStatus = z.enum(['pending', 'approved', 'paid', 'disputed']);
export const PayoutStatus = z.enum(['pending', 'processing', 'completed', 'failed']);
export const AttributionModel = z.enum(['first_touch', 'last_touch', 'linear', 'time_decay']);

export const AffiliateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  referral_code: z.string().min(6).max(20),
  status: AffiliateStatus,
  commission_rate: z.number().min(0).max(1),
  total_referrals: z.number().int().min(0),
  total_earnings: z.number().min(0),
  pending_earnings: z.number().min(0),
  tier_level: z.number().int().min(1).max(5),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  metadata: z.record(z.any()).optional()
});

export const ReferralLinkSchema = z.object({
  id: z.string().uuid(),
  affiliate_id: z.string().uuid(),
  campaign_name: z.string().min(1).max(100),
  original_url: z.string().url(),
  tracking_url: z.string().url(),
  utm_parameters: z.record(z.string()).optional(),
  click_count: z.number().int().min(0),
  conversion_count: z.number().int().min(0),
  is_active: z.boolean(),
  expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime()
});

export const ReferralTrackingSchema = z.object({
  id: z.string().uuid(),
  affiliate_id: z.string().uuid(),
  referral_link_id: z.string().uuid(),
  visitor_id: z.string().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  referrer: z.string().url().optional(),
  landing_page: z.string().url(),
  click_timestamp: z.string().datetime(),
  conversion_timestamp: z.string().datetime().optional(),
  attributed_value: z.number().min(0).optional(),
  attribution_model: AttributionModel,
  session_data: z.record(z.any()).optional()
});

export const CommissionRecordSchema = z.object({
  id: z.string().uuid(),
  affiliate_id: z.string().uuid(),
  referral_tracking_id: z.string().uuid(),
  transaction_id: z.string().uuid().optional(),
  commission_type: z.enum(['signup', 'purchase', 'subscription', 'renewal']),
  base_amount: z.number().min(0),
  commission_rate: z.number().min(0).max(1),
  commission_amount: z.number().min(0),
  status: CommissionStatus,
  approved_at: z.string().datetime().optional(),
  paid_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  metadata: z.record(z.any()).optional()
});

export const PayoutRecordSchema = z.object({
  id: z.string().uuid(),
  affiliate_id: z.string().uuid(),
  amount: z.number().min(0),
  currency: z.string().length(3),
  status: PayoutStatus,
  payment_method: z.string(),
  payment_details: z.record(z.any()),
  commission_records: z.array(z.string().uuid()),
  processed_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error_message: z.string().optional(),
  created_at: z.string().datetime()
});

export type Affiliate = z.infer<typeof AffiliateSchema>;
export type ReferralLink = z.infer<typeof ReferralLinkSchema>;
export type ReferralTracking = z.infer<typeof ReferralTrackingSchema>;
export type CommissionRecord = z.infer<typeof CommissionRecordSchema>;
export type PayoutRecord = z.infer<typeof PayoutRecordSchema>;

// Referral Code Generator
export class ReferralCodeGenerator {
  private static readonly CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private static readonly DEFAULT_LENGTH = 8;

  /**
   * Generate unique referral code
   */
  static async generate(prefix?: string, length: number = this.DEFAULT_LENGTH): Promise<string> {
    try {
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const code = this.generateCode(prefix, length);
        const exists = await this.checkCodeExists(code);
        
        if (!exists) {
          return code;
        }
        
        attempts++;
      }

      throw new Error('Unable to generate unique referral code');
    } catch (error) {
      logger.error('Failed to generate referral code', error);
      throw error;
    }
  }

  /**
   * Generate random code string
   */
  private static generateCode(prefix?: string, length: number): string {
    let result = prefix ? `${prefix}_` : '';
    const remainingLength = length - result.length;

    for (let i = 0; i < remainingLength; i++) {
      result += this.CHARACTERS.charAt(Math.floor(Math.random() * this.CHARACTERS.length));
    }

    return result;
  }

  /**
   * Check if referral code already exists
   */
  private static async checkCodeExists(code: string): Promise<boolean> {
    const { count } = await supabase
      .from('affiliates')
      .select('id', { count: 'exact', head: true })
      .eq('referral_code', code);

    return (count || 0) > 0;
  }
}

// Commission Calculator
export class CommissionCalculator {
  /**
   * Calculate commission amount based on type and tier
   */
  static calculateCommission(
    baseAmount: number,
    commissionRate: number,
    tierMultiplier: number = 1,
    bonuses: number[] = []
  ): number {
    try {
      const baseCommission = baseAmount * commissionRate * tierMultiplier;
      const totalBonuses = bonuses.reduce((sum, bonus) => sum + bonus, 0);
      
      return Math.round((baseCommission + totalBonuses) * 100) / 100;
    } catch (error) {
      logger.error('Failed to calculate commission', error);
      return 0;
    }
  }

  /**
   * Calculate tier-based commission rate
   */
  static getTierCommissionRate(tierLevel: number, baseRate: number): number {
    const tierMultipliers: Record<number, number> = {
      1: 1.0,
      2: 1.2,
      3: 1.4,
      4: 1.7,
      5: 2.0
    };

    return baseRate * (tierMultipliers[tierLevel] || 1.0);
  }

  /**
   * Calculate time decay attribution weight
   */
  static calculateTimeDecayWeight(touchpointTime: Date, conversionTime: Date, halfLife: number = 7): number {
    const timeDiffDays = (conversionTime.getTime() - touchpointTime.getTime()) / (1000 * 60 * 60 * 24);
    return Math.pow(0.5, timeDiffDays / halfLife);
  }
}

// Attribution Service
export class AttributionService {
  /**
   * Determine attribution for conversion
   */
  static async attributeConversion(
    visitorId: string,
    conversionValue: number,
    attributionModel: AttributionModel = 'last_touch'
  ): Promise<{ affiliateId: string; attributedValue: number }[]> {
    try {
      // Get all touchpoints for visitor
      const { data: touchpoints } = await supabase
        .from('referral_tracking')
        .select('*')
        .eq('visitor_id', visitorId)
        .order('click_timestamp', { ascending: true });

      if (!touchpoints || touchpoints.length === 0) {
        return [];
      }

      switch (attributionModel) {
        case 'first_touch':
          return [{
            affiliateId: touchpoints[0].affiliate_id,
            attributedValue: conversionValue
          }];

        case 'last_touch':
          return [{
            affiliateId: touchpoints[touchpoints.length - 1].affiliate_id,
            attributedValue: conversionValue
          }];

        case 'linear':
          return this.calculateLinearAttribution(touchpoints, conversionValue);

        case 'time_decay':
          return this.calculateTimeDecayAttribution(touchpoints, conversionValue);

        default:
          throw new Error(`Unsupported attribution model: ${attributionModel}`);
      }
    } catch (error) {
      logger.error('Failed to attribute conversion', error);
      throw error;
    }
  }

  /**
   * Calculate linear attribution
   */
  private static calculateLinearAttribution(
    touchpoints: any[],
    conversionValue: number
  ): { affiliateId: string; attributedValue: number }[] {
    const valuePerTouchpoint = conversionValue / touchpoints.length;
    
    return touchpoints.map(tp => ({
      affiliateId: tp.affiliate_id,
      attributedValue: valuePerTouchpoint
    }));
  }

  /**
   * Calculate time decay attribution
   */
  private static calculateTimeDecayAttribution(
    touchpoints: any[],
    conversionValue: number
  ): { affiliateId: string; attributedValue: number }[] {
    const conversionTime = new Date();
    const weights = touchpoints.map(tp => 
      CommissionCalculator.calculateTimeDecayWeight(new Date(tp.click_timestamp), conversionTime)
    );
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    return touchpoints.map((tp, index) => ({
      affiliateId: tp.affiliate_id,
      attributedValue: (weights[index] / totalWeight) * conversionValue
    }));
  }
}

// Affiliate Service
export class AffiliateService {
  /**
   * Create new affiliate account
   */
  static async createAffiliate(userId: string, options: {
    commissionRate?: number;
    tierLevel?: number;
    referralCodePrefix?: string;
  } = {}): Promise<Affiliate> {
    try {
      const referralCode = await ReferralCodeGenerator.generate(options.referralCodePrefix);
      
      const affiliateData = {
        user_id: userId,
        referral_code: referralCode,
        status: 'pending' as const,
        commission_rate: options.commissionRate || 0.1,
        tier_level: options.tierLevel || 1,
        total_referrals: 0,
        total_earnings: 0,
        pending_earnings: 0
      };

      const { data, error } = await supabase
        .from('affiliates')
        .insert(affiliateData)
        .select()
        .single();

      if (error) throw error;

      const affiliate = AffiliateSchema.parse(data);
      
      eventEmitter.emit('affiliate:created', { affiliate });
      logger.info('Affiliate created', { affiliateId: affiliate.id });
      
      return affiliate;
    } catch (error) {
      logger.error('Failed to create affiliate', error);
      throw error;
    }
  }

  /**
   * Create referral link
   */
  static async createReferralLink(
    affiliateId: string,
    originalUrl: string,
    campaignName: string,
    options: {
      utmParameters?: Record<string, string>;
      expiresAt?: Date;
    } = {}
  ): Promise<ReferralLink> {
    try {
      const trackingUrl = this.generateTrackingUrl(affiliateId, originalUrl, options.utmParameters);
      
      const linkData = {
        affiliate_id: affiliateId,
        campaign_name: campaignName,
        original_url: originalUrl,
        tracking_url: trackingUrl,
        utm_parameters: options.utmParameters,
        click_count: 0,
        conversion_count: 0,
        is_active: true,
        expires_at: options.expiresAt?.toISOString()
      };

      const { data, error } = await supabase
        .from('referral_links')
        .insert(linkData)
        .select()
        .single();

      if (error) throw error;

      return ReferralLinkSchema.parse(data);
    } catch (error) {
      logger.error('Failed to create referral link', error);
      throw error;
    }
  }

  /**
   * Track referral click
   */
  static async trackClick(
    affiliateId: string,
    referralLinkId: string,
    trackingData: {
      visitorId?: string;
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      landingPage: string;
      sessionData?: Record<string, any>;
    }
  ): Promise<ReferralTracking> {
    try {
      const trackingRecord = {
        affiliate_id: affiliateId,
        referral_link_id: referralLinkId,
        visitor_id: trackingData.visitorId,
        ip_address: trackingData.ipAddress,
        user_agent: trackingData.userAgent,
        referrer: trackingData.referrer,
        landing_page: trackingData.landingPage,
        click_timestamp: new Date().toISOString(),
        attribution_model: 'last_touch' as const,
        session_data: trackingData.sessionData
      };

      const { data, error } = await supabase
        .from('referral_tracking')
        .insert(trackingRecord)
        .select()
        .single();

      if (error) throw error;

      // Update click count
      await supabase
        .from('referral_links')
        .update({ click_count: supabase.sql`click_count + 1` })
        .eq('id', referralLinkId);

      const tracking = ReferralTrackingSchema.parse(data);
      
      eventEmitter.emit('referral:click', { tracking });
      
      return tracking;
    } catch (error) {
      logger.error('Failed to track referral click', error);
      throw error;
    }
  }

  /**
   * Process referral conversion
   */
  static async processConversion(
    visitorId: string,
    conversionData: {
      transactionId?: string;
      commissionType: 'signup' | 'purchase' | 'subscription' | 'renewal';
      baseAmount: number;
      attributionModel?: AttributionModel;
    }
  ): Promise<CommissionRecord[]> {
    try {
      const attributions = await AttributionService.attributeConversion(
        visitorId,
        conversionData.baseAmount,
        conversionData.attributionModel
      );

      const commissionRecords: CommissionRecord[] = [];

      for (const attribution of attributions) {
        // Get affiliate details
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('*')
          .eq('id', attribution.affiliateId)
          .single();

        if (!affiliate) continue;

        const commissionRate = CommissionCalculator.getTierCommissionRate(
          affiliate.tier_level,
          affiliate.commission_rate
        );

        const commissionAmount = CommissionCalculator.calculateCommission(
          attribution.attributedValue,
          commissionRate
        );

        const commissionData = {
          affiliate_id: attribution.affiliateId,
          transaction_id: conversionData.transactionId,
          commission_type: conversionData.commissionType,
          base_amount: attribution.attributedValue,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          status: 'pending' as const
        };

        const { data: commission, error } = await supabase
          .from('commission_records')
          .insert(commissionData)
          .select()
          .single();

        if (error) {
          logger.error('Failed to create commission record', error);
          continue;
        }

        commissionRecords.push(CommissionRecordSchema.parse(commission));

        // Update affiliate stats
        await supabase
          .from('affiliates')
          .update({
            pending_earnings: supabase.sql`pending_earnings + ${commissionAmount}`,
            total_referrals: supabase.sql`total_referrals + 1`
          })
          .eq('id', attribution.affiliateId);
      }

      eventEmitter.emit('referral:conversion', { commissionRecords });
      
      return commissionRecords;
    } catch (error) {
      logger.error('Failed to process conversion', error);
      throw error;
    }
  }

  /**
   * Approve commission
   */
  static async approveCommission(commissionId: string): Promise<void> {
    try {
      const { data: commission, error: fetchError } = await supabase
        .from('commission_records')
        .select('*')
        .eq('id', commissionId)
        .single();

      if (fetchError || !commission) {
        throw new Error('Commission not found');
      }

      const { error } = await supabase
        .from('commission_records')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', commissionId);

      if (error) throw error;

      eventEmitter.emit('commission:approved', { commissionId });
      logger.info('Commission approved', { commissionId });
    } catch (error) {
      logger.error('Failed to approve commission', error);
      throw error;
    }
  }

  /**
   * Generate tracking URL
   */
  private static generateTrackingUrl(
    affiliateId: string,
    originalUrl: string,
    utmParameters?: Record<string, string>
  ): string {
    const url = new URL(originalUrl);
    url.searchParams.set('ref', affiliateId);
    
    if (utmParameters) {
      Object.entries(utmParameters).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  }
}

// Payout Service
export class PayoutService {
  private static readonly MINIMUM_PAYOUT = 50; // Minimum $50 for payout

  /**
   * Calculate pending payout for affiliate
   */
  static async calculatePendingPayout(affiliateId: string): Promise<number> {
    try {
      const { data: commissions } = await supabase
        .from('commission_records')
        .select('commission_amount')
        .eq('affiliate_id', affiliateId)
        .eq('status', 'approved');

      if (!commissions) return 0;

      return commissions.reduce((total, commission) => 
        total + commission.commission_amount, 0
      );
    } catch (error) {
      logger.error('Failed to calculate pending payout', error);
      return 0;
    }
  }

  /**
   * Process payout for affiliate
   */
  static async processPayout(
    affiliateId: string,
    paymentMethod: string,
    paymentDetails: Record<string, any>
  ): Promise<PayoutRecord> {
    try {
      const pendingAmount = await this.calculatePendingPayout(affiliateId);
      
      if (pendingAmount < this.MINIMUM_PAYOUT) {
        throw new Error(`Minimum payout amount is $${this.MINIMUM_PAYOUT}`);
      }

      // Get approved commissions
      const { data: commissions } = await supabase
        .from('commission_records')
        .select('id')
        .eq('affiliate_id', affiliateId)
        .eq('status', 'approved');

      const commissionIds = commissions?.map(c => c.id) || [];

      const payoutData = {
        affiliate_id: affiliateId,
        amount: pendingAmount,
        currency: 'USD',
        status: 'pending' as const,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        commission_records: commissionIds
      };

      const { data: payout, error } = await supabase
        .from('payout_records')
        .insert(payoutData)
        .select()
        .single();

      if (error) throw error;

      // Mark commissions as paid
      await supabase
        .from('commission_records')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .in('id', commissionIds);

      // Update affiliate earnings
      await supabase
        .from('affiliates')
        .update({
          total_earnings: supabase.sql`total_earnings + ${pendingAmount}`,
          pending_earnings: supabase.sql`pending_earnings - ${pendingAmount}`
        })
        .eq('id', affiliateId);

      const payoutRecord = PayoutRecordSchema.parse(payout);
      
      eventEmitter.emit('payout:created', { payout: payoutRecord });
      logger.info('Payout processed', { payoutId: payout.id, amount: pendingAmount });
      
      return payoutRecord;
    } catch (error) {
      logger.error('Failed to process payout', error);
      throw error;
    }
  }

  /**
   * Complete payout
   */
  static async completePayout(payoutId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('payout_records')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', payoutId);

      if (error) throw error;

      eventEmitter.emit('payout:completed', { payoutId });
      logger.info('Payout completed', { payoutId });
    } catch (error) {
      logger.error('Failed to complete payout', error);
      throw error;
    }
  }
}

// Analytics Service
export class AffiliateAnalytics {
  /**
   * Get affiliate performance metrics
   */
  static async getPerformanceMetrics(
    affiliateId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<{
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    totalEarnings: number;
    averageOrderValue: number;