/**
 * Javari AI - Web Crawl Cron
 * Autonomous documentation crawler that stores knowledge directly
 * 
 * Created: December 13, 2025 - 1:35 AM EST
 * Endpoint: /api/cron/web-crawl
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes max for crawling

// ============================================================
// DOCUMENTATION SOURCES
// ============================================================
const DOC_SOURCES = [
  // Priority 1: Core Stack
  { 
    name: 'Next.js App Router', 
    url: 'https://nextjs.org/docs/app', 
    category: 'framework',
    subcategory: 'nextjs'
  },
  { 
    name: 'React Hooks', 
    url: 'https://react.dev/reference/react', 
    category: 'framework',
    subcategory: 'react'
  },
  { 
    name: 'TypeScript Handbook', 
    url: 'https://www.typescriptlang.org/docs/handbook/intro.html', 
    category: 'language',
    subcategory: 'typescript'
  },
  { 
    name: 'Tailwind CSS', 
    url: 'https://tailwindcss.com/docs/utility-first', 
    category: 'styling',
    subcategory: 'tailwind'
  },
  { 
    name: 'Supabase Auth', 
    url: 'https://supabase.com/docs/guides/auth', 
    category: 'backend',
    subcategory: 'supabase'
  },
  { 
    name: 'Supabase Database', 
    url: 'https://supabase.com/docs/guides/database', 
    category: 'backend',
    subcategory: 'supabase'
  },
  { 
    name: 'Vercel Deployment', 
    url: 'https://vercel.com/docs/deployments/overview', 
    category: 'deployment',
    subcategory: 'vercel'
  },
  // Priority 2: AI APIs
  { 
    name: 'OpenAI API Reference', 
    url: 'https://platform.openai.com/docs/api-reference/introduction', 
    category: 'ai',
    subcategory: 'openai'
  },
  { 
    name: 'Anthropic Claude API', 
    url: 'https://docs.anthropic.com/en/api/getting-started', 
    category: 'ai',
    subcategory: 'anthropic'
  },
  // Priority 3: JavaScript/Web
  { 
    name: 'MDN JavaScript', 
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', 
    category: 'language',
    subcategory: 'javascript'
  },
  { 
    name: 'MDN Web APIs', 
    url: 'https://developer.mozilla.org/en-US/docs/Web/API', 
    category: 'web',
    subcategory: 'browser-apis'
  },
  { 
    name: 'Node.js Documentation', 
    url: 'https://nodejs.org/docs/latest/api/', 
    category: 'runtime',
    subcategory: 'nodejs'
  }
];

// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Extract clean text content from HTML
 */
function extractTextContent(html: string): { title: string; content: string; headings: string[] } {
  // Remove scripts, styles, nav, footer
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Extract title
  const titleMatch = clean.match(/<h1[^>]*>(.*?)<\/h1>/i) || 
                     clean.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = (titleMatch?.[1] || 'Documentation')
    .replace(/<[^>]+>/g, '')
    .trim()
    .substring(0, 200);

  // Extract headings for context
  const headingMatches = clean.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi);
  const headings: string[] = [];
  for (const match of headingMatches) {
    const heading = match[1].replace(/<[^>]+>/g, '').trim();
    if (heading && heading.length < 100) {
      headings.push(heading);
    }
  }

  // Extract main content area
  const mainMatch = clean.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                    clean.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    clean.match(/<div[^>]*class="[^"]*(?:content|main|docs)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  
  const contentHtml = mainMatch?.[1] || clean;

  // Convert to plain text
  const content = contentHtml
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return { 
    title, 
    content: content.substring(0, 8000), // Limit for storage
    headings: headings.slice(0, 10) 
  };
}

/**
 * Generate keywords from content
 */
function generateKeywords(content: string, subcategory: string): string[] {
  const words = content.toLowerCase().split(/\W+/);
  const freq: Record<string, number> = {};
  
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'and', 'but', 'or', 'if', 'then', 'than', 'so', 'that', 'this',
    'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they',
    'their', 'not', 'no', 'yes', 'just', 'only', 'also', 'very', 'more',
    'most', 'some', 'any', 'all', 'each', 'every', 'both', 'few', 'many'
  ]);

  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word) && !/^\d+$/.test(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  // Always include subcategory
  if (!keywords.includes(subcategory)) {
    keywords.unshift(subcategory);
  }

  return keywords;
}

/**
 * Store knowledge entry in Supabase
 */
async function storeKnowledge(entry: {
  category: string;
  subcategory: string;
  title: string;
  content: string;
  keywords: string[];
  source_type: string;
  source_url: string;
  confidence_score: number;
}): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    return false;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/javari_knowledge`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(entry)
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to store knowledge:', error);
    return false;
  }
}

/**
 * Crawl a single documentation page
 */
async function crawlPage(source: typeof DOC_SOURCES[0]): Promise<{
  success: boolean;
  title?: string;
  error?: string;
}> {
  try {
    console.log(`🕷️ Crawling: ${source.name}`);

    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'JavariAI/1.0 (Documentation Learning Bot; https://javariai.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const { title, content, headings } = extractTextContent(html);

    if (content.length < 200) {
      return { success: false, error: 'Content too short' };
    }

    const keywords = generateKeywords(content, source.subcategory);

    // Create knowledge entry
    const entry = {
      category: source.category,
      subcategory: source.subcategory,
      title: `[${source.subcategory.toUpperCase()}] ${title}`,
      content: `Documentation source: ${source.name}\n\nKey topics: ${headings.join(', ')}\n\n${content}`,
      keywords,
      source_type: 'web_crawl',
      source_url: source.url,
      confidence_score: 0.85
    };

    const stored = await storeKnowledge(entry);

    if (stored) {
      console.log(`✅ Stored: ${title}`);
      return { success: true, title };
    } else {
      return { success: false, error: 'Failed to store' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error crawling ${source.name}:`, message);
    return { success: false, error: message };
  }
}

// ============================================================
// API HANDLERS
// ============================================================

/**
 * GET - Status and configuration
 */
export async function GET() {
  // Count existing web_crawl entries
  let crawledCount = 0;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/javari_knowledge?source_type=eq.web_crawl&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      crawledCount = Array.isArray(data) ? data.length : 0;
    }
  } catch {
    // Ignore errors
  }

  return NextResponse.json({
    endpoint: '/api/cron/web-crawl',
    description: 'Javari AI Documentation Web Crawler',
    status: 'ready',
    configured_sources: DOC_SOURCES.length,
    crawled_entries: crawledCount,
    sources: DOC_SOURCES.map(s => ({
      name: s.name,
      category: s.category,
      subcategory: s.subcategory
    })),
    trigger: 'POST with CRON_SECRET header or Vercel cron'
  });
}

/**
 * POST - Trigger crawl
 */
export async function POST(request: Request) {
  // Verify cron secret for production
  if (process.env.NODE_ENV === 'production') {
    const secret = request.headers.get('x-cron-secret') || 
                   request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('🚀 Starting documentation web crawl...');

  // Parse optional filters
  let limit = 3; // Default: crawl 3 sources per run
  try {
    const body = await request.json();
    if (body.limit && typeof body.limit === 'number') {
      limit = Math.min(body.limit, 12); // Max 12 per run
    }
  } catch {
    // Use defaults
  }

  // Shuffle sources for variety
  const shuffled = [...DOC_SOURCES].sort(() => Math.random() - 0.5);
  const toProcess = shuffled.slice(0, limit);

  const results: Array<{
    source: string;
    success: boolean;
    title?: string;
    error?: string;
  }> = [];

  for (const source of toProcess) {
    const result = await crawlPage(source);
    results.push({
      source: source.name,
      ...result
    });

    // Respectful delay between requests
    await new Promise(r => setTimeout(r, 1500));
  }

  const successCount = results.filter(r => r.success).length;

  // Log to learning queue
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/javari_learning_queue`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_type: 'web_crawl',
        status: 'completed',
        metadata: {
          sources_attempted: toProcess.length,
          sources_succeeded: successCount,
          timestamp: new Date().toISOString()
        }
      })
    });
  } catch {
    // Ignore logging errors
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      attempted: toProcess.length,
      succeeded: successCount,
      failed: toProcess.length - successCount
    },
    results
  });
}
