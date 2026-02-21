"use client";
// app/account/plan/page.tsx
// CR AudioViz AI — Account Plan Overview
// 2026-02-20 — STEP 6 Productization

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Crown, Star, Building2, ArrowRight, Check, RefreshCw } from "lucide-react";

export default function AccountPlanPage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/subscription").then((r) => r.ok ? r.json() : null),
      fetch("/api/billing/credits").then((r) => r.ok ? r.json() : null),
      fetch("/api/billing/subscription?tiers=true").then((r) => r.ok ? r.json() : null),
    ]).then(([sub, cred, tiers]) => {
      setData({ sub, cred, tiers: tiers?.tiers ?? [] });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
    </main>
  );

  const tier         = data?.sub?.tier ?? "free";
  const balance      = data?.cred?.balance ?? data?.sub?.balance ?? 0;
  const features     = data?.sub?.features ?? [];
  const allTiers     = data?.tiers ?? [];
  const tierOrder: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-1">Your Plan</h1>
        <p className="text-slate-400 text-sm mb-8">Subscription details and feature access</p>

        {/* Plan card */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-700/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Active Plan</p>
              <p className="text-3xl font-black capitalize">{tierLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-1">Credits Remaining</p>
              <p className="text-3xl font-black text-blue-400">{balance.toLocaleString()}</p>
            </div>
          </div>
          {features.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/10">
              {features.slice(0, 6).map((f: string) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-slate-300">{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upgrade options */}
        {allTiers.filter((t: any) => tierOrder[t.tier] > tierOrder[tier]).length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Upgrade Options</h2>
            <div className="space-y-3">
              {allTiers
                .filter((t: any) => tierOrder[t.tier] > tierOrder[tier])
                .map((t: any) => (
                  <Link
                    key={t.tier}
                    href={`/pricing`}
                    className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-blue-900/20 hover:border-blue-700/40 border border-transparent rounded-xl transition-all group"
                  >
                    <div>
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-xs text-slate-400">
                        ${t.priceMonthlyUsd}/mo · {t.creditsPerCycle.toLocaleString()} credits
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  </Link>
                ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/account/billing" className="flex-1 text-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl py-3 text-sm transition-all">
            Manage Billing
          </Link>
          <Link href="/account/usage" className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl py-3 text-sm transition-all border border-slate-700">
            View Usage
          </Link>
        </div>
      </div>
    </main>
  );
}
