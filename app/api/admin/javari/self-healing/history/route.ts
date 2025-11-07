/**
 * Javari AI - Self-Healing History API
 * Returns detailed healing event history and statistics
 * 
 * Created: November 4, 2025 - 7:45 PM EST
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get healing history
    const { data: events, error } = await supabase
      .from('javari_healing_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Calculate stats
    const total = events?.length || 0;
    const attempted = events?.filter(e => e.fix_applied).length || 0;
    const successful = events?.filter(e => e.fix_applied && e.fix_result?.success).length || 0;
    const failed = attempted - successful;
    const escalated = events?.filter(e => e.escalated).length || 0;

    return NextResponse.json({
      success: true,
      history: events?.map(event => ({
        id: event.id,
        errorType: event.error_type,
        errorMessage: event.error_message,
        diagnosis: event.diagnosis,
        fixApplied: event.fix_applied,
        fixResult: event.fix_result,
        autoFixed: event.auto_fixed,
        escalated: event.escalated,
        createdAt: event.created_at
      })) || [],
      stats: {
        total,
        attempted,
        successful,
        failed,
        escalated,
        successRate: attempted > 0 ? (successful / attempted) * 100 : 0
      }
    });
  } catch (error: unknown) {
    logError(\'Error fetching healing history:\', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch healing history' },
      { status: 500 }
    );
  }
}
