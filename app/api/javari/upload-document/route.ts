import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { title, content, category, tags } = await req.json()

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Insert document into database
    const { data, error } = await supabase
      .from('documentation_system_docs')
      .insert({
        title,
        content,
        category: category || 'ai-learning',
        status: 'published',
        tags: tags || ['manual-upload'],
        created_by: 'admin',
        learned_by_javari: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting document:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to insert document' },
        { status: 500 }
      )
    }

    // Database trigger will automatically queue this for learning
    // No manual queue insertion needed!

    return NextResponse.json({
      success: true,
      doc_id: data.id,
      message: 'Document uploaded and queued for learning',
    })
  } catch (error) {
    console.error('Error in upload-document API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
