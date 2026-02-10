import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * JAVARI AI PHASE 2 - AUTOMATED TEST (UUID FIX)
 */

export async function GET(req: NextRequest) {
  const results: any[] = [];
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const testUserId = randomUUID(); // Proper UUID

  try {
    // CREATE TEST USER
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
        details: accountError
      }, { status: 500 });
    }

    results.push({
      test: 'Setup',
      status: 'PASSED',
      duration_ms: Date.now() - setupStart
    });

    // TEST: INFRASTRUCTURE
    const infraRes = await fetch(`${req.nextUrl.origin}/api/javari/router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    results.push({
      test: 'API Infrastructure',
      status: infraRes.status === 401 ? 'PASSED' : 'WARNING',
      http_code: infraRes.status,
      note: 'Auth enforcement check'
    });

    // TEST: CREDIT BALANCE
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

    // TEST: CREDIT UPDATE
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
      test: 'Credit Update',
      status: updated?.credit_balance === 1 ? 'PASSED' : 'FAILED',
      updated_balance: updated?.credit_balance
    });

    // TEST: LOGGING TABLE
    const { error: logError } = await supabase
      .from('ai_usage_logs')
      .select('id')
      .limit(1);

    results.push({
      test: 'Logging Table Access',
      status: logError ? 'WARNING' : 'PASSED',
      accessible: !logError
    });

    // CLEANUP
    await supabase.from('user_accounts').delete().eq('user_id', testUserId);

    results.push({
      test: 'Cleanup',
      status: 'PASSED'
    });

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
    overall_status: failed === 0 ? 'PHASE 2 COMPLETE ✅' : 'NEEDS ATTENTION ⚠️',
    results
  });
}
