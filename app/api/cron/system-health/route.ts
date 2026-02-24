// app/api/cron/system-health/route.ts
// Runs every hour to check system health

import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = []
  
  // Check main site
  try {
    const mainSite = await fetch('https://craudiovizai.com', { method: 'HEAD' })
    checks.push({ service: 'Main Site', status: mainSite.ok ? 'healthy' : 'unhealthy' })
  } catch {
    checks.push({ service: 'Main Site', status: 'error' })
  }
  
  // Check Javari
  try {
    const javari = await fetch('https://javariai.com/api/javari/business', { method: 'GET' })
    checks.push({ service: 'Javari AI', status: javari.ok ? 'healthy' : 'unhealthy' })
  } catch {
    checks.push({ service: 'Javari AI', status: 'error' })
  }
  
  // Check for issues and create alerts
  const issues = checks.filter(c => c.status !== 'healthy')
  
  if (issues.length > 0) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/javari/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        data: {
          type: 'system_health',
          payload: {
            service: issues.map(i => i.service).join(', '),
            details: `${issues.length} services unhealthy`
          },
          source: 'health_cron'
        }
      })
    })
  }
  
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    checks,
    healthy: issues.length === 0
  })
}
