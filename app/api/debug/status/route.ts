/**
 * DEBUG STATUS ENDPOINT
 * Returns system diagnostic information for troubleshooting
 * Per ChatGPT audit recommendation
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION || 'unknown',
    environment: process.env.NODE_ENV,
  };

  // Check environment variables (names only, not values)
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_APP_URL'
  ];

  const envStatus: Record<string, boolean> = {};
  for (const envVar of requiredEnvVars) {
    envStatus[envVar] = !!process.env[envVar];
  }
  diagnostics.environment_variables = envStatus;

  // Check Supabase connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('profiles').select('count').limit(1);
      
      diagnostics.supabase = {
        connected: !error,
        error: error?.message || null
      };
    } else {
      diagnostics.supabase = {
        connected: false,
        error: 'Missing credentials'
      };
    }
  } catch (err: unknown) {
    diagnostics.supabase = {
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }

  // Check runtime info
  diagnostics.runtime = {
    node_version: process.version,
    platform: process.platform,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };

  // Overall health
  const allEnvPresent = Object.values(envStatus).every(v => v);
  const dbConnected = (diagnostics.supabase as Record<string, unknown>)?.connected === true;
  
  diagnostics.overall_health = allEnvPresent && dbConnected ? 'healthy' : 'degraded';
  diagnostics.issues = [];
  
  if (!allEnvPresent) {
    const missing = Object.entries(envStatus).filter(([, v]) => !v).map(([k]) => k);
    (diagnostics.issues as string[]).push(`Missing env vars: ${missing.join(', ')}`);
  }
  
  if (!dbConnected) {
    (diagnostics.issues as string[]).push('Database connection failed');
  }

  return NextResponse.json(diagnostics);
}
