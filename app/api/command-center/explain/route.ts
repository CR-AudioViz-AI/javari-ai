/**
 * app/api/command-center/explain/route.ts
 * Command Center Explainability Endpoint
 * Created: 2026-02-22 02:46 ET
 * 
 * Returns explainability data:
 * - Reasoning traces
 * - Canonical references used
 * - Validator outcomes
 * - Models used
 * - Safety gates hit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/platform-secrets';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const taskId = searchParams.get('taskId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from('autonomy_explainability_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cycleId) query = query.eq('cycle_id', cycleId);
    if (taskId) query = query.eq('task_id', taskId);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch explainability logs: ${error.message}`);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      logs: data || [],
      count: data?.length || 0,
      filters: { cycleId, taskId },
    }, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Explain] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
