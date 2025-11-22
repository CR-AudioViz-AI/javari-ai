import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PerformanceMetric {
  app_id: string;
  metric_type: string;
  value: number;
  unit: string;
  context?: Record<string, any>;
  user_id?: string;
}

interface JavariResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: PerformanceMetric = await request.json();

    // Validate required fields
    if (!body.app_id || !body.metric_type || typeof body.value !== 'number' || !body.unit) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required fields: app_id, metric_type, value, unit',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Insert performance metric
    const { data: metric, error: insertError } = await supabase
      .from('performance_metrics')
      .insert({
        app_id: body.app_id,
        metric_type: body.metric_type,
        value: body.value,
        unit: body.unit,
        context: body.context,
        user_id: body.user_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting performance metric:', insertError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to create performance metric',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        metric_id: metric.id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/monitoring/performance:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const app_id = searchParams.get('app_id');
    const metric_type = searchParams.get('metric_type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const hours = parseInt(searchParams.get('hours') || '24');

    // Calculate time window
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    let query = supabase
      .from('performance_metrics')
      .select('*')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (app_id) query = query.eq('app_id', app_id);
    if (metric_type) query = query.eq('metric_type', metric_type);

    const { data: metrics, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching performance metrics:', fetchError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to fetch performance metrics',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Calculate aggregates
    const aggregates = metrics?.reduce((acc: any, m: any) => {
      const type = m.metric_type;
      if (!acc[type]) {
        acc[type] = { values: [], unit: m.unit };
      }
      acc[type].values.push(m.value);
      return acc;
    }, {});

    const summary = Object.entries(aggregates || {}).reduce((acc: any, [type, data]: [string, any]) => {
      const values = data.values;
      acc[type] = {
        avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        unit: data.unit
      };
      return acc;
    }, {});

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        metrics,
        summary,
        count: metrics?.length || 0,
        time_window_hours: hours
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/monitoring/performance GET:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
