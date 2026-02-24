// lib/javari-realtime-intel.ts
// Javari Real-Time Intelligence - Know Everything, Everywhere, All at Once
// Timestamp: 2025-11-30 06:10 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// REAL-TIME DATA SOURCES
// =====================================================

/**
 * Get current news and information using Perplexity
 */
export async function getCurrentIntelligence(query: string): Promise<{
  answer: string;
  sources: string[];
  timestamp: string;
}> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [{
        role: 'user',
        content: `Give me the most current, accurate information about: ${query}. Include specific dates, numbers, and sources.`
      }],
      max_tokens: 2000
    })
  });
  
  const data = await response.json();
  
  return {
    answer: data.choices[0].message.content,
    sources: data.citations || [],
    timestamp: new Date().toISOString()
  };
}

/**
 * Get real-time market data
 */
export async function getMarketData(symbol: string): Promise<any> {
  // Use a free API for basic market data
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
  );
  
  if (!response.ok) {
    return { error: 'Failed to fetch market data' };
  }
  
  const data = await response.json();
  const result = data.chart.result[0];
  
  return {
    symbol,
    price: result.meta.regularMarketPrice,
    previousClose: result.meta.previousClose,
    change: result.meta.regularMarketPrice - result.meta.previousClose,
    changePercent: ((result.meta.regularMarketPrice - result.meta.previousClose) / result.meta.previousClose * 100).toFixed(2),
    timestamp: new Date().toISOString()
  };
}

/**
 * Get weather data
 */
export async function getWeather(location: string): Promise<any> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=28.5383&longitude=-81.3792&current_weather=true`
  );
  
  const data = await response.json();
  
  return {
    location,
    temperature: data.current_weather.temperature,
    windspeed: data.current_weather.windspeed,
    conditions: data.current_weather.weathercode,
    timestamp: new Date().toISOString()
  };
}

// =====================================================
// DOCUMENTATION SCRAPING
// =====================================================

/**
 * Scrape and learn from any documentation URL
 */
export async function scrapeAndLearn(
  url: string,
  topic: string,
  category: string
): Promise<{
  success: boolean;
  entriesCreated: number;
  error?: string;
}> {
  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Javari-AI-Knowledge-Bot/1.0 (Educational)'
      }
    });
    
    if (!response.ok) {
      return { success: false, entriesCreated: 0, error: `Failed to fetch: ${response.status}` };
    }
    
    const html = await response.text();
    
    // Extract text content
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (text.length < 100) {
      return { success: false, entriesCreated: 0, error: 'Not enough content' };
    }
    
    // Extract knowledge entries
    const entries = extractKnowledgeFromText(text, topic, category, url);
    
    // Store in database
    let created = 0;
    for (const entry of entries) {
      const { error } = await supabase
        .from('javari_knowledge')
        .upsert(entry, { onConflict: 'topic,subtopic,concept' });
      
      if (!error) created++;
    }
    
    // Log the crawl
    await supabase.from('learning_queue').insert({
      topic,
      source_type: 'website',
      source_url: url,
      status: 'completed',
      knowledge_entries_created: created,
      completed_at: new Date().toISOString()
    });
    
    return { success: true, entriesCreated: created };
    
  } catch (error: any) {
    return { success: false, entriesCreated: 0, error: error.message };
  }
}

function extractKnowledgeFromText(
  text: string,
  topic: string,
  category: string,
  source: string
): any[] {
  const entries: any[] = [];
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
  
  for (let i = 0; i < Math.min(paragraphs.length, 15); i++) {
    const para = paragraphs[i].trim();
    if (para.length < 50 || para.length > 1500) continue;
    
    // Extract first sentence as concept
    const firstSentence = para.match(/^[^.!?]+[.!?]/);
    const concept = firstSentence ? firstSentence[0].trim() : para.substring(0, 100);
    
    entries.push({
      topic,
      subtopic: category,
      concept: concept.substring(0, 200),
      explanation: para.substring(0, 1000),
      source,
      verified: false,
      tags: [category, 'auto-scraped'],
      keywords: extractKeywords(para)
    });
  }
  
  return entries;
}

function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .filter(w => !['about', 'their', 'would', 'could', 'should', 'there', 'which', 'these', 'those'].includes(w))
    .slice(0, 10);
}

// =====================================================
// GITHUB INTELLIGENCE
// =====================================================

/**
 * Get latest from GitHub repos
 */
export async function getGitHubIntel(owner: string, repo: string): Promise<any> {
  const headers = {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  };
  
  // Get latest commits
  const commitsRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`,
    { headers }
  );
  const commits = await commitsRes.json();
  
  // Get open issues
  const issuesRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=5`,
    { headers }
  );
  const issues = await issuesRes.json();
  
  // Get latest release
  const releaseRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
    { headers }
  );
  const release = await releaseRes.json();
  
  return {
    repo: `${owner}/${repo}`,
    latestCommits: commits.slice(0, 5).map((c: any) => ({
      sha: c.sha.substring(0, 8),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date
    })),
    openIssues: issues.slice(0, 5).map((i: any) => ({
      number: i.number,
      title: i.title,
      state: i.state
    })),
    latestRelease: release.tag_name ? {
      tag: release.tag_name,
      name: release.name,
      date: release.published_at
    } : null
  };
}

// =====================================================
// VERCEL INTELLIGENCE
// =====================================================

/**
 * Get deployment status for all projects
 */
export async function getVercelIntel(): Promise<any[]> {
  const response = await fetch('https://api.vercel.com/v9/projects?limit=50', {
    headers: {
      'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
    }
  });
  
  const data = await response.json();
  
  return data.projects?.map((p: any) => ({
    name: p.name,
    id: p.id,
    framework: p.framework,
    updatedAt: p.updatedAt,
    latestDeployment: p.latestDeployments?.[0]?.readyState
  })) || [];
}

/**
 * Get deployment logs for a specific deployment
 */
export async function getDeploymentLogs(deploymentId: string): Promise<string[]> {
  const response = await fetch(
    `https://api.vercel.com/v2/deployments/${deploymentId}/events`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
      }
    }
  );
  
  const events = await response.json();
  
  return events
    .filter((e: any) => e.text)
    .map((e: any) => e.text)
    .slice(-50);
}

// =====================================================
// STRIPE INTELLIGENCE
// =====================================================

/**
 * Get Stripe account overview
 */
export async function getStripeIntel(secretKey: string): Promise<any> {
  const headers = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  
  // Get balance
  const balanceRes = await fetch('https://api.stripe.com/v1/balance', { headers });
  const balance = await balanceRes.json();
  
  // Get recent charges
  const chargesRes = await fetch('https://api.stripe.com/v1/charges?limit=10', { headers });
  const charges = await chargesRes.json();
  
  // Get customers count
  const customersRes = await fetch('https://api.stripe.com/v1/customers?limit=1', { headers });
  const customers = await customersRes.json();
  
  return {
    balance: balance.available?.[0]?.amount / 100 || 0,
    currency: balance.available?.[0]?.currency || 'usd',
    recentCharges: charges.data?.slice(0, 5).map((c: any) => ({
      id: c.id,
      amount: c.amount / 100,
      status: c.status,
      created: new Date(c.created * 1000).toISOString()
    })),
    hasCustomers: customers.data?.length > 0
  };
}

// =====================================================
// COMPREHENSIVE SITUATION REPORT
// =====================================================

/**
 * Get complete situational awareness
 */
export async function getSituationReport(): Promise<{
  timestamp: string;
  platform: any;
  deployments: any;
  errors: any;
  knowledge: any;
}> {
  // Platform stats
  const { data: knowledge } = await supabase
    .from('admin_knowledge_overview')
    .select('*')
    .single();
  
  // Recent errors
  const { data: errors } = await supabase
    .from('error_tracking')
    .select('error_type, error_message, occurrence_count, last_seen_at')
    .eq('is_resolved', false)
    .order('last_seen_at', { ascending: false })
    .limit(5);
  
  // Bot status
  const { data: bots } = await supabase
    .from('admin_bot_status')
    .select('*');
  
  // App health
  const { data: apps } = await supabase
    .from('admin_app_health')
    .select('*');
  
  return {
    timestamp: new Date().toISOString(),
    platform: {
      totalKnowledge: knowledge?.total_knowledge || 0,
      activeSources: knowledge?.active_sources || 0,
      errorPatterns: knowledge?.error_patterns_count || 0
    },
    deployments: {
      apps: apps?.length || 0,
      healthy: apps?.filter((a: any) => a.status === 'live').length || 0,
      withErrors: apps?.filter((a: any) => a.open_errors > 0).length || 0
    },
    errors: {
      unresolved: errors?.length || 0,
      recent: errors?.slice(0, 3) || []
    },
    knowledge: {
      bots: bots?.length || 0,
      activeBots: bots?.filter((b: any) => b.is_active).length || 0
    }
  };
}

// =====================================================
// AUTO-LEARN FROM QUERY
// =====================================================

/**
 * If Javari doesn't know something, learn it immediately
 */
export async function learnOnDemand(
  query: string,
  topic: string
): Promise<{ learned: boolean; entriesCreated: number }> {
  // Use Perplexity to get current info
  const intel = await getCurrentIntelligence(query);
  
  if (!intel.answer || intel.answer.length < 100) {
    return { learned: false, entriesCreated: 0 };
  }
  
  // Store as knowledge
  const { error } = await supabase
    .from('javari_knowledge')
    .insert({
      topic,
      subtopic: 'real-time',
      concept: query.substring(0, 200),
      explanation: intel.answer.substring(0, 2000),
      source: intel.sources[0] || 'perplexity',
      verified: false,
      tags: ['real-time', 'auto-learned'],
      keywords: extractKeywords(query + ' ' + intel.answer)
    });
  
  return {
    learned: !error,
    entriesCreated: error ? 0 : 1
  };
}

export default {
  getCurrentIntelligence,
  getMarketData,
  getWeather,
  scrapeAndLearn,
  getGitHubIntel,
  getVercelIntel,
  getDeploymentLogs,
  getStripeIntel,
  getSituationReport,
  learnOnDemand
};
