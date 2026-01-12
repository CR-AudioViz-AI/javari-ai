// app/api/bots/support/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI SUPPORT TICKET BOT
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 4:04 PM EST
// Version: 1.0 - INTELLIGENT SUPPORT AUTOMATION
//
// Features:
// - Auto-respond to common questions
// - Ticket classification and routing
// - Knowledge base search
// - Escalation management
// - Response time tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE - Common Q&A
// ═══════════════════════════════════════════════════════════════════════════════

const KNOWLEDGE_BASE = {
  // Billing & Credits
  'credits expire': {
    category: 'billing',
    answer: `Credits on paid plans (Starter, Pro, Business) NEVER expire! Only free plan credits expire monthly. This is our customer-first policy.`,
    confidence: 1.0
  },
  'refund': {
    category: 'billing',
    answer: `We offer automatic refunds for any AI errors. For subscription refunds, contact us within 7 days of purchase. We're happy to help!`,
    confidence: 0.9
  },
  'cancel subscription': {
    category: 'billing',
    answer: `You can cancel anytime from Settings > Subscription. Your access continues until the end of your billing period. Unused credits on paid plans never expire.`,
    confidence: 1.0
  },
  'pricing': {
    category: 'billing',
    answer: `Our plans: Free ($0, 50 credits/mo), Starter ($9/mo, 500 credits), Pro ($29/mo, 2000 credits), Business ($99/mo, 10000 credits). All paid plan credits never expire!`,
    confidence: 1.0
  },
  
  // Technical
  'not working': {
    category: 'technical',
    answer: `I'm sorry you're experiencing issues! Can you tell me which specific tool or feature isn't working? Also, try refreshing the page or clearing your browser cache.`,
    confidence: 0.7,
    needsHuman: true
  },
  'error': {
    category: 'technical',
    answer: `I see you're getting an error. Please share the error message and I'll help diagnose the issue. Screenshots are helpful too!`,
    confidence: 0.6,
    needsHuman: true
  },
  'slow': {
    category: 'technical',
    answer: `AI processing can take 10-30 seconds for complex tasks. If it's taking longer, try a smaller file or simpler request. Our team is always optimizing performance!`,
    confidence: 0.8
  },
  
  // Account
  'login': {
    category: 'account',
    answer: `Having trouble logging in? Try: 1) Check your email spelling, 2) Use "Forgot Password" to reset, 3) Clear browser cookies, 4) Try a different browser. Still stuck? We're here to help!`,
    confidence: 0.9
  },
  'delete account': {
    category: 'account',
    answer: `To delete your account, go to Settings > Account > Delete Account. This is permanent and removes all your data. Consider downloading your work first.`,
    confidence: 1.0
  },
  'password': {
    category: 'account',
    answer: `To reset your password, click "Forgot Password" on the login page. Check your email (including spam folder) for the reset link. Links expire in 24 hours.`,
    confidence: 1.0
  },
  
  // Features
  'how to': {
    category: 'how-to',
    answer: `I'd be happy to help you learn! What specific tool or feature would you like guidance on? We have tutorials at docs.craudiovizai.com too!`,
    confidence: 0.7
  },
  'api': {
    category: 'technical',
    answer: `Our API is available for Pro and Business plans. Documentation is at api.craudiovizai.com. You'll find your API key in Settings > Developer.`,
    confidence: 0.9
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TICKET CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
type TicketCategory = 'billing' | 'technical' | 'account' | 'how-to' | 'feedback' | 'other'

interface Ticket {
  id?: string
  userId: string
  email: string
  subject: string
  message: string
  category?: TicketCategory
  priority?: TicketPriority
  status: 'open' | 'pending' | 'resolved' | 'closed'
  autoResponse?: string
  assignedTo?: string
  createdAt?: string
  resolvedAt?: string
}

function classifyTicket(subject: string, message: string): { category: TicketCategory; priority: TicketPriority } {
  const text = `${subject} ${message}`.toLowerCase()
  
  // Priority detection
  let priority: TicketPriority = 'medium'
  if (text.includes('urgent') || text.includes('emergency') || text.includes('broken') || text.includes('can\'t access')) {
    priority = 'urgent'
  } else if (text.includes('asap') || text.includes('important') || text.includes('not working')) {
    priority = 'high'
  } else if (text.includes('question') || text.includes('wondering') || text.includes('how do')) {
    priority = 'low'
  }
  
  // Category detection
  let category: TicketCategory = 'other'
  if (text.includes('billing') || text.includes('payment') || text.includes('charge') || text.includes('credit') || text.includes('subscription') || text.includes('refund')) {
    category = 'billing'
  } else if (text.includes('error') || text.includes('bug') || text.includes('broken') || text.includes('not working') || text.includes('api')) {
    category = 'technical'
  } else if (text.includes('account') || text.includes('login') || text.includes('password') || text.includes('email')) {
    category = 'account'
  } else if (text.includes('how to') || text.includes('how do') || text.includes('tutorial') || text.includes('help me')) {
    category = 'how-to'
  } else if (text.includes('suggestion') || text.includes('feature request') || text.includes('would be nice')) {
    category = 'feedback'
  }
  
  return { category, priority }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RESPONSE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function findBestResponse(message: string): { response: string; confidence: number; needsHuman: boolean } | null {
  const text = message.toLowerCase()
  
  for (const [keyword, data] of Object.entries(KNOWLEDGE_BASE)) {
    if (text.includes(keyword)) {
      return {
        response: data.answer,
        confidence: data.confidence,
        needsHuman: ('needsHuman' in data ? data.needsHuman : false) || false
      }
    }
  }
  
  return null
}

function generateAutoResponse(ticket: Ticket): string {
  const match = findBestResponse(ticket.message)
  
  if (match && match.confidence >= 0.8 && !match.needsHuman) {
    return `Hi there! 👋

Thank you for reaching out to CR AudioViz AI support.

${match.response}

If this doesn't fully answer your question, just reply to this message and a human team member will follow up within 24 hours.

Best,
Javari AI Support Bot 🤖`
  }
  
  // Default response for low confidence or complex issues
  return `Hi there! 👋

Thank you for contacting CR AudioViz AI support. We've received your message and a team member will respond within 24 hours.

Your ticket has been classified as: **${ticket.category}** (Priority: ${ticket.priority})

In the meantime, you might find answers in our documentation: https://docs.craudiovizai.com

Best,
Javari AI Support Bot 🤖`
}

// ═══════════════════════════════════════════════════════════════════════════════
// TICKET MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function createTicket(ticket: Ticket): Promise<Ticket> {
  const { category, priority } = classifyTicket(ticket.subject, ticket.message)
  const autoResponse = generateAutoResponse({ ...ticket, category, priority })
  
  const fullTicket: Ticket = {
    ...ticket,
    category,
    priority,
    autoResponse,
    status: 'open',
    createdAt: new Date().toISOString()
  }
  
  const { data, error } = await supabase
    .from('support_tickets')
    .insert(fullTicket)
    .select()
    .single()
  
  if (error) {
    console.error('Error creating ticket:', error)
    throw error
  }
  
  // Send auto-response email
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/bots/marketing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send_email',
      data: {
        to: ticket.email,
        subject: `Re: ${ticket.subject} [Ticket #${data.id}]`,
        body: autoResponse
      }
    })
  })
  
  // Create alert for urgent tickets
  if (priority === 'urgent' || priority === 'high') {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/javari/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        data: {
          type: 'system_health',
          payload: {
            service: 'Support',
            details: `${priority.toUpperCase()} ticket from ${ticket.email}: ${ticket.subject}`
          },
          source: 'support_bot'
        }
      })
    })
  }
  
  return data
}

async function getTickets(filters?: { status?: string; category?: string; priority?: string }): Promise<Ticket[]> {
  let query = supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.priority) query = query.eq('priority', filters.priority)
  
  const { data } = await query.limit(50)
  return data || []
}

async function updateTicket(id: string, updates: Partial<Ticket>): Promise<void> {
  await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', id)
}

async function resolveTicket(id: string, resolution: string): Promise<void> {
  await supabase
    .from('support_tickets')
    .update({
      status: 'resolved',
      resolution,
      resolvedAt: new Date().toISOString()
    })
    .eq('id', id)
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS
// ═══════════════════════════════════════════════════════════════════════════════

async function getMetrics(): Promise<any> {
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
  
  if (!tickets) return {}
  
  const open = tickets.filter(t => t.status === 'open').length
  const resolved = tickets.filter(t => t.status === 'resolved').length
  const urgent = tickets.filter(t => t.priority === 'urgent' && t.status === 'open').length
  
  // Calculate average resolution time
  const resolvedTickets = tickets.filter(t => t.resolved_at && t.created_at)
  let avgResolutionTime = 0
  if (resolvedTickets.length > 0) {
    const totalTime = resolvedTickets.reduce((sum, t) => {
      return sum + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime())
    }, 0)
    avgResolutionTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60)) // hours
  }
  
  return {
    total: tickets.length,
    open,
    resolved,
    urgent,
    avgResolutionTimeHours: avgResolutionTime,
    byCategory: {
      billing: tickets.filter(t => t.category === 'billing').length,
      technical: tickets.filter(t => t.category === 'technical').length,
      account: tickets.filter(t => t.category === 'account').length,
      'how-to': tickets.filter(t => t.category === 'how-to').length,
      feedback: tickets.filter(t => t.category === 'feedback').length,
      other: tickets.filter(t => t.category === 'other').length
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'create':
        const ticket = await createTicket(data)
        return NextResponse.json({ success: true, ticket })
      
      case 'update':
        await updateTicket(data.id, data.updates)
        return NextResponse.json({ success: true, message: 'Ticket updated' })
      
      case 'resolve':
        await resolveTicket(data.id, data.resolution)
        return NextResponse.json({ success: true, message: 'Ticket resolved' })
      
      case 'find_answer':
        const match = findBestResponse(data.question)
        return NextResponse.json({ 
          success: true, 
          found: !!match,
          ...match 
        })
      
      case 'metrics':
        const metrics = await getMetrics()
        return NextResponse.json({ success: true, metrics })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Support bot error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const priority = searchParams.get('priority')
  
  const tickets = await getTickets({ status: status || undefined, category: category || undefined, priority: priority || undefined })
  const metrics = await getMetrics()
  
  return NextResponse.json({
    service: 'Javari Support Ticket Bot',
    version: '1.0.0',
    tickets,
    metrics,
    knowledgeBaseTopics: Object.keys(KNOWLEDGE_BASE),
    usage: {
      create: 'POST { action: "create", data: { userId, email, subject, message } }',
      update: 'POST { action: "update", data: { id, updates } }',
      resolve: 'POST { action: "resolve", data: { id, resolution } }',
      findAnswer: 'POST { action: "find_answer", data: { question } }',
      metrics: 'POST { action: "metrics" }'
    }
  })
}
