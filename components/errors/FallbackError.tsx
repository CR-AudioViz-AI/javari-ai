"use client";
// components/errors/FallbackError.tsx
// CR AudioViz AI — Component-level Fallback Error UI
// 2026-02-20 — STEP 7 Production Hardening

import { AlertTriangle, RefreshCw } from "lucide-react";

interface FallbackErrorProps {
  title?:     string;
  message?:   string;
  traceId?:   string;
  onRetry?:   () => void;
  compact?:   boolean;
}

export function FallbackError({
  title    = "Something went wrong",
  message  = "This section failed to load. Please try again.",
  traceId,
  onRetry,
  compact  = false,
}: FallbackErrorProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl
                      bg-red-900/20 border border-red-700/40 text-sm">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-red-200 flex-1">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-xs text-red-300 hover:text-white
                       transition-colors ml-2 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-5">
      <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/40
                      flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm max-w-sm">{message}</p>
        {traceId && (
          <p className="mt-2 text-xs text-slate-600 font-mono">ref: {traceId}</p>
        )}
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-slate-800 hover:bg-slate-700 text-white font-medium
                     text-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

export default FallbackError;
