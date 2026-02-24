// app/api/javari/status/route.ts
// Javari AI Status Dashboard — vault-integrated, comprehensive system status.
// Timestamp: 2026-02-19 09:40 EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { vault } from '@/lib/javari/secrets/vault';

export const dynamic = 'force-dynamic';

interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  details?: Record<string, unknown>;
}

export async function GET(_req: NextRequest) {
  const startTime = Date.now();
  const components: ComponentStatus[] = [];

  // ── Supabase client via vault ─────────────────────────────────────────
  const supabaseUrl  = vault.get('supabase_url') ?? '';
  const supabaseSvc  = vault.get('supabase_service') ?? '';

  if (!supabaseUrl || !supabaseSvc) {
    components.push({
      name: 'Database',
      status: 'down',
      lastCheck: new Date().toISOString(),
      details: { error: 'Supabase credentials missing from vault' },
    });
  } else {
    const supabase = createClient(supabaseUrl, supabaseSvc);

    // 1. Database connection
    try {
      const { count, error } = await supabase
        .from('javari_knowledge')
        .select('*', { count: 'exact', head: true });
      components.push({
        name: 'Database',
        status: error ? 'down' : 'operational',
        lastCheck: new Date().toISOString(),
        details: error ? { error: error.message } : { knowledgeCount: count },
      });
    } catch (e) {
      components.push({
        name: 'Database',
        status: 'down',
        lastCheck: new Date().toISOString(),
        details: { error: e instanceof Error ? e.message : 'Unknown error' },
      });
    }

    // 2. Knowledge base stats
    try {
      const { data: knowledge } = await supabase
        .from('javari_knowledge')
        .select('topic, verified');
      const total    = knowledge?.length ?? 0;
      const verified = knowledge?.filter(k => k.verified).length ?? 0;
      const topics   = [...new Set(knowledge?.map(k => k.topic) ?? [])];
      components.push({
        name: 'Knowledge Base',
        status: total > 0 ? 'operational' : 'degraded',
        lastCheck: new Date().toISOString(),
        details: { total, verified, autoLearned: total - verified, topicCount: topics.length },
      });
    } catch (e) {
      components.push({
        name: 'Knowledge Base',
        status: 'unknown',
        lastCheck: new Date().toISOString(),
        details: { error: e instanceof Error ? e.message : 'Unknown error' },
      });
    }

    // 3. Apps registry
    try {
      const { data: apps, error } = await supabase
        .from('apps')
        .select('id, is_active')
        .eq('is_active', true);
      components.push({
        name: 'Apps Registry',
        status: error ? 'degraded' : 'operational',
        lastCheck: new Date().toISOString(),
        details: { activeApps: apps?.length ?? 0 },
      });
    } catch {
      components.push({ name: 'Apps Registry', status: 'unknown', lastCheck: new Date().toISOString() });
    }

    // 4. Conversations table
    try {
      const { count, error } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });
      components.push({
        name: 'Conversations',
        status: error ? 'degraded' : 'operational',
        lastCheck: new Date().toISOString(),
        details: { totalConversations: count ?? 0 },
      });
    } catch {
      components.push({ name: 'Conversations', status: 'unknown', lastCheck: new Date().toISOString() });
    }
  }

  // ── AI Provider vault status ───────────────────────────────────────────
  const coreAiProviders = [
    'anthropic', 'openai', 'groq', 'mistral',
    'perplexity', 'openrouter', 'xai', 'together', 'fireworks',
  ] as const;

  for (const provider of coreAiProviders) {
    const status = vault.getSafe(provider);
    components.push({
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Provider`,
      status: status.status === 'ok' ? 'operational' : 'degraded',
      lastCheck: status.lastChecked ?? new Date().toISOString(),
      details: { configured: status.status === 'ok', hint: status.hint, envVar: status.envVar },
    });
  }

  // ── Infrastructure vault status ───────────────────────────────────────
  const infraProviders = ['elevenlabs', 'stripe', 'paypal', 'resend'] as const;
  for (const provider of infraProviders) {
    const status = vault.getSafe(provider);
    components.push({
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
      status: status.status === 'ok' ? 'operational' : 'degraded',
      lastCheck: status.lastChecked ?? new Date().toISOString(),
      details: { configured: status.status === 'ok', hint: status.hint },
    });
  }

  // ── Overall status ────────────────────────────────────────────────────
  const operationalCount = components.filter(c => c.status === 'operational').length;
  const degradedCount    = components.filter(c => c.status === 'degraded').length;
  const downCount        = components.filter(c => c.status === 'down').length;

  let overallStatus: 'operational' | 'degraded' | 'down';
  if (downCount >= 2 || components.find(c => c.name === 'Database')?.status === 'down') {
    overallStatus = 'down';
  } else if (degradedCount > 0 || downCount > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'operational';
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
    version: '2.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    vaultIntegrated: true,
    components,
    summary: { operational: operationalCount, degraded: degradedCount, down: downCount, total: components.length },
    capabilities: {
      chat: true, learning: true, feedback: true,
      knowledgeRetrieval: true, multiProvider: true, autonomousBuild: true,
    },
    endpoints: {
      chat: '/api/javari/chat',
      router: '/api/javari/router',
      status: '/api/javari/status',
      providers: '/api/javari/providers',
      testProviders: '/api/test-providers',
    },
  });
}
