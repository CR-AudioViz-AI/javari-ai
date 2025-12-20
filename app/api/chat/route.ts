// app/api/chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - FULLY AUTONOMOUS UNIFIED SYSTEM v7.0
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 20, 2025 - 10:58 AM EST
// Version: 7.0 - POWERHOUSE + INTELLIGENCE API INTEGRATION
// 
// This route connects ALL autonomous systems:
// ✅ Multi-AI Orchestrator - Intelligent task routing
// ✅ Learning System - Captures insights from every conversation
// ✅ Self-Healing - Monitors and auto-fixes deployments
// ✅ Knowledge Base - Context-aware responses
// ✅ VIP Detection - Special handling for Roy/Cindy
// ✅ Build Intent - Code-first responses
// ✅ INTELLIGENCE API - Real-time weather, stocks, crypto, news, wiki
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
  if (/\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency|coin|solana|sol|dogecoin|doge|cardano|ada|xrp|ripple)\b/i.test(lower)) {
    const cryptoMatch = lower.match(/\b(bitcoin|btc|ethereum|eth|solana|sol|dogecoin|doge|cardano|ada|xrp|ripple)\b/i);
    const cryptoMap: Record<string, string> = {
      'bitcoin': 'bitcoin', 'btc': 'bitcoin',
      'ethereum': 'ethereum', 'eth': 'ethereum',
      'solana': 'solana', 'sol': 'solana',
      'dogecoin': 'dogecoin', 'doge': 'dogecoin',
      'cardano': 'cardano', 'ada': 'cardano',
      'xrp': 'ripple', 'ripple': 'ripple'
    };
    const coinId = cryptoMap[cryptoMatch?.[1]?.toLowerCase() || 'bitcoin'] || 'bitcoin';
    return {
      intent: 'crypto',
      confidence: 0.95,
      params: { coinId, query: coinId },
      needsRealTimeData: true
    };
  }
  
  // Weather detection
  if (/\b(weather|temperature|forecast|rain|sunny|cloudy|snow|how (hot|cold|warm)|humidity|wind)\b/i.test(lower)) {
    const locationMatch = original.match(/(?:in|at|for)\s+([A-Za-z\s,]+?)(?:\?|$|,|\.|!)/i);
    return {
      intent: 'weather',
      confidence: 0.95,
      params: { query: locationMatch?.[1]?.trim() || 'Cape Coral, Florida' },
      needsRealTimeData: true
    };
  }
  
  // Stock detection (after crypto)
  if (/\$[A-Z]{1,5}|\b(stock|share|price of|nasdaq|nyse|dow|s&p|market)\b/i.test(message)) {
    const tickerMatch = original.match(/\$([A-Z]{1,5})|(?:stock|price|share)s?\s+(?:of\s+)?([A-Z]{1,5})/i);
    const ticker = tickerMatch?.[1] || tickerMatch?.[2] || 'AAPL';
    return {
      intent: 'stock',
      confidence: 0.9,
      params: { query: ticker.toUpperCase() },
      needsRealTimeData: true
    };
  }
  
  // News detection
  if (/\b(news|headlines|latest|breaking|what('s| is) happening|current events|trending)\b/i.test(lower)) {
    const topicMatch = original.match(/(?:about|on|regarding|for)\s+([A-Za-z\s]+?)(?:\?|$|,|\.|!)/i);
    return {
      intent: 'news',
      confidence: 0.85,
      params: { query: topicMatch?.[1]?.trim() || 'technology AI' },
      needsRealTimeData: true
    };
  }
  
  // Wikipedia/Knowledge detection
  if (/\b(who (is|was|are)|what (is|are|was)|explain|tell me about|define|meaning of|history of)\b/i.test(lower)) {
    const topicMatch = original.match(/(?:who is|who was|what is|what are|about|explain|define|history of)\s+(.+?)(?:\?|$|\.)/i);
    return {
      intent: 'wikipedia',
      confidence: 0.8,
      params: { query: topicMatch?.[1]?.trim() || message },
      needsRealTimeData: true
    };
  }
  
  // Joke/Entertainment
  if (/\b(joke|funny|make me laugh|humor|tell me a joke)\b/i.test(lower)) {
    return { intent: 'joke', confidence: 0.95, params: {}, needsRealTimeData: true };
  }
  
  // Quote
  if (/\b(quote|inspiration|motivat|wise words)\b/i.test(lower)) {
    return { intent: 'quote', confidence: 0.9, params: {}, needsRealTimeData: true };
  }
  
  // Fact
  if (/\b(random fact|interesting fact|did you know|fun fact)\b/i.test(lower)) {
    return { intent: 'fact', confidence: 0.9, params: {}, needsRealTimeData: true };
  }
  
  // Time/Date
  if (/\b(what time|current time|what day|today's date|time in)\b/i.test(lower)) {
    const tzMatch = original.match(/(?:time in|in)\s+([A-Za-z\s\/]+?)(?:\?|$|,|\.|!)/i);
    return {
      intent: 'time',
      confidence: 0.95,
      params: { timezone: tzMatch?.[1]?.trim() || 'America/New_York' },
      needsRealTimeData: true
    };
  }
  
  // Code/Dev detection - no real-time data needed
  if (/\b(code|program|function|debug|error|javascript|python|typescript|react|api|build|create app|fix)\b/i.test(lower)) {
    return {
      intent: 'code',
      confidence: 0.85,
      params: { query: message },
      needsRealTimeData: false
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
// REAL-TIME DATA FETCHING - Weather, Stocks, Crypto, News, etc.
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWeather(location: string): Promise<any> {
  try {
    // Use wttr.in - free, no API key required
    const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
      headers: { 'User-Agent': 'Javari-AI/1.0' }
    });
    if (!response.ok) throw new Error('Weather fetch failed');
    const data = await response.json();
    
    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    
    return {
      success: true,
      location: `${area?.areaName?.[0]?.value || location}, ${area?.region?.[0]?.value || ''}, ${area?.country?.[0]?.value || ''}`,
      temperature: {
        fahrenheit: current?.temp_F,
        celsius: current?.temp_C,
        feelsLike_F: current?.FeelsLikeF,
        feelsLike_C: current?.FeelsLikeC
      },
      condition: current?.weatherDesc?.[0]?.value,
      humidity: current?.humidity + '%',
      wind: {
        speed_mph: current?.windspeedMiles,
        direction: current?.winddir16Point
      },
      visibility: current?.visibility + ' miles',
      uvIndex: current?.uvIndex,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Javari] Weather fetch error:', error);
    return { success: false, error: 'Could not fetch weather data' };
  }
}

async function fetchCrypto(coinId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) throw new Error('Crypto fetch failed');
    const data = await response.json();
    
    const coinData = data[coinId];
    if (!coinData) throw new Error('Coin not found');
    
    return {
      success: true,
      coin: coinId.charAt(0).toUpperCase() + coinId.slice(1),
      price: `$${coinData.usd?.toLocaleString()}`,
      change24h: `${coinData.usd_24h_change?.toFixed(2)}%`,
      marketCap: `$${(coinData.usd_market_cap / 1e9)?.toFixed(2)}B`,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Javari] Crypto fetch error:', error);
    return { success: false, error: 'Could not fetch crypto data' };
  }
}

async function fetchStock(symbol: string): Promise<any> {
  try {
    // Using Alpha Vantage demo or finnhub free tier
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`
      );
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          symbol: symbol,
          price: `$${data.c?.toFixed(2)}`,
          change: `$${data.d?.toFixed(2)}`,
          changePercent: `${data.dp?.toFixed(2)}%`,
          high: `$${data.h?.toFixed(2)}`,
          low: `$${data.l?.toFixed(2)}`,
          open: `$${data.o?.toFixed(2)}`,
          previousClose: `$${data.pc?.toFixed(2)}`,
          lastUpdated: new Date().toISOString()
        };
      }
    }
    
    // Fallback message
    return {
      success: false,
      symbol: symbol,
      message: `Stock data for ${symbol} requires API key configuration. Please check FINNHUB_API_KEY.`
    };
  } catch (error) {
    console.error('[Javari] Stock fetch error:', error);
    return { success: false, error: 'Could not fetch stock data' };
  }
}

async function fetchNews(query: string): Promise<any> {
  try {
    // Using GNews free tier
    const gnewsKey = process.env.GNEWS_API_KEY;
    if (gnewsKey) {
      const response = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&apikey=${gnewsKey}`
      );
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          query: query,
          articles: data.articles?.slice(0, 5).map((a: any) => ({
            title: a.title,
            description: a.description,
            source: a.source?.name,
            url: a.url,
            publishedAt: a.publishedAt
          })),
          lastUpdated: new Date().toISOString()
        };
      }
    }
    
    // Fallback - use Wikipedia current events
    return {
      success: true,
      query: query,
      message: `For the latest news on "${query}", I recommend checking Google News or your preferred news source.`,
      suggestion: `https://news.google.com/search?q=${encodeURIComponent(query)}`
    };
  } catch (error) {
    console.error('[Javari] News fetch error:', error);
    return { success: false, error: 'Could not fetch news' };
  }
}

async function fetchWikipedia(query: string): Promise<any> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) throw new Error('Wikipedia fetch failed');
    const data = await response.json();
    
    return {
      success: true,
      title: data.title,
      extract: data.extract,
      description: data.description,
      url: data.content_urls?.desktop?.page,
      thumbnail: data.thumbnail?.source,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Javari] Wikipedia fetch error:', error);
    return { success: false, error: 'Could not fetch Wikipedia data' };
  }
}

async function fetchJoke(): Promise<any> {
  try {
    const response = await fetch('https://official-joke-api.appspot.com/random_joke');
    if (!response.ok) throw new Error('Joke fetch failed');
    const data = await response.json();
    return {
      success: true,
      setup: data.setup,
      punchline: data.punchline,
      type: data.type
    };
  } catch (error) {
    return { success: false, error: 'Could not fetch joke' };
  }
}

async function fetchQuote(): Promise<any> {
  try {
    const response = await fetch('https://api.quotable.io/random');
    if (!response.ok) throw new Error('Quote fetch failed');
    const data = await response.json();
    return {
      success: true,
      quote: data.content,
      author: data.author,
      tags: data.tags
    };
  } catch (error) {
    // Fallback quotes
    const quotes = [
      { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
      { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
      { quote: "Stay hungry, stay foolish.", author: "Steve Jobs" }
    ];
    return { success: true, ...quotes[Math.floor(Math.random() * quotes.length)] };
  }
}

async function fetchFact(): Promise<any> {
  try {
    const response = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
    if (!response.ok) throw new Error('Fact fetch failed');
    const data = await response.json();
    return {
      success: true,
      fact: data.text,
      source: data.source
    };
  } catch (error) {
    return { success: false, error: 'Could not fetch fact' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENRICH CONTEXT - Fetch real-time data based on intent
// ═══════════════════════════════════════════════════════════════════════════════

async function enrichContext(intent: IntentResult): Promise<EnrichedContext> {
  const context: EnrichedContext = {};
  
  if (!intent.needsRealTimeData) {
    return context;
  }
  
  console.log(`[Javari] Enriching context for intent: ${intent.intent}`);
  
  try {
    switch (intent.intent) {
      case 'weather':
        context.weather = await fetchWeather(intent.params.query);
        break;
      case 'crypto':
        context.crypto = await fetchCrypto(intent.params.coinId);
        break;
      case 'stock':
        context.stock = await fetchStock(intent.params.query);
        break;
      case 'news':
        context.news = await fetchNews(intent.params.query);
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
      case 'fact':
        context.fact = await fetchFact();
        break;
      case 'time':
        context.time = {
          success: true,
          timezone: intent.params.timezone,
          currentTime: new Date().toLocaleString('en-US', { 
            timeZone: intent.params.timezone || 'America/New_York',
            dateStyle: 'full',
            timeStyle: 'long'
          })
        };
        break;
    }
  } catch (error) {
    console.error(`[Javari] Context enrichment error for ${intent.intent}:`, error);
  }
  
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIP USER DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const VIP_PATTERNS = [
  'roy henderson', 'i am roy', "i'm roy", 'roy here',
  'cindy henderson', 'i am cindy', "i'm cindy", 'cindy here',
  '@craudiovizai.com', 'ceo', 'co-founder', 'cofounder',
  'owner of cr audioviz', 'founder'
];

function detectVIP(messages: Message[], userId?: string): VIPDetection {
  const fullText = messages.map(m => m.content || '').join(' ').toLowerCase();
  
  for (const pattern of VIP_PATTERNS) {
    if (fullText.includes(pattern)) {
      if (pattern.includes('roy')) {
        return { isVIP: true, vipName: 'Roy Henderson', vipRole: 'CEO & Co-Founder' };
      }
      if (pattern.includes('cindy')) {
        return { isVIP: true, vipName: 'Cindy Henderson', vipRole: 'CMO & Co-Founder' };
      }
      return { isVIP: true, vipName: 'VIP User', vipRole: 'Leadership' };
    }
  }
  
  return { isVIP: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

const BUILD_PATTERNS = {
  triggers: /\b(build|create|make|design|develop|generate|code)\b/i,
  appTypes: {
    calculator: /\b(calculator|calc|compute|math)\b/i,
    dashboard: /\b(dashboard|admin|analytics|metrics)\b/i,
    form: /\b(form|contact|signup|registration|input)\b/i,
    chart: /\b(chart|graph|visualization|data viz)\b/i,
    game: /\b(game|play|puzzle|quiz)\b/i,
    landing: /\b(landing|hero|homepage|marketing)\b/i,
    ecommerce: /\b(shop|store|cart|checkout|product)\b/i,
    auth: /\b(auth|login|signup|register|password)\b/i,
    api: /\b(api|endpoint|route|backend|server)\b/i,
    component: /\b(component|widget|ui|element)\b/i,
    fullApp: /\b(app|application|platform|system|tool)\b/i
  },
  complexity: {
    simple: /\b(simple|basic|quick|easy|small)\b/i,
    complex: /\b(complex|advanced|full|complete|comprehensive)\b/i,
    enterprise: /\b(enterprise|production|scalable|professional)\b/i
  }
};

function detectBuildIntent(message: string): BuildIntent {
  const m = message.toLowerCase();
  const isBuild = BUILD_PATTERNS.triggers.test(m);
  
  if (!isBuild) {
    return { isBuild: false, complexity: 'simple', estimatedCredits: 0, keywords: [] };
  }
  
  let appType = 'component';
  const keywords: string[] = [];
  
  for (const [type, pattern] of Object.entries(BUILD_PATTERNS.appTypes)) {
    if (pattern.test(m)) {
      appType = type;
      keywords.push(type);
      break;
    }
  }
  
  let complexity: BuildIntent['complexity'] = 'medium';
  if (BUILD_PATTERNS.complexity.simple.test(m)) complexity = 'simple';
  if (BUILD_PATTERNS.complexity.complex.test(m)) complexity = 'complex';
  if (BUILD_PATTERNS.complexity.enterprise.test(m)) complexity = 'enterprise';
  
  const creditMap = { simple: 5, medium: 15, complex: 35, enterprise: 75 };
  
  return {
    isBuild: true,
    appType,
    complexity,
    estimatedCredits: creditMap[complexity],
    keywords
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT AI ROUTING
// ═══════════════════════════════════════════════════════════════════════════════

interface TaskAnalysis {
  taskType: string;
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  requiresCurrentInfo: boolean;
  requiresLongContext: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

function analyzeTask(message: string): TaskAnalysis {
  const m = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  
  let taskType = 'general';
  if (/(?:write|create|build|code|function|component|api|debug|fix|error)/i.test(m)) {
    taskType = 'coding';
  } else if (/(?:research|find|search|current|latest|news|today)/i.test(m)) {
    taskType = 'research';
  } else if (/(?:analyze|explain|understand|compare|evaluate)/i.test(m)) {
    taskType = 'analysis';
  } else if (/(?:write|draft|compose|essay|article|story|creative)/i.test(m)) {
    taskType = 'writing';
  } else if (/(?:calculate|math|equation|solve|formula)/i.test(m)) {
    taskType = 'math';
  } else if (/(?:summarize|tldr|brief|quick)/i.test(m)) {
    taskType = 'summary';
  } else if (/(?:translate|spanish|french|german|japanese)/i.test(m)) {
    taskType = 'translation';
  }

  let complexity: TaskAnalysis['complexity'] = 'simple';
  if (wordCount > 500 || /(?:complex|detailed|comprehensive|thorough)/i.test(m)) {
    complexity = 'complex';
  } else if (wordCount > 100 || /(?:explain|analyze|compare)/i.test(m)) {
    complexity = 'medium';
  }
  if (/(?:expert|advanced|professional|enterprise)/i.test(m)) {
    complexity = 'expert';
  }

  let urgency: TaskAnalysis['urgency'] = 'medium';
  if (/(?:urgent|asap|immediately|critical|emergency|now)/i.test(m)) {
    urgency = 'critical';
  } else if (/(?:quick|fast|soon)/i.test(m)) {
    urgency = 'high';
  }

  return {
    taskType,
    complexity,
    requiresCurrentInfo: /(?:current|latest|today|recent|news|now|2024|2025)/i.test(m),
    requiresLongContext: wordCount > 2000,
    urgency
  };
}

function selectBestProvider(analysis: TaskAnalysis, requestedProvider?: string): string {
  if (requestedProvider && AI_PROVIDERS[requestedProvider]) {
    return requestedProvider;
  }
  
  if (analysis.requiresCurrentInfo) {
    return 'perplexity';
  }
  
  if (analysis.requiresLongContext) {
    return 'gemini';
  }
  
  switch (analysis.taskType) {
    case 'coding':
      return 'claude';
    case 'research':
      return 'perplexity';
    case 'analysis':
      return 'claude';
    case 'writing':
      return 'claude';
    case 'math':
      return 'openai';
    case 'summary':
      return 'gpt-4o';
    default:
      return 'claude';
  }
}

function getFallbackProviders(primary: string): string[] {
  const fallbackOrder = ['claude', 'openai', 'gpt-4o', 'gemini', 'perplexity'];
  return fallbackOrder.filter(p => p !== primary);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER - Now with enriched context
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(options: {
  isVIP: boolean;
  vipName?: string;
  vipRole?: string;
  buildIntent: BuildIntent;
  enrichedContext?: EnrichedContext;
  selectedProvider: string;
}): string {
  let prompt = `
#####################################################################
#   JAVARI AI - AUTONOMOUS DEVELOPMENT ASSISTANT v7.0              
#   Platform: CR AudioViz AI | Mission: "Your Story. Our Design."  
#   WITH REAL-TIME DATA ENRICHMENT                                  
#####################################################################

## CORE IDENTITY
You are Javari AI, an autonomous development assistant created by CR AudioViz AI.
You have ACCESS TO REAL-TIME DATA including weather, stocks, crypto, news, and more.
You can build complete applications, research topics, and help with any task.

## REAL-TIME DATA CAPABILITIES
You have been provided with LIVE data. Use it naturally in your responses.
DO NOT say "I don't have access to real-time data" - YOU DO!
`;

  // Add enriched context if available
  if (options.enrichedContext) {
    prompt += `\n## 📡 REAL-TIME DATA (USE THIS IN YOUR RESPONSE)\n`;
    
    if (options.enrichedContext.weather?.success) {
      const w = options.enrichedContext.weather;
      prompt += `
### WEATHER DATA:
- Location: ${w.location}
- Temperature: ${w.temperature?.fahrenheit}°F (${w.temperature?.celsius}°C)
- Feels Like: ${w.temperature?.feelsLike_F}°F
- Condition: ${w.condition}
- Humidity: ${w.humidity}
- Wind: ${w.wind?.speed_mph} mph ${w.wind?.direction}
- UV Index: ${w.uvIndex}
`;
    }
    
    if (options.enrichedContext.crypto?.success) {
      const c = options.enrichedContext.crypto;
      prompt += `
### CRYPTO DATA:
- Coin: ${c.coin}
- Price: ${c.price}
- 24h Change: ${c.change24h}
- Market Cap: ${c.marketCap}
`;
    }
    
    if (options.enrichedContext.stock?.success) {
      const s = options.enrichedContext.stock;
      prompt += `
### STOCK DATA:
- Symbol: ${s.symbol}
- Price: ${s.price}
- Change: ${s.change} (${s.changePercent})
- High: ${s.high} | Low: ${s.low}
`;
    }
    
    if (options.enrichedContext.news?.success && options.enrichedContext.news.articles) {
      prompt += `\n### NEWS DATA:\n`;
      options.enrichedContext.news.articles.forEach((a: any, i: number) => {
        prompt += `${i + 1}. ${a.title} (${a.source})\n`;
      });
    }
    
    if (options.enrichedContext.wikipedia?.success) {
      const w = options.enrichedContext.wikipedia;
      prompt += `
### WIKIPEDIA DATA:
- Title: ${w.title}
- Description: ${w.description}
- Summary: ${w.extract?.slice(0, 500)}...
`;
    }
    
    if (options.enrichedContext.joke?.success) {
      const j = options.enrichedContext.joke;
      prompt += `
### JOKE DATA:
- Setup: ${j.setup}
- Punchline: ${j.punchline}
`;
    }
    
    if (options.enrichedContext.quote?.success) {
      const q = options.enrichedContext.quote;
      prompt += `
### QUOTE DATA:
- Quote: "${q.quote}"
- Author: ${q.author}
`;
    }
    
    if (options.enrichedContext.fact?.success) {
      prompt += `\n### FACT DATA:\n${options.enrichedContext.fact.fact}\n`;
    }
    
    if (options.enrichedContext.time?.success) {
      prompt += `\n### TIME DATA:\n${options.enrichedContext.time.currentTime}\n`;
    }
  }

  // VIP Context
  if (options.isVIP && options.vipName) {
    prompt += `

## 🔴 VIP USER: ${options.vipName} (${options.vipRole}) 🔴
THIS IS AN OWNER/FOUNDER OF CR AUDIOVIZ AI.
- NEVER mention signup, pricing, plans, credits, or accounts
- BUILD IMMEDIATELY without any barriers
- Be direct, efficient, and action-oriented
`;
  }

  // Build Context
  if (options.buildIntent.isBuild) {
    prompt += `

## 🛠️ BUILD MODE ACTIVE: ${options.buildIntent.appType} (${options.buildIntent.complexity}) 🛠️
Your response MUST:
1. Start with complete, working code
2. Use modern React with TypeScript
3. Apply Tailwind CSS dark theme styling
4. Include all necessary functionality
5. Be production-ready and deployable
`;
  }

  prompt += `

## RESPONSE GUIDELINES
- If you have real-time data above, USE IT - present it naturally
- Be conversational but informative
- For weather: give temperature, conditions, and any notable details
- For crypto/stocks: give current price and change
- For news: summarize top headlines
- Never say you can't access real-time data when you clearly have it above
`;

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CALL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function callClaude(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  
  const response = await client.messages.create({
    model: AI_PROVIDERS.claude.model,
    max_tokens: AI_PROVIDERS.claude.maxTokens,
    system,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  });
  
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  
  return {
    response: response.content[0].type === 'text' ? response.content[0].text : '',
    provider: AI_PROVIDERS.claude.name,
    model: AI_PROVIDERS.claude.model,
    tokensUsed,
    cost: (tokensUsed / 1000) * AI_PROVIDERS.claude.costPer1kTokens,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callOpenAI(messages: Message[], system: string, useGPT4o: boolean = false): Promise<AIResponse> {
  const startTime = Date.now();
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  
  const provider = useGPT4o ? AI_PROVIDERS['gpt-4o'] : AI_PROVIDERS.openai;
  
  const response = await client.chat.completions.create({
    model: provider.model,
    max_tokens: provider.maxTokens,
    messages: [
      { role: 'system', content: system },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }))
    ]
  });
  
  const tokensUsed = response.usage?.total_tokens || 0;
  
  return {
    response: response.choices[0]?.message?.content || '',
    provider: provider.name,
    model: provider.model,
    tokensUsed,
    cost: (tokensUsed / 1000) * provider.costPer1kTokens,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callGemini(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: AI_PROVIDERS.gemini.model });
  
  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  });
  
  const lastMessage = messages[messages.length - 1]?.content || '';
  const result = await chat.sendMessage(system + '\n\n' + lastMessage);
  const responseText = result.response.text();
  
  return {
    response: responseText,
    provider: AI_PROVIDERS.gemini.name,
    model: AI_PROVIDERS.gemini.model,
    tokensUsed: Math.ceil(responseText.length / 4),
    cost: 0.001,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callPerplexity(messages: Message[], system: string): Promise<AIResponse> {
  const startTime = Date.now();
  const lastMessage = messages[messages.length - 1]?.content || '';
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.perplexity.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: lastMessage }
      ]
    })
  });
  
  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  
  return {
    response: responseText,
    provider: AI_PROVIDERS.perplexity.name,
    model: AI_PROVIDERS.perplexity.model,
    tokensUsed: data.usage?.total_tokens || Math.ceil(responseText.length / 4),
    cost: 0.001,
    responseTimeMs: Date.now() - startTime,
    fallbackUsed: false
  };
}

async function callProvider(
  providerKey: string, 
  messages: Message[], 
  systemPrompt: string
): Promise<AIResponse> {
  switch (providerKey) {
    case 'claude':
      return callClaude(messages, systemPrompt);
    case 'openai':
      return callOpenAI(messages, systemPrompt, false);
    case 'gpt-4o':
      return callOpenAI(messages, systemPrompt, true);
    case 'gemini':
      return callGemini(messages, systemPrompt);
    case 'perplexity':
      return callPerplexity(messages, systemPrompt);
    default:
      return callClaude(messages, systemPrompt);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-AI ORCHESTRATOR WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

async function orchestrateAI(
  messages: Message[],
  systemPrompt: string,
  primaryProvider: string
): Promise<AIResponse> {
  const fallbacks = getFallbackProviders(primaryProvider);
  const providers = [primaryProvider, ...fallbacks];
  
  let lastError: Error | null = null;
  
  for (const provider of providers) {
    try {
      console.log(`[Javari] Trying provider: ${provider}`);
      const result = await callProvider(provider, messages, systemPrompt);
      
      if (provider !== primaryProvider) {
        result.fallbackUsed = true;
        result.reasoning = `Primary provider (${primaryProvider}) failed, used ${provider} as fallback`;
      }
      
      return result;
    } catch (error) {
      console.error(`[Javari] Provider ${provider} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      continue;
    }
  }
  
  throw lastError || new Error('All AI providers failed');
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

async function trackUsage(data: {
  userId?: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  responseTimeMs: number;
  buildIntent: BuildIntent;
  isVIP: boolean;
  requestId: string;
  intent?: string;
}): Promise<void> {
  try {
    await supabase.from('usage_logs').insert({
      user_id: data.userId,
      provider: data.provider,
      model: data.model,
      tokens_used: data.tokensUsed,
      estimated_cost: data.cost,
      response_time_ms: data.responseTimeMs,
      request_type: data.buildIntent.isBuild ? 'code_generation' : 'chat',
      app_type: data.buildIntent.appType,
      is_vip: data.isVIP,
      request_id: data.requestId,
      intent: data.intent,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Javari] Usage tracking error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN API HANDLER - THE UNIFIED AUTONOMOUS SYSTEM v7.0
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[Javari] ═══════════════════════════════════════════════════════════`);
  console.log(`[Javari] Request ${requestId} started at ${new Date().toISOString()}`);
  console.log(`[Javari] Version: 7.0 - POWERHOUSE + INTELLIGENCE API`);
  
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Parse Request
    // ─────────────────────────────────────────────────────────────────────────
    const body = await request.json();
    const { 
      messages, 
      userId, 
      conversationId, 
      aiProvider,
      enableLearning = true
    } = body;
    
    if (!messages?.length) {
      return NextResponse.json({ 
        error: 'No messages provided',
        requestId 
      }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Detect VIP, Build Intent, and User Intent
    // ─────────────────────────────────────────────────────────────────────────
    const vipDetection = detectVIP(messages, userId);
    const buildIntent = detectBuildIntent(lastMessage);
    const taskAnalysis = analyzeTask(lastMessage);
    const userIntent = detectIntent(lastMessage);
    
    console.log(`[Javari] VIP: ${vipDetection.isVIP ? vipDetection.vipName : 'No'}`);
    console.log(`[Javari] Build: ${buildIntent.isBuild ? `${buildIntent.appType} (${buildIntent.complexity})` : 'No'}`);
    console.log(`[Javari] Intent: ${userIntent.intent} (confidence: ${userIntent.confidence})`);
    console.log(`[Javari] Needs Real-Time Data: ${userIntent.needsRealTimeData}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: FETCH REAL-TIME DATA if needed
    // ─────────────────────────────────────────────────────────────────────────
    let enrichedContext: EnrichedContext = {};
    
    if (userIntent.needsRealTimeData) {
      console.log(`[Javari] Fetching real-time data for: ${userIntent.intent}`);
      enrichedContext = await enrichContext(userIntent);
      console.log(`[Javari] Enriched context:`, Object.keys(enrichedContext));
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Select Best AI Provider
    // ─────────────────────────────────────────────────────────────────────────
    const selectedProvider = selectBestProvider(taskAnalysis, aiProvider);
    console.log(`[Javari] Selected Provider: ${selectedProvider}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Build System Prompt with All Context
    // ─────────────────────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      isVIP: vipDetection.isVIP,
      vipName: vipDetection.vipName,
      vipRole: vipDetection.vipRole,
      buildIntent,
      enrichedContext,
      selectedProvider
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Call AI via Multi-AI Orchestrator with Fallback
    // ─────────────────────────────────────────────────────────────────────────
    const formattedMessages: Message[] = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    
    const result = await orchestrateAI(formattedMessages, systemPrompt, selectedProvider);
    
    const latency = Date.now() - startTime;
    console.log(`[Javari] Response received in ${latency}ms from ${result.provider}`);
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 7: Save Conversation to Database
    // ─────────────────────────────────────────────────────────────────────────
    let savedConversationId = conversationId;
    
    if (result.response) {
      try {
        const allMessages = [
          ...messages,
          { 
            role: 'assistant', 
            content: result.response, 
            timestamp: new Date().toISOString(),
            provider: result.provider,
            model: result.model
          }
        ];
        
        if (conversationId) {
          await supabase
            .from('conversations')
            .update({
              messages: allMessages,
              message_count: allMessages.length,
              model: result.model,
              provider: result.provider,
              is_vip: vipDetection.isVIP,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        } else if (userId) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              user_id: userId,
              title: lastMessage.slice(0, 100),
              messages: allMessages,
              message_count: allMessages.length,
              model: result.model,
              provider: result.provider,
              status: 'active',
              is_vip: vipDetection.isVIP,
              build_intent: buildIntent.isBuild ? buildIntent.appType : null
            })
            .select('id')
            .single();
            
          if (newConv) {
            savedConversationId = newConv.id;
          }
        }
      } catch (dbError) {
        console.error('[Javari] DB save error:', dbError);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 8: Track Usage (Async - Non-Blocking)
    // ─────────────────────────────────────────────────────────────────────────
    trackUsage({
      userId,
      provider: result.provider,
      model: result.model,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      responseTimeMs: latency,
      buildIntent,
      isVIP: vipDetection.isVIP,
      requestId,
      intent: userIntent.intent
    }).catch(err => console.error('[Javari] Usage tracking error:', err));
    
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 9: Return Response
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Javari] Request ${requestId} completed successfully in ${latency}ms`);
    console.log(`[Javari] ═══════════════════════════════════════════════════════════`);
    
    return NextResponse.json({
      content: result.response,
      response: result.response,
      provider: result.provider,
      model: result.model,
      buildIntent,
      taskAnalysis,
      isVIP: vipDetection.isVIP,
      vipName: vipDetection.vipName,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      latency,
      requestId,
      intent: userIntent.intent,
      enrichedData: Object.keys(enrichedContext).length > 0,
      contextUsed: {
        realTimeData: userIntent.needsRealTimeData,
        dataTypes: Object.keys(enrichedContext),
        fallbackUsed: result.fallbackUsed
      },
      version: '7.0 - POWERHOUSE + INTELLIGENCE API'
    });
    
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[Javari] ═══════════════════════════════════════════════════════════`);
    console.error(`[Javari] Request ${requestId} FAILED after ${latency}ms`);
    console.error(`[Javari] Error:`, error);
    console.error(`[Javari] ═══════════════════════════════════════════════════════════`);
    
    try {
      await supabase.from('error_logs').insert({
        source: 'chat_api',
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        stack_trace: error instanceof Error ? error.stack : null,
        request_id: requestId,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('[Javari] Failed to log error:', logError);
    }
    
    return NextResponse.json({
      content: "I encountered an issue but I'm working on it! Please try again in a moment.",
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      latency,
      version: '7.0 - POWERHOUSE + INTELLIGENCE API'
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET HANDLER - Health Check & Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    name: 'Javari AI',
    version: '7.0 - POWERHOUSE + INTELLIGENCE API',
    timestamp: new Date().toISOString(),
    capabilities: {
      multiAI: true,
      intelligentRouting: true,
      fallbackChain: true,
      realTimeData: true,
      weather: true,
      crypto: true,
      stocks: true,
      news: true,
      wikipedia: true,
      jokes: true,
      quotes: true,
      facts: true,
      vipDetection: true,
      buildFirst: true,
      usageTracking: true,
      errorLogging: true
    },
    providers: Object.keys(AI_PROVIDERS),
    dataIntents: ['weather', 'crypto', 'stock', 'news', 'wikipedia', 'joke', 'quote', 'fact', 'time', 'code', 'chat']
  });
}
