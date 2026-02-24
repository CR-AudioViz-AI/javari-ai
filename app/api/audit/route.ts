// app/api/audit/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - AUDIT LOGGING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 8:40 PM EST
// Version: 1.0 - TRACK ALL SYSTEM ACTIONS
//
// Features:
// - Comprehensive action logging
// - Search and filter logs
// - Export capabilities
// - Security audit trail
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  outcome: 'success' | 'failure' | 'partial';
  duration?: number;
}

type AuditCategory = 
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'system_operation'
  | 'api_call'
  | 'deployment'
  | 'configuration'
  | 'security';

type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

interface AuditLogRequest {
  action: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  outcome?: 'success' | 'failure' | 'partial';
  duration?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY AUDIT LOG (fallback if database unavailable)
// ═══════════════════════════════════════════════════════════════════════════════

const inMemoryLogs: AuditLog[] = [];
const MAX_IN_MEMORY_LOGS = 1000;

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function createAuditLog(
  log: AuditLogRequest,
  request?: NextRequest
): Promise<AuditLog> {
  const auditLog: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    action: log.action,
    category: log.category,
    severity: log.severity || determineSeverity(log.action, log.category),
    userId: log.userId,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    details: log.details || {},
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown',
    outcome: log.outcome || 'success',
    duration: log.duration
  };
  
  // Try to save to database
  try {
    await supabase.from('audit_logs').insert({
      id: auditLog.id,
      action: auditLog.action,
      category: auditLog.category,
      severity: auditLog.severity,
      user_id: auditLog.userId,
      resource_type: auditLog.resourceType,
      resource_id: auditLog.resourceId,
      details: auditLog.details,
      ip_address: auditLog.ipAddress,
      user_agent: auditLog.userAgent,
      outcome: auditLog.outcome,
      duration_ms: auditLog.duration,
      created_at: auditLog.timestamp
    });
  } catch (error) {
    // Fallback to in-memory storage
    console.log('[Audit] Database unavailable, using in-memory storage');
    inMemoryLogs.unshift(auditLog);
    if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
      inMemoryLogs.pop();
    }
  }
  
  return auditLog;
}

function determineSeverity(action: string, category: AuditCategory): AuditSeverity {
  // Critical actions
  if (category === 'security') return 'critical';
  if (/delete|remove|destroy/i.test(action)) return 'high';
  if (/authentication|authorization/i.test(category)) return 'high';
  
  // High severity
  if (/deploy|update|modify|change/i.test(action)) return 'medium';
  if (category === 'data_modification') return 'medium';
  
  // Default
  return 'low';
}

async function queryAuditLogs(params: {
  category?: string;
  severity?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const {
    category,
    severity,
    userId,
    action,
    resourceType,
    startDate,
    endDate,
    outcome,
    limit = 50,
    offset = 0
  } = params;
  
  // Try database first
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });
    
    if (category) query = query.eq('category', category);
    if (severity) query = query.eq('severity', severity);
    if (userId) query = query.eq('user_id', userId);
    if (action) query = query.ilike('action', `%${action}%`);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (outcome) query = query.eq('outcome', outcome);
    
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return {
      logs: (data || []).map(row => ({
        id: row.id,
        timestamp: row.created_at,
        action: row.action,
        category: row.category,
        severity: row.severity,
        userId: row.user_id,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        details: row.details,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        outcome: row.outcome,
        duration: row.duration_ms
      })),
      total: count || 0
    };
  } catch (error) {
    // Fallback to in-memory
    let filtered = [...inMemoryLogs];
    
    if (category) filtered = filtered.filter(l => l.category === category);
    if (severity) filtered = filtered.filter(l => l.severity === severity);
    if (userId) filtered = filtered.filter(l => l.userId === userId);
    if (action) filtered = filtered.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
    if (resourceType) filtered = filtered.filter(l => l.resourceType === resourceType);
    if (startDate) filtered = filtered.filter(l => l.timestamp >= startDate);
    if (endDate) filtered = filtered.filter(l => l.timestamp <= endDate);
    if (outcome) filtered = filtered.filter(l => l.outcome === outcome);
    
    return {
      logs: filtered.slice(offset, offset + limit),
      total: filtered.length
    };
  }
}

async function getAuditStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byOutcome: Record<string, number>;
  recentActivity: { date: string; count: number }[];
}> {
  try {
    // Get counts
    const { count: total } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true });
    
    // Get recent logs for stats
    const { data: recentLogs } = await supabase
      .from('audit_logs')
      .select('category, severity, outcome, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    const logs = recentLogs || [];
    
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    
    for (const log of logs) {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;
      
      const date = log.created_at.split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    }
    
    const recentActivity = Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, count]) => ({ date, count }));
    
    return {
      total: total || inMemoryLogs.length,
      byCategory,
      bySeverity,
      byOutcome,
      recentActivity
    };
  } catch (error) {
    // Fallback stats from in-memory
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    
    for (const log of inMemoryLogs) {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;
    }
    
    return {
      total: inMemoryLogs.length,
      byCategory,
      bySeverity,
      byOutcome,
      recentActivity: []
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  // Get stats
  if (action === 'stats') {
    const stats = await getAuditStats();
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  }
  
  // Query logs
  const params = {
    category: searchParams.get('category') || undefined,
    severity: searchParams.get('severity') || undefined,
    userId: searchParams.get('userId') || undefined,
    action: searchParams.get('actionFilter') || undefined,
    resourceType: searchParams.get('resourceType') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    outcome: searchParams.get('outcome') || undefined,
    limit: parseInt(searchParams.get('limit') || '50'),
    offset: parseInt(searchParams.get('offset') || '0')
  };
  
  const { logs, total } = await queryAuditLogs(params);
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Audit Logging',
    version: '1.0',
    logs,
    pagination: {
      total,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + logs.length < total
    },
    filters: {
      category: params.category,
      severity: params.severity,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      dateRange: params.startDate || params.endDate ? {
        start: params.startDate,
        end: params.endDate
      } : undefined,
      outcome: params.outcome
    },
    categories: ['authentication', 'authorization', 'data_access', 'data_modification', 'system_operation', 'api_call', 'deployment', 'configuration', 'security'],
    severities: ['low', 'medium', 'high', 'critical'],
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, category, severity, userId, resourceType, resourceId, details, outcome, duration } = body;
    
    if (!action || !category) {
      return NextResponse.json({
        success: false,
        error: 'action and category are required'
      }, { status: 400 });
    }
    
    const validCategories = ['authentication', 'authorization', 'data_access', 'data_modification', 'system_operation', 'api_call', 'deployment', 'configuration', 'security'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      }, { status: 400 });
    }
    
    const auditLog = await createAuditLog({
      action,
      category,
      severity,
      userId,
      resourceType,
      resourceId,
      details,
      outcome,
      duration
    }, request);
    
    return NextResponse.json({
      success: true,
      log: auditLog
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
