// lib/errors/handler.ts
// CR AudioViz AI — Safe API Handler Wrapper
// 2026-02-20 — STEP 7 Production Hardening
//
// safeHandler() wraps any Next.js API route handler with:
//   - Typed error catching
//   - Auto traceID injection
//   - Structured error logging to Supabase
//   - Request metadata capture

import { NextRequest, NextResponse } from "next/server";
import { ApiError, generateTraceId, serialiseError } from "./api-error";

// ── Log to Supabase (non-blocking) ──────────────────────────────────────────

async function logErrorToSupabase(opts: {
  traceId:   string;
  code:      string;
  message:   string;
  path:      string;
  method:    string;
  userId?:   string;
  stack?:    string;
  details?:  Record<string, unknown>;
}): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    // Fire-and-forget insert into error_logs table
    void fetch(`${url}/rest/v1/error_logs`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({
        trace_id:   opts.traceId,
        error_code: opts.code,
        message:    opts.message,
        path:       opts.path,
        method:     opts.method,
        user_id:    opts.userId ?? null,
        stack_hint: opts.stack ?? null,
        details:    opts.details ?? null,
      }),
    });
  } catch {
    // Logging must never crash the request
  }
}

// ── safeHandler() ────────────────────────────────────────────────────────────

type RouteHandler<T = NextRequest> = (req: T, ctx?: unknown) => Promise<NextResponse>;

export function safeHandler(
  handler:  RouteHandler,
  options?: { userId?: (req: NextRequest) => string | undefined }
): RouteHandler {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    const traceId = generateTraceId("req");
    const path    = new URL(req.url).pathname;
    const method  = req.method;

    // Inject traceId into request headers for downstream use
    const headers = new Headers(req.headers);
    headers.set("x-trace-id", traceId);

    try {
      const response = await handler(req, ctx);
      // Attach traceId to every successful response too
      response.headers.set("X-Trace-Id", traceId);
      return response;
    } catch (err) {
      const userId = options?.userId?.(req);

      if (err instanceof ApiError) {
        // Structured API error
        void logErrorToSupabase({
          traceId: err.traceId,
          code:    err.code,
          message: err.message,
          path,
          method,
          userId,
          details: err.details,
        });
        return err.toResponse();
      }

      // Unexpected error
      const { message, stack } = serialiseError(err);
      void logErrorToSupabase({
        traceId,
        code:    "INTERNAL_ERROR",
        message,
        path,
        method,
        userId,
        stack,
      });

      console.error(`[safeHandler] Unhandled error on ${method} ${path} (${traceId}):`, err);

      return NextResponse.json(
        {
          success: false,
          error:   "An unexpected error occurred",
          code:    "INTERNAL_ERROR",
          traceId,
        },
        {
          status:  500,
          headers: {
            "X-Trace-Id":   traceId,
            "X-Error-Code": "INTERNAL_ERROR",
          },
        }
      );
    }
  };
}

// ── Route-level error wrapper (for use inside handlers) ──────────────────────

export function withTraceId(req: NextRequest): string {
  return req.headers.get("x-trace-id") ?? generateTraceId("ext");
}
