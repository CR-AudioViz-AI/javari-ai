/**
 * JAVARI CREDENTIAL SYNC ENGINE
 * Self-healing system that:
 * 1. Detects missing/misnamed env vars in Vercel
 * 2. Restores them from known-good values or aliases
 * 3. Validates live against provider APIs
 * 4. Reports full status without exposing key values
 *
 * Usage:
 *   import { credentialSync } from '@/lib/javari/secrets/credential-sync'
 *   const result = await credentialSync.sync()
 *
 * Or via HTTP:
 *   POST /api/javari/credentials/sync
 */

import { vault, PROVIDER_ENV_MAP, type ProviderName, type KeyStatus } from './vault';

interface VercelEnvResponse {
  envs: Array<{
    id: string;
    key: string;
    value: string;
    type: 'plain' | 'encrypted' | 'secret';
    target: string[];
    createdAt: number;
    updatedAt: number;
  }>;
}

interface ProviderLiveTest {
  provider: ProviderName;
  status: KeyStatus;
  latencyMs?: number;
  error?: string;
}

// ─── Live provider tests ──────────────────────────────────────────────────

const LIVE_TESTS: Partial<Record<ProviderName, () => Promise<ProviderLiveTest>>> = {
  anthropic: async () => {
    const key = vault.get('anthropic');
    if (!key) return { provider: 'anthropic', status: 'missing' };
    const start = Date.now();
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(8000),
      });
      return {
        provider: 'anthropic',
        status: r.status === 200 ? 'ok' : r.status === 401 ? 'invalid' : 'invalid',
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return { provider: 'anthropic', status: 'invalid', error: String(e) };
    }
  },

  openai: async () => {
    const key = vault.get('openai');
    if (!key) return { provider: 'openai', status: 'missing' };
    const start = Date.now();
    try {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      return {
        provider: 'openai',
        status: r.status === 200 ? 'ok' : 'invalid',
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return { provider: 'openai', status: 'invalid', error: String(e) };
    }
  },

  groq: async () => {
    const key = vault.get('groq');
    if (!key) return { provider: 'groq', status: 'missing' };
    const start = Date.now();
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      return {
        provider: 'groq',
        status: r.status === 200 ? 'ok' : 'invalid',
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return { provider: 'groq', status: 'invalid', error: String(e) };
    }
  },

  elevenlabs: async () => {
    const key = vault.get('elevenlabs');
    if (!key) return { provider: 'elevenlabs', status: 'missing' };
    const start = Date.now();
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(8000),
      });
      return {
        provider: 'elevenlabs',
        status: r.status === 200 ? 'ok' : 'invalid',
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return { provider: 'elevenlabs', status: 'invalid', error: String(e) };
    }
  },

  supabase_url: async () => {
    const url = vault.get('supabase_url');
    const anon = vault.get('supabase_anon');
    if (!url || !anon) return { provider: 'supabase_url', status: 'missing' };
    const start = Date.now();
    try {
      const r = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        signal: AbortSignal.timeout(8000),
      });
      return {
        provider: 'supabase_url',
        status: r.status === 200 || r.status === 404 ? 'ok' : 'invalid',
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return { provider: 'supabase_url', status: 'invalid', error: String(e) };
    }
  },
};

// ─── Vercel API helpers ────────────────────────────────────────────────────

async function fetchVercelEnvVars(
  projectId: string,
  teamId: string,
  token: string
): Promise<VercelEnvResponse['envs']> {
  const r = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${teamId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`Vercel API ${r.status}: ${await r.text()}`);
  const data = (await r.json()) as VercelEnvResponse;
  return data.envs ?? [];
}

async function setVercelEnvVar(
  projectId: string,
  teamId: string,
  token: string,
  key: string,
  value: string,
  existingId?: string
): Promise<boolean> {
  const body = {
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  };

  const url = existingId
    ? `https://api.vercel.com/v9/projects/${projectId}/env/${existingId}?teamId=${teamId}`
    : `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}`;

  const r = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.ok;
}

// ─── Sync engine ──────────────────────────────────────────────────────────

class CredentialSyncEngine {
  /**
   * Full sync cycle:
   * 1. Read current Vercel env vars
   * 2. Detect naming mismatches (e.g. GOOGLE_API_KEY vs GEMINI_API_KEY)
   * 3. Restore canonical names where missing
   * 4. Run live provider tests
   * 5. Return summary
   */
  async sync(options?: {
    projectId?: string;
    teamId?: string;
    runLiveTests?: boolean;
    dryRun?: boolean;
  }): Promise<{
    vercelSync: { fixed: string[]; skipped: string[]; failed: string[] };
    liveTests: ProviderLiveTest[];
    summary: string;
  }> {
    const token = vault.get('vercel');
    const projectId = options?.projectId ??
      process.env.VERCEL_PROJECT_ID ??
      'prj_zxjzE2qvMWFWqV0AspGvago6aPV5'; // javari-ai
    const teamId = options?.teamId ??
      process.env.VERCEL_TEAM_ID ??
      'team_Z0yef7NlFu1coCJWz8UmUdI5';
    const runLiveTests = options?.runLiveTests ?? true;
    const dryRun = options?.dryRun ?? false;

    const fixed: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    // ── 1. Reconcile naming mismatches ──────────────────────────────────
    if (token && !dryRun) {
      try {
        const currentEnvs = await fetchVercelEnvVars(projectId, teamId, token);
        const existingKeys = new Map(currentEnvs.map(e => [e.key, e]));

        for (const [provider, envVarList] of Object.entries(PROVIDER_ENV_MAP)) {
          const canonicalVar = envVarList[0];
          const canonicalExists = existingKeys.has(canonicalVar);

          if (!canonicalExists) {
            // Try to find value from alias vars
            for (const aliasVar of envVarList.slice(1)) {
              const aliasEnv = existingKeys.get(aliasVar);
              if (aliasEnv) {
                // Found in alias — copy to canonical name
                const ok = await setVercelEnvVar(
                  projectId, teamId, token, canonicalVar, aliasEnv.value
                );
                if (ok) {
                  fixed.push(`${provider}: created ${canonicalVar} from ${aliasVar}`);
                } else {
                  failed.push(`${provider}: could not create ${canonicalVar}`);
                }
                break;
              }
            }
          } else {
            skipped.push(`${provider}: ${canonicalVar} already exists`);
          }
        }
      } catch (e: unknown) {
        failed.push(`Vercel API error: ${String(e)}`);
      }
    }

    // ── 2. Live provider tests ───────────────────────────────────────────
    const liveTests: ProviderLiveTest[] = [];
    if (runLiveTests) {
      const testProviders = Object.keys(LIVE_TESTS) as ProviderName[];
      const results = await Promise.allSettled(
        testProviders.map(p => LIVE_TESTS[p]!())
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          liveTests.push(result.value);
        }
      }
    }

    const okCount = liveTests.filter(t => t.status === 'ok').length;
    const failCount = liveTests.filter(t => t.status !== 'ok' && t.status !== 'missing').length;
    const missingCount = liveTests.filter(t => t.status === 'missing').length;

    const summary = [
      `Vercel: ${fixed.length} fixed, ${failed.length} failed`,
      `Live tests: ${okCount} ok, ${failCount} invalid, ${missingCount} missing`,
      dryRun ? '(DRY RUN - no changes made)' : '',
    ].filter(Boolean).join(' | ');

    // Clear vault cache after sync
    vault.invalidateCache();

    return { vercelSync: { fixed, skipped, failed }, liveTests, summary };
  }

  /**
   * Quick health check without modifying anything
   */
  async healthCheck(): Promise<ProviderLiveTest[]> {
    const results = await Promise.allSettled(
      (Object.keys(LIVE_TESTS) as ProviderName[]).map(p => LIVE_TESTS[p]!())
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ProviderLiveTest> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}

export const credentialSync = new CredentialSyncEngine();
