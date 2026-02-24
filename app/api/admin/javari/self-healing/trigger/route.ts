import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAsync } from '@/lib/error-handler';
import { isDefined } from '@/lib/typescript-helpers';

export async function POST(request: Request) {
  return await safeAsync(
    async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !isDefined(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Trigger self-healing process
      const { data, error } = await supabase
        .from('javari_healing_history')
        .insert({
          user_id: user.id,
          status: 'triggered',
          triggered_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ 
        success: true, 
        message: 'Self-healing triggered',
        job_id: data.id 
      });
    },
    { file: 'admin/javari/self-healing/trigger/route.ts', function: 'POST' },
    NextResponse.json({ error: 'Failed to trigger' }, { status: 500 })
  ) || NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
