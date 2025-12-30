// app/api/affiliates/track/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// AFFILIATE TRACKING API
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 1:25 PM EST
// Henderson Standard - Complete affiliate click and conversion tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// AFFILIATE NETWORKS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const AFFILIATE_NETWORKS = {
  awin: {
    publisherId: process.env.AWIN_PUBLISHER_ID || '2692370',
    trackingDomain: 'https://www.awin1.com/cread.php',
    conversionApi: 'https://www.awin.com/api'
  },
  viator: {
    partnerId: process.env.VIATOR_PARTNER_ID || 'P00280339',
    trackingDomain: 'https://www.viator.com'
  },
  getyourguide: {
    partnerId: process.env.GETYOURGUIDE_PARTNER_ID || 'VZYKZYE',
    trackingDomain: 'https://www.getyourguide.com'
  },
  klook: {
    affiliateId: process.env.KLOOK_AFFILIATE_ID || '106921',
    trackingDomain: 'https://www.klook.com'
  },
  discovercars: {
    affiliateId: process.env.DISCOVER_CARS_AFFILIATE || 'royhenders',
    trackingDomain: 'https://www.discovercars.com'
  },
  partnerstack: {
    apiKey: process.env.PARTNERSTACK_API_KEY,
    trackingDomain: 'https://api.partnerstack.com'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRACK CLICK
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      programId, 
      network,
      placement, 
      userId, 
      sessionId,
      pageUrl,
      metadata 
    } = body;

    if (!programId) {
      return NextResponse.json(
        { error: 'programId is required' },
        { status: 400 }
      );
    }

    // Generate click ID for attribution
    const clickId = `clk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get IP and user agent for fraud prevention
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log click to database
    const { data: click, error } = await supabase
      .from('affiliate_clicks')
      .insert({
        click_id: clickId,
        program_id: programId,
        network: network || 'direct',
        placement,
        user_id: userId,
        session_id: sessionId,
        page_url: pageUrl,
        ip_address: ip,
        user_agent: userAgent,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to log affiliate click:', error);
      // Don't fail the request, just log
    }

    // Build redirect URL with tracking parameters
    let redirectUrl = '';
    const networkConfig = AFFILIATE_NETWORKS[network as keyof typeof AFFILIATE_NETWORKS];

    switch (network) {
      case 'awin':
        redirectUrl = `${networkConfig?.trackingDomain}?awinmid=${metadata?.merchantId || ''}&awinaffid=${AFFILIATE_NETWORKS.awin.publisherId}&clickref=${clickId}&ued=${encodeURIComponent(metadata?.destinationUrl || '')}`;
        break;
      case 'viator':
        redirectUrl = `${AFFILIATE_NETWORKS.viator.trackingDomain}${metadata?.path || ''}?pid=${AFFILIATE_NETWORKS.viator.partnerId}&mcid=42383&medium=link&campaign=${clickId}`;
        break;
      case 'getyourguide':
        redirectUrl = `${AFFILIATE_NETWORKS.getyourguide.trackingDomain}${metadata?.path || ''}?partner_id=${AFFILIATE_NETWORKS.getyourguide.partnerId}&utm_campaign=${clickId}`;
        break;
      case 'klook':
        redirectUrl = `${AFFILIATE_NETWORKS.klook.trackingDomain}${metadata?.path || ''}?aid=${AFFILIATE_NETWORKS.klook.affiliateId}&label=${clickId}`;
        break;
      default:
        redirectUrl = metadata?.destinationUrl || '';
    }

    return NextResponse.json({
      success: true,
      clickId,
      redirectUrl,
      tracked: !error
    });

  } catch (error) {
    console.error('Affiliate tracking error:', error);
    return NextResponse.json(
      { error: 'Tracking failed' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET STATS
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7d';
  const programId = searchParams.get('program');
  const network = searchParams.get('network');

  // Calculate date range
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  // Build query
  let query = supabase
    .from('affiliate_clicks')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString());

  if (programId) {
    query = query.eq('program_id', programId);
  }
  if (network) {
    query = query.eq('network', network);
  }

  const { data: clicks, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }

  // Get conversions
  const { data: conversions } = await supabase
    .from('affiliate_conversions')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString());

  // Calculate stats
  const clickCount = clicks?.length || 0;
  const conversionCount = conversions?.length || 0;
  const conversionRate = clickCount > 0 ? ((conversionCount / clickCount) * 100).toFixed(2) : '0';
  const totalRevenue = conversions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

  // Group by program
  const byProgram: Record<string, { clicks: number; conversions: number; revenue: number }> = {};
  
  clicks?.forEach(click => {
    if (!byProgram[click.program_id]) {
      byProgram[click.program_id] = { clicks: 0, conversions: 0, revenue: 0 };
    }
    byProgram[click.program_id].clicks++;
  });

  conversions?.forEach(conv => {
    if (!byProgram[conv.program_id]) {
      byProgram[conv.program_id] = { clicks: 0, conversions: 0, revenue: 0 };
    }
    byProgram[conv.program_id].conversions++;
    byProgram[conv.program_id].revenue += conv.commission_amount || 0;
  });

  // Group by placement
  const byPlacement: Record<string, number> = {};
  clicks?.forEach(click => {
    const placement = click.placement || 'unknown';
    byPlacement[placement] = (byPlacement[placement] || 0) + 1;
  });

  return NextResponse.json({
    period,
    dateRange: {
      start: startDate.toISOString(),
      end: now.toISOString()
    },
    summary: {
      totalClicks: clickCount,
      totalConversions: conversionCount,
      conversionRate: `${conversionRate}%`,
      totalRevenue: totalRevenue,
      avgRevenuePerConversion: conversionCount > 0 ? (totalRevenue / conversionCount).toFixed(2) : '0'
    },
    byProgram,
    byPlacement,
    networks: Object.keys(AFFILIATE_NETWORKS),
    timestamp: new Date().toISOString()
  });
}
