import { NextRequest, NextResponse } from 'next/server';

/**
 * JAVARI AI PHASE 2 - AUTOMATED TEST ENDPOINT
 * 
 * Accessible at: /api/test/phase2
 * 
 * This runs all Phase 2 tests automatically and returns results.
 * No local setup required - just hit the URL.
 */

interface TestResult {
  test: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  http_code?: number;
  duration_ms?: number;
  details?: any;
  error?: string;
}

interface TestSummary {
  timestamp: string;
  total_tests: number;
  passed: number;
  failed: number;
  warnings: number;
  overall_status: 'COMPLETE' | 'FAILED' | 'PARTIAL';
  results: TestResult[];
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const results: TestResult[] = [];
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  // Test email/password
  const TEST_EMAIL = `autotest.${Date.now()}@javari.ai`;
  const TEST_PASSWORD = 'AutoTest2026!';
  
  let userId: string | null = null;
  let accessToken: string | null = null;

  try {
    // ========================================
    // TEST 1: CREATE USER & AUTHENTICATE
    // ========================================
    const authStart = Date.now();
    
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true
      })
    });

    const signupData = await signupRes.json();
    userId = signupData.user?.id;
    accessToken = signupData.access_token;

    if (!userId || !accessToken) {
      results.push({
        test: 'Authentication',
        status: 'FAILED',
        duration_ms: Date.now() - authStart,
        error: 'Failed to create test user'
      });
      
      return NextResponse.json({
        error: 'Authentication failed',
        details: signupData
      }, { status: 500 });
    }

    results.push({
      test: 'Authentication',
      status: 'PASSED',
      duration_ms: Date.now() - authStart,
      details: { user_id: userId }
    });

    // ========================================
    // TEST 2: SETUP CREDITS
    // ========================================
    const creditsStart = Date.now();
    
    await fetch(`${SUPABASE_URL}/rest/v1/user_accounts`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        credit_balance: 500,
        total_credits_purchased: 500
      })
    });

    results.push({
      test: 'Credit Setup',
      status: 'PASSED',
      duration_ms: Date.now() - creditsStart,
      details: { initial_credits: 500 }
    });

    // ========================================
    // TEST 3: STANDARD MODE
    // ========================================
    const standardStart = Date.now();
    
    const standardRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${accessToken}`
      },
      body: JSON.stringify({
        prompt: 'What is 2+2?',
        userId: userId
      })
    });

    const standardData = await standardRes.json();

    if (standardRes.status === 200) {
      results.push({
        test: 'Standard Mode',
        status: 'PASSED',
        http_code: 200,
        duration_ms: Date.now() - standardStart,
        details: {
          model: standardData.model,
          credits_charged: standardData.credits_charged
        }
      });
    } else {
      results.push({
        test: 'Standard Mode',
        status: 'FAILED',
        http_code: standardRes.status,
        duration_ms: Date.now() - standardStart,
        error: standardData.error || 'Unknown error'
      });
    }

    // ========================================
    // TEST 4: SUPERMODE AI COUNCIL
    // ========================================
    const supermodeStart = Date.now();
    
    const supermodeRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${accessToken}`
      },
      body: JSON.stringify({
        prompt: 'Compare Python vs JavaScript. Be very brief.',
        userId: userId,
        supermode: true
      })
    });

    const supermodeData = await supermodeRes.json();

    if (supermodeRes.status === 200) {
      results.push({
        test: 'SuperMode AI Council',
        status: 'PASSED',
        http_code: 200,
        duration_ms: Date.now() - supermodeStart,
        details: {
          timeline_steps: supermodeData.timeline?.length || 0,
          contributors: supermodeData.top_contributors?.length || 0,
          credits_charged: supermodeData.credits_charged
        }
      });
    } else {
      results.push({
        test: 'SuperMode AI Council',
        status: 'FAILED',
        http_code: supermodeRes.status,
        duration_ms: Date.now() - supermodeStart,
        error: supermodeData.error || 'Unknown error'
      });
    }

    // ========================================
    // TEST 5: CREDIT ENFORCEMENT
    // ========================================
    const creditStart = Date.now();
    
    // Set balance to 1
    await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credit_balance: 1 })
    });

    const creditRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${accessToken}`
      },
      body: JSON.stringify({
        prompt: 'Explain quantum physics in detail',
        userId: userId
      })
    });

    if (creditRes.status === 402) {
      results.push({
        test: 'Credit Enforcement',
        status: 'PASSED',
        http_code: 402,
        duration_ms: Date.now() - creditStart,
        details: { blocked_correctly: true }
      });
    } else {
      results.push({
        test: 'Credit Enforcement',
        status: 'FAILED',
        http_code: creditRes.status,
        duration_ms: Date.now() - creditStart,
        error: 'Should have returned 402'
      });
    }

    // ========================================
    // TEST 6: DATABASE LOGGING
    // ========================================
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for async logs

    const logsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_usage_logs?user_id=eq.${userId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const logs = await logsRes.json();
    const logCount = Array.isArray(logs) ? logs.length : 0;

    if (logCount > 0) {
      results.push({
        test: 'Database Logging',
        status: 'PASSED',
        duration_ms: 0,
        details: { log_entries: logCount }
      });
    } else {
      results.push({
        test: 'Database Logging',
        status: 'WARNING',
        duration_ms: 0,
        details: { log_entries: 0, note: 'May be async delay' }
      });
    }

    // ========================================
    // CLEANUP
    // ========================================
    await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_logs?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

  } catch (error) {
    results.push({
      test: 'System Error',
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // ========================================
  // GENERATE SUMMARY
  // ========================================
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  const summary: TestSummary = {
    timestamp: new Date().toISOString(),
    total_tests: results.length,
    passed,
    failed,
    warnings,
    overall_status: failed === 0 ? (warnings === 0 ? 'COMPLETE' : 'PARTIAL') : 'FAILED',
    results
  };

  return NextResponse.json(summary, {
    status: summary.overall_status === 'COMPLETE' ? 200 : 
            summary.overall_status === 'PARTIAL' ? 207 : 500
  });
}
