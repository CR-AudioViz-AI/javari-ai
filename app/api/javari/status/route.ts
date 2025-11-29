// app/api/javari/status/route.ts
// Javari AI Status Dashboard - Comprehensive system status
// Timestamp: 2025-11-29 15:58 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  details?: any;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const components: ComponentStatus[] = [];

  // 1. Check Database Connection
  try {
    const { count, error } = await supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact', head: true });
    
    components.push({
      name: 'Database',
      status: error ? 'down' : 'operational',
      lastCheck: new Date().toISOString(),
      details: error ? { error: error.message } : { knowledgeCount: count }
    });
  } catch (e) {
    components.push({
      name: 'Database',
      status: 'down',
      lastCheck: new Date().toISOString(),
      details: { error: e instanceof Error ? e.message : 'Unknown error' }
    });
  }

  // 2. Check Knowledge Base Stats
  try {
    const { data: knowledge } = await supabase
      .from('javari_knowledge')
      .select('topic, verified');
    
    const total = knowledge?.length || 0;
    const verified = knowledge?.filter(k => k.verified).length || 0;
    const autoLearned = total - verified;
    const topics = [...new Set(knowledge?.map(k => k.topic) || [])];
    
    components.push({
      name: 'Knowledge Base',
      status: total > 0 ? 'operational' : 'degraded',
      lastCheck: new Date().toISOString(),
      details: {
        total,
        verified,
        autoLearned,
        topicCount: topics.length
      }
    });
  } catch (e) {
    components.push({
      name: 'Knowledge Base',
      status: 'unknown',
      lastCheck: new Date().toISOString(),
      details: { error: e instanceof Error ? e.message : 'Unknown error' }
    });
  }

  // 3. Check OpenAI Provider
  const openaiKey = process.env.OPENAI_API_KEY;
  components.push({
    name: 'OpenAI Provider',
    status: openaiKey ? 'operational' : 'down',
    lastCheck: new Date().toISOString(),
    details: { configured: !!openaiKey }
  });

  // 4. Check Claude Provider
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  components.push({
    name: 'Claude Provider',
    status: claudeKey ? 'operational' : 'degraded',
    lastCheck: new Date().toISOString(),
    details: { configured: !!claudeKey }
  });

  // 5. Check Apps Registry
  try {
    const { data: apps, error } = await supabase
      .from('apps')
      .select('id, is_active')
      .eq('is_active', true);
    
    components.push({
      name: 'Apps Registry',
      status: error ? 'degraded' : 'operational',
      lastCheck: new Date().toISOString(),
      details: { activeApps: apps?.length || 0 }
    });
  } catch (e) {
    components.push({
      name: 'Apps Registry',
      status: 'unknown',
      lastCheck: new Date().toISOString()
    });
  }

  // 6. Check Conversations Table
  try {
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });
    
    components.push({
      name: 'Conversations',
      status: error ? 'degraded' : 'operational',
      lastCheck: new Date().toISOString(),
      details: { totalConversations: count || 0 }
    });
  } catch (e) {
    components.push({
      name: 'Conversations',
      status: 'unknown',
      lastCheck: new Date().toISOString()
    });
  }

  // Calculate overall status
  const operationalCount = components.filter(c => c.status === 'operational').length;
  const degradedCount = components.filter(c => c.status === 'degraded').length;
  const downCount = components.filter(c => c.status === 'down').length;
  
  let overallStatus: 'operational' | 'degraded' | 'down';
  if (downCount >= 2 || components.find(c => c.name === 'Database')?.status === 'down') {
    overallStatus = 'down';
  } else if (degradedCount > 0 || downCount > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'operational';
  }

  const responseTime = Date.now() - startTime;

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTimeMs: responseTime,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    components,
    summary: {
      operational: operationalCount,
      degraded: degradedCount,
      down: downCount,
      total: components.length
    },
    capabilities: {
      chat: true,
      learning: true,
      feedback: true,
      knowledgeRetrieval: true,
      multiProvider: true,
      autonomousBuild: true
    },
    endpoints: {
      chat: '/api/chat',
      learn: '/api/learn',
      feedback: '/api/feedback',
      status: '/api/javari/status',
      build: '/api/javari/build'
    }
  });
}
