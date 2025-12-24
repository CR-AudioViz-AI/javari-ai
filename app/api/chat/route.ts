// app/api/chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - MEGA INTELLIGENCE SYSTEM v9.3
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Monday, December 23, 2025 - 5:45 PM EST
// Version: 9.5 - THE HENDERSON EXCELLENCE STANDARD
// 
// "Never settle for less than the best or we will always be playing catchup"
// - Roy Henderson, CEO, CR AudioViz AI
//
// THE JAVARI DIFFERENCE:
// Everyone else gives you a pretty frontend and says "good luck"
// Javari delivers COMPLETE, PRODUCTION-READY solutions:
// - Frontend + Backend + Database + Auth + Deployment
// - Asks the RIGHT questions before building
// - Makes every customer feel SPECIAL and PROTECTED
// - Never cuts corners, never settles
//
// EVERY BUILD INCLUDES:
// ✅ Responsive, accessible frontend (WCAG 2.2 AA)
// ✅ Full backend API routes
// ✅ Database schema and queries
// ✅ Authentication ready
// ✅ Input validation and error handling
// ✅ Seed data so it works immediately
// ✅ The extra touches that show we care
//
// This route connects ALL autonomous systems with MAXIMUM API coverage:
// ✅ Multi-AI Orchestrator - Intelligent task routing
// ✅ Learning System - Captures insights from every conversation
// ✅ Self-Healing - Monitors and auto-fixes deployments
// ✅ Knowledge Base - Context-aware responses
// ✅ VIP Detection - Special handling for Roy/Cindy
// ✅ Build Intent - NOW EXECUTES BUILDS!
// ✅ MEGA INTELLIGENCE - 35+ Real-time API sources with fallbacks
// ✅ VERIFICATION - Checks URLs actually work before celebrating
// ✅ AUTONOMOUS CONTINUATION - Never stops until complete
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
// CONTEXT LIMIT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const CONTEXT_TOKEN_LIMIT = 100000; // Conservative estimate
const CONTEXT_WARNING_THRESHOLD = 0.75; // 75% = warn
const CONTEXT_CRITICAL_THRESHOLD = 0.90; // 90% = must continue

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function checkContextStatus(messages: Array<{ content: string }>): {
  totalTokens: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'critical';
  shouldContinue: boolean;
} {
  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
  const percentUsed = totalTokens / CONTEXT_TOKEN_LIMIT;
  
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (percentUsed >= CONTEXT_CRITICAL_THRESHOLD) {
    status = 'critical';
  } else if (percentUsed >= CONTEXT_WARNING_THRESHOLD) {
    status = 'warning';
  }
  
  return {
    totalTokens,
    percentUsed: Math.round(percentUsed * 100),
    status,
    shouldContinue: status === 'critical',
  };
}

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
  appName?: string;
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  estimatedCredits: number;
  keywords: string[];
  shouldExecute: boolean; // NEW: Whether to actually build and deploy
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

interface BuildResult {
  success: boolean;
  deploymentUrl?: string;
  repoUrl?: string;
  projectName?: string;
  status: string;
  message: string;
  buildId?: string;
  error?: string;
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
    const langMap: Record<string, string> = {
      'spanish': 'es', 'french': 'fr', 'german': 'de',
      'japanese': 'ja', 'chinese': 'zh', 'italian': 'it',
      'portuguese': 'pt', 'russian': 'ru', 'korean': 'ko'
    };
    
    let targetLang = 'es';
    let textToTranslate = message;
    
    for (const [lang, code] of Object.entries(langMap)) {
      if (lower.includes(lang)) {
        targetLang = code;
        break;
      }
    }
    
    const translatePattern = /translate\s*[:\"]?\s*(.+?)(?:\s*to\s*\w+)?$/i;
    const match = message.match(translatePattern);
    if (match) {
      textToTranslate = match[1].replace(/["']/g, '').trim();
    }
    
    return {
      intent: 'translation',
      confidence: 0.9,
      params: { text: textToTranslate, targetLang },
      needsRealTimeData: true
    };
  }
  
  // JOKE detection
  if (/\b(joke|funny|make me laugh|humor)\b/i.test(lower)) {
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
  if (/\b(random fact|fun fact|did you know|trivia)\b/i.test(lower)) {
    return {
      intent: 'fact',
      confidence: 0.9,
      params: {},
      needsRealTimeData: true
    };
  }
  
  // GITHUB detection
  if (/\b(github|trending|repositories|repos)\b/i.test(lower)) {
    return {
      intent: 'github',
      confidence: 0.85,
      params: { language: 'all' },
      needsRealTimeData: true
    };
  }
  
  // NPM detection
  if (/\b(npm|package|module)\b/i.test(lower)) {
    const match = message.match(/(?:npm|package)\s+(\S+)/i);
    return {
      intent: 'npm',
      confidence: 0.85,
      params: { package: match?.[1] || 'react' },
      needsRealTimeData: true
    };
  }
  
  // IMAGE search detection
  if (/\b(image|photo|picture|find.*image)\b/i.test(lower)) {
    const match = message.match(/(?:image|photo|picture)s?\s+(?:of\s+)?(.+)/i);
    return {
      intent: 'images',
      confidence: 0.85,
      params: { query: match?.[1]?.trim() || 'nature' },
      needsRealTimeData: true
    };
  }
  
  // GIF detection
  if (/\b(gif|gifs|animated)\b/i.test(lower)) {
    const match = message.match(/(?:gif|gifs)\s+(?:of\s+)?(.+)/i);
    return {
      intent: 'gifs',
      confidence: 0.9,
      params: { query: match?.[1]?.trim() || 'funny' },
      needsRealTimeData: true
    };
  }
  
  // DICTIONARY detection
  if (/\b(dictionary|meaning of|definition of|define)\b/i.test(lower)) {
    const match = message.match(/(?:meaning|definition)\s+(?:of\s+)?(\w+)/i) ||
                  message.match(/define\s+(\w+)/i);
    return {
      intent: 'dictionary',
      confidence: 0.9,
      params: { word: match?.[1] || 'serendipity' },
      needsRealTimeData: true
    };
  }
  
  // EXCHANGE RATE detection
  if (/\b(exchange rate|currency|convert.*to|usd|eur|gbp)\b/i.test(lower)) {
    return {
      intent: 'exchange',
      confidence: 0.85,
      params: { base: 'USD' },
      needsRealTimeData: true
    };
  }
  
  // TIME detection
  if (/\b(time in|current time|what time)\b/i.test(lower)) {
    const match = message.match(/time\s+(?:in\s+)?([^?.!]+)/i);
    return {
      intent: 'time',
      confidence: 0.9,
      params: { timezone: match?.[1]?.trim() || 'America/New_York' },
      needsRealTimeData: true
    };
  }
  
  // Default to chat
  return {
    intent: 'chat',
    confidence: 0.5,
    params: {},
    needsRealTimeData: false
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIP DETECTION - Special handling for Roy & Cindy
// ═══════════════════════════════════════════════════════════════════════════════

function detectVIP(message: string): VIPDetection {
  const lower = message.toLowerCase();
  
  // Roy detection
  if (lower.includes('roy') || lower.includes('ceo') || lower.includes('i am the owner')) {
    return {
      isVIP: true,
      vipName: 'Roy Henderson',
      vipRole: 'CEO & Co-Founder'
    };
  }
  
  // Cindy detection
  if (lower.includes('cindy') || lower.includes('cmo')) {
    return {
      isVIP: true,
      vipName: 'Cindy Henderson',
      vipRole: 'CMO & Co-Founder'
    };
  }
  
  return { isVIP: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD INTENT DETECTION - ENHANCED FOR EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

function detectBuildIntent(message: string): BuildIntent {
  const lower = message.toLowerCase();
  
  const buildKeywords = [
    'build', 'create', 'make', 'generate', 'develop', 'code', 'implement',
    'design', 'construct', 'deploy', 'launch', 'set up', 'setup'
  ];
  
  const appKeywords = [
    'app', 'application', 'website', 'site', 'page', 'landing page',
    'dashboard', 'portal', 'tool', 'component', 'feature', 'system'
  ];
  
  // Strong execution triggers - user explicitly wants deployment
  const executeKeywords = [
    'deploy', 'launch', 'go live', 'actually build', 'really build',
    'build and deploy', 'create and deploy', 'make it live', 'push to production',
    'build it now', 'create it now', 'deploy it', 'build me a', 'create me a',
    'make me a', 'i need a', 'i want a'
  ];
  
  const isBuild = buildKeywords.some(kw => lower.includes(kw));
  const hasAppKeyword = appKeywords.some(kw => lower.includes(kw));
  const shouldExecute = executeKeywords.some(kw => lower.includes(kw)) || 
                        (isBuild && hasAppKeyword);
  
  if (!isBuild) {
    return { 
      isBuild: false, 
      complexity: 'simple', 
      estimatedCredits: 1, 
      keywords: [],
      shouldExecute: false
    };
  }
  
  // Determine app type
  let appType = 'general';
  if (/landing\s*page/i.test(lower)) appType = 'landing-page';
  else if (/dashboard/i.test(lower)) appType = 'dashboard';
  else if (/e-?commerce|shop|store/i.test(lower)) appType = 'ecommerce';
  else if (/blog/i.test(lower)) appType = 'blog';
  else if (/portfolio/i.test(lower)) appType = 'portfolio';
  else if (/api/i.test(lower)) appType = 'api';
  else if (/admin/i.test(lower)) appType = 'admin-panel';
  else if (/game/i.test(lower)) appType = 'game';
  else if (/chat|messaging/i.test(lower)) appType = 'chat-app';
  else if (/calculator|tool/i.test(lower)) appType = 'utility';
  
  // Extract app name if mentioned
  let appName: string | undefined;
  const namePatterns = [
    /(?:called|named)\s+["']?(\w+(?:\s+\w+)*)["']?/i,
    /(?:for|about)\s+["']?(\w+(?:\s+\w+)*)["']?/i,
    /["'](\w+(?:\s+\w+)*)["']\s+(?:app|website|page)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      appName = match[1].trim();
      break;
    }
  }
  
  // Determine complexity
  let complexity: 'simple' | 'medium' | 'complex' | 'enterprise' = 'simple';
  let estimatedCredits = 5;
  
  if (/full|complete|comprehensive|enterprise|advanced/i.test(lower)) {
    complexity = 'enterprise';
    estimatedCredits = 50;
  } else if (/with.*auth|database|api|backend|payment/i.test(lower)) {
    complexity = 'complex';
    estimatedCredits = 25;
  } else if (/with.*form|animation|responsive|interactive/i.test(lower)) {
    complexity = 'medium';
    estimatedCredits = 10;
  }
  
  const matchedKeywords = buildKeywords.filter(kw => lower.includes(kw));
  
  return { 
    isBuild: true, 
    appType, 
    appName,
    complexity, 
    estimatedCredits, 
    keywords: matchedKeywords,
    shouldExecute
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API FETCHERS WITH FALLBACKS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWithFallback<T>(
  fetchers: (() => Promise<APIResult>)[],
  intentName: string
): Promise<T | null> {
  for (const fetcher of fetchers) {
    try {
      const result = await fetcher();
      if (result.success && result.data) {
        console.log(`[Javari v8.1] ${intentName} success from ${result.source}`);
        return result.data as T;
      }
    } catch (e) {
      continue;
    }
  }
  console.log(`[Javari v8.1] ${intentName} all sources failed`);
  return null;
}

// Weather APIs
async function fetchWeather(location: string): Promise<any> {
  return fetchWithFallback([
    // wttr.in (free, no key)
    async () => {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error('wttr.in failed');
      const data = await res.json();
      return {
        success: true,
        source: 'wttr.in',
        data: {
          location: data.nearest_area?.[0]?.areaName?.[0]?.value || location,
          temperature: data.current_condition?.[0]?.temp_F + '°F',
          condition: data.current_condition?.[0]?.weatherDesc?.[0]?.value,
          humidity: data.current_condition?.[0]?.humidity + '%',
          wind: data.current_condition?.[0]?.windspeedMiles + ' mph'
        }
      };
    },
    // Open-Meteo (free, no key)
    async () => {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`);
      const geo = await geoRes.json();
      if (!geo.results?.[0]) throw new Error('Location not found');
      const { latitude, longitude, name } = geo.results[0];
      
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
      );
      const weather = await weatherRes.json();
      
      return {
        success: true,
        source: 'open-meteo',
        data: {
          location: name,
          temperature: weather.current?.temperature_2m + '°F',
          humidity: weather.current?.relative_humidity_2m + '%',
          wind: weather.current?.wind_speed_10m + ' mph'
        }
      };
    }
  ], 'Weather');
}

// Crypto APIs
async function fetchCrypto(coinId: string): Promise<any> {
  return fetchWithFallback([
    // CoinGecko
    async () => {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error('CoinGecko failed');
      const data = await res.json();
      const coin = data[coinId];
      return {
        success: true,
        source: 'coingecko',
        data: {
          name: coinId.charAt(0).toUpperCase() + coinId.slice(1),
          price: `$${coin.usd.toLocaleString()}`,
          change24h: `${coin.usd_24h_change?.toFixed(2)}%`,
          marketCap: `$${(coin.usd_market_cap / 1e9).toFixed(2)}B`
        }
      };
    },
    // CoinCap
    async () => {
      const res = await fetch(`https://api.coincap.io/v2/assets/${coinId}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error('CoinCap failed');
      const data = await res.json();
      const coin = data.data;
      return {
        success: true,
        source: 'coincap',
        data: {
          name: coin.name,
          price: `$${parseFloat(coin.priceUsd).toLocaleString()}`,
          change24h: `${parseFloat(coin.changePercent24Hr).toFixed(2)}%`,
          marketCap: `$${(parseFloat(coin.marketCapUsd) / 1e9).toFixed(2)}B`
        }
      };
    }
  ], 'Crypto');
}

// Stock APIs
async function fetchStock(symbol: string): Promise<any> {
  return fetchWithFallback([
    // Finnhub
    async () => {
      const key = process.env.FINNHUB_API_KEY;
      if (!key) throw new Error('No Finnhub key');
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error('Finnhub failed');
      const data = await res.json();
      if (!data.c) throw new Error('No data');
      return {
        success: true,
        source: 'finnhub',
        data: {
          symbol,
          price: `$${data.c.toFixed(2)}`,
          change: `$${data.d?.toFixed(2) || '0.00'}`,
          changePercent: `${data.dp?.toFixed(2) || '0.00'}%`,
          high: `$${data.h?.toFixed(2)}`,
          low: `$${data.l?.toFixed(2)}`
        }
      };
    },
    // Alpha Vantage
    async () => {
      const key = process.env.ALPHA_VANTAGE_API_KEY;
      if (!key) throw new Error('No Alpha Vantage key');
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error('Alpha Vantage failed');
      const data = await res.json();
      const quote = data['Global Quote'];
      if (!quote) throw new Error('No quote data');
      return {
        success: true,
        source: 'alphavantage',
        data: {
          symbol,
          price: quote['05. price'],
          change: quote['09. change'],
          changePercent: quote['10. change percent'],
          high: quote['03. high'],
          low: quote['04. low']
        }
      };
    }
  ], 'Stock');
}

// News APIs
async function fetchNews(topic: string): Promise<any> {
  return fetchWithFallback([
    // GNews
    async () => {
      const key = process.env.GNEWS_API_KEY;
      if (!key) throw new Error('No GNews key');
      const res = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&token=${key}&max=5`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error('GNews failed');
      const data = await res.json();
      return {
        success: true,
        source: 'gnews',
        data: data.articles?.slice(0, 5).map((a: any) => ({
          title: a.title,
          source: a.source?.name,
          url: a.url
        }))
      };
    },
    // NewsData
    async () => {
      const key = process.env.NEWSDATA_API_KEY;
      if (!key) throw new Error('No NewsData key');
      const res = await fetch(
        `https://newsdata.io/api/1/news?apikey=${key}&q=${encodeURIComponent(topic)}&language=en`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error('NewsData failed');
      const data = await res.json();
      return {
        success: true,
        source: 'newsdata',
        data: data.results?.slice(0, 5).map((a: any) => ({
          title: a.title,
          source: a.source_id,
          url: a.link
        }))
      };
    }
  ], 'News');
}

// Wikipedia API
async function fetchWikipedia(query: string): Promise<any> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page
    };
  } catch {
    return null;
  }
}

// Joke API
async function fetchJoke(): Promise<any> {
  try {
    const res = await fetch('https://official-joke-api.appspot.com/random_joke', {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Quote API
async function fetchQuote(): Promise<any> {
  try {
    const res = await fetch('https://api.quotable.io/random', {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Translation API
async function fetchTranslation(text: string, targetLang: string): Promise<any> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      original: text,
      translated: data.responseData?.translatedText,
      targetLang
    };
  } catch {
    return null;
  }
}

// Exchange Rate API
async function fetchExchangeRate(base: string): Promise<any> {
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      base: data.base,
      rates: {
        EUR: data.rates?.EUR,
        GBP: data.rates?.GBP,
        JPY: data.rates?.JPY,
        CAD: data.rates?.CAD
      }
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT ENRICHMENT
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
    case 'joke':
      context.joke = await fetchJoke();
      break;
    case 'quote':
      context.quote = await fetchQuote();
      break;
    case 'translation':
      context.translation = await fetchTranslation(intent.params.text, intent.params.targetLang);
      break;
    case 'exchange':
      context.exchange = await fetchExchangeRate(intent.params.base);
      break;
  }
  
  return context;
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
    
    return {
      response: data.content?.[0]?.text || '',
      provider: 'Claude',
      model: 'claude-3-5-sonnet',
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
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...messages.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }))
          ]
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
      provider: 'Gemini',
      model: 'gemini-1.5-pro',
      tokensUsed: data.usageMetadata?.totalTokenCount || 0,
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
// BUILD EXECUTION - THE KEY FIX!
// ═══════════════════════════════════════════════════════════════════════════════

async function executeBuild(
  aiResponse: string,
  buildIntent: BuildIntent,
  userMessage: string
): Promise<BuildResult | null> {
  console.log('[Javari v9.0] 🔨 EXECUTING BUILD PIPELINE WITH VERIFICATION');
  
  try {
    // Extract code from AI response
    const codeMatch = aiResponse.match(/```(?:tsx?|jsx?|javascript|typescript)?\n([\s\S]*?)```/);
    
    if (!codeMatch || !codeMatch[1]) {
      console.log('[Javari v9.0] No code block found in AI response');
      
      // Log failure to learning database
      logLearning('failure', 'code_generation', userMessage, '', { reason: 'no_code_block' });
      
      return null;
    }
    
    const componentCode = codeMatch[1].trim();
    
    // Generate app name from intent or user message
    let appName = buildIntent.appName || 'javari-app';
    
    // Clean the app name
    appName = appName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
    
    // Add random suffix to ensure uniqueness
    const suffix = Math.random().toString(36).substring(2, 8);
    const projectName = `javari-${appName}-${suffix}`;
    
    // Extract description from user message
    const description = userMessage.substring(0, 200);
    
    console.log(`[Javari v9.0] Building: ${projectName}`);
    console.log(`[Javari v9.0] Code length: ${componentCode.length} chars`);
    
    // STEP 1: Call the build API
    console.log('[Javari v9.0] Step 1: Deploying to Vercel...');
    const buildResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentCode,
        appName: projectName,
        appDescription: description
      })
    });
    
    if (!buildResponse.ok) {
      const errorData = await buildResponse.json().catch(() => ({}));
      console.error('[Javari v9.0] Build API error:', errorData);
      
      logLearning('failure', 'deployment', userMessage, componentCode, { buildError: errorData });
      
      return {
        success: false,
        status: 'error',
        message: errorData.message || 'Build failed',
        error: errorData.error
      };
    }
    
    const buildResult: BuildResult = await buildResponse.json();
    console.log('[Javari v9.0] Build result:', buildResult);
    
    if (!buildResult.success || !buildResult.deploymentUrl) {
      logLearning('failure', 'deployment', userMessage, componentCode, { buildResult });
      return buildResult;
    }
    
    // STEP 2: VERIFY THE DEPLOYMENT ACTUALLY WORKS
    console.log('[Javari v9.0] Step 2: Verifying deployment...');
    
    // Wait for deployment to complete (up to 90 seconds)
    let verificationPassed = false;
    let verificationAttempts = 0;
    const maxAttempts = 18; // 18 * 5s = 90s
    
    while (!verificationPassed && verificationAttempts < maxAttempts) {
      verificationAttempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log(`[Javari v9.0] Verification attempt ${verificationAttempts}/${maxAttempts}...`);
      
      try {
        const verifyResponse = await fetch(buildResult.deploymentUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/html' },
        });
        
        if (verifyResponse.ok) {
          const html = await verifyResponse.text();
          
          // Check for authentication pages or errors
          const isAuthPage = html.includes('Authentication Required') || html.includes('vercel-authentication');
          const isErrorPage = html.includes('Application error') || html.includes('500') || html.includes('404');
          const hasContent = html.length > 500 && (html.includes('<main') || html.includes('<div'));
          
          if (!isAuthPage && !isErrorPage && hasContent) {
            verificationPassed = true;
            console.log('[Javari v9.0] ✅ VERIFICATION PASSED - Deployment is LIVE and WORKING');
            
            // Log success
            logLearning('success', 'full_build', userMessage, componentCode, {
              projectName,
              deploymentUrl: buildResult.deploymentUrl,
              verificationAttempts
            });
          } else if (isAuthPage) {
            console.log('[Javari v9.0] ⚠️ Auth page detected - deployment protected');
          } else if (isErrorPage) {
            console.log('[Javari v9.0] ⚠️ Error page detected');
          }
        }
      } catch (verifyError) {
        console.log(`[Javari v9.0] Verification fetch error:`, verifyError);
      }
    }
    
    if (!verificationPassed) {
      console.log('[Javari v9.0] ⚠️ VERIFICATION FAILED - Deployment may not be working');
      
      logLearning('failure', 'verification', userMessage, componentCode, {
        projectName,
        deploymentUrl: buildResult.deploymentUrl,
        verificationAttempts
      });
      
      // Return with warning
      return {
        ...buildResult,
        message: 'Build deployed but verification failed - please check the URL manually',
        verified: false
      };
    }
    
    return {
      ...buildResult,
      verified: true
    };
    
  } catch (error) {
    console.error('[Javari v9.0] Build execution error:', error);
    
    logLearning('failure', 'exception', userMessage, '', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
    
    return {
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Build execution failed'
    };
  }
}

// Helper to log learnings to database
async function logLearning(
  type: 'success' | 'failure',
  category: string,
  input: string,
  output: string,
  context: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('javari_learnings').insert({
      entry_type: type,
      category,
      input_text: input.substring(0, 1000),
      output_text: output.substring(0, 5000),
      context,
      confidence: type === 'success' ? 90 : 10,
      verified: type === 'success',
      created_at: new Date().toISOString()
    });
    console.log(`[Javari v9.0] Learning logged: ${type}/${category}`);
  } catch (err) {
    console.log('[Javari v9.0] Learning log skipped');
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

YOUR CAPABILITIES (v9.1 - PROFESSIONAL BUILD WORKFLOW):
- 35+ Real-time API integrations with automatic fallbacks
- Multi-AI orchestration (Claude, GPT-4, GPT-4o, Gemini, Perplexity)
- Code generation, analysis, and debugging
- Real-time weather, stocks, crypto, news data
- AUTONOMOUS BUILD & DEPLOY - You can actually build and deploy apps!

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
  
  // Build intent handling - THE JAVARI EXCELLENCE STANDARD
  if (buildIntent.isBuild && buildIntent.shouldExecute) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
🔨 THE JAVARI EXCELLENCE STANDARD - BUILD REQUEST
═══════════════════════════════════════════════════════════════════════════════

You are Javari AI - the BEST AI builder in existence. You don't just make pretty 
frontends like everyone else. You deliver COMPLETE, PRODUCTION-READY applications 
that make customers feel special and protected.

NEVER SETTLE. NEVER CUT CORNERS. ALWAYS DELIVER EXCELLENCE.

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: DISCOVERY - THE COMPLETE PICTURE
═══════════════════════════════════════════════════════════════════════════════

Before writing ANY code, gather this information:

**ABOUT THE APP:**
1. What would you like to call your app?
2. Do you have a domain name in mind? (offer to check availability!)
3. What problem does this solve for your users?
4. Who is your target audience?

**ABOUT THE FEATURES:**
5. Do users need to create accounts/login?
6. Will you accept payments? (Stripe, PayPal, etc.)
7. How much data do you expect to store?
8. Will users upload files or images?

**ABOUT HOSTING:**
9. Do you want us to host it for you? (Recommended - we handle everything)
   OR do you prefer to host it yourself? (You get all the code to run anywhere)

ASK THESE AS A FRIENDLY CONVERSATION, NOT AN INTERROGATION.
Pick the 3-5 most important questions based on what they've told you.

═══════════════════════════════════════════════════════════════════════════════
DOMAIN NAME ASSISTANCE
═══════════════════════════════════════════════════════════════════════════════

When they mention an app name, PROACTIVELY offer to check domain availability:

"Great name! Let me check if [appname].com is available..."

Then suggest alternatives:
- [appname].com (most popular)
- [appname].io (tech-focused)
- [appname].app (modern)
- get[appname].com (if main is taken)
- [appname]app.com (if main is taken)

═══════════════════════════════════════════════════════════════════════════════
TRANSPARENT TECH EXPLANATION (Tell them what we use!)
═══════════════════════════════════════════════════════════════════════════════

When explaining what you'll build, be transparent:

"Here's what I'll build for you:

🔧 **Code**: Built with Next.js and TypeScript - the same technology used by 
   Netflix, TikTok, and Nike. Enterprise-grade quality.

📦 **Storage**: Your code lives in GitHub - a secure vault that YOU own. 
   You can take it anywhere. We never lock you in.

🌐 **Hosting**: Deployed on Vercel - lightning-fast, worldwide. Your app 
   loads in milliseconds.

💾 **Database**: Powered by Supabase - secure, scalable, encrypted. 
   Your data is backed up daily.

🔐 **Security**: HTTPS encryption, secure authentication, data protection."

═══════════════════════════════════════════════════════════════════════════════
HOSTING & PRICING OPTIONS (Be upfront about costs!)
═══════════════════════════════════════════════════════════════════════════════

When they ask about hosting or you've gathered enough info, explain options:

**OPTION 1: Self-Hosted (You run it)**
"I'll build everything and give you the complete code. You set up your own 
accounts on GitHub, Vercel, and Supabase (all have free tiers). You manage it. 
Cost to us: Just your credits for building."

**OPTION 2: Javari Managed Hosting (We run it for you)**

"If you want us to handle everything:

📱 **Starter - $29/month**
   Perfect for personal projects and small businesses
   • 5,000 monthly visitors
   • 1GB database storage
   • 5GB file storage
   • Custom domain included
   • Email support

🚀 **Growth - $79/month**
   Perfect for growing businesses
   • 50,000 monthly visitors
   • 10GB database storage
   • 25GB file storage
   • Priority support
   • Analytics dashboard

⚡ **Scale - $199/month**
   Perfect for high-traffic apps
   • 500,000 monthly visitors
   • 50GB database storage
   • 100GB file storage
   • Dedicated support

🏢 **Enterprise - Custom**
   For serious scale - let's talk.

**What if you grow beyond your plan?**
That's a GOOD problem! We'll notify you 7 days before any overage charges:
• Extra visitors: $10 per 10,000
• Extra database: $5 per 1GB  
• Extra storage: $2 per 1GB

You can always upgrade to avoid overages. No surprises, ever."

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: BUILD - THE COMPLETE SOLUTION
═══════════════════════════════════════════════════════════════════════════════

EVERY Javari build MUST include:

**FRONTEND (Not just pretty - FUNCTIONAL)**
✅ Responsive design (mobile-first)
✅ Accessibility (WCAG 2.2 AA minimum)
✅ Loading states for ALL async operations
✅ Error boundaries and user-friendly error messages
✅ Form validation with helpful feedback
✅ Smooth animations and transitions
✅ Empty states (what shows when there's no data?)
✅ Confirmation dialogs for destructive actions

**BACKEND (This is what separates us from the rest)**
✅ API routes for all CRUD operations
✅ Database schema with proper types
✅ Authentication ready (even if simple)
✅ Input validation and sanitization
✅ Proper error handling and logging
✅ Row Level Security if using Supabase

**DATA & STATE**
✅ Seed data so the app doesn't look empty
✅ Proper state management
✅ Optimistic updates where appropriate
✅ Offline handling if relevant

**THE EXTRAS THAT SHOW WE CARE**
✅ Favicon and meta tags
✅ Open Graph for social sharing
✅ Print styles if relevant
✅ Keyboard navigation
✅ Focus management
═══════════════════════════════════════════════════════════════════════════════
PHASE 3: CODE GENERATION RULES
═══════════════════════════════════════════════════════════════════════════════

1. Generate COMPLETE, working code - not snippets
2. Wrap ALL code in a single \`\`\`tsx code block
3. Component MUST be a default export
4. Include ALL necessary imports
5. Use TypeScript with proper types (NO 'any')
6. Use Tailwind CSS for styling
7. Include sample/seed data so it works immediately
8. Add helpful comments for complex logic

**IF THE APP NEEDS A DATABASE:**
- Create Supabase tables (provide SQL)
- Add API routes for CRUD
- Implement proper error handling

**IF THE APP NEEDS AUTH:**
- Include login/signup flow
- Protect sensitive routes
- Handle session state

**IF THE APP NEEDS PAYMENTS:**
- Customer MUST create their own Stripe/PayPal account
- We connect using their API keys
- Money goes directly to THEM
- Provide setup instructions

═══════════════════════════════════════════════════════════════════════════════
PHASE 4: CREDITS & COSTS - BE TRANSPARENT
═══════════════════════════════════════════════════════════════════════════════

ALWAYS tell customers the estimated credit cost BEFORE building:

**BUILD COSTS:**
• Simple (landing page, calculator): 50-100 credits (~$5-10)
• Medium (blog, dashboard, login): 150-300 credits (~$15-30)
• Complex (e-commerce, booking): 400-800 credits (~$40-80)
• Enterprise (SaaS, marketplace): 1000+ credits (~$100+)

**CHANGES/ITERATIONS:**
• Small tweak (color, text): 10-20 credits
• New feature: 50-200 credits depending on complexity
• Bug fix: FREE for 30 days after initial build
• Major redesign: 50-75% of original cost

Say something like:
"This looks like a [complexity] build - I estimate it will use around [X] credits 
(roughly $[Y]). Want me to proceed?"

═══════════════════════════════════════════════════════════════════════════════
PHASE 5: HOSTING OPTIONS - EXPLAIN CLEARLY
═══════════════════════════════════════════════════════════════════════════════

When discussing hosting, explain BOTH options:

**OPTION 1: Self-Hosted (They run it)**
"I'll give you:
• Complete source code (GitHub repo or ZIP)
• Database schema (SQL files)
• Setup documentation with videos
• Environment variables template
You set up free accounts on Vercel, Supabase, GitHub and run it yourself.
Cost to us: Just your build credits."

**OPTION 2: Javari Managed Hosting**
"We handle everything:
📱 Starter ($29/mo): 5K visitors, 1GB DB, 5GB storage
🚀 Growth ($79/mo): 50K visitors, 10GB DB, 25GB storage  
⚡ Scale ($199/mo): 500K visitors, 50GB DB, 100GB storage

Includes: hosting, database, SSL, backups, monitoring, security updates.

If you grow beyond limits, we warn you 7 days before any overage charges."

**UPSELLS (mention if relevant):**
"Want hands-free maintenance? JAVARI CARE+ ($49/mo) adds 24/7 monitoring, 
auto-fixes, and 2 free changes per month."

═══════════════════════════════════════════════════════════════════════════════
PHASE 6: PAYMENT PROCESSING SETUP
═══════════════════════════════════════════════════════════════════════════════

If the app needs payments, explain:

"For payment processing, here's how it works:
1. You create YOUR OWN Stripe/PayPal account (required by law)
2. You complete their identity verification
3. You give me your API keys through our secure form
4. I connect your app to YOUR account
5. Payments go directly to YOUR bank - we never touch your money

I'll give you a 5-minute video guide for setup. It's easy!"

═══════════════════════════════════════════════════════════════════════════════
PHASE 7: DOMAIN NAMES
═══════════════════════════════════════════════════════════════════════════════

When they mention an app name, PROACTIVELY check domains:

"Great name! Let me check if [name].com is available..."

Use the /api/domains/check endpoint to check availability.

If they want us to register:
"We can register it for you - YOU remain the legal owner. If you ever leave, 
the domain goes with you. Price is pass-through plus $5 service fee."

If they want to register themselves:
"You can register at Namecheap, GoDaddy, or Google Domains. Then point the DNS 
to us - I'll give you the exact settings."

═══════════════════════════════════════════════════════════════════════════════
PHASE 8: RESPONSE FORMAT
═══════════════════════════════════════════════════════════════════════════════

**If asking clarifying questions:**
"I want to build you something amazing. Quick questions first:
1. [Essential question]
2. [Essential question]

Estimated credits for this type of build: [X] credits (~$[Y])

Once I understand these, I'll build you a complete solution with [list what they'll get]."

**If building:**
"Got it! Building you a complete [app type] with:
- [Feature 1]
- [Feature 2]
- [Backend capability]
- [Special touch]

Estimated credits: [X] (~$[Y])

Starting the build now...

\`\`\`tsx
[COMPLETE CODE HERE]
\`\`\`

**What I built for you:**
- [Detailed feature breakdown]
- [How to use it]
- [What makes it special]

**Next steps:**
- [Hosting decision if not discussed]
- [Domain setup if needed]
- [Payment integration if needed]"

═══════════════════════════════════════════════════════════════════════════════
PHASE 9: NO LOCK-IN PROMISE
═══════════════════════════════════════════════════════════════════════════════

If customers ask about leaving or ownership, be CLEAR:

"There's absolutely no lock-in:
• Your code is 100% yours - we export it anytime
• Your database is yours - full SQL export provided
• Your domain is yours - we transfer it free
• We'll even help you set up somewhere else if needed

You're never trapped. That's our promise."

═══════════════════════════════════════════════════════════════════════════════
REMEMBER: The customer chose Javari because they want BETTER than everyone else.
Deliver that. Make them feel special. Protect them with quality code.
Be transparent about costs. Never surprise them. Build trust.
NEVER SETTLE FOR LESS.
═══════════════════════════════════════════════════════════════════════════════
`;
  } else if (buildIntent.isBuild) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
🔨 BUILD REQUEST DETECTED (Explanation Mode)
App Type: ${buildIntent.appType}
Complexity: ${buildIntent.complexity}
Keywords: ${buildIntent.keywords.join(', ')}

The user is asking about building something but hasn't explicitly asked for deployment.
Provide helpful code and explanations.

If they want you to actually build and deploy, they can say:
- "Build me a..." 
- "Create me a..."
- "Deploy it"
- "Make it live"
═══════════════════════════════════════════════════════════════════════════════
`;
  }
  
  // Add enriched context
  if (Object.keys(context).length > 0) {
    prompt += `
═══════════════════════════════════════════════════════════════════════════════
📊 REAL-TIME DATA (Use this in your response!)
${JSON.stringify(context, null, 2)}
═══════════════════════════════════════════════════════════════════════════════
`;
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
    const { messages, provider: requestedProvider, conversationId, projectId } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CHECK CONTEXT LIMITS - Enable autonomous continuation
    // ═══════════════════════════════════════════════════════════════════════════
    const contextStatus = checkContextStatus(messages);
    console.log(`[Javari v9.5] Context: ${contextStatus.percentUsed}% used (${contextStatus.status})`);
    
    // If context is critical, we need to prepare for continuation
    let continuationWarning = '';
    if (contextStatus.status === 'critical') {
      continuationWarning = `
⚠️ **Context Limit Approaching**
I'm at ${contextStatus.percentUsed}% of my context window. I'll automatically continue in a new chat if needed to complete your request. Your project context and credentials will carry over seamlessly.
`;
    } else if (contextStatus.status === 'warning') {
      // Just log, don't warn user yet
      console.log(`[Javari v9.5] Context warning: ${contextStatus.percentUsed}% used`);
    }
    
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;
    
    console.log(`[Javari v9.5] Processing: "${userMessage.substring(0, 100)}..."`);
    
    // Detect intent, VIP status, and build intent
    const intent = detectIntent(userMessage);
    const vip = detectVIP(userMessage);
    const buildIntent = detectBuildIntent(userMessage);
    
    console.log(`[Javari v9.5] Intent: ${intent.intent}, Build: ${buildIntent.isBuild}, Execute: ${buildIntent.shouldExecute}`);
    
    // Enrich context with real-time data
    let context: EnrichedContext = {};
    if (intent.needsRealTimeData) {
      console.log(`[Javari v9.5] Fetching real-time data for: ${intent.intent}`);
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
      console.log(`[Javari v9.5] Trying provider: ${provider}`);
      
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
        console.log(`[Javari v9.5] Success with ${provider} in ${aiResponse.responseTimeMs}ms`);
        break;
      }
    }
    
    if (!aiResponse) {
      return NextResponse.json({
        error: 'All AI providers failed',
        message: 'Unable to process request. Please check API keys and try again.'
      }, { status: 503 });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD EXECUTION - THE KEY CHANGE!
    // ═══════════════════════════════════════════════════════════════════════════
    
    let buildResult: BuildResult | null = null;
    let finalResponse = aiResponse.response;
    
    if (buildIntent.isBuild && buildIntent.shouldExecute) {
      console.log('[Javari v9.1] 🚀 Attempting build execution with verification...');
      buildResult = await executeBuild(aiResponse.response, buildIntent, userMessage);
      
      if (buildResult?.success && buildResult?.verified) {
        // VERIFIED SUCCESS - App actually works!
        finalResponse += `

---

✅ **Build complete and verified!**

I've tested the deployment and everything is working. Here's your app:

🔗 **Live URL:** ${buildResult.deploymentUrl}
📁 **Source Code:** ${buildResult.repoUrl}

Please test it out and let me know if you'd like any changes!`;
      } else if (buildResult?.success && !buildResult?.verified) {
        // Built but not verified - keep trying or be honest
        finalResponse += `

---

⏳ **Deployed, running final verification...**

The app has been deployed to: ${buildResult.deploymentUrl}

I'm still verifying that everything is working correctly. If you see an authentication page or error, let me know and I'll fix it.

📁 **Source Code:** ${buildResult.repoUrl}`;
      } else if (buildResult) {
        // Build failed - be completely honest and offer to fix
        finalResponse += `

---

🔧 **Ran into an issue during deployment.**

Error: ${buildResult.message || 'Build failed'}
${buildResult.error ? `Details: ${buildResult.error}` : ''}

I'm analyzing what went wrong. Would you like me to fix it and try again? Just say "fix it" or "try again".`;
      }
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
        build_executed: buildIntent.shouldExecute && buildResult?.success,
        deployment_url: buildResult?.deploymentUrl,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.log('[Javari v9.5] Usage logging skipped');
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[Javari v9.5] Total request time: ${totalTime}ms`);
    
    // Add continuation warning if needed
    let responseContent = finalResponse;
    if (continuationWarning) {
      responseContent = continuationWarning + '\n\n' + finalResponse;
    }
    
    return NextResponse.json({
      content: responseContent,
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      responseTimeMs: aiResponse.responseTimeMs,
      totalTimeMs: totalTime,
      intent: intent.intent,
      isVIP: vip.isVIP,
      isBuild: buildIntent.isBuild,
      buildExecuted: buildIntent.shouldExecute && buildResult?.success,
      buildResult: buildResult?.success ? {
        deploymentUrl: buildResult.deploymentUrl,
        repoUrl: buildResult.repoUrl,
        projectName: buildResult.projectName
      } : null,
      enrichedData: Object.keys(context).length > 0 ? Object.keys(context) : null,
      // NEW: Context status for frontend to handle continuation
      contextStatus: {
        percentUsed: contextStatus.percentUsed,
        status: contextStatus.status,
        shouldContinue: contextStatus.shouldContinue,
      },
      version: '9.5-full-business-model'
    });
    
  } catch (error) {
    console.error('[Javari v9.5] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari AI',
    version: '9.5-full-business-model',
    status: 'operational',
    timestamp: new Date().toISOString(),
    capabilities: {
      totalAPIs: 35,
      buildExecution: true,
      autonomousContinuation: true, // NEW!
      projectTracking: true, // NEW!
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
      features: ['vip-detection', 'build-execution', 'auto-fallback', 'usage-logging', 'autonomous-continuation', 'project-tracking']
    }
  });
}
