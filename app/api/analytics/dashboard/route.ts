// app/api/analytics/dashboard/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS ANALYTICS DASHBOARD API
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 4:38 PM EST

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function getMetrics(period: 'today' | 'week' | 'month' | 'year' = 'month') {
  const now = new Date()
  let startDate: Date
  
  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0))
      break
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7))
      break
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1))
      break
    default:
      startDate = new Date(now.setMonth(now.getMonth() - 1))
  }
  
  // Get user stats
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
  
  const { count: newUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
  
  const { count: activeUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('last_login', startDate.toISOString())
  
  // Get subscription stats
  const { data: subscriptions } = await supabase
    .from('users')
    .select('subscription_status, subscription_plan')
    .eq('subscription_status', 'active')
  
  const subscribers = subscriptions?.length || 0
  
  // Calculate MRR (mock prices)
  const prices: Record<string, number> = { free: 0, starter: 9, pro: 29, business: 99 }
  const mrr = subscriptions?.reduce((sum, sub) => {
    return sum + (prices[sub.subscription_plan] || 0)
  }, 0) || 0
  
  // Get command stats
  const { count: totalCommands } = await supabase
    .from('command_history')
    .select('*', { count: 'exact', head: true })
  
  const { count: periodCommands } = await supabase
    .from('command_history')
    .select('*', { count: 'exact', head: true })
    .gte('executed_at', startDate.toISOString())
  
  // Get support stats
  const { count: openTickets } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
  
  // Get alert stats
  const { count: activeAlerts } = await supabase
    .from('proactive_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('acknowledged', false)
  
  return {
    period,
    timestamp: new Date().toISOString(),
    users: {
      total: totalUsers || 0,
      new: newUsers || 0,
      active: activeUsers || 0,
      subscribers: subscribers
    },
    revenue: {
      mrr,
      arr: mrr * 12,
      currency: 'USD'
    },
    engagement: {
      totalCommands: totalCommands || 0,
      periodCommands: periodCommands || 0,
      avgCommandsPerUser: totalUsers ? Math.round((periodCommands || 0) / totalUsers) : 0
    },
    support: {
      openTickets: openTickets || 0,
      activeAlerts: activeAlerts || 0
    }
  }
}

async function getChartData(metric: string, days: number = 30) {
  const data = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    // Mock data - in production, query actual data
    let value = 0
    switch (metric) {
      case 'users':
        value = Math.floor(Math.random() * 10) + 1
        break
      case 'commands':
        value = Math.floor(Math.random() * 100) + 20
        break
      case 'revenue':
        value = Math.floor(Math.random() * 500) + 100
        break
    }
    
    data.push({ date: dateStr, value })
  }
  
  return data
}

async function getTopCommands(limit: number = 10) {
  const { data } = await supabase
    .from('command_history')
    .select('command_text')
    .limit(1000)
  
  if (!data) return []
  
  // Count command frequencies
  const counts: Record<string, number> = {}
  data.forEach(row => {
    const cmd = row.command_text.toLowerCase().substring(0, 50)
    counts[cmd] = (counts[cmd] || 0) + 1
  })
  
  // Sort by count
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([command, count]) => ({ command, count }))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const period = searchParams.get('period') as 'today' | 'week' | 'month' | 'year' || 'month'
  
  switch (action) {
    case 'chart':
      const metric = searchParams.get('metric') || 'users'
      const days = parseInt(searchParams.get('days') || '30')
      const chartData = await getChartData(metric, days)
      return NextResponse.json({ success: true, data: chartData })
    
    case 'top_commands':
      const topCommands = await getTopCommands()
      return NextResponse.json({ success: true, commands: topCommands })
    
    default:
      const metrics = await getMetrics(period)
      return NextResponse.json({
        success: true,
        ...metrics
      })
  }
}
