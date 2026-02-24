import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ErrorReport {
  app_id: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, any>;
  user_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
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
    const body: ErrorReport = await request.json();

    // Validate required fields
    if (!body.app_id || !body.error_type || !body.error_message || !body.severity) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required fields: app_id, error_type, error_message, severity',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Insert error report
    const { data: errorReport, error: insertError } = await supabase
      .from('error_reports')
      .insert({
        app_id: body.app_id,
        error_type: body.error_type,
        error_message: body.error_message,
        stack_trace: body.stack_trace,
        context: body.context,
        user_id: body.user_id,
        severity: body.severity,
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting error report:', insertError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to create error report',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Auto-trigger fix attempt for critical errors
    if (body.severity === 'critical' || body.severity === 'high') {
      const { error: autoFixError } = await supabase
        .from('auto_fix_attempts')
        .insert({
          error_report_id: errorReport.id,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (autoFixError) {
        console.error('Failed to create auto-fix attempt:', autoFixError);
        // Don't fail the request, just log it
      }
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        report_id: errorReport.id,
        auto_fix_triggered: body.severity === 'critical' || body.severity === 'high'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/monitoring/errors:', error);
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
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('error_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (app_id) query = query.eq('app_id', app_id);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);

    const { data: errors, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching error reports:', fetchError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to fetch error reports',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        errors,
        count: errors?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/monitoring/errors GET:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
