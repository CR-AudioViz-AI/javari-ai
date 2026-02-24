// app/api/javari/health/route.ts
// Javari AI Health Check - Quick operational status
// Timestamp: 2025-11-29 16:00 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let dbHealthy = false;
  let knowledgeCount = 0;

  try {
    const { count, error } = await supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact', head: true });
    
    dbHealthy = !error;
    knowledgeCount = count || 0;
  } catch (e) {
    dbHealthy = false;
  }

  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  const healthy = dbHealthy && openaiConfigured;
  const responseTime = Date.now() - startTime;

  // Return appropriate status code
  const statusCode = healthy ? 200 : 503;

  return NextResponse.json({
    healthy,
    status: healthy ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    responseTimeMs: responseTime,
    checks: {
      database: dbHealthy ? 'pass' : 'fail',
      openai: openaiConfigured ? 'pass' : 'fail',
      knowledge: knowledgeCount > 0 ? 'pass' : 'warn'
    },
    stats: {
      knowledgeEntries: knowledgeCount
    }
  }, { status: statusCode });
}
