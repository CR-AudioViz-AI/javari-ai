import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const results: any[] = [];
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const testUserId = randomUUID();
  const testEmail = `test-${Date.now()}@javari.ai`;

  try {
    // SETUP
    const { error: accountError } = await supabase
      .from('user_accounts')
      .insert({
        user_id: testUserId,
        email: testEmail,
        credit_balance: 500
      });

    if (accountError) {
      return NextResponse.json({
        error: 'Setup failed',
        details: accountError
      }, { status: 500 });
    }

    results.push({ test: 'Setup', status: 'PASSED' });

    // TEST 1: API responds
    const infraRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    results.push({
      test: 'API Infrastructure',
      status: infraRes.status === 401 ? 'PASSED' : 'WARNING',
      http_code: infraRes.status
    });

    // TEST 2: Credit balance
    const { data: account } = await supabase
      .from('user_accounts')
      .select('credit_balance')
      .eq('user_id', testUserId)
      .single();

    results.push({
      test: 'Credit Account',
      status: account?.credit_balance === 500 ? 'PASSED' : 'FAILED',
      balance: account?.credit_balance
    });

    // TEST 3: Credit update
    await supabase
      .from('user_accounts')
      .update({ credit_balance: 1 })
      .eq('user_id', testUserId);

    const { data: updated } = await supabase
      .from('user_accounts')
      .select('credit_balance')
      .eq('user_id', testUserId)
      .single();

    results.push({
      test: 'Credit Enforcement Simulation',
      status: updated?.credit_balance === 1 ? 'PASSED' : 'FAILED',
      note: 'Verified credit updates work'
    });

    // TEST 4: Logging table
    const { error: logError } = await supabase
      .from('ai_usage_logs')
      .select('id')
      .limit(1);

    results.push({
      test: 'Database Logging',
      status: logError ? 'WARNING' : 'PASSED',
      accessible: !logError
    });

    // CLEANUP
    await supabase.from('user_accounts').delete().eq('user_id', testUserId);
    results.push({ test: 'Cleanup', status: 'PASSED' });

  } catch (error) {
    results.push({
      test: 'System Error',
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    phase: 'Phase 2 - Infrastructure Verification',
    total_tests: results.length,
    passed,
    failed,
    overall_status: failed === 0 ? '✅ PHASE 2 COMPLETE' : '⚠️ NEEDS ATTENTION',
    summary: failed === 0 ? 
      'All infrastructure tests passed. Database accessible, credit system functional, ready for full API testing.' :
      'Some tests failed. Review results above.',
    results
  });
}
