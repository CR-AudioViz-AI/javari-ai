/**
 * Javari AI Telemetry & Analytics API
 * Tracks user interactions, performance metrics, and system behavior
 * 
 * @route /api/javari/telemetry
 * @version 1.0.0
 * @last-updated 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type EventType = 
  | 'chat_sent' 
  | 'model_switched' 
  | 'error_occurred' 
  | 'page_loaded'
  | 'file_uploaded'
  | 'code_executed'
  | 'conversation_created'
  | 'conversation_continued'
  | 'feature_used'
  | 'feedback_submitted';

type EventCategory = 'user_action' | 'system_event' | 'error' | 'performance';

interface TelemetryEvent {
  eventType: EventType;
  eventCategory: EventCategory;
  eventData?: Record<string, any>;
  userId?: string;
  conversationId?: string;
  sessionId?: string;
  pageLoadTime?: number;
  apiResponseTime?: number;
}

/**
 * POST /api/javari/telemetry
 * Log telemetry event
 */
export async function POST(request: NextRequest) {
  try {
    const body: TelemetryEvent = await request.json();
    const {
      eventType,
      eventCategory,
      eventData = {},
      userId = 'anonymous',
      conversationId,
      sessionId,
      pageLoadTime,
      apiResponseTime,
    } = body;

    // Validate event type
    const validEventTypes = [
      'chat_sent', 'model_switched', 'error_occurred', 'page_loaded',
      'file_uploaded', 'code_executed', 'conversation_created',
      'conversation_continued', 'feature_used', 'feedback_submitted',
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event type: ${eventType}` },
        { status: 400 }
      );
    }

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : undefined;

    // Log to database
    const { error } = await supabase
      .from('javari_telemetry')
      .insert({
        user_id: userId,
        conversation_id: conversationId || null,
        event_type: eventType,
        event_category: eventCategory,
        event_data: eventData,
        user_agent: userAgent,
        ip_address: ipAddress,
        session_id: sessionId,
        page_load_time_ms: pageLoadTime,
        api_response_time_ms: apiResponseTime,
      });

    if (error) {
      logError(\'Telemetry logging error:\', error);
      // Don't fail the request if telemetry fails
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logError(\'Telemetry error:\', error);
    // Return success even on error to not disrupt user experience
    return NextResponse.json({ success: true });
  }
}

/**
 * GET /api/javari/telemetry/analytics
 * Get analytics dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get event counts by type
    const { data: eventCounts } = await supabase
      .from('javari_telemetry')
      .select('event_type, count:id.count()')
      .gte('created_at', startDate.toISOString())
      .order('count', { ascending: false });

    // Get error events
    const { data: errors } = await supabase
      .from('javari_telemetry')
      .select('*')
      .eq('event_category', 'error')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get performance metrics
    const { data: performanceMetrics } = await supabase
      .from('javari_telemetry')
      .select('page_load_time_ms, api_response_time_ms')
      .not('page_load_time_ms', 'is', null)
      .gte('created_at', startDate.toISOString());

    // Calculate average performance
    const avgPageLoad = performanceMetrics
      ? performanceMetrics.reduce((sum, m) => sum + (m.page_load_time_ms || 0), 0) / performanceMetrics.length
      : 0;

    const avgApiResponse = performanceMetrics
      ? performanceMetrics.reduce((sum, m) => sum + (m.api_response_time_ms || 0), 0) / performanceMetrics.length
      : 0;

    // Get daily usage stats (from the view)
    const { data: usageStats } = await supabase
      .from('javari_daily_usage_stats')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    // Get user activity summary
    let userActivity = null;
    if (userId) {
      const { data } = await supabase
        .from('javari_user_activity_summary')
        .select('*')
        .eq('user_id', userId)
        .single();
      userActivity = data;
    }

    return NextResponse.json({
      analytics: {
        period: `Last ${days} days`,
        eventCounts: eventCounts || [],
        recentErrors: errors || [],
        performance: {
          avgPageLoadTime: Math.round(avgPageLoad),
          avgApiResponseTime: Math.round(avgApiResponse),
        },
        usageStats: usageStats || [],
        userActivity: userActivity,
      },
    });
  } catch (error: unknown) {
    logError(\'Analytics error:\', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
