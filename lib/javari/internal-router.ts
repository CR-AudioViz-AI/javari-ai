// lib/javari/internal-router.ts
// Javari ↔ CRA Internal API Router
// 2026-02-20 — JAVARI_PATCH fix_connectivity_and_branding
// Solves: cross-origin timeouts when javari-ai serverless functions call craudiovizai.com
// Strategy:
//   1. Uses NEXT_PUBLIC_CRA_URL env var (set in Vercel) — stable preview URL or craudiovizai.com
//   2. Falls back to known-good Vercel preview URL if primary fails
//   3. Retry with exponential backoff (2 attempts, 300ms base)
//   4. All internal calls carry X-Internal-Secret header for bypass of rate limiting
//   5. Never throws — always returns { ok, status, data, ms, attempt, url }
// Usage:
//   import { craFetch, jaiPath } from '@/lib/javari/internal-router';
//   const r = await craFetch('/api/credits/balance', { userId });
//   if (r.ok) { ... }
import { vault } from '@/lib/javari/secrets/vault';
// ── Configuration ─────────────────────────────────────────────────────────────
// Primary CRA URL — set via Vercel env var
// Fallback = latest known-good Vercel preview URL (updated on each stable deploy)
// Primary JAI URL — for CRA→Javari calls
// ── Types ─────────────────────────────────────────────────────────────────────
export interface InternalResponse<T = unknown> {
export interface FetchOptions {
  // Pass userId for credit/auth calls to carry user context
  // If true, adds Authorization: Bearer <CRON_SECRET> header
// ── Internal secret header ────────────────────────────────────────────────────
  // Internal secret — always sent for CRA internal route bypass
// ── Core fetch with retry ─────────────────────────────────────────────────────
        // Success (including expected auth failures like 401)
        // 5xx — retry
        // Abort = timeout
      // Exponential backoff before retry
  // All attempts failed
// ── Public API — CRA calls ────────────────────────────────────────────────────
// ── Public API — JAI internal calls (CRA→Javari) ─────────────────────────────
// ── Convenience helpers ───────────────────────────────────────────────────────
    // Analytics failures are always non-fatal
// ── URL utilities ─────────────────────────────────────────────────────────────
  // 200 or 401 both mean CRA is up and responding
export default {}
