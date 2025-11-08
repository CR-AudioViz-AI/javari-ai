import { getErrorMessage, logError } from '@/lib/utils/error-utils';
/**
 * JAVARI AI - CONVERSATION EXPORT API
 * Export conversations in CSV or JSON format
 * 
 * Endpoint:
 * - GET /api/conversations/export - Export conversations
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:56 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/export
 * Export conversations in CSV or JSON format
 * 
 * Query Parameters:
 * - format: csv | json (default: json)
 * - status: active | inactive | archived (filter)
 * - starred: true | false (filter)
 * - project_id: UUID (filter)
 * - date_from: ISO date (filter)
 * - date_to: ISO date (filter)
 * - include_messages: true | false (default: false for CSV, true for JSON)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const format = searchParams.get('format') || 'json';
    const status = searchParams.get('status');
    const starred = searchParams.get('starred');
    const projectId = searchParams.get('project_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const includeMessages = searchParams.get('include_messages') === 'true';

    // Build query
    let query = supabase.from('conversations').select('*');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (starred !== null) {
      query = query.eq('starred', starred === 'true');
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Sort by created date
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error exporting conversations:', error);
      return NextResponse.json(
        { error: 'Export failed', details: getErrorMessage(error) },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No conversations found to export' },
        { status: 404 }
      );
    }

    // Format data based on requested format
    if (format === 'csv') {
      const csv = convertToCSV(data, includeMessages);
      const filename = `javari-conversations-${new Date().toISOString().split('T')[0]}.csv`;
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      // JSON format
      const exportData = includeMessages ? data : data.map(conv => {
        const { messages, ...rest } = conv;
        return rest;
      });

      const filename = `javari-conversations-${new Date().toISOString().split('T')[0]}.json`;
      
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error: unknown) {
    console.error('Export API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * Convert conversations to CSV format
 */
function convertToCSV(conversations: any[], includeMessages: boolean): string {
  const headers = [
    'ID',
    'Numeric ID',
    'Title',
    'Summary',
    'Status',
    'Starred',
    'Model',
    'Message Count',
    'Continuation Depth',
    'Project ID',
    'Parent ID',
    'Tags',
    'Total Tokens',
    'Cost (USD)',
    'Created At',
    'Updated At',
    'Last Message At',
  ];

  if (includeMessages) {
    headers.push('Messages');
  }

  const rows = conversations.map(conv => {
    const row = [
      conv.id,
      conv.numeric_id,
      escapeCSV(conv.title),
      escapeCSV(conv.summary || ''),
      conv.status,
      conv.starred,
      conv.model,
      conv.message_count,
      conv.continuation_depth,
      conv.project_id || '',
      conv.parent_id || '',
      Array.isArray(conv.tags) ? conv.tags.join(';') : '',
      conv.total_tokens || 0,
      conv.cost_usd || 0,
      conv.created_at,
      conv.updated_at,
      conv.last_message_at || '',
    ];

    if (includeMessages) {
      row.push(escapeCSV(JSON.stringify(conv.messages || [])));
    }

    return row;
  });

  // Combine headers and rows
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ];

  return csvRows.join('\n');
}

/**
 * Escape special characters for CSV
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}
