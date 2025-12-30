// app/api/affiliates/awin/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// AWIN AFFILIATE NETWORK INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 1:30 PM EST
// Henderson Standard - Deep integration with Awin API
// Publisher ID: 2692370
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Awin Configuration
const AWIN_CONFIG = {
  publisherId: process.env.AWIN_PUBLISHER_ID || '2692370',
  apiToken: process.env.AWIN_API_TOKEN || '',
  baseUrl: 'https://api.awin.com',
  trackingDomain: 'https://www.awin1.com/cread.php'
};

// ═══════════════════════════════════════════════════════════════════════════════
// AWIN LINK BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildAwinLink(params: {
  merchantId: string;
  destinationUrl: string;
  clickRef?: string;
  campaign?: string;
}): string {
  const { merchantId, destinationUrl, clickRef, campaign } = params;
  
  const url = new URL(AWIN_CONFIG.trackingDomain);
  url.searchParams.set('awinmid', merchantId);
  url.searchParams.set('awinaffid', AWIN_CONFIG.publisherId);
  
  if (clickRef) {
    url.searchParams.set('clickref', clickRef);
  }
  if (campaign) {
    url.searchParams.set('clickref2', campaign);
  }
  
  url.searchParams.set('ued', destinationUrl);
  
  return url.toString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// POPULAR AWIN MERCHANTS FOR CR AUDIOVIZ AI
// ═══════════════════════════════════════════════════════════════════════════════

const AWIN_MERCHANTS = {
  // Travel
  'expedia': { id: '10590', category: 'travel', name: 'Expedia' },
  'booking': { id: '4236', category: 'travel', name: 'Booking.com' },
  'hotels': { id: '10569', category: 'travel', name: 'Hotels.com' },
  'vrbo': { id: '62859', category: 'travel', name: 'VRBO' },
  'tripadvisor': { id: '10291', category: 'travel', name: 'TripAdvisor' },
  
  // Wine & Spirits (CravBarrels)
  'wine': { id: '3497', category: 'wine', name: 'Wine.com' },
  'totalwine': { id: '9665', category: 'wine', name: 'Total Wine' },
  'drizly': { id: '22837', category: 'wine', name: 'Drizly' },
  'winc': { id: '14181', category: 'wine', name: 'Winc' },
  'nakedwines': { id: '4707', category: 'wine', name: 'Naked Wines' },
  
  // Home & Real Estate
  'wayfair': { id: '7768', category: 'home', name: 'Wayfair' },
  'overstock': { id: '2031', category: 'home', name: 'Overstock' },
  'homedepot': { id: '7398', category: 'home', name: 'Home Depot' },
  'lowes': { id: '17643', category: 'home', name: 'Lowes' },
  
  // Tech & Software
  'microsoft': { id: '3593', category: 'tech', name: 'Microsoft' },
  'hp': { id: '7168', category: 'tech', name: 'HP' },
  'dell': { id: '4356', category: 'tech', name: 'Dell' },
  'adobe': { id: '8685', category: 'tech', name: 'Adobe' },
  
  // Finance
  'creditkarma': { id: '17405', category: 'finance', name: 'Credit Karma' },
  'nerdwallet': { id: '11413', category: 'finance', name: 'NerdWallet' },
  
  // Entertainment
  'stubhub': { id: '4654', category: 'entertainment', name: 'StubHub' },
  'ticketmaster': { id: '4689', category: 'entertainment', name: 'Ticketmaster' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, merchantKey, destinationUrl, userId, placement } = body;

    switch (action) {
      case 'generate-link': {
        const merchant = AWIN_MERCHANTS[merchantKey as keyof typeof AWIN_MERCHANTS];
        if (!merchant) {
          return NextResponse.json(
            { error: 'Unknown merchant', validMerchants: Object.keys(AWIN_MERCHANTS) },
            { status: 400 }
          );
        }

        // Generate click reference for tracking
        const clickRef = `cr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Build tracking link
        const trackingLink = buildAwinLink({
          merchantId: merchant.id,
          destinationUrl: destinationUrl || `https://www.${merchantKey}.com`,
          clickRef,
          campaign: placement
        });

        // Log to database
        await supabase.from('affiliate_clicks').insert({
          click_id: clickRef,
          program_id: `awin_${merchantKey}`,
          network: 'awin',
          placement,
          user_id: userId,
          metadata: {
            merchantId: merchant.id,
            merchantName: merchant.name,
            category: merchant.category,
            destinationUrl
          },
          created_at: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          clickRef,
          trackingLink,
          merchant: merchant.name,
          category: merchant.category
        });
      }

      case 'batch-links': {
        const { links } = body; // Array of { merchantKey, destinationUrl }
        if (!Array.isArray(links)) {
          return NextResponse.json({ error: 'links array required' }, { status: 400 });
        }

        const results = links.map((link: any) => {
          const merchant = AWIN_MERCHANTS[link.merchantKey as keyof typeof AWIN_MERCHANTS];
          if (!merchant) return { error: `Unknown merchant: ${link.merchantKey}` };

          const clickRef = `cr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          return {
            merchantKey: link.merchantKey,
            merchantName: merchant.name,
            clickRef,
            trackingLink: buildAwinLink({
              merchantId: merchant.id,
              destinationUrl: link.destinationUrl || `https://www.${link.merchantKey}.com`,
              clickRef
            })
          };
        });

        return NextResponse.json({ success: true, links: results });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action', validActions: ['generate-link', 'batch-links'] },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Awin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  // Filter merchants by category if specified
  let merchants = Object.entries(AWIN_MERCHANTS).map(([key, value]) => ({
    key,
    ...value
  }));

  if (category) {
    merchants = merchants.filter(m => m.category === category);
  }

  // Get recent stats
  const { data: recentClicks } = await supabase
    .from('affiliate_clicks')
    .select('program_id')
    .eq('network', 'awin')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const clicksByMerchant: Record<string, number> = {};
  recentClicks?.forEach(click => {
    const key = click.program_id.replace('awin_', '');
    clicksByMerchant[key] = (clicksByMerchant[key] || 0) + 1;
  });

  return NextResponse.json({
    name: 'Awin Affiliate Integration',
    publisherId: AWIN_CONFIG.publisherId,
    merchantCount: Object.keys(AWIN_MERCHANTS).length,
    categories: [...new Set(Object.values(AWIN_MERCHANTS).map(m => m.category))],
    merchants: merchants.map(m => ({
      ...m,
      recentClicks: clicksByMerchant[m.key] || 0
    })),
    usage: {
      generateLink: {
        method: 'POST',
        body: {
          action: 'generate-link',
          merchantKey: 'wine',
          destinationUrl: 'https://wine.com/product/123',
          userId: 'optional',
          placement: 'cravbarrels-homepage'
        }
      },
      batchLinks: {
        method: 'POST',
        body: {
          action: 'batch-links',
          links: [
            { merchantKey: 'wine', destinationUrl: 'https://wine.com' },
            { merchantKey: 'totalwine', destinationUrl: 'https://totalwine.com' }
          ]
        }
      }
    },
    timestamp: new Date().toISOString()
  });
}
