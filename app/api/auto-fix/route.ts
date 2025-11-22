import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AutoFixRequest {
  error_report_id: string;
  strategy?: 'ai' | 'template' | 'rollback';
}

interface JavariResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// TRIGGER auto-fix attempt
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: AutoFixRequest = await request.json();

    // Validate required fields
    if (!body.error_report_id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required field: error_report_id',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Get error report details
    const { data: errorReport, error: fetchError } = await supabase
      .from('error_reports')
      .select('*')
      .eq('id', body.error_report_id)
      .single();

    if (fetchError || !errorReport) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Error report not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Check if already being fixed
    const { data: existingAttempt } = await supabase
      .from('auto_fix_attempts')
      .select('id, status')
      .eq('error_report_id', body.error_report_id)
      .eq('status', 'in_progress')
      .single();

    if (existingAttempt) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Auto-fix already in progress for this error',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Create auto-fix attempt
    const { data: attempt, error: insertError } = await supabase
      .from('auto_fix_attempts')
      .insert({
        error_report_id: body.error_report_id,
        strategy: body.strategy || 'ai',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating auto-fix attempt:', insertError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to create auto-fix attempt',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Queue for processing (in production, this would trigger a background job)
    // For now, we'll update status to show it's queued
    await supabase
      .from('auto_fix_attempts')
      .update({ 
        status: 'queued',
        started_at: new Date().toISOString()
      })
      .eq('id', attempt.id);

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        attempt_id: attempt.id,
        status: 'queued',
        error_report: errorReport,
        estimated_time_seconds: 30
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Error in /api/auto-fix POST:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET auto-fix attempt status
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const attempt_id = searchParams.get('attempt_id');
    const error_report_id = searchParams.get('error_report_id');
    const app_id = searchParams.get('app_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('auto_fix_attempts')
      .select('*, error_reports(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (attempt_id) {
      query = query.eq('id', attempt_id);
    }
    if (error_report_id) {
      query = query.eq('error_report_id', error_report_id);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: attempts, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching auto-fix attempts:', fetchError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to fetch auto-fix attempts',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // If specific app_id, filter by error report app_id
    let filteredAttempts = attempts;
    if (app_id && attempts) {
      filteredAttempts = attempts.filter((a: any) => 
        a.error_reports?.app_id === app_id
      );
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        attempts: filteredAttempts,
        count: filteredAttempts?.length || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/auto-fix GET:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// UPDATE auto-fix attempt (for background workers to update status)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const attempt_id = searchParams.get('attempt_id');
    
    if (!attempt_id) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing attempt_id parameter',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = ['status', 'fix_applied', 'result_data', 'error_message'];
    const updates: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'No valid fields to update',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Add timestamp based on status
    if (updates.status === 'in_progress' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (['completed', 'failed'].includes(updates.status)) {
      updates.completed_at = new Date().toISOString();
    }

    const { data: attempt, error: updateError } = await supabase
      .from('auto_fix_attempts')
      .update(updates)
      .eq('id', attempt_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating auto-fix attempt:', updateError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to update auto-fix attempt',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // If fix was successful, update error report status
    if (updates.status === 'completed' && updates.fix_applied) {
      await supabase
        .from('error_reports')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', attempt.error_report_id);
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: { attempt },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/auto-fix PATCH:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
