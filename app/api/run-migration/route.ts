import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Migration] Creating 3 missing tables...');

    // SQL for ONLY the 3 missing tables
    const migrations = [
      {
        name: 'user_accounts',
        sql: `
          CREATE TABLE IF NOT EXISTS public.user_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            full_name TEXT,
            avatar_url TEXT,
            credit_balance INTEGER DEFAULT 0,
            subscription_tier TEXT DEFAULT 'free',
            subscription_status TEXT DEFAULT 'inactive',
            stripe_customer_id TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id),
            UNIQUE(email)
          );

          CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON public.user_accounts(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON public.user_accounts(email);
          CREATE INDEX IF NOT EXISTS idx_user_accounts_stripe ON public.user_accounts(stripe_customer_id);

          ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
          
          DROP POLICY IF EXISTS user_accounts_select ON public.user_accounts;
          CREATE POLICY user_accounts_select ON public.user_accounts FOR SELECT USING (auth.uid() = user_id);
          
          DROP POLICY IF EXISTS user_accounts_update ON public.user_accounts;
          CREATE POLICY user_accounts_update ON public.user_accounts FOR UPDATE USING (auth.uid() = user_id);
        `
      },
      {
        name: 'ai_usage_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            cost DECIMAL(10, 6) DEFAULT 0,
            latency_ms INTEGER,
            status TEXT DEFAULT 'success',
            error_message TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_usage_logs(user_id);
          CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON public.ai_usage_logs(model);
          CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage_logs(created_at);
          CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON public.ai_usage_logs(status);

          ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
          
          DROP POLICY IF EXISTS ai_usage_select ON public.ai_usage_logs;
          CREATE POLICY ai_usage_select ON public.ai_usage_logs FOR SELECT USING (auth.uid() = user_id);
        `
      },
      {
        name: 'router_analytics',
        sql: `
          CREATE TABLE IF NOT EXISTS public.router_analytics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            total_cost DECIMAL(10, 4) DEFAULT 0,
            avg_latency_ms INTEGER DEFAULT 0,
            date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, model, provider, date)
          );

          CREATE INDEX IF NOT EXISTS idx_router_analytics_date ON public.router_analytics(date);
          CREATE INDEX IF NOT EXISTS idx_router_analytics_model ON public.router_analytics(model);
          CREATE INDEX IF NOT EXISTS idx_router_analytics_user ON public.router_analytics(user_id);

          ALTER TABLE public.router_analytics ENABLE ROW LEVEL SECURITY;
          
          DROP POLICY IF EXISTS router_analytics_select ON public.router_analytics;
          CREATE POLICY router_analytics_select ON public.router_analytics FOR SELECT USING (auth.uid() = user_id);

          -- Create aggregation function for router analytics
          CREATE OR REPLACE FUNCTION public.aggregate_router_analytics()
          RETURNS TRIGGER AS $$
          BEGIN
            INSERT INTO public.router_analytics (
              user_id, model, provider, success_count, failure_count,
              total_tokens, total_cost, avg_latency_ms, date
            )
            VALUES (
              NEW.user_id, NEW.model, NEW.provider,
              CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END,
              CASE WHEN NEW.status = 'error' THEN 1 ELSE 0 END,
              NEW.total_tokens, NEW.cost, NEW.latency_ms, CURRENT_DATE
            )
            ON CONFLICT (user_id, model, provider, date)
            DO UPDATE SET
              success_count = router_analytics.success_count + CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END,
              failure_count = router_analytics.failure_count + CASE WHEN NEW.status = 'error' THEN 1 ELSE 0 END,
              total_tokens = router_analytics.total_tokens + NEW.total_tokens,
              total_cost = router_analytics.total_cost + NEW.cost,
              avg_latency_ms = ((router_analytics.avg_latency_ms * (router_analytics.success_count + router_analytics.failure_count) + NEW.latency_ms) / 
                               (router_analytics.success_count + router_analytics.failure_count + 1))::INTEGER,
              updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;

          -- Create trigger for auto-aggregation
          DROP TRIGGER IF EXISTS router_analytics_aggregation ON public.ai_usage_logs;
          CREATE TRIGGER router_analytics_aggregation
          AFTER INSERT ON public.ai_usage_logs
          FOR EACH ROW
          EXECUTE FUNCTION public.aggregate_router_analytics();
        `
      }
    ];

    const results = [];

    for (const migration of migrations) {
      console.log(`[Migration] Creating ${migration.name}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql_string: migration.sql
      });

      if (error) {
        console.error(`[Migration] Error creating ${migration.name}:`, error);
        results.push({
          table: migration.name,
          status: 'error',
          message: error.message
        });
      } else {
        console.log(`[Migration] ✅ ${migration.name} created`);
        results.push({
          table: migration.name,
          status: 'success',
          message: 'Table created successfully'
        });
      }
    }

    const allSuccess = results.every(r => r.status === 'success');

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess 
        ? '✅ All 3 missing tables created' 
        : '⚠️ Some tables failed',
      results,
      timestamp: new Date().toISOString()
    }, { status: allSuccess ? 200 : 207 });

  } catch (error: any) {
    console.error('[Migration] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
