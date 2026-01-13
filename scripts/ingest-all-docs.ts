// scripts/ingest-all-docs.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Document {
  path: string;
  content: string;
  metadata: {
    type: 'brand' | 'audit' | 'builder' | 'support' | 'knowledge' | 'investor' | 'versions' | 'master';
    app?: string;
    category?: string;
    lastUpdated: string;
  };
}

async function getAllMarkdownFiles(dir: string, baseDir: string = dir): Promise<Document[]> {
  const documents: Document[] = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const subDocs = await getAllMarkdownFiles(fullPath, baseDir);
        documents.push(...subDocs);
      } else if (item.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(baseDir, fullPath);
        
        // Determine document type from path
        let type: Document['metadata']['type'] = 'master';
        let app: string | undefined;
        let category: string | undefined;
        
        if (relativePath.includes('/brand/')) type = 'brand';
        else if (relativePath.includes('/audits/')) type = 'audit';
        else if (relativePath.includes('BUILDER.md')) type = 'builder';
        else if (relativePath.includes('SUPPORT.md')) type = 'support';
        else if (relativePath.includes('KNOWLEDGE.md')) type = 'knowledge';
        else if (relativePath.includes('INVESTOR.md')) type = 'investor';
        else if (relativePath.includes('VERSIONS.md')) type = 'versions';
        
        // Extract app name
        const appMatch = relativePath.match(/\/(\d\d-[^/]+)\/([^/]+)\//);
        if (appMatch) {
          category = appMatch[1];
          app = appMatch[2];
        }
        
        documents.push({
          path: relativePath,
          content,
          metadata: {
            type,
            app,
            category,
            lastUpdated: stat.mtime.toISOString()
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return documents;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // Limit to 8000 chars
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Embedding error:', error);
    return [];
  }
}

async function ingestDocument(doc: Document) {
  try {
    // Generate embedding
    const embedding = await generateEmbedding(doc.content);
    
    // Store in database
    const { error } = await supabase
      .from('javari_knowledge')
      .upsert({
        path: doc.path,
        content: doc.content,
        embedding,
        metadata: doc.metadata,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'path'
      });
    
    if (error) throw error;
    
    console.log(`✅ Ingested: ${doc.path}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to ingest ${doc.path}:`, error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('JAVARI AI - DOCUMENTATION INGESTION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Path to javariverse-hub docs
  const docsPath = path.join(process.cwd(), '../javariverse-hub/docs');
  
  if (!fs.existsSync(docsPath)) {
    console.error('❌ Docs directory not found:', docsPath);
    process.exit(1);
  }
  
  console.log('📂 Scanning documentation directory...');
  const documents = await getAllMarkdownFiles(docsPath);
  
  console.log(`📄 Found ${documents.length} documentation files`);
  console.log('');
  
  let success = 0;
  let failed = 0;
  
  for (const doc of documents) {
    const result = await ingestDocument(doc);
    if (result) success++;
    else failed++;
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('INGESTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${documents.length}`);
}

main().catch(console.error);
