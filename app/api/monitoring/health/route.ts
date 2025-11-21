import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Initialize Supabase client
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * POST /api/monitoring/health
 * Receive health status from apps
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appId, status, uptime, metrics } = body

    // Validate required fields
    if (!appId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: appId, status' },
        { status: 400 }
      )
    }

    // Validate status value
    if (!['healthy', 'degraded', 'down'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Insert health status
    const { data, error } = await supabase
      .from('app_health_status')
      .insert({
        app_id: appId,
        status,
        uptime: uptime || 0,
        response_time: metrics?.responseTime,
        error_rate: metrics?.errorRate,
        active_users: metrics?.activeUsers,
        cpu_usage: metrics?.cpuUsage,
        memory_usage: metrics?.memoryUsage,
        last_check: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[Health API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to store health status' },
        { status: 500 }
      )
    }

    // Check if status is degraded or down - trigger alerts
    if (status !== 'healthy') {
      await triggerHealthAlert(appId, status, metrics)
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Health API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/monitoring/health
 * Get health status for apps
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appId = searchParams.get('appId')
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('app_health_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (appId) {
      query = query.eq('app_id', appId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Health API] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch health status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Health API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Trigger health alert when app status is not healthy
 */
async function triggerHealthAlert(
  appId: string,
  status: string,
  metrics: any
): Promise<void> {
  // In production, this would:
  // 1. Send notifications to admin
  // 2. Create incident ticket
  // 3. Trigger auto-remediation if possible
  // 4. Log to monitoring dashboard

  console.log(`[Health Alert] App ${appId} is ${status}`, metrics)

  // Could integrate with:
  // - Slack notifications
  // - Email alerts
  // - PagerDuty
  // - Discord webhooks
}
