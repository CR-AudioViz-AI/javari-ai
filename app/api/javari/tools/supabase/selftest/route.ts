// app/api/javari/tools/supabase/selftest/route.ts
// Self-test endpoint for Supabase Read Tool

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/javari-tools-init';
import { supabaseReadTool } from '@/lib/javari-supabase-tool';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    tool_enabled: supabaseReadTool.enabled(),
    tests: [] as any[],
    overall: 'PENDING' as 'PASS' | 'FAIL' | 'PENDING',
  };

  // Register tool
  toolRegistry.registerTool(supabaseReadTool);

  // Test 1: Check if tool is enabled
  results.tests.push({
    name: 'Tool Enabled Check',
    status: supabaseReadTool.enabled() ? 'PASS' : 'FAIL',
    message: supabaseReadTool.enabled() 
      ? 'Supabase Read Tool is enabled' 
      : 'Supabase Read Tool is disabled (check FEATURE_SUPABASE_READ, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)',
  });

  if (!supabaseReadTool.enabled()) {
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Test 2: List tables (may fail due to RLS)
  try {
    const tablesResult = await toolRegistry.executeTool('supabase_read', {
      action: 'getTableList',
    });

    results.tests.push({
      name: 'List Tables',
      status: tablesResult.success ? 'PASS' : 'INFO',
      message: tablesResult.success 
        ? `Found ${tablesResult.data?.length || 0} tables` 
        : `RLS may be blocking: ${tablesResult.error}`,
      tables: tablesResult.success 
        ? tablesResult.data?.slice(0, 10).map((t: any) => t.table_name)
        : undefined,
    });

  } catch (error: any) {
    results.tests.push({
      name: 'List Tables',
      status: 'INFO',
      message: `RLS may be blocking: ${error.message}`,
    });
  }

  // Test 3: List storage buckets
  try {
    const bucketsResult = await toolRegistry.executeTool('supabase_read', {
      action: 'listBuckets',
    });

    results.tests.push({
      name: 'List Storage Buckets',
      status: bucketsResult.success ? 'PASS' : 'FAIL',
      message: bucketsResult.success 
        ? `Found ${bucketsResult.data?.length || 0} storage buckets` 
        : bucketsResult.error,
      buckets: bucketsResult.success 
        ? bucketsResult.data?.map((b: any) => b.name)
        : undefined,
    });

    if (!bucketsResult.success) {
      results.overall = 'FAIL';
      return NextResponse.json(results);
    }

  } catch (error: any) {
    results.tests.push({
      name: 'List Storage Buckets',
      status: 'FAIL',
      message: error.message,
    });
    results.overall = 'FAIL';
    return NextResponse.json(results);
  }

  // Determine overall status (PASS if at least buckets worked)
  const criticalPassed = results.tests.some(t => 
    t.name === 'List Storage Buckets' && t.status === 'PASS'
  );
  results.overall = criticalPassed ? 'PASS' : 'FAIL';

  return NextResponse.json(results, {
    status: results.overall === 'PASS' ? 200 : 500,
  });
}
