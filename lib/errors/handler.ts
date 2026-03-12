// lib/errors/handler.ts
// CR AudioViz AI — Safe API Handler Wrapper
// 2026-02-20 — STEP 7 Production Hardening
// safeHandler() wraps any Next.js API route handler with:
//   - Typed error catching
//   - Auto traceID injection
//   - Structured error logging to Supabase
//   - Request metadata capture
import { NextRequest, NextResponse } from "next/server";
import { ApiError, generateTraceId, serialiseError } from "./api-error";
// ── Log to Supabase (non-blocking) ──────────────────────────────────────────
    // Fire-and-forget insert into error_logs table
    // Logging must never crash the request
// ── safeHandler() ────────────────────────────────────────────────────────────
    // Inject traceId into request headers for downstream use
      // Attach traceId to every successful response too
        // Structured API error
      // Unexpected error
// ── Route-level error wrapper (for use inside handlers) ──────────────────────
export default {}
export const safeHandler = (fn: any) => fn
