/**
 * JAVARI AI - ANALYTICS API
 * Usage stats, costs, provider performance, recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Get usage analytics
    const { data: analytics } = await supabase
      .from('javari_usage_analytics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get cost breakdown by provider
    const { data: costsByProvider } = await supabase
      .from('javari_cost_tracking')
      .select('provider, model, cost, credits_used, tokens:total_tokens')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    // Aggregate costs
    const providerSummary: Record<string, any> = {};
    costsByProvider?.forEach(item => {
      if (!providerSummary[item.provider]) {
        providerSummary[item.provider] = {
          provider: item.provider,
          totalCost: 0,
          totalCredits: 0,
          totalTokens: 0,
          requests: 0,
        };
      }
      providerSummary[item.provider].totalCost += item.cost || 0;
      providerSummary[item.provider].totalCredits += item.credits_used || 0;
      providerSummary[item.provider].totalTokens += item.tokens || 0;
      providerSummary[item.provider].requests += 1;
    });

    // Get optimization recommendations
    const { data: recommendations } = await supabase
      .from('javari_optimization_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_applied', false)
      .order('priority', { ascending: false })
      .limit(5);

    // Get provider comparison
    const { data: providerPerformance } = await supabase
      .from('javari_provider_comparison')
      .select('*')
      .limit(10);

    return NextResponse.json({
      analytics,
      providerSummary: Object.values(providerSummary),
      recommendations,
      providerPerformance,
    });

  } catch (error: unknown) {
    logError('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
