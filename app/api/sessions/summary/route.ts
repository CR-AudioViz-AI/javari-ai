import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { ApiResponse } from '@/types/javari';

interface SessionSummaryData {
  session_id: string;
  conversation_id?: string;
  project_id?: string;
  project_name?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  is_active: boolean;
  files_created: number;
  files_modified: number;
  files_deleted: number;
  lines_added: number;
  lines_deleted: number;
  apis_created: number;
  tests_written: number;
  bugs_fixed: number;
  features_added: number;
  success_rate: number;
  issues_encountered: number;
  issues_resolved: number;
  messages_sent: number;
  tokens_used: number;
  cost_usd: number;
  model_used: string;
  ai_summary?: string;
  key_accomplishments?: string[];
  next_steps?: string[];
  blockers?: string[];
  recommendations?: string[];
}

/**
 * GET /api/sessions/summary
 * 
 * Retrieve session summaries with optional filters
 * 
 * Query Parameters:
 * - conversation_id: Filter by conversation
 * - project_id: Filter by project
 * - time_range: today, yesterday, week, month, all
 * - limit: Number of sessions to return (default: 10)
 */
export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    const conversation_id = searchParams.get('conversation_id');
    const project_id = searchParams.get('project_id');
    const time_range = searchParams.get('time_range') || 'today';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Calculate time range
    let startDate = new Date();
    switch (time_range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'all':
        startDate = new Date('2024-01-01'); // Set to beginning of time
        break;
    }

    // Query conversations
    let query = supabase
      .from('conversations')
      .select(`
        id,
        numeric_id,
        project_id,
        created_at,
        updated_at,
        messages,
        model,
        total_tokens,
        cost_usd,
        status
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (conversation_id) {
      query = query.eq('id', conversation_id);
    }

    if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to fetch conversations',
      }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json<ApiResponse<SessionSummaryData[]>>({
        success: true,
        data: [],
      });
    }

    // Get project names if needed
    const projectIds = [...new Set(conversations.filter(c => c.project_id).map(c => c.project_id))];
    const projectNames: { [key: string]: string } = {};
    
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
      
      if (projects) {
        projects.forEach(p => {
          projectNames[p.id] = p.name;
        });
      }
    }

    // Get work logs for each conversation to calculate metrics
    const conversationIds = conversations.map(c => c.id);
    const { data: workLogs } = await supabase
      .from('work_logs')
      .select('*')
      .in('conversation_id', conversationIds);

    // Build session summaries
    const sessions: SessionSummaryData[] = conversations.map(conv => {
      const logs = workLogs?.filter(l => l.conversation_id === conv.id) || [];
      
      // Calculate duration
      const startTime = new Date(conv.created_at);
      const endTime = conv.status === 'active' ? new Date() : new Date(conv.updated_at);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

      // Calculate metrics from work logs
      const metrics = {
        files_created: logs.filter(l => l.action_type === 'file_created').length,
        files_modified: logs.filter(l => l.action_type === 'file_modified').length,
        files_deleted: logs.filter(l => l.action_type === 'file_deleted').length,
        lines_added: logs.reduce((sum, l) => sum + (l.lines_added || 0), 0),
        lines_deleted: logs.reduce((sum, l) => sum + (l.lines_deleted || 0), 0),
        apis_created: logs.filter(l => l.action_type === 'api_created').length,
        tests_written: logs.filter(l => l.action_type === 'test_written').length,
        bugs_fixed: logs.filter(l => l.action_type === 'bug_fixed').length,
        features_added: logs.filter(l => l.category === 'feature').length,
      };

      // Calculate success metrics
      const totalActions = logs.length;
      const successfulActions = logs.filter(l => l.metadata?.success !== false).length;
      const success_rate = totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 100;

      const issues_encountered = logs.filter(l => l.impact_level === 'critical' || l.impact_level === 'major').length;
      const issues_resolved = logs.filter(l => l.action_type === 'bug_fixed' || l.action_type === 'issue_resolved').length;

      // Count messages
      const messages = Array.isArray(conv.messages) ? conv.messages : [];
      const messages_sent = messages.length;

      return {
        session_id: conv.id,
        conversation_id: conv.id,
        project_id: conv.project_id || undefined,
        project_name: conv.project_id ? (projectNames[conv.project_id] || 'Unknown') : undefined,
        started_at: conv.created_at,
        ended_at: conv.status === 'active' ? undefined : conv.updated_at,
        duration_minutes: durationMinutes,
        is_active: conv.status === 'active',
        ...metrics,
        success_rate,
        issues_encountered,
        issues_resolved,
        messages_sent,
        tokens_used: conv.total_tokens || 0,
        cost_usd: parseFloat(conv.cost_usd || '0'),
        model_used: conv.model || 'gpt-4',
        // AI insights would be stored in conversation metadata
        ai_summary: conv.metadata?.ai_summary,
        key_accomplishments: conv.metadata?.key_accomplishments,
        next_steps: conv.metadata?.next_steps,
        blockers: conv.metadata?.blockers,
        recommendations: conv.metadata?.recommendations,
      };
    });

    return NextResponse.json<ApiResponse<SessionSummaryData[]>>({
      success: true,
      data: sessions,
    });

  } catch (error) {
    console.error('Session summary error:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
