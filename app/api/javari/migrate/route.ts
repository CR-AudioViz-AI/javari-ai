import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    // Create table via raw SQL
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.javari_roadmap (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'blocked')),
          priority INTEGER DEFAULT 0,
          category TEXT,
          assigned_to TEXT,
          evidence_links TEXT[],
          metadata JSONB DEFAULT '{}'::jsonb
        );
        
        ALTER TABLE public.javari_roadmap ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable all operations for javari_roadmap" ON public.javari_roadmap;
        CREATE POLICY "Enable all operations for javari_roadmap" 
        ON public.javari_roadmap 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
      `
    });

    if (createError) throw createError;

    // Insert initial data
    const { error: insertError } = await supabase
      .from('javari_roadmap')
      .upsert([
        { title: 'GitHub Write Access', description: 'Autonomous PR creation', status: 'completed', priority: 10, category: 'automation' },
        { title: 'Roadmap Tracking', description: 'Database-backed tracking', status: 'in_progress', priority: 9, category: 'infrastructure' },
        { title: 'Migration Complete', description: 'Table created', status: 'completed', priority: 8, category: 'infrastructure' }
      ], { onConflict: 'title' });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, message: 'Migration complete' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
