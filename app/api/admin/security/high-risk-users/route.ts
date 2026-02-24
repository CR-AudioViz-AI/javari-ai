/**
 * JAVARI AI - HIGH RISK USERS API
 * View users with multiple violations or suspensions
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:22 PM EST
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
    
    // Query from materialized view if available, otherwise from user_profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, username, violation_count, suspended, suspension_reason, suspended_at')
      .or('violation_count.gte.3,suspended.eq.true')
      .order('violation_count', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch high risk users' }, { status: 500 });
    }

    return NextResponse.json({
      users: data || [],
      count: data?.length || 0
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
