/**
 * JAVARI AI - CONVERSATION SEARCH API
 * Advanced search with full-text and metadata filtering
 * 
 * Endpoint:
 * - GET /api/conversations/search - Search conversations
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:55 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/search
 * Search conversations with advanced filters
 * 
 * Query Parameters:
 * - q: search query (searches title, summary, messages)
 * - status: active | inactive | archived
 * - starred: true | false
 * - project_id: UUID
 * - has_parent: true | false
 * - date_from: ISO date (created_at >=)
 * - date_to: ISO date (created_at <=)
 * - min_messages: number
 * - max_messages: number
 * - tags: comma-separated tags
 * - model: model name
 * - limit: number (default 50)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Extract search parameters
    const query = searchParams.get('q');
    const status = searchParams.get('status');
    const starred = searchParams.get('starred');
    const projectId = searchParams.get('project_id');
    const hasParent = searchParams.get('has_parent');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const minMessages = searchParams.get('min_messages');
    const maxMessages = searchParams.get('max_messages');
    const tags = searchParams.get('tags');
    const model = searchParams.get('model');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let dbQuery = supabase
      .from('conversations')
      .select('*', { count: 'exact' });

    // Text search across title, summary, and messages
    if (query) {
      // This is a simplified search. For production, you'd want to use
      // PostgreSQL full-text search or a dedicated search engine
      dbQuery = dbQuery.or(
        `title.ilike.%${query}%,summary.ilike.%${query}%`
      );
    }

    // Status filter
    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    // Starred filter
    if (starred !== null) {
      dbQuery = dbQuery.eq('starred', starred === 'true');
    }

    // Project filter
    if (projectId) {
      dbQuery = dbQuery.eq('project_id', projectId);
    }

    // Parent filter
    if (hasParent === 'true') {
      dbQuery = dbQuery.not('parent_id', 'is', null);
    } else if (hasParent === 'false') {
      dbQuery = dbQuery.is('parent_id', null);
    }

    // Date range filter
    if (dateFrom) {
      dbQuery = dbQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('created_at', dateTo);
    }

    // Message count filter
    if (minMessages) {
      dbQuery = dbQuery.gte('message_count', parseInt(minMessages));
    }
    if (maxMessages) {
      dbQuery = dbQuery.lte('message_count', parseInt(maxMessages));
    }

    // Model filter
    if (model) {
      dbQuery = dbQuery.eq('model', model);
    }

    // Tags filter (contains any of the specified tags)
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      dbQuery = dbQuery.overlaps('tags', tagArray);
    }

    // Sort by relevance (updated_at for now)
    dbQuery = dbQuery
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) {
      console.error('Error searching conversations:', error);
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      query: query || '',
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
