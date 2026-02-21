// lib/launch/config.ts
// CR AudioViz AI — Launch Configuration Layer
// 2026-02-21 — STEP 9 Official Launch

import { canaryLog } from "@/lib/observability/logger";

// ── Launch phases ─────────────────────────────────────────────────────────────

export type LaunchPhase = "private" | "beta" | "public";

export interface LaunchConfig {
  phase:            LaunchPhase;
  launchMode:       boolean;       // true = public
  maintenanceMode:  boolean;       // true = 503 all non-admin
  degradedMode:     boolean;       // true = fallback models only
  canaryThreshold:  number;        // 0-100
  announcementText: string | null;
  featureFlags: {
    waitlistEnabled:     boolean;
    inviteOnly:          boolean;
    freeSignupEnabled:   boolean;
    moduleFactoryPublic: boolean;
    javariPublic:        boolean;
  };
}

// ── Singleton state (in-process) ──────────────────────────────────────────────

let _config: LaunchConfig = {
  phase:           "public",
  launchMode:      true,                           // ✅ LAUNCH_MODE = true (STEP 9)
  maintenanceMode: false,
  degradedMode:    false,
  canaryThreshold: 100,                            // full rollout
  announcementText: "🎉 CRAudioVizAI is officially live! Welcome to the future of creative AI.",
  featureFlags: {
    waitlistEnabled:     false,                    // open signup
    inviteOnly:          false,
    freeSignupEnabled:   true,
    moduleFactoryPublic: true,
    javariPublic:        true,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getLaunchConfig(): Readonly<LaunchConfig> {
  return _config;
}

export function getLaunchStatus(): {
  phase:       LaunchPhase;
  launchMode:  boolean;
  maintenance: boolean;
  degraded:    boolean;
  canary:      number;
  flags:       LaunchConfig["featureFlags"];
} {
  return {
    phase:       _config.phase,
    launchMode:  _config.launchMode,
    maintenance: _config.maintenanceMode,
    degraded:    _config.degradedMode,
    canary:      _config.canaryThreshold,
    flags:       _config.featureFlags,
  };
}

export function setLaunchMode(enabled: boolean): void {
  _config = { ..._config, launchMode: enabled, phase: enabled ? "public" : "beta" };
  canaryLog.info(`Launch mode ${enabled ? "ENABLED" : "DISABLED"}`);
}

export function setMaintenanceMode(enabled: boolean, reason?: string): void {
  _config = { ..._config, maintenanceMode: enabled };
  canaryLog.warn(`Maintenance mode ${enabled ? "ON" : "OFF"}${reason ? `: ${reason}` : ""}`);
}

export function setDegradedMode(enabled: boolean): void {
  _config = { ..._config, degradedMode: enabled };
  canaryLog.warn(`Degraded mode ${enabled ? "ON" : "OFF"}`);
}

export function setCanaryThreshold(pct: number): void {
  const clamped = Math.max(0, Math.min(100, pct));
  _config = { ..._config, canaryThreshold: clamped };
  canaryLog.info(`Canary threshold set to ${clamped}%`);
}

export function setAnnouncement(text: string | null): void {
  _config = { ..._config, announcementText: text };
}

// ── Release gating ────────────────────────────────────────────────────────────

export function isFeatureGated(feature: keyof LaunchConfig["featureFlags"]): boolean {
  return !_config.featureFlags[feature];
}

export function canAccess(phase: LaunchPhase): boolean {
  const order: LaunchPhase[] = ["private", "beta", "public"];
  return order.indexOf(_config.phase) >= order.indexOf(phase);
}

// ── Domain readiness ──────────────────────────────────────────────────────────

export const PRODUCTION_DOMAINS = [
  "craudiovizai.com",
  "www.craudiovizai.com",
  "beta.craudiovizai.com",
  "app.craudiovizai.com",
];

export function isDomainReady(host: string): boolean {
  return PRODUCTION_DOMAINS.some(
    (d) => host === d || host.endsWith(`.${d}`) || host.includes("vercel.app")
  );
}

// ── Canary thresholds ─────────────────────────────────────────────────────────

export const CANARY_STAGES = {
  seed:   1,
  early:  5,
  growth: 25,
  full:   100,
} as const;

export type CanaryStageKey = keyof typeof CANARY_STAGES;
