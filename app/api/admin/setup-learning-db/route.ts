// app/api/admin/setup-learning-db/route.ts
// Creates tables for Javari's autonomous learning system

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const results: Record<string, string> = {}
    
    // Check/create tables by attempting to select from them
    const tables = [
      {
        name: 'javari_learning',
        columns: ['command_id', 'was_helpful', 'correction', 'expected_result', 'actual_result', 'category', 'created_at']
      },
      {
        name: 'javari_patterns', 
        columns: ['trigger', 'category', 'intent', 'usage_count', 'success_count', 'success_rate', 'confidence', 'created_at', 'updated_at']
      },
      {
        name: 'javari_knowledge',
        columns: ['topic', 'content', 'source', 'confidence', 'created_at', 'updated_at']
      }
    ]
    
    for (const table of tables) {
      const { error } = await supabase.from(table.name).select('*').limit(1)
      
      if (error && error.code === '42P01') {
        results[table.name] = '❌ Table does not exist - needs manual creation in Supabase'
      } else if (error) {
        results[table.name] = `⚠️ Error: ${error.message}`
      } else {
        results[table.name] = '✅ Table exists and accessible'
      }
    }
    
    // Also create RPC functions if they don't exist
    const rpcs = [
      {
        name: 'increment_success_count',
        sql: `
          CREATE OR REPLACE FUNCTION increment_success_count(cmd_category text)
          RETURNS void AS $$
          BEGIN
            -- This would update category-level stats
            INSERT INTO javari_stats (category, success_count, updated_at)
            VALUES (cmd_category, 1, NOW())
            ON CONFLICT (category) 
            DO UPDATE SET success_count = javari_stats.success_count + 1, updated_at = NOW();
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'increment_failure_count',
        sql: `
          CREATE OR REPLACE FUNCTION increment_failure_count(cmd_category text)
          RETURNS void AS $$
          BEGIN
            INSERT INTO javari_stats (category, failure_count, updated_at)
            VALUES (cmd_category, 1, NOW())
            ON CONFLICT (category)
            DO UPDATE SET failure_count = javari_stats.failure_count + 1, updated_at = NOW();
          END;
          $$ LANGUAGE plpgsql;
        `
      }
    ]
    
    results['rpc_functions'] = 'ℹ️ RPC functions need manual creation in Supabase SQL editor'
    
    return NextResponse.json({
      success: true,
      message: 'Learning database check completed',
      results,
      sqlToRun: `
-- Run this SQL in Supabase SQL Editor:

-- Javari Learning Table (feedback/corrections)
CREATE TABLE IF NOT EXISTS javari_learning (
  id SERIAL PRIMARY KEY,
  command_id TEXT,
  was_helpful BOOLEAN,
  correction TEXT,
  expected_result TEXT,
  actual_result TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Javari Patterns Table (learned patterns)
CREATE TABLE IF NOT EXISTS javari_patterns (
  id SERIAL PRIMARY KEY,
  trigger TEXT,
  category TEXT,
  intent TEXT,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  success_rate DECIMAL DEFAULT 0,
  confidence DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trigger, category)
);

-- Javari Knowledge Table (accumulated knowledge)
CREATE TABLE IF NOT EXISTS javari_knowledge (
  id SERIAL PRIMARY KEY,
  topic TEXT UNIQUE,
  content TEXT,
  source TEXT,
  confidence DECIMAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Javari Stats Table (aggregate stats)
CREATE TABLE IF NOT EXISTS javari_stats (
  category TEXT PRIMARY KEY,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_learning_helpful ON javari_learning(was_helpful);
CREATE INDEX IF NOT EXISTS idx_patterns_trigger ON javari_patterns(trigger);
CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON javari_knowledge(topic);
      `,
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
  const tables = ['javari_learning', 'javari_patterns', 'javari_knowledge', 'javari_stats']
  const status: Record<string, string> = {}
  
  for (const table of tables) {
    const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      status[table] = `❌ ${error.code}: Not found or error`
    } else {
      status[table] = `✅ Exists (${count || 0} rows)`
    }
  }
  
  return NextResponse.json({
    service: 'Javari Learning Database Setup',
    tables: status,
    timestamp: new Date().toISOString()
  })
}
