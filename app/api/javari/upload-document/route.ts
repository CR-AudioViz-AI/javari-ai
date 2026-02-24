import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, content, category = 'ai-learning', metadata = {} } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Insert document into documentation_system_docs
    const { data: doc, error: insertError } = await supabase
      .from('documentation_system_docs')
      .insert({
        title,
        content,
        category,
        metadata: {
          ...metadata,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
          source: 'api_upload'
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting document:', insertError)
      return NextResponse.json(
        { error: 'Failed to save document', details: insertError.message },
        { status: 500 }
      )
    }

    // Database trigger automatically adds to javari_document_queue
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully and queued for learning',
      document: {
        id: doc.id,
        title: doc.title,
        category: doc.category
      }
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check learning status
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get document ID from query params
    const searchParams = request.nextUrl.searchParams
    const docId = searchParams.get('id')

    if (!docId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      )
    }

    // Check if document has been learned
    const { data: doc, error } = await supabase
      .from('documentation_system_docs')
      .select('id, title, learned_by_javari, javari_confidence_score, created_at')
      .eq('id', docId)
      .single()

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check queue status
    const { data: queueItem } = await supabase
      .from('javari_document_queue')
      .select('status, priority, processed_at')
      .eq('document_id', docId)
      .single()

    return NextResponse.json({
      document: doc,
      queue_status: queueItem?.status || 'not_queued',
      processed: doc.learned_by_javari,
      confidence: doc.javari_confidence_score,
      queued_at: doc.created_at,
      processed_at: queueItem?.processed_at
    })
  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
