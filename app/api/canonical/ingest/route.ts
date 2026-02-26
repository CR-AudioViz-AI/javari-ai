import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { embedText } from '@/lib/canonical/embed'
import { chunkMarkdown } from '@/lib/canonical/chunk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for full ingestion

async function listR2Files() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = 'cold-storage'
  const prefix = 'consolidation-docs/'

  const response = await fetch(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}?list-type=2&prefix=${prefix}`,
    {
      headers: {
        'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/...`,
      }
    }
  )
  // Simplified - will use direct S3 client
  return []
}

export async function POST() {
  const start = Date.now()
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // R2 configuration
    const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const bucket = 'cold-storage'
    const prefix = 'consolidation-docs/'

    // Get list of files from R2
    const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3')
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })

    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })

    const listResult = await s3Client.send(listCommand)
    const files = (listResult.Contents || []).filter(f => f.Key?.endsWith('.md'))

    let docsProcessed = 0
    let chunksCreated = 0
    const failures: string[] = []

    for (const file of files) {
      if (!file.Key) continue

      try {
        // Fetch file content
        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: file.Key,
        })
        const result = await s3Client.send(getCommand)
        const text = await result.Body?.transformToString() || ''

        if (!text.trim()) continue

        // Chunk the document
        const chunks = chunkMarkdown(text)
        if (!chunks.length) continue

        // Insert canonical_docs entry
        const { data: doc, error: docError } = await supabase
          .from('canonical_docs')
          .upsert({
            r2_key: file.Key,
            size_bytes: text.length,
            chunk_count: chunks.length,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'r2_key' })
          .select()
          .single()

        if (docError) throw docError

        // Delete existing chunks for this doc
        await supabase
          .from('canonical_doc_chunks')
          .delete()
          .eq('doc_id', doc.id)

        // Generate embeddings and store chunks
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const embedResult = await embedText(chunk)
          
          const { error: chunkError } = await supabase
            .from('canonical_doc_chunks')
            .insert({
              doc_id: doc.id,
              chunk_index: i,
              chunk_text: chunk,
              embedding: embedResult.embedding,
            })

          if (chunkError) throw chunkError
          chunksCreated++
        }

        docsProcessed++
      } catch (err: any) {
        failures.push(`${file.Key}: ${err.message}`)
        continue
      }
    }

    return NextResponse.json({
      ok: true,
      docsProcessed,
      chunksCreated,
      failures,
      durationMs: Date.now() - start,
    })

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      durationMs: Date.now() - start,
    }, { status: 500 })
  }
}
