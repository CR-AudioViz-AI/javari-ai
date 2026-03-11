```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const attributionQuerySchema = z.object({
  creatorId: z.string().uuid(),
  timeframe: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  model: z.enum(['first-touch', 'last-touch', 'linear', 'time-decay', 'position-based']).default('linear'),
  includeCollaborations: z.boolean().default(true),
  includeReferrals: z.boolean().default(true)
});

const trackTouchpointSchema = z.object({
  creatorId: z.string().uuid(),
  touchpointType: z.enum(['direct_sale', 'referral', 'collaboration', 'content_view', 'social_share']),
  revenue: z.number().min(0),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional()
});

const updateAttributionModelSchema = z.object({
  creatorId: z.string().uuid(),
  model: z.enum(['first-touch', 'last-touch', 'linear', 'time-decay', 'position-based']),
  weights: z.object({
    directSales: z.number().min(0).max(1),
    referrals: z.number().min(0).max(1),
    collaborations: z.number().min(0).max(1),
    contentEngagement: z.number().min(0).max(1)
  }).optional(),
  decayRate: z.number().min(0).max(1).optional(),
  lookbackWindow: z.number().min(1).max(365).optional()
});

interface TouchpointData {
  id: string;
  creator_id: string;
  touchpoint_type: string;
  revenue: number;
  customer_id?: string;
  project_id?: string;
  metadata?: any;
  created_at: string;
}

interface AttributionResult {
  totalRevenue: number;
  attributedRevenue: number;
  touchpointBreakdown: {
    directSales: number;
    referrals: number;
    collaborations: number;
    contentEngagement: number;
  };
  topPerformingTouchpoints: TouchpointData[];
  collaborationMetrics?: {
    totalProjects: number;
    averageContribution: number;
    topCollaborators: Array<{
      collaboratorId: string;
      collaboratorName: string;
      sharedRevenue: number;
    }>;
  };
  referralMetrics?: {
    totalReferrals: number;
    conversionRate: number;
    averageReferralValue: number;
  };
}

class PerformanceAttributionService {
  private async getTimeframeFilter(timeframe: string): Promise<Date> {
    const now = new Date();
    switch (timeframe) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  async getPerformanceAttribution(params: z.infer<typeof attributionQuerySchema>): Promise<AttributionResult> {
    const { creatorId, timeframe, model, includeCollaborations, includeReferrals } = params;
    const fromDate = await this.getTimeframeFilter(timeframe);

    // Get touchpoints data
    const { data: touchpoints, error: touchpointsError } = await supabase
      .from('creator_touchpoints')
      .select(`
        *,
        customer:customers(id, email),
        project:collaboration_projects(id, title, collaborators)
      `)
      .eq('creator_id', creatorId)
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: false });

    if (touchpointsError) {
      throw new Error(`Failed to fetch touchpoints: ${touchpointsError.message}`);
    }

    // Calculate attribution using RPC
    const { data: attributionData, error: attributionError } = await supabase
      .rpc('calculate_attribution_weights', {
        creator_id: creatorId,
        attribution_model: model,
        from_date: fromDate.toISOString(),
        include_collaborations: includeCollaborations,
        include_referrals: includeReferrals
      });

    if (attributionError) {
      throw new Error(`Failed to calculate attribution: ${attributionError.message}`);
    }

    // Get collaboration metrics if requested
    let collaborationMetrics;
    if (includeCollaborations) {
      collaborationMetrics = await this.getCollaborationMetrics(creatorId, fromDate);
    }

    // Get referral metrics if requested
    let referralMetrics;
    if (includeReferrals) {
      referralMetrics = await this.getReferralMetrics(creatorId, fromDate);
    }

    // Process touchpoint breakdown
    const touchpointBreakdown = this.calculateTouchpointBreakdown(touchpoints || []);
    const topPerformingTouchpoints = (touchpoints || [])
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue: attributionData?.total_revenue || 0,
      attributedRevenue: attributionData?.attributed_revenue || 0,
      touchpointBreakdown,
      topPerformingTouchpoints,
      collaborationMetrics,
      referralMetrics
    };
  }

  private calculateTouchpointBreakdown(touchpoints: TouchpointData[]) {
    const breakdown = {
      directSales: 0,
      referrals: 0,
      collaborations: 0,
      contentEngagement: 0
    };

    touchpoints.forEach(tp => {
      switch (tp.touchpoint_type) {
        case 'direct_sale':
          breakdown.directSales += tp.revenue;
          break;
        case 'referral':
          breakdown.referrals += tp.revenue;
          break;
        case 'collaboration':
          breakdown.collaborations += tp.revenue;
          break;
        case 'content_view':
        case 'social_share':
          breakdown.contentEngagement += tp.revenue;
          break;
      }
    });

    return breakdown;
  }

  private async getCollaborationMetrics(creatorId: string, fromDate: Date) {
    const { data: collaborations } = await supabase
      .from('collaboration_projects')
      .select(`
        *,
        revenue_share,
        collaborators:collaboration_participants(
          participant_id,
          participant:creator_profiles(id, display_name)
        )
      `)
      .contains('collaborator_ids', [creatorId])
      .gte('created_at', fromDate.toISOString());

    if (!collaborations) return null;

    const totalProjects = collaborations.length;
    const averageContribution = collaborations.reduce((sum, col) => sum + (col.revenue_share || 0), 0) / totalProjects;
    
    // Get top collaborators
    const collaboratorMap = new Map();
    collaborations.forEach(col => {
      col.collaborators?.forEach((collab: any) => {
        if (collab.participant_id !== creatorId) {
          const existing = collaboratorMap.get(collab.participant_id) || { 
            collaboratorId: collab.participant_id,
            collaboratorName: collab.participant?.display_name || 'Unknown',
            sharedRevenue: 0 
          };
          existing.sharedRevenue += col.revenue_share || 0;
          collaboratorMap.set(collab.participant_id, existing);
        }
      });
    });

    const topCollaborators = Array.from(collaboratorMap.values())
      .sort((a, b) => b.sharedRevenue - a.sharedRevenue)
      .slice(0, 5);

    return {
      totalProjects,
      averageContribution,
      topCollaborators
    };
  }

  private async getReferralMetrics(creatorId: string, fromDate: Date) {
    const { data: referrals } = await supabase
      .from('referral_tracking')
      .select('*')
      .eq('referrer_id', creatorId)
      .gte('created_at', fromDate.toISOString());

    if (!referrals) return null;

    const totalReferrals = referrals.length;
    const convertedReferrals = referrals.filter(ref => ref.converted).length;
    const conversionRate = totalReferrals > 0 ? convertedReferrals / totalReferrals : 0;
    const totalReferralRevenue = referrals.reduce((sum, ref) => sum + (ref.revenue || 0), 0);
    const averageReferralValue = convertedReferrals > 0 ? totalReferralRevenue / convertedReferrals : 0;

    return {
      totalReferrals,
      conversionRate,
      averageReferralValue
    };
  }

  async trackTouchpoint(data: z.infer<typeof trackTouchpointSchema>) {
    const touchpointData = {
      ...data,
      id: crypto.randomUUID(),
      created_at: data.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('creator_touchpoints')
      .insert(touchpointData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to track touchpoint: ${error.message}`);
    }

    // Update attribution calculations asynchronously
    await supabase.rpc('recalculate_creator_attribution', {
      creator_id: data.creatorId
    });

    return result;
  }

  async updateAttributionModel(data: z.infer<typeof updateAttributionModelSchema>) {
    const { data: result, error } = await supabase
      .from('creator_attribution_models')
      .upsert({
        creator_id: data.creatorId,
        model_type: data.model,
        weights: data.weights,
        decay_rate: data.decayRate,
        lookback_window_days: data.lookbackWindow,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update attribution model: ${error.message}`);
    }

    return result;
  }

  async getTouchpoints(creatorId: string) {
    const { data, error } = await supabase
      .from('creator_touchpoints')
      .select(`
        *,
        customer:customers(id, email, name),
        project:collaboration_projects(id, title)
      `)
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch touchpoints: ${error.message}`);
    }

    return data;
  }

  async deleteTouchpoint(touchpointId: string, creatorId: string) {
    const { error } = await supabase
      .from('creator_touchpoints')
      .delete()
      .eq('id', touchpointId)
      .eq('creator_id', creatorId);

    if (error) {
      throw new Error(`Failed to delete touchpoint: ${error.message}`);
    }

    // Recalculate attribution after deletion
    await supabase.rpc('recalculate_creator_attribution', {
      creator_id: creatorId
    });

    return { success: true };
  }

  async getCollaborations(creatorId: string) {
    const { data, error } = await supabase
      .from('collaboration_projects')
      .select(`
        *,
        collaborators:collaboration_participants(
          participant_id,
          share_percentage,
          participant:creator_profiles(id, display_name, avatar_url)
        ),
        touchpoints:creator_touchpoints!project_id(
          id,
          touchpoint_type,
          revenue,
          created_at
        )
      `)
      .contains('collaborator_ids', [creatorId])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch collaborations: ${error.message}`);
    }

    return data;
  }
}

const attributionService = new PerformanceAttributionService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (path === 'touchpoints') {
      const creatorId = searchParams.get('creatorId');
      if (!creatorId) {
        return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 });
      }

      const touchpoints = await attributionService.getTouchpoints(creatorId);
      return NextResponse.json({ touchpoints });
    }

    if (path === 'collaborations') {
      const creatorId = searchParams.get('creatorId');
      if (!creatorId) {
        return NextResponse.json({ error: 'Creator ID is required' }, { status: 400 });
      }

      const collaborations = await attributionService.getCollaborations(creatorId);
      return NextResponse.json({ collaborations });
    }

    // Main attribution query
    const queryParams = {
      creatorId: searchParams.get('creatorId') || '',
      timeframe: searchParams.get('timeframe') || '30d',
      model: searchParams.get('model') || 'linear',
      includeCollaborations: searchParams.get('includeCollaborations') === 'true',
      includeReferrals: searchParams.get('includeReferrals') === 'true'
    };

    const validatedParams = attributionQuerySchema.parse(queryParams);
    const attribution = await attributionService.getPerformanceAttribution(validatedParams);

    return NextResponse.json({
      success: true,
      data: attribution
    });

  } catch (error) {
    console.error('Performance attribution GET error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'track-touchpoint') {
      const body = await request.json();
      const validatedData = trackTouchpointSchema.parse(body);
      const result = await attributionService.trackTouchpoint(validatedData);

      return NextResponse.json({
        success: true,
        data: result
      });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Performance attribution POST error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'attribution-model') {
      const body = await request.json();
      const validatedData = updateAttributionModelSchema.parse(body);
      const result = await attributionService.updateAttributionModel(validatedData);

      return NextResponse.json({
        success: true,
        data: result
      });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Performance attribution PUT error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const touchpointId = searchParams.get('touchpointId');
    const creatorId = searchParams.get('creatorId');

    if (!touchpointId || !creatorId) {
      return NextResponse.json(
        { error: 'Touchpoint ID and Creator ID are required' },
        { status: 400 }
      );
    }

    const result = await attributionService.deleteTouchpoint(touchpointId, creatorId);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Performance attribution DELETE error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```