// /app/api/cron/warmup/route.ts
// Javari AI - Cold Start Prevention Warmup
// Runs every 3 minutes to keep AI functions warm
// Timestamp: January 1, 2026 - 6:01 PM EST

import { NextRequest, NextResponse } from 'next/server';

// Critical AI endpoints that need to stay warm
const CRITICAL_ENDPOINTS = [
  '/api/health',
  '/api/chat',
  '/api/ai/providers',
  '/api/javari/status',
  '/api/auth/session',
];

// AI-specific endpoints (warmed to prevent model loading delays)
const AI_ENDPOINTS = [
  '/api/ai/route',
  '/api/chat/stream',
  '/api/javari/analyze',
];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface WarmupResult {
  endpoint: string;
  status: number;
  latency: number;
  isCold: boolean;
}

async function warmEndpoint(baseUrl: string, endpoint: string): Promise<WarmupResult> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'X-Warmup-Request': 'true',
        'X-Request-Source': 'javari-warmup',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    return {
      endpoint,
      status: response.status,
      latency,
      isCold: latency > 1500, // AI endpoints over 1.5s likely cold
    };
  } catch (error: any) {
    return {
      endpoint,
      status: 0,
      latency: Date.now() - start,
      isCold: true,
    };
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Get base URL
  const host = request.headers.get('host') || 'javariai.com';
  const baseUrl = `https://${host}`;

  console.log(`[Javari Warmup] Starting at ${new Date().toISOString()}`);

  // Warm all endpoints in parallel
  const allEndpoints = [...CRITICAL_ENDPOINTS, ...AI_ENDPOINTS];
  const results = await Promise.all(
    allEndpoints.map(endpoint => warmEndpoint(baseUrl, endpoint))
  );

  // Statistics
  const successCount = results.filter(r => r.status >= 200 && r.status < 500).length;
  const coldStarts = results.filter(r => r.isCold).length;
  const avgLatency = Math.round(
    results.reduce((sum, r) => sum + r.latency, 0) / results.length
  );

  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    platform: 'Javari AI',
    duration: Date.now() - startTime,
    stats: {
      warmed: successCount,
      total: results.length,
      coldStarts,
      avgLatency,
      maxLatency: Math.max(...results.map(r => r.latency)),
    },
    endpoints: results,
    fluidCompute: true,
  };

  console.log(`[Javari Warmup] Complete: ${successCount}/${results.length}, ${coldStarts} cold starts`);

  return NextResponse.json(response);
}
