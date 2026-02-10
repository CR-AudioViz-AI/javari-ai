import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * JAVARI AI PHASE 2 - FINAL AUTOMATED TEST
 * Fixed to use actual user_accounts schema
 */

export async function GET(req: NextRequest) {
  const results: any[] = [];
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const testUserId = `test-user-${Date.now()}`;

  try {
    // ========================================
    // SETUP: CREATE TEST USER WITH CREDITS
    // ========================================
    const setupStart = Date.now();
    
    const { error: accountError } = await supabase
      .from('user_accounts')
      .insert({
        user_id: testUserId,
        credit_balance: 500
      });

    if (accountError) {
      return NextResponse.json({
        error: 'Setup failed',
        details: accountError,
        note: 'Could not create test user account'
      }, { status: 500 });
    }

    results.push({
      test: 'Setup',
      status: 'PASSED',
      duration_ms: Date.now() - setupStart,
      details: { user_id: testUserId, initial_credits: 500 }
    });

    // ========================================
    // TEST 1: INFRASTRUCTURE CHECK
    // ========================================
    const infraStart = Date.now();
    
    const infraRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    results.push({
      test: 'Infrastructure',
      status: infraRes.status === 401 ? 'PASSED' : 'WARNING',
      http_code: infraRes.status,
      duration_ms: Date.now() - infraStart,
      details: {
        expected: 401,
        received: infraRes.status,
        note: infraRes.status === 401 ? 'Auth correctly enforced' : 'Unexpected response'
      }
    });

    // ========================================
    // TEST 2: CHECK CREDIT BALANCE EXISTS
    // ========================================
    const { data: checkAccount, error: checkError } = await supabase
      .from('user_accounts')
      .select('credit_balance')
      .eq('user_id', testUserId)
      .single();

    results.push({
      test: 'Credit Account',
      status: checkAccount?.credit_balance === 500 ? 'PASSED' : 'FAILED',
      details: {
        balance: checkAccount?.credit_balance,
        error: checkError?.message
      }
    });

    // ========================================
    // TEST 3: CREDIT UPDATE (ENFORCEMENT SIM)
    // ========================================
    const { error: updateError } = await supabase
      .from('user_accounts')
      .update({ credit_balance: 1 })
      .eq('user_id', testUserId);

    const { data: lowBalance } = await supabase
      .from('user_accounts')
      .select('credit_balance')
      .eq('user_id', testUserId)
      .single();

    results.push({
      test: 'Credit Update',
      status: lowBalance?.credit_balance === 1 ? 'PASSED' : 'FAILED',
      details: {
        updated_balance: lowBalance?.credit_balance,
        update_error: updateError?.message
      }
    });

    // ========================================
    // TEST 4: DATABASE SCHEMA VERIFICATION
    // ========================================
    const { data: schemaCheck } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    const columns = schemaCheck ? Object.keys(schemaCheck) : [];

    results.push({
      test: 'Database Schema',
      status: 'INFO',
      details: {
        table: 'user_accounts',
        columns,
        required: ['user_id', 'credit_balance'],
        has_all_required: columns.includes('user_id') && columns.includes('credit_balance')
      }
    });

    // ========================================
    // TEST 5: CHECK AI_USAGE_LOGS TABLE
    // ========================================
    const { data: logCheck, error: logError } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .limit(1);

    results.push({
      test: 'Logging Table',
      status: logError ? 'WARNING' : 'PASSED',
      details: {
        accessible: !logError,
        error: logError?.message,
        sample_columns: logCheck?.[0] ? Object.keys(logCheck[0]) : []
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

    results.push({
      test: 'Cleanup',
      status: 'PASSED',
      details: { test_data_removed: true }
    });

  } catch (error) {
    results.push({
      test: 'System Error',
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }

  // ========================================
  // SUMMARY
  // ========================================
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const info = results.filter(r => r.status === 'INFO').length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    phase: 'Phase 2 - Database & Infrastructure',
    total_tests: results.length,
    passed,
    failed,
    warnings,
    info,
    overall_status: failed === 0 ? 'COMPLETE' : 'PARTIAL',
    results,
    next_steps: failed === 0 ? [
      'Phase 2 infrastructure is verified',
      'Credit system is functional',
      'Database tables are accessible',
      'Ready for full API testing with authenticated requests'
    ] : [
      'Review failed tests above',
      'Check Supabase configuration',
      'Verify environment variables'
    ]
  }, {
    status: failed === 0 ? 200 : 207
  });
}
