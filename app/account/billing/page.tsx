"use client";
// app/account/billing/page.tsx
// CR AudioViz AI — Account Billing Page
// 2026-02-20 — STEP 6 Productization

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard, Zap, Crown, ArrowLeft, ArrowRight,
  RefreshCw, AlertTriangle, CheckCircle, ExternalLink,
  Building2, Star
} from "lucide-react";

interface BillingData {
  subscription?: {
    tier:               string;
    status:             string;
    currentPeriodEnd?:  string;
    creditsPerCycle:    number;
    cancelAtPeriodEnd?: boolean;
  };
  balance?:   number;
  tier?:      string;
  features?:  string[];
  tiers?: Array<{
    tier:            string;
    label:           string;
    priceMonthlyUsd: number;
    creditsPerCycle: number;
    description:     string;
  }>;
}

const TIER_ICONS: Record<string, React.ElementType> = {
  free: Zap, creator: Star, pro: Crown, enterprise: Building2,
};

const TIER_COLORS: Record<string, string> = {
  free:       "text-slate-400",
  creator:    "text-blue-400",
  pro:        "text-purple-400",
  enterprise: "text-yellow-400",
};

export default function BillingPage() {
  const [data,    setData]    = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      // Try auth'd subscription endpoint first
      const subRes = await fetch("/api/billing/subscription");
      if (subRes.ok) {
        const d = await subRes.json();
        setData(d);
      } else if (subRes.status === 401) {
        setError("sign_in");
      }

      // Always load public tiers for comparison
      const tiersRes = await fetch("/api/billing/subscription?tiers=true");
      if (tiersRes.ok) {
        const t = await tiersRes.json();
        setData((prev) => ({ ...prev, tiers: t.tiers }));
      }
    } catch {
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(tier: string) {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const d = await res.json();
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
      } else if (d.success) {
        await load();
      }
    } catch {
      // Fallback to pricing page
      window.location.href = `/pricing`;
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </main>
    );
  }

  if (error === "sign_in") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to manage billing</h2>
          <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 text-sm">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const currentTier  = data?.tier ?? "free";
  const TierIcon     = TIER_ICONS[currentTier] ?? Zap;
  const tierColor    = TIER_COLORS[currentTier] ?? "text-slate-400";
  const credBal      = data?.balance ?? 0;
  const credPerCycle = data?.subscription?.creditsPerCycle ?? 100;
  const renewDate    = data?.subscription?.currentPeriodEnd
    ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/account" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Billing & Plan</h1>
            <p className="text-slate-400 text-sm">Manage your subscription and credits</p>
          </div>
        </div>

        {/* Current plan */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Current Plan</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
              <TierIcon className={`w-6 h-6 ${tierColor}`} />
            </div>
            <div>
              <p className="text-xl font-bold capitalize">{currentTier} Plan</p>
              <p className="text-slate-400 text-sm">{credPerCycle.toLocaleString()} credits/month</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                data?.subscription?.status === "active"
                  ? "bg-green-900/50 text-green-300 border border-green-700/40"
                  : "bg-slate-700 text-slate-300"
              }`}>
                {data?.subscription?.status ?? "active"}
              </span>
              {renewDate && (
                <span className="text-xs text-slate-500">Renews {renewDate}</span>
              )}
            </div>
          </div>

          {/* Credit balance */}
          <div className="flex items-center justify-between py-4 border-t border-slate-800">
            <div>
              <p className="text-sm text-slate-400">Credit Balance</p>
              <p className="text-2xl font-black text-blue-400">{credBal.toLocaleString()}</p>
            </div>
            <Link
              href="/account/usage"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              View Usage <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {data?.subscription?.cancelAtPeriodEnd && (
            <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Your plan is set to cancel at the end of this period. Reactivate to keep access.
            </div>
          )}
        </div>

        {/* Upgrade options */}
        {data?.tiers && data.tiers.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Available Plans</h2>
            <div className="space-y-3">
              {data.tiers
                .filter((t) => t.tier !== currentTier)
                .map((t) => {
                  const Icon  = TIER_ICONS[t.tier] ?? Zap;
                  const color = TIER_COLORS[t.tier] ?? "text-slate-400";
                  const isFree = t.priceMonthlyUsd === 0;
                  const tierOrder: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
                  const isUpgrade = tierOrder[t.tier] > tierOrder[currentTier];

                  return (
                    <div
                      key={t.tier}
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{t.label}</p>
                          <p className="text-xs text-slate-400">
                            {isFree ? "Free" : `$${t.priceMonthlyUsd}/mo`} · {t.creditsPerCycle.toLocaleString()} credits
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => isUpgrade ? handleUpgrade(t.tier) : undefined}
                        disabled={upgrading || !isUpgrade}
                        className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                          isUpgrade
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                            : "bg-slate-700 text-slate-400 cursor-default"
                        }`}
                      >
                        {!isUpgrade ? "Downgrade" : upgrading ? "…" : "Upgrade"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Billing portal */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Billing Management</h2>
          <div className="space-y-3">
            <a
              href="/api/billing/portal"
              className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-sm">Manage Payment Method</p>
                  <p className="text-xs text-slate-400">Update card, view invoices</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </a>

            {data?.subscription?.status === "active" && currentTier !== "free" && (
              <button className="flex items-center gap-3 w-full p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors text-left">
                <AlertTriangle className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-medium text-sm text-slate-300">Cancel Subscription</p>
                  <p className="text-xs text-slate-400">Cancels at end of billing period</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
