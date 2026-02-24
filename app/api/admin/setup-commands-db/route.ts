// app/api/admin/setup-commands-db/route.ts
// Creates tables needed for Javari Business Command Center

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const results: Record<string, string> = {}
    
    // 1. Business Commands Log
    const { error: err1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS business_commands (
          id SERIAL PRIMARY KEY,
          command_id TEXT UNIQUE,
          user_id TEXT,
          command_text TEXT,
          category TEXT,
          intent TEXT,
          parameters JSONB,
          confidence DECIMAL,
          result JSONB,
          status TEXT DEFAULT 'executed',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_commands_user ON business_commands(user_id);
        CREATE INDEX IF NOT EXISTS idx_commands_category ON business_commands(category);
      `
    })
    results['business_commands'] = err1 ? `Error: ${err1.message}` : '✅ Created'
    
    // 2. Pending Approvals
    const { error: err2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS pending_approvals (
          id SERIAL PRIMARY KEY,
          command_id TEXT,
          command_text TEXT,
          category TEXT,
          parameters JSONB,
          status TEXT DEFAULT 'pending',
          approved_by TEXT,
          approved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(status);
      `
    })
    results['pending_approvals'] = err2 ? `Error: ${err2.message}` : '✅ Created'
    
    // 3. Admin Actions Log
    const { error: err3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS admin_actions (
          id SERIAL PRIMARY KEY,
          action TEXT,
          target_user TEXT,
          parameters JSONB,
          status TEXT DEFAULT 'executed',
          executed_by TEXT,
          executed_at TIMESTAMPTZ DEFAULT NOW(),
          requested_by TEXT,
          requested_at TIMESTAMPTZ
        );
      `
    })
    results['admin_actions'] = err3 ? `Error: ${err3.message}` : '✅ Created'
    
    // 4. Promo Codes
    const { error: err4 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS promo_codes (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE,
          discount_percent INTEGER,
          discount_amount DECIMAL,
          valid_until TIMESTAMPTZ,
          max_uses INTEGER,
          current_uses INTEGER DEFAULT 0,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
      `
    })
    results['promo_codes'] = err4 ? `Error: ${err4.message}` : '✅ Created'
    
    // 5. Try direct table creation if RPC doesn't exist
    const tables = ['business_commands', 'pending_approvals', 'admin_actions', 'promo_codes']
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error && error.code === '42P01') {
        // Table doesn't exist, we'll handle it differently
        results[`${table}_check`] = 'Table needs manual creation'
      } else if (!error) {
        results[`${table}_check`] = '✅ Table exists and accessible'
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database setup completed',
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed'
    }, { status: 500 })
  }
}

export async function GET() {
  // Check table status
  const tables = ['business_commands', 'pending_approvals', 'admin_actions', 'promo_codes', 'tickets', 'feedback']
  const status: Record<string, string> = {}
  
  for (const table of tables) {
    const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      status[table] = `❌ ${error.code}: ${error.message}`
    } else {
      status[table] = `✅ Exists (${count || 0} rows)`
    }
  }
  
  return NextResponse.json({
    service: 'Command Database Setup',
    tables: status,
    timestamp: new Date().toISOString()
  })
}
