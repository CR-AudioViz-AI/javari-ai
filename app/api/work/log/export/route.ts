import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const action_type = searchParams.get('action_type');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit') || '1000';

    // Build query
    let query = supabase
      .from('javari_chat_work_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (action_type && action_type !== 'all') {
      query = query.eq('action_type', action_type);
    }

    if (category && category !== 'all') {
      query = query.eq('action_category', category);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'ID',
        'Numeric ID',
        'Conversation ID',
        'Action Type',
        'Category',
        'Description',
        'Impact Level',
        'Files Affected',
        'Lines Added',
        'Lines Deleted',
        'Tests Added',
        'Breaking Change',
        'Created At',
      ];

      const rows = logs.map((log: any) => [
        log.id,
        log.numeric_id || '',
        log.chat_session_id || '',
        log.action_type,
        log.action_category,
        `"${log.description.replace(/"/g, '""')}"`,
        log.impact_level,
        log.files_affected?.length || 0,
        log.lines_added || 0,
        log.lines_deleted || 0,
        log.tests_added ? 'Yes' : 'No',
        log.breaking_change ? 'Yes' : 'No',
        log.created_at,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="work-logs-${Date.now()}.csv"`,
        },
      });
    } else {
      // Return JSON
      return new NextResponse(JSON.stringify(logs, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="work-logs-${Date.now()}.json"`,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
