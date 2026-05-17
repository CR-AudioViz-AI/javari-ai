// app/api/admin/setup-all-tables/route.ts
// One-time table creation — call once then delete
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const results: Record<string, string> = {}

  const tables = [
    { name: 'javari_learning_log', sql: `CREATE TABLE IF NOT EXISTS javari_learning_log (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, action_type text NOT NULL, model_used text NOT NULL, provider text, prompt_length integer DEFAULT 0, output_length integer DEFAULT 0, latency_ms integer DEFAULT 0, cost_usd numeric(12,8) DEFAULT 0, success boolean DEFAULT true, error text, user_rating integer, app_id text, task_type text, created_at timestamptz DEFAULT now())` },
    { name: 'javari_model_stats', sql: `CREATE TABLE IF NOT EXISTS javari_model_stats (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, model text UNIQUE NOT NULL, provider text, total_calls integer DEFAULT 0, success_calls integer DEFAULT 0, total_cost numeric(12,6) DEFAULT 0, avg_latency_ms integer DEFAULT 0, last_used timestamptz DEFAULT now())` },
    { name: 'javari_insights', sql: `CREATE TABLE IF NOT EXISTS javari_insights (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, action_type text, model_used text, user_rating integer, insight text, created_at timestamptz DEFAULT now())` },
    { name: 'spirit_collection', sql: `CREATE TABLE IF NOT EXISTS spirit_collection (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, name text NOT NULL, distillery text, age integer, abv numeric(5,2), purchase_price numeric(10,2), current_value numeric(10,2), notes text, category text DEFAULT 'whisky', created_at timestamptz DEFAULT now())` },
    { name: 'checkout_sessions', sql: `CREATE TABLE IF NOT EXISTS checkout_sessions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, session_id text UNIQUE, price_key text, price_id text, credits integer DEFAULT 0, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), completed_at timestamptz)` },
    { name: 'paypal_subscriptions', sql: `CREATE TABLE IF NOT EXISTS paypal_subscriptions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, subscription_id text, plan_id text, status text DEFAULT 'pending', created_at timestamptz DEFAULT now())` },
  ]

  for (const t of tables) {
    const { error } = await supabase.rpc('exec_sql' as any, { query: t.sql }).catch(() => ({ error: null }))
    // Try direct approach
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${t.name}?limit=0`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` }
      })
      results[t.name] = res.ok ? 'exists' : 'needs_creation'
    } catch { results[t.name] = 'unknown' }
  }

  return NextResponse.json({ tables: results, note: 'Tables need manual creation via Supabase SQL editor' })
}
