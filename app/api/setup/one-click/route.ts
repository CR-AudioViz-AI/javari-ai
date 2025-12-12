/**
 * JAVARI AI - ONE-CLICK AUTONOMOUS SETUP
 * 
 * This endpoint creates ALL 9 autonomous system tables with a single API call.
 * Uses PostgreSQL pooler connection which works from Vercel.
 * 
 * Usage: GET https://javariai.com/api/setup/one-click
 * 
 * Created: December 13, 2025 - 2:15 AM EST
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for full setup

// Complete SQL setup script
const SETUP_SQL = `
-- ============================================================
-- JAVARI AI AUTONOMOUS SYSTEM - COMPLETE SETUP
-- ============================================================

-- Enable pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to existing knowledge base
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'javari_knowledge' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE javari_knowledge ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- TABLE 1: Knowledge Gaps
CREATE TABLE IF NOT EXISTS javari_knowledge_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  category text,
  frequency int DEFAULT 1,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by_knowledge_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- TABLE 2: Conversation Learnings
CREATE TABLE IF NOT EXISTS javari_conversation_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  user_query text NOT NULL,
  javari_response text,
  extracted_facts jsonb DEFAULT '[]'::jsonb,
  user_intent text,
  product_mentioned text[],
  sentiment text CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  learning_applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- TABLE 3: Response Feedback
CREATE TABLE IF NOT EXISTS javari_response_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL,
  conversation_id uuid,
  user_id uuid,
  rating text CHECK (rating IN ('positive', 'negative', 'neutral')),
  feedback_text text,
  ai_provider text,
  query_category text,
  response_time_ms int,
  knowledge_used uuid[],
  created_at timestamptz DEFAULT now()
);

-- TABLE 4: Data Sources
CREATE TABLE IF NOT EXISTS javari_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('api', 'rss', 'scrape', 'webhook', 'manual')),
  url text,
  api_key_env text,
  fetch_frequency interval DEFAULT '1 hour',
  last_fetch timestamptz,
  next_fetch timestamptz,
  is_active boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  error_count int DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TABLE 5: External Data Cache
CREATE TABLE IF NOT EXISTS javari_external_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid,
  source_name text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('news', 'financial', 'weather', 'grants', 'reference', 'competitor')),
  title text,
  content text,
  url text,
  published_at timestamptz,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- TABLE 6: Provider Performance
CREATE TABLE IF NOT EXISTS javari_provider_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  query_category text,
  total_requests int DEFAULT 0,
  successful_requests int DEFAULT 0,
  failed_requests int DEFAULT 0,
  avg_response_time_ms float,
  avg_user_rating float,
  total_tokens_used bigint DEFAULT 0,
  total_cost_usd numeric(10,6) DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  UNIQUE(provider, query_category, date)
);

-- TABLE 7: User Memory
CREATE TABLE IF NOT EXISTS javari_user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_type text NOT NULL CHECK (memory_type IN ('fact', 'preference', 'project', 'interaction', 'goal')),
  content text NOT NULL,
  importance float DEFAULT 0.5,
  last_referenced timestamptz DEFAULT now(),
  reference_count int DEFAULT 1,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TABLE 8: Proactive Suggestions
CREATE TABLE IF NOT EXISTS javari_proactive_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('feature', 'tip', 'upsell', 'news', 'reminder', 'insight')),
  title text NOT NULL,
  content text NOT NULL,
  relevance_score float DEFAULT 0.5,
  trigger_condition jsonb,
  shown boolean DEFAULT false,
  shown_at timestamptz,
  clicked boolean DEFAULT false,
  dismissed boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- TABLE 9: Pattern Library
CREATE TABLE IF NOT EXISTS javari_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL CHECK (pattern_type IN ('code_template', 'document_template', 'workflow', 'response_template', 'integration')),
  name text NOT NULL,
  description text,
  category text,
  tags text[],
  content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  usage_count int DEFAULT 0,
  avg_rating float,
  is_active boolean DEFAULT true,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_query ON javari_knowledge_gaps(query);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_resolved ON javari_knowledge_gaps(resolved);
CREATE INDEX IF NOT EXISTS idx_conv_learnings_created ON javari_conversation_learnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON javari_response_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_provider ON javari_response_feedback(ai_provider);
CREATE INDEX IF NOT EXISTS idx_external_data_type ON javari_external_data(data_type);
CREATE INDEX IF NOT EXISTS idx_external_data_source ON javari_external_data(source_name);
CREATE INDEX IF NOT EXISTS idx_external_data_expires ON javari_external_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_provider_perf_date ON javari_provider_performance(date DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_user ON javari_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_user ON javari_proactive_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON javari_patterns(pattern_type);

-- ENABLE RLS
ALTER TABLE javari_knowledge_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_conversation_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_response_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_external_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_provider_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_proactive_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE javari_patterns ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
DO $$ 
BEGIN
  DROP POLICY IF EXISTS service_knowledge_gaps ON javari_knowledge_gaps;
  CREATE POLICY service_knowledge_gaps ON javari_knowledge_gaps FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_conv_learnings ON javari_conversation_learnings;
  CREATE POLICY service_conv_learnings ON javari_conversation_learnings FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_feedback ON javari_response_feedback;
  CREATE POLICY service_feedback ON javari_response_feedback FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_data_sources ON javari_data_sources;
  CREATE POLICY service_data_sources ON javari_data_sources FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_external_data ON javari_external_data;
  CREATE POLICY service_external_data ON javari_external_data FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS anon_read_external ON javari_external_data;
  CREATE POLICY anon_read_external ON javari_external_data FOR SELECT TO anon USING (true);
  
  DROP POLICY IF EXISTS service_provider_perf ON javari_provider_performance;
  CREATE POLICY service_provider_perf ON javari_provider_performance FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_user_memory ON javari_user_memory;
  CREATE POLICY service_user_memory ON javari_user_memory FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_suggestions ON javari_proactive_suggestions;
  CREATE POLICY service_suggestions ON javari_proactive_suggestions FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS service_patterns ON javari_patterns;
  CREATE POLICY service_patterns ON javari_patterns FOR ALL TO service_role USING (true);
  
  DROP POLICY IF EXISTS anon_read_patterns ON javari_patterns;
  CREATE POLICY anon_read_patterns ON javari_patterns FOR SELECT TO anon USING (is_active = true);
END $$;

-- SEED DATA SOURCES
INSERT INTO javari_data_sources (name, source_type, url, config) VALUES
('hackernews_top', 'api', 'https://hacker-news.firebaseio.com/v0/topstories.json', '{"limit": 30}'),
('reddit_technology', 'api', 'https://www.reddit.com/r/technology/hot.json', '{"limit": 25}'),
('reddit_startups', 'api', 'https://www.reddit.com/r/startups/hot.json', '{"limit": 25}'),
('coingecko', 'api', 'https://api.coingecko.com/api/v3/coins/markets', '{"vs_currency": "usd"}'),
('weather_openmeteo', 'api', 'https://api.open-meteo.com/v1/forecast', '{"latitude": 26.56, "longitude": -81.87}'),
('wikipedia', 'api', 'https://en.wikipedia.org/w/api.php', '{"action": "query"}')
ON CONFLICT (name) DO NOTHING;

-- FUNCTION: Semantic Search
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  category text,
  subcategory text,
  title text,
  content text,
  keywords text[],
  confidence_score float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jk.id,
    jk.category,
    jk.subcategory,
    jk.title,
    jk.content,
    jk.keywords,
    jk.confidence_score::float,
    1 - (jk.embedding <=> query_embedding) as similarity
  FROM javari_knowledge jk
  WHERE jk.embedding IS NOT NULL
    AND 1 - (jk.embedding <=> query_embedding) > match_threshold
  ORDER BY jk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- FUNCTION: Upsert Knowledge Gap
CREATE OR REPLACE FUNCTION upsert_knowledge_gap(
  p_query text,
  p_category text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM javari_knowledge_gaps 
  WHERE query = p_query AND resolved = false;
  
  IF v_id IS NOT NULL THEN
    UPDATE javari_knowledge_gaps 
    SET frequency = frequency + 1, last_seen = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO javari_knowledge_gaps (query, category)
    VALUES (p_query, p_category)
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$$;

-- FUNCTION: Get Best Provider
CREATE OR REPLACE FUNCTION get_best_provider(
  p_category text DEFAULT 'general'
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_provider text;
BEGIN
  SELECT provider INTO v_provider
  FROM javari_provider_performance
  WHERE query_category = p_category
    AND date >= CURRENT_DATE - INTERVAL '7 days'
    AND total_requests >= 10
  GROUP BY provider
  ORDER BY AVG(avg_user_rating) DESC NULLS LAST, AVG(avg_response_time_ms) ASC
  LIMIT 1;
  
  IF v_provider IS NULL THEN
    v_provider := 'openai';
  END IF;
  
  RETURN v_provider;
END;
$$;
`;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Build connection string from env vars
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'kteobfyferrukqeolofj';
  
  if (!dbPassword) {
    return NextResponse.json({
      error: 'Missing SUPABASE_DB_PASSWORD environment variable',
      setup_required: 'Add SUPABASE_DB_PASSWORD to Vercel environment variables'
    }, { status: 500 });
  }
  
  // URL encode the password (@ becomes %40)
  const encodedPassword = encodeURIComponent(dbPassword);
  
  // Use pooler connection (works from serverless)
  const connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });
  
  const results: { step: string; success: boolean; message: string }[] = [];
  
  try {
    console.log('[Setup] Connecting to database...');
    const client = await pool.connect();
    results.push({ step: 'connect', success: true, message: 'Connected to PostgreSQL' });
    
    console.log('[Setup] Executing SQL...');
    
    // Split SQL into individual statements and execute
    const statements = SETUP_SQL
      .split(/;(?=\s*(?:--|CREATE|ALTER|INSERT|DO|DROP))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let executed = 0;
    let failed = 0;
    
    for (const stmt of statements) {
      if (stmt.length < 5) continue;
      try {
        await client.query(stmt);
        executed++;
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          console.error('[Setup] SQL Error:', err.message.substring(0, 100));
          failed++;
        } else {
          executed++;
        }
      }
    }
    
    results.push({ 
      step: 'execute_sql', 
      success: failed === 0, 
      message: `Executed ${executed} statements, ${failed} failed` 
    });
    
    // Verify tables exist
    const tableCheck = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'javari%'
      ORDER BY tablename
    `);
    
    results.push({ 
      step: 'verify_tables', 
      success: tableCheck.rows.length >= 10, 
      message: `Found ${tableCheck.rows.length} Javari tables: ${tableCheck.rows.map(r => r.tablename).join(', ')}` 
    });
    
    // Check data sources
    const sourceCheck = await client.query('SELECT COUNT(*) as count FROM javari_data_sources');
    results.push({ 
      step: 'data_sources', 
      success: parseInt(sourceCheck.rows[0].count) > 0, 
      message: `${sourceCheck.rows[0].count} data sources configured` 
    });
    
    // Check knowledge count
    const knowledgeCheck = await client.query('SELECT COUNT(*) as count FROM javari_knowledge');
    results.push({ 
      step: 'knowledge_base', 
      success: true, 
      message: `${knowledgeCheck.rows[0].count} knowledge entries` 
    });
    
    // Check functions
    const funcCheck = await client.query(`
      SELECT proname FROM pg_proc 
      WHERE proname IN ('search_knowledge', 'upsert_knowledge_gap', 'get_best_provider')
    `);
    results.push({ 
      step: 'functions', 
      success: funcCheck.rows.length >= 3, 
      message: `Functions: ${funcCheck.rows.map(r => r.proname).join(', ')}` 
    });
    
    client.release();
    await pool.end();
    
  } catch (error: any) {
    console.error('[Setup] Fatal error:', error);
    results.push({ 
      step: 'fatal_error', 
      success: false, 
      message: error.message 
    });
  }
  
  const duration = Date.now() - startTime;
  const allSuccess = results.every(r => r.success);
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timezone: 'EST',
    status: allSuccess ? 'SUCCESS' : 'PARTIAL',
    duration_ms: duration,
    results,
    next_steps: allSuccess ? {
      message: '🎉 Autonomous system is READY!',
      test_endpoint: 'GET /api/cron/continuous-learning',
      note: 'Cron job will run automatically every 4 hours'
    } : {
      message: 'Some steps failed. Check results above.',
      retry: 'GET /api/setup/one-click'
    }
  });
}
