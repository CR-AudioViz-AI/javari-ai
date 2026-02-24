"use client";
// app/global-error.tsx
// CR AudioViz AI — Global Error Boundary
// 2026-02-20 — STEP 7 Production Hardening
//
// Catches React Server Component failures at the root level.
// Displays branded fallback UI and logs to Supabase.

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, Zap } from "lucide-react";

interface GlobalErrorProps {
  error:  Error & { digest?: string };
  reset:  () => void;
}

async function logErrorToSupabase(error: Error & { digest?: string }): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    await fetch(`${url}/rest/v1/error_logs`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({
        trace_id:   error.digest ?? `ui_${Date.now().toString(36)}`,
        error_code: "REACT_BOUNDARY",
        message:    error.message || "Unknown render error",
        path:       typeof window !== "undefined" ? window.location.pathname : "/",
        method:     "RENDER",
        stack_hint: error.stack?.split("\n")[1]?.trim() ?? null,
        details:    { digest: error.digest ?? null },
      }),
    });
  } catch {
    // Never crash the error boundary
  }
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    void logErrorToSupabase(error);
    console.error("[GlobalError] Boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-8">

          {/* Brand mark */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">CR AudioViz AI</span>
          </div>

          {/* Error icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-red-900/30 border border-red-700/40
                          flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>

          {/* Message */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-400 leading-relaxed">
              An unexpected error occurred. Our team has been notified automatically.
              You can try refreshing the page or return to the home screen.
            </p>
            {error.digest && (
              <p className="mt-3 text-xs text-slate-600 font-mono">
                Error reference: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                         bg-blue-600 hover:bg-blue-500 text-white font-semibold
                         transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                         border border-slate-700 hover:border-slate-500 text-slate-300
                         font-semibold transition-all"
            >
              <Home className="w-4 h-4" />
              Go Home
            </a>
          </div>

          {/* Status link */}
          <p className="text-xs text-slate-600">
            Check{" "}
            <a href="/api/health" className="text-slate-400 hover:text-white underline">
              system status
            </a>{" "}
            if this persists
          </p>
        </div>
      </body>
    </html>
  );
}
