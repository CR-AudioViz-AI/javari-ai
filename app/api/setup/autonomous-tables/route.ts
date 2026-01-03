/**
 * JAVARI AI - Setup Autonomous Tables API
 * 
 * One-time setup endpoint to create the database tables needed
 * for the 24x7x365 autonomous monitoring system.
 * 
 * Endpoint: POST /api/setup/autonomous-tables
 * 
 * Created: January 3, 2026
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Tables to create
const TABLES = {
  javari_ecosystem_health: `
    CREATE TABLE IF NOT EXISTS javari_ecosystem_health (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total_projects INTEGER NOT NULL,
      healthy INTEGER NOT NULL DEFAULT 0,
      degraded INTEGER NOT NULL DEFAULT 0,
      down INTEGER NOT NULL DEFAULT 0,
      building INTEGER NOT NULL DEFAULT 0,
      alerts_sent INTEGER NOT NULL DEFAULT 0,
      rollbacks_performed INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  javari_alerts: `
    CREATE TABLE IF NOT EXISTS javari_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      project_id TEXT,
      project_name TEXT,
      metadata JSONB,
      acknowledged BOOLEAN DEFAULT FALSE,
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  javari_healing_history: `
    CREATE TABLE IF NOT EXISTS javari_healing_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      error_type TEXT,
      error_message TEXT,
      detection_method TEXT,
      fix_attempted BOOLEAN DEFAULT FALSE,
      fix_applied BOOLEAN DEFAULT FALSE,
      fix_result JSONB,
      confidence_score INTEGER,
      project_name TEXT,
      triggered_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      status TEXT,
      errors_found INTEGER DEFAULT 0,
      errors_fixed INTEGER DEFAULT 0,
      errors_failed INTEGER DEFAULT 0,
      run_time_ms INTEGER,
      results JSONB
    )
  `,
  javari_manual_review: `
    CREATE TABLE IF NOT EXISTS javari_manual_review (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      diagnosis TEXT,
      confidence INTEGER,
      fix_strategy TEXT,
      requires_manual_review BOOLEAN DEFAULT TRUE,
      reviewed BOOLEAN DEFAULT FALSE,
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT,
      resolution TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
  javari_learning_patterns: `
    CREATE TABLE IF NOT EXISTS javari_learning_patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      error_signature TEXT NOT NULL,
      error_category TEXT,
      successful_fix TEXT,
      fix_confidence INTEGER,
      occurrences INTEGER DEFAULT 1,
      last_occurrence TIMESTAMPTZ DEFAULT NOW(),
      auto_fixable BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,
};

export async function POST(request: NextRequest) {
  // Verify Roy-only access
  const authHeader = request.headers.get('x-admin-key');
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ 
      error: 'Missing Supabase credentials' 
    }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
  });

  const results: Record<string, { created: boolean; error?: string }> = {};

  // Test connection by checking if we can query
  for (const [tableName, createSQL] of Object.entries(TABLES)) {
    try {
      // Try to query the table first
      const { error: queryError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (queryError && queryError.code === 'PGRST116') {
        // Table doesn't exist, need to create it
        // Note: We can't run raw SQL via REST API, so we'll use a workaround
        // by inserting a test record which will fail if table doesn't exist
        results[tableName] = {
          created: false,
          error: `Table needs to be created via Supabase Dashboard. SQL: ${createSQL.substring(0, 100)}...`,
        };
      } else if (queryError) {
        results[tableName] = {
          created: false,
          error: queryError.message,
        };
      } else {
        results[tableName] = { created: true };
      }
    } catch (error) {
      results[tableName] = {
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Check which tables need to be created
  const needsCreation = Object.entries(results)
    .filter(([_, v]) => !v.created)
    .map(([k, _]) => k);

  return NextResponse.json({
    success: true,
    message: needsCreation.length > 0 
      ? 'Some tables need to be created via Supabase Dashboard'
      : 'All tables exist and are ready',
    results,
    migration_sql: needsCreation.length > 0 
      ? Object.entries(TABLES)
          .filter(([name]) => needsCreation.includes(name))
          .map(([name, sql]) => `-- ${name}\n${sql.trim()};`)
          .join('\n\n')
      : null,
  });
}

export async function GET(request: NextRequest) {
  // Return migration SQL for manual execution
  return NextResponse.json({
    message: 'Use POST to check/create tables, or copy this SQL to Supabase Dashboard',
    sql: Object.entries(TABLES)
      .map(([name, sql]) => `-- ${name}\n${sql.trim()};`)
      .join('\n\n'),
  });
}
