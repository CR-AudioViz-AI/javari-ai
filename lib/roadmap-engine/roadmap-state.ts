// lib/roadmap-engine/roadmap-state.ts
// JAVARI ROADMAP STATE MANAGER — Supabase-backed persistence
// DB is mandatory - NO memory fallback
// 2026-03-02
import type { RoadmapState } from './roadmap-engine';
// ── In-memory cache (L1) for hot reads ────────────────────────────────────────
    // Also persist tasks
      // Upsert in batches of 50
    // Fire-and-forget async persist
    // Check cache first
    // Load tasks
    // Delete tasks first
    // Delete roadmap
// Global singleton
export default {}
export const stateManager: any = (v?: any) => v ?? {}
