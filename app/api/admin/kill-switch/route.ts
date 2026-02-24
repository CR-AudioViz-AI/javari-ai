/**
 * HENDERSON OVERRIDE PROTOCOL - Kill Switch API
 * 
 * Critical Safety System - Roy-Only Access
 * Phrase: "HENDERSON OVERRIDE PROTOCOL"
 * 
 * This API endpoint allows Roy to activate/deactivate the platform kill switch.
 * When active, all non-Roy requests are blocked at the middleware level.
 * 
 * FIXED: Uses service role key for database access
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const KILL_SWITCH_PHRASE = 'HENDERSON OVERRIDE PROTOCOL';
const ROY_EMAIL = 'royhenderson@craudiovizai.com';

// Create admin client with service role key
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface KillSwitchRequest {
  action: 'activate' | 'deactivate' | 'status';
  phrase?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    
    // Check for admin key authentication (for automation)
    const adminKey = request.headers.get('x-admin-key');
    const validAdminKey = process.env.X_ADMIN_KEY || '672e6bb2e8bf45da97faa15c55cf1f1656fd8a5fbebe4e7c8c19852fa7760915';
    
    let isRoy = false;
    let userEmail = 'system';
    let userId = 'system';
    
    if (adminKey === validAdminKey) {
      // Admin key authentication - allow as Roy
      isRoy = true;
      userEmail = ROY_EMAIL;
    } else {
      // Try Supabase auth
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (user && !error) {
          isRoy = user.email === ROY_EMAIL;
          userEmail = user.email || 'unknown';
          userId = user.id;
        }
      }
    }
    
    if (!isRoy) {
      // Log unauthorized attempt
      await supabase.from('kill_switch_log').insert({
        action: 'unauthorized_attempt',
        user_email: userEmail,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        reason: 'Non-Roy user attempted kill switch access'
      });
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body: KillSwitchRequest = await request.json();
    const { action, phrase, reason } = body;
    
    // Handle status check
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
        henderson_override: settings?.henderson_override_active ? 'active' : 'inactive',
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
          user_email: userEmail,
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
      const { error: activateError } = await supabase
        .from('javari_settings')
        .update({
          kill_switch_active: true,
          kill_switch_activated_at: new Date().toISOString(),
          kill_switch_activated_by: userEmail,
          kill_switch_reason: reason,
          henderson_override_active: true,
          henderson_override_activated_at: new Date().toISOString(),
          henderson_override_activated_by: userEmail,
          henderson_override_reason: reason,
          updated_at: new Date().toISOString()
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows
        
      if (activateError) {
        console.error('Kill switch activation error:', activateError);
        return NextResponse.json(
          { error: 'Failed to activate kill switch', details: activateError.message },
          { status: 500 }
        );
      }
      
      // Log the activation
      await supabase.from('kill_switch_log').insert({
        action: 'activated',
        user_email: userEmail,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        reason: reason
      });
      
      return NextResponse.json({
        success: true,
        message: 'Henderson Override Protocol ACTIVATED',
        status: 'active',
        reason: reason,
        activated_by: userEmail,
        activated_at: new Date().toISOString()
      });
    }
    
    if (action === 'deactivate') {
      // DEACTIVATE KILL SWITCH
      const { error: deactivateError } = await supabase
        .from('javari_settings')
        .update({
          kill_switch_active: false,
          henderson_override_active: false,
          updated_at: new Date().toISOString()
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
      if (deactivateError) {
        console.error('Kill switch deactivation error:', deactivateError);
        return NextResponse.json(
          { error: 'Failed to deactivate kill switch', details: deactivateError.message },
          { status: 500 }
        );
      }
      
      // Log the deactivation
      await supabase.from('kill_switch_log').insert({
        action: 'deactivated',
        user_email: userEmail,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        reason: reason || 'Platform restored to normal operation'
      });
      
      return NextResponse.json({
        success: true,
        message: 'Henderson Override Protocol DEACTIVATED',
        status: 'inactive',
        deactivated_by: userEmail,
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
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET endpoint for status checks - uses service role to bypass RLS
export async function GET() {
  try {
    const supabase = createAdminClient();
    
    const { data: settings, error } = await supabase
      .from('javari_settings')
      .select('kill_switch_active, henderson_override_active, kill_switch_activated_at, kill_switch_activated_by, kill_switch_reason')
      .single();
    
    if (error) {
      console.error('Kill switch status error:', error);
      return NextResponse.json({
        status: 'unknown',
        error: error.message
      });
    }
      
    return NextResponse.json({
      status: settings?.kill_switch_active ? 'active' : 'inactive',
      henderson_override: settings?.henderson_override_active ? 'active' : 'inactive',
      last_activated: settings?.kill_switch_activated_at,
      last_activated_by: settings?.kill_switch_activated_by,
      activation_reason: settings?.kill_switch_reason
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Failed to check kill switch status' },
      { status: 500 }
    );
  }
}
