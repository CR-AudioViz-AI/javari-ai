// =============================================================================
// JAVARI AI - POWERHOUSE CHAT API
// =============================================================================
// Intelligent chat with autonomous decision-making and multi-source data
// Production Ready - Sunday, December 14, 2025
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============ TYPES ============

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  userId?: string;
  sessionId?: string;
  sourceApp?: string;
  systemContext?: string;
  tools?: boolean;
  stream?: boolean;
}

interface EnrichedContext {
  weather?: any;
  news?: any;
  stock?: any;
  crypto?: any;
  wikipedia?: any;
  time?: any;
  location?: any;
}

// ============ INTENT DETECTION ============

function detectIntent(message: string): { intent: string; confidence: number; params: Record<string, any> } {
  const lower = message.toLowerCase();
  
  // Weather detection
  if (/\b(weather|temperature|forecast|rain|sunny|cloudy|snow|how (hot|cold|warm))\b/.test(lower)) {
    const locationMatch = message.match(/(?:in|at|for)\s+([A-Za-z\s]+?)(?:\?|$|,)/i);
    return {
      intent: 'weather',
      confidence: 0.9,
      params: { location: locationMatch?.[1]?.trim() || 'Cape Coral, Florida' }
    };
  }
  
  // Stock detection
  if (/\$[A-Z]{1,5}|\b(stock|share|price of|nasdaq|nyse)\b/.test(message)) {
    const tickerMatch = message.match(/\$?([A-Z]{1,5})/);
    return {
      intent: 'stock',
      confidence: 0.85,
      params: { symbol: tickerMatch?.[1] || 'AAPL' }
    };
  }
  
  // Crypto detection
  if (/\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency|coin)\b/.test(lower)) {
    const cryptoMatch = lower.match(/\b(bitcoin|btc|ethereum|eth|solana|sol|dogecoin|doge)\b/);
    const cryptoMap: Record<string, string> = {
      'bitcoin': 'bitcoin', 'btc': 'bitcoin',
      'ethereum': 'ethereum', 'eth': 'ethereum',
      'solana': 'solana', 'sol': 'solana',
      'dogecoin': 'dogecoin', 'doge': 'dogecoin'
    };
    return {
      intent: 'crypto',
      confidence: 0.85,
      params: { symbol: cryptoMap[cryptoMatch?.[1] || 'bitcoin'] || 'bitcoin' }
    };
  }
  
  // News detection
  if (/\b(news|headlines|latest|breaking|what('s| is) happening|current events)\b/.test(lower)) {
    const topicMatch = message.match(/(?:about|on|regarding)\s+([A-Za-z\s]+?)(?:\?|$|,)/i);
    return {
      intent: 'news',
      confidence: 0.8,
      params: { topic: topicMatch?.[1]?.trim() || 'technology' }
    };
  }
  
  // Wikipedia/Knowledge detection
  if (/\b(who (is|was)|what (is|are)|explain|tell me about|define)\b/.test(lower)) {
    const topicMatch = message.match(/(?:who is|what is|about|explain)\s+(.+?)(?:\?|$)/i);
    return {
      intent: 'wikipedia',
      confidence: 0.75,
      params: { query: topicMatch?.[1]?.trim() || message }
    };
  }
  
  // Translation detection
  if (/\b(translate|translation|say .+ in|how do you say)\b/.test(lower)) {
    const langMatch = lower.match(/\b(spanish|french|german|italian|portuguese|chinese|japanese|korean|arabic|russian|hindi)\b/);
    const langCodes: Record<string, string> = {
      'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
      'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
      'arabic': 'ar', 'russian': 'ru', 'hindi': 'hi'
    };
    const textMatch = message.match(/(?:translate|say)\s+"?([^"]+?)"?\s+(?:to|in)/i);
    return {
      intent: 'translate',
      confidence: 0.85,
      params: {
        text: textMatch?.[1] || message,
        targetLang: langCodes[langMatch?.[1] || 'spanish'] || 'es'
      }
    };
  }
  
  // Time detection
  if (/\b(time|date|day|what time|current time)\b/.test(lower)) {
    const locationMatch = message.match(/(?:in|at)\s+([A-Za-z\s]+?)(?:\?|$)/i);
    return {
      intent: 'time',
      confidence: 0.9,
      params: { location: locationMatch?.[1]?.trim() }
    };
  }
  
  // Code/Dev detection
  if (/\b(code|program|function|debug|error|javascript|python|typescript|react|api)\b/.test(lower)) {
    return {
      intent: 'code',
      confidence: 0.8,
      params: {}
    };
  }
  
  // Image search detection
  if (/\b(show me|find|search for)\s+.*(image|photo|picture)/i.test(message)) {
    const queryMatch = message.match(/(?:show me|find|search for)\s+(.+?)\s+(?:image|photo|picture)/i);
    return {
      intent: 'images',
      confidence: 0.8,
      params: { query: queryMatch?.[1]?.trim() || message }
    };
  }
  
  // Fun detection
  if (/\b(joke|funny|laugh|quote|inspiration|fact|trivia)\b/.test(lower)) {
    if (/joke/.test(lower)) return { intent: 'joke', confidence: 0.9, params: {} };
    if (/quote|inspiration/.test(lower)) return { intent: 'quote', confidence: 0.9, params: {} };
    if (/fact|trivia/.test(lower)) return { intent: 'fact', confidence: 0.9, params: {} };
  }
  
  // Default to general chat
  return { intent: 'chat', confidence: 0.5, params: {} };
}

// ============ DATA FETCHERS ============

async function fetchExternalData(intent: string, params: Record<string, any>): Promise<any> {
  try {
    switch (intent) {
      case 'weather': {
        const location = params.location || 'Cape Coral, Florida';
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
        );
        const geoData = await geoRes.json();
        
        if (!geoData.results?.[0]) return null;
        
        const { latitude, longitude, name, country } = geoData.results[0];
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&temperature_unit=fahrenheit&forecast_days=3`
        );
        const weather = await weatherRes.json();
        
        const weatherCodes: Record<number, string> = {
          0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Foggy', 51: 'Light drizzle', 61: 'Light rain', 63: 'Rain',
          65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 80: 'Rain showers',
          95: 'Thunderstorm'
        };
        
        return {
          location: `${name}, ${country}`,
          current: {
            temp: Math.round(weather.current?.temperature_2m),
            feelsLike: Math.round(weather.current?.apparent_temperature),
            humidity: weather.current?.relative_humidity_2m,
            wind: Math.round(weather.current?.wind_speed_10m),
            condition: weatherCodes[weather.current?.weather_code] || 'Unknown'
          },
          forecast: weather.daily?.time?.slice(0, 3).map((date: string, i: number) => ({
            date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            high: Math.round(weather.daily.temperature_2m_max[i]),
            low: Math.round(weather.daily.temperature_2m_min[i]),
            condition: weatherCodes[weather.daily.weather_code[i]] || 'Unknown'
          }))
        };
      }
      
      case 'stock': {
        const symbol = params.symbol?.toUpperCase() || 'AAPL';
        
        // Try Finnhub first
        if (process.env.FINNHUB_KEY) {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`
          );
          const data = await res.json();
          if (data.c) {
            return {
              symbol,
              price: data.c.toFixed(2),
              change: data.d?.toFixed(2),
              changePercent: data.dp?.toFixed(2),
              high: data.h?.toFixed(2),
              low: data.l?.toFixed(2),
              previousClose: data.pc?.toFixed(2)
            };
          }
        }
        
        // Fallback to Alpha Vantage
        if (process.env.ALPHA_VANTAGE_KEY) {
          const res = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_KEY}`
          );
          const data = await res.json();
          const quote = data['Global Quote'];
          if (quote) {
            return {
              symbol: quote['01. symbol'],
              price: parseFloat(quote['05. price']).toFixed(2),
              change: parseFloat(quote['09. change']).toFixed(2),
              changePercent: parseFloat(quote['10. change percent']).toFixed(2),
              high: parseFloat(quote['03. high']).toFixed(2),
              low: parseFloat(quote['04. low']).toFixed(2),
              volume: parseInt(quote['06. volume']).toLocaleString()
            };
          }
        }
        
        return null;
      }
      
      case 'crypto': {
        const symbol = params.symbol || 'bitcoin';
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${symbol}?localization=false&tickers=false&community_data=false&developer_data=false`
        );
        const data = await res.json();
        
        if (data.id) {
          return {
            name: data.name,
            symbol: data.symbol?.toUpperCase(),
            price: data.market_data?.current_price?.usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            change24h: data.market_data?.price_change_percentage_24h?.toFixed(2),
            change7d: data.market_data?.price_change_percentage_7d?.toFixed(2),
            marketCap: (data.market_data?.market_cap?.usd / 1e9)?.toFixed(2) + 'B',
            volume24h: (data.market_data?.total_volume?.usd / 1e9)?.toFixed(2) + 'B'
          };
        }
        return null;
      }
      
      case 'news': {
        const topic = params.topic || 'technology';
        
        if (process.env.GNEWS_API_KEY) {
          const res = await fetch(
            `https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&token=${process.env.GNEWS_API_KEY}&lang=en&max=5`
          );
          const data = await res.json();
          if (data.articles) {
            return data.articles.slice(0, 5).map((a: any) => ({
              title: a.title,
              source: a.source.name,
              url: a.url,
              publishedAt: new Date(a.publishedAt).toLocaleDateString()
            }));
          }
        }
        return null;
      }
      
      case 'wikipedia': {
        const query = params.query;
        const searchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
        );
        const searchData = await searchRes.json();
        
        if (searchData.query?.search?.[0]) {
          const pageId = searchData.query.search[0].pageid;
          const title = searchData.query.search[0].title;
          
          const contentRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`
          );
          const contentData = await contentRes.json();
          const extract = contentData.query.pages[pageId]?.extract;
          
          return {
            title,
            summary: extract?.substring(0, 1000),
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
          };
        }
        return null;
      }
      
      case 'translate': {
        const { text, targetLang } = params;
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
        );
        const data = await res.json();
        
        if (data.responseData?.translatedText) {
          return {
            original: text,
            translated: data.responseData.translatedText,
            targetLang
          };
        }
        return null;
      }
      
      case 'joke': {
        const res = await fetch('https://official-joke-api.appspot.com/random_joke');
        return await res.json();
      }
      
      case 'quote': {
        const res = await fetch('https://api.quotable.io/random');
        return await res.json();
      }
      
      case 'fact': {
        const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        return await res.json();
      }
      
      default:
        return null;
    }
  } catch (e) {
    console.error(`Data fetch error for ${intent}:`, e);
    return null;
  }
}

// ============ MODEL SELECTION ============

function selectModel(intent: string, complexity: number): { model: string; provider: string } {
  // Complex or creative tasks -> Claude
  if (['code', 'creative', 'analysis'].includes(intent) || complexity > 50) {
    return { model: 'claude-sonnet-4-20250514', provider: 'anthropic' };
  }
  
  // Data-heavy tasks -> GPT-4
  if (['stock', 'news', 'wikipedia'].includes(intent)) {
    return { model: 'gpt-4-turbo-preview', provider: 'openai' };
  }
  
  // Simple tasks -> GPT-3.5 for speed
  if (['joke', 'quote', 'fact', 'time'].includes(intent)) {
    return { model: 'gpt-3.5-turbo', provider: 'openai' };
  }
  
  // Default to Claude for quality
  return { model: 'claude-sonnet-4-20250514', provider: 'anthropic' };
}

// ============ AI CALL ============

async function callAI(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  provider: string
): Promise<{ content: string; tokensUsed: number }> {
  
  if (provider === 'anthropic') {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    });
    
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens
    };
  }
  
  // OpenAI
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    max_tokens: 2048,
    temperature: 0.7
  });
  
  return {
    content: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0
  };
}

// ============ MAIN HANDLER ============

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ChatRequest = await request.json();
    const { messages, userId, sessionId, sourceApp, systemContext, tools = true } = body;
    
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;
    
    // Detect intent and enrich context
    const { intent, confidence, params } = detectIntent(userMessage);
    let enrichedData: any = null;
    
    // Fetch external data if tools enabled and confident intent
    if (tools && confidence > 0.6 && intent !== 'chat') {
      enrichedData = await fetchExternalData(intent, params);
    }
    
    // Calculate complexity (word count + question marks + code indicators)
    const complexity = userMessage.split(/\s+/).length + 
                       (userMessage.match(/\?/g)?.length || 0) * 5 +
                       (userMessage.match(/```|code|function|api/gi)?.length || 0) * 20;
    
    // Select best model
    const { model, provider } = selectModel(intent, complexity);
    
    // Build system prompt
    let systemPrompt = `You are Javari, an advanced AI assistant created by CR AudioViz AI. You're helpful, knowledgeable, and friendly. Current date: ${new Date().toLocaleDateString()}.`;
    
    if (systemContext) {
      systemPrompt += `\n\n${systemContext}`;
    }
    
    if (enrichedData) {
      systemPrompt += `\n\nREAL-TIME DATA (use this to answer the user's question):\n${JSON.stringify(enrichedData, null, 2)}`;
    }
    
    systemPrompt += `\n\nGuidelines:
- Be conversational and helpful
- If you have real-time data, present it clearly
- For weather: include current conditions and forecast
- For stocks/crypto: include price, change, and context
- For news: summarize key headlines
- For facts/knowledge: be informative but concise
- Always be accurate with data provided to you`;
    
    // Call AI
    const { content, tokensUsed } = await callAI(messages, systemPrompt, model, provider);
    
    const responseTime = Date.now() - startTime;
    
    // Log the interaction for learning
    try {
      await supabase.from('chat_logs').insert({
        user_id: userId,
        session_id: sessionId,
        source_app: sourceApp || 'javariai.com',
        user_message: userMessage,
        assistant_response: content,
        intent_detected: intent,
        intent_confidence: confidence,
        model_used: model,
        provider_used: provider,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        enriched_data: enrichedData ? true : false,
        created_at: new Date().toISOString()
      });
    } catch (e) {}
    
    // Record learning signal
    try {
      await supabase.from('learning_feedback').insert({
        interaction_id: `${sessionId || 'anon'}_${Date.now()}`,
        interaction_type: 'chat',
        outcome: 'success',
        context: { intent, params, enrichedData: !!enrichedData },
        metrics: {
          response_time_ms: responseTime,
          tokens_used: tokensUsed,
          model: model
        },
        created_at: new Date().toISOString()
      });
    } catch (e) {}
    
    return NextResponse.json({
      content,
      response: content,
      provider: provider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT',
      model,
      intent: {
        detected: intent,
        confidence,
        params
      },
      enrichedData: enrichedData ? true : false,
      tokensUsed,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Chat failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari Powerhouse Chat API',
    version: '2.0.0',
    status: 'operational',
    capabilities: [
      'Multi-model AI (Claude, GPT-4, GPT-3.5)',
      'Real-time weather data',
      'Live stock prices',
      'Cryptocurrency data',
      'News headlines',
      'Wikipedia knowledge',
      'Translation',
      'Jokes, quotes, facts',
      'Autonomous learning',
      'Intent detection'
    ],
    timestamp: new Date().toISOString()
  });
}
