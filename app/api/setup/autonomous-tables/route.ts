/**
 * DATABASE SETUP ENDPOINT
 * Creates autonomous monitoring tables if they don't exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const results: string[] = [];
  
  try {
    // Create autonomous_jobs table
    const { error: jobsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS autonomous_jobs (
          job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          schedule TEXT NOT NULL DEFAULT '*/5 * * * *',
          job_type TEXT NOT NULL DEFAULT 'health_check',
          target_url TEXT,
          enabled BOOLEAN DEFAULT true,
          last_run_at TIMESTAMPTZ,
          next_run_at TIMESTAMPTZ,
          timeout_ms INTEGER DEFAULT 30000,
          max_retries INTEGER DEFAULT 3,
          priority INTEGER DEFAULT 5,
          config JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (jobsError) {
      // Try direct insert to test if table exists
      const { error: testError } = await supabase
        .from('autonomous_jobs')
        .select('count')
        .limit(1);
      
      if (testError) {
        results.push(`autonomous_jobs: ERROR - ${testError.message}`);
      } else {
        results.push('autonomous_jobs: EXISTS');
      }
    } else {
      results.push('autonomous_jobs: CREATED');
    }
    
    // Create autonomous_runs table
    const { error: runsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS autonomous_runs (
          run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id UUID,
          job_name TEXT,
          started_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          duration_ms INTEGER,
          status TEXT NOT NULL DEFAULT 'running',
          issues_detected_count INTEGER DEFAULT 0,
          fixes_applied_count INTEGER DEFAULT 0,
          verification_passed BOOLEAN,
          logs_json JSONB DEFAULT '[]'::jsonb,
          metrics JSONB DEFAULT '{}'::jsonb,
          error_message TEXT,
          region TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (runsError) {
      const { error: testError } = await supabase
        .from('autonomous_runs')
        .select('count')
        .limit(1);
      
      if (testError) {
        results.push(`autonomous_runs: ERROR - ${testError.message}`);
      } else {
        results.push('autonomous_runs: EXISTS');
      }
    } else {
      results.push('autonomous_runs: CREATED');
    }
    
    // Create autonomous_actions table
    const { error: actionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS autonomous_actions (
          action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          run_id UUID,
          action_type TEXT NOT NULL,
          target TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          before_state JSONB,
          after_state JSONB,
          evidence_json JSONB,
          verification_passed BOOLEAN,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        );
      `
    });
    
    if (actionsError) {
      const { error: testError } = await supabase
        .from('autonomous_actions')
        .select('count')
        .limit(1);
      
      if (testError) {
        results.push(`autonomous_actions: ERROR - ${testError.message}`);
      } else {
        results.push('autonomous_actions: EXISTS');
      }
    } else {
      results.push('autonomous_actions: CREATED');
    }
    
    // Create autonomous_alerts table
    const { error: alertsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS autonomous_alerts (
          alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          run_id UUID,
          severity TEXT NOT NULL DEFAULT 'info',
          category TEXT NOT NULL DEFAULT 'system',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          channels JSONB DEFAULT '[]'::jsonb,
          delivery_status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (alertsError) {
      const { error: testError } = await supabase
        .from('autonomous_alerts')
        .select('count')
        .limit(1);
      
      if (testError) {
        results.push(`autonomous_alerts: ERROR - ${testError.message}`);
      } else {
        results.push('autonomous_alerts: EXISTS');
      }
    } else {
      results.push('autonomous_alerts: CREATED');
    }
    
    // Create autonomous_heartbeats table
    const { error: hbError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS autonomous_heartbeats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          region TEXT,
          status TEXT DEFAULT 'alive',
          metrics JSONB DEFAULT '{}'::jsonb
        );
      `
    });
    
    if (hbError) {
      const { error: testError } = await supabase
        .from('autonomous_heartbeats')
        .select('count')
        .limit(1);
      
      if (testError) {
        results.push(`autonomous_heartbeats: ERROR - ${testError.message}`);
      } else {
        results.push('autonomous_heartbeats: EXISTS');
      }
    } else {
      results.push('autonomous_heartbeats: CREATED');
    }
    
    // Seed default jobs
    const defaultJobs = [
      { name: 'health_check', description: 'Check critical endpoints', schedule: '*/5 * * * *', job_type: 'health_check', priority: 1, config: { endpoints: ['/api/health', '/'] } },
      { name: 'self_healing', description: 'Auto-fix issues', schedule: '*/5 * * * *', job_type: 'self_healing', priority: 1, config: { auto_rollback: true } }
    ];
    
    for (const job of defaultJobs) {
      const { error: insertError } = await supabase
        .from('autonomous_jobs')
        .upsert(job, { onConflict: 'name' });
      
      if (insertError) {
        results.push(`Job ${job.name}: ERROR - ${insertError.message}`);
      } else {
        results.push(`Job ${job.name}: SEEDED`);
      }
    }
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      results
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'error',
      message: errorMessage,
      results
    }, { status: 500 });
  }
}
