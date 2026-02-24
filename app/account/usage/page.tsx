"use client";
// app/account/usage/page.tsx
// CR AudioViz AI — Usage Dashboard
// 2026-02-20 — STEP 6 Productization
//
// Shows: daily usage, AI model cost breakdown, credits remaining, entitlements

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3, Zap, TrendingUp, AlertTriangle,
  RefreshCw, ArrowLeft, CheckCircle, XCircle
} from "lucide-react";

interface UsageSummary {
  date:              string;
  totalCalls:        number;
  totalCredits:      number;
  totalTokens:       number;
  byFeature:         Record<string, number>;
  byModel:           Record<string, { calls: number; tokens: number; credits: number }>;
}

interface CreditBalance {
  balance:    number;
  sufficient: boolean;
  floor:      number;
}

interface SubscriptionInfo {
  tier:            string;
  creditsPerCycle: number;
  features:        string[];
  balance:         number;
  tiers:           Array<{ tier: string; label: string; priceMonthlyUsd: number; creditsPerCycle: number }>;
}

export default function UsageDashboardPage() {
  const [usage,   setUsage]   = useState<UsageSummary | null>(null);
  const [sub,     setSub]     = useState<SubscriptionInfo | null>(null);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [usageRes, subRes, balRes] = await Promise.all([
        fetch("/api/billing/usage"),
        fetch("/api/billing/subscription"),
        fetch("/api/billing/credits"),
      ]);

      if (usageRes.ok) { const d = await usageRes.json(); setUsage(d); }
      if (subRes.ok)   { const d = await subRes.json();   setSub(d);   }
      if (balRes.ok)   { const d = await balRes.json();   setBalance(d); }

      // If all returned 401, show not-logged-in state
      if (!usageRes.ok && !subRes.ok && !balRes.ok) {
        setError("Please sign in to view your usage dashboard.");
      }
    } catch (e) {
      setError("Failed to load usage data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <p className="text-slate-300 mb-4">{error}</p>
          <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const creditsUsed       = sub ? sub.creditsPerCycle - (balance?.balance ?? 0) : 0;
  const creditsTotal      = sub?.creditsPerCycle ?? 100;
  const creditsBalance    = balance?.balance ?? 0;
  const usagePercent      = Math.min(100, Math.round((creditsUsed / creditsTotal) * 100));
  const lowCredits        = usagePercent >= 80;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/account" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Usage Dashboard</h1>
            <p className="text-slate-400 text-sm">Credits, AI costs, and feature usage</p>
          </div>
          <button
            onClick={loadAll}
            className="ml-auto text-slate-400 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Credit overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              label:  "Credits Remaining",
              value:  creditsBalance.toLocaleString(),
              sub:    `of ${creditsTotal.toLocaleString()} this cycle`,
              icon:   Zap,
              color:  lowCredits ? "text-amber-400" : "text-blue-400",
              warn:   lowCredits,
            },
            {
              label:  "Credits Used Today",
              value:  (usage?.totalCredits ?? 0).toLocaleString(),
              sub:    `${usage?.totalCalls ?? 0} AI calls`,
              icon:   BarChart3,
              color:  "text-purple-400",
              warn:   false,
            },
            {
              label:  "Current Plan",
              value:  sub?.tier ? sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1) : "Free",
              sub:    `${sub?.features?.length ?? 0} features enabled`,
              icon:   TrendingUp,
              color:  "text-green-400",
              warn:   false,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`bg-slate-900/70 border rounded-2xl p-6 ${stat.warn ? "border-amber-700/50" : "border-slate-800"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">{stat.label}</span>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Credit progress bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Credit Usage This Cycle</span>
            <span className={`text-sm font-semibold ${lowCredits ? "text-amber-400" : "text-blue-400"}`}>
              {usagePercent}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                lowCredits
                  ? "bg-gradient-to-r from-amber-500 to-red-500"
                  : "bg-gradient-to-r from-blue-500 to-purple-500"
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {lowCredits && (
            <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Running low — consider upgrading or purchasing more credits
            </p>
          )}
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{creditsUsed.toLocaleString()} used</span>
            <span>{creditsBalance.toLocaleString()} remaining</span>
          </div>
        </div>

        {/* AI Model breakdown */}
        {usage?.byModel && Object.keys(usage.byModel).length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Model Cost Breakdown (Today)</h2>
            <div className="space-y-3">
              {Object.entries(usage.byModel)
                .sort(([, a], [, b]) => b.credits - a.credits)
                .map(([model, data]) => {
                  const pct = usage.totalCredits > 0
                    ? Math.round((data.credits / usage.totalCredits) * 100)
                    : 0;
                  return (
                    <div key={model}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 font-medium">{model}</span>
                        <span className="text-slate-400">
                          {data.credits} credits · {data.calls} calls · {data.tokens.toLocaleString()} tokens
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Feature usage */}
        {usage?.byFeature && Object.keys(usage.byFeature).length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Feature Usage (Today)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(usage.byFeature).map(([feat, count]) => (
                <div key={feat} className="bg-slate-800/60 rounded-xl p-4">
                  <p className="text-xs text-slate-400 capitalize mb-1">{feat.replace(/_/g, " ")}</p>
                  <p className="text-2xl font-black text-blue-400">{count}</p>
                  <p className="text-xs text-slate-500">calls</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entitlements */}
        {sub?.features && sub.features.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Your Entitlements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sub.features.map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-slate-300">{feat}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-slate-400 text-sm">
                Want more features?{" "}
                <Link href="/pricing" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  View upgrade options
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Link href="/pricing" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all">
            Upgrade Plan
          </Link>
          <Link href="/account/billing" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all border border-slate-700">
            Billing Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
