// lib/autonomy-core/cron/schedule.ts
// CR AudioViz AI — Vercel Cron Integration for Autonomy Core
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Vercel cron job configuration is in vercel.json.
// This file exports the cron handler + timing config.

export const AUTONOMY_CORE_CRON_CONFIG = {
  // Vercel cron expression for every 15 minutes
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs
  cronExpression: "*/15 * * * *",
  endpoint:       "/api/autonomy-core/run",
  maxDuration:    120,        // seconds
  description:    "Javari Autonomy Core — continuous background monitoring + Ring 2 auto-fix",
};

// Cron schedule options (change via AUTONOMOUS_CORE_INTERVAL_MINUTES env var)
export const CRON_SCHEDULES: Record<number, string> = {
  5:  "*/5 * * * *",
  10: "*/10 * * * *",
  15: "*/15 * * * *",
  30: "*/30 * * * *",
  60: "0 * * * *",
};

export function getCronExpression(intervalMinutes: number): string {
  return CRON_SCHEDULES[intervalMinutes] ?? CRON_SCHEDULES[15];
}

// Vercel cron jobs require the endpoint to return 200 within maxDuration.
// The cron job is ONLY active when AUTONOMOUS_CORE_ENABLED=true AND
// the cron configuration is present in vercel.json.
// By default, vercel.json does NOT include this cron — must be added manually
// by Roy when ready to activate.

export const VERCEL_JSON_CRON_ADDITION = {
  // Add this to the "crons" array in vercel.json when ready to activate:
  path:     "/api/autonomy-core/run",
  schedule: "*/15 * * * *",
};
