// app/api/domains/check/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN AVAILABILITY CHECKER
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: December 23, 2025 - 5:25 PM EST
//
// Checks domain availability and pricing through Vercel Domains API
// Helps customers find and secure the perfect domain for their app
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

interface DomainCheckResult {
  domain: string;
  available: boolean;
  price?: number;
  period?: number;
  error?: string;
}

async function checkDomainAvailability(domain: string): Promise<DomainCheckResult> {
  try {
    const url = new URL('https://api.vercel.com/v5/domains/price');
    url.searchParams.set('name', domain);
    if (VERCEL_TEAM_ID) {
      url.searchParams.set('teamId', VERCEL_TEAM_ID);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        domain,
        available: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      domain,
      available: data.available !== false,
      price: data.price,
      period: data.period || 1,
    };
  } catch (error) {
    return {
      domain,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function generateDomainVariations(appName: string): string[] {
  // Clean the app name
  const clean = appName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50);

  const variations = [
    `${clean}.com`,
    `${clean}.io`,
    `${clean}.app`,
    `${clean}.co`,
    `get${clean}.com`,
    `${clean}app.com`,
    `${clean}hq.com`,
    `try${clean}.com`,
    `use${clean}.com`,
    `my${clean}.com`,
  ];

  return [...new Set(variations)]; // Remove duplicates
}

export async function POST(req: NextRequest) {
  try {
    const { appName, customDomains } = await req.json();

    if (!appName && (!customDomains || customDomains.length === 0)) {
      return NextResponse.json({ 
        error: 'Either appName or customDomains is required' 
      }, { status: 400 });
    }

    // Generate domain variations if appName provided
    const domainsToCheck = customDomains || generateDomainVariations(appName);

    // Check all domains in parallel
    const results = await Promise.all(
      domainsToCheck.slice(0, 10).map(checkDomainAvailability) // Limit to 10
    );

    // Sort by: available first, then by price
    const sorted = results.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      if (a.price && b.price) return a.price - b.price;
      return 0;
    });

    // Format response
    const available = sorted.filter(d => d.available);
    const unavailable = sorted.filter(d => !d.available);

    return NextResponse.json({
      appName,
      checked: domainsToCheck.length,
      available: available.map(d => ({
        domain: d.domain,
        price: d.price ? `$${d.price}/year` : 'Price unavailable',
        priceRaw: d.price,
      })),
      unavailable: unavailable.map(d => d.domain),
      recommendation: available.length > 0 
        ? `Great news! ${available[0].domain} is available for ${available[0].price ? `$${available[0].price}/year` : 'a great price'}!`
        : 'All variations are taken. Try a more unique name or add a prefix like "get" or "try".',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Domains] Error:', error);
    return NextResponse.json({
      error: 'Failed to check domains',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({
      error: 'Domain parameter is required',
      example: '/api/domains/check?domain=myawesomeapp.com',
    }, { status: 400 });
  }

  const result = await checkDomainAvailability(domain);
  
  return NextResponse.json({
    ...result,
    priceFormatted: result.price ? `$${result.price}/year` : null,
    timestamp: new Date().toISOString(),
  });
}
