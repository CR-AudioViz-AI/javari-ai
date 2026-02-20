// app/api/javari/modules/migrate/route.ts
// One-time migration: create javari_modules registry table
// POST /api/javari/modules/migrate — idempotent (CREATE TABLE IF NOT EXISTS)
// 2026-02-19 — TASK-P1-003

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(): Promise<NextResponse> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supaUrl || !supaKey) {
    return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
  }

  const migrations = [
    // 1. Create the javari_modules registry table
    `
    CREATE TABLE IF NOT EXISTS public.javari_modules (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      family TEXT NOT NULL,
      types TEXT[] DEFAULT \'{}\',
      credits_per_use INTEGER DEFAULT 0,
      min_plan TEXT DEFAULT \'free\',
      status TEXT DEFAULT \'ready\',
      version TEXT DEFAULT \'1.0.0\',
      ui_path TEXT,
      api_path TEXT,
      db_table TEXT,
      commit_sha TEXT,
      deploy_url TEXT,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
    `,
    // 2. Enable RLS
    `ALTER TABLE public.javari_modules ENABLE ROW LEVEL SECURITY`,
    // 3. Read policy (public)
    `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = \'javari_modules\'
        AND policyname = \'Anyone can read modules\'
      ) THEN
        CREATE POLICY "Anyone can read modules"
          ON public.javari_modules FOR SELECT USING (true);
      END IF;
    END $$
    `,
    // 4. Write policy (service role only)
    `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = \'javari_modules\'
        AND policyname = \'Service role can manage modules\'
      ) THEN
        CREATE POLICY "Service role can manage modules"
          ON public.javari_modules FOR ALL
          USING (auth.role() = \'service_role\');
      END IF;
    END $$
    `,
    // 5. Indexes
    `CREATE INDEX IF NOT EXISTS idx_javari_modules_slug ON public.javari_modules(slug)`,
    `CREATE INDEX IF NOT EXISTS idx_javari_modules_family ON public.javari_modules(family)`,
    `CREATE INDEX IF NOT EXISTS idx_javari_modules_status ON public.javari_modules(status)`,
    // 6. updated_at trigger function
    `
    CREATE OR REPLACE FUNCTION update_javari_modules_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql
    `,
    // 7. Trigger
    `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = \'trigger_javari_modules_updated_at\'
      ) THEN
        CREATE TRIGGER trigger_javari_modules_updated_at
          BEFORE UPDATE ON public.javari_modules
          FOR EACH ROW EXECUTE FUNCTION update_javari_modules_updated_at();
      END IF;
    END $$
    `,
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of migrations) {
    const trimmed = sql.trim();
    try {
      const res = await fetch(
        `${supaUrl}/rest/v1/rpc/exec_sql`,
        {
          method: 'POST',
          headers: {
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql: trimmed }),
        }
      );
      const text = await res.text();
      const ok = res.ok || text === '' || text === 'null' || text === '[]';
      results.push({ sql: trimmed.slice(0, 80), ok, ...(!ok ? { error: text.slice(0, 200) } : {}) });
    } catch (err) {
      results.push({ sql: trimmed.slice(0, 80), ok: false, error: String(err) });
    }
  }

  // Verify table now exists
  const verifyRes = await fetch(
    `${supaUrl}/rest/v1/javari_modules?limit=0&select=id`,
    {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        Prefer: 'count=exact',
      },
    }
  );
  const tableExists = verifyRes.ok;

  return NextResponse.json({
    success: tableExists,
    tableExists,
    migrations: results,
    message: tableExists
      ? 'javari_modules table ready'
      : 'Migration ran but table verification failed — check exec_sql function availability',
  });
}

export async function GET(): Promise<NextResponse> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const res = await fetch(
    `${supaUrl}/rest/v1/javari_modules?limit=5&select=id,slug,name,status,version`,
    {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        Prefer: 'count=exact',
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({
      exists: false,
      error: text.slice(0, 200),
      message: 'Table does not exist — POST to this endpoint to create it',
    });
  }

  const rows = await res.json() as unknown[];
  const count = res.headers.get('content-range')?.split('/')[1] ?? '?';

  return NextResponse.json({
    exists: true,
    totalModules: count,
    recentModules: rows,
    message: `javari_modules ready — ${count} modules registered`,
  });
}
