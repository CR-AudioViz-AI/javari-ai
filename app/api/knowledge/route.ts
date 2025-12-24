// =============================================================================
// JAVARI KNOWLEDGE API - REAL-TIME LEARNING & DATA AGGREGATION
// =============================================================================
// Integrates 70+ APIs for comprehensive, always-current knowledge
// Created: December 24, 2025 - 5:20 PM EST
// =============================================================================

import { NextRequest } from 'next/server';

// API Keys from environment
const API_KEYS = {
  // AI Providers
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  gemini: process.env.GOOGLE_GEMINI_API_KEY,
  perplexity: process.env.PERPLEXITY_API_KEY,
  groq: process.env.GROQ_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  together: process.env.TOGETHER_API_KEY,
  fireworks: process.env.FIREWORKS_API_KEY,
  cohere: process.env.COHERE_API_KEY,
  
  // Search
  tavily: process.env.TAVILY_API_KEY,
  
  // News
  newsapi: process.env.NEWSAPI_KEY,
  gnews: process.env.GNEWS_API_KEY,
  newsdata: process.env.NEWSDATA_API_KEY,
  currents: process.env.CURRENTS_API_KEY,
  thenewsapi: process.env.THENEWSAPI_KEY,
  
  // Finance
  alphavantage: process.env.ALPHA_VANTAGE_API_KEY,
  finnhub: process.env.FINNHUB_API_KEY,
  twelvedata: process.env.TWELVE_DATA_API_KEY,
  fmp: process.env.FMP_API_KEY,
  
  // Media
  tmdb: process.env.TMDB_API_KEY,
  rawg: process.env.RAWG_API_KEY,
  unsplash: process.env.UNSPLASH_ACCESS_KEY,
  pexels: process.env.PEXELS_API_KEY,
  giphy: process.env.GIPHY_API_KEY,
  
  // Travel
  amadeus_key: process.env.AMADEUS_API_KEY,
  amadeus_secret: process.env.AMADEUS_API_SECRET,
  yelp: process.env.YELP_API_KEY,
  
  // Weather & Utilities
  openweather: process.env.OPENWEATHERMAP_API_KEY,
  ipinfo: process.env.IPINFO_TOKEN,
  apininjas: process.env.API_NINJAS_KEY,
};

// Knowledge Categories
type KnowledgeCategory = 
  | 'news' 
  | 'finance' 
  | 'weather' 
  | 'movies' 
  | 'games' 
  | 'travel' 
  | 'search' 
  | 'crypto'
  | 'stocks'
  | 'restaurants'
  | 'facts'
  | 'images';

interface KnowledgeQuery {
  category: KnowledgeCategory;
  query: string;
  location?: string;
  limit?: number;
}

interface KnowledgeResult {
  success: boolean;
  category: string;
  source: string;
  data: unknown;
  timestamp: string;
  cached?: boolean;
}

// =============================================================================
// NEWS AGGREGATION - Multiple Sources
// =============================================================================
async function getNews(query: string, limit = 5): Promise<KnowledgeResult> {
  const results: unknown[] = [];
  
  // Try NewsAPI first
  if (API_KEYS.newsapi) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${limit}&sortBy=publishedAt`,
        { headers: { 'X-Api-Key': API_KEYS.newsapi } }
      );
      const data = await res.json();
      if (data.articles) {
        results.push(...data.articles.map((a: any) => ({
          title: a.title,
          description: a.description,
          source: a.source?.name,
          url: a.url,
          publishedAt: a.publishedAt,
          provider: 'NewsAPI'
        })));
      }
    } catch (e) {
      console.error('NewsAPI error:', e);
    }
  }
  
  // Try GNews as backup
  if (results.length < limit && API_KEYS.gnews) {
    try {
      const res = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&max=${limit}&apikey=${API_KEYS.gnews}`
      );
      const data = await res.json();
      if (data.articles) {
        results.push(...data.articles.map((a: any) => ({
          title: a.title,
          description: a.description,
          source: a.source?.name,
          url: a.url,
          publishedAt: a.publishedAt,
          provider: 'GNews'
        })));
      }
    } catch (e) {
      console.error('GNews error:', e);
    }
  }
  
  return {
    success: results.length > 0,
    category: 'news',
    source: 'multi-provider',
    data: results.slice(0, limit),
    timestamp: new Date().toISOString()
  };
}

// =============================================================================
// FINANCE - Stocks, Crypto, Market Data
// =============================================================================
async function getStockData(symbol: string): Promise<KnowledgeResult> {
  // Try Finnhub first (real-time)
  if (API_KEYS.finnhub) {
    try {
      const [quote, profile] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEYS.finnhub}`).then(r => r.json()),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_KEYS.finnhub}`).then(r => r.json())
      ]);
      
      return {
        success: true,
        category: 'stocks',
        source: 'Finnhub',
        data: {
          symbol,
          name: profile.name,
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
        },
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Finnhub error:', e);
    }
  }
  
  // Fallback to Alpha Vantage
  if (API_KEYS.alphavantage) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEYS.alphavantage}`
      );
      const data = await res.json();
      const quote = data['Global Quote'];
      
      return {
        success: true,
        category: 'stocks',
        source: 'Alpha Vantage',
        data: {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: quote['10. change percent'],
          volume: parseInt(quote['06. volume'])
        },
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Alpha Vantage error:', e);
    }
  }
  
  return { success: false, category: 'stocks', source: 'none', data: null, timestamp: new Date().toISOString() };
}

async function getCryptoData(symbol: string): Promise<KnowledgeResult> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'crypto',
      source: 'CoinGecko',
      data: data[symbol] || data,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'crypto', source: 'CoinGecko', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// WEATHER
// =============================================================================
async function getWeather(location: string): Promise<KnowledgeResult> {
  if (!API_KEYS.openweather) {
    return { success: false, category: 'weather', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=imperial&appid=${API_KEYS.openweather}`
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'weather',
      source: 'OpenWeatherMap',
      data: {
        location: data.name,
        country: data.sys?.country,
        temperature: data.main?.temp,
        feelsLike: data.main?.feels_like,
        humidity: data.main?.humidity,
        description: data.weather?.[0]?.description,
        icon: data.weather?.[0]?.icon,
        wind: data.wind?.speed
      },
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'weather', source: 'OpenWeatherMap', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// MOVIES & TV
// =============================================================================
async function getMovies(query: string, limit = 5): Promise<KnowledgeResult> {
  if (!API_KEYS.tmdb) {
    return { success: false, category: 'movies', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${API_KEYS.tmdb}`
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'movies',
      source: 'TMDb',
      data: data.results?.slice(0, limit).map((m: any) => ({
        id: m.id,
        title: m.title,
        overview: m.overview,
        releaseDate: m.release_date,
        rating: m.vote_average,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'movies', source: 'TMDb', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// GAMES
// =============================================================================
async function getGames(query: string, limit = 5): Promise<KnowledgeResult> {
  if (!API_KEYS.rawg) {
    return { success: false, category: 'games', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const res = await fetch(
      `https://api.rawg.io/api/games?key=${API_KEYS.rawg}&search=${encodeURIComponent(query)}&page_size=${limit}`
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'games',
      source: 'RAWG',
      data: data.results?.map((g: any) => ({
        id: g.id,
        name: g.name,
        released: g.released,
        rating: g.rating,
        platforms: g.platforms?.map((p: any) => p.platform.name),
        genres: g.genres?.map((g: any) => g.name),
        image: g.background_image
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'games', source: 'RAWG', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// RESTAURANTS (Yelp)
// =============================================================================
async function getRestaurants(query: string, location: string, limit = 5): Promise<KnowledgeResult> {
  if (!API_KEYS.yelp) {
    return { success: false, category: 'restaurants', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const res = await fetch(
      `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${API_KEYS.yelp}` } }
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'restaurants',
      source: 'Yelp',
      data: data.businesses?.map((b: any) => ({
        name: b.name,
        rating: b.rating,
        reviewCount: b.review_count,
        price: b.price,
        address: b.location?.display_address?.join(', '),
        phone: b.phone,
        categories: b.categories?.map((c: any) => c.title),
        image: b.image_url,
        url: b.url
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'restaurants', source: 'Yelp', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// WEB SEARCH (Tavily)
// =============================================================================
async function webSearch(query: string, limit = 5): Promise<KnowledgeResult> {
  if (!API_KEYS.tavily) {
    return { success: false, category: 'search', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: API_KEYS.tavily,
        query,
        max_results: limit,
        include_answer: true
      })
    });
    const data = await res.json();
    
    return {
      success: true,
      category: 'search',
      source: 'Tavily',
      data: {
        answer: data.answer,
        results: data.results?.map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score
        }))
      },
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'search', source: 'Tavily', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// IMAGES (Unsplash)
// =============================================================================
async function getImages(query: string, limit = 5): Promise<KnowledgeResult> {
  if (!API_KEYS.unsplash) {
    return { success: false, category: 'images', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}`,
      { headers: { 'Authorization': `Client-ID ${API_KEYS.unsplash}` } }
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'images',
      source: 'Unsplash',
      data: data.results?.map((img: any) => ({
        id: img.id,
        description: img.description || img.alt_description,
        urls: img.urls,
        photographer: img.user?.name,
        link: img.links?.html
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'images', source: 'Unsplash', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// RANDOM FACTS (API Ninjas)
// =============================================================================
async function getFacts(category?: string): Promise<KnowledgeResult> {
  if (!API_KEYS.apininjas) {
    return { success: false, category: 'facts', source: 'none', data: null, timestamp: new Date().toISOString() };
  }
  
  try {
    const endpoints = ['facts', 'jokes', 'quotes', 'trivia'];
    const endpoint = category && endpoints.includes(category) ? category : 'facts';
    
    const res = await fetch(
      `https://api.api-ninjas.com/v1/${endpoint}`,
      { headers: { 'X-Api-Key': API_KEYS.apininjas } }
    );
    const data = await res.json();
    
    return {
      success: true,
      category: 'facts',
      source: 'API Ninjas',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, category: 'facts', source: 'API Ninjas', data: null, timestamp: new Date().toISOString() };
  }
}

// =============================================================================
// MAIN KNOWLEDGE ROUTER
// =============================================================================
async function getKnowledge(request: KnowledgeQuery): Promise<KnowledgeResult> {
  const { category, query, location, limit = 5 } = request;
  
  switch (category) {
    case 'news':
      return getNews(query, limit);
    case 'stocks':
      return getStockData(query);
    case 'crypto':
      return getCryptoData(query);
    case 'weather':
      return getWeather(query);
    case 'movies':
      return getMovies(query, limit);
    case 'games':
      return getGames(query, limit);
    case 'restaurants':
      return getRestaurants(query, location || 'Fort Myers, FL', limit);
    case 'search':
      return webSearch(query, limit);
    case 'images':
      return getImages(query, limit);
    case 'facts':
      return getFacts(query);
    default:
      // Default to web search
      return webSearch(query, limit);
  }
}

// =============================================================================
// API ROUTE HANDLERS
// =============================================================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'status') {
    // Return which APIs are configured
    const configured = Object.entries(API_KEYS)
      .filter(([_, value]) => !!value)
      .map(([key]) => key);
    
    return Response.json({
      success: true,
      configured,
      total: configured.length,
      categories: ['news', 'stocks', 'crypto', 'weather', 'movies', 'games', 'restaurants', 'search', 'images', 'facts']
    });
  }
  
  // Quick queries via GET
  const category = searchParams.get('category') as KnowledgeCategory;
  const query = searchParams.get('q') || searchParams.get('query');
  const location = searchParams.get('location');
  const limit = parseInt(searchParams.get('limit') || '5');
  
  if (!category || !query) {
    return Response.json({
      success: true,
      message: 'Javari Knowledge API',
      usage: {
        'GET ?action=status': 'Check configured APIs',
        'GET ?category=news&q=topic': 'Quick query',
        'POST': 'Complex queries with full options'
      },
      categories: ['news', 'stocks', 'crypto', 'weather', 'movies', 'games', 'restaurants', 'search', 'images', 'facts']
    });
  }
  
  const result = await getKnowledge({ category, query, location, limit });
  return Response.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, query, location, limit } = body;
    
    if (!category || !query) {
      return Response.json({
        success: false,
        error: 'Missing required fields: category and query'
      }, { status: 400 });
    }
    
    const result = await getKnowledge({ category, query, location, limit });
    return Response.json(result);
    
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to process knowledge request'
    }, { status: 500 });
  }
}
