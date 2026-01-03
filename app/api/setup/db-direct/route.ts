/**
 * DATABASE SETUP - Direct PostgreSQL Connection
 * Creates autonomous tables for Javari AI
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const results: string[] = [];
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return NextResponse.json({
      error: 'DATABASE_URL not configured',
      hint: 'Add DATABASE_URL to Vercel environment variables'
    }, { status: 500 });
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    const client = await pool.connect();
    results.push('Connected to database');
    
    // Create tables
    await client.query(\`
      CREATE TABLE IF NOT EXISTS public.autonomous_jobs (
        job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        schedule TEXT NOT NULL DEFAULT '*/5 * * * *',
        job_type TEXT NOT NULL DEFAULT 'health_check',
        enabled BOOLEAN DEFAULT true,
        last_run_at TIMESTAMPTZ,
        priority INTEGER DEFAULT 5,
        config JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    \`);
    results.push('autonomous_jobs: CREATED');
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS public.autonomous_runs (
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
    \`);
    results.push('autonomous_runs: CREATED');
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS public.autonomous_actions (
        action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID,
        action_type TEXT NOT NULL,
        target TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        evidence_json JSONB,
        verification_passed BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    \`);
    results.push('autonomous_actions: CREATED');
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS public.autonomous_alerts (
        alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID,
        severity TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        delivery_status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    \`);
    results.push('autonomous_alerts: CREATED');
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS public.autonomous_heartbeats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        region TEXT,
        status TEXT DEFAULT 'alive',
        metrics JSONB DEFAULT '{}'::jsonb
      );
    \`);
    results.push('autonomous_heartbeats: CREATED');
    
    // Create indexes
    await client.query(\`
      CREATE INDEX IF NOT EXISTS idx_autonomous_runs_started ON public.autonomous_runs(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_autonomous_heartbeats_ts ON public.autonomous_heartbeats(timestamp DESC);
    \`);
    results.push('Indexes: CREATED');
    
    // Seed default jobs
    await client.query(\`
      INSERT INTO public.autonomous_jobs (name, description, schedule, job_type, priority, config)
      VALUES 
        ('health_check', 'Check critical endpoints', '*/5 * * * *', 'health_check', 1, '{"endpoints": ["/api/health", "/"]}'),
        ('self_healing', 'Auto-fix issues', '*/5 * * * *', 'self_healing', 1, '{"auto_rollback": true}')
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW();
    \`);
    results.push('Default jobs: SEEDED');
    
    client.release();
    await pool.end();
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      results
    });
    
  } catch (error: unknown) {
    await pool.end();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'error',
      message: errorMessage,
      results
    }, { status: 500 });
  }
}
