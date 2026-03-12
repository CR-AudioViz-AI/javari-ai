```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});

// Validation schemas
const RevenueTrackingSchema = z.object({
  agentId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  revenue: z.number().positive(),
  currency: z.string().length(3),
  transactionId: z.string(),
  contextData: z.record(z.any()).optional(),
  attributionWeights: z.record(z.number()).optional()
});

const AttributionCalculationSchema = z.object({
  transactionId: z.string(),
  involvedAgents: z.array(z.string().uuid()),
  attributionModel: z.enum(['linear', 'first_touch', 'last_touch', 'time_decay', 'position_based']),
  customWeights: z.record(z.number()).optional()
});

const PayoutInitiationSchema = z.object({
  agentIds: z.array(z.string().uuid()).optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  minimumPayout: z.number().positive().optional()
});

// Core service classes
class RevenueAttributionService {
  static async trackRevenue(data: z.infer<typeof RevenueTrackingSchema>) {
    try {
      // Record base revenue event
      const { data: revenueEvent, error: revenueError } = await supabase
        .from('agent_revenue_tracking')
        .insert({
          agent_id: data.agentId,
          deployment_id: data.deploymentId,
          revenue_amount: data.revenue,
          currency: data.currency,
          transaction_id: data.transactionId,
          context_data: data.contextData || {},
          tracked_at: new Date().toISOString()
        })
        .select()
        .single();

      if (revenueError) throw revenueError;

      // Update deployment context metrics
      await this.updateDeploymentMetrics(data.deploymentId, data.revenue);

      // Process attribution weights if provided
      if (data.attributionWeights) {
        await this.processAttributionWeights(revenueEvent.id, data.attributionWeights);
      }

      return revenueEvent;
    } catch (error) {
      throw new Error(`Failed to track revenue: ${error}`);
    }
  }

  static async getAgentRevenue(agentId: string, periodStart?: string, periodEnd?: string) {
    try {
      let query = supabase
        .from('agent_revenue_tracking')
        .select(`
          *,
          deployment_contexts(name, type, configuration),
          revenue_attributions(attribution_weight, attribution_model)
        `)
        .eq('agent_id', agentId);

      if (periodStart) query = query.gte('tracked_at', periodStart);
      if (periodEnd) query = query.lte('tracked_at', periodEnd);

      const { data, error } = await query.order('tracked_at', { ascending: false });

      if (error) throw error;

      // Calculate aggregate metrics
      const metrics = this.calculateRevenueMetrics(data);

      return { events: data, metrics };
    } catch (error) {
      throw new Error(`Failed to retrieve agent revenue: ${error}`);
    }
  }

  private static async updateDeploymentMetrics(deploymentId: string, revenue: number) {
    const { error } = await supabase.rpc('update_deployment_revenue_metrics', {
      deployment_id: deploymentId,
      additional_revenue: revenue
    });

    if (error) throw error;
  }

  private static async processAttributionWeights(revenueEventId: number, weights: Record<string, number>) {
    const attributions = Object.entries(weights).map(([agentId, weight]) => ({
      revenue_event_id: revenueEventId,
      attributed_agent_id: agentId,
      attribution_weight: weight,
      attribution_model: 'custom'
    }));

    const { error } = await supabase
      .from('revenue_attributions')
      .insert(attributions);

    if (error) throw error;
  }

  private static calculateRevenueMetrics(events: any[]) {
    return {
      totalRevenue: events.reduce((sum, event) => sum + event.revenue_amount, 0),
      eventCount: events.length,
      averageRevenue: events.length > 0 ? events.reduce((sum, event) => sum + event.revenue_amount, 0) / events.length : 0,
      currencyBreakdown: events.reduce((acc, event) => {
        acc[event.currency] = (acc[event.currency] || 0) + event.revenue_amount;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

class AttributionModelEngine {
  static async calculateAttribution(data: z.infer<typeof AttributionCalculationSchema>) {
    try {
      // Get transaction timeline
      const timeline = await this.getTransactionTimeline(data.transactionId);
      
      let attributions: Record<string, number> = {};

      switch (data.attributionModel) {
        case 'linear':
          attributions = this.calculateLinearAttribution(data.involvedAgents);
          break;
        case 'first_touch':
          attributions = this.calculateFirstTouchAttribution(timeline);
          break;
        case 'last_touch':
          attributions = this.calculateLastTouchAttribution(timeline);
          break;
        case 'time_decay':
          attributions = this.calculateTimeDecayAttribution(timeline);
          break;
        case 'position_based':
          attributions = this.calculatePositionBasedAttribution(timeline);
          break;
      }

      // Apply custom weights if provided
      if (data.customWeights) {
        attributions = this.applyCustomWeights(attributions, data.customWeights);
      }

      // Store attribution results
      await this.storeAttributionResults(data.transactionId, attributions, data.attributionModel);

      return { attributions, model: data.attributionModel };
    } catch (error) {
      throw new Error(`Failed to calculate attribution: ${error}`);
    }
  }

  private static async getTransactionTimeline(transactionId: string) {
    const { data, error } = await supabase
      .from('agent_interactions')
      .select('agent_id, interaction_type, timestamp')
      .eq('transaction_id', transactionId)
      .order('timestamp');

    if (error) throw error;
    return data || [];
  }

  private static calculateLinearAttribution(agentIds: string[]): Record<string, number> {
    const weight = 1 / agentIds.length;
    return agentIds.reduce((acc, id) => ({ ...acc, [id]: weight }), {});
  }

  private static calculateFirstTouchAttribution(timeline: any[]): Record<string, number> {
    if (timeline.length === 0) return {};
    return { [timeline[0].agent_id]: 1.0 };
  }

  private static calculateLastTouchAttribution(timeline: any[]): Record<string, number> {
    if (timeline.length === 0) return {};
    return { [timeline[timeline.length - 1].agent_id]: 1.0 };
  }

  private static calculateTimeDecayAttribution(timeline: any[]): Record<string, number> {
    if (timeline.length === 0) return {};

    const now = new Date().getTime();
    const decayRate = 0.5; // Half-life factor

    const weights = timeline.map(event => {
      const timeDiff = (now - new Date(event.timestamp).getTime()) / (1000 * 60 * 60 * 24); // days
      return Math.pow(decayRate, timeDiff);
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return timeline.reduce((acc, event, index) => {
      const normalizedWeight = weights[index] / totalWeight;
      acc[event.agent_id] = (acc[event.agent_id] || 0) + normalizedWeight;
      return acc;
    }, {} as Record<string, number>);
  }

  private static calculatePositionBasedAttribution(timeline: any[]): Record<string, number> {
    if (timeline.length === 0) return {};
    if (timeline.length === 1) return { [timeline[0].agent_id]: 1.0 };

    const firstTouch = timeline[0].agent_id;
    const lastTouch = timeline[timeline.length - 1].agent_id;
    const middleTouches = timeline.slice(1, -1);

    const attributions: Record<string, number> = {};
    
    // 40% first touch, 40% last touch, 20% split among middle touches
    attributions[firstTouch] = (attributions[firstTouch] || 0) + 0.4;
    attributions[lastTouch] = (attributions[lastTouch] || 0) + 0.4;

    if (middleTouches.length > 0) {
      const middleWeight = 0.2 / middleTouches.length;
      middleTouches.forEach(event => {
        attributions[event.agent_id] = (attributions[event.agent_id] || 0) + middleWeight;
      });
    }

    return attributions;
  }

  private static applyCustomWeights(attributions: Record<string, number>, customWeights: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    const totalCustomWeight = Object.values(customWeights).reduce((sum, weight) => sum + weight, 0);

    Object.keys(attributions).forEach(agentId => {
      const customWeight = customWeights[agentId] || 0;
      result[agentId] = (customWeight / totalCustomWeight) || 0;
    });

    return result;
  }

  private static async storeAttributionResults(transactionId: string, attributions: Record<string, number>, model: string) {
    const attributionRecords = Object.entries(attributions).map(([agentId, weight]) => ({
      transaction_id: transactionId,
      attributed_agent_id: agentId,
      attribution_weight: weight,
      attribution_model: model,
      calculated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('revenue_attributions')
      .upsert(attributionRecords, { onConflict: 'transaction_id,attributed_agent_id' });

    if (error) throw error;
  }
}

class RevenueSharingCalculator {
  static async calculateSharing(agentId: string, periodStart: string, periodEnd: string) {
    try {
      // Get revenue events with attributions
      const { data: revenueData, error } = await supabase
        .from('agent_revenue_tracking')
        .select(`
          *,
          revenue_attributions(attribution_weight, attribution_model),
          marketplace_agents(revenue_share_percentage, tier)
        `)
        .eq('agent_id', agentId)
        .gte('tracked_at', periodStart)
        .lte('tracked_at', periodEnd);

      if (error) throw error;

      const sharing = this.processRevenueSharingCalculation(revenueData);
      
      // Store sharing calculation
      await this.storeRevenueSharingRecord(agentId, periodStart, periodEnd, sharing);

      return sharing;
    } catch (error) {
      throw new Error(`Failed to calculate revenue sharing: ${error}`);
    }
  }

  private static processRevenueSharingCalculation(revenueData: any[]) {
    let totalAttributedRevenue = 0;
    let platformFee = 0;
    let agentShare = 0;

    revenueData.forEach(event => {
      const attributionWeight = event.revenue_attributions?.[0]?.attribution_weight || 1.0;
      const attributedRevenue = event.revenue_amount * attributionWeight;
      const sharePercentage = event.marketplace_agents.revenue_share_percentage || 0.7;
      
      totalAttributedRevenue += attributedRevenue;
      agentShare += attributedRevenue * sharePercentage;
      platformFee += attributedRevenue * (1 - sharePercentage);
    });

    return {
      totalAttributedRevenue,
      agentShare,
      platformFee,
      sharePercentage: agentShare / totalAttributedRevenue,
      eventCount: revenueData.length
    };
  }

  private static async storeRevenueSharingRecord(agentId: string, periodStart: string, periodEnd: string, sharing: any) {
    const { error } = await supabase
      .from('revenue_shares')
      .insert({
        agent_id: agentId,
        period_start: periodStart,
        period_end: periodEnd,
        total_attributed_revenue: sharing.totalAttributedRevenue,
        agent_share: sharing.agentShare,
        platform_fee: sharing.platformFee,
        share_percentage: sharing.sharePercentage,
        calculated_at: new Date().toISOString()
      });

    if (error) throw error;
  }
}

class PayoutScheduler {
  static async initiatePayout(data: z.infer<typeof PayoutInitiationSchema>) {
    try {
      const agentIds = data.agentIds || await this.getAllEligibleAgents();
      const payouts = [];

      for (const agentId of agentIds) {
        const sharing = await RevenueSharingCalculator.calculateSharing(
          agentId,
          data.periodStart,
          data.periodEnd
        );

        if (sharing.agentShare >= (data.minimumPayout || 10)) {
          const payout = await this.createPayoutRecord(agentId, sharing, data);
          payouts.push(payout);
        }
      }

      return { payouts, totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0) };
    } catch (error) {
      throw new Error(`Failed to initiate payout: ${error}`);
    }
  }

  private static async getAllEligibleAgents(): Promise<string[]> {
    const { data, error } = await supabase
      .from('marketplace_agents')
      .select('id')
      .eq('payout_enabled', true);

    if (error) throw error;
    return data.map(agent => agent.id);
  }

  private static async createPayoutRecord(agentId: string, sharing: any, payoutData: any) {
    const { data, error } = await supabase
      .from('payout_schedules')
      .insert({
        agent_id: agentId,
        period_start: payoutData.periodStart,
        period_end: payoutData.periodEnd,
        amount: sharing.agentShare,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'track':
        const trackingData = RevenueTrackingSchema.parse(await request.json());
        const revenueEvent = await RevenueAttributionService.trackRevenue(trackingData);
        return NextResponse.json({ success: true, data: revenueEvent });

      case 'attribution':
        const attributionData = AttributionCalculationSchema.parse(await request.json());
        const attribution = await AttributionModelEngine.calculateAttribution(attributionData);
        return NextResponse.json({ success: true, data: attribution });

      case 'payout':
        const payoutData = PayoutInitiationSchema.parse(await request.json());
        const payouts = await PayoutScheduler.initiatePayout(payoutData);
        return NextResponse.json({ success: true, data: payouts });

      default:
        return NextResponse.json(
          { error: 'Invalid endpoint' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Revenue API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const action = url.searchParams.get('action');
    const periodStart = url.searchParams.get('periodStart');
    const periodEnd = url.searchParams.get('periodEnd');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'revenue':
        const revenueData = await RevenueAttributionService.getAgentRevenue(
          agentId,
          periodStart || undefined,
          periodEnd || undefined
        );
        return NextResponse.json({ success: true, data: revenueData });

      case 'sharing':
        if (!periodStart || !periodEnd) {
          return NextResponse.json(
            { error: 'Period start and end are required for sharing calculations' },
            { status: 400 }
          );
        }
        const sharingData = await RevenueSharingCalculator.calculateSharing(
          agentId,
          periodStart,
          periodEnd
        );
        return NextResponse.json({ success: true, data: sharingData });

      case 'analytics':
        // Comprehensive analytics dashboard data
        const [revenue, sharing] = await Promise.all([
          RevenueAttributionService.getAgentRevenue(agentId, periodStart || undefined, periodEnd || undefined),
          periodStart && periodEnd 
            ? RevenueSharingCalculator.calculateSharing(agentId, periodStart, periodEnd)
            : null
        ]);

        return NextResponse.json({
          success: true,
          data: {
            revenue,
            sharing,
            period: { start: periodStart, end: periodEnd }
          }
        });

      default:
        const defaultRevenue = await RevenueAttributionService.getAgentRevenue(
          agentId,
          periodStart || undefined,
          periodEnd || undefined
        );
        return NextResponse.json({ success: true, data: defaultRevenue });
    }
  } catch (error) {
    console.error('Revenue API GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```