// =============================================================================
// JAVARI SMART QUERY ROUTER - AUTO-DETECTS QUERY TYPE & FETCHES DATA
// =============================================================================
// Analyzes user queries and automatically enhances with real-time data
// Created: December 24, 2025 - 5:30 PM EST
// =============================================================================

import { NextRequest } from 'next/server';

// Query patterns for auto-detection
const QUERY_PATTERNS = {
  weather: [
    /weather/i, /temperature/i, /forecast/i, /rain/i, /sunny/i, /cloudy/i,
    /how hot/i, /how cold/i, /will it rain/i, /what's it like outside/i
  ],
  stocks: [
    /stock price/i, /share price/i, /\$[A-Z]{1,5}\b/, /ticker/i, /market cap/i,
    /how is .* trading/i, /what's .* stock/i, /AAPL|GOOGL|MSFT|TSLA|AMZN|META/
  ],
  crypto: [
    /bitcoin/i, /ethereum/i, /crypto/i, /btc/i, /eth/i, /dogecoin/i,
    /cryptocurrency/i, /blockchain/i, /coin price/i
  ],
  news: [
    /news about/i, /latest on/i, /what's happening/i, /current events/i,
    /headlines/i, /breaking/i, /today's news/i, /recent news/i
  ],
  movies: [
    /movie/i, /film/i, /watch/i, /cinema/i, /actor/i, /actress/i,
    /who starred in/i, /what's playing/i, /good movie/i, /tv show/i
  ],
  games: [
    /video game/i, /game release/i, /gaming/i, /playstation/i, /xbox/i,
    /nintendo/i, /pc game/i, /what games/i, /best game/i
  ],
  restaurants: [
    /restaurant/i, /food near/i, /where to eat/i, /best pizza/i, /sushi/i,
    /dining/i, /breakfast/i, /lunch/i, /dinner/i, /cafe/i, /bar/i
  ],
  travel: [
    /flight/i, /hotel/i, /vacation/i, /travel to/i, /trip to/i,
    /things to do in/i, /visit/i, /tourism/i, /book a/i
  ],
  facts: [
    /tell me a fact/i, /random fact/i, /did you know/i, /trivia/i,
    /interesting fact/i, /fun fact/i, /quote/i, /joke/i
  ]
};

// Location patterns
const LOCATION_PATTERNS = [
  /in ([A-Za-z\s]+),?\s*([A-Z]{2})?/i,
  /near ([A-Za-z\s]+)/i,
  /at ([A-Za-z\s]+)/i,
  /around ([A-Za-z\s]+)/i
];

// Stock symbol patterns
const STOCK_PATTERNS = [
  /\b([A-Z]{1,5})\b(?:\s+stock|\s+share|\s+price)?/,
  /\$([A-Z]{1,5})\b/
];

// Crypto patterns
const CRYPTO_PATTERNS = [
  /bitcoin|btc/i,
  /ethereum|eth/i,
  /dogecoin|doge/i,
  /solana|sol/i,
  /cardano|ada/i
];

interface QueryAnalysis {
  category: string;
  query: string;
  location?: string;
  symbol?: string;
  confidence: number;
  shouldFetchData: boolean;
}

// Analyze query to detect type and extract parameters
function analyzeQuery(text: string): QueryAnalysis {
  const lowerText = text.toLowerCase();
  let bestMatch = { category: 'general', confidence: 0 };
  
  // Check each category's patterns
  for (const [category, patterns] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        const confidence = pattern.toString().length / 20; // Longer patterns = more specific
        if (confidence > bestMatch.confidence) {
          bestMatch = { category, confidence };
        }
      }
    }
  }
  
  // Extract location if present
  let location: string | undefined;
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      location = match[1].trim();
      break;
    }
  }
  
  // Extract stock symbol if stocks query
  let symbol: string | undefined;
  if (bestMatch.category === 'stocks') {
    for (const pattern of STOCK_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        symbol = match[1].toUpperCase();
        break;
      }
    }
  }
  
  // Extract crypto symbol
  if (bestMatch.category === 'crypto') {
    for (const pattern of CRYPTO_PATTERNS) {
      if (pattern.test(text)) {
        symbol = text.match(pattern)?.[0].toLowerCase();
        // Map common names to CoinGecko IDs
        const cryptoMap: Record<string, string> = {
          'bitcoin': 'bitcoin', 'btc': 'bitcoin',
          'ethereum': 'ethereum', 'eth': 'ethereum',
          'dogecoin': 'dogecoin', 'doge': 'dogecoin',
          'solana': 'solana', 'sol': 'solana',
          'cardano': 'cardano', 'ada': 'cardano'
        };
        symbol = cryptoMap[symbol || ''] || symbol;
        break;
      }
    }
  }
  
  return {
    category: bestMatch.category,
    query: text,
    location: location || 'Fort Myers, FL', // Default location
    symbol,
    confidence: bestMatch.confidence,
    shouldFetchData: bestMatch.confidence > 0.3
  };
}

// Fetch relevant data based on analysis
async function fetchContextData(analysis: QueryAnalysis): Promise<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  
  try {
    switch (analysis.category) {
      case 'weather':
        const weatherRes = await fetch(
          `${baseUrl}/api/knowledge?category=weather&q=${encodeURIComponent(analysis.location || 'Fort Myers')}`
        );
        return weatherRes.json();
        
      case 'stocks':
        if (analysis.symbol) {
          const stockRes = await fetch(
            `${baseUrl}/api/knowledge?category=stocks&q=${analysis.symbol}`
          );
          return stockRes.json();
        }
        break;
        
      case 'crypto':
        if (analysis.symbol) {
          const cryptoRes = await fetch(
            `${baseUrl}/api/knowledge?category=crypto&q=${analysis.symbol}`
          );
          return cryptoRes.json();
        }
        break;
        
      case 'news':
        const newsRes = await fetch(
          `${baseUrl}/api/knowledge?category=news&q=${encodeURIComponent(analysis.query)}`
        );
        return newsRes.json();
        
      case 'movies':
        const movieRes = await fetch(
          `${baseUrl}/api/knowledge?category=movies&q=${encodeURIComponent(analysis.query)}`
        );
        return movieRes.json();
        
      case 'games':
        const gamesRes = await fetch(
          `${baseUrl}/api/knowledge?category=games&q=${encodeURIComponent(analysis.query)}`
        );
        return gamesRes.json();
        
      case 'restaurants':
        const restaurantRes = await fetch(
          `${baseUrl}/api/knowledge?category=restaurants&q=${encodeURIComponent(analysis.query)}&location=${encodeURIComponent(analysis.location || '')}`
        );
        return restaurantRes.json();
        
      case 'facts':
        const factsRes = await fetch(
          `${baseUrl}/api/knowledge?category=facts&q=random`
        );
        return factsRes.json();
    }
  } catch (error) {
    console.error('Failed to fetch context data:', error);
  }
  
  return null;
}

// Build enhanced prompt with real-time data
function buildEnhancedPrompt(
  userMessage: string, 
  analysis: QueryAnalysis, 
  contextData: unknown
): string {
  let enhancedPrompt = userMessage;
  
  if (contextData && typeof contextData === 'object' && 'data' in (contextData as Record<string, unknown>)) {
    const data = (contextData as Record<string, unknown>).data;
    
    enhancedPrompt = `
User Question: ${userMessage}

[REAL-TIME DATA - Use this to inform your response]
Category: ${analysis.category}
Data: ${JSON.stringify(data, null, 2)}

Please incorporate this real-time data naturally into your response. Don't just list it - explain it conversationally and helpfully.
`;
  }
  
  return enhancedPrompt;
}

// =============================================================================
// EXPORT FOR USE IN CHAT
// =============================================================================
export async function enhanceWithKnowledge(userMessage: string): Promise<{
  enhancedPrompt: string;
  analysis: QueryAnalysis;
  contextData: unknown;
}> {
  const analysis = analyzeQuery(userMessage);
  let contextData = null;
  
  if (analysis.shouldFetchData) {
    contextData = await fetchContextData(analysis);
  }
  
  const enhancedPrompt = buildEnhancedPrompt(userMessage, analysis, contextData);
  
  return {
    enhancedPrompt,
    analysis,
    contextData
  };
}

// =============================================================================
// API ROUTE
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return Response.json({ success: false, error: 'Message required' }, { status: 400 });
    }
    
    const result = await enhanceWithKnowledge(message);
    
    return Response.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    return Response.json({ success: false, error: 'Failed to analyze query' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return Response.json({
    success: true,
    message: 'Javari Smart Router - Auto-detects query types and fetches relevant data',
    categories: Object.keys(QUERY_PATTERNS),
    usage: 'POST with { "message": "your query" }'
  });
}
