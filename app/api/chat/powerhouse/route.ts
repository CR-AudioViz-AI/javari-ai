// =============================================================================
// JAVARI AI - POWERHOUSE CHAT API v3.0
// =============================================================================
// FIXED: Full Intelligence API integration, Claude as primary AI
// Production Ready - Tuesday, December 16, 2025 - 11:15 PM EST
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

// Get base URL for internal API calls
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return 'https://crav-javari.vercel.app';
};

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
  useKnowledgeBase?: boolean;
}

interface EnrichedContext {
  weather?: any;
  news?: any;
  stock?: any;
  crypto?: any;
  wikipedia?: any;
  time?: any;
  location?: any;
  knowledgeBase?: any;
}

interface IntentResult {
  intent: string;
  confidence: number;
  params: Record<string, any>;
}

// ============ INTENT DETECTION (FIXED ORDER) ============

function detectIntent(message: string): IntentResult {
  const lower = message.toLowerCase();
  const original = message;
  
  // CRYPTO FIRST (before stock - they can overlap)
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
      params: { coinId, query: coinId }
    };
  }
  
  // Weather detection
  if (/\b(weather|temperature|forecast|rain|sunny|cloudy|snow|how (hot|cold|warm)|humidity|wind)\b/i.test(lower)) {
    const locationMatch = original.match(/(?:in|at|for)\s+([A-Za-z\s,]+?)(?:\?|$|,|\.|!)/i);
    return {
      intent: 'weather',
      confidence: 0.95,
      params: { query: locationMatch?.[1]?.trim() || 'Cape Coral, Florida' }
    };
  }
  
  // Stock detection (after crypto)
  if (/\$[A-Z]{1,5}|\b(stock|share|price of|nasdaq|nyse|dow|s&p|market)\b/i.test(message)) {
    const tickerMatch = original.match(/\$([A-Z]{1,5})|(?:stock|price|share)s?\s+(?:of\s+)?([A-Z]{1,5})/i);
    const ticker = tickerMatch?.[1] || tickerMatch?.[2] || 'AAPL';
    return {
      intent: 'stock',
      confidence: 0.9,
      params: { query: ticker.toUpperCase() }
    };
  }
  
  // News detection
  if (/\b(news|headlines|latest|breaking|what('s| is) happening|current events|trending)\b/i.test(lower)) {
    const topicMatch = original.match(/(?:about|on|regarding|for)\s+([A-Za-z\s]+?)(?:\?|$|,|\.|!)/i);
    return {
      intent: 'news',
      confidence: 0.85,
      params: { query: topicMatch?.[1]?.trim() || 'technology AI' }
    };
  }
  
  // Wikipedia/Knowledge detection
  if (/\b(who (is|was|are)|what (is|are|was)|explain|tell me about|define|meaning of|history of)\b/i.test(lower)) {
    const topicMatch = original.match(/(?:who is|who was|what is|what are|about|explain|define|history of)\s+(.+?)(?:\?|$|\.)/i);
    return {
      intent: 'wikipedia',
      confidence: 0.8,
      params: { query: topicMatch?.[1]?.trim() || message }
    };
  }
  
  // Translation detection
  if (/\b(translate|translation|say .+ in|how do you say|in spanish|in french|in german)\b/i.test(lower)) {
    const langMatch = lower.match(/\b(spanish|french|german|italian|portuguese|chinese|japanese|korean|arabic|russian|hindi)\b/i);
    const langCodes: Record<string, string> = {
      'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
      'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
      'arabic': 'ar', 'russian': 'ru', 'hindi': 'hi'
    };
    const textMatch = original.match(/(?:translate|say)\s+"?([^"]+?)"?\s+(?:to|in|into)/i);
    return {
      intent: 'translate',
      confidence: 0.9,
      params: {
        query: textMatch?.[1] || message.replace(/translate|to \w+|in \w+/gi, '').trim(),
        targetLang: langCodes[langMatch?.[1]?.toLowerCase() || 'spanish'] || 'es'
      }
    };
  }
  
  // Joke/Entertainment
  if (/\b(joke|funny|make me laugh|humor|tell me a joke)\b/i.test(lower)) {
    return { intent: 'joke', confidence: 0.95, params: {} };
  }
  
  // Quote
  if (/\b(quote|inspiration|motivat|wise words)\b/i.test(lower)) {
    return { intent: 'quote', confidence: 0.9, params: {} };
  }
  
  // Fact
  if (/\b(random fact|interesting fact|did you know|fun fact)\b/i.test(lower)) {
    return { intent: 'fact', confidence: 0.9, params: {} };
  }
  
  // Code/Dev detection
  if (/\b(code|program|function|debug|error|javascript|python|typescript|react|api|build|create app|fix)\b/i.test(lower)) {
    return {
      intent: 'code',
      confidence: 0.85,
      params: { query: message }
    };
  }
  
  // Image search
  if (/\b(show me|find|search for)\s+.*(image|photo|picture|gif)/i.test(message)) {
    const queryMatch = original.match(/(?:show me|find|search for)\s+(.+?)\s*(?:image|photo|picture|gif)/i);
    return {
      intent: 'images',
      confidence: 0.85,
      params: { query: queryMatch?.[1]?.trim() || 'nature' }
    };
  }
  
  // Default chat
  return {
    intent: 'chat',
    confidence: 1.0,
    params: {}
  };
}

// ============ FETCH EXTERNAL DATA (FIXED - ACTUALLY CALLS INTELLIGENCE API) ============

async function fetchExternalData(intent: string, params: Record<string, any>): Promise<any> {
  const baseUrl = getBaseUrl();
  
  try {
    const url = `${baseUrl}/api/intelligence`;
    
    console.log(`[Powerhouse] Fetching ${intent} from Intelligence API...`);
    
    // Use POST - the Intelligence API requires POST for data queries
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'powerhouse-chat'
      },
      body: JSON.stringify({
        action: intent,
        ...params
      }),
      // Short timeout for external data
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.error(`[Powerhouse] Intelligence API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      console.log(`[Powerhouse] Got data for ${intent}:`, JSON.stringify(data.data).slice(0, 200));
      return data.data;
    }
    
    return data;
  } catch (error) {
    console.error(`[Powerhouse] Failed to fetch ${intent} data:`, error);
    return null;
  }
}

// ============ KNOWLEDGE BASE QUERY ============

async function queryKnowledgeBase(query: string): Promise<any> {
  try {
    // Search knowledge entries
    const { data: knowledge } = await supabase
      .from('javari_knowledge')
      .select('*')
      .textSearch('content', query.split(' ').slice(0, 5).join(' | '))
      .limit(5);
    
    // Search learned patterns
    const { data: patterns } = await supabase
      .from('javari_learning')
      .select('*')
      .textSearch('query', query.split(' ').slice(0, 3).join(' | '))
      .eq('outcome', 'success')
      .limit(3);
    
    if ((knowledge && knowledge.length > 0) || (patterns && patterns.length > 0)) {
      return { knowledge, patterns };
    }
    
    return null;
  } catch (error) {
    console.error('[Powerhouse] Knowledge base error:', error);
    return null;
  }
}

// ============ MODEL SELECTION (CLAUDE FIRST) ============

function selectModel(intent: string, complexity: number): { model: string; provider: string } {
  // CLAUDE IS PRIMARY FOR EVERYTHING - This is the fix!
  
  // Simple quick queries -> GPT-3.5 for speed
  if (['joke', 'quote', 'fact'].includes(intent) && complexity < 50) {
    return { model: 'gpt-3.5-turbo', provider: 'openai' };
  }
  
  // Translation -> GPT-4 is good at this
  if (intent === 'translate') {
    return { model: 'gpt-4-turbo-preview', provider: 'openai' };
  }
  
  // EVERYTHING ELSE -> CLAUDE (coding, analysis, complex queries, chat)
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
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
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
    } catch (anthropicError) {
      console.error('[Powerhouse] Claude error, falling back to OpenAI:', anthropicError);
      // Fallback to OpenAI
      provider = 'openai';
      model = 'gpt-4-turbo-preview';
    }
  }
  
  // OpenAI (or fallback)
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    max_tokens: 4096,
    temperature: 0.7
  });
  
  return {
    content: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0
  };
}

// ============ FORMAT ENRICHED DATA FOR PROMPT ============

function formatEnrichedData(intent: string, data: any): string {
  if (!data) return '';
  
  switch (intent) {
    case 'crypto':
      if (data.price !== undefined) {
        return `
LIVE CRYPTOCURRENCY DATA:
- Coin: ${data.name || data.coinId || 'Unknown'}
- Symbol: ${data.symbol?.toUpperCase() || 'N/A'}
- Current Price: $${data.price?.toLocaleString() || 'N/A'}
- 24h Change: ${data.change24h?.toFixed(2) || 'N/A'}%
- Market Cap: $${data.marketCap?.toLocaleString() || 'N/A'}
- 24h Volume: $${data.volume24h?.toLocaleString() || 'N/A'}
- Updated: ${new Date().toLocaleString()}

Use this real-time data to answer the user's question accurately.`;
      }
      break;
      
    case 'stock':
      if (data.price !== undefined || data.c !== undefined) {
        return `
LIVE STOCK DATA:
- Symbol: ${data.symbol || data.query || 'N/A'}
- Current Price: $${(data.price || data.c)?.toFixed(2) || 'N/A'}
- Change: ${data.change || data.d || 'N/A'} (${data.percentChange || data.dp || 'N/A'}%)
- Open: $${(data.open || data.o)?.toFixed(2) || 'N/A'}
- High: $${(data.high || data.h)?.toFixed(2) || 'N/A'}
- Low: $${(data.low || data.l)?.toFixed(2) || 'N/A'}
- Previous Close: $${(data.previousClose || data.pc)?.toFixed(2) || 'N/A'}
- Updated: ${new Date().toLocaleString()}

Use this real-time data to answer the user's question accurately.`;
      }
      break;
      
    case 'weather':
      if (data.temp !== undefined || data.temperature !== undefined) {
        return `
LIVE WEATHER DATA:
- Location: ${data.location || data.name || 'N/A'}
- Temperature: ${data.temp || data.temperature || 'N/A'}°${data.unit || 'F'}
- Feels Like: ${data.feelsLike || 'N/A'}°${data.unit || 'F'}
- Conditions: ${data.description || data.conditions || 'N/A'}
- Humidity: ${data.humidity || 'N/A'}%
- Wind: ${data.windSpeed || 'N/A'} mph
- Updated: ${new Date().toLocaleString()}

Use this real-time data to answer the user's question accurately.`;
      }
      break;
      
    case 'news':
      if (Array.isArray(data.articles) || Array.isArray(data)) {
        const articles = data.articles || data;
        const headlines = articles.slice(0, 5).map((a: any, i: number) => 
          `${i + 1}. "${a.title || a.headline}" - ${a.source?.name || a.source || 'Unknown'}`
        ).join('\n');
        return `
LIVE NEWS HEADLINES:
${headlines}

Use these current headlines to answer the user's question about news.`;
      }
      break;
      
    case 'wikipedia':
      if (data.extract || data.summary || data.description) {
        return `
WIKIPEDIA KNOWLEDGE:
Title: ${data.title || 'N/A'}
Summary: ${(data.extract || data.summary || data.description).slice(0, 1000)}
Source: Wikipedia

Use this information to answer the user's question.`;
      }
      break;
      
    case 'joke':
      if (data.joke || data.setup) {
        return `
Here's a joke to share:
${data.joke || `${data.setup}\n${data.punchline}`}`;
      }
      break;
      
    case 'quote':
      if (data.quote || data.content) {
        return `
INSPIRATIONAL QUOTE:
"${data.quote || data.content}"
- ${data.author || 'Unknown'}

Share this quote naturally with the user.`;
      }
      break;
      
    case 'fact':
      if (data.fact || data.text) {
        return `
INTERESTING FACT:
${data.fact || data.text}

Share this fact naturally with the user.`;
      }
      break;
      
    default:
      return data ? `\nAdditional context: ${JSON.stringify(data)}` : '';
  }
  
  // If we get here, return raw data as fallback
  return data ? `\nReal-time data: ${JSON.stringify(data, null, 2)}` : '';
}

// ============ MAIN HANDLER ============

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `pwr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  try {
    const body: ChatRequest = await request.json();
    const { 
      messages, 
      userId, 
      sessionId, 
      sourceApp, 
      systemContext, 
      tools = true,
      useKnowledgeBase = true 
    } = body;
    
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided', requestId }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;
    
    console.log(`[Powerhouse ${requestId}] Processing: "${userMessage.slice(0, 100)}..."`);
    
    // Step 1: Detect intent
    const { intent, confidence, params } = detectIntent(userMessage);
    console.log(`[Powerhouse ${requestId}] Intent: ${intent} (${confidence}), Params:`, params);
    
    // Step 2: Fetch external data if tools enabled
    let enrichedData: any = null;
    if (tools && confidence > 0.6 && !['chat', 'code'].includes(intent)) {
      console.log(`[Powerhouse ${requestId}] Fetching external data for ${intent}...`);
      enrichedData = await fetchExternalData(intent, params);
      console.log(`[Powerhouse ${requestId}] Got enriched data:`, enrichedData ? 'YES' : 'NO');
    }
    
    // Step 3: Query knowledge base for relevant context
    let knowledgeContext: any = null;
    if (useKnowledgeBase) {
      knowledgeContext = await queryKnowledgeBase(userMessage);
    }
    
    // Step 4: Calculate complexity for model selection
    const complexity = 
      userMessage.split(/\s+/).length + 
      (userMessage.match(/\?/g)?.length || 0) * 5 +
      (userMessage.match(/```|code|function|api|build|create/gi)?.length || 0) * 20;
    
    // Step 5: Select best model (Claude-first)
    const { model, provider } = selectModel(intent, complexity);
    console.log(`[Powerhouse ${requestId}] Using ${provider}/${model}`);
    
    // Step 6: Build system prompt
    let systemPrompt = `You are Javari, CR AudioViz AI's advanced autonomous assistant. You are intelligent, helpful, accurate, and conversational.

Current Date/Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
Your Creator: CR AudioViz AI, LLC
Your Mission: Help users with anything they need - from coding to creative tasks to real-time information.`;
    
    if (systemContext) {
      systemPrompt += `\n\nApp Context: ${systemContext}`;
    }
    
    // Add enriched real-time data to prompt
    if (enrichedData) {
      systemPrompt += formatEnrichedData(intent, enrichedData);
    }
    
    // Add knowledge base context
    if (knowledgeContext && knowledgeContext.knowledge?.length > 0) {
      systemPrompt += `\n\nRELEVANT KNOWLEDGE:\n${knowledgeContext.knowledge.map((k: any) => k.content).join('\n')}`;
    }
    
    systemPrompt += `

Guidelines:
- If you have real-time data above, USE IT to answer accurately
- Be conversational and friendly, not robotic
- For financial data, always mention it's real-time and not financial advice
- For weather, include helpful context
- For code, provide complete, working solutions
- Always be honest about what you know vs. don't know`;
    
    // Step 7: Call AI
    const { content, tokensUsed } = await callAI(messages, systemPrompt, model, provider);
    
    const responseTime = Date.now() - startTime;
    
    // Step 8: Log for learning (non-blocking)
    (async () => {
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
          knowledge_used: knowledgeContext ? true : false,
          request_id: requestId,
          created_at: new Date().toISOString()
        });
        
        // Record learning signal
        await supabase.from('javari_learning').insert({
          interaction_id: requestId,
          query: userMessage,
          response: content.slice(0, 500),
          intent: intent,
          outcome: 'success',
          metrics: {
            response_time_ms: responseTime,
            tokens_used: tokensUsed,
            model,
            provider,
            had_enriched_data: !!enrichedData
          },
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('[Powerhouse] Logging error:', e);
      }
    })();
    
    // Return response
    return NextResponse.json({
      content,
      response: content,
      provider: provider === 'anthropic' ? 'Claude (Anthropic)' : 'OpenAI GPT',
      model,
      intent: {
        detected: intent,
        confidence,
        params
      },
      enrichedData: enrichedData ? true : false,
      dataSource: enrichedData ? 'Intelligence API' : null,
      knowledgeUsed: knowledgeContext ? true : false,
      tokensUsed,
      responseTime,
      requestId,
      version: '3.0 - FULL INTELLIGENCE MODE',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Powerhouse] Error:`, error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Chat failed',
      requestId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari Powerhouse Chat API',
    version: '3.0.0',
    status: 'operational',
    primaryAI: 'Claude (Anthropic)',
    capabilities: [
      'Claude as primary AI',
      'Real-time cryptocurrency prices',
      'Live stock market data',
      'Current weather conditions',
      'Breaking news headlines',
      'Wikipedia knowledge integration',
      'Translation services',
      'Entertainment (jokes, quotes, facts)',
      'Knowledge base integration',
      'Autonomous learning',
      'Intelligent intent detection'
    ],
    intelligenceEndpoints: [
      'crypto', 'stock', 'weather', 'news', 
      'wikipedia', 'translate', 'joke', 'quote', 'fact'
    ],
    timestamp: new Date().toISOString()
  });
}
