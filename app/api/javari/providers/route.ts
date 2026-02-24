// app/api/javari/providers/route.ts
// Javari Provider Status API — vault-integrated, zero direct process.env.
// Returns live key-presence status for all providers managed by the vault.
// Timestamp: 2026-02-19 11:35 EST — v2: monitoring providers use direct env lookup

import { NextRequest, NextResponse } from 'next/server';
import { vault } from '@/lib/javari/secrets/vault';

export const dynamic = 'force-dynamic';

// ── Vault-managed providers (27 core) ─────────────────────────────────────
// These flow through vault.getSafe() which checks PROVIDER_ENV_MAP
const VAULT_PROVIDER_GROUPS = {
  ai: [
    'anthropic', 'openai', 'groq', 'mistral', 'perplexity',
    'openrouter', 'xai', 'together', 'fireworks', 'gemini',
  ],
  voice_media: ['elevenlabs'],
  payments: ['stripe', 'stripe_webhook', 'paypal', 'paypal_secret'],
  infrastructure: [
    'supabase_url', 'supabase_anon', 'supabase_service',
    'github', 'vercel', 'cloudinary', 'qdrant', 'resend',
  ],
} as const;

// ── Non-vault monitoring providers (direct env lookup) ────────────────────
// These exist in Vercel but are not in vault.ts PROVIDER_ENV_MAP
const MONITORING_PROVIDERS: Record<string, string> = {
  posthog:     'NEXT_PUBLIC_POSTHOG_KEY',
  sentry:      'SENTRY_DSN',
  uptimerobot: 'UPTIMEROBOT_API_KEY',
};

type VaultGroup = keyof typeof VAULT_PROVIDER_GROUPS;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const group = url.searchParams.get('group') as VaultGroup | null;

  try {
    // ── Vault provider results ─────────────────────────────────────────
    const groupsToCheck: VaultGroup[] = group
      ? [group]
      : (Object.keys(VAULT_PROVIDER_GROUPS) as VaultGroup[]);

    const vaultResults: Record<string, {
      status: string; icon: string; hint: string; envVar: string; group: string; lastChecked: string;
    }> = {};

    let vaultOk = 0;
    let vaultMissing = 0;

    for (const g of groupsToCheck) {
      const providerList = VAULT_PROVIDER_GROUPS[g];
      for (const provider of providerList) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cs = vault.getSafe(provider as any);
        const isOk = cs.status === 'ok';
        if (isOk) vaultOk++; else vaultMissing++;
        vaultResults[provider] = {
          status: cs.status,
          icon: isOk ? '✅' : '❌',
          hint: cs.hint,
          envVar: cs.envVar,
          group: g,
          lastChecked: cs.lastChecked ?? new Date().toISOString(),
        };
      }
    }

    // ── Monitoring provider results (direct env lookup) ────────────────
    const monitoringResults: Record<string, {
      status: string; icon: string; envVar: string; group: string;
    }> = {};
    let monOk = 0;
    let monMissing = 0;

    if (!group) {  // Only include monitoring in full scans
      for (const [name, envVar] of Object.entries(MONITORING_PROVIDERS)) {
        const val = process.env[envVar];
        const isOk = !!(val && val.trim());
        if (isOk) monOk++; else monMissing++;
        monitoringResults[name] = {
          status: isOk ? 'ok' : 'missing',
          icon: isOk ? '✅' : '❌',
          envVar,
          group: 'monitoring',
        };
      }
    }

    const totalOk = vaultOk + monOk;
    const totalMissing = vaultMissing + monMissing;
    const total = totalOk + totalMissing;
    const allReady = totalMissing === 0;

    // Group summaries
    const groupSummary: Record<string, { ok: number; missing: number; ready: boolean }> = {};
    for (const g of groupsToCheck) {
      const list = VAULT_PROVIDER_GROUPS[g];
      const gOk = list.filter(p => vaultResults[p]?.status === 'ok').length;
      const gMissing = list.length - gOk;
      groupSummary[g] = { ok: gOk, missing: gMissing, ready: gMissing === 0 };
    }
    if (!group) {
      groupSummary.monitoring = { ok: monOk, missing: monMissing, ready: monMissing === 0 };
    }

    const allProviders = [
      ...Object.entries(vaultResults).map(([name, d]) => ({ name, ...d })),
      ...Object.entries(monitoringResults).map(([name, d]) => ({ name, hint: '', lastChecked: new Date().toISOString(), ...d })),
    ];

    return NextResponse.json({
      summary: {
        total,
        ok: totalOk,
        missing: totalMissing,
        allReady,
        readyText: allReady
          ? 'ALL PROVIDERS READY ✅'
          : `${totalMissing} provider(s) missing keys`,
      },
      groups: groupSummary,
      providers: allProviders,
      missing: allProviders.filter(p => p.status !== 'ok').map(p => ({
        name: p.name,
        envVar: p.envVar,
        group: p.group,
      })),
      meta: {
        vaultVersion: '3.0',
        timestamp: new Date().toISOString(),
        notes: [
          'Gemini, xAI, Together: keys valid — Google/CF WAF blocks test-env IPs only (works in production)',
          'Perplexity: 401 from production server — key needs replacement',
        ],
      },
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Providers] Status error:', msg);
    return NextResponse.json({ error: msg, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
