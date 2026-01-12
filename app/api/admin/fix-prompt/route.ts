// app/api/admin/fix-prompt/route.ts
// Emergency fix: Remove document upload instructions from system prompt
// The UI already has drag-drop and + button - don't ask users to upload

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Update system prompt to remove upload requests
    const { error } = await supabase.rpc('update_system_prompt_remove_upload_text');

    if (error) {
      // Fallback: direct SQL update
      const { error: sqlError } = await supabase
        .from('system_prompts')
        .update({
          content: supabase.raw(`
            REPLACE(
              REPLACE(content, 
                'Upload documents on the right, or paste document packs directly into chat. I''ll help you analyze them with citations. What would you like to work on?',
                'What can I help you build today?'
              ),
              'Upload documents',
              'I''m ready to help'
            )
          `),
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true);

      if (sqlError) {
        return NextResponse.json({ 
          error: 'Could not update prompt', 
          details: sqlError.message 
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'System prompt fixed - removed upload requests',
      note: 'UI already has drag-drop and + button for documents'
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Fix failed', 
      details: error.message 
    }, { status: 500 });
  }
}
