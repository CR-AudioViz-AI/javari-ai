// app/api/intelligence/proactive/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - PROACTIVE INTELLIGENCE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 11:50 AM EST
// Version: 1.0 - ANTICIPATE USER NEEDS
//
// Features:
// - Analyze user patterns and preferences
// - Detect potential issues before they occur
// - Suggest improvements proactively
// - Monitor platform health and alert
// - Generate daily/weekly insights
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

interface Suggestion {
  id: string;
  type: 'improvement' | 'warning' | 'opportunity' | 'insight' | 'action';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  reasoning: string;
  suggestedAction?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface UserPattern {
  userId: string;
  commonRequests: string[];
  preferredProvider: string;
  averageSessionLength: number;
  buildPreference: boolean;
  lastActive: string;
}

interface PlatformHealth {
  overallScore: number;
  deploymentHealth: number;
  apiResponseTime: number;
  errorRate: number;
  activeUsers: number;
  issues: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeUserPatterns(userId?: string): Promise<UserPattern[]> {
  const patterns: UserPattern[] = [];
  
  // Get recent conversations
  const query = supabase
    .from('conversations')
    .select('user_id, messages, model, provider, is_vip, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  
  if (userId) {
    query.eq('user_id', userId);
  }
  
  const { data: conversations } = await query;
  
  if (!conversations) return patterns;
  
  // Group by user
  const userConversations = new Map<string, any[]>();
  for (const conv of conversations) {
    const uid = conv.user_id || 'anonymous';
    if (!userConversations.has(uid)) {
      userConversations.set(uid, []);
    }
    userConversations.get(uid)!.push(conv);
  }
  
  // Analyze each user
  for (const [uid, convs] of userConversations) {
    // Extract common request types
    const requests: string[] = [];
    let buildCount = 0;
    const providers: string[] = [];
    
    for (const conv of convs) {
      if (conv.messages && Array.isArray(conv.messages)) {
        for (const msg of conv.messages) {
          if (msg.role === 'user') {
            const m = msg.content.toLowerCase();
            if (/build|create|make|code/i.test(m)) {
              buildCount++;
              if (/calculator/i.test(m)) requests.push('calculators');
              if (/dashboard/i.test(m)) requests.push('dashboards');
              if (/form/i.test(m)) requests.push('forms');
              if (/api/i.test(m)) requests.push('apis');
              if (/chart|graph/i.test(m)) requests.push('visualizations');
            }
          }
        }
      }
      if (conv.provider) providers.push(conv.provider);
    }
    
    patterns.push({
      userId: uid,
      commonRequests: [...new Set(requests)].slice(0, 5),
      preferredProvider: getMostCommon(providers) || 'claude',
      averageSessionLength: convs.reduce((a, c) => a + (c.messages?.length || 0), 0) / convs.length,
      buildPreference: buildCount > convs.length * 0.3,
      lastActive: convs[0]?.updated_at || new Date().toISOString()
    });
  }
  
  return patterns;
}

function getMostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxCount = 0;
  let maxItem = null;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }
  return maxItem;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM HEALTH MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

async function checkPlatformHealth(): Promise<PlatformHealth> {
  const issues: string[] = [];
  let deploymentHealth = 100;
  let apiResponseTime = 0;
  let errorRate = 0;
  let activeUsers = 0;
  
  // Check recent deployments
  try {
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?teamId=${process.env.VERCEL_TEAM_ID}&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const failed = data.deployments.filter((d: any) => d.state === 'ERROR').length;
      deploymentHealth = Math.round((1 - failed / 20) * 100);
      
      if (failed > 0) {
        issues.push(`${failed} failed deployments in last 20`);
      }
    }
  } catch {
    issues.push('Unable to check Vercel deployments');
    deploymentHealth = 50;
  }
  
  // Check error rate from logs
  const { data: errorLogs } = await supabase
    .from('error_logs')
    .select('id')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const { data: usageLogs } = await supabase
    .from('usage_logs')
    .select('id, response_time_ms')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const totalRequests = usageLogs?.length || 1;
  const totalErrors = errorLogs?.length || 0;
  errorRate = Math.round((totalErrors / totalRequests) * 100);
  
  if (errorRate > 5) {
    issues.push(`High error rate: ${errorRate}%`);
  }
  
  // Calculate average response time
  if (usageLogs && usageLogs.length > 0) {
    apiResponseTime = Math.round(
      usageLogs.reduce((a, l) => a + (l.response_time_ms || 0), 0) / usageLogs.length
    );
    
    if (apiResponseTime > 3000) {
      issues.push(`Slow API response time: ${apiResponseTime}ms avg`);
    }
  }
  
  // Count active users
  const { data: activeUserData } = await supabase
    .from('conversations')
    .select('user_id')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  activeUsers = new Set(activeUserData?.map(u => u.user_id)).size;
  
  // Calculate overall score
  const overallScore = Math.round(
    (deploymentHealth * 0.3) +
    ((100 - errorRate) * 0.3) +
    (Math.min(100, (5000 - apiResponseTime) / 50) * 0.2) +
    (Math.min(100, activeUsers * 10) * 0.2)
  );
  
  return {
    overallScore,
    deploymentHealth,
    apiResponseTime,
    errorRate,
    activeUsers,
    issues
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTION GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateSuggestions(
  patterns: UserPattern[],
  health: PlatformHealth
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const timestamp = new Date().toISOString();
  
  // Health-based suggestions
  if (health.deploymentHealth < 80) {
    suggestions.push({
      id: `sugg_${Date.now()}_deploy`,
      type: 'warning',
      priority: 'high',
      title: 'Deployment Issues Detected',
      description: `${100 - health.deploymentHealth}% of recent deployments have failed.`,
      reasoning: 'Multiple build failures indicate potential code or configuration issues.',
      suggestedAction: 'Run self-healing scan: POST /api/autonomous/heal',
      metadata: { deploymentHealth: health.deploymentHealth },
      createdAt: timestamp
    });
  }
  
  if (health.errorRate > 5) {
    suggestions.push({
      id: `sugg_${Date.now()}_errors`,
      type: 'warning',
      priority: health.errorRate > 10 ? 'critical' : 'high',
      title: 'High Error Rate',
      description: `Error rate is at ${health.errorRate}% over the last 24 hours.`,
      reasoning: 'Elevated error rates impact user experience and should be investigated.',
      suggestedAction: 'Review error logs and implement fixes',
      metadata: { errorRate: health.errorRate },
      createdAt: timestamp
    });
  }
  
  if (health.apiResponseTime > 2000) {
    suggestions.push({
      id: `sugg_${Date.now()}_perf`,
      type: 'improvement',
      priority: 'medium',
      title: 'API Performance Optimization',
      description: `Average API response time is ${health.apiResponseTime}ms.`,
      reasoning: 'Response times over 2 seconds can impact user satisfaction.',
      suggestedAction: 'Consider caching, query optimization, or CDN',
      metadata: { responseTime: health.apiResponseTime },
      createdAt: timestamp
    });
  }
  
  // Pattern-based suggestions
  const buildUsers = patterns.filter(p => p.buildPreference);
  if (buildUsers.length > patterns.length * 0.5) {
    suggestions.push({
      id: `sugg_${Date.now()}_templates`,
      type: 'opportunity',
      title: 'Create Code Templates',
      description: 'Most users prefer building code. Pre-built templates could speed up responses.',
      reasoning: `${buildUsers.length} users frequently request code generation.`,
      suggestedAction: 'Create component library for common patterns (calculators, dashboards, forms)',
      priority: 'medium',
      createdAt: timestamp
    });
  }
  
  // Inactive users
  const inactiveUsers = patterns.filter(p => {
    const lastActive = new Date(p.lastActive);
    const daysSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  });
  
  if (inactiveUsers.length > 0) {
    suggestions.push({
      id: `sugg_${Date.now()}_reengagement`,
      type: 'opportunity',
      title: 'User Re-engagement Opportunity',
      description: `${inactiveUsers.length} users haven't been active in over a week.`,
      reasoning: 'Re-engaging dormant users can increase retention.',
      suggestedAction: 'Consider email campaigns or new feature announcements',
      priority: 'low',
      metadata: { inactiveCount: inactiveUsers.length },
      createdAt: timestamp
    });
  }
  
  // Knowledge base suggestions
  const { data: lowConfidenceKnowledge } = await supabase
    .from('javari_knowledge')
    .select('topic, concept, confidence_score')
    .lt('confidence_score', 0.5)
    .limit(5);
  
  if (lowConfidenceKnowledge && lowConfidenceKnowledge.length > 0) {
    suggestions.push({
      id: `sugg_${Date.now()}_knowledge`,
      type: 'improvement',
      title: 'Knowledge Base Enhancement',
      description: `${lowConfidenceKnowledge.length} knowledge entries have low confidence scores.`,
      reasoning: 'Low confidence knowledge may lead to inaccurate responses.',
      suggestedAction: 'Review and validate knowledge entries',
      priority: 'medium',
      metadata: { entries: lowConfidenceKnowledge.map(k => k.topic) },
      createdAt: timestamp
    });
  }
  
  // Daily insight
  suggestions.push({
    id: `sugg_${Date.now()}_insight`,
    type: 'insight',
    title: 'Daily Platform Insight',
    description: `Platform health score: ${health.overallScore}/100. ${health.activeUsers} active users today.`,
    reasoning: 'Regular monitoring helps identify trends and opportunities.',
    priority: 'low',
    metadata: health,
    createdAt: timestamp
  });
  
  return suggestions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, includePatterns = true, includeHealth = true } = body;
    
    // Gather intelligence
    const [patterns, health] = await Promise.all([
      includePatterns ? analyzeUserPatterns(userId) : Promise.resolve([]),
      includeHealth ? checkPlatformHealth() : Promise.resolve({
        overallScore: 100,
        deploymentHealth: 100,
        apiResponseTime: 0,
        errorRate: 0,
        activeUsers: 0,
        issues: []
      })
    ]);
    
    // Generate suggestions
    const suggestions = await generateSuggestions(patterns, health);
    
    // Store suggestions for tracking
    if (suggestions.length > 0) {
      await supabase.from('proactive_suggestions').insert(
        suggestions.map(s => ({
          suggestion_id: s.id,
          type: s.type,
          priority: s.priority,
          title: s.title,
          description: s.description,
          metadata: s.metadata,
          created_at: s.createdAt
        }))
      ).catch(() => {}); // Non-blocking
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      health,
      patterns: includePatterns ? patterns.slice(0, 10) : undefined,
      suggestions,
      summary: {
        totalSuggestions: suggestions.length,
        critical: suggestions.filter(s => s.priority === 'critical').length,
        high: suggestions.filter(s => s.priority === 'high').length,
        medium: suggestions.filter(s => s.priority === 'medium').length,
        low: suggestions.filter(s => s.priority === 'low').length
      }
    });
    
  } catch (error) {
    console.error('[Proactive] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Quick health check and summary
  const health = await checkPlatformHealth();
  
  // Get recent suggestions
  const { data: recentSuggestions } = await supabase
    .from('proactive_suggestions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Proactive Intelligence',
    version: '1.0',
    health,
    recentSuggestions: recentSuggestions || [],
    capabilities: [
      'User pattern analysis',
      'Platform health monitoring',
      'Proactive suggestion generation',
      'Issue detection and alerting',
      'Opportunity identification'
    ],
    usage: {
      method: 'POST',
      body: {
        userId: 'optional - analyze specific user',
        includePatterns: 'boolean - include pattern analysis',
        includeHealth: 'boolean - include health check'
      }
    },
    timestamp: new Date().toISOString()
  });
}
