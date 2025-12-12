/**
 * Javari AI - External Data Fetcher
 * 
 * Fetches data from free external APIs to keep Javari current.
 * All APIs are FREE with generous rate limits.
 * 
 * Created: December 13, 2025
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExternalDataItem {
  source_name: string;
  data_type: 'news' | 'financial' | 'weather' | 'grants' | 'reference' | 'competitor';
  title: string;
  content: string;
  url?: string;
  published_at?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

/**
 * Fetch top stories from Hacker News (FREE, unlimited)
 */
export async function fetchHackerNews(limit: number = 20): Promise<ExternalDataItem[]> {
  try {
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topIds = await topStoriesRes.json();
    
    const stories: ExternalDataItem[] = [];
    const idsToFetch = topIds.slice(0, limit);
    
    for (const id of idsToFetch) {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = await storyRes.json();
        
        if (story && story.title) {
          stories.push({
            source_name: 'hackernews',
            data_type: 'news',
            title: story.title,
            content: story.title + (story.text ? `\n\n${story.text}` : ''),
            url: story.url || `https://news.ycombinator.com/item?id=${id}`,
            published_at: new Date(story.time * 1000).toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            metadata: { score: story.score, comments: story.descendants }
          });
        }
      } catch (e) {
        console.error(`[ExternalData] Error fetching HN story ${id}:`, e);
      }
    }
    
    return stories;
  } catch (error) {
    console.error('[ExternalData] Hacker News fetch error:', error);
    return [];
  }
}

/**
 * Fetch Reddit posts (FREE, unlimited with user agent)
 */
export async function fetchReddit(
  subreddit: string = 'technology',
  limit: number = 20
): Promise<ExternalDataItem[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      {
        headers: {
          'User-Agent': 'JavariAI/1.0 (CR AudioViz AI)'
        }
      }
    );
    
    const data = await res.json();
    const posts: ExternalDataItem[] = [];
    
    for (const child of data.data?.children || []) {
      const post = child.data;
      if (post.title) {
        posts.push({
          source_name: `reddit_${subreddit}`,
          data_type: 'news',
          title: post.title,
          content: post.selftext || post.title,
          url: `https://reddit.com${post.permalink}`,
          published_at: new Date(post.created_utc * 1000).toISOString(),
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
          metadata: { 
            score: post.score, 
            comments: post.num_comments,
            subreddit
          }
        });
      }
    }
    
    return posts;
  } catch (error) {
    console.error(`[ExternalData] Reddit r/${subreddit} fetch error:`, error);
    return [];
  }
}

/**
 * Fetch cryptocurrency prices from CoinGecko (FREE, 50 req/min)
 */
export async function fetchCryptoData(): Promise<ExternalDataItem[]> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false',
      {
        headers: process.env.COINGECKO_API_KEY 
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {}
      }
    );
    
    const coins = await res.json();
    const items: ExternalDataItem[] = [];
    
    for (const coin of coins) {
      items.push({
        source_name: 'coingecko',
        data_type: 'financial',
        title: `${coin.name} (${coin.symbol.toUpperCase()}) Price Update`,
        content: `${coin.name} is currently trading at $${coin.current_price.toLocaleString()}. ` +
                 `24h change: ${coin.price_change_percentage_24h?.toFixed(2)}%. ` +
                 `Market cap: $${coin.market_cap?.toLocaleString() || 'N/A'}. ` +
                 `24h volume: $${coin.total_volume?.toLocaleString() || 'N/A'}.`,
        url: `https://www.coingecko.com/en/coins/${coin.id}`,
        published_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour
        metadata: {
          symbol: coin.symbol,
          price: coin.current_price,
          change_24h: coin.price_change_percentage_24h,
          market_cap: coin.market_cap,
          volume: coin.total_volume,
          rank: coin.market_cap_rank
        }
      });
    }
    
    return items;
  } catch (error) {
    console.error('[ExternalData] CoinGecko fetch error:', error);
    return [];
  }
}

/**
 * Fetch weather for Fort Myers, FL (FREE, unlimited)
 */
export async function fetchWeather(): Promise<ExternalDataItem[]> {
  try {
    // Fort Myers, FL coordinates
    const lat = 26.6406;
    const lon = -81.8723;
    
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York`
    );
    
    const data = await res.json();
    const current = data.current;
    
    const weatherCodes: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
    };
    
    return [{
      source_name: 'open_meteo',
      data_type: 'weather',
      title: 'Fort Myers, FL Weather',
      content: `Current conditions in Fort Myers, FL: ${weatherCodes[current.weather_code] || 'Unknown'}. ` +
               `Temperature: ${current.temperature_2m}°F. ` +
               `Humidity: ${current.relative_humidity_2m}%. ` +
               `Wind: ${current.wind_speed_10m} mph.`,
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour
      metadata: {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        weather_code: current.weather_code,
        wind_speed: current.wind_speed_10m,
        location: 'Fort Myers, FL'
      }
    }];
  } catch (error) {
    console.error('[ExternalData] Weather fetch error:', error);
    return [];
  }
}

/**
 * Store external data items in database
 */
export async function storeExternalData(items: ExternalDataItem[]): Promise<number> {
  if (items.length === 0) return 0;
  
  let stored = 0;
  
  for (const item of items) {
    const { error } = await supabase
      .from('javari_external_data')
      .upsert({
        source_name: item.source_name,
        data_type: item.data_type,
        title: item.title,
        content: item.content,
        url: item.url,
        published_at: item.published_at,
        expires_at: item.expires_at,
        metadata: item.metadata
      }, { 
        onConflict: 'source_name,title',
        ignoreDuplicates: true 
      });
    
    if (!error) {
      stored++;
    }
  }
  
  return stored;
}

/**
 * Cleanup expired external data
 */
export async function cleanupExpiredData(): Promise<number> {
  const { data, error } = await supabase
    .from('javari_external_data')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');
  
  if (error) {
    console.error('[ExternalData] Cleanup error:', error);
    return 0;
  }
  
  return data?.length || 0;
}

/**
 * Fetch all sources and store data
 */
export async function fetchAllSources(): Promise<{
  source: string;
  fetched: number;
  stored: number;
}[]> {
  const results: { source: string; fetched: number; stored: number }[] = [];
  
  // Hacker News
  console.log('[ExternalData] Fetching Hacker News...');
  const hnItems = await fetchHackerNews(20);
  const hnStored = await storeExternalData(hnItems);
  results.push({ source: 'hackernews', fetched: hnItems.length, stored: hnStored });
  
  // Reddit Technology
  console.log('[ExternalData] Fetching Reddit r/technology...');
  const redditTechItems = await fetchReddit('technology', 15);
  const redditTechStored = await storeExternalData(redditTechItems);
  results.push({ source: 'reddit_technology', fetched: redditTechItems.length, stored: redditTechStored });
  
  // Reddit Startups
  console.log('[ExternalData] Fetching Reddit r/startups...');
  const redditStartupsItems = await fetchReddit('startups', 10);
  const redditStartupsStored = await storeExternalData(redditStartupsItems);
  results.push({ source: 'reddit_startups', fetched: redditStartupsItems.length, stored: redditStartupsStored });
  
  // CoinGecko
  console.log('[ExternalData] Fetching CoinGecko...');
  const cryptoItems = await fetchCryptoData();
  const cryptoStored = await storeExternalData(cryptoItems);
  results.push({ source: 'coingecko', fetched: cryptoItems.length, stored: cryptoStored });
  
  // Weather
  console.log('[ExternalData] Fetching weather...');
  const weatherItems = await fetchWeather();
  const weatherStored = await storeExternalData(weatherItems);
  results.push({ source: 'open_meteo', fetched: weatherItems.length, stored: weatherStored });
  
  // Cleanup expired data
  console.log('[ExternalData] Cleaning up expired data...');
  const cleaned = await cleanupExpiredData();
  results.push({ source: 'cleanup', fetched: 0, stored: -cleaned });
  
  return results;
}

/**
 * Get statistics about external data
 */
export async function getDataSourceStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
}> {
  const { data: items, error } = await supabase
    .from('javari_external_data')
    .select('data_type, source_name')
    .gt('expires_at', new Date().toISOString());
  
  if (error || !items) {
    return { total: 0, byType: {}, bySource: {} };
  }
  
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  
  for (const item of items) {
    byType[item.data_type] = (byType[item.data_type] || 0) + 1;
    bySource[item.source_name] = (bySource[item.source_name] || 0) + 1;
  }
  
  return { total: items.length, byType, bySource };
}
