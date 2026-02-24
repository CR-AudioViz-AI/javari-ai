/**
 * app/api/command-center/history/route.ts
 * Command Center History Endpoint
 * Created: 2026-02-22 02:40 ET
 * 
 * Returns paginated, unified timeline of:
 * - Cycle reports
 * - Patches generated
 * - Anomalies detected
 * - Control events
 * - Roadmap version changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/platform-secrets';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HistoryEvent {
  id: string;
  type: 'cycle' | 'patch' | 'anomaly' | 'control' | 'roadmap_version';
  timestamp: string;
  summary: string;
  details: any;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

interface HistoryResponse {
  events: HistoryEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    types: string[];
    startDate: string | null;
    endDate: string | null;
  };
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const types = searchParams.get('types')?.split(',') || ['cycle', 'patch', 'anomaly', 'control', 'roadmap_version'];
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const events: HistoryEvent[] = [];

    // Fetch cycle reports
    if (types.includes('cycle')) {
      let query = supabase
        .from('autonomy_cycle_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query.limit(limit);

      if (data && !error) {
        data.forEach(cycle => {
          events.push({
            id: cycle.id,
            type: 'cycle',
            timestamp: cycle.created_at,
            summary: `Cycle ${cycle.cycle_id.substring(0, 8)} completed`,
            details: {
              duration: cycle.duration_ms,
              stages: cycle.stages,
              patches: cycle.patches_generated,
              failures: cycle.failures,
            },
            severity: cycle.failures > 0 ? 'warning' : 'info',
          });
        });
      }
    }

    // Fetch patches
    if (types.includes('patch')) {
      let query = supabase
        .from('autonomy_patches')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query.limit(limit);

      if (data && !error) {
        data.forEach(patch => {
          events.push({
            id: patch.id,
            type: 'patch',
            timestamp: patch.created_at,
            summary: `Patch: ${patch.title || 'Untitled'}`,
            details: {
              files: patch.files_changed,
              status: patch.status,
              validator: patch.validator_score,
            },
            severity: patch.status === 'applied' ? 'info' : 'warning',
          });
        });
      }
    }

    // Fetch anomalies
    if (types.includes('anomaly')) {
      let query = supabase
        .from('autonomy_anomalies')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query.limit(limit);

      if (data && !error) {
        data.forEach(anomaly => {
          events.push({
            id: anomaly.id,
            type: 'anomaly',
            timestamp: anomaly.created_at,
            summary: `Anomaly: ${anomaly.anomaly_type}`,
            details: {
              type: anomaly.anomaly_type,
              context: anomaly.context,
              resolved: anomaly.resolved,
            },
            severity: anomaly.severity >= 8 ? 'critical' : anomaly.severity >= 5 ? 'error' : 'warning',
          });
        });
      }
    }

    // Fetch control events
    if (types.includes('control')) {
      let query = supabase
        .from('autonomy_control_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query.limit(limit);

      if (data && !error) {
        data.forEach(control => {
          events.push({
            id: control.id,
            type: 'control',
            timestamp: control.created_at,
            summary: `Control: ${control.action}`,
            details: {
              action: control.action,
              metadata: control.metadata,
              actor: control.actor,
            },
            severity: control.action.includes('kill') ? 'critical' : 'info',
          });
        });
      }
    }

    // Fetch roadmap versions
    if (types.includes('roadmap_version')) {
      let query = supabase
        .from('autonomy_roadmap_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query.limit(limit);

      if (data && !error) {
        data.forEach(version => {
          events.push({
            id: version.id,
            type: 'roadmap_version',
            timestamp: version.created_at,
            summary: `Roadmap ${version.roadmap_id} v${version.version}`,
            details: {
              roadmapId: version.roadmap_id,
              version: version.version,
              diff: version.diff,
            },
            severity: 'info',
          });
        });
      }
    }

    // Sort all events by timestamp DESC
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate
    const offset = (page - 1) * limit;
    const paginatedEvents = events.slice(offset, offset + limit);

    const response: HistoryResponse = {
      events: paginatedEvents,
      pagination: {
        page,
        limit,
        total: events.length,
        hasMore: offset + limit < events.length,
      },
      filters: {
        types,
        startDate,
        endDate,
      },
    };

    const duration = Date.now() - startTime;

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[Command Center History] Error:', error);
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
