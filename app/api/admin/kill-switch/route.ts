// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KILL SWITCH API ENDPOINT
// Roy-only endpoint to activate/deactivate emergency kill switch
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const KILL_SWITCH_PHRASE = 'HENDERSON OVERRIDE PROTOCOL'
const ROY_EMAIL = 'royhenderson@craudiovizai.com'

// POST /api/admin/kill-switch
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Verify this is Roy
    if (user.email !== ROY_EMAIL) {
      // Log unauthorized attempt
      await supabase.from('roy_auth_log').insert({
        action: 'kill_switch_unauthorized_attempt',
        auth_method: 'session',
        success: false,
        failure_reason: `Non-Roy user attempted kill switch: ${user.email}`,
      })

      return NextResponse.json(
        { error: 'Access denied - Roy only' },
        { status: 403 }
      )
    }

    // 3. Parse request
    const body = await request.json()
    const { action, phrase, reason } = body

    // 4. Validate kill switch phrase for activation
    if (action === 'activate' && phrase !== KILL_SWITCH_PHRASE) {
      await supabase.from('roy_auth_log').insert({
        action: 'kill_switch_activate',
        auth_method: 'phrase',
        success: false,
        failure_reason: 'Incorrect kill switch phrase',
      })

      return NextResponse.json(
        { error: 'Invalid kill switch phrase' },
        { status: 400 }
      )
    }

    // 5. Get current kill switch state
    const { data: currentState } = await supabase
      .from('kill_switch_state')
      .select('*')
      .single()

    // 6. Execute action
    if (action === 'activate') {
      if (currentState?.is_active) {
        return NextResponse.json({
          message: 'Kill switch already active',
          state: currentState,
        })
      }

      // ACTIVATE KILL SWITCH
      const { data: newState, error: updateError } = await supabase
        .from('kill_switch_state')
        .update({
          is_active: true,
          activated_at: new Date().toISOString(),
          activated_by: user.id,
          reason: reason || 'Emergency activation',
          kill_phrase_used: phrase,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentState!.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Log successful activation
      await supabase.from('roy_auth_log').insert({
        action: 'kill_switch_activate',
        auth_method: 'phrase',
        success: true,
      })

      console.log('🚨 KILL SWITCH ACTIVATED 🚨')
      console.log('Reason:', reason)
      console.log('All non-Roy requests will be blocked')

      return NextResponse.json({
        success: true,
        message: 'Kill switch activated - platform protected',
        state: newState,
        info: {
          activated_at: newState.activated_at,
          reason: newState.reason,
          status: 'All non-Roy requests are now blocked',
        },
      })

    } else if (action === 'deactivate') {
      if (!currentState?.is_active) {
        return NextResponse.json({
          message: 'Kill switch already inactive',
          state: currentState,
        })
      }

      // DEACTIVATE KILL SWITCH
      const { data: newState, error: updateError } = await supabase
        .from('kill_switch_state')
        .update({
          is_active: false,
          reactivated_at: new Date().toISOString(),
          reactivated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentState!.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Log successful deactivation
      await supabase.from('roy_auth_log').insert({
        action: 'kill_switch_deactivate',
        auth_method: 'session',
        success: true,
      })

      console.log('✅ KILL SWITCH DEACTIVATED')
      console.log('Platform restored to normal operation')

      return NextResponse.json({
        success: true,
        message: 'Kill switch deactivated - platform restored',
        state: newState,
        info: {
          was_active_for: calculateDowntime(currentState.activated_at!, new Date().toISOString()),
          reactivated_at: newState.reactivated_at,
          status: 'Normal operations resumed',
        },
      })

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "activate" or "deactivate"' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Kill switch API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/admin/kill-switch - Check status
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || user.email !== ROY_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current state
    const { data: state, error } = await supabase
      .from('kill_switch_state')
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      is_active: state.is_active,
      activated_at: state.activated_at,
      reason: state.reason,
      reactivated_at: state.reactivated_at,
    })

  } catch (error) {
    console.error('Kill switch status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateDowntime(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  return `${minutes}m`
}
