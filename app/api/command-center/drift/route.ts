/**
 * app/api/command-center/drift/route.ts
 * Command Center Drift Detection Endpoint
 * Created: 2026-02-22 02:49 ET
 * 
 * Returns drift detection events:
 * - Canonical drift (docs changed)
 * - Roadmap drift (tasks changed externally)
 * - Schema drift (database changes)
 * - Model behavior drift (outputs changed)
 * - Dependency drift (npm/system deps changed)
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
    const driftType = searchParams.get('type');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

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
      .from('autonomy_drift_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (driftType) query = query.eq('drift_type', driftType);
    if (severity) query = query.gte('severity', parseInt(severity, 10));
    if (resolved !== null) query = query.eq('resolved', resolved === 'true');

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch drift events: ${error.message}`);
    }

    // Calculate statistics
    const stats = {
      total: data?.length || 0,
      byType: {} as Record<string, number>,
      bySeverity: {
        info: 0,      // severity 1-2
        warning: 0,   // severity 3-4
        critical: 0,  // severity 5
      },
      resolved: data?.filter(d => d.resolved).length || 0,
      unresolved: data?.filter(d => !d.resolved).length || 0,
    };

    data?.forEach(drift => {
      // Count by type
      stats.byType[drift.drift_type] = (stats.byType[drift.drift_type] || 0) + 1;
      
      // Count by severity
      if (drift.severity <= 2) stats.bySeverity.info++;
      else if (drift.severity <= 4) stats.bySeverity.warning++;
      else stats.bySeverity.critical++;
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      events: data || [],
      stats,
      filters: { driftType, severity, resolved },
    }, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Drift] Error:', error);
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

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { action, driftId } = body;

    if (!action || !driftId) {
      return NextResponse.json(
        { error: 'action and driftId required', code: 'MISSING_PARAMS' },
        { status: 400 }
      );
    }

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result: any = {};

    switch (action) {
      case 'resolve': {
        const { error: updateError } = await supabase
          .from('autonomy_drift_events')
          .update({ resolved: true })
          .eq('id', driftId);

        if (updateError) {
          throw new Error(`Failed to resolve drift: ${updateError.message}`);
        }

        result = { resolved: true, driftId };
        break;
      }

      case 'unresolve': {
        const { error: updateError } = await supabase
          .from('autonomy_drift_events')
          .update({ resolved: false })
          .eq('id', driftId);

        if (updateError) {
          throw new Error(`Failed to unresolve drift: ${updateError.message}`);
        }

        result = { unresolved: true, driftId };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION', validActions: ['resolve', 'unresolve'] },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      action,
      result,
    }, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Drift POST] Error:', error);
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
