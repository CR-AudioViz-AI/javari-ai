// =============================================================================
// JAVARI KNOWLEDGE INGESTION & SEARCH API
// =============================================================================
// Phase 1 of JAVARI_TOP_AI_PATH - Building Javari's Brain
// Implements: POST /api/learning/ingest + GET /api/learning/search
// Created: January 8, 2026 - 11:10 AM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// INITIALIZATION
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

type SourceType = 'chat' | 'doc' | 'repo' | 'api' | 'web';

interface IngestRequest {
  source_type: SourceType;
  source_name: string;
  source_url?: string | null;
  license_or_tos_url?: string | null;
  content_type: string;
  raw_content: unknown;
  tags?: string[];
}

interface KnowledgeItem {
  id: string;
  source_type: SourceType;
  source_name: string;
  source_url: string | null;
  license_url: string | null;
  content_json: unknown;
  content_text: string;
  content_hash: string;
  tags: string[];
  created_at: string;
}

interface SearchResult {
  id: string;
  snippet: string;
  source_name: string;
  source_url: string | null;
  source_type: SourceType;
  created_at: string;
  confidence: number;
  tags: string[];
}

// =============================================================================
// ALLOWED SOURCES (from JAVARI_KNOWLEDGE_POLICY.md)
// =============================================================================

const ALLOWED_SOURCE_NAMES = new Set([
  // Tier 1: Internal
  'github-repo',
  'vercel-logs',
  'supabase-data',
  'user-upload',
  'chat-transcript',
  
  // Tier 2: Documentation
  'mdn-web-docs',
  'react-docs',
  'nextjs-docs',
  'typescript-docs',
  'tailwind-docs',
  'supabase-docs',
  'vercel-docs',
  'nodejs-docs',
  
  // Tier 2: Security
  'github-advisory',
  'npm-advisory',
  'cve-database',
  
  // Tier 3: Model Outputs
  'claude',
  'chatgpt',
  'copilot',
  'gemini',
  'perplexity',
  
  // Internal systems
  'javari-learning',
  'cr-audioviz-internal'
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateContentHash(content: unknown): string {
  const stringContent = typeof content === 'string' 
    ? content 
    : JSON.stringify(content);
  return crypto.createHash('sha256').update(stringContent).digest('hex');
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.slice(0, 50000); // Limit to 50KB
  }
  if (typeof content === 'object' && content !== null) {
    return JSON.stringify(content, null, 2).slice(0, 50000);
  }
  return String(content).slice(0, 50000);
}

function normalizeSourceName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function validateSourceType(type: string): type is SourceType {
  return ['chat', 'doc', 'repo', 'api', 'web'].includes(type);
}

// =============================================================================
// POST /api/learning/ingest - Ingest new knowledge
// =============================================================================

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  try {
    const body: IngestRequest = await request.json();
    
    // ==========================================================================
    // VALIDATION
    // ==========================================================================
    
    // Check required fields
    if (!body.source_type || !body.source_name || !body.content_type || body.raw_content === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: source_type, source_name, content_type, raw_content',
        timestamp
      }, { status: 400 });
    }
    
    // Validate source_type
    if (!validateSourceType(body.source_type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid source_type. Must be one of: chat, doc, repo, api, web`,
        timestamp
      }, { status: 400 });
    }
    
    // Normalize and validate source_name
    const normalizedSourceName = normalizeSourceName(body.source_name);
    
    // Check if source is allowed
    const isAllowed = ALLOWED_SOURCE_NAMES.has(normalizedSourceName) ||
                      normalizedSourceName.startsWith('cr-audioviz') ||
                      normalizedSourceName.startsWith('javari-');
    
    if (!isAllowed) {
      // Log rejection for audit
      await supabase.from('javari_ingestion_logs').insert({
        timestamp,
        source_type: body.source_type,
        source_name: normalizedSourceName,
        source_url: body.source_url || null,
        status: 'rejected',
        reason: `Source "${normalizedSourceName}" is not in allowed sources list`,
        ingested_by: 'api'
      });
      
      return NextResponse.json({
        success: false,
        error: `Source "${normalizedSourceName}" is not in the allowed sources list. See JAVARI_KNOWLEDGE_POLICY.md`,
        timestamp
      }, { status: 403 });
    }
    
    // External sources require license/ToS URL
    const isExternal = ['doc', 'api', 'web'].includes(body.source_type);
    if (isExternal && !body.license_or_tos_url) {
      return NextResponse.json({
        success: false,
        error: 'External sources require license_or_tos_url for compliance',
        timestamp
      }, { status: 400 });
    }
    
    // ==========================================================================
    // DUPLICATE CHECK
    // ==========================================================================
    
    const contentHash = generateContentHash(body.raw_content);
    
    const { data: existing } = await supabase
      .from('javari_knowledge_items')
      .select('id')
      .eq('content_hash', contentHash)
      .single();
    
    if (existing) {
      // Log as duplicate
      await supabase.from('javari_ingestion_logs').insert({
        timestamp,
        source_type: body.source_type,
        source_name: normalizedSourceName,
        source_url: body.source_url || null,
        status: 'duplicate',
        reason: `Content already exists with hash: ${contentHash.slice(0, 16)}...`,
        content_hash: contentHash,
        ingested_by: 'api'
      });
      
      return NextResponse.json({
        success: true,
        duplicate: true,
        existing_id: existing.id,
        message: 'Content already exists in knowledge base',
        timestamp
      }, { status: 200 });
    }
    
    // ==========================================================================
    // INGEST
    // ==========================================================================
    
    const contentText = extractTextContent(body.raw_content);
    const tags = body.tags || [];
    
    // Add automatic tags based on source
    if (!tags.includes(body.source_type)) {
      tags.push(body.source_type);
    }
    if (!tags.includes(normalizedSourceName)) {
      tags.push(normalizedSourceName);
    }
    
    const { data: inserted, error: insertError } = await supabase
      .from('javari_knowledge_items')
      .insert({
        source_type: body.source_type,
        source_name: normalizedSourceName,
        source_url: body.source_url || null,
        license_url: body.license_or_tos_url || null,
        content_json: body.raw_content,
        content_text: contentText,
        content_hash: contentHash,
        tags,
        created_at: timestamp
      })
      .select('id')
      .single();
    
    if (insertError) {
      // Log error
      await supabase.from('javari_ingestion_logs').insert({
        timestamp,
        source_type: body.source_type,
        source_name: normalizedSourceName,
        source_url: body.source_url || null,
        status: 'error',
        reason: insertError.message,
        ingested_by: 'api'
      });
      
      return NextResponse.json({
        success: false,
        error: `Database error: ${insertError.message}`,
        timestamp
      }, { status: 500 });
    }
    
    // Log success
    await supabase.from('javari_ingestion_logs').insert({
      timestamp,
      source_type: body.source_type,
      source_name: normalizedSourceName,
      source_url: body.source_url || null,
      status: 'success',
      content_hash: contentHash,
      ingested_by: 'api'
    });
    
    return NextResponse.json({
      success: true,
      id: inserted.id,
      content_hash: contentHash,
      tags,
      message: 'Knowledge ingested successfully',
      timestamp
    }, { status: 201 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: `Ingestion failed: ${errorMessage}`,
      timestamp
    }, { status: 500 });
  }
}

// =============================================================================
// GET /api/learning/ingest?q=...&k=10 - Search knowledge base
// =============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const k = Math.min(parseInt(searchParams.get('k') || '10'), 50);
    const sourceType = searchParams.get('source_type');
    const tag = searchParams.get('tag');
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter "q" is required',
        timestamp
      }, { status: 400 });
    }
    
    // ==========================================================================
    // SEARCH STRATEGY
    // ==========================================================================
    
    // Split query into words for flexible matching
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Build the search query
    let dbQuery = supabase
      .from('javari_knowledge_items')
      .select('id, source_type, source_name, source_url, content_text, tags, created_at');
    
    // Filter by source type if specified
    if (sourceType && validateSourceType(sourceType)) {
      dbQuery = dbQuery.eq('source_type', sourceType);
    }
    
    // Filter by tag if specified
    if (tag) {
      dbQuery = dbQuery.contains('tags', [tag]);
    }
    
    // Text search using ilike for flexibility
    // In production, this should use pg_trgm or full-text search
    if (queryWords.length > 0) {
      const searchPattern = `%${queryWords.join('%')}%`;
      dbQuery = dbQuery.ilike('content_text', searchPattern);
    }
    
    const { data: results, error: searchError } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(k);
    
    if (searchError) {
      return NextResponse.json({
        success: false,
        error: `Search failed: ${searchError.message}`,
        timestamp
      }, { status: 500 });
    }
    
    // ==========================================================================
    // FORMAT RESULTS
    // ==========================================================================
    
    const formattedResults: SearchResult[] = (results || []).map((item, index) => {
      // Extract a relevant snippet around the query terms
      const text = item.content_text || '';
      let snippet = '';
      
      // Find the first occurrence of any query word
      const lowerText = text.toLowerCase();
      let snippetStart = 0;
      
      for (const word of queryWords) {
        const pos = lowerText.indexOf(word);
        if (pos !== -1) {
          snippetStart = Math.max(0, pos - 100);
          break;
        }
      }
      
      snippet = text.slice(snippetStart, snippetStart + 300);
      if (snippetStart > 0) snippet = '...' + snippet;
      if (snippetStart + 300 < text.length) snippet = snippet + '...';
      
      // Calculate a simple relevance score
      const confidence = Math.max(0.5, 1 - (index * 0.05));
      
      return {
        id: item.id,
        snippet: snippet.trim(),
        source_name: item.source_name,
        source_url: item.source_url,
        source_type: item.source_type as SourceType,
        created_at: item.created_at,
        confidence: Math.round(confidence * 100) / 100,
        tags: item.tags || []
      };
    });
    
    return NextResponse.json({
      success: true,
      query,
      count: formattedResults.length,
      results: formattedResults,
      timestamp
    }, { status: 200 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: `Search failed: ${errorMessage}`,
      timestamp
    }, { status: 500 });
  }
}
