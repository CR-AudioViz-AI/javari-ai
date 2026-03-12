// lib/platform-secrets/env-shim.ts
// CR AudioViz AI — Platform Secret Authority: process.env Shim
// 2026-02-22
// Wraps process.env with a Proxy at Node.js startup.
// Any read of a non-bootstrap key transparently returns the cached
// vault value — meaning all 318+ existing files using process.env
// automatically get vault-sourced values with zero file changes.
// Bootstrap keys (required before vault is reachable) are always
// passed through directly to the real process.env without interception.
// Call installEnvShim() once from instrumentation.ts register().
// Call warmEnvShim() after the shim is installed to pre-populate cache.
import { getSecretSync, warmSecrets, cacheStats } from "./getSecret";
// ── Bootstrap keys — never intercepted ───────────────────────────────────────
// These must come from Vercel env vars to bootstrap the vault connection itself.
  // Vault bootstrap — must be in Vercel env vars, not in the vault itself
// ── Shim state ────────────────────────────────────────────────────────────────
// ── Install ───────────────────────────────────────────────────────────────────
      // Non-string keys (Symbol, etc.) — pass through
      // Bootstrap keys — always real env
      // Try vault cache first (synchronous — populated by warmEnvShim)
      // Fall through to real process.env during warm-up / transition
  // Replace the global process.env reference
// ── Warm ──────────────────────────────────────────────────────────────────────
// Pre-populates the in-process cache for the most critical secrets.
// After this runs, shim reads are cache hits — zero DB latency.
  // AI routing
  // Payments
  // Infrastructure
  // Auth + internal
  // Media
  // Analytics
// ── Diagnostics ───────────────────────────────────────────────────────────────
export default {}
