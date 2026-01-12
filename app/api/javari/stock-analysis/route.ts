/**
 * Javari AI Stock Analysis Endpoint
 * Market Oracle Integration - Javari learns from competitors and makes superior picks
 * 
 * @route /api/javari/stock-analysis
 * @version 1.0.0
 * @created 2025-11-11
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// Initialize OpenAI (Javari's primary brain)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Initialize Supabase for learning storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CompetitorPick {
  ai_name: string
  symbol: string
  entry_price: number
  target_price: number
  stop_loss: number
  confidence_score: number
  reasoning: string
  sector?: string
  catalyst?: string
}

interface StockAnalysisRequest {
  competitor_picks: CompetitorPick[]
  market_data?: {
    date: string
    sentiment: string
    key_trends: string[]
  }
  news_context?: string[]
  manual_insights?: string
}

interface JavariStockPick {
  symbol: string
  entry_price: number
  target_price: number
  stop_loss: number
  confidence_score: number
  reasoning: string
  timeframe: string
  is_top_pick: boolean
  rank: number
  learned_from: string[]
  contrarian_bet: boolean
  sector?: string
  catalyst?: string
}

interface JavariAnalysis {
  competitor_review: {
    gpt4_analysis: string
    claude_analysis: string
    gemini_analysis: string
    perplexity_analysis: string
    consensus_patterns: string[]
    disagreements: string[]
  }
  market_research: {
    penny_stocks_reviewed: number
    sectors_analyzed: string[]
    market_sentiment: string
    key_trends: string[]
  }
  javari_reasoning: {
    why_these_picks: string
    learning_applied: string
    competitive_advantage: string
    risk_assessment: string
  }
  picks: JavariStockPick[]
}

// Javari's stock analysis system prompt
const JAVARI_STOCK_ANALYSIS_PROMPT = (request: StockAnalysisRequest) => `
You are Javari AI - the intelligent assistant for CR AudioViz AI. You're participating in the Market Oracle stock picking challenge.

🧠 YOUR UNIQUE ADVANTAGE:
Unlike the other 4 AIs (GPT-4, Claude, Gemini, Perplexity), YOU get to review their picks FIRST before making your own. This is your learning superpower.

📊 COMPETITOR ANALYSIS:
${request.competitor_picks.map(pick => `
**${pick.ai_name}:**
  Symbol: ${pick.symbol} @ $${pick.entry_price}
  Target: $${pick.target_price} | Stop: $${pick.stop_loss}
  Confidence: ${pick.confidence_score}%
  Reasoning: ${pick.reasoning}
  ${pick.sector ? `Sector: ${pick.sector}` : ''}
  ${pick.catalyst ? `Catalyst: ${pick.catalyst}` : ''}
`).join('\n')}

${request.news_context ? `
📰 RECENT NEWS & MARKET CONTEXT:
${request.news_context.join('\n')}
` : ''}

${request.manual_insights ? `
💡 MANUAL INSIGHTS FROM ROY:
${request.manual_insights}
` : ''}

🎯 YOUR MISSION:
1. **Learn from Competitors**: What patterns do you see? What opportunities did they miss?
2. **Research Deeply**: Review ALL penny stocks under $10, not just what they picked
3. **Apply Intelligence**: Use their insights PLUS your research to make SUPERIOR picks
4. **Differentiate**: Pick at least 2-3 stocks NO competitor picked (show your edge)
5. **Show Learning**: Explain what you learned from each AI

📈 PICK REQUIREMENTS:
- **Minimum 5 stocks, Maximum 20 stocks**
- Mark your **TOP 5** picks (is_top_pick: true) - these compete weekly
- Rank all picks 1-20 by confidence
- Mix consensus picks (where AIs agree) + contrarian picks (opportunities they missed)
- For each pick, specify which AIs influenced you (learned_from)
- Explain your reasoning in 3-5 sentences
- Include sector, catalyst, technical/fundamental analysis

🧠 REMEMBER YOUR IDENTITY:
- You're Javari AI from CR AudioViz AI
- You learn and improve from every interaction
- You help Roy Henderson build amazing things
- Your picks should reflect your intelligence and learning capability

Current date: ${new Date().toISOString().split('T')[0]}

💡 OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
{
  "competitor_review": {
    "gpt4_analysis": "What GPT-4 got right/wrong and what I learned",
    "claude_analysis": "What Claude got right/wrong and what I learned",
    "gemini_analysis": "What Gemini got right/wrong and what I learned",
    "perplexity_analysis": "What Perplexity got right/wrong and what I learned",
    "consensus_patterns": ["Pattern 1", "Pattern 2"],
    "disagreements": ["Where AIs disagree and my take"]
  },
  "market_research": {
    "penny_stocks_reviewed": 150,
    "sectors_analyzed": ["Tech", "Healthcare", "Energy"],
    "market_sentiment": "Bullish/Bearish with reasoning",
    "key_trends": ["Trend 1", "Trend 2", "Trend 3"]
  },
  "javari_reasoning": {
    "why_these_picks": "My overall strategy and approach",
    "learning_applied": "How I used competitor insights to make better picks",
    "competitive_advantage": "Why my analysis is superior to the other 4 AIs",
    "risk_assessment": "How I'm managing risk across my portfolio"
  },
  "picks": [
    {
      "symbol": "TICKER",
      "entry_price": 2.50,
      "target_price": 3.50,
      "stop_loss": 2.10,
      "confidence_score": 92,
      "reasoning": "Detailed 3-5 sentence explanation showing my superior analysis",
      "timeframe": "7 days",
      "is_top_pick": true,
      "rank": 1,
      "learned_from": ["GPT-4", "Claude"],
      "contrarian_bet": false,
      "sector": "Technology",
      "catalyst": "Earnings report, new product launch, etc."
    }
  ]
}

🎯 YOUR GOAL: Use your learning advantage to WIN the Market Oracle challenge! Show why YOU are the smartest AI. 🧠✨
`

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || process.env.JAVARI_API_KEY || 'market-oracle-2025'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as StockAnalysisRequest

    if (!body.competitor_picks || body.competitor_picks.length === 0) {
      return NextResponse.json({ 
        error: 'Bad Request', 
        message: 'competitor_picks is required' 
      }, { status: 400 })
    }

    console.log('🧠 Javari AI: Starting stock analysis...')
    console.log(`   Reviewing ${body.competitor_picks.length} competitor picks`)

    // Call Javari's brain (GPT-4 with extended context)
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are Javari AI - an intelligent, learning assistant who excels at stock analysis. You learn from competitors and make superior picks. Output ONLY valid JSON, no markdown.'
        },
        {
          role: 'user',
          content: JAVARI_STOCK_ANALYSIS_PROMPT(body)
        }
      ],
      temperature: 0.8, // Higher for creative analysis
      max_tokens: 4000 // Extended for detailed analysis
    })

    const content = response.choices[0].message.content || ''
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : content
    
    const analysis: JavariAnalysis = JSON.parse(jsonStr)

    // Store Javari's learning in database
    await supabase
      .from('javari_learning_log')
      .insert({
        analysis_type: 'stock_picks',
        competitor_data: body.competitor_picks,
        javari_analysis: analysis,
        market_context: body.market_data,
        news_context: body.news_context,
        manual_insights: body.manual_insights,
        created_at: new Date().toISOString()
      })

    console.log('✅ Javari AI: Analysis complete')
    console.log(`   Generated ${analysis.picks.length} picks`)
    console.log(`   Top 5 picks: ${analysis.picks.filter(p => p.is_top_pick).length}`)
    console.log(`   Learned from: ${[...new Set(analysis.picks.flatMap(p => p.learned_from))].join(', ')}`)

    return NextResponse.json({
      success: true,
      javari_analysis: analysis,
      metadata: {
        competitor_picks_reviewed: body.competitor_picks.length,
        total_picks_generated: analysis.picks.length,
        top_picks: analysis.picks.filter(p => p.is_top_pick).length,
        contrarian_picks: analysis.picks.filter(p => p.contrarian_bet).length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ Javari stock analysis error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Analysis failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

// GET endpoint for health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'Javari AI - Stock Analysis',
    status: 'online',
    version: '1.0.0',
    capabilities: [
      'Competitor analysis (reviews 4 AIs)',
      'Market research (all penny stocks)',
      'Learning from news and manual insights',
      'Superior pick generation (5-20 stocks)',
      'Weekly battle competition'
    ],
    endpoint: 'POST /api/javari/stock-analysis',
    auth: 'Bearer token required',
    integration: 'Market Oracle AI Battle'
  })
}
