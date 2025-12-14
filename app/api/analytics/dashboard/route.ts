// app/api/analytics/dashboard/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - ANALYTICS DASHBOARD API
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 7:00 PM EST
// Version: 1.0 - REAL-TIME METRICS & INSIGHTS
//
// Provides:
// - Real-time usage statistics
// - AI provider performance metrics
// - Cost tracking and projections
// - User engagement analytics
// - System health monitoring
// - Historical trends
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

interface DashboardMetrics {
  overview: OverviewMetrics;
  usage: UsageMetrics;
  providers: ProviderMetrics[];
  costs: CostMetrics;
  health: HealthMetrics;
  trends: TrendData[];
  topUsers: UserMetrics[];
  recentActivity: ActivityItem[];
}

interface OverviewMetrics {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  activeUsers: number;
  avgResponseTime: number;
  successRate: number;
}

interface UsageMetrics {
  today: { conversations: number; messages: number; tokens: number };
  thisWeek: { conversations: number; messages: number; tokens: number };
  thisMonth: { conversations: number; messages: number; tokens: number };
}

interface ProviderMetrics {
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  avgLatency: number;
  successRate: number;
  cost: number;
}

interface CostMetrics {
  today: number;
  thisWeek: number;
  thisMonth: number;
  projected: number;
  byProvider: { provider: string; cost: number }[];
}

interface HealthMetrics {
  score: number;
  deployments: { healthy: number; failed: number; building: number };
  errors: { last24h: number; rate: number };
  healing: { attempts: number; success: number };
}

interface TrendData {
  date: string;
  conversations: number;
  tokens: number;
  cost: number;
}

interface UserMetrics {
  userId: string;
  conversations: number;
  messages: number;
  lastActive: string;
}

interface ActivityItem {
  type: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA FETCHERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  
  const [conversations, usageLogs, errorLogs] = await Promise.all([
    supabase.from('conversations').select('id, message_count').gte('created_at', today),
    supabase.from('usage_logs').select('tokens_used, response_time_ms, success').gte('created_at', today),
    supabase.from('error_logs').select('id').gte('created_at', today)
  ]);
  
  const usage = usageLogs.data || [];
  const totalRequests = usage.length;
  const successfulRequests = usage.filter(u => u.success !== false).length;
  
  return {
    totalConversations: conversations.data?.length || 0,
    totalMessages: conversations.data?.reduce((a, c) => a + (c.message_count || 0), 0) || 0,
    totalTokens: usage.reduce((a, u) => a + (u.tokens_used || 0), 0),
    activeUsers: new Set(conversations.data?.map(c => (c as any).user_id)).size,
    avgResponseTime: totalRequests > 0 
      ? Math.round(usage.reduce((a, u) => a + (u.response_time_ms || 0), 0) / totalRequests)
      : 0,
    successRate: totalRequests > 0 
      ? Math.round((successfulRequests / totalRequests) * 100)
      : 100
  };
}

async function getUsageMetrics(): Promise<UsageMetrics> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [todayData, weekData, monthData] = await Promise.all([
    supabase.from('usage_logs').select('tokens_used').gte('created_at', today.toISOString()),
    supabase.from('usage_logs').select('tokens_used').gte('created_at', weekAgo.toISOString()),
    supabase.from('usage_logs').select('tokens_used').gte('created_at', monthAgo.toISOString())
  ]);
  
  const [todayConvs, weekConvs, monthConvs] = await Promise.all([
    supabase.from('conversations').select('id, message_count').gte('created_at', today.toISOString()),
    supabase.from('conversations').select('id, message_count').gte('created_at', weekAgo.toISOString()),
    supabase.from('conversations').select('id, message_count').gte('created_at', monthAgo.toISOString())
  ]);
  
  return {
    today: {
      conversations: todayConvs.data?.length || 0,
      messages: todayConvs.data?.reduce((a, c) => a + (c.message_count || 0), 0) || 0,
      tokens: todayData.data?.reduce((a, u) => a + (u.tokens_used || 0), 0) || 0
    },
    thisWeek: {
      conversations: weekConvs.data?.length || 0,
      messages: weekConvs.data?.reduce((a, c) => a + (c.message_count || 0), 0) || 0,
      tokens: weekData.data?.reduce((a, u) => a + (u.tokens_used || 0), 0) || 0
    },
    thisMonth: {
      conversations: monthConvs.data?.length || 0,
      messages: monthConvs.data?.reduce((a, c) => a + (c.message_count || 0), 0) || 0,
      tokens: monthData.data?.reduce((a, u) => a + (u.tokens_used || 0), 0) || 0
    }
  };
}

async function getProviderMetrics(): Promise<ProviderMetrics[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('provider, model, tokens_used, response_time_ms, estimated_cost, success')
    .gte('created_at', weekAgo);
  
  if (!logs) return [];
  
  // Group by provider
  const grouped = new Map<string, any[]>();
  for (const log of logs) {
    const key = log.provider || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(log);
  }
  
  return Array.from(grouped.entries()).map(([provider, providerLogs]) => {
    const successful = providerLogs.filter(l => l.success !== false).length;
    return {
      provider,
      model: providerLogs[0]?.model || 'unknown',
      requests: providerLogs.length,
      tokens: providerLogs.reduce((a, l) => a + (l.tokens_used || 0), 0),
      avgLatency: Math.round(
        providerLogs.reduce((a, l) => a + (l.response_time_ms || 0), 0) / providerLogs.length
      ),
      successRate: Math.round((successful / providerLogs.length) * 100),
      cost: providerLogs.reduce((a, l) => a + (l.estimated_cost || 0), 0)
    };
  }).sort((a, b) => b.requests - a.requests);
}

async function getCostMetrics(): Promise<CostMetrics> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const { data: monthLogs } = await supabase
    .from('usage_logs')
    .select('provider, estimated_cost, created_at')
    .gte('created_at', monthAgo.toISOString());
  
  const logs = monthLogs || [];
  
  const todayCost = logs
    .filter(l => new Date(l.created_at) >= today)
    .reduce((a, l) => a + (l.estimated_cost || 0), 0);
  
  const weekCost = logs
    .filter(l => new Date(l.created_at) >= weekAgo)
    .reduce((a, l) => a + (l.estimated_cost || 0), 0);
  
  const monthCost = logs.reduce((a, l) => a + (l.estimated_cost || 0), 0);
  
  // Project monthly cost based on daily average
  const daysInMonth = 30;
  const daysPassed = Math.ceil((now.getTime() - monthAgo.getTime()) / (24 * 60 * 60 * 1000));
  const projected = (monthCost / daysPassed) * daysInMonth;
  
  // Group by provider
  const byProvider = new Map<string, number>();
  for (const log of logs) {
    const provider = log.provider || 'unknown';
    byProvider.set(provider, (byProvider.get(provider) || 0) + (log.estimated_cost || 0));
  }
  
  return {
    today: Math.round(todayCost * 100) / 100,
    thisWeek: Math.round(weekCost * 100) / 100,
    thisMonth: Math.round(monthCost * 100) / 100,
    projected: Math.round(projected * 100) / 100,
    byProvider: Array.from(byProvider.entries())
      .map(([provider, cost]) => ({ provider, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost)
  };
}

async function getHealthMetrics(): Promise<HealthMetrics> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const [errorLogs, usageLogs, healingLogs, vercelEvents] = await Promise.all([
    supabase.from('error_logs').select('id').gte('created_at', yesterday),
    supabase.from('usage_logs').select('id').gte('created_at', yesterday),
    supabase.from('healing_logs').select('status').gte('created_at', yesterday),
    supabase.from('vercel_events').select('status').gte('created_at', yesterday)
  ]);
  
  const totalRequests = usageLogs.data?.length || 1;
  const totalErrors = errorLogs.data?.length || 0;
  const errorRate = (totalErrors / totalRequests) * 100;
  
  const healing = healingLogs.data || [];
  const deployments = vercelEvents.data || [];
  
  // Calculate health score
  let score = 100;
  if (errorRate > 5) score -= 20;
  if (errorRate > 10) score -= 20;
  if (deployments.filter(d => d.status === 'error').length > 0) score -= 15;
  if (healing.filter(h => h.status === 'failed').length > healing.length * 0.5) score -= 10;
  
  return {
    score: Math.max(0, score),
    deployments: {
      healthy: deployments.filter(d => d.status === 'ready').length,
      failed: deployments.filter(d => d.status === 'error').length,
      building: deployments.filter(d => d.status === 'building').length
    },
    errors: {
      last24h: totalErrors,
      rate: Math.round(errorRate * 100) / 100
    },
    healing: {
      attempts: healing.length,
      success: healing.filter(h => h.status === 'healed').length
    }
  };
}

async function getTrends(days: number = 7): Promise<TrendData[]> {
  const trends: TrendData[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const [convs, usage] = await Promise.all([
      supabase.from('conversations')
        .select('id')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString()),
      supabase.from('usage_logs')
        .select('tokens_used, estimated_cost')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString())
    ]);
    
    trends.push({
      date: date.toISOString().split('T')[0],
      conversations: convs.data?.length || 0,
      tokens: usage.data?.reduce((a, u) => a + (u.tokens_used || 0), 0) || 0,
      cost: Math.round((usage.data?.reduce((a, u) => a + (u.estimated_cost || 0), 0) || 0) * 100) / 100
    });
  }
  
  return trends;
}

async function getTopUsers(limit: number = 10): Promise<UserMetrics[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: conversations } = await supabase
    .from('conversations')
    .select('user_id, message_count, updated_at')
    .gte('created_at', weekAgo)
    .not('user_id', 'is', null);
  
  if (!conversations) return [];
  
  // Group by user
  const userStats = new Map<string, { conversations: number; messages: number; lastActive: string }>();
  
  for (const conv of conversations) {
    const userId = (conv as any).user_id;
    if (!userId) continue;
    
    const current = userStats.get(userId) || { conversations: 0, messages: 0, lastActive: '' };
    current.conversations++;
    current.messages += conv.message_count || 0;
    if (!current.lastActive || conv.updated_at > current.lastActive) {
      current.lastActive = conv.updated_at;
    }
    userStats.set(userId, current);
  }
  
  return Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      ...stats
    }))
    .sort((a, b) => b.conversations - a.conversations)
    .slice(0, limit);
}

async function getRecentActivity(limit: number = 20): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];
  
  // Get recent conversations
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  for (const conv of convs || []) {
    activities.push({
      type: 'conversation',
      description: `New conversation: ${conv.title?.slice(0, 50) || 'Untitled'}`,
      timestamp: conv.created_at
    });
  }
  
  // Get recent deployments
  const { data: deployments } = await supabase
    .from('vercel_events')
    .select('project_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  for (const dep of deployments || []) {
    activities.push({
      type: 'deployment',
      description: `${dep.project_name}: ${dep.status}`,
      timestamp: dep.created_at
    });
  }
  
  // Get recent healing
  const { data: healing } = await supabase
    .from('healing_logs')
    .select('project, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  for (const heal of healing || []) {
    activities.push({
      type: 'healing',
      description: `Self-healing ${heal.project}: ${heal.status}`,
      timestamp: heal.created_at
    });
  }
  
  // Sort by timestamp and limit
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    
    // If specific section requested, return only that
    if (section) {
      let data: any;
      switch (section) {
        case 'overview': data = await getOverviewMetrics(); break;
        case 'usage': data = await getUsageMetrics(); break;
        case 'providers': data = await getProviderMetrics(); break;
        case 'costs': data = await getCostMetrics(); break;
        case 'health': data = await getHealthMetrics(); break;
        case 'trends': data = await getTrends(parseInt(searchParams.get('days') || '7')); break;
        case 'users': data = await getTopUsers(parseInt(searchParams.get('limit') || '10')); break;
        case 'activity': data = await getRecentActivity(parseInt(searchParams.get('limit') || '20')); break;
        default:
          return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        section,
        data,
        duration: Date.now() - startTime
      });
    }
    
    // Return full dashboard
    const [overview, usage, providers, costs, health, trends, topUsers, recentActivity] = await Promise.all([
      getOverviewMetrics(),
      getUsageMetrics(),
      getProviderMetrics(),
      getCostMetrics(),
      getHealthMetrics(),
      getTrends(7),
      getTopUsers(10),
      getRecentActivity(20)
    ]);
    
    const dashboard: DashboardMetrics = {
      overview,
      usage,
      providers,
      costs,
      health,
      trends,
      topUsers,
      recentActivity
    };
    
    return NextResponse.json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Handle custom analytics queries
  try {
    const body = await request.json();
    const { query, params } = body;
    
    // Simple query builder for custom analytics
    // This is limited for security - no raw SQL
    const allowedTables = ['usage_logs', 'conversations', 'error_logs', 'healing_logs'];
    
    if (!allowedTables.includes(query.table)) {
      return NextResponse.json({
        success: false,
        error: 'Table not allowed for analytics queries'
      }, { status: 400 });
    }
    
    let q = supabase.from(query.table).select(query.select || '*');
    
    if (params?.startDate) {
      q = q.gte('created_at', params.startDate);
    }
    if (params?.endDate) {
      q = q.lte('created_at', params.endDate);
    }
    if (params?.limit) {
      q = q.limit(params.limit);
    }
    
    const { data, error } = await q;
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
