// lib/errors/api-error.ts
// CR AudioViz AI — Typed API Error Class
// 2026-02-20 — STEP 7 Production Hardening
//
// Provides typed errors, entropy-based traceIDs, and structured logging stubs.
// Used by all API routes via safeHandler() wrapper.

import { NextRequest, NextResponse } from "next/server";

// ── TraceID ─────────────────────────────────────────────────────────────────

let _counter = 0;
export function generateTraceId(prefix = "api"): string {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const seq  = (++_counter).toString(36).padStart(3, "0");
  return `${prefix}_${ts}_${rand}_${seq}`;
}

// ── Error codes ──────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "INSUFFICIENT_CREDITS"
  | "INSUFFICIENT_TIER"
  | "PROVIDER_ERROR"
  | "PROVIDER_OUTAGE"
  | "DB_ERROR"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "SERVICE_DEGRADED"
  | "TIMEOUT";

const STATUS_MAP: Record<ApiErrorCode, number> = {
  UNAUTHORIZED:          401,
  FORBIDDEN:             403,
  NOT_FOUND:             404,
  BAD_REQUEST:           400,
  RATE_LIMITED:          429,
  INSUFFICIENT_CREDITS:  402,
  INSUFFICIENT_TIER:     403,
  PROVIDER_ERROR:        502,
  PROVIDER_OUTAGE:       503,
  DB_ERROR:              503,
  VALIDATION_ERROR:      422,
  INTERNAL_ERROR:        500,
  SERVICE_DEGRADED:      503,
  TIMEOUT:               504,
};

// ── ApiError class ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly code:       ApiErrorCode;
  readonly httpStatus: number;
  readonly traceId:    string;
  readonly details?:   Record<string, unknown>;
  readonly retryAfter?: number; // seconds

  constructor(opts: {
    code:        ApiErrorCode;
    message:     string;
    traceId?:    string;
    details?:    Record<string, unknown>;
    retryAfter?: number;
  }) {
    super(opts.message);
    this.name        = "ApiError";
    this.code        = opts.code;
    this.httpStatus  = STATUS_MAP[opts.code] ?? 500;
    this.traceId     = opts.traceId ?? generateTraceId("err");
    this.details     = opts.details;
    this.retryAfter  = opts.retryAfter;
  }

  toResponse(): NextResponse {
    const headers: Record<string, string> = {
      "Content-Type":      "application/json",
      "X-Trace-Id":        this.traceId,
      "X-Error-Code":      this.code,
    };
    if (this.retryAfter) headers["Retry-After"] = String(this.retryAfter);

    return NextResponse.json(
      {
        success:  false,
        error:    this.message,
        code:     this.code,
        traceId:  this.traceId,
        details:  this.details ?? null,
      },
      { status: this.httpStatus, headers }
    );
  }

  // Convenience factory methods
  static unauthorized(msg = "Unauthorized",               tid?: string) { return new ApiError({ code: "UNAUTHORIZED",          message: msg, traceId: tid }); }
  static forbidden   (msg = "Forbidden",                  tid?: string) { return new ApiError({ code: "FORBIDDEN",             message: msg, traceId: tid }); }
  static notFound    (msg = "Not found",                  tid?: string) { return new ApiError({ code: "NOT_FOUND",             message: msg, traceId: tid }); }
  static badRequest  (msg = "Bad request", det?: Record<string, unknown>, tid?: string) { return new ApiError({ code: "BAD_REQUEST", message: msg, traceId: tid, details: det }); }
  static rateLimited (retry = 60,                         tid?: string) { return new ApiError({ code: "RATE_LIMITED",          message: "Too many requests", traceId: tid, retryAfter: retry }); }
  static credits     (msg = "Insufficient credits",       tid?: string) { return new ApiError({ code: "INSUFFICIENT_CREDITS",  message: msg, traceId: tid }); }
  static outage      (provider: string,                   tid?: string) { return new ApiError({ code: "PROVIDER_OUTAGE",       message: `${provider} is currently unavailable`, traceId: tid }); }
  static internal    (msg = "Internal server error",      tid?: string) { return new ApiError({ code: "INTERNAL_ERROR",        message: msg, traceId: tid }); }
  static degraded    (msg = "Service temporarily degraded", tid?: string) { return new ApiError({ code: "SERVICE_DEGRADED",    message: msg, traceId: tid }); }
}

// ── safeJson() ───────────────────────────────────────────────────────────────
// Wraps any JSON response building in a try/catch

export function safeJson(
  data:    unknown,
  status = 200,
  extra:   Record<string, string> = {}
): NextResponse {
  try {
    return NextResponse.json(data, { status, headers: extra });
  } catch (e) {
    const tid = generateTraceId("json-err");
    console.error(`[safeJson] Serialisation failed (${tid}):`, e);
    return NextResponse.json(
      { success: false, error: "Response serialisation failed", traceId: tid },
      { status: 500 }
    );
  }
}

// ── Error serialiser (for non-ApiError) ──────────────────────────────────────

export function serialiseError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack?.split("\n")[1]?.trim() };
  if (typeof err === "string") return { message: err };
  return { message: "Unknown error" };
}
