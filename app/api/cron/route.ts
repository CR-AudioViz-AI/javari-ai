// app/api/cron/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - CRON SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 12:18 PM EST
// Version: 1.0 - SCHEDULED AUTONOMOUS OPERATIONS
//
// Scheduled Jobs:
// - Self-healing scan (every 15 minutes)
// - Proactive intelligence (every hour)
// - Knowledge consolidation (every 6 hours)
// - Health report (daily)
// - Learning optimization (weekly)
//
// Trigger via Vercel Cron or external scheduler
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

interface CronJob {
  name: string;
  description: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  enabled: boolean;
  handler: () => Promise<CronResult>;
}

interface CronResult {
  success: boolean;
  jobName: string;
  message: string;
  details?: any;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function runSelfHealingScan(): Promise<CronResult> {
  const startTime = Date.now();
  
  try {
    // Call the self-healing endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/autonomous/heal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto' })
      }
    );
    
    const result = await response.json();
    
    return {
      success: result.success,
      jobName: 'self-healing-scan',
      message: `Scanned ${result.summary?.total || 0} deployments, healed ${result.summary?.healed || 0}`,
      details: result.summary,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      jobName: 'self-healing-scan',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

async function runProactiveIntelligence(): Promise<CronResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/intelligence/proactive`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includePatterns: true, includeHealth: true })
      }
    );
    
    const result = await response.json();
    
    return {
      success: result.success,
      jobName: 'proactive-intelligence',
      message: `Generated ${result.summary?.totalSuggestions || 0} suggestions, health score: ${result.health?.overallScore || 'N/A'}`,
      details: result.summary,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      jobName: 'proactive-intelligence',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

async function runKnowledgeConsolidation(): Promise<CronResult> {
  const startTime = Date.now();
  
  try {
    // Get low-confidence knowledge entries
    const { data: lowConfidence } = await supabase
      .from('javari_knowledge')
      .select('id, topic, concept, confidence_score, times_referenced')
      .lt('confidence_score', 0.5)
      .order('times_referenced', { ascending: false })
      .limit(10);
    
    // Get duplicate or similar entries
    const { data: allKnowledge } = await supabase
      .from('javari_knowledge')
      .select('id, topic, concept')
      .order('created_at', { ascending: false })
      .limit(100);
    
    // Identify entries that haven't been used
    const { data: unusedEntries } = await supabase
      .from('javari_knowledge')
      .select('id, topic')
      .is('last_used_at', null)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20);
    
    // Log consolidation opportunity
    await supabase.from('proactive_suggestions').insert({
      suggestion_id: `sugg_knowledge_${Date.now()}`,
      type: 'improvement',
      priority: 'low',
      title: 'Knowledge Base Consolidation',
      description: `Found ${lowConfidence?.length || 0} low-confidence entries, ${unusedEntries?.length || 0} unused entries`,
      metadata: {
        lowConfidenceCount: lowConfidence?.length || 0,
        unusedCount: unusedEntries?.length || 0,
        totalEntries: allKnowledge?.length || 0
      },
      created_at: new Date().toISOString()
    });
    
    return {
      success: true,
      jobName: 'knowledge-consolidation',
      message: `Analyzed knowledge base: ${lowConfidence?.length || 0} low-confidence, ${unusedEntries?.length || 0} unused`,
      details: {
        lowConfidenceCount: lowConfidence?.length || 0,
        unusedCount: unusedEntries?.length || 0
      },
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      jobName: 'knowledge-consolidation',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

async function runDailyHealthReport(): Promise<CronResult> {
  const startTime = Date.now();
  
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Gather metrics
    const [
      { data: conversations },
      { data: usageLogs },
      { data: errorLogs },
      { data: healingLogs }
    ] = await Promise.all([
      supabase.from('conversations').select('id').gte('created_at', yesterday),
      supabase.from('usage_logs').select('tokens_used, estimated_cost, response_time_ms').gte('created_at', yesterday),
      supabase.from('error_logs').select('id').gte('created_at', yesterday),
      supabase.from('healing_logs').select('status').gte('created_at', yesterday)
    ]);
    
    const report = {
      date: new Date().toISOString().split('T')[0],
      conversations: conversations?.length || 0,
      totalRequests: usageLogs?.length || 0,
      totalTokens: usageLogs?.reduce((a, l) => a + (l.tokens_used || 0), 0) || 0,
      totalCost: usageLogs?.reduce((a, l) => a + (l.estimated_cost || 0), 0) || 0,
      avgResponseTime: usageLogs?.length 
        ? Math.round(usageLogs.reduce((a, l) => a + (l.response_time_ms || 0), 0) / usageLogs.length)
        : 0,
      errors: errorLogs?.length || 0,
      errorRate: usageLogs?.length 
        ? ((errorLogs?.length || 0) / usageLogs.length * 100).toFixed(2)
        : 0,
      healingAttempts: healingLogs?.length || 0,
      healingSuccess: healingLogs?.filter(h => h.status === 'healed').length || 0
    };
    
    // Store report
    await supabase.from('daily_reports').insert({
      report_date: report.date,
      metrics: report,
      created_at: new Date().toISOString()
    }).catch(() => {
      // Table might not exist, log to suggestions instead
      return supabase.from('proactive_suggestions').insert({
        suggestion_id: `report_${Date.now()}`,
        type: 'insight',
        priority: 'low',
        title: `Daily Report: ${report.date}`,
        description: `${report.conversations} conversations, ${report.totalRequests} requests, ${report.errors} errors`,
        metadata: report,
        created_at: new Date().toISOString()
      });
    });
    
    return {
      success: true,
      jobName: 'daily-health-report',
      message: `Generated report: ${report.conversations} conversations, ${report.errorRate}% error rate`,
      details: report,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      jobName: 'daily-health-report',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

async function runLearningOptimization(): Promise<CronResult> {
  const startTime = Date.now();
  
  try {
    // Analyze successful patterns
    const { data: learnings } = await supabase
      .from('conversation_learnings')
      .select('*')
      .eq('appears_successful', true)
      .order('created_at', { ascending: false })
      .limit(100);
    
    // Analyze by app type
    const appTypeStats: Record<string, { total: number; successful: number }> = {};
    for (const learning of learnings || []) {
      const appType = learning.app_type || 'general';
      if (!appTypeStats[appType]) {
        appTypeStats[appType] = { total: 0, successful: 0 };
      }
      appTypeStats[appType].total++;
      if (learning.appears_successful) {
        appTypeStats[appType].successful++;
      }
    }
    
    // Analyze by provider
    const providerStats: Record<string, number> = {};
    for (const learning of learnings || []) {
      const provider = learning.provider_used || 'unknown';
      providerStats[provider] = (providerStats[provider] || 0) + 1;
    }
    
    // Store optimization insights
    await supabase.from('proactive_suggestions').insert({
      suggestion_id: `learning_opt_${Date.now()}`,
      type: 'insight',
      priority: 'low',
      title: 'Weekly Learning Optimization',
      description: `Analyzed ${learnings?.length || 0} learning records`,
      metadata: {
        totalLearnings: learnings?.length || 0,
        appTypeStats,
        providerStats,
        topAppTypes: Object.entries(appTypeStats)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5)
          .map(([type, stats]) => ({ type, ...stats }))
      },
      created_at: new Date().toISOString()
    });
    
    return {
      success: true,
      jobName: 'learning-optimization',
      message: `Analyzed ${learnings?.length || 0} learnings across ${Object.keys(appTypeStats).length} app types`,
      details: { appTypeStats, providerStats },
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      jobName: 'learning-optimization',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOB REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const CRON_JOBS: Record<string, CronJob> = {
  'self-healing': {
    name: 'self-healing',
    description: 'Scan for failed deployments and auto-fix',
    schedule: '*/15 * * * *', // Every 15 minutes
    enabled: true,
    handler: runSelfHealingScan
  },
  'proactive-intelligence': {
    name: 'proactive-intelligence',
    description: 'Analyze patterns and generate suggestions',
    schedule: '0 * * * *', // Every hour
    enabled: true,
    handler: runProactiveIntelligence
  },
  'knowledge-consolidation': {
    name: 'knowledge-consolidation',
    description: 'Consolidate and optimize knowledge base',
    schedule: '0 */6 * * *', // Every 6 hours
    enabled: true,
    handler: runKnowledgeConsolidation
  },
  'daily-report': {
    name: 'daily-report',
    description: 'Generate daily health and usage report',
    schedule: '0 0 * * *', // Daily at midnight
    enabled: true,
    handler: runDailyHealthReport
  },
  'learning-optimization': {
    name: 'learning-optimization',
    description: 'Optimize learning patterns and insights',
    schedule: '0 0 * * 0', // Weekly on Sunday
    enabled: true,
    handler: runLearningOptimization
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const { job, secret } = body;
    
    // Verify cron secret (optional security)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json({
        success: false,
        error: 'Invalid cron secret'
      }, { status: 401 });
    }
    
    let results: CronResult[] = [];
    
    if (job && job !== 'all') {
      // Run specific job
      const cronJob = CRON_JOBS[job];
      if (!cronJob) {
        return NextResponse.json({
          success: false,
          error: `Unknown job: ${job}`,
          availableJobs: Object.keys(CRON_JOBS)
        }, { status: 400 });
      }
      
      if (!cronJob.enabled) {
        return NextResponse.json({
          success: false,
          error: `Job ${job} is disabled`
        }, { status: 400 });
      }
      
      console.log(`[Cron] Running job: ${job}`);
      const result = await cronJob.handler();
      results = [result];
      
    } else {
      // Run all enabled jobs
      console.log('[Cron] Running all enabled jobs');
      
      for (const [name, cronJob] of Object.entries(CRON_JOBS)) {
        if (!cronJob.enabled) continue;
        
        console.log(`[Cron] Running job: ${name}`);
        const result = await cronJob.handler();
        results.push(result);
        
        // Log job execution
        try {
          await supabase.from('cron_executions').insert({
            job_name: name,
            success: result.success,
            message: result.message,
            duration_ms: result.duration,
            created_at: new Date().toISOString()
          });
        } catch (e) { /* ignore if table doesn't exist */ }
      }
    }
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
    
    return NextResponse.json({
      success: summary.failed === 0,
      summary,
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Get recent executions
  const { data: recentExecutions } = await supabase
    .from('cron_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Cron System',
    version: '1.0',
    description: 'Scheduled autonomous operations',
    jobs: Object.entries(CRON_JOBS).map(([name, job]) => ({
      name,
      description: job.description,
      schedule: job.schedule,
      enabled: job.enabled
    })),
    recentExecutions: recentExecutions || [],
    usage: {
      method: 'POST',
      body: {
        job: 'job-name or "all" to run all jobs',
        secret: 'optional CRON_SECRET for security'
      }
    },
    vercelCronConfig: {
      note: 'Add to vercel.json for automatic scheduling',
      example: {
        crons: [
          { path: '/api/cron', schedule: '*/15 * * * *' }
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
}
