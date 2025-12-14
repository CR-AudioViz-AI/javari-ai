// =============================================================================
// JAVARI AI - ERROR PATTERN DETECTOR API
// =============================================================================
// Captures errors, identifies patterns, suggests fixes for self-healing
// Endpoints:
//   POST /api/errors/capture - Log an error
//   GET  /api/errors/patterns - Get detected patterns with fix suggestions
// Created: Saturday, December 13, 2025 - 6:22 PM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ErrorCapture {
  error_type: string;
  error_message: string;
  error_code?: string;
  stack_trace?: string;
  context?: {
    endpoint?: string;
    user_id?: string;
    session_id?: string;
    request_id?: string;
    metadata?: Record<string, unknown>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ErrorPattern {
  pattern_id: string;
  error_type: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  frequency_per_hour: number;
  suggested_fixes: SuggestedFix[];
  auto_heal_available: boolean;
  status: 'active' | 'resolved' | 'ignored';
}

interface SuggestedFix {
  fix_id: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  auto_applicable: boolean;
  fix_type: 'code' | 'config' | 'infrastructure' | 'manual';
  steps?: string[];
  code_snippet?: string;
}

// -----------------------------------------------------------------------------
// Known Error Patterns & Fixes Database
// -----------------------------------------------------------------------------

const KNOWN_PATTERNS: Record<string, {
  matcher: (error: ErrorCapture) => boolean;
  fixes: Omit<SuggestedFix, 'fix_id'>[];
}> = {
  // Supabase Connection Errors
  'supabase_connection': {
    matcher: (e) => 
      e.error_message.toLowerCase().includes('supabase') ||
      e.error_message.toLowerCase().includes('postgrest') ||
      e.error_code === 'PGRST' ||
      e.error_message.includes('Failed to fetch'),
    fixes: [
      {
        title: 'Check Supabase Environment Variables',
        description: 'Verify NEXT_PUBLIC_SUPABASE_URL and keys are set correctly',
        confidence: 85,
        auto_applicable: false,
        fix_type: 'config',
        steps: [
          'Check .env.local for NEXT_PUBLIC_SUPABASE_URL',
          'Verify SUPABASE_SERVICE_ROLE_KEY is set in Vercel',
          'Ensure keys match your Supabase project settings'
        ]
      },
      {
        title: 'Supabase Service May Be Down',
        description: 'Check Supabase status page for outages',
        confidence: 40,
        auto_applicable: false,
        fix_type: 'infrastructure',
        steps: [
          'Visit status.supabase.com',
          'Check your project dashboard for alerts'
        ]
      }
    ]
  },
  
  // Rate Limiting
  'rate_limit': {
    matcher: (e) => 
      e.error_code === '429' ||
      e.error_message.toLowerCase().includes('rate limit') ||
      e.error_message.toLowerCase().includes('too many requests'),
    fixes: [
      {
        title: 'Implement Request Throttling',
        description: 'Add client-side rate limiting to reduce API calls',
        confidence: 90,
        auto_applicable: true,
        fix_type: 'code',
        code_snippet: `
// Add to your API client
const rateLimiter = {
  requests: [],
  limit: 10,
  window: 60000, // 1 minute
  
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.window);
    return this.requests.length < this.limit;
  },
  
  recordRequest() {
    this.requests.push(Date.now());
  }
};`
      },
      {
        title: 'Upgrade API Plan',
        description: 'Consider upgrading to a higher rate limit tier',
        confidence: 60,
        auto_applicable: false,
        fix_type: 'infrastructure'
      }
    ]
  },
  
  // Authentication Errors
  'auth_error': {
    matcher: (e) => 
      e.error_code === '401' ||
      e.error_code === '403' ||
      e.error_message.toLowerCase().includes('unauthorized') ||
      e.error_message.toLowerCase().includes('forbidden') ||
      e.error_message.toLowerCase().includes('jwt'),
    fixes: [
      {
        title: 'Refresh Authentication Token',
        description: 'Session may have expired, trigger token refresh',
        confidence: 80,
        auto_applicable: true,
        fix_type: 'code',
        code_snippet: `
// Auto-refresh on 401
if (response.status === 401) {
  await supabase.auth.refreshSession();
  // Retry original request
}`
      },
      {
        title: 'Check RLS Policies',
        description: 'Row Level Security might be blocking access',
        confidence: 70,
        auto_applicable: false,
        fix_type: 'config',
        steps: [
          'Review RLS policies in Supabase dashboard',
          'Ensure user has correct role/permissions',
          'Check if auth.uid() matches expected user'
        ]
      }
    ]
  },
  
  // API Timeout
  'timeout': {
    matcher: (e) => 
      e.error_message.toLowerCase().includes('timeout') ||
      e.error_message.toLowerCase().includes('timed out') ||
      e.error_code === 'ETIMEDOUT',
    fixes: [
      {
        title: 'Increase Timeout Duration',
        description: 'Extend API timeout for slow operations',
        confidence: 75,
        auto_applicable: true,
        fix_type: 'config',
        code_snippet: `
// Increase fetch timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s

fetch(url, { signal: controller.signal })
  .finally(() => clearTimeout(timeoutId));`
      },
      {
        title: 'Optimize Database Query',
        description: 'Slow queries may be causing timeouts',
        confidence: 65,
        auto_applicable: false,
        fix_type: 'code',
        steps: [
          'Add database indexes for frequently queried columns',
          'Limit result set size with pagination',
          'Use select() to only fetch needed columns'
        ]
      }
    ]
  },
  
  // TypeScript/Build Errors
  'typescript_error': {
    matcher: (e) => 
      e.error_type === 'TypeError' ||
      e.error_message.includes('is not a function') ||
      e.error_message.includes('Cannot read properties of') ||
      e.error_message.includes('undefined is not'),
    fixes: [
      {
        title: 'Add Null Check',
        description: 'Variable may be null/undefined when accessed',
        confidence: 85,
        auto_applicable: true,
        fix_type: 'code',
        code_snippet: `
// Use optional chaining
const value = obj?.property?.nested;

// Or nullish coalescing
const result = value ?? 'default';`
      },
      {
        title: 'Verify API Response Shape',
        description: 'API may return unexpected data structure',
        confidence: 70,
        auto_applicable: false,
        fix_type: 'code',
        steps: [
          'Log the full API response',
          'Check if response matches TypeScript types',
          'Add runtime validation with zod or similar'
        ]
      }
    ]
  },
  
  // Network Errors
  'network_error': {
    matcher: (e) => 
      e.error_message.toLowerCase().includes('network') ||
      e.error_message.toLowerCase().includes('fetch failed') ||
      e.error_code === 'ECONNREFUSED' ||
      e.error_code === 'ENOTFOUND',
    fixes: [
      {
        title: 'Add Retry Logic',
        description: 'Implement exponential backoff for transient failures',
        confidence: 90,
        auto_applicable: true,
        fix_type: 'code',
        code_snippet: `
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}`
      },
      {
        title: 'Check DNS/Connectivity',
        description: 'Verify the target service is reachable',
        confidence: 60,
        auto_applicable: false,
        fix_type: 'infrastructure'
      }
    ]
  },
  
  // OpenAI/AI Provider Errors
  'ai_provider_error': {
    matcher: (e) => 
      e.error_message.toLowerCase().includes('openai') ||
      e.error_message.toLowerCase().includes('anthropic') ||
      e.error_message.toLowerCase().includes('model') ||
      e.error_code?.startsWith('insufficient_quota'),
    fixes: [
      {
        title: 'Switch to Fallback AI Provider',
        description: 'Route to alternative AI provider',
        confidence: 95,
        auto_applicable: true,
        fix_type: 'code',
        code_snippet: `
// AI provider fallback chain
const providers = ['openai', 'anthropic', 'google'];
for (const provider of providers) {
  try {
    return await callAI(provider, prompt);
  } catch (err) {
    console.log(\`Provider \${provider} failed, trying next...\`);
  }
}
throw new Error('All AI providers failed');`
      },
      {
        title: 'Check API Key & Quota',
        description: 'Verify API key is valid and has remaining quota',
        confidence: 80,
        auto_applicable: false,
        fix_type: 'config'
      }
    ]
  }
};

// -----------------------------------------------------------------------------
// Helper: Get Supabase Client
// -----------------------------------------------------------------------------

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) return null;
  return createClient(url, key);
}

// -----------------------------------------------------------------------------
// Helper: Detect Pattern for Error
// -----------------------------------------------------------------------------

function detectPattern(error: ErrorCapture): { 
  pattern_key: string; 
  fixes: SuggestedFix[] 
} | null {
  for (const [key, pattern] of Object.entries(KNOWN_PATTERNS)) {
    if (pattern.matcher(error)) {
      return {
        pattern_key: key,
        fixes: pattern.fixes.map((fix, idx) => ({
          ...fix,
          fix_id: `${key}_fix_${idx}`
        }))
      };
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Helper: Generate Pattern ID
// -----------------------------------------------------------------------------

function generatePatternId(errorType: string, errorMessage: string): string {
  // Create a consistent hash from error type and message prefix
  const prefix = errorMessage.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
  return `${errorType}_${prefix}`.toLowerCase().substring(0, 64);
}

// -----------------------------------------------------------------------------
// POST Handler - Capture Error
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json() as ErrorCapture;
    
    // Validate required fields
    if (!body.error_type || !body.error_message) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: error_type, error_message'
      }, { status: 400 });
    }
    
    // Detect pattern and get fix suggestions
    const detected = detectPattern(body);
    const patternId = generatePatternId(body.error_type, body.error_message);
    
    // Prepare response
    const response: {
      success: boolean;
      error_id: string;
      pattern_detected: boolean;
      pattern_key?: string;
      suggested_fixes?: SuggestedFix[];
      auto_heal_available: boolean;
      stored: boolean;
    } = {
      success: true,
      error_id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern_detected: !!detected,
      pattern_key: detected?.pattern_key,
      suggested_fixes: detected?.fixes,
      auto_heal_available: detected?.fixes.some(f => f.auto_applicable) ?? false,
      stored: false
    };
    
    // Try to store in database
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Store the error
        const { error: insertError } = await supabase
          .from('error_logs')
          .insert({
            id: response.error_id,
            error_type: body.error_type,
            error_message: body.error_message,
            error_code: body.error_code,
            stack_trace: body.stack_trace,
            context: body.context,
            severity: body.severity || 'medium',
            pattern_id: patternId,
            pattern_key: detected?.pattern_key,
            suggested_fixes: detected?.fixes,
            created_at: new Date().toISOString()
          });
        
        if (!insertError) {
          response.stored = true;
          
          // Update pattern statistics
          await supabase.rpc('increment_error_pattern', {
            p_pattern_id: patternId,
            p_error_type: body.error_type,
            p_pattern_key: detected?.pattern_key || 'unknown'
          }).catch(() => {
            // Pattern tracking is optional, don't fail if RPC doesn't exist
          });
        }
      } catch {
        // Storage failed but we still return the pattern detection
      }
    }
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Pattern-Detected': String(response.pattern_detected)
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture error'
    }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// GET Handler - Get Error Patterns
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const includeResolved = searchParams.get('include_resolved') === 'true';
    
    const supabase = getSupabase();
    
    // If no database, return known patterns
    if (!supabase) {
      const patterns: ErrorPattern[] = Object.entries(KNOWN_PATTERNS).map(([key, pattern]) => ({
        pattern_id: key,
        error_type: key,
        occurrence_count: 0,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        frequency_per_hour: 0,
        suggested_fixes: pattern.fixes.map((fix, idx) => ({
          ...fix,
          fix_id: `${key}_fix_${idx}`
        })),
        auto_heal_available: pattern.fixes.some(f => f.auto_applicable),
        status: 'active' as const
      }));
      
      return NextResponse.json({
        patterns,
        total: patterns.length,
        source: 'static',
        message: 'Database not configured - showing known patterns only'
      });
    }
    
    // Query error patterns from database
    let query = supabase
      .from('error_patterns')
      .select('*')
      .order('occurrence_count', { ascending: false })
      .limit(limit);
    
    if (!includeResolved) {
      query = query.neq('status', 'resolved');
    }
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data: patterns, error } = await query;
    
    if (error) {
      // Table might not exist - return known patterns
      const staticPatterns: ErrorPattern[] = Object.entries(KNOWN_PATTERNS).map(([key, pattern]) => ({
        pattern_id: key,
        error_type: key,
        occurrence_count: 0,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        frequency_per_hour: 0,
        suggested_fixes: pattern.fixes.map((fix, idx) => ({
          ...fix,
          fix_id: `${key}_fix_${idx}`
        })),
        auto_heal_available: pattern.fixes.some(f => f.auto_applicable),
        status: 'active' as const
      }));
      
      return NextResponse.json({
        patterns: staticPatterns,
        total: staticPatterns.length,
        source: 'static',
        database_error: error.message
      });
    }
    
    // Enrich patterns with fix suggestions
    const enrichedPatterns = (patterns || []).map(p => {
      const knownPattern = KNOWN_PATTERNS[p.pattern_key];
      return {
        ...p,
        suggested_fixes: knownPattern?.fixes.map((fix, idx) => ({
          ...fix,
          fix_id: `${p.pattern_key}_fix_${idx}`
        })) || p.suggested_fixes || [],
        auto_heal_available: knownPattern?.fixes.some(f => f.auto_applicable) ?? false
      };
    });
    
    return NextResponse.json({
      patterns: enrichedPatterns,
      total: enrichedPatterns.length,
      source: 'database',
      filters: { status, limit, include_resolved: includeResolved }
    }, {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch patterns'
    }, { status: 500 });
  }
}
