"use client";
// app/dashboard/page.tsx
// Javari AI — Main User Dashboard (production)
// Purpose: Live credits, subscription tier, quick actions, recent activity.
// Date: 2026-03-09

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, Crown, TrendingUp, ArrowRight, Bot, Wrench,
  ShoppingBag, Shield, Clock, ChevronRight, Plus, Star,
} from "lucide-react";

interface DashboardData {
  profile: { full_name: string | null; subscription_tier: string; subscription_status: string; onboarding_completed: boolean };
  credits: { balance: number; lifetime_earned: number; lifetime_spent: number };
  subscription: { tier: string; priceMonthlyUsd: number; creditsPerCycle: number } | null;
  recentActivity: Array<{ id: string; description: string; amount: number; created_at: string }>;
}

const TIER_COLORS: Record<string, string> = {
  free: "text-slate-400", creator: "text-blue-400", pro: "text-purple-400", enterprise: "text-amber-400",
};

const TIER_PRICE: Record<string, number> = { free: 0, creator: 19, pro: 49, enterprise: 199 };
const TIER_CREDITS: Record<string, number> = { free: 100, creator: 1000, pro: 5000, enterprise: 25000 };

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/user/profile").then(r => r.json()),
      fetch("/api/credits/balance").then(r => r.json()),
      fetch("/api/billing/subscription").then(r => r.json()),
      fetch("/api/credits/transactions?limit=5").then(r => r.json()),
    ]).then(([p, c, s, t]) => {
      const profile  = p.status === "fulfilled" ? p.value?.profile  : null;
      const credits  = c.status === "fulfilled" ? c.value?.credits  : null;
      const sub      = s.status === "fulfilled" ? s.value?.subscription : null;
      const txs      = t.status === "fulfilled" ? t.value?.transactions : [];
      const tier     = profile?.subscription_tier ?? sub?.tier ?? "free";
      setData({
        profile: {
          full_name:            profile?.full_name ?? null,
          subscription_tier:    tier,
          subscription_status:  profile?.subscription_status ?? "active",
          onboarding_completed: profile?.onboarding_completed ?? false,
        },
        credits: {
          balance:         credits?.balance ?? profile?.credits ?? 0,
          lifetime_earned: credits?.lifetime_earned ?? 0,
          lifetime_spent:  credits?.lifetime_spent  ?? 0,
        },
        subscription: { tier, priceMonthlyUsd: TIER_PRICE[tier] ?? 0, creditsPerCycle: TIER_CREDITS[tier] ?? 100 },
        recentActivity: txs ?? [],
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { profile, credits, subscription } = data;
  const tier      = profile.subscription_tier ?? "free";
  const tierColor = TIER_COLORS[tier] ?? "text-slate-400";
  const creditPct = subscription ? Math.min((credits.balance / subscription.creditsPerCycle) * 100, 100) : 0;
  const h = new Date().getHours();
  const greeting  = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              {greeting}{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Your Javari AI workspace.</p>
          </div>
          <Link href="/javari" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition">
            <Bot className="w-4 h-4" /> Open Javari AI
          </Link>
        </div>

        {/* Onboarding prompt */}
        {!profile.onboarding_completed && (
          <div className="mb-6 bg-blue-600/10 border border-blue-500/20 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Complete your setup</div>
                <div className="text-slate-400 text-xs mt-0.5">Takes 60 seconds. Unlock your first 100 free credits.</div>
              </div>
            </div>
            <Link href="/account/onboarding" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5">
              Start <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Credits</span>
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold mb-1">{credits.balance.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mb-3">{credits.lifetime_spent.toLocaleString()} used lifetime</div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${creditPct}%` }} />
            </div>
            <div className="text-xs text-slate-500 mt-1.5">{credits.balance} / {subscription?.creditsPerCycle ?? 100}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Plan</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <div className={`text-2xl font-bold mb-1 capitalize ${tierColor}`}>{tier}</div>
            <div className="text-xs text-slate-500 mb-3">{subscription?.priceMonthlyUsd === 0 ? "Free forever" : `$${subscription?.priceMonthlyUsd}/month`}</div>
            {tier === "free" && (
              <Link href="/pricing" className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1">
                Upgrade <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Earned</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold mb-1">{credits.lifetime_earned.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Credits never expire on paid plans</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Status</span>
              <Shield className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold mb-1 text-green-400">Active</div>
            <div className="text-xs text-slate-500 capitalize">{profile.subscription_status}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Chat with Javari", href: "/javari",  Icon: Bot,         col: "blue"   },
              { label: "Browse Tools",     href: "/tools",   Icon: Wrench,      col: "violet" },
              { label: "Module Store",     href: "/store",   Icon: ShoppingBag, col: "amber"  },
              { label: "Upgrade Plan",     href: "/pricing", Icon: Crown,       col: "green"  },
            ].map(({ label, href, Icon, col }) => (
              <Link key={href} href={href} className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-4 flex items-center gap-3 transition group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-800`}>
                  <Icon className="w-4 h-4 text-slate-300" />
                </div>
                <span className="text-sm font-medium text-white group-hover:text-blue-300 transition">{label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 ml-auto transition" />
              </Link>
            ))}
          </div>
        </div>

        {/* Activity + Tools */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">Recent Activity</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
              {data.recentActivity.length === 0 ? (
                <div className="p-6 text-center">
                  <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No activity yet.</p>
                  <Link href="/tools" className="text-blue-400 text-xs mt-1 inline-block hover:text-blue-300 transition">Try a tool to get started →</Link>
                </div>
              ) : data.recentActivity.map((tx) => (
                <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{tx.description}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className={`text-sm font-semibold ${tx.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">Popular Tools</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "AI Copywriter",  href: "/tools/ai-copywriter",           cost: 2 },
                { name: "Resume Builder", href: "/tools/resume-builder",           cost: 5 },
                { name: "Social Captions",href: "/tools/social-caption-generator", cost: 1 },
                { name: "PDF Summarizer", href: "/tools/pdf-summarizer",           cost: 3 },
                { name: "Brand Colors",   href: "/tools/brand-color-palette",      cost: 2 },
                { name: "Logo Concepts",  href: "/tools/logo-generator",           cost: 3 },
              ].map(({ name, href, cost }) => (
                <Link key={href} href={href} className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-4 transition group">
                  <div className="flex items-center justify-between mb-1.5">
                    <Wrench className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs text-slate-500">{cost} cr</span>
                  </div>
                  <div className="text-sm font-medium text-white group-hover:text-blue-300 transition">{name}</div>
                </Link>
              ))}
            </div>
            <Link href="/tools" className="mt-3 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl p-3 text-sm text-slate-400 hover:text-white transition">
              <Plus className="w-4 h-4" /> View all tools
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
