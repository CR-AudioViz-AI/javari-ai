// app/api/admin/setup-scheduler-db/route.ts
// Database tables for Scheduler and Approvals System

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const SCHEDULER_TABLES_SQL = `
-- Scheduled Commands Table
CREATE TABLE IF NOT EXISTS scheduled_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  schedule TEXT NOT NULL,
  schedule_description TEXT,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  notify_email TEXT,
  notify_slack TEXT,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule Executions Log
CREATE TABLE IF NOT EXISTS schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES scheduled_commands(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  result JSONB,
  status TEXT CHECK (status IN ('success', 'error')),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  duration INTEGER
);

-- Pending Approvals Table
CREATE TABLE IF NOT EXISTS pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_text TEXT NOT NULL,
  category TEXT NOT NULL,
  parameters JSONB,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Scheduled Social Posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT CHECK (platform IN ('twitter', 'linkedin', 'facebook', 'instagram')),
  content TEXT NOT NULL,
  image_url TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'posted', 'failed')) DEFAULT 'scheduled',
  post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Posts Log
CREATE TABLE IF NOT EXISTS social_posts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'posted',
  post_id TEXT,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_type TEXT CHECK (recipient_type IN ('all', 'custom')) DEFAULT 'custom',
  recipient_list JSONB,
  scheduled_for TIMESTAMPTZ,
  status TEXT CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')) DEFAULT 'draft',
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Log
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Emails (Nurture Sequences)
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  sequence_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'cancelled')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Actions Log
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_user TEXT,
  parameters JSONB,
  status TEXT CHECK (status IN ('success', 'error', 'pending')),
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proactive Alerts
CREATE TABLE IF NOT EXISTS proactive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  data JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_commands_enabled ON scheduled_commands(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_commands_next_run ON scheduled_commands(next_run);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule_id ON schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_proactive_alerts_acknowledged ON proactive_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_proactive_alerts_severity ON proactive_alerts(severity);
`;

export async function POST(request: NextRequest) {
  try {
    // Try to create tables using raw SQL
    const tables = [
      'scheduled_commands',
      'schedule_executions', 
      'pending_approvals',
      'scheduled_posts',
      'social_posts_log',
      'email_campaigns',
      'email_log',
      'scheduled_emails',
      'admin_actions',
      'proactive_alerts'
    ]
    
    const results: Record<string, string> = {}
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error && error.code === '42P01') {
        results[table] = 'NEEDS_CREATION'
      } else if (error) {
        results[table] = `ERROR: ${error.message}`
      } else {
        results[table] = 'EXISTS'
      }
    }
    
    const needsCreation = Object.entries(results).filter(([, status]) => status === 'NEEDS_CREATION')
    
    return NextResponse.json({
      success: true,
      message: needsCreation.length > 0 
        ? `${needsCreation.length} tables need creation. Run SQL in Supabase dashboard.`
        : 'All tables exist!',
      tableStatus: results,
      sql: SCHEDULER_TABLES_SQL
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database setup error',
      sql: SCHEDULER_TABLES_SQL
    }, { status: 500 })
  }
}

export async function GET() {
  const tables = [
    'scheduled_commands',
    'schedule_executions', 
    'pending_approvals',
    'scheduled_posts',
    'social_posts_log',
    'email_campaigns',
    'email_log',
    'scheduled_emails',
    'admin_actions',
    'proactive_alerts'
  ]
  
  const status: Record<string, any> = {}
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      status[table] = { exists: false, error: error.message }
    } else {
      status[table] = { exists: true, count: count || 0 }
    }
  }
  
  return NextResponse.json({
    service: 'Scheduler & Approvals Database Setup',
    tables: status,
    sql: SCHEDULER_TABLES_SQL
  })
}
