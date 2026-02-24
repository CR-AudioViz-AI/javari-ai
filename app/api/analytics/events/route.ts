import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AnalyticsEvent {
  app_id: string;
  event_type: string;
  event_data?: Record<string, any>;
  user_id?: string;
  session_id?: string;
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
    const body: AnalyticsEvent = await request.json();

    // Validate required fields
    if (!body.app_id || !body.event_type) {
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Missing required fields: app_id, event_type',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Insert analytics event
    const { data: event, error: insertError } = await supabase
      .from('analytics_events')
      .insert({
        app_id: body.app_id,
        event_type: body.event_type,
        event_data: body.event_data,
        user_id: body.user_id,
        session_id: body.session_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting analytics event:', insertError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to create analytics event',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        event_id: event.id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/analytics/events:', error);
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
    const event_type = searchParams.get('event_type');
    const user_id = searchParams.get('user_id');
    const session_id = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const hours = parseInt(searchParams.get('hours') || '24');

    // Calculate time window
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    let query = supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (app_id) query = query.eq('app_id', app_id);
    if (event_type) query = query.eq('event_type', event_type);
    if (user_id) query = query.eq('user_id', user_id);
    if (session_id) query = query.eq('session_id', session_id);

    const { data: events, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching analytics events:', fetchError);
      return NextResponse.json<JavariResponse>({
        success: false,
        error: 'Failed to fetch analytics events',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Calculate event type distribution
    const distribution = events?.reduce((acc: any, e: any) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {});

    // Calculate unique users and sessions
    const uniqueUsers = new Set(events?.map((e: any) => e.user_id).filter(Boolean));
    const uniqueSessions = new Set(events?.map((e: any) => e.session_id).filter(Boolean));

    return NextResponse.json<JavariResponse>({
      success: true,
      data: {
        events,
        summary: {
          total_events: events?.length || 0,
          unique_users: uniqueUsers.size,
          unique_sessions: uniqueSessions.size,
          event_distribution: distribution,
          time_window_hours: hours
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/analytics/events GET:', error);
    return NextResponse.json<JavariResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
