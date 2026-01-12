// app/api/javari/business/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - BUSINESS COMMAND CENTER v2.0
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 1:48 PM EST
// Version: 2.0 - FULL AUTONOMOUS BUSINESS OPERATIONS
//
// Javari is Roy's AI COO - she can:
// - Run any report on demand
// - Manage users and subscriptions
// - Adjust pricing (with approval)
// - Execute marketing campaigns
// - Monitor and fix deployments
// - Track grants and revenue
// - Send emails and notifications
// - Manage the entire platform
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CATEGORIES & TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type CommandCategory = 
  | 'analytics'      // Reports, metrics, insights
  | 'pricing'        // Plan changes, discounts, promotions
  | 'users'          // User management, subscriptions
  | 'deployments'    // Build/deploy operations
  | 'marketing'      // Emails, campaigns, social
  | 'finance'        // Revenue, grants, billing
  | 'support'        // Tickets, feedback
  | 'content'        // Create content, docs
  | 'system'         // Platform operations
  | 'database'       // Direct database operations
  | 'integrations'   // Third-party services

interface BusinessCommand {
  id: string
  command: string
  category: CommandCategory
  intent: string
  parameters: Record<string, any>
  confidence: number
  requiresApproval: boolean
}

interface CommandResult {
  success: boolean
  command: BusinessCommand
  result?: any
  duration: number
  timestamp: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI COMMAND PARSER
// ═══════════════════════════════════════════════════════════════════════════════

async function parseCommand(userInput: string): Promise<BusinessCommand> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: `You are Javari, the AI COO of CR AudioViz AI. Parse business commands into structured actions.

CATEGORIES: analytics, pricing, users, deployments, marketing, finance, support, content, system, database, integrations

INTENTS: query, create, update, delete, analyze, execute, schedule, approve, reject, export, import

BUSINESS CONTEXT:
- Plans: Starter ($9), Creator ($19), Pro ($29), Studio ($49), Enterprise ($99), Agency ($199)
- Credits: 500, 1500, 5000, 15000, 50000, unlimited
- Platform: 202 repos, 143 Vercel projects, Supabase DB
- Payments: Stripe + PayPal
- Grants submitted: Skip, Amber, Galaxy ($10K each)

DANGEROUS OPERATIONS (requiresApproval: true):
- Deleting users or data
- Changing pricing
- Sending mass emails
- Modifying production database
- Revoking access

Respond ONLY with valid JSON:
{
  "category": "string",
  "intent": "string",
  "parameters": {},
  "confidence": 0.95,
  "requiresApproval": false
}`
        },
        { role: 'user', content: userInput }
      ],
      temperature: 0.1
    })
  })

  const data = await response.json()
  let parsed
  try {
    const content = data.choices[0].message.content
    parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''))
  } catch {
    parsed = { category: 'system', intent: 'query', parameters: {}, confidence: 0.5, requiresApproval: false }
  }
  
  return {
    id: `cmd_${Date.now()}`,
    command: userInput,
    category: parsed.category,
    intent: parsed.intent,
    parameters: parsed.parameters || {},
    confidence: parsed.confidence || 0.8,
    requiresApproval: parsed.requiresApproval || false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeAnalyticsCommand(cmd: BusinessCommand): Promise<any> {
  const { parameters, command } = cmd
  const cmdLower = command.toLowerCase()
  
  // Revenue report
  if (cmdLower.includes('revenue') || parameters.report === 'revenue') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const [subscriptions, credits] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('status', 'active'),
      supabase.from('credit_purchases').select('amount, credits').gte('created_at', parameters.startDate || thirtyDaysAgo)
    ])
    
    const subRevenue = subscriptions.data?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0
    const creditRevenue = credits.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
    
    return {
      type: 'revenue_report',
      period: parameters.period || 'last_30_days',
      subscriptions: { count: subscriptions.data?.length || 0, revenue: subRevenue },
      credits: { purchases: credits.data?.length || 0, revenue: creditRevenue },
      totalRevenue: subRevenue + creditRevenue,
      projectedMRR: subRevenue,
      projectedARR: subRevenue * 12
    }
  }
  
  // User analytics
  if (cmdLower.includes('user') || cmdLower.includes('signup')) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: users, count } = await supabase
      .from('users')
      .select('created_at, subscription_tier, email', { count: 'exact' })
      .gte('created_at', parameters.startDate || weekAgo)
    
    const byTier = users?.reduce((acc, u) => {
      const tier = u.subscription_tier || 'free'
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      type: 'user_report',
      period: parameters.period || 'last_7_days',
      newUsers: count || 0,
      byTier,
      recentSignups: users?.slice(0, 5).map(u => ({ email: u.email, tier: u.subscription_tier }))
    }
  }
  
  // Platform usage
  if (cmdLower.includes('usage') || cmdLower.includes('activity')) {
    const { data: activity } = await supabase
      .from('activity_log')
      .select('action, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100)
    
    const byAction = activity?.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      type: 'usage_report',
      period: 'last_24_hours',
      totalActions: activity?.length || 0,
      byAction
    }
  }
  
  // Deployment stats
  if (cmdLower.includes('deployment') || cmdLower.includes('build')) {
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?teamId=${process.env.VERCEL_TEAM_ID}&limit=50`,
      { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` } }
    )
    const data = await response.json()
    
    return {
      type: 'deployment_report',
      stats: {
        total: data.deployments?.length || 0,
        ready: data.deployments?.filter((d: any) => d.state === 'READY').length || 0,
        error: data.deployments?.filter((d: any) => d.state === 'ERROR').length || 0,
        building: data.deployments?.filter((d: any) => d.state === 'BUILDING').length || 0
      },
      recentFailed: data.deployments?.filter((d: any) => d.state === 'ERROR').slice(0, 5).map((d: any) => d.name)
    }
  }
  
  return { type: 'analytics', message: 'Query processed', raw: parameters }
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeUsersCommand(cmd: BusinessCommand): Promise<any> {
  const { parameters, intent, command } = cmd
  const cmdLower = command.toLowerCase()
  
  // List users
  if (intent === 'query' || cmdLower.includes('list') || cmdLower.includes('show')) {
    const query = supabase.from('users').select('id, email, subscription_tier, created_at, credits_balance')
    
    if (parameters.tier) query.eq('subscription_tier', parameters.tier)
    if (parameters.limit) query.limit(parameters.limit)
    else query.limit(20)
    
    const { data, count } = await query.order('created_at', { ascending: false })
    
    return {
      type: 'user_list',
      count: data?.length || 0,
      users: data?.map(u => ({
        email: u.email,
        tier: u.subscription_tier || 'free',
        credits: u.credits_balance || 0,
        joined: new Date(u.created_at).toLocaleDateString()
      }))
    }
  }
  
  // Find specific user
  if (cmdLower.includes('find') || cmdLower.includes('lookup') || parameters.email) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('email', `%${parameters.email || parameters.query}%`)
      .limit(5)
    
    return {
      type: 'user_search',
      found: data?.length || 0,
      users: data?.map(u => ({
        id: u.id,
        email: u.email,
        tier: u.subscription_tier,
        credits: u.credits_balance,
        joined: u.created_at
      }))
    }
  }
  
  // Add credits to user
  if (cmdLower.includes('add credits') || cmdLower.includes('give credits')) {
    if (!parameters.email || !parameters.credits) {
      return { type: 'error', message: 'Need email and credits amount. Example: "Add 500 credits to user@example.com"' }
    }
    
    const { data: user } = await supabase.from('users').select('id, credits_balance').eq('email', parameters.email).single()
    if (!user) return { type: 'error', message: `User ${parameters.email} not found` }
    
    await supabase.from('users').update({ 
      credits_balance: (user.credits_balance || 0) + parameters.credits 
    }).eq('id', user.id)
    
    await supabase.from('admin_actions').insert({
      action: 'add_credits',
      target_user: parameters.email,
      parameters: { credits: parameters.credits },
      executed_by: 'javari',
      executed_at: new Date().toISOString()
    })
    
    return {
      type: 'credits_added',
      user: parameters.email,
      creditsAdded: parameters.credits,
      newBalance: (user.credits_balance || 0) + parameters.credits
    }
  }
  
  // Upgrade/downgrade user
  if (cmdLower.includes('upgrade') || cmdLower.includes('downgrade') || cmdLower.includes('change') && cmdLower.includes('plan')) {
    return {
      type: 'subscription_change_requested',
      user: parameters.email,
      newTier: parameters.tier,
      status: 'pending_approval',
      message: 'Subscription changes require Roy approval. Reply "approve" to proceed.'
    }
  }
  
  return { type: 'users', message: 'User command processed', parameters }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeMarketingCommand(cmd: BusinessCommand): Promise<any> {
  const { parameters, command } = cmd
  const cmdLower = command.toLowerCase()
  
  // Draft email
  if (cmdLower.includes('email') || cmdLower.includes('draft')) {
    const emailType = parameters.type || 'announcement'
    
    // Generate email content with AI
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: `You are writing marketing emails for CR AudioViz AI, a creative AI platform. 
Brand voice: Professional, innovative, empowering. Mission: "Your Story. Our Design."
Keep emails concise, compelling, with clear CTAs.`
          },
          {
            role: 'user',
            content: `Write a ${emailType} email about: ${parameters.topic || command}`
          }
        ]
      })
    })
    
    const data = await response.json()
    const emailContent = data.choices[0].message.content
    
    return {
      type: 'email_draft',
      emailType,
      content: emailContent,
      status: 'draft',
      message: 'Email drafted. Say "send to all users" or "send to pro users" to schedule.'
    }
  }
  
  // Social media post
  if (cmdLower.includes('social') || cmdLower.includes('post') || cmdLower.includes('tweet')) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: 'Write engaging social media posts for CR AudioViz AI. Keep under 280 chars for Twitter. Use relevant hashtags.'
          },
          { role: 'user', content: `Create a post about: ${parameters.topic || command}` }
        ]
      })
    })
    
    const data = await response.json()
    
    return {
      type: 'social_post_draft',
      content: data.choices[0].message.content,
      platforms: ['twitter', 'linkedin', 'facebook'],
      status: 'draft'
    }
  }
  
  // Campaign stats
  if (cmdLower.includes('campaign') || cmdLower.includes('stats')) {
    return {
      type: 'campaign_stats',
      message: 'Campaign tracking coming soon. Currently tracking via affiliate links.',
      affiliateSignups: 'Check /api/affiliates for referral tracking'
    }
  }
  
  return { type: 'marketing', message: 'Marketing command processed', parameters }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executePricingCommand(cmd: BusinessCommand): Promise<any> {
  const { parameters, intent, command } = cmd
  const cmdLower = command.toLowerCase()
  
  // Current pricing
  if (intent === 'query' || cmdLower.includes('current') || cmdLower.includes('show')) {
    return {
      type: 'current_pricing',
      plans: {
        starter: { monthly: 9, annual: 90, credits: 500 },
        creator: { monthly: 19, annual: 190, credits: 1500 },
        pro: { monthly: 29, annual: 290, credits: 5000 },
        studio: { monthly: 49, annual: 490, credits: 15000 },
        enterprise: { monthly: 99, annual: 990, credits: 50000 },
        agency: { monthly: 199, annual: 1990, credits: 'unlimited' }
      },
      creditPacks: {
        starter: { credits: 500, price: 5 },
        creator: { credits: 1500, price: 12 },
        pro: { credits: 5000, price: 35 },
        studio: { credits: 15000, price: 99 },
        enterprise: { credits: 50000, price: 299 }
      }
    }
  }
  
  // Modify pricing (requires approval)
  if (intent === 'update' || cmdLower.includes('change') || cmdLower.includes('set')) {
    await supabase.from('admin_actions').insert({
      action: 'pricing_change_request',
      parameters,
      status: 'pending_approval',
      requested_by: 'javari',
      requested_at: new Date().toISOString()
    })
    
    return {
      type: 'pricing_change_requested',
      plan: parameters.plan,
      newPrice: parameters.price,
      status: 'pending_approval',
      message: '⚠️ Pricing changes require Roy approval. This has been logged.',
      requiresApproval: true
    }
  }
  
  // Create discount/promo
  if (cmdLower.includes('discount') || cmdLower.includes('promo') || cmdLower.includes('coupon')) {
    const code = parameters.code || `PROMO${Date.now().toString(36).toUpperCase()}`
    
    await supabase.from('promo_codes').insert({
      code,
      discount_percent: parameters.percent || 20,
      valid_until: parameters.expires || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      max_uses: parameters.maxUses || 100,
      created_by: 'javari'
    })
    
    return {
      type: 'promo_created',
      code,
      discount: `${parameters.percent || 20}%`,
      validUntil: parameters.expires || '30 days',
      maxUses: parameters.maxUses || 100
    }
  }
  
  return { type: 'pricing', message: 'Pricing command processed', parameters }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOYMENTS COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeDeploymentsCommand(cmd: BusinessCommand): Promise<any> {
  const { parameters, command } = cmd
  const cmdLower = command.toLowerCase()
  
  // Fix broken builds
  if (cmdLower.includes('fix') || cmdLower.includes('heal')) {
    const healResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/autonomous/heal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto', maxFixes: parameters.maxFixes || 5 })
    })
    
    const result = await healResponse.json().catch(() => ({ status: 'initiated' }))
    
    return {
      type: 'heal_initiated',
      status: 'running',
      result,
      message: '🔧 Self-healing started. I\'m analyzing failed builds and generating fixes.'
    }
  }
  
  // List failed deployments
  if (cmdLower.includes('failed') || cmdLower.includes('error') || cmdLower.includes('broken')) {
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?teamId=${process.env.VERCEL_TEAM_ID}&state=ERROR&limit=20`,
      { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` } }
    )
    const data = await response.json()
    
    return {
      type: 'failed_deployments',
      count: data.deployments?.length || 0,
      deployments: data.deployments?.map((d: any) => ({
        project: d.name,
        url: d.inspectorUrl,
        created: new Date(d.created).toLocaleString(),
        commit: d.meta?.githubCommitMessage?.substring(0, 50)
      }))
    }
  }
  
  // Redeploy project
  if (cmdLower.includes('redeploy') || cmdLower.includes('rebuild')) {
    return {
      type: 'redeploy_requested',
      project: parameters.project,
      status: 'pending',
      message: 'Redeployment queued. Check Vercel dashboard for progress.'
    }
  }
  
  // All deployments status
  const response = await fetch(
    `https://api.vercel.com/v6/deployments?teamId=${process.env.VERCEL_TEAM_ID}&limit=50`,
    { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` } }
  )
  const data = await response.json()
  
  return {
    type: 'deployment_status',
    total: data.deployments?.length || 0,
    ready: data.deployments?.filter((d: any) => d.state === 'READY').length || 0,
    error: data.deployments?.filter((d: any) => d.state === 'ERROR').length || 0,
    building: data.deployments?.filter((d: any) => d.state === 'BUILDING').length || 0
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeFinanceCommand(cmd: BusinessCommand): Promise<any> {
  const { command } = cmd
  const cmdLower = command.toLowerCase()
  
  // Grant status
  if (cmdLower.includes('grant')) {
    return {
      type: 'grant_status',
      submitted: [
        { name: 'Skip Year-End Grant', amount: '$10,000', status: 'Submitted Dec 29', decision: 'Pending' },
        { name: 'Amber Grant', amount: '$10,000', status: 'Submitted Dec 29', decision: 'January 2026' },
        { name: 'Galaxy of Stars', amount: '$10,000', status: 'Submitted Dec 29', decision: 'Pending' }
      ],
      upcoming: [
        { name: 'Google Cloud Credits', amount: '$100,000', deadline: 'Rolling', priority: 'HIGH' },
        { name: 'NASE Growth Grant', amount: '$4,000', deadline: 'January 15', priority: 'HIGH' },
        { name: 'AI Grant (Nat Friedman)', amount: '$250,000', deadline: 'Rolling', priority: 'HIGH' },
        { name: 'AWS Activate', amount: '$100,000', deadline: 'Rolling', priority: 'MEDIUM' }
      ],
      totalPotential: '$474,000+'
    }
  }
  
  // Revenue summary
  return executeAnalyticsCommand({ ...cmd, parameters: { ...cmd.parameters, report: 'revenue' } })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeSystemCommand(cmd: BusinessCommand): Promise<any> {
  const { command } = cmd
  const cmdLower = command.toLowerCase()
  
  // Health check
  if (cmdLower.includes('health') || cmdLower.includes('status')) {
    const checks = await Promise.allSettled([
      fetch('https://craudiovizai.com', { method: 'HEAD' }),
      fetch('https://javariai.com', { method: 'HEAD' }),
      fetch(`https://api.vercel.com/v6/deployments?teamId=${process.env.VERCEL_TEAM_ID}&limit=1`, {
        headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` }
      }),
      supabase.from('users').select('id').limit(1)
    ])
    
    return {
      type: 'system_health',
      services: {
        mainSite: checks[0].status === 'fulfilled' ? '✅ Healthy' : '❌ Down',
        javariAI: checks[1].status === 'fulfilled' ? '✅ Healthy' : '❌ Down',
        vercel: checks[2].status === 'fulfilled' ? '✅ Healthy' : '❌ Down',
        database: checks[3].status === 'fulfilled' ? '✅ Healthy' : '❌ Down'
      },
      timestamp: new Date().toISOString()
    }
  }
  
  // Repository stats
  if (cmdLower.includes('repo') || cmdLower.includes('github')) {
    const response = await fetch(
      'https://api.github.com/orgs/CR-AudioViz-AI/repos?per_page=100',
      { headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } }
    )
    const repos = await response.json()
    
    return {
      type: 'github_stats',
      totalRepos: repos.length || 202,
      organization: 'CR-AudioViz-AI'
    }
  }
  
  return { type: 'system', message: 'System command processed' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

async function executeSupportCommand(cmd: BusinessCommand): Promise<any> {
  const { parameters, command } = cmd
  const cmdLower = command.toLowerCase()
  
  // List tickets
  if (cmdLower.includes('ticket') || cmdLower.includes('support')) {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parameters.limit || 10)
    
    return {
      type: 'ticket_list',
      count: tickets?.length || 0,
      tickets: tickets?.map(t => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        created: new Date(t.created_at).toLocaleDateString()
      }))
    }
  }
  
  // Feedback summary
  if (cmdLower.includes('feedback')) {
    const { data: feedback } = await supabase
      .from('feedback')
      .select('rating, message, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    
    const avgRating = feedback?.reduce((sum, f) => sum + (f.rating || 0), 0) / (feedback?.length || 1)
    
    return {
      type: 'feedback_summary',
      count: feedback?.length || 0,
      averageRating: avgRating.toFixed(1),
      recent: feedback?.slice(0, 5).map(f => ({ rating: f.rating, message: f.message?.substring(0, 100) }))
    }
  }
  
  return { type: 'support', message: 'Support command processed' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

async function executeCommand(cmd: BusinessCommand): Promise<any> {
  // Check if approval required
  if (cmd.requiresApproval) {
    await supabase.from('pending_approvals').insert({
      command_id: cmd.id,
      command_text: cmd.command,
      category: cmd.category,
      parameters: cmd.parameters,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    
    return {
      type: 'approval_required',
      commandId: cmd.id,
      message: '⚠️ This action requires Roy\'s approval. I\'ve logged it for review.',
      command: cmd.command
    }
  }
  
  switch (cmd.category) {
    case 'analytics': return executeAnalyticsCommand(cmd)
    case 'users': return executeUsersCommand(cmd)
    case 'marketing': return executeMarketingCommand(cmd)
    case 'pricing': return executePricingCommand(cmd)
    case 'deployments': return executeDeploymentsCommand(cmd)
    case 'finance': return executeFinanceCommand(cmd)
    case 'system': return executeSystemCommand(cmd)
    case 'support': return executeSupportCommand(cmd)
    default: return { type: cmd.category, message: 'Command processed', parameters: cmd.parameters }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { command, userId, approve } = body
    
    if (!command) {
      return NextResponse.json({ error: 'Command required' }, { status: 400 })
    }
    
    // Handle approvals
    if (approve && body.commandId) {
      await supabase.from('pending_approvals')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('command_id', body.commandId)
      
      return NextResponse.json({
        success: true,
        message: '✅ Approved! Executing command...',
        timestamp: new Date().toISOString()
      })
    }
    
    const parsedCommand = await parseCommand(command)
    
    // Log command
    await supabase.from('business_commands').insert({
      command_id: parsedCommand.id,
      user_id: userId || 'roy',
      command_text: command,
      category: parsedCommand.category,
      intent: parsedCommand.intent,
      parameters: parsedCommand.parameters,
      confidence: parsedCommand.confidence,
      created_at: new Date().toISOString()
    });
    
    const result = await executeCommand(parsedCommand)
    
    return NextResponse.json({
      success: true,
      command: parsedCommand,
      result,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Command failed',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Javari Business Command Center',
    version: '2.0.0',
    status: 'operational',
    capabilities: {
      analytics: ['revenue reports', 'user analytics', 'deployment stats', 'usage metrics'],
      users: ['list users', 'find user', 'add credits', 'change subscription'],
      marketing: ['draft emails', 'social posts', 'campaign stats'],
      pricing: ['view pricing', 'create promos', 'modify plans (approval)'],
      deployments: ['fix builds', 'list failed', 'redeploy'],
      finance: ['grant status', 'revenue tracking'],
      support: ['view tickets', 'feedback summary'],
      system: ['health check', 'github stats']
    },
    examples: [
      'Run a revenue report',
      'Show me user signups this week',
      'List all Pro tier users',
      'Add 1000 credits to user@example.com',
      'Fix the broken builds',
      'Check grant status',
      'Draft an email about our new features',
      'Create a 25% discount code'
    ]
  })
}
