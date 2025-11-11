// app/api/user/credits/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge'

/**
 * GET /api/user/credits
 * Returns the current user's credits balance and plan information
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's subscription/plan from subscriptions table
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get credits from user_credits table or create if doesn't exist
    let { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no credits record exists, create one with free tier credits
    if (!credits) {
      const { data: newCredits, error: createError } = await supabase
        .from('user_credits')
        .insert({
          user_id: user.id,
          credits_remaining: 1000, // Free tier: 1000 credits
          credits_total: 1000,
          plan_type: 'free'
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating credits:', createError)
        return NextResponse.json(
          { error: 'Failed to initialize credits' },
          { status: 500 }
        )
      }

      credits = newCredits
    }

    // Calculate usage percentage
    const usagePercentage = credits.credits_total > 0 
      ? ((credits.credits_total - credits.credits_remaining) / credits.credits_total) * 100 
      : 0

    // Determine plan type
    let planType = credits.plan_type || 'free'
    let planBadge = 'Free'
    let creditsPerMonth = 1000

    if (subscription) {
      const priceId = subscription.price_id
      
      // Map Stripe price IDs to plan types
      if (priceId?.includes('pro')) {
        planType = 'pro'
        planBadge = 'Pro'
        creditsPerMonth = 10000
      } else if (priceId?.includes('business')) {
        planType = 'business'
        planBadge = 'Business'
        creditsPerMonth = 50000
      } else if (priceId?.includes('enterprise')) {
        planType = 'enterprise'
        planBadge = 'Enterprise'
        creditsPerMonth = 200000
      }
    }

    return NextResponse.json({
      success: true,
      credits: {
        remaining: credits.credits_remaining,
        total: credits.credits_total,
        used: credits.credits_total - credits.credits_remaining,
        usage_percentage: Math.round(usagePercentage),
        plan_type: planType,
        plan_badge: planBadge,
        credits_per_month: creditsPerMonth,
        renewal_date: subscription?.current_period_end || null,
        never_expires: subscription?.status === 'active' && planType !== 'free',
      }
    })
  } catch (error: unknown) {
    logError('Error fetching credits:\', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/credits
 * Deduct credits from user's balance (for internal use)
 * Body: { amount: number, description: string }
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { amount, description } = body

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      )
    }

    // Get current credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (creditsError || !credits) {
      return NextResponse.json(
        { error: 'Credits not found' },
        { status: 404 }
      )
    }

    // Check if user has enough credits
    if (credits.credits_remaining < amount) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 403 }
      )
    }

    // Deduct credits
    const { data: updatedCredits, error: updateError } = await supabase
      .from('user_credits')
      .update({
        credits_remaining: credits.credits_remaining - amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating credits:', updateError)
      return NextResponse.json(
        { error: 'Failed to deduct credits' },
        { status: 500 }
      )
    }

    // Log the transaction
    const { error: logError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        amount: -amount,
        description: description || 'Credits used',
        balance_after: updatedCredits.credits_remaining
      })

    if (logError) {
      console.error('Error logging transaction:', logError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      credits: {
        remaining: updatedCredits.credits_remaining,
        deducted: amount,
      }
    })
  } catch (error: unknown) {
    logError('Error deducting credits:\', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
