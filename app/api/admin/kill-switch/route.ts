/**
 * HENDERSON OVERRIDE PROTOCOL - Kill Switch API
 * 
 * Critical Safety System - Roy-Only Access
 * Phrase: "HENDERSON OVERRIDE PROTOCOL"
 * 
 * This API endpoint allows Roy to activate/deactivate the platform kill switch.
 * When active, all non-Roy requests are blocked at the middleware level.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KILL_SWITCH_PHRASE = 'HENDERSON OVERRIDE PROTOCOL';
const ROY_EMAIL = 'royhenderson@craudiovizai.com';

interface KillSwitchRequest {
  action: 'activate' | 'deactivate' | 'status';
  phrase?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify Roy's authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // CRITICAL: Only Roy can use this endpoint
    if (user.email !== ROY_EMAIL) {
      // Log unauthorized attempt
      await supabase.from('kill_switch_log').insert({
        action: 'unauthorized_attempt',
        user_id: user.id,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        reason: 'Non-Roy user attempted kill switch access'
      });
      
      return NextResponse.json(
        { error: 'Unauthorized. This endpoint is Roy-only.' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body: KillSwitchRequest = await request.json();
    const { action, phrase, reason } = body;
    
    // Handle status check (doesn't require phrase)
    if (action === 'status') {
      const { data: settings } = await supabase
        .from('javari_settings')
        .select('*')
        .single();
        
      const { data: logs } = await supabase
        .from('kill_switch_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
      return NextResponse.json({
        status: settings?.kill_switch_active ? 'active' : 'inactive',
        last_activated: settings?.kill_switch_activated_at,
        last_activated_by: settings?.kill_switch_activated_by,
        activation_reason: settings?.kill_switch_reason,
        recent_logs: logs
      });
    }
    
    // For activate/deactivate, verify the Henderson Override Protocol phrase
    if (action === 'activate') {
      if (phrase !== KILL_SWITCH_PHRASE) {
        await supabase.from('kill_switch_log').insert({
          action: 'invalid_phrase',
          user_id: user.id,
          user_email: user.email,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          reason: 'Invalid kill switch phrase provided'
        });
        
        return NextResponse.json(
          { error: 'Invalid kill switch phrase' },
          { status: 400 }
        );
      }
      
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Activation reason is required' },
          { status: 400 }
        );
      }
      
      // ACTIVATE KILL SWITCH
      const { data: result, error: activateError } = await supabase
        .rpc('activate_kill_switch', {
          p_reason: reason,
          p_activated_by: user.email
        });
        
      if (activateError) {
        console.error('Kill switch activation error:', activateError);
        return NextResponse.json(
          { error: 'Failed to activate kill switch' },
          { status: 500 }
        );
      }
      
      // Log the activation
      await supabase.from('kill_switch_log').insert({
        action: 'activated',
        user_id: user.id,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        reason: reason
      });
      
      return NextResponse.json({
        success: true,
        message: 'Henderson Override Protocol ACTIVATED',
        status: 'active',
        reason: reason,
        activated_by: user.email,
        activated_at: new Date().toISOString()
      });
    }
    
    if (action === 'deactivate') {
      // DEACTIVATE KILL SWITCH
      const { data: result, error: deactivateError } = await supabase
        .rpc('deactivate_kill_switch');
        
      if (deactivateError) {
        console.error('Kill switch deactivation error:', deactivateError);
        return NextResponse.json(
          { error: 'Failed to deactivate kill switch' },
          { status: 500 }
        );
      }
      
      // Log the deactivation
      await supabase.from('kill_switch_log').insert({
        action: 'deactivated',
        user_id: user.id,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        reason: reason || 'Platform restored to normal operation'
      });
      
      return NextResponse.json({
        success: true,
        message: 'Henderson Override Protocol DEACTIVATED',
        status: 'inactive',
        deactivated_by: user.email,
        deactivated_at: new Date().toISOString()
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use: activate, deactivate, or status' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Kill switch endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for status checks (doesn't require phrase)
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: settings } = await supabase
      .from('javari_settings')
      .select('kill_switch_active, kill_switch_activated_at, kill_switch_activated_by, kill_switch_reason')
      .single();
      
    return NextResponse.json({
      status: settings?.kill_switch_active ? 'active' : 'inactive',
      last_activated: settings?.kill_switch_activated_at,
      last_activated_by: settings?.kill_switch_activated_by,
      activation_reason: settings?.kill_switch_reason
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check kill switch status' },
      { status: 500 }
    );
  }
}
