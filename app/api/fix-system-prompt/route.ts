// app/api/fix-system-prompt/route.ts
// Emergency endpoint to remove document upload instructions from database
// Created: January 12, 2026

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get the current system prompt from database
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('system_prompts')
      .select('*')
      .eq('is_active', true)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Could not fetch current prompt', details: fetchError.message }, { status: 500 });
    }

    // Remove document upload instructions
    let updatedContent = currentPrompt.content;
    
    // Remove variations of the upload message
    updatedContent = updatedContent.replace(/Upload documents on the right.*?citations\./gi, '');
    updatedContent = updatedContent.replace(/upload.*?documents.*?panel.*?right/gi, '');
    updatedContent = updatedContent.replace(/paste document packs directly into chat/gi, '');
    
    // Update the database
    const { error: updateError } = await supabase
      .from('system_prompts')
      .update({ 
        content: updatedContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentPrompt.id);

    if (updateError) {
      return NextResponse.json({ error: 'Could not update prompt', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Document upload instructions removed from system prompt',
      updated_at: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  }
}
