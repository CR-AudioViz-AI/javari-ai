// lib/launch/changelog.ts
// CR AudioViz AI — Changelog System
// 2026-02-21 — STEP 9 Official Launch

import { track } from "@/lib/analytics/track";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChangeType = "feature" | "improvement" | "fix" | "security" | "breaking";

export interface ChangeEntry {
  id:          string;
  version:     string;
  date:        string;
  title:       string;
  summary:     string;
  type:        ChangeType;
  highlights?: string[];
  module?:     string;
}

// ── Changelog entries ─────────────────────────────────────────────────────────

export const CHANGELOG: ChangeEntry[] = [
  {
    id:      "v9-launch",
    version: "v9.0 — Official Public Launch",
    date:    "2026-02-21",
    title:   "CRAudioVizAI is Live 🎉",
    summary: "Official public launch of CRAudioVizAI + Javari AI. Full platform now open to all users.",
    type:    "feature",
    highlights: [
      "Public launch — open signup enabled",
      "Javari AI autonomy engine fully operational",
      "Module Factory with comprehensive library of templates",
      "Multi-AI team routing (Anthropic, OpenAI, Google, OpenRouter)",
      "Revenue system: Free, Creator, Pro, Enterprise tiers",
      "Beta checklist: 12/12 checks passing",
      "Launch mode activated — LAUNCH_MODE = true",
    ],
  },
  {
    id:      "v8-beta",
    version: "v8.0 — Public Beta",
    date:    "2026-02-20",
    title:   "Public Beta Launch",
    summary: "Opened beta access. Added legal pages, press kit, invite system, and go-live pipeline.",
    type:    "feature",
    highlights: [
      "Beta landing page + waitlist system",
      "Privacy Policy, Terms of Service, Cookie Policy",
      "Press kit + brand assets",
      "Domain routing for craudiovizai.com",
      "Release pipeline with rollback triggers",
      "Alert + escalation system",
    ],
  },
  {
    id:      "v7-hardening",
    version: "v7.0 — Production Hardening",
    date:    "2026-02-20",
    title:   "Production-Grade Resilience",
    summary: "Added observability, rate limiting, canary releases, error boundaries, and analytics.",
    type:    "improvement",
    highlights: [
      "Global React error boundary",
      "Structured JSON observability logger",
      "IP + user-based rate limiting (30/60/120 req/min)",
      "Canary rollout system (1% → 5% → 25% → 100%)",
      "Analytics events tracking pipeline",
      "Health probes: /api/health/live + /api/health/ready",
    ],
  },
  {
    id:      "v6-product",
    version: "v6.0 — Productization",
    date:    "2026-02-20",
    title:   "Full Product Suite",
    summary: "Complete pricing, onboarding, billing UI, usage dashboards, and module marketplace.",
    type:    "feature",
    highlights: [
      "Pricing page + tier comparison",
      "Module Store with detail pages",
      "Account billing + usage dashboards",
      "EntitlementGuard component",
      "Email templates (welcome, upgrade, billing alerts)",
    ],
  },
  {
    id:      "v5-billing",
    version: "v5.0 — Revenue System",
    date:    "2026-02-19",
    title:   "Full Billing Integration",
    summary: "Stripe + PayPal billing, credit system, metering, and entitlements.",
    type:    "feature",
    highlights: [
      "Credit system with expiry and grants",
      "Tier-based entitlements",
      "Usage metering + cost tracking",
      "Subscription management API",
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getLatestVersion(): ChangeEntry {
  return CHANGELOG[0];
}

export function getChangelogSince(date: string): ChangeEntry[] {
  return CHANGELOG.filter((e) => e.date >= date);
}

export function getWhatsNew(): { version: string; highlights: string[] } {
  const latest = getLatestVersion();
  return {
    version:    latest.version,
    highlights: latest.highlights ?? [latest.summary],
  };
}

export function trackChangelogView(userId?: string): void {
  track({ event: "page_view", userId, properties: { page: "changelog", version: getLatestVersion().version } });
}
