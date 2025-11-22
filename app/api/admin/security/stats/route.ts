/**
 * JAVARI AI - SECURITY STATS API
 * Real-time security statistics for dashboard
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:19 PM EST
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { requireOwner } from '@/lib/security/javari-security';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireOwner(user.id);

    const supabase = createClient();

    // Get total violations
    const { count: totalViolations } = await supabase
      .from('security_audit_log')
      .select('*', { count: 'exact', head: true });

    // Get violations blocked today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: blockedToday } = await supabase
      .from('security_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('blocked', true)
      .gte('created_at', today.toISOString());

    // Get suspended users count
    const { count: suspendedUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('suspended', true);

    // Get unacknowledged alerts count
    const { count: unacknowledgedAlerts } = await supabase
      .from('security_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('acknowledged', false);

    return NextResponse.json({
      totalViolations: totalViolations || 0,
      blockedToday: blockedToday || 0,
      suspendedUsers: suspendedUsers || 0,
      unacknowledgedAlerts: unacknowledgedAlerts || 0
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
