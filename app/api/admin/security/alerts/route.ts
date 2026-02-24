/**
 * JAVARI AI - SECURITY ALERTS API
 * Manage security alerts for Roy
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:20 PM EST
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const acknowledged = searchParams.get('acknowledged');

    const supabase = createClient();
    let query = supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (acknowledged !== null) {
      query = query.eq('acknowledged', acknowledged === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    return NextResponse.json({
      alerts: data || [],
      count: data?.length || 0
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
