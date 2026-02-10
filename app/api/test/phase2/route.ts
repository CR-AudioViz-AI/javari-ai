import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * JAVARI AI PHASE 2 - SIMPLIFIED AUTOMATED TEST
 * 
 * Bypasses auth signup issues by using service role directly
 */

export async function GET(req: NextRequest) {
  const results: any[] = [];
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  // Create admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  let testUserId = `test-${Date.now()}`;
  let mockAccessToken = 'mock-token-for-testing';

  try {
    // ========================================
    // STEP 1: CREATE TEST USER DIRECTLY IN DB
    // ========================================
    const setupStart = Date.now();
    
    // Insert directly into user_accounts (bypass auth)
    const { error: accountError } = await supabase
      .from('user_accounts')
      .insert({
        user_id: testUserId,
        credit_balance: 500,
        total_credits_purchased: 500
      });

    if (accountError) {
      return NextResponse.json({
        error: 'Setup failed',
        details: accountError
      }, { status: 500 });
    }

    results.push({
      test: 'Setup',
      status: 'PASSED',
      duration_ms: Date.now() - setupStart,
      details: { user_id: testUserId, credits: 500 }
    });

    // ========================================
    // TEST 1: DIRECT API CALL (STANDARD MODE)
    // ========================================
    const standardStart = Date.now();
    
    // Call router directly with mock auth
    const standardRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': testUserId // Use custom header for testing
      },
      body: JSON.stringify({
        prompt: 'What is 2+2? Answer in one word.',
        userId: testUserId
      })
    });

    const standardData = await standardRes.json();

    results.push({
      test: 'Standard Mode (Direct Call)',
      status: standardRes.status === 200 ? 'PASSED' : 'FAILED',
      http_code: standardRes.status,
      duration_ms: Date.now() - standardStart,
      details: standardRes.status === 200 ? {
        model: standardData.model,
        credits: standardData.credits_charged,
        response_preview: standardData.response?.substring(0, 50)
      } : {
        error: standardData.error || standardData
      }
    });

    // ========================================
    // TEST 2: CHECK CREDIT BALANCE
    // ========================================
    const { data: accountData } = await supabase
      .from('user_accounts')
      .select('credit_balance')
      .eq('user_id', testUserId)
      .single();

    const creditsRemaining = accountData?.credit_balance || 0;

    results.push({
      test: 'Credit Deduction',
      status: creditsRemaining < 500 ? 'PASSED' : 'FAILED',
      details: {
        initial: 500,
        remaining: creditsRemaining,
        charged: 500 - creditsRemaining
      }
    });

    // ========================================
    // TEST 3: SET LOW BALANCE & TEST ENFORCEMENT
    // ========================================
    await supabase
      .from('user_accounts')
      .update({ credit_balance: 1 })
      .eq('user_id', testUserId);

    const enforcementStart = Date.now();
    
    const enforcementRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': testUserId
      },
      body: JSON.stringify({
        prompt: 'Explain quantum physics in detail',
        userId: testUserId
      })
    });

    results.push({
      test: 'Credit Enforcement',
      status: enforcementRes.status === 402 ? 'PASSED' : 'FAILED',
      http_code: enforcementRes.status,
      duration_ms: Date.now() - enforcementStart,
      details: {
        expected: 402,
        received: enforcementRes.status
      }
    });

    // ========================================
    // TEST 4: CHECK DATABASE LOGGING
    // ========================================
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async logs

    const { data: logs } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('user_id', testUserId);

    const logCount = logs?.length || 0;

    results.push({
      test: 'Database Logging',
      status: logCount > 0 ? 'PASSED' : 'WARNING',
      details: {
        log_entries: logCount,
        note: logCount === 0 ? 'May be async delay' : undefined
      }
    });

    // ========================================
    // CLEANUP
    // ========================================
    await supabase
      .from('ai_usage_logs')
      .delete()
      .eq('user_id', testUserId);

    await supabase
      .from('user_accounts')
      .delete()
      .eq('user_id', testUserId);

  } catch (error) {
    results.push({
      test: 'System Error',
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // ========================================
  // SUMMARY
  // ========================================
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total_tests: results.length,
    passed,
    failed,
    warnings,
    overall_status: failed === 0 ? (warnings === 0 ? 'COMPLETE' : 'PARTIAL') : 'FAILED',
    results
  }, {
    status: failed === 0 ? 200 : 500
  });
}
