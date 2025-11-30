// lib/javari-knowledge-ingestion.ts
// Automatic knowledge ingestion from docs, repos, and web
// Timestamp: 2025-11-30 04:45 AM EST

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// DOCUMENT CHUNKING
// =====================================================

interface Chunk {
  content: string;
  metadata: {
    source: string;
    url?: string;
    title?: string;
    section?: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

function chunkDocument(
  content: string,
  source: string,
  maxChunkSize: number = 1500,
  overlap: number = 200
): Chunk[] {
  const chunks: Chunk[] = [];
  
  // Split by headers first if markdown
  const sections = content.split(/(?=^#{1,3}\s)/m);
  
  let chunkIndex = 0;
  
  for (const section of sections) {
    if (section.trim().length === 0) continue;
    
    // Extract section title
    const titleMatch = section.match(/^(#{1,3})\s+(.+?)$/m);
    const sectionTitle = titleMatch ? titleMatch[2].trim() : undefined;
    
    // If section is small enough, keep it whole
    if (section.length <= maxChunkSize) {
      chunks.push({
        content: section.trim(),
        metadata: {
          source,
          section: sectionTitle,
          chunkIndex,
          totalChunks: 0 // Will update later
        }
      });
      chunkIndex++;
    } else {
      // Split into smaller chunks with overlap
      let start = 0;
      while (start < section.length) {
        let end = start + maxChunkSize;
        
        // Try to end at a sentence boundary
        if (end < section.length) {
          const lastPeriod = section.lastIndexOf('.', end);
          const lastNewline = section.lastIndexOf('\n', end);
          end = Math.max(lastPeriod, lastNewline, start + maxChunkSize / 2);
        }
        
        const chunkContent = section.substring(start, end).trim();
        if (chunkContent.length > 50) {
          chunks.push({
            content: chunkContent,
            metadata: {
              source,
              section: sectionTitle,
              chunkIndex,
              totalChunks: 0
            }
          });
          chunkIndex++;
        }
        
        start = end - overlap;
      }
    }
  }
  
  // Update total chunks
  chunks.forEach(c => c.metadata.totalChunks = chunks.length);
  
  return chunks;
}

// =====================================================
// EMBEDDING GENERATION
// =====================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000) // Limit input size
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts.map(t => t.substring(0, 8000))
    })
  });

  if (!response.ok) {
    throw new Error(`Batch embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

// =====================================================
// DOCUMENT INGESTION
// =====================================================

export interface IngestionResult {
  success: boolean;
  chunksCreated: number;
  knowledgeEntriesCreated: number;
  errors: string[];
}

export async function ingestDocument(
  content: string,
  source: string,
  metadata: {
    url?: string;
    title?: string;
    category?: string;
    topic?: string;
  } = {}
): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: false,
    chunksCreated: 0,
    knowledgeEntriesCreated: 0,
    errors: []
  };

  try {
    // Chunk the document
    const chunks = chunkDocument(content, source);
    
    if (chunks.length === 0) {
      result.errors.push('No chunks created from document');
      return result;
    }

    // Generate embeddings in batches
    const batchSize = 50;
    const embeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = await generateEmbeddingsBatch(batch.map(c => c.content));
      embeddings.push(...batchEmbeddings);
      
      // Rate limiting
      if (i + batchSize < chunks.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Store in database
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const contentHash = crypto.createHash('md5').update(chunk.content).digest('hex');

      // Check if already exists
      const { data: existing } = await supabase
        .from('documentation_chunks')
        .select('id')
        .eq('content_hash', contentHash)
        .single();

      if (existing) continue;

      // Insert chunk
      const { error: chunkError } = await supabase
        .from('documentation_chunks')
        .insert({
          source: source,
          url: metadata.url,
          title: metadata.title || chunk.metadata.section,
          content: chunk.content,
          content_hash: contentHash,
          embedding: embedding,
          metadata: {
            ...chunk.metadata,
            category: metadata.category,
            topic: metadata.topic
          }
        });

      if (chunkError) {
        result.errors.push(`Chunk ${i}: ${chunkError.message}`);
      } else {
        result.chunksCreated++;
      }
    }

    // Extract knowledge entries for important concepts
    const knowledgeEntries = extractKnowledgeEntries(content, metadata);
    
    for (const entry of knowledgeEntries) {
      const { error: knowledgeError } = await supabase
        .from('javari_knowledge')
        .upsert({
          topic: entry.topic,
          subtopic: entry.subtopic,
          concept: entry.concept,
          explanation: entry.explanation,
          examples: entry.examples,
          source: source,
          verified: false,
          tags: entry.tags
        }, {
          onConflict: 'topic,subtopic,concept'
        });

      if (!knowledgeError) {
        result.knowledgeEntriesCreated++;
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(String(error));
    return result;
  }
}

// =====================================================
// KNOWLEDGE EXTRACTION
// =====================================================

interface KnowledgeEntry {
  topic: string;
  subtopic: string;
  concept: string;
  explanation: string;
  examples?: string[];
  tags?: string[];
}

function extractKnowledgeEntries(content: string, metadata: any): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  
  // Extract from markdown headers
  const headerPattern = /^(#{1,3})\s+(.+?)$([\s\S]*?)(?=^#{1,3}\s|\Z)/gm;
  let match;
  
  while ((match = headerPattern.exec(content)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const body = match[3].trim();
    
    if (body.length > 50 && body.length < 2000) {
      entries.push({
        topic: metadata.topic || metadata.category || 'General',
        subtopic: level === 1 ? title : undefined,
        concept: title,
        explanation: body.substring(0, 1000),
        tags: [metadata.source, metadata.category].filter(Boolean)
      });
    }
  }

  // Extract code examples
  const codePattern = /```(\w+)?\n([\s\S]*?)```/g;
  while ((match = codePattern.exec(content)) !== null) {
    const language = match[1] || 'code';
    const code = match[2].trim();
    
    if (code.length > 20 && code.length < 1000) {
      // Find surrounding context
      const beforeCode = content.substring(Math.max(0, match.index - 200), match.index);
      const contextMatch = beforeCode.match(/[.!?]\s*([^.!?]+)$/);
      const context = contextMatch ? contextMatch[1].trim() : 'Code example';
      
      entries.push({
        topic: metadata.topic || 'Development',
        subtopic: language,
        concept: context.substring(0, 100),
        explanation: `Code example in ${language}`,
        examples: [code],
        tags: [language, 'code_example']
      });
    }
  }

  return entries.slice(0, 20); // Limit per document
}

// =====================================================
// GITHUB REPOSITORY SYNC
// =====================================================

export async function syncGitHubRepo(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: false,
    chunksCreated: 0,
    knowledgeEntriesCreated: 0,
    errors: []
  };

  try {
    const token = process.env.GITHUB_TOKEN;
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    // Get repo contents
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const files = data.tree.filter((f: any) => 
      f.type === 'blob' && 
      (f.path.endsWith('.md') || 
       f.path.endsWith('.ts') || 
       f.path.endsWith('.tsx') ||
       f.path === 'README.md' ||
       f.path === 'package.json')
    );

    // Process each file
    for (const file of files.slice(0, 50)) { // Limit files per sync
      try {
        const contentResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
          { headers }
        );

        if (!contentResponse.ok) continue;

        const contentData = await contentResponse.json();
        const content = Buffer.from(contentData.content, 'base64').toString('utf-8');

        // Store in repo_docs
        const contentHash = crypto.createHash('md5').update(content).digest('hex');
        
        const { error } = await supabase
          .from('repository_docs')
          .upsert({
            repo_name: repo,
            repo_full_name: `${owner}/${repo}`,
            file_path: file.path,
            file_type: file.path.split('.').pop(),
            content: content,
            content_hash: contentHash,
            last_synced_at: new Date().toISOString(),
            is_current: true
          }, {
            onConflict: 'repo_full_name,file_path'
          });

        if (!error) {
          result.chunksCreated++;
        }

        // Also ingest as documentation
        if (file.path.endsWith('.md')) {
          const ingestResult = await ingestDocument(content, `github:${owner}/${repo}`, {
            url: `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`,
            title: file.path,
            category: 'repository',
            topic: repo
          });
          result.knowledgeEntriesCreated += ingestResult.knowledgeEntriesCreated;
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (fileError) {
        result.errors.push(`${file.path}: ${fileError}`);
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(String(error));
    return result;
  }
}

// =====================================================
// WEB SCRAPING FOR DOCUMENTATION
// =====================================================

export async function scrapeDocumentation(
  url: string,
  category: string,
  topic: string
): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: false,
    chunksCreated: 0,
    knowledgeEntriesCreated: 0,
    errors: []
  };

  try {
    // Use a simple fetch - in production, use a proper scraper
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Javari-AI-Knowledge-Bot/1.0 (Educational; +https://javariai.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract text content (basic - in production use proper HTML parser)
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (textContent.length < 100) {
      result.errors.push('Not enough content extracted');
      return result;
    }

    // Ingest the content
    const ingestResult = await ingestDocument(textContent, url, {
      url,
      category,
      topic
    });

    return ingestResult;
  } catch (error) {
    result.errors.push(String(error));
    return result;
  }
}

// =====================================================
// SYNC ALL CR AUDIOVIZ REPOSITORIES
// =====================================================

export async function syncAllRepositories(): Promise<{
  totalRepos: number;
  successfulSyncs: number;
  errors: string[];
}> {
  const repos = [
    'crav-website',
    'crav-javari',
    'crav-admin',
    'CRAV-Market-Oracle',
    'barrelverse',
    'cr-realtor-platform',
    'crav-disney-tracker',
    'crav-partner-portal',
    'crav-legalease',
    'crav-pdf-builder',
    'crav-competitive-intelligence',
    'crav-verifyforge',
    'crav-games'
  ];

  const errors: string[] = [];
  let successfulSyncs = 0;

  for (const repo of repos) {
    try {
      const result = await syncGitHubRepo('CR-AudioViz-AI', repo);
      if (result.success) {
        successfulSyncs++;
        console.log(`✅ Synced ${repo}: ${result.chunksCreated} files`);
      } else {
        errors.push(`${repo}: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      errors.push(`${repo}: ${error}`);
    }

    // Rate limiting between repos
    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    totalRepos: repos.length,
    successfulSyncs,
    errors
  };
}

// =====================================================
// KNOWLEDGE SEARCH
// =====================================================

export async function searchKnowledge(
  query: string,
  limit: number = 5
): Promise<{
  results: any[];
  source: 'vector' | 'keyword';
}> {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Vector search
    const { data: vectorResults, error } = await supabase.rpc('match_documentation', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit
    });

    if (!error && vectorResults?.length > 0) {
      return { results: vectorResults, source: 'vector' };
    }

    // Fallback to keyword search
    const { data: keywordResults } = await supabase
      .from('javari_knowledge')
      .select('*')
      .or(`concept.ilike.%${query}%,explanation.ilike.%${query}%`)
      .limit(limit);

    return { results: keywordResults || [], source: 'keyword' };
  } catch (error) {
    console.error('Knowledge search error:', error);
    return { results: [], source: 'keyword' };
  }
}

export default {
  ingestDocument,
  syncGitHubRepo,
  scrapeDocumentation,
  syncAllRepositories,
  searchKnowledge
};
