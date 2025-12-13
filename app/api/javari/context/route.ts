// app/api/javari/context/route.ts
// Javari AI Context API - Real-time Data for Enhanced Responses
// Version: 1.0.0
// Timestamp: 2025-12-13 8:25 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ContextRequest {
  query: string;
  includeNews?: boolean;
  includeCrypto?: boolean;
  includeWeather?: boolean;
  includeKnowledge?: boolean;
  knowledgeLimit?: number;
}

/**
 * GET /api/javari/context
 * Get context data for a query (news, crypto, weather, knowledge)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get stats
    const [
      { count: knowledgeCount },
      { count: newsCount },
      { count: cryptoCount },
      { data: weatherData },
      { data: recentNews },
      { data: recentCrypto },
    ] = await Promise.all([
      supabase.from('javari_knowledge').select('*', { count: 'exact', head: true }),
      supabase.from('javari_external_data').select('*', { count: 'exact', head: true }).eq('data_type', 'news'),
      supabase.from('javari_external_data').select('*', { count: 'exact', head: true }).eq('data_type', 'crypto'),
      supabase.from('javari_external_data').select('*').eq('data_type', 'weather').limit(1),
      supabase.from('javari_external_data').select('title, source_name, created_at').eq('data_type', 'news').order('created_at', { ascending: false }).limit(5),
      supabase.from('javari_external_data').select('title, content, metadata').eq('data_type', 'crypto').order('created_at', { ascending: false }).limit(10),
    ]);
    
    return NextResponse.json({
      status: 'ok',
      stats: {
        knowledge: knowledgeCount || 0,
        news: newsCount || 0,
        crypto: cryptoCount || 0,
        hasWeather: !!weatherData?.length,
      },
      preview: {
        news: recentNews || [],
        crypto: recentCrypto || [],
        weather: weatherData?.[0] || null,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Context API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/javari/context
 * Build context for a specific query
 */
export async function POST(request: NextRequest) {
  try {
    const body: ContextRequest = await request.json();
    const {
      query,
      includeNews = false,
      includeCrypto = false,
      includeWeather = false,
      includeKnowledge = true,
      knowledgeLimit = 3,
    } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const contextParts: string[] = [];
    const sources: { type: string; count: number }[] = [];
    
    // Analyze query for automatic context inclusion
    const queryLower = query.toLowerCase();
    const autoIncludeNews = includeNews || /\b(news|latest|recent|today|happening)\b/i.test(query);
    const autoIncludeCrypto = includeCrypto || /\b(crypto|bitcoin|btc|ethereum|eth|coin|price)\b/i.test(query);
    const autoIncludeWeather = includeWeather || /\b(weather|temperature|forecast|rain|sunny)\b/i.test(query);
    
    // Fetch knowledge
    if (includeKnowledge) {
      try {
        // Simple keyword search (fallback without embeddings)
        const keywords = query
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3);
        
        const { data: knowledge } = await supabase
          .from('javari_knowledge')
          .select('title, category, content, keywords')
          .limit(knowledgeLimit);
        
        if (knowledge && knowledge.length > 0) {
          // Score and sort by keyword relevance
          const scored = knowledge.map(k => {
            let score = 0;
            const contentLower = (k.content + ' ' + k.title).toLowerCase();
            for (const keyword of keywords) {
              if (contentLower.includes(keyword)) score += 1;
              if (k.keywords?.some((kw: string) => kw.toLowerCase().includes(keyword))) score += 2;
            }
            return { ...k, score };
          }).filter(k => k.score > 0).sort((a, b) => b.score - a.score);
          
          if (scored.length > 0) {
            contextParts.push('## RELEVANT KNOWLEDGE');
            for (const entry of scored.slice(0, knowledgeLimit)) {
              contextParts.push(`### ${entry.title} (${entry.category})`);
              contextParts.push(entry.content.slice(0, 500) + (entry.content.length > 500 ? '...' : ''));
            }
            sources.push({ type: 'knowledge', count: scored.length });
          }
        }
      } catch (error) {
        console.error('Knowledge fetch error:', error);
      }
    }
    
    // Fetch news
    if (autoIncludeNews) {
      try {
        const { data: news } = await supabase
          .from('javari_external_data')
          .select('title, content, url, source_name')
          .eq('data_type', 'news')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (news && news.length > 0) {
          contextParts.push('\n## TRENDING NEWS');
          for (const item of news) {
            contextParts.push(`- **${item.title}** (${item.source_name})`);
          }
          sources.push({ type: 'news', count: news.length });
        }
      } catch (error) {
        console.error('News fetch error:', error);
      }
    }
    
    // Fetch crypto
    if (autoIncludeCrypto) {
      try {
        const { data: crypto } = await supabase
          .from('javari_external_data')
          .select('title, content, metadata')
          .eq('data_type', 'crypto')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (crypto && crypto.length > 0) {
          contextParts.push('\n## CURRENT CRYPTO PRICES');
          for (const coin of crypto) {
            const meta = coin.metadata as any;
            const price = meta?.current_price;
            const change = meta?.price_change_percentage_24h;
            if (price) {
              const changeStr = change ? ` (${change > 0 ? '+' : ''}${change.toFixed(2)}%)` : '';
              contextParts.push(`- ${coin.title}: $${price.toLocaleString()}${changeStr}`);
            }
          }
          sources.push({ type: 'crypto', count: crypto.length });
        }
      } catch (error) {
        console.error('Crypto fetch error:', error);
      }
    }
    
    // Fetch weather
    if (autoIncludeWeather) {
      try {
        const { data: weather } = await supabase
          .from('javari_external_data')
          .select('title, content, metadata')
          .eq('data_type', 'weather')
          .gt('expires_at', new Date().toISOString())
          .limit(1);
        
        if (weather && weather.length > 0) {
          const w = weather[0];
          const meta = w.metadata as any;
          contextParts.push('\n## CURRENT WEATHER (Fort Myers, FL)');
          contextParts.push(`Temperature: ${meta?.temperature || 'N/A'}°F`);
          contextParts.push(`Conditions: ${w.content || 'N/A'}`);
          if (meta?.humidity) contextParts.push(`Humidity: ${meta.humidity}%`);
          sources.push({ type: 'weather', count: 1 });
        }
      } catch (error) {
        console.error('Weather fetch error:', error);
      }
    }
    
    const context = contextParts.join('\n');
    
    return NextResponse.json({
      context,
      sources,
      query,
      analyzedIntent: {
        includesNews: autoIncludeNews,
        includesCrypto: autoIncludeCrypto,
        includesWeather: autoIncludeWeather,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Context build error:', error);
    return NextResponse.json(
      { error: 'Failed to build context' },
      { status: 500 }
    );
  }
}
