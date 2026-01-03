/**
 * MASTER CRON RUNNER - Consolidates all crons into ONE
 * CR AudioViz AI - Autonomous Monitoring System
 * Schedule: Every minute
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface JobResult {
  status: 'success' | 'failed' | 'degraded';
  issuesDetected: number;
  fixesApplied: number;
  verificationPassed: boolean;
  logs: string[];
  metrics: Record<string, unknown>;
  error?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];
  
  // Verify cron authorization
  const authHeader = request.headers.get('authorization');
  const vercelCron = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !vercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  logs.push(`[${new Date().toISOString()}] Master Cron Runner started`);
  
  try {
    // 1. Write heartbeat
    await supabase
      .from('autonomous_heartbeats')
      .insert({
        region: process.env.VERCEL_REGION || 'unknown',
        status: 'alive',
        metrics: { startTime }
      });
    logs.push(`[${new Date().toISOString()}] Heartbeat recorded`);
    
    // 2. Get enabled jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('autonomous_jobs')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: true });
    
    if (jobsError) {
      logs.push(`[${new Date().toISOString()}] ERROR: ${jobsError.message}`);
      return NextResponse.json({ status: 'error', message: jobsError.message, logs }, { status: 500 });
    }
    
    logs.push(`[${new Date().toISOString()}] Found ${jobs?.length || 0} enabled jobs`);
    
    // 3. Filter due jobs and execute
    const results: Array<{ job: string; status: string }> = [];
    
    for (const job of jobs || []) {
      if (!isJobDue(job)) continue;
      
      logs.push(`[${new Date().toISOString()}] Executing: ${job.name}`);
      
      // Create run record
      const { data: run } = await supabase
        .from('autonomous_runs')
        .insert({
          job_id: job.job_id,
          job_name: job.name,
          status: 'running',
          region: process.env.VERCEL_REGION || 'unknown'
        })
        .select()
        .single();
      
      if (!run) continue;
      
      try {
        const result = await executeJob(job, run.run_id);
        
        await supabase
          .from('autonomous_runs')
          .update({
            status: result.status,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            issues_detected_count: result.issuesDetected,
            fixes_applied_count: result.fixesApplied,
            verification_passed: result.verificationPassed,
            logs_json: result.logs,
            metrics: result.metrics
          })
          .eq('run_id', run.run_id);
        
        await supabase
          .from('autonomous_jobs')
          .update({ last_run_at: new Date().toISOString() })
          .eq('job_id', job.job_id);
        
        results.push({ job: job.name, status: result.status });
        logs.push(`[${new Date().toISOString()}] ${job.name}: ${result.status}`);
        
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await supabase
          .from('autonomous_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: errorMessage
          })
          .eq('run_id', run.run_id);
        logs.push(`[${new Date().toISOString()}] ${job.name} failed: ${errorMessage}`);
      }
    }
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      jobs_executed: results.length,
      results,
      logs
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logs.push(`[${new Date().toISOString()}] FATAL: ${errorMessage}`);
    return NextResponse.json({ status: 'error', message: errorMessage, logs }, { status: 500 });
  }
}

function isJobDue(job: { last_run_at?: string; schedule?: string }): boolean {
  if (!job.last_run_at) return true;
  
  const now = Date.now();
  const lastRun = new Date(job.last_run_at).getTime();
  const schedule = job.schedule || '*/5 * * * *';
  
  // Parse simple schedules
  if (schedule.startsWith('*/')) {
    const minutes = parseInt(schedule.split(' ')[0].replace('*/', ''));
    return (now - lastRun) >= minutes * 60000;
  }
  
  if (schedule.startsWith('0 */')) {
    const hours = parseInt(schedule.split(' ')[1].replace('*/', ''));
    return (now - lastRun) >= hours * 3600000;
  }
  
  // Default: 5 minutes
  return (now - lastRun) >= 300000;
}

async function executeJob(job: { job_type: string; config?: Record<string, unknown> }, runId: string): Promise<JobResult> {
  const logs: string[] = [];
  
  switch (job.job_type) {
    case 'health_check':
      return await executeHealthCheck(job, runId);
    case 'self_healing':
      return await executeSelfHealing(runId);
    default:
      logs.push(`Unknown job type: ${job.job_type}`);
      return { status: 'success', issuesDetected: 0, fixesApplied: 0, verificationPassed: true, logs, metrics: {} };
  }
}

async function executeHealthCheck(job: { config?: Record<string, unknown> }, runId: string): Promise<JobResult> {
  const logs: string[] = [];
  let issuesDetected = 0;
  const config = job.config || {};
  const endpoints = (config.endpoints as string[]) || ['/api/health'];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://craudiovizai.com';
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 'User-Agent': 'Javari-HealthCheck/1.0' }
      });
      
      if (response.ok) {
        logs.push(`OK ${endpoint}: ${response.status}`);
      } else {
        logs.push(`FAIL ${endpoint}: ${response.status}`);
        issuesDetected++;
        
        await supabase
          .from('autonomous_actions')
          .insert({
            run_id: runId,
            action_type: 'detect_issue',
            target: endpoint,
            status: 'success',
            evidence_json: { endpoint, status: response.status }
          });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logs.push(`ERROR ${endpoint}: ${errorMessage}`);
      issuesDetected++;
    }
  }
  
  return {
    status: issuesDetected > 0 ? 'degraded' : 'success',
    issuesDetected,
    fixesApplied: 0,
    verificationPassed: issuesDetected === 0,
    logs,
    metrics: { endpoints_checked: endpoints.length }
  };
}

async function executeSelfHealing(runId: string): Promise<JobResult> {
  const logs: string[] = [];
  
  const { data: recentRuns } = await supabase
    .from('autonomous_runs')
    .select('*')
    .eq('status', 'degraded')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
    .limit(10);
  
  const issuesDetected = recentRuns?.length || 0;
  
  if (issuesDetected > 0) {
    logs.push(`Found ${issuesDetected} degraded runs`);
  } else {
    logs.push('System healthy - no degraded runs');
  }
  
  return {
    status: issuesDetected > 0 ? 'degraded' : 'success',
    issuesDetected,
    fixesApplied: 0,
    verificationPassed: issuesDetected === 0,
    logs,
    metrics: { recent_issues: issuesDetected }
  };
}
