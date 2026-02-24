// app/api/bots/leads/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI LEAD SCORING & ROUTING BOT
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 3:50 PM EST
// Version: 1.0 - INTELLIGENT LEAD MANAGEMENT
//
// Features:
// - Automatic lead scoring based on behavior
// - Smart routing to appropriate follow-up
// - Conversion prediction
// - Automated nurture assignment
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING RULES
// ═══════════════════════════════════════════════════════════════════════════════

const SCORING_RULES = {
  // Engagement signals (positive)
  visited_pricing: 15,
  visited_features: 10,
  signed_up: 25,
  verified_email: 10,
  completed_onboarding: 20,
  used_tool: 5,
  used_tool_multiple: 15,
  viewed_demo: 20,
  contacted_support: 5,
  referred_friend: 30,
  
  // Conversion signals (very positive)
  started_trial: 35,
  added_payment_method: 40,
  subscribed: 50,
  
  // Negative signals
  bounced_immediately: -10,
  inactive_7_days: -15,
  inactive_14_days: -25,
  inactive_30_days: -40,
  unsubscribed_email: -20,
  
  // Profile enrichment
  company_size_enterprise: 20,
  company_size_midmarket: 15,
  company_size_smb: 10,
  job_title_executive: 15,
  job_title_manager: 10,
  industry_tech: 10,
  industry_creative: 15,
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD GRADES
// ═══════════════════════════════════════════════════════════════════════════════

function getLeadGrade(score: number): { grade: string; label: string; action: string } {
  if (score >= 80) return { grade: 'A', label: 'Hot Lead', action: 'immediate_outreach' }
  if (score >= 60) return { grade: 'B', label: 'Warm Lead', action: 'nurture_priority' }
  if (score >= 40) return { grade: 'C', label: 'Engaged', action: 'nurture_standard' }
  if (score >= 20) return { grade: 'D', label: 'Interested', action: 'nurture_long_term' }
  return { grade: 'F', label: 'Cold', action: 're_engage_campaign' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadActivity {
  type: keyof typeof SCORING_RULES
  timestamp: string
  metadata?: any
}

async function calculateScore(userId: string, activities: LeadActivity[]): Promise<{
  score: number
  grade: string
  breakdown: Record<string, number>
}> {
  let score = 0
  const breakdown: Record<string, number> = {}
  
  for (const activity of activities) {
    const points = SCORING_RULES[activity.type] || 0
    score += points
    breakdown[activity.type] = (breakdown[activity.type] || 0) + points
  }
  
  // Cap between 0 and 100
  score = Math.max(0, Math.min(100, score))
  
  const { grade } = getLeadGrade(score)
  
  return { score, grade, breakdown }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD SCORING
// ═══════════════════════════════════════════════════════════════════════════════

async function scoreLead(userId: string): Promise<any> {
  // Get user data
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (!user) {
    return { error: 'User not found' }
  }
  
  // Get user activities
  const { data: activities } = await supabase
    .from('user_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  // Build activity list
  const activityList: LeadActivity[] = []
  
  // Check signup
  if (user.created_at) {
    activityList.push({ type: 'signed_up', timestamp: user.created_at })
  }
  
  // Check email verification
  if (user.email_verified) {
    activityList.push({ type: 'verified_email', timestamp: user.email_verified_at || user.created_at })
  }
  
  // Check subscription
  if (user.subscription_status === 'active') {
    activityList.push({ type: 'subscribed', timestamp: user.subscription_start_date })
  } else if (user.subscription_status === 'trialing') {
    activityList.push({ type: 'started_trial', timestamp: user.subscription_start_date })
  }
  
  // Check inactivity
  if (user.last_login) {
    const daysSinceLogin = Math.floor(
      (Date.now() - new Date(user.last_login).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceLogin >= 30) {
      activityList.push({ type: 'inactive_30_days', timestamp: new Date().toISOString() })
    } else if (daysSinceLogin >= 14) {
      activityList.push({ type: 'inactive_14_days', timestamp: new Date().toISOString() })
    } else if (daysSinceLogin >= 7) {
      activityList.push({ type: 'inactive_7_days', timestamp: new Date().toISOString() })
    }
  }
  
  // Add tracked activities
  for (const activity of (activities || [])) {
    if (SCORING_RULES[activity.type as keyof typeof SCORING_RULES]) {
      activityList.push({
        type: activity.type as keyof typeof SCORING_RULES,
        timestamp: activity.created_at,
        metadata: activity.metadata
      })
    }
  }
  
  // Calculate score
  const { score, grade, breakdown } = await calculateScore(userId, activityList)
  const gradeInfo = getLeadGrade(score)
  
  // Save score
  await supabase
    .from('lead_scores')
    .upsert({
      user_id: userId,
      score,
      grade,
      breakdown,
      recommended_action: gradeInfo.action,
      calculated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  
  return {
    userId,
    email: user.email,
    score,
    grade,
    label: gradeInfo.label,
    recommendedAction: gradeInfo.action,
    breakdown,
    activityCount: activityList.length
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK SCORING
// ═══════════════════════════════════════════════════════════════════════════════

async function scoreAllLeads(): Promise<{ scored: number; results: any[] }> {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(100)
  
  const results = []
  for (const user of (users || [])) {
    const result = await scoreLead(user.id)
    results.push(result)
  }
  
  return { scored: results.length, results }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET LEADS BY GRADE
// ═══════════════════════════════════════════════════════════════════════════════

async function getLeadsByGrade(grade?: string): Promise<any[]> {
  let query = supabase
    .from('lead_scores')
    .select(`
      *,
      users (
        id,
        email,
        name,
        created_at,
        last_login
      )
    `)
    .order('score', { ascending: false })
  
  if (grade) {
    query = query.eq('grade', grade)
  }
  
  const { data } = await query.limit(50)
  return data || []
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION PREDICTION
// ═══════════════════════════════════════════════════════════════════════════════

function predictConversion(score: number, activities: string[]): {
  likelihood: string
  percentage: number
  factors: string[]
} {
  let percentage = score
  const factors: string[] = []
  
  if (activities.includes('visited_pricing')) {
    percentage += 10
    factors.push('Viewed pricing page')
  }
  if (activities.includes('started_trial')) {
    percentage += 20
    factors.push('Started trial')
  }
  if (activities.includes('added_payment_method')) {
    percentage += 30
    factors.push('Added payment method')
  }
  if (activities.includes('used_tool_multiple')) {
    percentage += 15
    factors.push('Active tool usage')
  }
  
  percentage = Math.min(95, percentage) // Cap at 95%
  
  let likelihood = 'Low'
  if (percentage >= 70) likelihood = 'Very High'
  else if (percentage >= 50) likelihood = 'High'
  else if (percentage >= 30) likelihood = 'Medium'
  
  return { likelihood, percentage, factors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-ASSIGN NURTURE
// ═══════════════════════════════════════════════════════════════════════════════

async function autoAssignNurture(userId: string, grade: string): Promise<string> {
  const nurture = {
    'A': 'sales_outreach',
    'B': 'priority_nurture',
    'C': 'standard_nurture',
    'D': 'long_term_nurture',
    'F': 're_engagement'
  }[grade] || 'standard_nurture'
  
  // Enroll in appropriate sequence
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/bots/marketing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'enroll_sequence',
      data: { userId, sequence: nurture }
    })
  })
  
  return nurture
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'score':
        const scored = await scoreLead(data.userId)
        return NextResponse.json({ success: true, ...scored })
      
      case 'score_all':
        const all = await scoreAllLeads()
        return NextResponse.json({ success: true, ...all })
      
      case 'record_activity':
        // Record a new activity and rescore
        await supabase.from('user_activities').insert({
          user_id: data.userId,
          type: data.type,
          metadata: data.metadata,
          created_at: new Date().toISOString()
        })
        const rescored = await scoreLead(data.userId)
        return NextResponse.json({ success: true, ...rescored })
      
      case 'predict':
        const { data: leadScore } = await supabase
          .from('lead_scores')
          .select('*')
          .eq('user_id', data.userId)
          .single()
        
        if (!leadScore) {
          return NextResponse.json({ error: 'Lead not scored yet' }, { status: 404 })
        }
        
        const prediction = predictConversion(
          leadScore.score, 
          Object.keys(leadScore.breakdown || {})
        )
        return NextResponse.json({ success: true, ...prediction })
      
      case 'auto_nurture':
        const nurture = await autoAssignNurture(data.userId, data.grade)
        return NextResponse.json({ success: true, assigned: nurture })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Lead scoring error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const grade = searchParams.get('grade')
  
  const leads = await getLeadsByGrade(grade || undefined)
  
  // Stats
  const stats = {
    A: leads.filter(l => l.grade === 'A').length,
    B: leads.filter(l => l.grade === 'B').length,
    C: leads.filter(l => l.grade === 'C').length,
    D: leads.filter(l => l.grade === 'D').length,
    F: leads.filter(l => l.grade === 'F').length
  }
  
  return NextResponse.json({
    service: 'Javari Lead Scoring Bot',
    version: '1.0.0',
    leads,
    stats,
    scoringRules: SCORING_RULES,
    grades: {
      'A (80-100)': 'Hot Lead - Immediate outreach',
      'B (60-79)': 'Warm Lead - Priority nurture',
      'C (40-59)': 'Engaged - Standard nurture',
      'D (20-39)': 'Interested - Long-term nurture',
      'F (0-19)': 'Cold - Re-engagement campaign'
    },
    usage: {
      score: 'POST { action: "score", data: { userId } }',
      scoreAll: 'POST { action: "score_all" }',
      recordActivity: 'POST { action: "record_activity", data: { userId, type, metadata } }',
      predict: 'POST { action: "predict", data: { userId } }',
      autoNurture: 'POST { action: "auto_nurture", data: { userId, grade } }'
    }
  })
}
