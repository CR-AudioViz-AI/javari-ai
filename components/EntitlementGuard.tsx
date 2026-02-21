"use client";
// components/EntitlementGuard.tsx
// CR AudioViz AI — Entitlement Guard UI Component
// 2026-02-20 — STEP 6 Productization
//
// Wraps any feature with an entitlement check.
// If user lacks access → shows upgrade overlay, prevents interaction.
// Integrates with Module Factory & Autonomy UI.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Lock, ArrowRight, Loader2, Crown, Sparkles } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntitlementFeature =
  | "chat"
  | "autonomy_basic"
  | "autonomy_advanced"
  | "multi_ai_team"
  | "module_factory"
  | "db_schema_generation"
  | "priority_routing"
  | "white_label"
  | "sla_support";

export type EntitlementStatus =
  | "loading"
  | "allowed"
  | "insufficient_tier"
  | "insufficient_credits"
  | "error";

export interface EntitlementResult {
  status:   EntitlementStatus;
  tier?:    string;
  balance?: number;
  message?: string;
  upgradeUrl?: string;
  requiredTier?: string;
}

interface EntitlementGuardProps {
  /** Feature to gate */
  feature: EntitlementFeature;
  /** User ID — if not provided, skips check (guest mode) */
  userId?: string;
  /** Children to render when allowed */
  children: React.ReactNode;
  /** Render a custom fallback instead of the default upgrade overlay */
  fallback?: React.ReactNode;
  /** Show a subtle inline badge instead of full overlay */
  inline?: boolean;
  /** Feature display name for the upgrade prompt */
  featureName?: string;
  /** Required tier display name */
  requiredTierName?: string;
  /** Pre-resolved status — skip fetching (server-side resolved) */
  initialStatus?: EntitlementResult;
}

// ── Tier upgrade map ──────────────────────────────────────────────────────────

const FEATURE_TIER_MAP: Record<EntitlementFeature, { tier: string; label: string }> = {
  chat:                 { tier: "free",       label: "Free" },
  autonomy_basic:       { tier: "free",       label: "Free" },
  autonomy_advanced:    { tier: "pro",        label: "Pro" },
  multi_ai_team:        { tier: "creator",    label: "Creator" },
  module_factory:       { tier: "creator",    label: "Creator" },
  db_schema_generation: { tier: "pro",        label: "Pro" },
  priority_routing:     { tier: "pro",        label: "Pro" },
  white_label:          { tier: "enterprise", label: "Enterprise" },
  sla_support:          { tier: "enterprise", label: "Enterprise" },
};

// ── Overlay variants ──────────────────────────────────────────────────────────

function UpgradeOverlay({
  featureName,
  requiredTierName,
  message,
}: {
  featureName:     string;
  requiredTierName: string;
  message?:        string;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-inherit">
      <div className="text-center max-w-xs px-6">
        <div className="w-12 h-12 bg-blue-900/40 border border-blue-700/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-blue-400" />
        </div>
        <h3 className="font-bold text-lg mb-2">{featureName} requires {requiredTierName}</h3>
        <p className="text-slate-400 text-sm mb-5">
          {message ?? `Upgrade to ${requiredTierName} or higher to access this feature.`}
        </p>
        <Link
          href={`/pricing`}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all"
        >
          <Crown className="w-4 h-4" />
          Upgrade Plan
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function InsufficientCreditsOverlay({ balance }: { balance?: number }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-inherit">
      <div className="text-center max-w-xs px-6">
        <div className="w-12 h-12 bg-amber-900/40 border border-amber-700/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="font-bold text-lg mb-2">Insufficient Credits</h3>
        <p className="text-slate-400 text-sm mb-5">
          You have {balance ?? 0} credits remaining. Top up or upgrade your plan to continue.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/account/billing" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-4 py-2 text-sm transition-all">
            Top Up
          </Link>
          <Link href="/pricing" className="text-slate-400 hover:text-white text-sm underline underline-offset-2">
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}

function InlineBadge({ featureName, requiredTierName }: { featureName: string; requiredTierName: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium px-2.5 py-1 rounded-full">
      <Lock className="w-3 h-3" />
      {requiredTierName}+ required
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntitlementGuard({
  feature,
  userId,
  children,
  fallback,
  inline = false,
  featureName,
  requiredTierName,
  initialStatus,
}: EntitlementGuardProps) {
  const [result, setResult] = useState<EntitlementResult>(
    initialStatus ?? { status: userId ? "loading" : "allowed" }
  );

  const tierInfo       = FEATURE_TIER_MAP[feature];
  const displayName    = featureName     ?? feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const displayTier    = requiredTierName ?? tierInfo?.label ?? "Pro";

  const checkEntitlement = useCallback(async () => {
    if (!userId || initialStatus) return;
    try {
      const r = await fetch(`/api/billing/entitlement?userId=${userId}&feature=${feature}`);
      const d = await r.json();
      setResult({
        status:       d.allowed ? "allowed" : "insufficient_tier",
        tier:         d.tier,
        balance:      d.balance,
        message:      d.message,
        requiredTier: d.requiredTier,
        upgradeUrl:   "/pricing",
      });
    } catch {
      // Fail open — don't block UI on network error
      setResult({ status: "allowed" });
    }
  }, [userId, feature, initialStatus]);

  useEffect(() => {
    checkEntitlement();
  }, [checkEntitlement]);

  // Loading state
  if (result.status === "loading") {
    return (
      <div className="relative">
        {children}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 rounded-inherit">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Allowed — render normally
  if (result.status === "allowed") {
    return <>{children}</>;
  }

  // Custom fallback
  if (fallback) return <>{fallback}</>;

  // Inline badge (minimal)
  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="opacity-40 pointer-events-none">{children}</span>
        <InlineBadge featureName={displayName} requiredTierName={displayTier} />
      </span>
    );
  }

  // Insufficient credits overlay
  if (result.status === "insufficient_credits") {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none">{children}</div>
        <InsufficientCreditsOverlay balance={result.balance} />
      </div>
    );
  }

  // Full upgrade overlay (default)
  return (
    <div className="relative">
      <div className="opacity-20 pointer-events-none select-none">{children}</div>
      <UpgradeOverlay
        featureName={displayName}
        requiredTierName={displayTier}
        message={result.message}
      />
    </div>
  );
}

// ── Hook variant for imperative use ──────────────────────────────────────────

export function useEntitlement(
  feature: EntitlementFeature,
  userId?: string
): { allowed: boolean; loading: boolean; result: EntitlementResult } {
  const [result, setResult] = useState<EntitlementResult>({
    status: userId ? "loading" : "allowed",
  });

  useEffect(() => {
    if (!userId) {
      setResult({ status: "allowed" });
      return;
    }
    fetch(`/api/billing/entitlement?userId=${userId}&feature=${feature}`)
      .then((r) => r.json())
      .then((d) => setResult({
        status:  d.allowed ? "allowed" : "insufficient_tier",
        tier:    d.tier,
        balance: d.balance,
        message: d.message,
      }))
      .catch(() => setResult({ status: "allowed" })); // fail open
  }, [feature, userId]);

  return {
    allowed: result.status === "allowed",
    loading: result.status === "loading",
    result,
  };
}

export default EntitlementGuard;
