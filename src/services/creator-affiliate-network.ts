```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Affiliate program configuration interface
 */
export interface AffiliateProgram {
  id: string;
  creator_id: string;
  agent_id: string;
  name: string;
  description: string;
  base_commission_rate: number;
  tier_structure: AffiliateTier[];
  cookie_duration: number; // days
  min_payout: number;
  status: 'active' | 'paused' | 'ended';
  created_at: string;
  updated_at: string;
}

/**
 * Affiliate tier structure for multi-level commissions
 */
export interface AffiliateTier {
  level: number;
  commission_rate: number;
  requirements: {
    min_sales?: number;
    min_revenue?: number;
    min_referrals?: number;
  };
  name: string;
  benefits: string[];
}

/**
 * Affiliate link tracking information
 */
export interface AffiliateLink {
  id: string;
  program_id: string;
  affiliate_id: string;
  tracking_code: string;
  custom_parameters: Record<string, any>;
  clicks: number;
  conversions: number;
  revenue: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Referral tracking record
 */
export interface Referral {
  id: string;
  program_id: string;
  affiliate_id: string;
  user_id: string;
  agent_id: string;
  purchase_amount: number;
  commission_amount: number;
  tier_level: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  tracking_data: {
    source: string;
    medium: string;
    campaign?: string;
    click_id: string;
  };
  created_at: string;
}

/**
 * Commission payout record
 */
export interface Payout {
  id: string;
  affiliate_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_method: string;
  payment_details: Record<string, any>;
  processed_at?: string;
  created_at: string;
}

/**
 * Affiliate performance metrics
 */
export interface AffiliateMetrics {
  affiliate_id: string;
  program_id: string;
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  total_commission: number;
  conversion_rate: number;
  average_order_value: number;
  current_tier: number;
  pending_balance: number;
  paid_balance: number;
  period: {
    start_date: string;
    end_date: string;
  };
}

/**
 * Affiliate invite configuration
 */
export interface AffiliateInvite {
  id: string;
  program_id: string;
  email: string;
  custom_message?: string;
  invite_code: string;
  status: 'sent' | 'accepted' | 'expired';
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

/**
 * Service error types
 */
export class AffiliateNetworkError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AffiliateNetworkError';
  }
}

/**
 * Referral tracking service for conversion attribution
 */
export class ReferralTracker {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Track affiliate link click
   */
  async trackClick(linkId: string, userAgent: string, ip: string): Promise<string> {
    try {
      const clickId = uuidv4();
      
      // Record click event
      const { error } = await this.supabase
        .from('affiliate_clicks')
        .insert({
          id: clickId,
          link_id: linkId,
          user_agent: userAgent,
          ip_address: ip,
          clicked_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update link click count
      await this.supabase.rpc('increment_link_clicks', { link_id: linkId });

      return clickId;
    } catch (error) {
      throw new AffiliateNetworkError(
        'Failed to track click',
        'CLICK_TRACKING_FAILED',
        500
      );
    }
  }

  /**
   * Track conversion from affiliate referral
   */
  async trackConversion(
    clickId: string,
    userId: string,
    agentId: string,
    purchaseAmount: number
  ): Promise<Referral> {
    try {
      // Get click data with affiliate link info
      const { data: clickData, error: clickError } = await this.supabase
        .from('affiliate_clicks')
        .select(`
          *,
          affiliate_links (
            *,
            affiliate_programs (*)
          )
        `)
        .eq('id', clickId)
        .single();

      if (clickError || !clickData) {
        throw new AffiliateNetworkError(
          'Click not found',
          'CLICK_NOT_FOUND',
          404
        );
      }

      const link = clickData.affiliate_links;
      const program = link.affiliate_programs;

      // Calculate commission based on tier
      const commissionAmount = this.calculateCommission(
        purchaseAmount,
        program.tier_structure,
        link.affiliate_id
      );

      // Create referral record
      const referral: Partial<Referral> = {
        id: uuidv4(),
        program_id: program.id,
        affiliate_id: link.affiliate_id,
        user_id: userId,
        agent_id: agentId,
        purchase_amount: purchaseAmount,
        commission_amount: commissionAmount,
        tier_level: 1, // Calculate based on affiliate performance
        status: 'pending',
        tracking_data: {
          source: 'affiliate',
          medium: 'link',
          click_id: clickId
        }
      };

      const { data, error } = await this.supabase
        .from('referrals')
        .insert(referral)
        .select()
        .single();

      if (error) throw error;

      // Update link conversion stats
      await this.supabase.rpc('increment_link_conversions', {
        link_id: link.id,
        revenue: purchaseAmount
      });

      return data as Referral;
    } catch (error) {
      if (error instanceof AffiliateNetworkError) throw error;
      throw new AffiliateNetworkError(
        'Failed to track conversion',
        'CONVERSION_TRACKING_FAILED',
        500
      );
    }
  }

  /**
   * Calculate commission based on tier structure
   */
  private calculateCommission(
    purchaseAmount: number,
    tiers: AffiliateTier[],
    affiliateId: string
  ): number {
    // For now, use base tier - in full implementation,
    // would check affiliate's current tier based on performance
    const baseTier = tiers.find(t => t.level === 1) || tiers[0];
    return purchaseAmount * baseTier.commission_rate;
  }
}

/**
 * Commission calculation service with multi-tier logic
 */
export class CommissionCalculator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calculate commission for a referral
   */
  async calculateCommission(
    programId: string,
    affiliateId: string,
    purchaseAmount: number
  ): Promise<{
    commission: number;
    tier: AffiliateTier;
    breakdown: Record<string, number>;
  }> {
    try {
      // Get program and affiliate performance data
      const [programData, affiliateStats] = await Promise.all([
        this.getProgram(programId),
        this.getAffiliateStats(programId, affiliateId)
      ]);

      // Determine affiliate's current tier
      const currentTier = this.determineAffiliateTier(
        programData.tier_structure,
        affiliateStats
      );

      // Calculate base commission
      const baseCommission = purchaseAmount * currentTier.commission_rate;

      // Apply any bonuses or multipliers
      const bonus = this.calculateBonuses(affiliateStats, purchaseAmount);

      return {
        commission: baseCommission + bonus,
        tier: currentTier,
        breakdown: {
          base: baseCommission,
          bonus: bonus,
          total: baseCommission + bonus
        }
      };
    } catch (error) {
      throw new AffiliateNetworkError(
        'Failed to calculate commission',
        'COMMISSION_CALC_FAILED',
        500
      );
    }
  }

  /**
   * Get program data
   */
  private async getProgram(programId: string): Promise<AffiliateProgram> {
    const { data, error } = await this.supabase
      .from('affiliate_programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (error || !data) {
      throw new AffiliateNetworkError(
        'Program not found',
        'PROGRAM_NOT_FOUND',
        404
      );
    }

    return data;
  }

  /**
   * Get affiliate performance statistics
   */
  private async getAffiliateStats(
    programId: string,
    affiliateId: string
  ): Promise<AffiliateMetrics> {
    // This would typically query aggregated stats
    // For now, return basic structure
    return {
      affiliate_id: affiliateId,
      program_id: programId,
      total_clicks: 0,
      total_conversions: 0,
      total_revenue: 0,
      total_commission: 0,
      conversion_rate: 0,
      average_order_value: 0,
      current_tier: 1,
      pending_balance: 0,
      paid_balance: 0,
      period: {
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString()
      }
    };
  }

  /**
   * Determine affiliate's tier based on performance
   */
  private determineAffiliateTier(
    tiers: AffiliateTier[],
    stats: AffiliateMetrics
  ): AffiliateTier {
    // Sort tiers by level descending to check highest first
    const sortedTiers = [...tiers].sort((a, b) => b.level - a.level);

    for (const tier of sortedTiers) {
      const meets = this.meetsRequirements(tier.requirements, stats);
      if (meets) return tier;
    }

    // Return lowest tier if none met
    return tiers.sort((a, b) => a.level - b.level)[0];
  }

  /**
   * Check if affiliate meets tier requirements
   */
  private meetsRequirements(
    requirements: AffiliateTier['requirements'],
    stats: AffiliateMetrics
  ): boolean {
    if (requirements.min_sales && stats.total_conversions < requirements.min_sales) {
      return false;
    }
    if (requirements.min_revenue && stats.total_revenue < requirements.min_revenue) {
      return false;
    }
    if (requirements.min_referrals && stats.total_conversions < requirements.min_referrals) {
      return false;
    }
    return true;
  }

  /**
   * Calculate performance bonuses
   */
  private calculateBonuses(stats: AffiliateMetrics, purchaseAmount: number): number {
    let bonus = 0;

    // Example bonus logic - could be more sophisticated
    if (stats.conversion_rate > 0.05) { // 5% conversion rate
      bonus += purchaseAmount * 0.005; // 0.5% bonus
    }

    if (stats.total_conversions > 100) {
      bonus += purchaseAmount * 0.002; // 0.2% volume bonus
    }

    return bonus;
  }
}

/**
 * Payout processing service for affiliate payments
 */
export class PayoutProcessor {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Process pending payouts for an affiliate
   */
  async processPayout(
    affiliateId: string,
    paymentMethod: string,
    paymentDetails: Record<string, any>
  ): Promise<Payout> {
    try {
      // Get pending balance
      const pendingBalance = await this.getPendingBalance(affiliateId);

      if (pendingBalance <= 0) {
        throw new AffiliateNetworkError(
          'No pending balance for payout',
          'NO_PENDING_BALANCE',
          400
        );
      }

      // Create payout record
      const payout: Partial<Payout> = {
        id: uuidv4(),
        affiliate_id: affiliateId,
        amount: pendingBalance,
        currency: 'USD',
        status: 'pending',
        payment_method: paymentMethod,
        payment_details: paymentDetails
      };

      const { data, error } = await this.supabase
        .from('payouts')
        .insert(payout)
        .select()
        .single();

      if (error) throw error;

      // Process payment (integrate with payment processor)
      await this.processPayment(data as Payout);

      return data as Payout;
    } catch (error) {
      if (error instanceof AffiliateNetworkError) throw error;
      throw new AffiliateNetworkError(
        'Failed to process payout',
        'PAYOUT_FAILED',
        500
      );
    }
  }

  /**
   * Get pending commission balance for affiliate
   */
  async getPendingBalance(affiliateId: string): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('get_pending_commission_balance', { affiliate_id: affiliateId });

    if (error) throw error;
    return data || 0;
  }

  /**
   * Process payment through payment gateway
   */
  private async processPayment(payout: Payout): Promise<void> {
    // Integrate with payment processor (Stripe, PayPal, etc.)
    // For now, just update status
    await this.supabase
      .from('payouts')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', payout.id);
  }
}

/**
 * Affiliate analytics and reporting service
 */
export class AffiliateAnalytics {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get comprehensive affiliate metrics
   */
  async getAffiliateMetrics(
    affiliateId: string,
    programId?: string,
    dateRange?: { start: string; end: string }
  ): Promise<AffiliateMetrics> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_affiliate_metrics', {
          affiliate_id: affiliateId,
          program_id: programId,
          start_date: dateRange?.start,
          end_date: dateRange?.end
        });

      if (error) throw error;

      return data as AffiliateMetrics;
    } catch (error) {
      throw new AffiliateNetworkError(
        'Failed to get metrics',
        'METRICS_FAILED',
        500
      );
    }
  }

  /**
   * Get program performance overview
   */
  async getProgramMetrics(
    programId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    total_affiliates: number;
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    total_commissions: number;
    conversion_rate: number;
    top_affiliates: Array<{
      affiliate_id: string;
      conversions: number;
      revenue: number;
      commission: number;
    }>;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_program_metrics', {
          program_id: programId,
          start_date: dateRange?.start,
          end_date: dateRange?.end
        });

      if (error) throw error;

      return data;
    } catch (error) {
      throw new AffiliateNetworkError(
        'Failed to get program metrics',
        'PROGRAM_METRICS_FAILED',
        500
      );
    }
  }
}

/**
 * Affiliate invitation and recruitment service
 */
export class AffiliateInviteManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Send affiliate program invitation
   */
  async sendInvitation(
    programId: string,
    email: string,
    customMessage?: string
  ): Promise<AffiliateInvite> {
    try {
      const invite: Partial<AffiliateInvite> = {
        id: uuidv4(),
        program_id: programId,
        email: email,
        custom_message: customMessage,
        invite_code: this.generateInviteCode(),
        status: 'sent',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      const { data, error } = await this.supabase
        .from('affiliate_invites')
        .insert(invite)
        .select()
        .single();

      if (error) throw error;

      // Send invitation email (integrate with email service)
      await this.sendInvitationEmail(data as AffiliateInvite);

      return data as AffiliateInvite;
    } catch (error) {
      throw new AffiliateNetworkError(
        'Failed to send invitation',
        'INVITE_FAILED',
        500
      );
    }
  }

  /**
   * Accept affiliate invitation
   */
  async acceptInvitation(
    inviteCode: string,
    affiliateData: {
      user_id: string;
      name: string;
      profile_data?: Record<string, any>;
    }
  ): Promise<AffiliateLink> {
    try {
      // Verify invitation
      const { data: invite, error: inviteError } = await this.supabase
        .from('affiliate_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'sent')
        .single();

      if (inviteError || !invite) {
        throw new AffiliateNetworkError(
          'Invalid or expired invitation',
          'INVALID_INVITE',
          400
        );
      }

      // Check expiration
      if (new Date(invite.expires_at) < new Date()) {
        throw new AffiliateNetworkError(
          'Invitation has expired',
          'INVITE_EXPIRED',
          400
        );
      }

      // Create affiliate link
      const link = await this.createAffiliateLink(
        invite.program_id,
        affiliateData.user_id
      );

      // Update invitation status
      await this.supabase
        .from('affiliate_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      return link;
    } catch (error) {
      if (error instanceof AffiliateNetworkError) throw error;
      throw new AffiliateNetworkError(
        'Failed to accept invitation',
        'ACCEPT_FAILED',
        500
      );
    }
  }

  /**
   * Generate unique invite code
   */
  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(invite: AffiliateInvite): Promise<void> {
    // Integrate with email service
    console.log(`Sending invitation to ${invite.email} with code ${invite.invite_code}`);
  }

  /**
   * Create affiliate link for accepted invitation
   */
  private async createAffiliateLink(
    programId: string,
    affiliateId: string
  ): Promise<AffiliateLink> {
    const link: Partial<AffiliateLink> = {
      id: uuidv4(),
      program_id: programId,
      affiliate_id: affiliateId,
      tracking_code: this.generateTrackingCode(),
      custom_parameters: {},
      clicks: 0,
      conversions: 0,
      revenue: 0,
      is_active: true
    };

    const { data, error } = await this.supabase
      .from('affiliate_links')
      .insert(link)
      .select()
      .single();

    if (error) throw error;

    return data as AffiliateLink;
  }

  /**
   * Generate unique tracking code
   */
  private generateTrackingCode(): string {
    return 'AFF' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }
}

/**
 * Tier management service for level-based commissions
 */
export class TierManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Update affiliate tier based on performance
   */
  async updateAffiliateTier(
    programId: string,
    affiliateId: string
  ): Promise<AffiliateTier | null> {
    try {
      // Get program tier structure
      const { data: program, error } = await this.supabase
        .from('affiliate_programs')
        .select('tier_structure')
        .eq('id', programId)
        .single();

      if (error) throw error;

      // Get affiliate performance
      const analytics = new AffiliateAnalytics(this.supabase);
      const metrics = await analytics.getAffiliateMetrics(affiliateId, programId);

      // Calculate new tier
      const calculator = new CommissionCalculator(this.supabase);
      const newTier = calculator['determineAffiliateTier'](
        program.tier_structure,
        metrics
      );

      // Update affiliate tier if changed
      if (newTier.level !== metrics.current_tier) {
        await this.supabase
          .from('affiliate_memberships')
          .update({ current_tier: newTier.level })
          .eq('program_id', programId)
          .eq('affiliate_id', affiliateId);

        return newTier;
      }

      return null;
    } catch (error) {
      throw new AffiliateNetworkError(
        'Failed to update tier',
        'TIER_UPDATE_FAILED',
        500
      );