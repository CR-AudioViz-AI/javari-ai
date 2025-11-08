import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, toString, toBoolean, isArray, safeGet } from '@/lib/typescript-helpers';

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

interface ConversationRecord {
  id: string;
  numeric_id?: number;
  title: string;
  summary?: string;
  status: string;
  starred: boolean;
  model: string;
  message_count: number;
  continuation_depth: number;
  project_id?: string;
  parent_id?: string;
  tags?: string[];
  total_tokens?: number;
  cost_usd?: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  messages?: any;
  [key: string]: any;
}

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
  return await safeAsync(
    async () => {
      const supabase = createClient();
      const { searchParams } = new URL(request.url);

      // Extract parameters with type safety
      const format = toString(searchParams.get('format'), 'json');
      const status = searchParams.get('status');
      const starred = searchParams.get('starred');
      const projectId = searchParams.get('project_id');
      const dateFrom = searchParams.get('date_from');
      const dateTo = searchParams.get('date_to');
      const includeMessages = toBoolean(searchParams.get('include_messages'), false);

      // Build query
      let query = supabase.from('conversations').select('*');

      // Apply filters
      if (isDefined(status)) {
        query = query.eq('status', status);
      }
      if (isDefined(starred)) {
        query = query.eq('starred', toBoolean(starred, false));
      }
      if (isDefined(projectId)) {
        query = query.eq('project_id', projectId);
      }
      if (isDefined(dateFrom)) {
        query = query.gte('created_at', dateFrom);
      }
      if (isDefined(dateTo)) {
        query = query.lte('created_at', dateTo);
      }

      // Sort by created date
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        handleError(error, { file: 'conversations/export/route.ts', function: 'GET' });
        return NextResponse.json(
          { error: 'Export failed', details: getErrorMessage(error) },
          { status: 500 }
        );
      }

      const conversations = isArray<ConversationRecord>(data) ? data : [];

      if (conversations.length === 0) {
        return NextResponse.json(
          { error: 'No conversations found to export' },
          { status: 404 }
        );
      }

      // Format data based on requested format
      if (format === 'csv') {
        const csv = convertToCSV(conversations, includeMessages);
        const filename = `javari-conversations-${new Date().toISOString().split('T')[0]}.csv`;
        
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      } else {
        // JSON format
        const exportData = includeMessages ? conversations : conversations.map(conv => {
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
    },
    { file: 'conversations/export/route.ts', function: 'GET' },
    NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { error: 'Unexpected error' },
    { status: 500 }
  );
}

/**
 * Convert conversations to CSV format
 */
function convertToCSV(conversations: ConversationRecord[], includeMessages: boolean): string {
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
      toString(conv.id, ''),
      toString(conv.numeric_id, ''),
      escapeCSV(toString(conv.title, '')),
      escapeCSV(toString(conv.summary, '')),
      toString(conv.status, ''),
      toString(conv.starred, ''),
      toString(conv.model, ''),
      toString(conv.message_count, ''),
      toString(conv.continuation_depth, ''),
      toString(conv.project_id, ''),
      toString(conv.parent_id, ''),
      isArray(conv.tags) ? conv.tags.join(';') : '',
      toString(conv.total_tokens, '0'),
      toString(conv.cost_usd, '0'),
      toString(conv.created_at, ''),
      toString(conv.updated_at, ''),
      toString(conv.last_message_at, ''),
    ];

    if (includeMessages) {
      const messages = conv.messages || [];
      row.push(escapeCSV(JSON.stringify(messages)));
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
  const str = toString(value, '');
  
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}
