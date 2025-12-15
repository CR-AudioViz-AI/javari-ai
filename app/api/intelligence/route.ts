// =============================================================================
// JAVARI AI - UNIFIED INTELLIGENCE API
// =============================================================================
// Single endpoint for all external data - Powers Javari's knowledge
// Production Ready - Sunday, December 14, 2025
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============ TYPE DEFINITIONS ============

interface IntelligenceRequest {
  action: string;
  query?: string;
  params?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

interface IntelligenceResponse {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  source?: string;
  cached?: boolean;
  executionTime?: number;
  timestamp: string;
}

// ============ CACHE MANAGEMENT ============

const CACHE_DURATION: Record<string, number> = {
  weather: 15 * 60 * 1000,      // 15 minutes
  news: 30 * 60 * 1000,         // 30 minutes
  stock: 5 * 60 * 1000,         // 5 minutes
  crypto: 2 * 60 * 1000,        // 2 minutes
  wikipedia: 24 * 60 * 60 * 1000, // 24 hours
  dictionary: 7 * 24 * 60 * 60 * 1000, // 7 days
  default: 10 * 60 * 1000       // 10 minutes
};

async function getCachedData(key: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from('intelligence_cache')
      .select('*')
      .eq('cache_key', key)
      .single();
    
    if (data && new Date(data.expires_at) > new Date()) {
      return data.cached_data;
    }
  } catch (e) {}
  return null;
}

async function setCachedData(key: string, data: any, action: string): Promise<void> {
  const duration = CACHE_DURATION[action] || CACHE_DURATION.default;
  const expiresAt = new Date(Date.now() + duration);
  
  try {
    await supabase
      .from('intelligence_cache')
      .upsert({
        cache_key: key,
        cached_data: data,
        action_type: action,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'cache_key' });
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

// ============ API IMPLEMENTATIONS ============

async function fetchWeather(location: string): Promise<any> {
  // Open-Meteo (Free, no API key needed!)
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
  );
  const geoData = await geoRes.json();
  
  if (!geoData.results?.[0]) {
    throw new Error('Location not found');
  }
  
  const { latitude, longitude, name, country } = geoData.results[0];
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`
  );
  const weather = await weatherRes.json();
  
  // Weather code descriptions
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight rain showers',
    81: 'Moderate rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm'
  };
  
  return {
    location: `${name}, ${country}`,
    coordinates: { latitude, longitude },
    current: {
      temperature: weather.current?.temperature_2m,
      feelsLike: weather.current?.apparent_temperature,
      humidity: weather.current?.relative_humidity_2m,
      windSpeed: weather.current?.wind_speed_10m,
      windDirection: weather.current?.wind_direction_10m,
      condition: weatherCodes[weather.current?.weather_code] || 'Unknown',
      weatherCode: weather.current?.weather_code
    },
    forecast: weather.daily?.time?.map((date: string, i: number) => ({
      date,
      high: weather.daily.temperature_2m_max[i],
      low: weather.daily.temperature_2m_min[i],
      condition: weatherCodes[weather.daily.weather_code[i]] || 'Unknown',
      precipitationChance: weather.daily.precipitation_probability_max[i]
    })),
    units: weather.current_units,
    timezone: weather.timezone
  };
}

async function fetchNews(query: string, category?: string): Promise<any> {
  // Try multiple news sources
  const sources = [
    // GNews
    async () => {
      const apiKey = process.env.GNEWS_API_KEY;
      if (!apiKey) throw new Error('No GNews key');
      const res = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&token=${apiKey}&lang=en&max=10`
      );
      const data = await res.json();
      if (data.articles) {
        return data.articles.map((a: any) => ({
          title: a.title,
          description: a.description,
          url: a.url,
          source: a.source.name,
          publishedAt: a.publishedAt,
          image: a.image
        }));
      }
      throw new Error('No articles');
    },
    // NewsData.io
    async () => {
      const apiKey = process.env.NEWSDATA_API_KEY;
      if (!apiKey) throw new Error('No NewsData key');
      const res = await fetch(
        `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query)}&language=en`
      );
      const data = await res.json();
      if (data.results) {
        return data.results.map((a: any) => ({
          title: a.title,
          description: a.description,
          url: a.link,
          source: a.source_id,
          publishedAt: a.pubDate,
          image: a.image_url
        }));
      }
      throw new Error('No results');
    }
  ];
  
  for (const source of sources) {
    try {
      return await source();
    } catch (e) { continue; }
  }
  
  throw new Error('All news sources failed');
}

async function fetchStock(symbol: string): Promise<any> {
  // Try multiple stock APIs
  const sources = [
    // Finnhub
    async () => {
      const apiKey = process.env.FINNHUB_KEY;
      if (!apiKey) throw new Error('No Finnhub key');
      
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`)
      ]);
      
      const quote = await quoteRes.json();
      const profile = await profileRes.json();
      
      if (quote.c) {
        return {
          symbol: symbol.toUpperCase(),
          name: profile.name || symbol,
          price: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          high: quote.h,
          low: quote.l,
          open: quote.o,
          previousClose: quote.pc,
          industry: profile.finnhubIndustry,
          marketCap: profile.marketCapitalization,
          logo: profile.logo
        };
      }
      throw new Error('No quote data');
    },
    // Alpha Vantage
    async () => {
      const apiKey = process.env.ALPHA_VANTAGE_KEY;
      if (!apiKey) throw new Error('No Alpha Vantage key');
      
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
      );
      const data = await res.json();
      const quote = data['Global Quote'];
      
      if (quote && quote['05. price']) {
        return {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          high: parseFloat(quote['03. high']),
          low: parseFloat(quote['04. low']),
          open: parseFloat(quote['02. open']),
          previousClose: parseFloat(quote['08. previous close']),
          volume: parseInt(quote['06. volume'])
        };
      }
      throw new Error('No quote data');
    }
  ];
  
  for (const source of sources) {
    try {
      return await source();
    } catch (e) { continue; }
  }
  
  throw new Error('Stock data unavailable');
}

async function fetchCrypto(symbol: string = 'bitcoin'): Promise<any> {
  // CoinGecko (Free)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true`
  );
  const data = await res.json();
  
  if (data.id) {
    return {
      id: data.id,
      symbol: data.symbol?.toUpperCase(),
      name: data.name,
      price: data.market_data?.current_price?.usd,
      change24h: data.market_data?.price_change_percentage_24h,
      change7d: data.market_data?.price_change_percentage_7d,
      marketCap: data.market_data?.market_cap?.usd,
      volume24h: data.market_data?.total_volume?.usd,
      high24h: data.market_data?.high_24h?.usd,
      low24h: data.market_data?.low_24h?.usd,
      allTimeHigh: data.market_data?.ath?.usd,
      allTimeLow: data.market_data?.atl?.usd,
      circulatingSupply: data.market_data?.circulating_supply,
      totalSupply: data.market_data?.total_supply,
      sparkline: data.market_data?.sparkline_7d?.price,
      image: data.image?.small,
      lastUpdated: data.last_updated
    };
  }
  
  throw new Error('Crypto data unavailable');
}

async function fetchWikipedia(query: string): Promise<any> {
  const searchRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
  );
  const searchData = await searchRes.json();
  
  if (searchData.query?.search?.[0]) {
    const pageId = searchData.query.search[0].pageid;
    const title = searchData.query.search[0].title;
    
    const contentRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts|pageimages&exintro=true&explaintext=true&piprop=thumbnail&pithumbsize=300&format=json&origin=*`
    );
    const contentData = await contentRes.json();
    const page = contentData.query.pages[pageId];
    
    return {
      title: page.title,
      extract: page.extract?.substring(0, 3000),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      thumbnail: page.thumbnail?.source,
      pageId
    };
  }
  
  throw new Error('No Wikipedia results');
}

async function fetchDictionary(word: string): Promise<any> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  const data = await res.json();
  
  if (Array.isArray(data) && data[0]) {
    return {
      word: data[0].word,
      phonetic: data[0].phonetic,
      phonetics: data[0].phonetics?.map((p: any) => ({
        text: p.text,
        audio: p.audio
      })),
      meanings: data[0].meanings?.map((m: any) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions?.slice(0, 3).map((d: any) => ({
          definition: d.definition,
          example: d.example,
          synonyms: d.synonyms?.slice(0, 5),
          antonyms: d.antonyms?.slice(0, 5)
        }))
      })),
      origin: data[0].origin,
      sourceUrls: data[0].sourceUrls
    };
  }
  
  throw new Error('Word not found');
}

async function translateText(text: string, targetLang: string, sourceLang: string = 'auto'): Promise<any> {
  const langPair = sourceLang === 'auto' ? `en|${targetLang}` : `${sourceLang}|${targetLang}`;
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`
  );
  const data = await res.json();
  
  if (data.responseData?.translatedText) {
    return {
      original: text,
      translated: data.responseData.translatedText,
      sourceLang: sourceLang,
      targetLang: targetLang,
      confidence: data.responseData.match
    };
  }
  
  throw new Error('Translation failed');
}

async function fetchGitHubTrending(): Promise<any> {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const weekAgo = date.toISOString().split('T')[0];
  
  const res = await fetch(
    `https://api.github.com/search/repositories?q=created:>${weekAgo}&sort=stars&order=desc&per_page=15`,
    { headers: { 'Accept': 'application/vnd.github.v3+json' } }
  );
  const data = await res.json();
  
  return {
    totalCount: data.total_count,
    repositories: data.items?.map((repo: any) => ({
      name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url,
      topics: repo.topics?.slice(0, 5),
      createdAt: repo.created_at
    }))
  };
}

async function fetchQuote(): Promise<any> {
  const res = await fetch('https://api.quotable.io/random');
  const data = await res.json();
  
  return {
    content: data.content,
    author: data.author,
    tags: data.tags,
    length: data.length
  };
}

async function fetchJoke(): Promise<any> {
  const res = await fetch('https://official-joke-api.appspot.com/random_joke');
  const data = await res.json();
  
  return {
    setup: data.setup,
    punchline: data.punchline,
    type: data.type
  };
}

async function fetchFact(): Promise<any> {
  const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
  const data = await res.json();
  
  return {
    fact: data.text,
    source: data.source,
    sourceUrl: data.source_url
  };
}

async function fetchIPInfo(ip?: string): Promise<any> {
  const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
  const res = await fetch(url);
  const data = await res.json();
  
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country_name,
    countryCode: data.country_code,
    postal: data.postal,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    org: data.org,
    asn: data.asn
  };
}

async function searchImages(query: string): Promise<any> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error('No Unsplash key');
  
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`,
    { headers: { 'Authorization': `Client-ID ${accessKey}` } }
  );
  const data = await res.json();
  
  return {
    total: data.total,
    images: data.results?.map((img: any) => ({
      id: img.id,
      description: img.description || img.alt_description,
      urls: {
        thumb: img.urls.thumb,
        small: img.urls.small,
        regular: img.urls.regular,
        full: img.urls.full
      },
      author: {
        name: img.user.name,
        username: img.user.username,
        profileUrl: img.user.links.html
      },
      downloadUrl: img.links.download,
      likes: img.likes
    }))
  };
}

async function searchGifs(query: string): Promise<any> {
  const apiKey = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC'; // Public beta key
  
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=10`
  );
  const data = await res.json();
  
  return {
    total: data.pagination?.total_count,
    gifs: data.data?.map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      url: gif.url,
      images: {
        original: gif.images.original.url,
        preview: gif.images.preview_gif?.url,
        downsized: gif.images.downsized?.url
      },
      rating: gif.rating
    }))
  };
}

// ============ MAIN HANDLER ============

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: IntelligenceRequest = await request.json();
    const { action, query, params, userId, sessionId } = body;
    
    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Action required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Generate cache key
    const cacheKey = `${action}:${query || ''}:${JSON.stringify(params || {})}`;
    
    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        action,
        data: cachedData,
        cached: true,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // Execute the requested action
    let data: any;
    let source = 'api';
    
    switch (action) {
      case 'weather':
        data = await fetchWeather(query || params?.location || 'New York');
        source = 'open-meteo';
        break;
        
      case 'news':
        data = await fetchNews(query || 'technology', params?.category);
        source = 'news-api';
        break;
        
      case 'stock':
        data = await fetchStock(query || params?.symbol || 'AAPL');
        source = 'finnhub';
        break;
        
      case 'crypto':
        data = await fetchCrypto(query || params?.symbol || 'bitcoin');
        source = 'coingecko';
        break;
        
      case 'wikipedia':
        data = await fetchWikipedia(query || '');
        source = 'wikipedia';
        break;
        
      case 'dictionary':
      case 'define':
        data = await fetchDictionary(query || params?.word || '');
        source = 'dictionaryapi';
        break;
        
      case 'translate':
        data = await translateText(
          query || params?.text || '',
          params?.targetLang || 'es',
          params?.sourceLang || 'auto'
        );
        source = 'mymemory';
        break;
        
      case 'github':
      case 'trending':
        data = await fetchGitHubTrending();
        source = 'github';
        break;
        
      case 'quote':
        data = await fetchQuote();
        source = 'quotable';
        break;
        
      case 'joke':
        data = await fetchJoke();
        source = 'joke-api';
        break;
        
      case 'fact':
        data = await fetchFact();
        source = 'uselessfacts';
        break;
        
      case 'ip':
      case 'geolocation':
        data = await fetchIPInfo(query || params?.ip);
        source = 'ipapi';
        break;
        
      case 'images':
        data = await searchImages(query || '');
        source = 'unsplash';
        break;
        
      case 'gifs':
        data = await searchGifs(query || '');
        source = 'giphy';
        break;
        
      default:
        return NextResponse.json({
          success: false,
          action,
          error: `Unknown action: ${action}`,
          availableActions: [
            'weather', 'news', 'stock', 'crypto', 'wikipedia', 'dictionary',
            'translate', 'github', 'quote', 'joke', 'fact', 'ip', 'images', 'gifs'
          ],
          timestamp: new Date().toISOString()
        }, { status: 400 });
    }
    
    // Cache the result
    await setCachedData(cacheKey, data, action);
    
    // Log the query for learning
    try {
      await supabase.from('intelligence_queries').insert({
        action,
        query,
        params,
        user_id: userId,
        session_id: sessionId,
        source,
        success: true,
        execution_time_ms: Date.now() - startTime,
        created_at: new Date().toISOString()
      });
    } catch (e) {}
    
    return NextResponse.json({
      success: true,
      action,
      data,
      source,
      cached: false,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// ============ GET - List available actions ============

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    name: 'Javari Intelligence API',
    version: '2.0.0',
    actions: {
      weather: { description: 'Get weather forecast', params: { query: 'location name' } },
      news: { description: 'Search news articles', params: { query: 'search term', category: 'optional' } },
      stock: { description: 'Get stock quote', params: { query: 'ticker symbol' } },
      crypto: { description: 'Get crypto price', params: { query: 'coin id (e.g., bitcoin)' } },
      wikipedia: { description: 'Search Wikipedia', params: { query: 'search term' } },
      dictionary: { description: 'Define a word', params: { query: 'word' } },
      translate: { description: 'Translate text', params: { query: 'text', targetLang: 'language code', sourceLang: 'optional' } },
      github: { description: 'Get trending repos', params: {} },
      quote: { description: 'Get random quote', params: {} },
      joke: { description: 'Get random joke', params: {} },
      fact: { description: 'Get random fact', params: {} },
      ip: { description: 'Get IP geolocation', params: { query: 'ip address (optional)' } },
      images: { description: 'Search images', params: { query: 'search term' } },
      gifs: { description: 'Search GIFs', params: { query: 'search term' } }
    },
    timestamp: new Date().toISOString()
  });
}
