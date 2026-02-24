// app/api/javari/scheduler/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - SCHEDULED COMMANDS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: January 1, 2026 - 3:15 PM EST
// Version: 1.0 - AUTONOMOUS SCHEDULED EXECUTION
//
// Schedule commands to run automatically:
// - Daily revenue reports at 8 AM
// - Weekly user analytics every Monday
// - Hourly health checks
// - Custom schedules for any command
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ScheduledCommand {
  id?: string
  name: string
  command: string
  schedule: string // cron expression
  enabled: boolean
  lastRun?: string
  nextRun?: string
  notifyEmail?: string
  notifySlack?: string
  createdBy: string
  createdAt?: string
}

interface ScheduleExecution {
  id?: string
  scheduleId: string
  command: string
  result: any
  status: 'success' | 'error'
  executedAt: string
  duration: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseCron(cron: string): { description: string; nextRun: Date } {
  const parts = cron.split(' ')
  const now = new Date()
  let description = ''
  let nextRun = new Date(now)
  
  // Common patterns
  const patterns: Record<string, { desc: string; getNext: () => Date }> = {
    '0 8 * * *': {
      desc: 'Daily at 8:00 AM',
      getNext: () => {
        const d = new Date(now)
        d.setHours(8, 0, 0, 0)
        if (d <= now) d.setDate(d.getDate() + 1)
        return d
      }
    },
    '0 9 * * 1': {
      desc: 'Every Monday at 9:00 AM',
      getNext: () => {
        const d = new Date(now)
        d.setHours(9, 0, 0, 0)
        const daysUntilMonday = (8 - d.getDay()) % 7 || 7
        d.setDate(d.getDate() + daysUntilMonday)
        return d
      }
    },
    '0 * * * *': {
      desc: 'Every hour',
      getNext: () => {
        const d = new Date(now)
        d.setMinutes(0, 0, 0)
        d.setHours(d.getHours() + 1)
        return d
      }
    },
    '*/15 * * * *': {
      desc: 'Every 15 minutes',
      getNext: () => {
        const d = new Date(now)
        const mins = Math.ceil(d.getMinutes() / 15) * 15
        d.setMinutes(mins, 0, 0)
        if (d <= now) d.setMinutes(d.getMinutes() + 15)
        return d
      }
    },
    '0 0 1 * *': {
      desc: 'First day of every month',
      getNext: () => {
        const d = new Date(now)
        d.setMonth(d.getMonth() + 1, 1)
        d.setHours(0, 0, 0, 0)
        return d
      }
    }
  }
  
  if (patterns[cron]) {
    return { description: patterns[cron].desc, nextRun: patterns[cron].getNext() }
  }
  
  // Default: parse manually
  return { description: `Custom: ${cron}`, nextRun: new Date(now.getTime() + 3600000) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function createSchedule(schedule: ScheduledCommand): Promise<{ id: string }> {
  const { description, nextRun } = parseCron(schedule.schedule)
  
  const { data, error } = await supabase
    .from('scheduled_commands')
    .insert({
      name: schedule.name,
      command: schedule.command,
      schedule: schedule.schedule,
      schedule_description: description,
      enabled: schedule.enabled,
      next_run: nextRun.toISOString(),
      notify_email: schedule.notifyEmail,
      notify_slack: schedule.notifySlack,
      created_by: schedule.createdBy,
      created_at: new Date().toISOString()
    })
    .select('id')
    .single()
  
  if (error) throw error
  return { id: data.id }
}

async function listSchedules(): Promise<ScheduledCommand[]> {
  const { data, error } = await supabase
    .from('scheduled_commands')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

async function updateSchedule(id: string, updates: Partial<ScheduledCommand>): Promise<void> {
  const updateData: any = { ...updates }
  
  if (updates.schedule) {
    const { description, nextRun } = parseCron(updates.schedule)
    updateData.schedule_description = description
    updateData.next_run = nextRun.toISOString()
  }
  
  await supabase
    .from('scheduled_commands')
    .update(updateData)
    .eq('id', id)
}

async function deleteSchedule(id: string): Promise<void> {
  await supabase
    .from('scheduled_commands')
    .delete()
    .eq('id', id)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function executeScheduledCommand(schedule: any): Promise<ScheduleExecution> {
  const startTime = Date.now()
  
  try {
    // Call the business API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/javari/business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: schedule.command,
        userId: 'scheduler',
        isScheduled: true
      })
    })
    
    const result = await response.json()
    const duration = Date.now() - startTime
    
    // Log execution
    const execution: ScheduleExecution = {
      scheduleId: schedule.id,
      command: schedule.command,
      result,
      status: result.success ? 'success' : 'error',
      executedAt: new Date().toISOString(),
      duration
    }
    
    await supabase.from('schedule_executions').insert(execution)
    
    // Update last run and next run
    const { nextRun } = parseCron(schedule.schedule)
    await supabase
      .from('scheduled_commands')
      .update({
        last_run: new Date().toISOString(),
        next_run: nextRun.toISOString()
      })
      .eq('id', schedule.id)
    
    // Send notifications if configured
    if (schedule.notify_email) {
      await sendEmailNotification(schedule, result)
    }
    
    return execution
    
  } catch (error) {
    const execution: ScheduleExecution = {
      scheduleId: schedule.id,
      command: schedule.command,
      result: { error: error instanceof Error ? error.message : 'Execution failed' },
      status: 'error',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    }
    
    await supabase.from('schedule_executions').insert(execution)
    return execution
  }
}

async function sendEmailNotification(schedule: any, result: any): Promise<void> {
  // TODO: Integrate with email service (SendGrid, Resend, etc.)
  console.log(`Email notification for ${schedule.name}:`, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK AND RUN DUE SCHEDULES (Called by Vercel Cron)
// ═══════════════════════════════════════════════════════════════════════════════

async function runDueSchedules(): Promise<{ executed: number; results: any[] }> {
  const now = new Date()
  
  // Find schedules that are due
  const { data: dueSchedules } = await supabase
    .from('scheduled_commands')
    .select('*')
    .eq('enabled', true)
    .lte('next_run', now.toISOString())
  
  if (!dueSchedules || dueSchedules.length === 0) {
    return { executed: 0, results: [] }
  }
  
  const results = []
  for (const schedule of dueSchedules) {
    const execution = await executeScheduledCommand(schedule)
    results.push({
      name: schedule.name,
      command: schedule.command,
      status: execution.status,
      duration: execution.duration
    })
  }
  
  return { executed: results.length, results }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESET SCHEDULES
// ═══════════════════════════════════════════════════════════════════════════════

const PRESET_SCHEDULES = [
  {
    name: 'Daily Revenue Report',
    command: 'Run a revenue report',
    schedule: '0 8 * * *',
    description: 'Daily at 8:00 AM EST'
  },
  {
    name: 'Weekly User Analytics',
    command: 'Show me user signups this week',
    schedule: '0 9 * * 1',
    description: 'Every Monday at 9:00 AM EST'
  },
  {
    name: 'Hourly Health Check',
    command: 'Check system health',
    schedule: '0 * * * *',
    description: 'Every hour'
  },
  {
    name: 'Daily Failed Builds Check',
    command: 'Show failed deployments',
    schedule: '0 7 * * *',
    description: 'Daily at 7:00 AM EST'
  },
  {
    name: 'Weekly Grant Status',
    command: 'What is our grant status?',
    schedule: '0 10 * * 1',
    description: 'Every Monday at 10:00 AM EST'
  },
  {
    name: 'Monthly Pricing Review',
    command: 'Show current pricing',
    schedule: '0 9 1 * *',
    description: 'First day of every month'
  }
]

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'create':
        const created = await createSchedule(data)
        return NextResponse.json({ success: true, id: created.id, message: 'Schedule created' })
      
      case 'update':
        await updateSchedule(data.id, data.updates)
        return NextResponse.json({ success: true, message: 'Schedule updated' })
      
      case 'delete':
        await deleteSchedule(data.id)
        return NextResponse.json({ success: true, message: 'Schedule deleted' })
      
      case 'toggle':
        await updateSchedule(data.id, { enabled: data.enabled })
        return NextResponse.json({ success: true, message: `Schedule ${data.enabled ? 'enabled' : 'disabled'}` })
      
      case 'run_now':
        // Find schedule and execute immediately
        const { data: schedule } = await supabase
          .from('scheduled_commands')
          .select('*')
          .eq('id', data.id)
          .single()
        
        if (!schedule) {
          return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }
        
        const execution = await executeScheduledCommand(schedule)
        return NextResponse.json({ success: true, execution })
      
      case 'run_due':
        // Run all due schedules (called by cron)
        const dueResults = await runDueSchedules()
        return NextResponse.json({ success: true, ...dueResults })
      
      case 'add_preset':
        const preset = PRESET_SCHEDULES.find(p => p.name === data.name)
        if (!preset) {
          return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
        }
        const presetCreated = await createSchedule({
          ...preset,
          enabled: true,
          createdBy: data.createdBy || 'admin'
        })
        return NextResponse.json({ success: true, id: presetCreated.id })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Scheduler error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'executions') {
    const scheduleId = searchParams.get('scheduleId')
    const { data } = await supabase
      .from('schedule_executions')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('executed_at', { ascending: false })
      .limit(20)
    
    return NextResponse.json({ success: true, executions: data })
  }
  
  const schedules = await listSchedules()
  
  return NextResponse.json({
    service: 'Javari Scheduled Commands',
    version: '1.0.0',
    description: 'Autonomous scheduled execution of business commands',
    schedules,
    presets: PRESET_SCHEDULES,
    usage: {
      create: 'POST { action: "create", data: { name, command, schedule, enabled, createdBy } }',
      update: 'POST { action: "update", data: { id, updates: {...} } }',
      delete: 'POST { action: "delete", data: { id } }',
      toggle: 'POST { action: "toggle", data: { id, enabled } }',
      runNow: 'POST { action: "run_now", data: { id } }',
      runDue: 'POST { action: "run_due" }',
      addPreset: 'POST { action: "add_preset", data: { name } }'
    },
    cronExamples: {
      'Every hour': '0 * * * *',
      'Daily at 8 AM': '0 8 * * *',
      'Every Monday 9 AM': '0 9 * * 1',
      'First of month': '0 0 1 * *',
      'Every 15 minutes': '*/15 * * * *'
    }
  })
}
