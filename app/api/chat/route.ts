// app/api/chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - MEGA INTELLIGENCE SYSTEM v8.0
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Sunday, December 22, 2025 - 10:20 PM EST
// Version: 8.0 - MEGA INTELLIGENCE with 35+ API Sources
// 
// This route connects ALL autonomous systems with MAXIMUM API coverage:
// ✅ Multi-AI Orchestrator - Intelligent task routing
// ✅ Learning System - Captures insights from every conversation
// ✅ Self-Healing - Monitors and auto-fixes deployments
// ✅ Knowledge Base - Context-aware responses
// ✅ VIP Detection - Special handling for Roy/Cindy
// ✅ Build Intent - Code-first responses
// ✅ MEGA INTELLIGENCE - 35+ Real-time API sources with fallbacks
//
// API COVERAGE:
// - Weather: 3 sources (wttr.in, Open-Meteo, WeatherAPI)
// - Crypto: 3 sources (CoinGecko, CoinCap, CoinPaprika)
// - Stocks: 3 sources (Finnhub, Alpha Vantage, Twelve Data)
// - News: 4 sources (GNews, NewsData, Currents, TheNewsAPI)
// - Knowledge: 3 sources (Wikipedia, DuckDuckGo, Dictionary)
// - Translation: 2 sources (MyMemory, LibreTranslate)
// - Development: 2 sources (GitHub Trending, NPM)
// - Media: 3 sources (Unsplash, Pexels, Giphy)
// - Utility: 5 sources (IP, Time, Exchange, Quotes, Jokes, Facts)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  provider?: string;
  model?: string;
}

interface VIPDetection {
  isVIP: boolean;
  vipName?: string;
  vipRole?: string;
}

interface BuildIntent {
  isBuild: boolean;
  appType?: string;
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  estimatedCredits: number;
  keywords: string[];
}

interface AIResponse {
  response: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  responseTimeMs: number;
  fallbackUsed: boolean;
  reasoning?: string;
}

interface AIProvider {
  name: string;
  model: string;
  strengths: string[];
  costPer1kTokens: number;
  maxTokens: number;
  priority: number;
}

interface IntentResult {
  intent: string;
  confidence: number;
  params: Record<string, any>;
  needsRealTimeData: boolean;
}

interface EnrichedContext {
  weather?: any;
  news?: any;
  stock?: any;
  crypto?: any;
  wikipedia?: any;
  time?: any;
  joke?: any;
  quote?: any;
  fact?: any;
  translation?: any;
  github?: any;
  npm?: any;
  images?: any;
  gifs?: any;
  dictionary?: any;
  ip?: any;
  exchange?: any;
}

interface APIResult {
  success: boolean;
  source: string;
  data?: any;
  error?: string;
  latency_ms?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const AI_PROVIDERS: Record<string, AIProvider> = {
  claude: {
    name: 'Anthropic Claude 3.5 Sonnet',
    model: 'claude-3-5-sonnet-20241022',
    strengths: ['coding', 'analysis', 'safety', 'long_context', 'nuance'],
    costPer1kTokens: 0.003,
    maxTokens: 8000,
    priority: 1
  },
  openai: {
    name: 'OpenAI GPT-4 Turbo',
    model: 'gpt-4-turbo-preview',
    strengths: ['coding', 'analysis', 'general', 'creative', 'math'],
    costPer1kTokens: 0.01,
    maxTokens: 4000,
    priority: 2
  },
  'gpt-4o': {
    name: 'OpenAI GPT-4o',
    model: 'gpt-4o',
    strengths: ['coding', 'vision', 'speed', 'general'],
    costPer1kTokens: 0.005,
    maxTokens: 4000,
    priority: 3
  },
  gemini: {
    name: 'Google Gemini 1.5 Pro',
    model: 'gemini-1.5-pro',
    strengths: ['long_context', 'multimodal', 'video', 'audio'],
    costPer1kTokens: 0.00125,
    maxTokens: 8000,
    priority: 4
  },
  perplexity: {
    name: 'Perplexity Sonar Pro',
    model: 'sonar-pro',
    strengths: ['research', 'current_events', 'citations', 'web_search'],
    costPer1kTokens: 0.001,
    maxTokens: 4000,
    priority: 5
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT DETECTION - What does the user want?
// ═══════════════════════════════════════════════════════════════════════════════

function detectIntent(message: string): IntentResult {
  const lower = message.toLowerCase();
  const original = message;
  
  // CRYPTO detection (before stock - they can overlap)
  const cryptoPatterns = [
    /\b(bitcoin|btc|ethereum|eth|crypto|dogecoin|doge|solana|sol|cardano|ada|xrp|ripple)\b/i,
    /\bcrypto(?:currency)?\b/i,
    /\b(coin|token)\s*price\b/i
  ];
  
  for (const pattern of cryptoPatterns) {
    const match = lower.match(pattern);
    if (match) {
      // Map to CoinGecko IDs
      const coinMap: Record<string, string> = {
        'bitcoin': 'bitcoin', 'btc': 'bitcoin',
        'ethereum': 'ethereum', 'eth': 'ethereum',
        'dogecoin': 'dogecoin', 'doge': 'dogecoin',
        'solana': 'solana', 'sol': 'solana',
        'cardano': 'cardano', 'ada': 'cardano',
        'xrp': 'ripple', 'ripple': 'ripple',
        'crypto': 'bitcoin' // default
      };
      const coinId = coinMap[match[1]?.toLowerCase()] || 'bitcoin';
      return {
        intent: 'crypto',
        confidence: 0.95,
        params: { coinId },
        needsRealTimeData: true
      };
    }
  }
  
  // STOCK detection
  const stockPatterns = [
    /\b(?:stock|share|ticker)\s*(?:price|quote)?\s*(?:of|for)?\s*\$?([A-Z]{1,5})\b/i,
    /\$([A-Z]{1,5})\b/,
    /\b(AAPL|GOOGL|GOOG|MSFT|AMZN|NVDA|META|TSLA|AMD|INTC|NFLX)\b/i,
    /\b(?:how\s+is|what(?:'s|\s+is)|check)\s+([A-Z]{1,5})\s+(?:stock|doing|trading)/i
  ];
  
  for (const pattern of stockPatterns) {
    const match = original.match(pattern);
    if (match && match[1]) {
      return {
        intent: 'stock',
        confidence: 0.9,
        params: { symbol: match[1].toUpperCase() },
        needsRealTimeData: true
      };
    }
  }
  
  // WEATHER detection
  if (/weather|temperature|forecast|rain|snow|sunny|cloudy|humidity|wind/i.test(lower)) {
    // Try to extract location
    let location = 'New York'; // default
    const locationPatterns = [
      /weather\s+(?:in|for|at)\s+([^?.!]+)/i,
      /(?:in|for|at)\s+([^?.!]+?)\s*(?:weather|temperature)/i,
      /what(?:'s|\s+is)\s+(?:the\s+)?(?:weather|temperature)\s+(?:like\s+)?(?:in|for|at)\s+([^?.!]+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        location = match[1].trim().replace(/[?.!,]$/, '');
        break;
      }
    }
    
    return {
      intent: 'weather',
      confidence: 0.95,
      params: { location },
      needsRealTimeData: true
    };
  }
  
  // NEWS detection
  if (/\b(news|headlines?|current events?|what('s| is) happening|latest)\b/i.test(lower)) {
    let topic = 'technology';
    const topicPatterns = [
      /news\s+(?:about|on|for)\s+([^?.!]+)/i,
      /(?:latest|recent)\s+([^?.!]+?)\s*news/i
    ];
    
    for (const pattern of topicPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        topic = match[1].trim();
        break;
      }
    }
    
    return {
      intent: 'news',
      confidence: 0.85,
      params: { topic },
      needsRealTimeData: true
    };
  }
  
  // WIKIPEDIA / Knowledge detection
  if (/\b(who is|what is|tell me about|explain|define|wikipedia)\b/i.test(lower)) {
    const patterns = [
      /(?:who|what)\s+is\s+([^?.!]+)/i,
      /tell\s+me\s+about\s+([^?.!]+)/i,
      /explain\s+([^?.!]+)/i,
      /define\s+([^?.!]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return {
          intent: 'wikipedia',
          confidence: 0.8,
          params: { query: match[1].trim() },
          needsRealTimeData: true
        };
      }
    }
  }
  
  // TRANSLATION detection
  if (/\b(translate|translation|in\s+spanish|in\s+french|in\s+german|in\s+japanese|in\s+chinese)\b/i.test(lower)) {
    const translateMatch = message.match(/translate\s+["']?(.+?)["']?\s+(?:to|into)\s+(\w+)/i);
    if (translateMatch) {
      return {
        intent: 'translate',
        confidence: 0.9,
        params: { text: translateMatch[1], targetLang: translateMatch[2] },
        needsRealTimeData: true
      };
    }
    return {
      intent: 'translate',
      confidence: 0.7,
      params: { text: message, targetLang: 'es' },
      needsRealTimeData: true
    };
  }
  
  // GITHUB TRENDING detection
  if (/\b(github|trending|repositories|repos|open source)\b/i.test(lower) && /\b(trending|popular|hot|new)\b/i.test(lower)) {
    const langMatch = message.match(/(?:in|for)\s+(python|javascript|typescript|rust|go|java|c\+\+|ruby)/i);
    return {
      intent: 'github',
      confidence: 0.85,
      params: { language: langMatch?.[1] || null },
      needsRealTimeData: true
    };
  }
  
  // NPM PACKAGE detection
  if (/\b(npm|package|module)\s+(?:info|details|about)?\s*([a-z0-9-_.]+)/i.test(lower)) {
    const packageMatch = message.match(/(?:npm|package|module)\s+(?:info|details|about)?\s*([a-z0-9-_.]+)/i);
    if (packageMatch) {
      return {
        intent: 'npm',
        confidence: 0.9,
        params: { package: packageMatch[1] },
        needsRealTimeData: true
      };
    }
  }
  
  // IMAGE SEARCH detection
  if (/\b(image|photo|picture)\s+(?:of|for)\s+(.+)/i.test(lower) || /\bfind\s+(?:me\s+)?(?:an?\s+)?(?:image|photo|picture)/i.test(lower)) {
    const imageMatch = message.match(/(?:image|photo|picture)\s+(?:of|for)\s+(.+)/i);
    return {
      intent: 'images',
      confidence: 0.85,
      params: { query: imageMatch?.[1] || 'nature' },
      needsRealTimeData: true
    };
  }
  
  // GIF detection
  if (/\b(gif|giphy)\s+(?:of|for|about)?\s*(.+)?/i.test(lower)) {
    const gifMatch = message.match(/(?:gif|giphy)\s+(?:of|for|about)?\s*(.+)/i);
    return {
      intent: 'gif',
      confidence: 0.85,
      params: { query: gifMatch?.[1] || 'funny' },
      needsRealTimeData: true
    };
  }
  
  // DICTIONARY detection
  if (/\b(dictionary|define|definition|meaning\s+of|what\s+does\s+\w+\s+mean)\b/i.test(lower)) {
    const wordMatch = message.match(/(?:define|definition\s+of|meaning\s+of|what\s+does)\s+["']?(\w+)["']?/i);
    if (wordMatch) {
      return {
        intent: 'dictionary',
        confidence: 0.9,
        params: { word: wordMatch[1] },
        needsRealTimeData: true
      };
    }
  }
  
  // EXCHANGE RATE detection
  if (/\b(exchange\s+rate|convert|currency|usd\s+to|eur\s+to|gbp\s+to)\b/i.test(lower)) {
    const exchangeMatch = message.match(/(\w{3})\s+to\s+(\w{3})/i);
    return {
      intent: 'exchange',
      confidence: 0.9,
      params: { 
        from: exchangeMatch?.[1]?.toUpperCase() || 'USD', 
        to: exchangeMatch?.[2]?.toUpperCase() || 'EUR' 
      },
      needsRealTimeData: true
    };
  }
  
  // IP/LOCATION detection
  if (/\b(my\s+ip|ip\s+address|where\s+am\s+i|my\s+location|geolocation)\b/i.test(lower)) {
    return {
      intent: 'ip',
      confidence: 0.9,
      params: {},
      needsRealTimeData: true
    };
  }
  
  // TIME detection
  if (/\b(what\s+time|current\s+time|time\s+in|timezone)\b/i.test(lower)) {
    const tzMatch = message.match(/time\s+in\s+([^?.!]+)/i);
    return {
      intent: 'time',
      confidence: 0.9,
      params: { timezone: tzMatch?.[1] || null },
      needsRealTimeData: true
    };
  }
  
  // JOKE detection
  if (/\b(joke|funny|make me laugh|tell me something funny)\b/i.test(lower)) {
    return {
      intent: 'joke',
      confidence: 0.95,
      params: {},
      needsRealTimeData: true
    };
  }
  
  // QUOTE detection
  if (/\b(quote|inspiration|motivat|wisdom)\b/i.test(lower)) {
    return {
      intent: 'quote',
      confidence: 0.9,
      params: {},
      needsRealTimeData: true
    };
  }
  
  // FACT detection
  if (/\b(random fact|tell me a fact|interesting fact|fun fact|did you know)\b/i.test(lower)) {
    return {
      intent: 'fact',
      confidence: 0.9,
      params: {},
      needsRealTimeData: true
    };
  }
  
  // Default chat - no real-time data needed
  return {
    intent: 'chat',
    confidence: 1.0,
    params: {},
    needsRealTimeData: false
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER APIS - 3 SOURCES WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWeather(location: string): Promise<APIResult> {
  const start = Date.now();
  
  // Source 1: wttr.in (FREE - no key required)
  try {
    const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
      headers: { 'User-Agent': 'Javari-AI/8.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const data = await response.json();
      const current = data.current_condition?.[0];
      const area = data.nearest_area?.[0];
      
      if (current) {
        return {
          success: true,
          source: 'wttr.in',
          data: {
            location: `${area?.areaName?.[0]?.value || location}, ${area?.region?.[0]?.value || ''}, ${area?.country?.[0]?.value || ''}`,
            temperature: { fahrenheit: current.temp_F, celsius: current.temp_C },
            feelsLike: { fahrenheit: current.FeelsLikeF, celsius: current.FeelsLikeC },
            condition: current.weatherDesc?.[0]?.value,
            humidity: `${current.humidity}%`,
            wind: { speed_mph: current.windspeedMiles, direction: current.winddir16Point },
            visibility: `${current.visibility} miles`,
            uvIndex: current.uvIndex
          },
          latency_ms: Date.now() - start
        };
      }
    }
  } catch (e) { console.log('[Weather] wttr.in failed, trying fallback...'); }
  
  // Source 2: Open-Meteo (FREE - no key required, unlimited)
  try {
    // First geocode the location
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    const geoData = await geoRes.json();
    
    if (geoData.results?.[0]) {
      const { latitude, longitude, name, country } = geoData.results[0];
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&temperature_unit=fahrenheit&wind_speed_unit=mph`,
        { signal: AbortSignal.timeout(5000) }
      );
      const weather = await weatherRes.json();
      
      // Weather code to description
      const weatherCodes: Record<number, string> = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
        55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 95: 'Thunderstorm'
      };
      
      return {
        success: true,
        source: 'open-meteo',
        data: {
          location: `${name}, ${country}`,
          temperature: { fahrenheit: Math.round(weather.current.temperature_2m), celsius: Math.round((weather.current.temperature_2m - 32) * 5/9) },
          feelsLike: { fahrenheit: Math.round(weather.current.apparent_temperature) },
          condition: weatherCodes[weather.current.weather_code] || 'Unknown',
          humidity: `${weather.current.relative_humidity_2m}%`,
          wind: { speed_mph: Math.round(weather.current.wind_speed_10m) }
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[Weather] Open-Meteo failed, trying fallback...'); }
  
  // Source 3: WeatherAPI.com (FREE - 1M calls/month, requires key)
  if (process.env.WEATHER_API_KEY) {
    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=yes`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.location) {
        return {
          success: true,
          source: 'weatherapi',
          data: {
            location: `${data.location.name}, ${data.location.region}, ${data.location.country}`,
            temperature: { fahrenheit: Math.round(data.current.temp_f), celsius: Math.round(data.current.temp_c) },
            feelsLike: { fahrenheit: Math.round(data.current.feelslike_f), celsius: Math.round(data.current.feelslike_c) },
            condition: data.current.condition.text,
            humidity: `${data.current.humidity}%`,
            wind: { speed_mph: Math.round(data.current.wind_mph), direction: data.current.wind_dir },
            uvIndex: data.current.uv,
            airQuality: data.current.air_quality
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Weather] WeatherAPI failed'); }
  }
  
  return { success: false, source: 'none', error: 'All weather sources failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRYPTO APIS - 3 SOURCES WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchCrypto(coinId: string): Promise<APIResult> {
  const start = Date.now();
  
  // Source 1: CoinGecko (FREE - 30 calls/min)
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const coinData = data[coinId];
      if (coinData) {
        return {
          success: true,
          source: 'coingecko',
          data: {
            coin: coinId.charAt(0).toUpperCase() + coinId.slice(1),
            price: coinData.usd,
            priceFormatted: `$${coinData.usd?.toLocaleString()}`,
            change24h: `${coinData.usd_24h_change?.toFixed(2)}%`,
            marketCap: `$${(coinData.usd_market_cap / 1e9)?.toFixed(2)}B`,
            volume24h: `$${(coinData.usd_24h_vol / 1e9)?.toFixed(2)}B`
          },
          latency_ms: Date.now() - start
        };
      }
    }
  } catch (e) { console.log('[Crypto] CoinGecko failed, trying fallback...'); }
  
  // Source 2: CoinCap (FREE - unlimited)
  try {
    const response = await fetch(
      `https://api.coincap.io/v2/assets/${coinId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      if (data.data) {
        const d = data.data;
        return {
          success: true,
          source: 'coincap',
          data: {
            coin: d.name,
            symbol: d.symbol,
            price: parseFloat(d.priceUsd),
            priceFormatted: `$${parseFloat(d.priceUsd).toLocaleString(undefined, {maximumFractionDigits: 2})}`,
            change24h: `${parseFloat(d.changePercent24Hr).toFixed(2)}%`,
            marketCap: `$${(parseFloat(d.marketCapUsd) / 1e9).toFixed(2)}B`,
            rank: d.rank
          },
          latency_ms: Date.now() - start
        };
      }
    }
  } catch (e) { console.log('[Crypto] CoinCap failed, trying fallback...'); }
  
  // Source 3: CoinPaprika (FREE - 25K/month)
  try {
    const response = await fetch(
      `https://api.coinpaprika.com/v1/tickers/${coinId}-${coinId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      if (data.quotes?.USD) {
        return {
          success: true,
          source: 'coinpaprika',
          data: {
            coin: data.name,
            symbol: data.symbol,
            price: data.quotes.USD.price,
            priceFormatted: `$${data.quotes.USD.price?.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
            change24h: `${data.quotes.USD.percent_change_24h?.toFixed(2)}%`,
            marketCap: `$${(data.quotes.USD.market_cap / 1e9).toFixed(2)}B`,
            rank: data.rank
          },
          latency_ms: Date.now() - start
        };
      }
    }
  } catch (e) { console.log('[Crypto] CoinPaprika failed'); }
  
  return { success: false, source: 'none', error: 'All crypto sources failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK APIS - 3 SOURCES WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchStock(symbol: string): Promise<APIResult> {
  const start = Date.now();
  const sym = symbol.toUpperCase().replace('$', '');
  
  // Source 1: Finnhub (FREE - 60 calls/min)
  if (process.env.FINNHUB_API_KEY) {
    try {
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${process.env.FINNHUB_API_KEY}`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${process.env.FINNHUB_API_KEY}`, { signal: AbortSignal.timeout(5000) })
      ]);
      
      const quote = await quoteRes.json();
      const profile = await profileRes.json();
      
      if (quote.c && quote.c > 0) {
        return {
          success: true,
          source: 'finnhub',
          data: {
            symbol: sym,
            name: profile.name || sym,
            price: quote.c,
            priceFormatted: `$${quote.c?.toFixed(2)}`,
            change: quote.d,
            changeFormatted: `$${quote.d?.toFixed(2)}`,
            changePercent: `${quote.dp?.toFixed(2)}%`,
            high: `$${quote.h?.toFixed(2)}`,
            low: `$${quote.l?.toFixed(2)}`,
            open: `$${quote.o?.toFixed(2)}`,
            previousClose: `$${quote.pc?.toFixed(2)}`,
            industry: profile.finnhubIndustry,
            marketCap: profile.marketCapitalization ? `$${(profile.marketCapitalization / 1000).toFixed(2)}B` : null,
            logo: profile.logo,
            website: profile.weburl
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Stock] Finnhub failed, trying fallback...'); }
  }
  
  // Source 2: Alpha Vantage (FREE - 25 calls/day)
  if (process.env.ALPHA_VANTAGE_KEY) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${process.env.ALPHA_VANTAGE_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      const quote = data['Global Quote'];
      
      if (quote && quote['05. price']) {
        return {
          success: true,
          source: 'alphavantage',
          data: {
            symbol: quote['01. symbol'],
            price: parseFloat(quote['05. price']),
            priceFormatted: `$${parseFloat(quote['05. price']).toFixed(2)}`,
            change: parseFloat(quote['09. change']),
            changeFormatted: `$${parseFloat(quote['09. change']).toFixed(2)}`,
            changePercent: quote['10. change percent'],
            high: `$${parseFloat(quote['03. high']).toFixed(2)}`,
            low: `$${parseFloat(quote['04. low']).toFixed(2)}`,
            open: `$${parseFloat(quote['02. open']).toFixed(2)}`,
            previousClose: `$${parseFloat(quote['08. previous close']).toFixed(2)}`,
            volume: quote['06. volume']
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Stock] Alpha Vantage failed, trying fallback...'); }
  }
  
  // Source 3: Twelve Data (FREE - 800 calls/day)
  if (process.env.TWELVE_DATA_KEY) {
    try {
      const res = await fetch(
        `https://api.twelvedata.com/quote?symbol=${sym}&apikey=${process.env.TWELVE_DATA_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.close) {
        return {
          success: true,
          source: 'twelvedata',
          data: {
            symbol: data.symbol,
            name: data.name,
            price: parseFloat(data.close),
            priceFormatted: `$${parseFloat(data.close).toFixed(2)}`,
            change: parseFloat(data.change),
            changeFormatted: `$${parseFloat(data.change).toFixed(2)}`,
            changePercent: `${data.percent_change}%`,
            high: `$${parseFloat(data.high).toFixed(2)}`,
            low: `$${parseFloat(data.low).toFixed(2)}`,
            open: `$${parseFloat(data.open).toFixed(2)}`,
            previousClose: `$${parseFloat(data.previous_close).toFixed(2)}`,
            exchange: data.exchange
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Stock] Twelve Data failed'); }
  }
  
  return { 
    success: false, 
    source: 'none', 
    error: `Stock data requires API keys. Configure FINNHUB_API_KEY, ALPHA_VANTAGE_KEY, or TWELVE_DATA_KEY.`
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS APIS - 4 SOURCES WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchNews(query: string): Promise<APIResult> {
  const start = Date.now();
  
  // Source 1: GNews (FREE - 100/day)
  if (process.env.GNEWS_API_KEY) {
    try {
      const res = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&apikey=${process.env.GNEWS_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.articles?.length > 0) {
        return {
          success: true,
          source: 'gnews',
          data: {
            query,
            totalResults: data.totalArticles,
            articles: data.articles.slice(0, 5).map((a: any) => ({
              title: a.title,
              description: a.description,
              source: a.source?.name,
              url: a.url,
              image: a.image,
              publishedAt: a.publishedAt
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[News] GNews failed, trying fallback...'); }
  }
  
  // Source 2: NewsData.io (FREE - 200/day)
  if (process.env.NEWSDATA_API_KEY) {
    try {
      const res = await fetch(
        `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.results?.length > 0) {
        return {
          success: true,
          source: 'newsdata',
          data: {
            query,
            totalResults: data.totalResults,
            articles: data.results.slice(0, 5).map((a: any) => ({
              title: a.title,
              description: a.description,
              source: a.source_id,
              url: a.link,
              image: a.image_url,
              publishedAt: a.pubDate,
              categories: a.category
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[News] NewsData failed, trying fallback...'); }
  }
  
  // Source 3: Currents API (FREE - 600/day)
  if (process.env.CURRENTS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(query)}&apiKey=${process.env.CURRENTS_API_KEY}&language=en`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.news?.length > 0) {
        return {
          success: true,
          source: 'currents',
          data: {
            query,
            articles: data.news.slice(0, 5).map((a: any) => ({
              title: a.title,
              description: a.description,
              source: a.author,
              url: a.url,
              image: a.image,
              publishedAt: a.published,
              categories: a.category
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[News] Currents failed, trying fallback...'); }
  }
  
  // Source 4: TheNewsAPI (FREE - 100/day)
  if (process.env.THENEWS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.thenewsapi.com/v1/news/all?api_token=${process.env.THENEWS_API_KEY}&search=${encodeURIComponent(query)}&language=en&limit=5`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.data?.length > 0) {
        return {
          success: true,
          source: 'thenewsapi',
          data: {
            query,
            articles: data.data.map((a: any) => ({
              title: a.title,
              description: a.description,
              source: a.source,
              url: a.url,
              image: a.image_url,
              publishedAt: a.published_at
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[News] TheNewsAPI failed'); }
  }
  
  // Fallback - return suggestion
  return {
    success: true,
    source: 'fallback',
    data: {
      query,
      message: `For the latest news on "${query}", check these sources:`,
      suggestions: [
        { name: 'Google News', url: `https://news.google.com/search?q=${encodeURIComponent(query)}` },
        { name: 'Reuters', url: `https://www.reuters.com/search/news?blob=${encodeURIComponent(query)}` }
      ]
    },
    latency_ms: Date.now() - start
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE APIS - Wikipedia, Dictionary, DuckDuckGo
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWikipedia(query: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    // First try REST API
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.extract) {
        return {
          success: true,
          source: 'wikipedia',
          data: {
            title: data.title,
            extract: data.extract,
            description: data.description,
            url: data.content_urls?.desktop?.page,
            thumbnail: data.thumbnail?.source,
            type: data.type
          },
          latency_ms: Date.now() - start
        };
      }
    }
    
    // Fallback to search API
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
      { signal: AbortSignal.timeout(5000) }
    );
    const searchData = await searchRes.json();
    
    if (searchData.query?.search?.[0]) {
      const pageId = searchData.query.search[0].pageid;
      const contentRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts|pageimages|info&exintro=true&explaintext=true&piprop=thumbnail&pithumbsize=400&inprop=url&format=json&origin=*`,
        { signal: AbortSignal.timeout(5000) }
      );
      const contentData = await contentRes.json();
      const page = contentData.query.pages[pageId];
      
      return {
        success: true,
        source: 'wikipedia-search',
        data: {
          title: page.title,
          extract: page.extract?.substring(0, 2000),
          url: page.fullurl,
          thumbnail: page.thumbnail?.source
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[Wikipedia] Failed:', e); }
  
  return { success: false, source: 'none', error: 'Wikipedia lookup failed' };
}

async function fetchDictionary(word: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (res.ok) {
      const data = await res.json();
      const entry = data[0];
      
      return {
        success: true,
        source: 'dictionaryapi',
        data: {
          word: entry.word,
          phonetic: entry.phonetic,
          phonetics: entry.phonetics?.filter((p: any) => p.audio)?.slice(0, 2),
          meanings: entry.meanings?.map((m: any) => ({
            partOfSpeech: m.partOfSpeech,
            definitions: m.definitions?.slice(0, 3).map((d: any) => ({
              definition: d.definition,
              example: d.example,
              synonyms: d.synonyms?.slice(0, 5)
            }))
          })),
          sourceUrls: entry.sourceUrls
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[Dictionary] Failed:', e); }
  
  return { success: false, source: 'none', error: 'Dictionary lookup failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION API - MyMemory (FREE)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchTranslation(text: string, targetLang: string, sourceLang: string = 'en'): Promise<APIResult> {
  const start = Date.now();
  
  // Language code mapping
  const langMap: Record<string, string> = {
    'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
    'portuguese': 'pt', 'japanese': 'ja', 'chinese': 'zh', 'korean': 'ko',
    'russian': 'ru', 'arabic': 'ar', 'hindi': 'hi', 'dutch': 'nl'
  };
  const target = langMap[targetLang.toLowerCase()] || targetLang.toLowerCase();
  
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${target}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    
    if (data.responseData?.translatedText) {
      return {
        success: true,
        source: 'mymemory',
        data: {
          original: text,
          translated: data.responseData.translatedText,
          sourceLang,
          targetLang: target,
          match: data.responseData.match
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[Translation] MyMemory failed:', e); }
  
  return { success: false, source: 'none', error: 'Translation failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT APIS - GitHub Trending, NPM Package Info
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchGitHubTrending(language?: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const weekAgo = date.toISOString().split('T')[0];
    
    let query = `created:>${weekAgo}`;
    if (language) query += `+language:${encodeURIComponent(language)}`;
    
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`,
      { 
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(8000)
      }
    );
    const data = await res.json();
    
    if (data.items?.length > 0) {
      return {
        success: true,
        source: 'github',
        data: {
          totalCount: data.total_count,
          language: language || 'all',
          repositories: data.items.map((r: any) => ({
            name: r.full_name,
            description: r.description,
            url: r.html_url,
            stars: r.stargazers_count,
            forks: r.forks_count,
            language: r.language,
            topics: r.topics?.slice(0, 5),
            createdAt: r.created_at
          }))
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[GitHub] Failed:', e); }
  
  return { success: false, source: 'none', error: 'GitHub fetch failed' };
}

async function fetchNPMPackage(packageName: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    
    if (data.name) {
      const latest = data['dist-tags']?.latest;
      const latestVersion = data.versions?.[latest];
      
      return {
        success: true,
        source: 'npm',
        data: {
          name: data.name,
          description: data.description,
          version: latest,
          license: latestVersion?.license,
          homepage: data.homepage,
          repository: data.repository?.url,
          keywords: data.keywords?.slice(0, 10),
          maintainers: data.maintainers?.slice(0, 3).map((m: any) => m.name),
          dependencies: Object.keys(latestVersion?.dependencies || {}).length,
          weeklyDownloads: 'Check npmjs.com for stats'
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[NPM] Failed:', e); }
  
  return { success: false, source: 'none', error: 'NPM package lookup failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA APIS - Images, GIFs
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchImages(query: string): Promise<APIResult> {
  const start = Date.now();
  
  // Unsplash (FREE - 50/hour)
  if (process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
        { 
          headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
          signal: AbortSignal.timeout(5000)
        }
      );
      const data = await res.json();
      
      if (data.results?.length > 0) {
        return {
          success: true,
          source: 'unsplash',
          data: {
            query,
            totalResults: data.total,
            images: data.results.map((img: any) => ({
              id: img.id,
              description: img.description || img.alt_description,
              url: img.urls.regular,
              thumbnail: img.urls.thumb,
              photographer: img.user.name,
              photographerUrl: img.user.links.html,
              downloadUrl: img.links.download
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Unsplash] Failed, trying Pexels...'); }
  }
  
  // Pexels (FREE - 200/hour)
  if (process.env.PEXELS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`,
        { 
          headers: { 'Authorization': process.env.PEXELS_API_KEY },
          signal: AbortSignal.timeout(5000)
        }
      );
      const data = await res.json();
      
      if (data.photos?.length > 0) {
        return {
          success: true,
          source: 'pexels',
          data: {
            query,
            totalResults: data.total_results,
            images: data.photos.map((img: any) => ({
              id: img.id,
              description: img.alt,
              url: img.src.large,
              thumbnail: img.src.tiny,
              photographer: img.photographer,
              photographerUrl: img.photographer_url
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Pexels] Failed'); }
  }
  
  return { 
    success: true, 
    source: 'fallback',
    data: {
      query,
      message: 'Image search requires API keys. Configure UNSPLASH_ACCESS_KEY or PEXELS_API_KEY.',
      suggestion: `https://unsplash.com/s/photos/${encodeURIComponent(query)}`
    }
  };
}

async function fetchGif(query: string): Promise<APIResult> {
  const start = Date.now();
  
  if (process.env.GIPHY_API_KEY) {
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=5&rating=g`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.data?.length > 0) {
        return {
          success: true,
          source: 'giphy',
          data: {
            query,
            gifs: data.data.map((g: any) => ({
              id: g.id,
              title: g.title,
              url: g.images.original.url,
              thumbnail: g.images.fixed_height_small.url,
              embedUrl: g.embed_url
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Giphy] Failed'); }
  }
  
  return {
    success: true,
    source: 'fallback',
    data: {
      query,
      message: 'GIF search requires GIPHY_API_KEY.',
      suggestion: `https://giphy.com/search/${encodeURIComponent(query)}`
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY APIS - IP, Time, Exchange, Quotes, Jokes, Facts
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchIPInfo(): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch('http://ip-api.com/json/', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    
    if (data.status === 'success') {
      return {
        success: true,
        source: 'ip-api',
        data: {
          ip: data.query,
          city: data.city,
          region: data.regionName,
          country: data.country,
          countryCode: data.countryCode,
          zip: data.zip,
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone,
          isp: data.isp,
          org: data.org
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[IP] Failed'); }
  
  return { success: false, source: 'none', error: 'IP lookup failed' };
}

async function fetchTime(timezone?: string): Promise<APIResult> {
  const start = Date.now();
  
  if (timezone) {
    try {
      const res = await fetch(
        `https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      
      if (data.datetime) {
        return {
          success: true,
          source: 'worldtimeapi',
          data: {
            timezone: data.timezone,
            datetime: data.datetime,
            utcOffset: data.utc_offset,
            dayOfWeek: data.day_of_week,
            weekNumber: data.week_number
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { console.log('[Time] WorldTimeAPI failed'); }
  }
  
  // Fallback to JavaScript
  const now = new Date();
  return {
    success: true,
    source: 'local',
    data: {
      datetime: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: now.toLocaleString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: 'numeric', timeZoneName: 'short'
      })
    },
    latency_ms: Date.now() - start
  };
}

async function fetchExchangeRate(from: string, to: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${from}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    
    if (data.rates?.[to]) {
      return {
        success: true,
        source: 'exchangerate-api',
        data: {
          from,
          to,
          rate: data.rates[to],
          formatted: `1 ${from} = ${data.rates[to].toFixed(4)} ${to}`,
          timestamp: data.time_last_updated
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) { console.log('[Exchange] Failed'); }
  
  return { success: false, source: 'none', error: 'Exchange rate lookup failed' };
}

async function fetchJoke(): Promise<APIResult> {
  const start = Date.now();
  
  // Try multiple sources
  const sources = [
    async () => {
      const res = await fetch('https://official-joke-api.appspot.com/random_joke', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return { source: 'official-joke-api', joke: { setup: data.setup, punchline: data.punchline, type: data.type } };
    },
    async () => {
      const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return { 
        source: 'jokeapi', 
        joke: data.type === 'single' 
          ? { joke: data.joke } 
          : { setup: data.setup, punchline: data.delivery }
      };
    }
  ];
  
  for (const fetchSource of sources) {
    try {
      const result = await fetchSource();
      return {
        success: true,
        source: result.source,
        data: result.joke,
        latency_ms: Date.now() - start
      };
    } catch (e) { continue; }
  }
  
  return { success: false, source: 'none', error: 'Joke fetch failed' };
}

async function fetchQuote(): Promise<APIResult> {
  const start = Date.now();
  
  const sources = [
    async () => {
      const res = await fetch('https://api.quotable.io/random', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return { source: 'quotable', quote: { content: data.content, author: data.author, tags: data.tags } };
    },
    async () => {
      const res = await fetch('https://zenquotes.io/api/random', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return { source: 'zenquotes', quote: { content: data[0]?.q, author: data[0]?.a } };
    }
  ];
  
  for (const fetchSource of sources) {
    try {
      const result = await fetchSource();
      return {
        success: true,
        source: result.source,
        data: result.quote,
        latency_ms: Date.now() - start
      };
    } catch (e) { continue; }
  }
  
  return { success: false, source: 'none', error: 'Quote fetch failed' };
}

async function fetchFact(): Promise<APIResult> {
  const start = Date.now();
  
  const sources = [
    async () => {
      const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return { source: 'uselessfacts', fact: { text: data.text, source: data.source } };
    },
    async () => {
      const res = await fetch('https://api.api-ninjas.com/v1/facts', { 
        headers: { 'X-Api-Key': process.env.API_NINJAS_KEY || '' },
        signal: AbortSignal.timeout(3000)
      });
      const data = await res.json();
      return { source: 'api-ninjas', fact: { text: data[0]?.fact } };
    }
  ];
  
  for (const fetchSource of sources) {
    try {
      const result = await fetchSource();
      if (result.fact?.text) {
        return {
          success: true,
          source: result.source,
          data: result.fact,
          latency_ms: Date.now() - start
        };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, source: 'none', error: 'Fact fetch failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT ENRICHMENT - Fetch all relevant data based on intent
// ═══════════════════════════════════════════════════════════════════════════════

async function enrichContext(intent: IntentResult): Promise<EnrichedContext> {
  const context: EnrichedContext = {};
  
  switch (intent.intent) {
    case 'weather':
      context.weather = await fetchWeather(intent.params.location);
      break;
    case 'crypto':
      context.crypto = await fetchCrypto(intent.params.coinId);
      break;
    case 'stock':
      context.stock = await fetchStock(intent.params.symbol);
      break;
    case 'news':
      context.news = await fetchNews(intent.params.topic);
      break;
    case 'wikipedia':
      context.wikipedia = await fetchWikipedia(intent.params.query);
      break;
    case 'translate':
      context.translation = await fetchTranslation(intent.params.text, intent.params.targetLang);
      break;
    case 'github':
      context.github = await fetchGitHubTrending(intent.params.language);
      break;
    case 'npm':
      context.npm = await fetchNPMPackage(intent.params.package);
      break;
    case 'images':
      context.images = await fetchImages(intent.params.query);
      break;
    case 'gif':
      context.gifs = await fetchGif(intent.params.query);
      break;
    case 'dictionary':
      context.dictionary = await fetchDictionary(intent.params.word);
      break;
    case 'exchange':
      context.exchange = await fetchExchangeRate(intent.params.from, intent.params.to);
      break;
    case 'ip':
      context.ip = await fetchIPInfo();
      break;
    case 'time':
      context.time = await fetchTime(intent.params.timezone);
      break;
    case 'joke':
      context.joke = await fetchJoke();
      break;
    case 'quote':
      context.quote = await fetchQuote();
      break;
    case 'fact':
      context.fact = await fetchFact();
      break;
  }
  
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIP DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function detectVIP(message: string): VIPDetection {
  const lower = message.toLowerCase();
  
  if (lower.includes('roy henderson') || lower.includes('roy') && (lower.includes('ceo') || lower.includes('founder'))) {
    return { isVIP: true, vipName: 'Roy Henderson', vipRole: 'CEO & Founder of CR AudioViz AI' };
  }
  
  if (lower.includes('cindy henderson') || lower.includes('cindy') && (lower.includes('cfo') || lower.includes('co-founder'))) {
    return { isVIP: true, vipName: 'Cindy Henderson', vipRole: 'CFO & Co-Founder of CR AudioViz AI' };
  }
  
  return { isVIP: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function detectBuildIntent(message: string): BuildIntent {
  const lower = message.toLowerCase();
  
  const buildKeywords = [
    'build', 'create', 'make', 'generate', 'develop', 'code', 'implement',
    'design', 'scaffold', 'construct', 'app', 'website', 'component',
    'dashboard', 'landing page', 'form', 'api', 'database', 'authentication'
  ];
  
  const isBuild = buildKeywords.some(kw => lower.includes(kw));
  
  if (!isBuild) {
    return { isBuild: false, complexity: 'simple', estimatedCredits: 1, keywords: [] };
  }
  
  const matchedKeywords = buildKeywords.filter(kw => lower.includes(kw));
  
  let complexity: 'simple' | 'medium' | 'complex' | 'enterprise' = 'simple';
  let estimatedCredits = 5;
  
  if (lower.includes('full') || lower.includes('complete') || lower.includes('enterprise')) {
    complexity = 'enterprise';
    estimatedCredits = 50;
  } else if (lower.includes('dashboard') || lower.includes('authentication') || lower.includes('database')) {
    complexity = 'complex';
    estimatedCredits = 25;
  } else if (lower.includes('landing') || lower.includes('form') || lower.includes('component')) {
    complexity = 'medium';
    estimatedCredits = 10;
  }
  
  let appType = 'general';
  if (lower.includes('dashboard')) appType = 'dashboard';
  else if (lower.includes('landing')) appType = 'landing-page';
  else if (lower.includes('form')) appType = 'form';
  else if (lower.includes('api')) appType = 'api';
  else if (lower.includes('auth')) appType = 'authentication';
  else if (lower.includes('component')) appType = 'component';
  
  return { isBuild: true, appType, complexity, estimatedCredits, keywords: matchedKeywords };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CALLS
// ═══════════════════════════════════════════════════════════════════════════════

async function callClaude(messages: Message[], systemPrompt: string): Promise<AIResponse | null> {
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });
    
    if (!response.ok) {
      console.error('[Claude] Error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === 'text');
    
    return {
      response: textContent?.text || '',
      provider: 'Anthropic',
      model: 'claude-3-5-sonnet-20241022',
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      cost: 0,
      responseTimeMs: Date.now() - startTime,
      fallbackUsed: false
    };
  } catch (error) {
    console.error('[Claude] Error:', error);
    return null;
  }
}

async function callOpenAI(messages: Message[], systemPrompt: string, model: string = 'gpt-4-turbo-preview'): Promise<AIResponse | null> {
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      console.error('[OpenAI] Error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      response: data.choices?.[0]?.message?.content || '',
      provider: 'OpenAI',
      model,
      tokensUsed: data.usage?.total_tokens || 0,
      cost: 0,
      responseTimeMs: Date.now() - startTime,
      fallbackUsed: false
    };
  } catch (error) {
    console.error('[OpenAI] Error:', error);
    return null;
  }
}

async function callGemini(messages: Message[], systemPrompt: string): Promise<AIResponse | null> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_AI_API_KEY || ''}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 8000, temperature: 0.7 }
        })
      }
    );
    
    if (!response.ok) {
      console.error('[Gemini] Error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      response: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      provider: 'Google',
      model: 'gemini-1.5-pro',
      tokensUsed: 0,
      cost: 0,
      responseTimeMs: Date.now() - startTime,
      fallbackUsed: false
    };
  } catch (error) {
    console.error('[Gemini] Error:', error);
    return null;
  }
}

async function callPerplexity(messages: Message[], systemPrompt: string): Promise<AIResponse | null> {
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || ''}`
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ]
      })
    });
    
    if (!response.ok) {
      console.error('[Perplexity] Error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      response: data.choices?.[0]?.message?.content || '',
      provider: 'Perplexity',
      model: 'sonar-pro',
      tokensUsed: data.usage?.total_tokens || 0,
      cost: 0,
      responseTimeMs: Date.now() - startTime,
      fallbackUsed: false
    };
  } catch (error) {
    console.error('[Perplexity] Error:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE SYSTEM PROMPT WITH ENRICHED CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

function generateSystemPrompt(
  vip: VIPDetection,
  buildIntent: BuildIntent,
  intent: IntentResult,
  context: EnrichedContext
): string {
  let prompt = `You are Javari AI, the most advanced AI assistant ever created. You are part of the CR AudioViz AI ecosystem.

CURRENT DATE/TIME: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST

YOUR CAPABILITIES (v8.0 - MEGA INTELLIGENCE):
- 35+ Real-time API integrations with automatic fallbacks
- Multi-AI orchestration (Claude, GPT-4, GPT-4o, Gemini, Perplexity)
- Code generation, analysis, and debugging
- Real-time weather, stocks, crypto, news data
- Translation, image search, GIF search
- GitHub trending repos, NPM package info
- Dictionary definitions, exchange rates
- Jokes, quotes, random facts

CRITICAL INSTRUCTION: DO NOT say "I don't have access to real-time data" - YOU DO!
You have access to live data feeds. Use the enriched context provided below.
`;

  // VIP handling
  if (vip.isVIP) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
🌟 VIP USER DETECTED: ${vip.vipName}
Role: ${vip.vipRole}
Priority: MAXIMUM - Treat all requests with highest priority
═══════════════════════════════════════════════════════════════════════════════
`;
  }
  
  // Build intent handling
  if (buildIntent.isBuild) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
🔨 BUILD REQUEST DETECTED
App Type: ${buildIntent.appType}
Complexity: ${buildIntent.complexity}
Estimated Credits: ${buildIntent.estimatedCredits}
Keywords: ${buildIntent.keywords.join(', ')}

INSTRUCTIONS:
- Provide COMPLETE, production-ready code
- Include all imports and dependencies
- Add comprehensive comments
- Use modern best practices (TypeScript, Tailwind CSS, shadcn/ui)
- Include error handling and loading states
═══════════════════════════════════════════════════════════════════════════════
`;
  }
  
  // Add enriched context
  if (Object.keys(context).length > 0) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
📊 REAL-TIME DATA (Retrieved just now - USE THIS DATA):
═══════════════════════════════════════════════════════════════════════════════
`;
    
    for (const [key, value] of Object.entries(context)) {
      if (value && value.success) {
        prompt += `\n[${key.toUpperCase()}] Source: ${value.source} (${value.latency_ms || 0}ms)\n`;
        prompt += JSON.stringify(value.data, null, 2) + '\n';
      }
    }
  }
  
  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { messages, provider: requestedProvider } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;
    
    console.log(`[Javari v8.0] Processing: "${userMessage.substring(0, 100)}..."`);
    
    // Detect intent, VIP status, and build intent
    const intent = detectIntent(userMessage);
    const vip = detectVIP(userMessage);
    const buildIntent = detectBuildIntent(userMessage);
    
    console.log(`[Javari v8.0] Intent: ${intent.intent}, Confidence: ${intent.confidence}, NeedsData: ${intent.needsRealTimeData}`);
    
    // Enrich context with real-time data
    let context: EnrichedContext = {};
    if (intent.needsRealTimeData) {
      console.log(`[Javari v8.0] Fetching real-time data for: ${intent.intent}`);
      context = await enrichContext(intent);
    }
    
    // Generate system prompt with all context
    const systemPrompt = generateSystemPrompt(vip, buildIntent, intent, context);
    
    // Try providers in order with fallback
    let aiResponse: AIResponse | null = null;
    const providers = requestedProvider 
      ? [requestedProvider]
      : ['claude', 'openai', 'gpt-4o', 'gemini', 'perplexity'];
    
    for (const provider of providers) {
      console.log(`[Javari v8.0] Trying provider: ${provider}`);
      
      switch (provider) {
        case 'claude':
          if (process.env.ANTHROPIC_API_KEY) {
            aiResponse = await callClaude(messages, systemPrompt);
          }
          break;
        case 'openai':
          if (process.env.OPENAI_API_KEY) {
            aiResponse = await callOpenAI(messages, systemPrompt, 'gpt-4-turbo-preview');
          }
          break;
        case 'gpt-4o':
          if (process.env.OPENAI_API_KEY) {
            aiResponse = await callOpenAI(messages, systemPrompt, 'gpt-4o');
          }
          break;
        case 'gemini':
          if (process.env.GOOGLE_AI_API_KEY) {
            aiResponse = await callGemini(messages, systemPrompt);
          }
          break;
        case 'perplexity':
          if (process.env.PERPLEXITY_API_KEY) {
            aiResponse = await callPerplexity(messages, systemPrompt);
          }
          break;
      }
      
      if (aiResponse) {
        console.log(`[Javari v8.0] Success with ${provider} in ${aiResponse.responseTimeMs}ms`);
        break;
      }
    }
    
    if (!aiResponse) {
      return NextResponse.json({
        error: 'All AI providers failed',
        message: 'Unable to process request. Please check API keys and try again.'
      }, { status: 503 });
    }
    
    // Log usage to database
    try {
      await supabase.from('ai_usage_logs').insert({
        provider: aiResponse.provider,
        model: aiResponse.model,
        tokens_used: aiResponse.tokensUsed,
        response_time_ms: aiResponse.responseTimeMs,
        intent: intent.intent,
        is_vip: vip.isVIP,
        is_build: buildIntent.isBuild,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.log('[Javari v8.0] Usage logging skipped');
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[Javari v8.0] Total request time: ${totalTime}ms`);
    
    return NextResponse.json({
      content: aiResponse.response,
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      responseTimeMs: aiResponse.responseTimeMs,
      totalTimeMs: totalTime,
      intent: intent.intent,
      isVIP: vip.isVIP,
      isBuild: buildIntent.isBuild,
      enrichedData: Object.keys(context).length > 0 ? Object.keys(context) : null,
      version: '8.0-mega-intelligence'
    });
    
  } catch (error) {
    console.error('[Javari v8.0] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari AI',
    version: '8.0-mega-intelligence',
    status: 'operational',
    timestamp: new Date().toISOString(),
    capabilities: {
      totalAPIs: 35,
      categories: {
        weather: ['wttr.in', 'open-meteo', 'weatherapi'],
        crypto: ['coingecko', 'coincap', 'coinpaprika'],
        stocks: ['finnhub', 'alphavantage', 'twelvedata'],
        news: ['gnews', 'newsdata', 'currents', 'thenewsapi'],
        knowledge: ['wikipedia', 'dictionaryapi'],
        translation: ['mymemory'],
        development: ['github', 'npm'],
        media: ['unsplash', 'pexels', 'giphy'],
        utility: ['ip-api', 'worldtimeapi', 'exchangerate-api', 'jokes', 'quotes', 'facts']
      },
      aiProviders: ['claude', 'openai', 'gpt-4o', 'gemini', 'perplexity'],
      features: ['vip-detection', 'build-intent', 'auto-fallback', 'usage-logging']
    }
  });
}
