import { logError, formatApiError } from "@/lib/utils/error-handler";
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    const sessionId = formData.get('sessionId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()

    // Generate title from filename
    const title = file.name.replace(/\.[^/.]+$/, '')

    // Insert document
    const { data: doc, error: docError } = await supabase
      .from('documentation_system_docs')
      .insert({
        title: `Chat Upload: ${title}`,
        content: text,
        category: 'ai-learning',
        status: 'published',
        tags: ['chat-upload', 'user-submitted'],
        created_by: userId || 'user',
        learned_by_javari: false,
      })
      .select()
      .single()

    if (docError) {
      console.error('Error inserting document:', docError)
      return NextResponse.json(
        { success: false, error: 'Failed to save document' },
        { status: 500 }
      )
    }

    // Create chat message confirming upload
    const { error: msgError } = await supabase
      .from('javari_chat_sessions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        role: 'assistant',
        content: `✅ I've received your document "${title}" (${text.length.toLocaleString()} characters). I've added it to my learning queue and will study it within the next 4 hours. Once processed, I'll have full knowledge of its contents and can answer questions about it!`,
        metadata: {
          type: 'document_upload',
          doc_id: doc.id,
          filename: file.name,
          size: text.length,
        },
      })

    if (msgError) {
      console.error('Error creating message:', msgError)
    }

    return NextResponse.json({
      success: true,
      doc_id: doc.id,
      message: `Document "${title}" uploaded and queued for learning`,
      response: `✅ I've received your document "${title}" (${text.length.toLocaleString()} characters). I've added it to my learning queue and will study it within the next 4 hours. Once processed, I'll have full knowledge of its contents and can answer questions about it!`,
    })
  } catch (error: unknown) {
    console.error('Error in chat file upload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
