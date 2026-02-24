/**
 * JAVARI AI - ACKNOWLEDGE ALERTS API
 * Mark security alerts as acknowledged
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:21 PM EST
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { requireOwner } from '@/lib/security/javari-security';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireOwner(user.id);

    const { alertId } = await request.json();

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID required' }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('security_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      return NextResponse.json({ error: 'Failed to acknowledge alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
