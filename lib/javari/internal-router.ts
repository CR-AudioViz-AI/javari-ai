// lib/javari/internal-router.ts
// Javari ↔ CRA Internal API Router
// 2026-02-20 — JAVARI_PATCH fix_connectivity_and_branding
//
// Solves: cross-origin timeouts when javari-ai serverless functions call craudiovizai.com
// Strategy:
//   1. Uses NEXT_PUBLIC_CRA_URL env var (set in Vercel) — stable preview URL or craudiovizai.com
//   2. Falls back to known-good Vercel preview URL if primary fails
//   3. Retry with exponential backoff (2 attempts, 300ms base)
//   4. All internal calls carry X-Internal-Secret header for bypass of rate limiting
//   5. Never throws — always returns { ok, status, data, ms, attempt, url }
//
// Usage:
//   import { craFetch, jaiPath } from '@/lib/javari/internal-router';
//   const r = await craFetch('/api/credits/balance', { userId });
//   if (r.ok) { ... }

import { vault } from '@/lib/javari/secrets/vault';

// ── Configuration ─────────────────────────────────────────────────────────────

// Primary CRA URL — set via Vercel env var
// Fallback = latest known-good Vercel preview URL (updated on each stable deploy)
const CRA_PRIMARY   = process.env.NEXT_PUBLIC_CRA_URL ?? '';
const CRA_FALLBACK  = process.env.CRA_FALLBACK_URL
                   ?? 'https://craudiovizai-fgz0ait8y-roy-hendersons-projects-1d3d5e94.vercel.app';

// Primary JAI URL — for CRA→Javari calls
const JAI_PRIMARY   = process.env.NEXT_PUBLIC_APP_URL ?? '';
const JAI_FALLBACK  = process.env.JAI_FALLBACK_URL
                   ?? 'https://javari-ai.vercel.app';

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_ATTEMPTS     = 2;
const RETRY_BASE_MS      = 300;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InternalResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  ms: number;
  attempt: number;
  url: string;
  error?: string;
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  // Pass userId for credit/auth calls to carry user context
  userId?: string;
  // If true, adds Authorization: Bearer <CRON_SECRET> header
  useInternalAuth?: boolean;
}

// ── Internal secret header ────────────────────────────────────────────────────

function getInternalHeaders(opts: FetchOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-Request': 'true',
    'X-Request-Source': 'javari-ai',
  };

  // Internal secret for bypass of rate limiting on CRA side
  const secret = process.env.INTERNAL_API_SECRET ?? vault.get('github' as Parameters<typeof vault.get>[0])?.slice(-16) ?? '';
  if (secret) headers['X-Internal-Secret'] = secret;

  if (opts.useInternalAuth) {
    const cronSecret = process.env.CRON_SECRET ?? '';
    if (cronSecret) headers['Authorization'] = `Bearer ${cronSecret}`;
  }

  if (opts.userId) headers['X-User-Id'] = opts.userId;

  return { ...headers, ...(opts.headers ?? {}) };
}

// ── Core fetch with retry ─────────────────────────────────────────────────────

async function fetchWithRetry<T>(
  urls: string[],
  path: string,
  opts: FetchOptions = {}
): Promise<InternalResponse<T>> {
  const {
    method = 'GET',
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  const headers = getInternalHeaders(opts);
  let lastError = '';
  let attempt = 0;

  for (const baseUrl of urls) {
    for (let retry = 0; retry < RETRY_ATTEMPTS; retry++) {
      attempt++;
      const url = `${baseUrl}${path}`;
      const t0 = Date.now();

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const fetchOpts: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        };

        if (body && method !== 'GET') {
          fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const res = await fetch(url, fetchOpts);
        clearTimeout(timer);
        const ms = Date.now() - t0;

        let data: T;
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          data = await res.json() as T;
        } else {
          const text = await res.text();
          data = (text || null) as unknown as T;
        }

        // Success (including expected auth failures like 401)
        if (res.status < 500) {
          return { ok: res.ok, status: res.status, data, ms, attempt, url };
        }

        // 5xx — retry
        lastError = `HTTP ${res.status}`;

      } catch (err) {
        const ms = Date.now() - t0;
        lastError = err instanceof Error ? err.message : String(err);

        // Abort = timeout
        if (lastError.includes('abort') || lastError.includes('The operation was aborted')) {
          lastError = `timeout after ${ms}ms`;
        }
      }

      // Exponential backoff before retry
      if (retry < RETRY_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, retry)));
      }
    }
  }

  // All attempts failed
  return {
    ok: false,
    status: 0,
    data: null as unknown as T,
    ms: 0,
    attempt,
    url: urls[0] + path,
    error: lastError,
  };
}

// ── Public API — CRA calls ────────────────────────────────────────────────────

/**
 * Call the CRA platform API from javari-ai.
 * Automatically tries primary URL, then fallback URL.
 */
export async function craFetch<T = unknown>(
  path: string,
  opts: FetchOptions = {}
): Promise<InternalResponse<T>> {
  const urls = [CRA_PRIMARY, CRA_FALLBACK].filter(Boolean);
  if (urls.length === 0) {
    return {
      ok: false, status: 0, data: null as unknown as T, ms: 0, attempt: 0,
      url: path, error: 'No CRA URL configured — set NEXT_PUBLIC_CRA_URL in Vercel env vars',
    };
  }
  return fetchWithRetry<T>(urls, path, opts);
}

// ── Public API — JAI internal calls (CRA→Javari) ─────────────────────────────

/**
 * Call javari-ai from CRA (or from within javari-ai itself for self-calls).
 */
export async function jaiFetch<T = unknown>(
  path: string,
  opts: FetchOptions = {}
): Promise<InternalResponse<T>> {
  const urls = [JAI_PRIMARY, JAI_FALLBACK].filter(Boolean);
  if (urls.length === 0) {
    return {
      ok: false, status: 0, data: null as unknown as T, ms: 0, attempt: 0,
      url: path, error: 'No JAI URL configured — set NEXT_PUBLIC_APP_URL in Vercel env vars',
    };
  }
  return fetchWithRetry<T>(urls, path, opts);
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Check a user's credit balance via CRA. */
export async function getCreditBalance(userId: string): Promise<number> {
  const r = await craFetch<{ balance?: number; credits?: number }>('/api/credits/balance', {
    headers: { 'X-User-Id': userId },
    useInternalAuth: true,
  });
  if (!r.ok) return 0;
  return r.data?.balance ?? r.data?.credits ?? 0;
}

/** Spend credits via CRA central API. */
export async function spendCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  const r = await craFetch<{ success?: boolean; newBalance?: number; error?: string }>(
    '/api/credits/spend',
    {
      method: 'POST',
      body: { userId, amount, reason },
      useInternalAuth: true,
    }
  );
  if (!r.ok) return { ok: false, error: r.error ?? `HTTP ${r.status}` };
  if (!r.data?.success) return { ok: false, error: r.data?.error ?? 'spend rejected' };
  return { ok: true, newBalance: r.data.newBalance };
}

/** Log analytics event to CRA. Fire-and-forget — never throws. */
export async function logAnalyticsEvent(
  event: string,
  properties: Record<string, unknown> = {},
  userId?: string
): Promise<void> {
  try {
    await craFetch('/api/analytics/event', {
      method: 'POST',
      body: { event, properties, userId, source: 'javari-ai' },
      timeoutMs: 3_000, // Fast timeout — non-blocking
    });
  } catch {
    // Analytics failures are always non-fatal
  }
}

/** Verify a user session token via CRA auth. */
export async function verifySession(
  sessionToken: string
): Promise<{ valid: boolean; userId?: string; email?: string }> {
  const r = await craFetch<{ user?: { id?: string; email?: string } }>(
    '/api/auth/user',
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }
  );
  if (!r.ok || !r.data?.user) return { valid: false };
  return {
    valid: true,
    userId: r.data.user.id,
    email: r.data.user.email,
  };
}

// ── URL utilities ─────────────────────────────────────────────────────────────

/** Get the resolved CRA base URL (primary if set, fallback otherwise). */
export function getCraBaseUrl(): string {
  return CRA_PRIMARY || CRA_FALLBACK;
}

/** Get the resolved JAI base URL. */
export function getJaiBaseUrl(): string {
  return JAI_PRIMARY || JAI_FALLBACK;
}

/** Check if CRA is reachable. Returns { ok, url, ms }. */
export async function pingCra(): Promise<{ ok: boolean; url: string; ms: number; status: number }> {
  const r = await craFetch<unknown>('/api/auth/user', { timeoutMs: 5_000 });
  // 200 or 401 both mean CRA is up and responding
  const ok = r.status === 200 || r.status === 401 || r.status === 403;
  return { ok, url: r.url, ms: r.ms, status: r.status };
}
