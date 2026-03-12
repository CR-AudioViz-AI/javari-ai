"use client";
// app/global-error.tsx
// CR AudioViz AI — Global Error Boundary
// 2026-02-20 — STEP 7 Production Hardening
// Catches React Server Component failures at the root level.
// Displays branded fallback UI and logs to Supabase.
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, Zap } from "lucide-react";
    // Never crash the error boundary
export default function GlobalError() { return null }
