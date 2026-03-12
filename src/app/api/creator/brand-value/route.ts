```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import rateLimit from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Request validation schemas
const BrandValueRequestSchema = z.object({
  creator_id: z.string().uuid(),
  include_projections: z.boolean().optional().default(false),
  time_period: z.enum(['30d', '90d', '1y']).optional().default('90d')
})

const GetRequestSchema = z.object({
  creator_id: z.string().uuid()
})

// Types
interface EngagementMetrics {
  avg_engagement_rate: number
  follower_growth_rate: number
  content_quality_score: number
  audience_authenticity: number
  cross_platform_presence: number
}

interface RevenueStreams {
  sponsorship_revenue: number
  product_sales: number
  subscription_income: number
  merchandise_sales: number
  speaking_fees: number
  course_sales: number
  revenue_growth_rate: number
  revenue_diversification: number
}

interface MarketPositioning {
  niche_authority_score: number
  brand_recognition: number
  industry_influence: number
  competitive_advantage: number
  market_demand: number
}

interface BrandValueCalculation {
  total_brand_value: number
  engagement_score: number
  revenue_score: number
  market_score: number
  growth_potential: number
  risk_factors: string[]
  valuation_breakdown: {
    engagement_value: number
    revenue_multiple: number
    market_premium: number
    growth_multiplier: number
  }
  partnership_recommendations: {
    ideal_deal_size: number
    recommended_equity_stake: number
    projected_roi: number
  }
}

class BrandValueCalculator {
  private static readonly WEIGHTS = {
    engagement: 0.35,
    revenue: 0.40,
    market_positioning: 0.25
  }

  private static readonly MULTIPLIERS = {
    high_growth: 1.5,
    medium_growth: 1.2,
    low_growth: 1.0,
    declining: 0.8
  }

  static calculateEngagementScore(metrics: EngagementMetrics): number {
    const {
      avg_engagement_rate,
      follower_growth_rate,
      content_quality_score,
      audience_authenticity,
      cross_platform_presence
    } = metrics

    // Normalize and weight each metric
    const normalizedEngagement = Math.min(avg_engagement_rate * 100, 10) / 10
    const normalizedGrowth = Math.min(follower_growth_rate * 10, 10) / 10
    const normalizedQuality = content_quality_score / 100
    const normalizedAuthenticity = audience_authenticity / 100
    const normalizedPresence = cross_platform_presence / 10

    return (
      normalizedEngagement * 0.3 +
      normalizedGrowth * 0.2 +
      normalizedQuality * 0.2 +
      normalizedAuthenticity * 0.2 +
      normalizedPresence * 0.1
    ) * 100
  }

  static calculateRevenueScore(streams: RevenueStreams): number {
    const totalRevenue = 
      streams.sponsorship_revenue +
      streams.product_sales +
      streams.subscription_income +
      streams.merchandise_sales +
      streams.speaking_fees +
      streams.course_sales

    // Revenue stability score based on diversification
    const diversificationScore = streams.revenue_diversification / 100
    
    // Growth momentum
    const growthMultiplier = streams.revenue_growth_rate > 0.5 
      ? this.MULTIPLIERS.high_growth
      : streams.revenue_growth_rate > 0.2
      ? this.MULTIPLIERS.medium_growth
      : streams.revenue_growth_rate > 0
      ? this.MULTIPLIERS.low_growth
      : this.MULTIPLIERS.declining

    // Base score on revenue tiers
    let revenueScore = 0
    if (totalRevenue > 1000000) revenueScore = 100
    else if (totalRevenue > 500000) revenueScore = 85
    else if (totalRevenue > 100000) revenueScore = 70
    else if (totalRevenue > 50000) revenueScore = 55
    else if (totalRevenue > 10000) revenueScore = 40
    else revenueScore = Math.min(totalRevenue / 1000 * 4, 30)

    return revenueScore * diversificationScore * growthMultiplier
  }

  static calculateMarketScore(positioning: MarketPositioning): number {
    const {
      niche_authority_score,
      brand_recognition,
      industry_influence,
      competitive_advantage,
      market_demand
    } = positioning

    return (
      niche_authority_score * 0.25 +
      brand_recognition * 0.20 +
      industry_influence * 0.20 +
      competitive_advantage * 0.20 +
      market_demand * 0.15
    )
  }

  static calculateBrandValue(
    engagementMetrics: EngagementMetrics,
    revenueStreams: RevenueStreams,
    marketPositioning: MarketPositioning
  ): BrandValueCalculation {
    const engagementScore = this.calculateEngagementScore(engagementMetrics)
    const revenueScore = this.calculateRevenueScore(revenueStreams)
    const marketScore = this.calculateMarketScore(marketPositioning)

    // Calculate weighted total score
    const totalScore = 
      engagementScore * this.WEIGHTS.engagement +
      revenueScore * this.WEIGHTS.revenue +
      marketScore * this.WEIGHTS.market_positioning

    // Calculate monetary value based on revenue multiple
    const totalRevenue = Object.values(revenueStreams)
      .filter((_, i) => i < 6) // Exclude growth rate and diversification
      .reduce((sum, revenue) => sum + revenue, 0)

    const revenueMultiple = Math.max(2, Math.min(10, totalScore / 10))
    const totalBrandValue = totalRevenue * revenueMultiple

    // Calculate growth potential
    const growthPotential = (
      revenueStreams.revenue_growth_rate * 40 +
      engagementMetrics.follower_growth_rate * 30 +
      marketPositioning.market_demand * 30
    ) / 100

    // Identify risk factors
    const riskFactors: string[] = []
    if (engagementMetrics.audience_authenticity < 80) {
      riskFactors.push('Low audience authenticity')
    }
    if (revenueStreams.revenue_diversification < 50) {
      riskFactors.push('Limited revenue diversification')
    }
    if (revenueStreams.revenue_growth_rate < 0.1) {
      riskFactors.push('Slow revenue growth')
    }
    if (marketPositioning.competitive_advantage < 60) {
      riskFactors.push('Weak competitive positioning')
    }

    return {
      total_brand_value: Math.round(totalBrandValue),
      engagement_score: Math.round(engagementScore * 10) / 10,
      revenue_score: Math.round(revenueScore * 10) / 10,
      market_score: Math.round(marketScore * 10) / 10,
      growth_potential: Math.round(growthPotential * 10) / 10,
      risk_factors: riskFactors,
      valuation_breakdown: {
        engagement_value: Math.round(totalBrandValue * this.WEIGHTS.engagement),
        revenue_multiple: Math.round(revenueMultiple * 10) / 10,
        market_premium: Math.round(totalBrandValue * this.WEIGHTS.market_positioning),
        growth_multiplier: Math.round(growthPotential * 100) / 100
      },
      partnership_recommendations: {
        ideal_deal_size: Math.round(totalBrandValue * 0.15),
        recommended_equity_stake: Math.max(5, Math.min(25, 100 - totalScore)),
        projected_roi: Math.round(growthPotential * revenueMultiple * 10) / 10
      }
    }
  }
}

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await limiter.check(request, 10, 'CACHE_TOKEN')

    // Validate request body
    const body = await request.json()
    const { creator_id, include_projections, time_period } = BrandValueRequestSchema.parse(body)

    // Verify creator exists and user has access
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, user_id, name, status')
      .eq('id', creator_id)
      .single()

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      )
    }

    // Fetch engagement metrics
    const { data: engagementData, error: engagementError } = await supabase
      .from('creator_engagement_metrics')
      .select('*')
      .eq('creator_id', creator_id)
      .gte('created_at', new Date(Date.now() - (
        time_period === '1y' ? 365 : time_period === '90d' ? 90 : 30
      ) * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (engagementError) {
      return NextResponse.json(
        { error: 'Engagement metrics not found' },
        { status: 404 }
      )
    }

    // Fetch revenue data
    const { data: revenueData, error: revenueError } = await supabase
      .from('creator_revenue_streams')
      .select('*')
      .eq('creator_id', creator_id)
      .gte('period_start', new Date(Date.now() - (
        time_period === '1y' ? 365 : time_period === '90d' ? 90 : 30
      ) * 24 * 60 * 60 * 1000).toISOString())
      .order('period_start', { ascending: false })

    if (revenueError) {
      return NextResponse.json(
        { error: 'Revenue data not found' },
        { status: 404 }
      )
    }

    // Fetch market positioning data
    const { data: marketData, error: marketError } = await supabase
      .from('creator_market_positioning')
      .select('*')
      .eq('creator_id', creator_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (marketError) {
      return NextResponse.json(
        { error: 'Market positioning data not found' },
        { status: 404 }
      )
    }

    // Aggregate revenue data
    const aggregatedRevenue = revenueData.reduce((acc, curr) => ({
      sponsorship_revenue: acc.sponsorship_revenue + curr.sponsorship_revenue,
      product_sales: acc.product_sales + curr.product_sales,
      subscription_income: acc.subscription_income + curr.subscription_income,
      merchandise_sales: acc.merchandise_sales + curr.merchandise_sales,
      speaking_fees: acc.speaking_fees + curr.speaking_fees,
      course_sales: acc.course_sales + curr.course_sales,
      revenue_growth_rate: curr.revenue_growth_rate,
      revenue_diversification: curr.revenue_diversification
    }), {
      sponsorship_revenue: 0,
      product_sales: 0,
      subscription_income: 0,
      merchandise_sales: 0,
      speaking_fees: 0,
      course_sales: 0,
      revenue_growth_rate: 0,
      revenue_diversification: 0
    })

    // Calculate brand value
    const brandValueCalculation = BrandValueCalculator.calculateBrandValue(
      engagementData as EngagementMetrics,
      aggregatedRevenue as RevenueStreams,
      marketData as MarketPositioning
    )

    // Store calculation result
    const { error: insertError } = await supabase
      .from('brand_value_calculations')
      .insert({
        creator_id,
        calculation_date: new Date().toISOString(),
        total_brand_value: brandValueCalculation.total_brand_value,
        engagement_score: brandValueCalculation.engagement_score,
        revenue_score: brandValueCalculation.revenue_score,
        market_score: brandValueCalculation.market_score,
        growth_potential: brandValueCalculation.growth_potential,
        risk_factors: brandValueCalculation.risk_factors,
        valuation_breakdown: brandValueCalculation.valuation_breakdown,
        partnership_recommendations: brandValueCalculation.partnership_recommendations,
        time_period,
        metadata: { include_projections }
      })

    if (insertError) {
      console.error('Failed to store calculation:', insertError)
    }

    return NextResponse.json({
      success: true,
      data: {
        creator: {
          id: creator.id,
          name: creator.name
        },
        brand_value: brandValueCalculation,
        calculation_metadata: {
          time_period,
          calculation_date: new Date().toISOString(),
          data_freshness: {
            engagement_data_age: Math.floor((Date.now() - new Date(engagementData.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            revenue_data_points: revenueData.length,
            market_data_age: Math.floor((Date.now() - new Date(marketData.updated_at).getTime()) / (1000 * 60 * 60 * 24))
          }
        }
      }
    })

  } catch (error) {
    console.error('Brand value calculation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: error.errors 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    await limiter.check(request, 20, 'CACHE_TOKEN')

    const { searchParams } = new URL(request.url)
    const creator_id = searchParams.get('creator_id')

    if (!creator_id) {
      return NextResponse.json(
        { error: 'creator_id parameter required' },
        { status: 400 }
      )
    }

    const { creator_id: validatedCreatorId } = GetRequestSchema.parse({ creator_id })

    // Fetch most recent brand value calculation
    const { data: calculation, error } = await supabase
      .from('brand_value_calculations')
      .select('*')
      .eq('creator_id', validatedCreatorId)
      .order('calculation_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !calculation) {
      return NextResponse.json(
        { 
          error: 'No brand value calculation found',
          message: 'Run POST request first to generate brand value calculation'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        brand_value: {
          total_brand_value: calculation.total_brand_value,
          engagement_score: calculation.engagement_score,
          revenue_score: calculation.revenue_score,
          market_score: calculation.market_score,
          growth_potential: calculation.growth_potential,
          risk_factors: calculation.risk_factors,
          valuation_breakdown: calculation.valuation_breakdown,
          partnership_recommendations: calculation.partnership_recommendations
        },
        calculation_metadata: {
          calculation_date: calculation.calculation_date,
          time_period: calculation.time_period,
          age_days: Math.floor((Date.now() - new Date(calculation.calculation_date).getTime()) / (1000 * 60 * 60 * 24))
        }
      }
    })

  } catch (error) {
    console.error('Brand value fetch error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: error.errors 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```