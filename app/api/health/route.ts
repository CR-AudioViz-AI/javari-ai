// =============================================================================
// JAVARI AI - HEALTH CHECK API
// =============================================================================
// Simple but essential: Can't self-heal without knowing what's broken
// Endpoint: GET /api/health
// Created: Saturday, December 13, 2025 - 6:18 PM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ServiceCheck;
    api: ServiceCheck;
    environment: ServiceCheck;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface ServiceCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  latency_ms: number;
  message: string;
  details?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Track server start time for uptime calculation
// -----------------------------------------------------------------------------

const SERVER_START = Date.now();

// -----------------------------------------------------------------------------
// Health Check Functions
// -----------------------------------------------------------------------------

async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  const name = 'Supabase Database';
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        name,
        status: 'fail',
        latency_ms: Date.now() - start,
        message: 'Missing Supabase credentials',
        details: {
          has_url: !!supabaseUrl,
          has_key: !!supabaseKey
        }
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Simple query to verify connection
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .limit(1);
    
    const latency = Date.now() - start;
    
    if (error) {
      // Table might not exist yet - check if it's a missing table error
      if (error.code === '42P01') {
        return {
          name,
          status: 'warn',
          latency_ms: latency,
          message: 'Database connected but conversations table missing',
          details: { error_code: error.code }
        };
      }
      
      return {
        name,
        status: 'fail',
        latency_ms: latency,
        message: `Database error: ${error.message}`,
        details: { error_code: error.code }
      };
    }
    
    return {
      name,
      status: 'pass',
      latency_ms: latency,
      message: `Connected successfully (${latency}ms)`,
      details: { records_checked: data?.length ?? 0 }
    };
    
  } catch (err) {
    return {
      name,
      status: 'fail',
      latency_ms: Date.now() - start,
      message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
}

async function checkAPI(): Promise<ServiceCheck> {
  const start = Date.now();
  const name = 'API Runtime';
  
  try {
    // Check critical environment variables for AI providers
    const providers = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      google: !!process.env.GOOGLE_API_KEY,
    };
    
    const activeProviders = Object.entries(providers)
      .filter(([, has]) => has)
      .map(([name]) => name);
    
    const latency = Date.now() - start;
    
    if (activeProviders.length === 0) {
      return {
        name,
        status: 'fail',
        latency_ms: latency,
        message: 'No AI providers configured',
        details: { providers }
      };
    }
    
    if (activeProviders.length < 2) {
      return {
        name,
        status: 'warn',
        latency_ms: latency,
        message: `Only ${activeProviders.length} AI provider configured (recommend 2+ for fallback)`,
        details: { active_providers: activeProviders, providers }
      };
    }
    
    return {
      name,
      status: 'pass',
      latency_ms: latency,
      message: `${activeProviders.length} AI providers ready`,
      details: { active_providers: activeProviders }
    };
    
  } catch (err) {
    return {
      name,
      status: 'fail',
      latency_ms: Date.now() - start,
      message: `Check failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
}

function checkEnvironment(): ServiceCheck {
  const start = Date.now();
  const name = 'Environment';
  
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  
  const recommended = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
  ];
  
  const missing_required = required.filter(key => !process.env[key]);
  const missing_recommended = recommended.filter(key => !process.env[key]);
  
  const latency = Date.now() - start;
  
  if (missing_required.length > 0) {
    return {
      name,
      status: 'fail',
      latency_ms: latency,
      message: `Missing required: ${missing_required.join(', ')}`,
      details: { missing_required, missing_recommended }
    };
  }
  
  if (missing_recommended.length > 2) {
    return {
      name,
      status: 'warn',
      latency_ms: latency,
      message: `Missing ${missing_recommended.length} recommended env vars`,
      details: { missing_recommended }
    };
  }
  
  return {
    name,
    status: 'pass',
    latency_ms: latency,
    message: 'All required environment variables set',
    details: {
      required_set: required.length,
      recommended_set: recommended.length - missing_recommended.length
    }
  };
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Run all checks in parallel
    const [database, api, environment] = await Promise.all([
      checkDatabase(),
      checkAPI(),
      Promise.resolve(checkEnvironment())
    ]);
    
    const checks = { database, api, environment };
    
    // Calculate summary
    const allChecks = Object.values(checks);
    const summary = {
      total: allChecks.length,
      passed: allChecks.filter(c => c.status === 'pass').length,
      failed: allChecks.filter(c => c.status === 'fail').length,
      warnings: allChecks.filter(c => c.status === 'warn').length,
    };
    
    // Determine overall status
    let status: HealthStatus['status'] = 'healthy';
    if (summary.failed > 0) {
      status = 'unhealthy';
    } else if (summary.warnings > 0) {
      status = 'degraded';
    }
    
    const response: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - SERVER_START) / 1000),
      checks,
      summary
    };
    
    // Return appropriate HTTP status
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': status,
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor((Date.now() - SERVER_START) / 1000),
      error: error instanceof Error ? error.message : 'Health check failed',
      checks: {},
      summary: { total: 0, passed: 0, failed: 1, warnings: 0 }
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}

// Also support HEAD requests for simple uptime checks
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Health-Status': 'ok',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
