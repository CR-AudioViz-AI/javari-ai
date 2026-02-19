/**
 * GET/POST /api/javari/credentials/status
 *
 * GET  → returns all provider statuses (ok | missing | invalid)
 * POST → runs live validation tests against provider APIs
 *
 * SECURITY: Never returns real key strings.
 * Only returns: provider name, status, key hint (last 4 chars), env var name
 *
 * Required: CRON_SECRET header for POST (prevents public abuse)
 */

import { NextRequest, NextResponse } from 'next/server';
import { vault } from '@/lib/javari/secrets/vault';
import { credentialSync } from '@/lib/javari/secrets/credential-sync';

// Critical providers checked in GET (subset for performance)
const CRITICAL_PROVIDERS = [
  'anthropic', 'openai', 'gemini', 'groq', 'mistral',
  'perplexity', 'openrouter', 'elevenlabs',
  'supabase_url', 'supabase_anon', 'supabase_service',
  'stripe', 'paypal',
  'github', 'vercel',
] as const;

export async function GET(req: NextRequest) {
  // Require internal auth for full status
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

  const providers = isAuthorized
    ? (Object.keys(require('@/lib/javari/secrets/vault').PROVIDER_ENV_MAP))
    : CRITICAL_PROVIDERS;

  const statuses = (providers as string[]).map(p =>
    vault.getSafe(p as Parameters<typeof vault.getSafe>[0])
  );

  const summary = {
    total: statuses.length,
    ok: statuses.filter(s => s.status === 'ok').length,
    missing: statuses.filter(s => s.status === 'missing').length,
    invalid: statuses.filter(s => s.status === 'invalid').length,
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(
    {
      summary,
      providers: statuses.map(s => ({
        provider: s.provider,
        status: s.status,
        hint: s.hint,
        envVar: s.envVar,
      })),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Vault-Version': '1.0.0',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  // Require auth for live tests (they make external API calls)
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; dryRun?: boolean; projectId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body ok
  }

  const action = body.action ?? 'health-check';

  if (action === 'sync') {
    const result = await credentialSync.sync({
      dryRun: body.dryRun ?? false,
      projectId: body.projectId,
      runLiveTests: true,
    });

    return NextResponse.json({
      action: 'sync',
      ...result,
      // Strip key values from live test results
      liveTests: result.liveTests.map(t => ({
        provider: t.provider,
        status: t.status,
        latencyMs: t.latencyMs,
        error: t.error,
      })),
    });
  }

  if (action === 'health-check') {
    const liveTests = await credentialSync.healthCheck();
    return NextResponse.json({
      action: 'health-check',
      checkedAt: new Date().toISOString(),
      results: liveTests.map(t => ({
        provider: t.provider,
        status: t.status,
        latencyMs: t.latencyMs,
        error: t.error,
      })),
      summary: {
        ok: liveTests.filter(t => t.status === 'ok').length,
        invalid: liveTests.filter(t => t.status === 'invalid').length,
        missing: liveTests.filter(t => t.status === 'missing').length,
      },
    });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
