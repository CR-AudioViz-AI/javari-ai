// lib/security/rate-limit.ts
// CR AudioViz AI — Rate Limiter
// 2026-02-20 — STEP 7 Production Hardening
// IP-based and user-based rate limiting with sliding window.
// Autonomous engine bypasses with INTERNAL_SERVICE_KEY.
// Returns 429 with Retry-After header.
import { NextRequest, NextResponse } from "next/server";
import { rateLimitLog } from "@/lib/observability/logger";
// ── Config ───────────────────────────────────────────────────────────────────
export interface RateLimitConfig {
  // Public endpoints
  // Authenticated user endpoints
  // AI-heavy endpoints (chat, autonomy, factory)
  // Billing endpoints
  // Auth endpoints (strict)
// ── Internal service key (autonomous engine bypass) ───────────────────────────
// ── In-memory sliding window store ───────────────────────────────────────────
// Note: This resets on cold starts. For persistent rate limiting in production,
// replace with Vercel KV or Upstash Redis.
  // New or expired window
// Cleanup stale entries every 5 min
// ── Core check ────────────────────────────────────────────────────────────────
export interface RateLimitResult {
// ── Middleware helper ─────────────────────────────────────────────────────────
  // Extract userId from auth header or cookie (best-effort)
// ── Route-level guard (use in API handlers) ────────────────────────────────────
export default {}
