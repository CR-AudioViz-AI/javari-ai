/**
 * Javari AI - External Data Fetcher System
 * Fetches data from free APIs: news, financial, weather, etc.
 * 
 * Created: December 13, 2025
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

export interface DataSource {
  id: string;
  name: string;
  source_type: 'api' | 'rss' | 'scrape' | 'webhook' | 'manual';
  url: string;
  api_key_env?: string;
  fetch_frequency: string;
  config: Record<string, any>;
  is_active: boolean;
}

export interface FetchResult {
  source: string;
  success: boolean;
  items_fetched: number;
  items_stored: number;
  errors: string[];
  duration_ms: number;
}

export interface ExternalDataItem {
  source_name: string;
  data_type: 'news' | 'financial' | 'weather' | 'grants' | 'reference' | 'competitor';
  title: string;
  content: string;
  url?: string;
  published_at?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// NEWS FETCHERS
// ============================================================================

/**
 * Fetch from GNews API (100 req/day free)
 */
export async function fetchGNews(): Promise<ExternalDataItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    console.log('GNews API key not configured');
    return [];
  }

  const items: ExternalDataItem[] = [];
  const categories = ['business', 'technology'];

  for (const category of categories) {
    try {
      const response = await fetch(
        `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&max=10&apikey=${apiKey}`
      );
      const data = await response.json();

      if (data.articles) {
        for (const article of data.articles) {
          items.push({
            source_name: 'gnews',
            data_type: 'news',
            title: article.title,
            content: article.description || article.content || '',
            url: article.url,
            published_at: article.publishedAt,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            metadata: {
              category,
              source: article.source?.name,
              image: article.image,
            },
          });
        }
      }
    } catch (error) {
      console.error(`GNews fetch error (${category}):`, error);
    }
  }

  return items;
}

/**
 * Fetch from Hacker News API (Unlimited, free)
 */
export async function fetchHackerNews(): Promise<ExternalDataItem[]> {
  const items: ExternalDataItem[] = [];

  try {
    // Get top story IDs
    const topStoriesRes = await fetch(
      'https://hacker-news.firebaseio.com/v0/topstories.json'
    );
    const topStoryIds = await topStoriesRes.json();

    // Fetch top 20 stories
    const storyIds = topStoryIds.slice(0, 20);
    
    for (const id of storyIds) {
      try {
        const storyRes = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );
        const story = await storyRes.json();

        if (story && story.title) {
          items.push({
            source_name: 'hackernews',
            data_type: 'news',
            title: story.title,
            content: story.text || `${story.title} - ${story.score} points`,
            url: story.url || `https://news.ycombinator.com/item?id=${id}`,
            published_at: new Date(story.time * 1000).toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
            metadata: {
              score: story.score,
              comments: story.descendants,
              author: story.by,
              type: story.type,
            },
          });
        }
      } catch (storyError) {
        console.error(`HN story ${id} error:`, storyError);
      }
    }
  } catch (error) {
    console.error('Hacker News fetch error:', error);
  }

  return items;
}

/**
 * Fetch from Reddit API (Free)
 */
export async function fetchReddit(subreddit: string = 'technology'): Promise<ExternalDataItem[]> {
  const items: ExternalDataItem[] = [];

  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: {
          'User-Agent': 'JavariAI/1.0',
        },
      }
    );
    const data = await response.json();

    if (data.data?.children) {
      for (const post of data.data.children) {
        const p = post.data;
        items.push({
          source_name: `reddit_${subreddit}`,
          data_type: 'news',
          title: p.title,
          content: p.selftext || p.title,
          url: `https://reddit.com${p.permalink}`,
          published_at: new Date(p.created_utc * 1000).toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            score: p.score,
            comments: p.num_comments,
            subreddit: p.subreddit,
            author: p.author,
            is_self: p.is_self,
          },
        });
      }
    }
  } catch (error) {
    console.error(`Reddit ${subreddit} fetch error:`, error);
  }

  return items;
}

// ============================================================================
// FINANCIAL DATA FETCHERS
// ============================================================================

/**
 * Fetch from Alpha Vantage (25 req/day free)
 */
export async function fetchAlphaVantage(symbols: string[] = ['AAPL', 'GOOGL', 'MSFT']): Promise<ExternalDataItem[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.log('Alpha Vantage API key not configured');
    return [];
  }

  const items: ExternalDataItem[] = [];

  for (const symbol of symbols.slice(0, 5)) { // Limit to 5 to save API calls
    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
      );
      const data = await response.json();

      const quote = data['Global Quote'];
      if (quote) {
        items.push({
          source_name: 'alpha_vantage',
          data_type: 'financial',
          title: `${symbol} Stock Quote`,
          content: `${symbol}: $${quote['05. price']} (${quote['10. change percent']} change). Open: $${quote['02. open']}, High: $${quote['03. high']}, Low: $${quote['04. low']}, Volume: ${quote['06. volume']}`,
          published_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
          metadata: {
            symbol,
            price: parseFloat(quote['05. price']),
            change: quote['09. change'],
            change_percent: quote['10. change percent'],
            volume: quote['06. volume'],
          },
        });
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Alpha Vantage ${symbol} error:`, error);
    }
  }

  return items;
}

/**
 * Fetch from CoinGecko (Free tier)
 */
export async function fetchCoinGecko(): Promise<ExternalDataItem[]> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const items: ExternalDataItem[] = [];

  try {
    const url = apiKey
      ? `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&x_cg_demo_api_key=${apiKey}`
      : 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20';

    const response = await fetch(url);
    const data = await response.json();

    if (Array.isArray(data)) {
      for (const coin of data) {
        items.push({
          source_name: 'coingecko',
          data_type: 'financial',
          title: `${coin.name} (${coin.symbol.toUpperCase()}) Price`,
          content: `${coin.name}: $${coin.current_price.toLocaleString()} (${coin.price_change_percentage_24h?.toFixed(2)}% 24h). Market Cap: $${coin.market_cap?.toLocaleString()}. Volume: $${coin.total_volume?.toLocaleString()}`,
          published_at: coin.last_updated,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
          metadata: {
            symbol: coin.symbol,
            price: coin.current_price,
            market_cap: coin.market_cap,
            volume: coin.total_volume,
            change_24h: coin.price_change_percentage_24h,
            rank: coin.market_cap_rank,
          },
        });
      }
    }
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
  }

  return items;
}

// ============================================================================
// UTILITY DATA FETCHERS
// ============================================================================

/**
 * Fetch weather from Open-Meteo (Unlimited, free)
 */
export async function fetchWeather(
  latitude: number = 26.56,
  longitude: number = -81.87,
  location: string = 'Fort Myers, FL'
): Promise<ExternalDataItem[]> {
  const items: ExternalDataItem[] = [];

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York`
    );
    const data = await response.json();

    if (data.current) {
      items.push({
        source_name: 'openmeteo',
        data_type: 'weather',
        title: `Weather in ${location}`,
        content: `Current: ${data.current.temperature_2m}°F, Humidity: ${data.current.relative_humidity_2m}%, Wind: ${data.current.wind_speed_10m} mph`,
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        metadata: {
          location,
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          wind_speed: data.current.wind_speed_10m,
          daily: data.daily,
        },
      });
    }
  } catch (error) {
    console.error('Weather fetch error:', error);
  }

  return items;
}

/**
 * Fetch from Wikipedia API (Unlimited, free)
 */
export async function fetchWikipedia(topic: string): Promise<ExternalDataItem[]> {
  const items: ExternalDataItem[] = [];

  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`
    );
    const searchData = await searchRes.json();

    if (searchData.query?.search?.[0]) {
      const firstResult = searchData.query.search[0];
      
      // Get extract
      const extractRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(firstResult.title)}&format=json&origin=*`
      );
      const extractData = await extractRes.json();

      const pages = extractData.query?.pages;
      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];

      if (page && page.extract) {
        items.push({
          source_name: 'wikipedia',
          data_type: 'reference',
          title: page.title,
          content: page.extract.slice(0, 2000),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          metadata: {
            page_id: pageId,
            search_query: topic,
          },
        });
      }
    }
  } catch (error) {
    console.error('Wikipedia fetch error:', error);
  }

  return items;
}

// ============================================================================
// MAIN FETCHER ORCHESTRATOR
// ============================================================================

/**
 * Store fetched items in database
 */
async function storeItems(items: ExternalDataItem[]): Promise<number> {
  if (items.length === 0) return 0;

  let stored = 0;

  // Process in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const { error } = await supabase.from('javari_external_data').upsert(
      batch.map(item => ({
        source_name: item.source_name,
        data_type: item.data_type,
        title: item.title,
        content: item.content,
        url: item.url,
        published_at: item.published_at,
        expires_at: item.expires_at,
        metadata: item.metadata,
      })),
      {
        onConflict: 'source_name,title',
        ignoreDuplicates: true,
      }
    );

    if (!error) {
      stored += batch.length;
    } else {
      console.error('Store error:', error);
    }
  }

  return stored;
}

/**
 * Clean up expired data
 */
export async function cleanupExpiredData(): Promise<number> {
  const { data, error } = await supabase
    .from('javari_external_data')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Cleanup error:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Fetch all configured data sources
 */
export async function fetchAllSources(): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  const startTime = Date.now();

  // Fetch news sources
  const newsSources = [
    { name: 'hackernews', fetcher: fetchHackerNews },
    { name: 'reddit_technology', fetcher: () => fetchReddit('technology') },
    { name: 'reddit_startups', fetcher: () => fetchReddit('startups') },
  ];

  // Add GNews if key exists
  if (process.env.GNEWS_API_KEY) {
    newsSources.push({ name: 'gnews', fetcher: fetchGNews });
  }

  for (const source of newsSources) {
    const sourceStart = Date.now();
    try {
      const items = await source.fetcher();
      const stored = await storeItems(items);
      results.push({
        source: source.name,
        success: true,
        items_fetched: items.length,
        items_stored: stored,
        errors: [],
        duration_ms: Date.now() - sourceStart,
      });
    } catch (error: any) {
      results.push({
        source: source.name,
        success: false,
        items_fetched: 0,
        items_stored: 0,
        errors: [error.message],
        duration_ms: Date.now() - sourceStart,
      });
    }
  }

  // Fetch financial sources
  if (process.env.ALPHA_VANTAGE_API_KEY) {
    const avStart = Date.now();
    try {
      const items = await fetchAlphaVantage();
      const stored = await storeItems(items);
      results.push({
        source: 'alpha_vantage',
        success: true,
        items_fetched: items.length,
        items_stored: stored,
        errors: [],
        duration_ms: Date.now() - avStart,
      });
    } catch (error: any) {
      results.push({
        source: 'alpha_vantage',
        success: false,
        items_fetched: 0,
        items_stored: 0,
        errors: [error.message],
        duration_ms: Date.now() - avStart,
      });
    }
  }

  // Fetch crypto
  const cryptoStart = Date.now();
  try {
    const items = await fetchCoinGecko();
    const stored = await storeItems(items);
    results.push({
      source: 'coingecko',
      success: true,
      items_fetched: items.length,
      items_stored: stored,
      errors: [],
      duration_ms: Date.now() - cryptoStart,
    });
  } catch (error: any) {
    results.push({
      source: 'coingecko',
      success: false,
      items_fetched: 0,
      items_stored: 0,
      errors: [error.message],
      duration_ms: Date.now() - cryptoStart,
    });
  }

  // Fetch weather
  const weatherStart = Date.now();
  try {
    const items = await fetchWeather();
    const stored = await storeItems(items);
    results.push({
      source: 'openmeteo',
      success: true,
      items_fetched: items.length,
      items_stored: stored,
      errors: [],
      duration_ms: Date.now() - weatherStart,
    });
  } catch (error: any) {
    results.push({
      source: 'openmeteo',
      success: false,
      items_fetched: 0,
      items_stored: 0,
      errors: [error.message],
      duration_ms: Date.now() - weatherStart,
    });
  }

  // Cleanup expired data
  await cleanupExpiredData();

  return results;
}

/**
 * Get data source statistics
 */
export async function getDataSourceStats(): Promise<{
  total_items: number;
  by_source: Record<string, number>;
  by_type: Record<string, number>;
  oldest_item: string | null;
  newest_item: string | null;
}> {
  const { data: items, error } = await supabase
    .from('javari_external_data')
    .select('source_name, data_type, created_at')
    .order('created_at', { ascending: false });

  if (error || !items) {
    return {
      total_items: 0,
      by_source: {},
      by_type: {},
      oldest_item: null,
      newest_item: null,
    };
  }

  const by_source: Record<string, number> = {};
  const by_type: Record<string, number> = {};

  for (const item of items) {
    by_source[item.source_name] = (by_source[item.source_name] || 0) + 1;
    by_type[item.data_type] = (by_type[item.data_type] || 0) + 1;
  }

  return {
    total_items: items.length,
    by_source,
    by_type,
    oldest_item: items.length > 0 ? items[items.length - 1].created_at : null,
    newest_item: items.length > 0 ? items[0].created_at : null,
  };
}

export default {
  fetchGNews,
  fetchHackerNews,
  fetchReddit,
  fetchAlphaVantage,
  fetchCoinGecko,
  fetchWeather,
  fetchWikipedia,
  fetchAllSources,
  cleanupExpiredData,
  getDataSourceStats,
};
