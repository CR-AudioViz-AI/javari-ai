// app/tiers/page.tsx
// CR AudioViz AI — Tier Comparison Page
// 2026-02-20 — STEP 6 Productization
//
// Server Component — interactive tier deep-dive with feature matrix,
// credit grants, and upgrade CTAs. Pulls live data from subscriptions.ts + entitlements.ts

import { Metadata } from "next";
import Link from "next/link";
import {
  Zap, Star, Crown, Building2, Check, X,
  ArrowRight, Cpu, Database, Globe, Shield,
  Users, Wrench, BarChart3, Sparkles,
} from "lucide-react";
import { getTierDefinitions } from "@/lib/javari/revenue/subscriptions";
import { TIER_FEATURES } from "@/lib/javari/revenue/entitlements";

export const metadata: Metadata = {
  title:       "Plans & Tiers — CR AudioViz AI",
  description: "Compare every feature across all CR AudioViz AI plans. Find the tier that's right for you.",
};

// ── Full feature matrix (grouped) ─────────────────────────────────────────────

const FEATURE_GROUPS = [
  {
    group: "Core AI",
    icon:  Cpu,
    features: [
      { label: "AI Chat & Assistance",       free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Basic Autonomy Tasks",        free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Advanced Autonomy (Goals)",   free: false, creator: true,  pro: true,  enterprise: true  },
      { label: "Multi-AI Team Mode",          free: false, creator: true,  pro: true,  enterprise: true  },
      { label: "Priority Model Routing",      free: false, creator: false, pro: true,  enterprise: true  },
      { label: "Custom Model Selection",      free: false, creator: false, pro: false, enterprise: true  },
    ],
  },
  {
    group: "Module Factory",
    icon:  Wrench,
    features: [
      { label: "Module Marketplace Browse",   free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Module Install (stable)",     free: false, creator: true,  pro: true,  enterprise: true  },
      { label: "Module Factory Generation",   free: false, creator: true,  pro: true,  enterprise: true  },
      { label: "DB Schema Generation",        free: false, creator: false, pro: true,  enterprise: true  },
      { label: "Custom Module Templates",     free: false, creator: false, pro: false, enterprise: true  },
    ],
  },
  {
    group: "Credits & Usage",
    icon:  BarChart3,
    features: [
      { label: "Monthly Credits",             free: "100",    creator: "1,000",  pro: "5,000",   enterprise: "25,000" },
      { label: "Credit Rollover",             free: false,    creator: true,     pro: true,      enterprise: true     },
      { label: "Usage Analytics",             free: false,    creator: true,     pro: true,      enterprise: true     },
      { label: "Cost Breakdown by Model",     free: false,    creator: false,    pro: true,      enterprise: true     },
      { label: "Forecasting & Alerts",        free: false,    creator: false,    pro: true,      enterprise: true     },
    ],
  },
  {
    group: "Data & Storage",
    icon:  Database,
    features: [
      { label: "Supabase Integration",        free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Vector Embeddings",           free: false, creator: true,  pro: true,  enterprise: true  },
      { label: "Private Knowledge Base",      free: false, creator: false, pro: true,  enterprise: true  },
      { label: "Dedicated Database",          free: false, creator: false, pro: false, enterprise: true  },
    ],
  },
  {
    group: "Deployment & Scale",
    icon:  Globe,
    features: [
      { label: "Vercel Deployment",           free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Preview Environments",        free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Custom Domain",               free: false, creator: false, pro: true,  enterprise: true  },
      { label: "White-Label Branding",        free: false, creator: false, pro: false, enterprise: true  },
      { label: "Multi-Region Deploy",         free: false, creator: false, pro: false, enterprise: true  },
    ],
  },
  {
    group: "Security & Support",
    icon:  Shield,
    features: [
      { label: "Encrypted Storage",           free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Audit Logs",                  free: false, creator: false, pro: true,  enterprise: true  },
      { label: "SSO / SAML",                  free: false, creator: false, pro: false, enterprise: true  },
      { label: "Community Support",           free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Priority Email Support",      free: false, creator: false, pro: true,  enterprise: true  },
      { label: "Dedicated SLA",               free: false, creator: false, pro: false, enterprise: true  },
    ],
  },
  {
    group: "Team & Collaboration",
    icon:  Users,
    features: [
      { label: "Solo Workspace",              free: true,  creator: true,  pro: true,  enterprise: true  },
      { label: "Invite Team Members",         free: false, creator: false, pro: "5",   enterprise: "∞"   },
      { label: "Role-Based Access",           free: false, creator: false, pro: false, enterprise: true  },
      { label: "Shared Knowledge Bases",      free: false, creator: false, pro: false, enterprise: true  },
    ],
  },
];

const TIER_META: Record<string, {
  icon:      React.ElementType;
  accent:    string;
  badgeCls:  string;
  ctaLabel:  string;
  ctaHref:   string;
}> = {
  free:       { icon: Zap,       accent: "text-slate-300",   badgeCls: "bg-slate-700 text-slate-200",              ctaLabel: "Start Free",         ctaHref: "/auth/register"      },
  creator:    { icon: Star,      accent: "text-sky-400",     badgeCls: "bg-sky-900/60 text-sky-300",               ctaLabel: "Start Creating",     ctaHref: "/auth/register?plan=creator"   },
  pro:        { icon: Crown,     accent: "text-violet-400",  badgeCls: "bg-violet-900/60 text-violet-300 ring-1 ring-violet-500", ctaLabel: "Go Pro",             ctaHref: "/auth/register?plan=pro"       },
  enterprise: { icon: Building2, accent: "text-amber-400",   badgeCls: "bg-amber-900/60 text-amber-300",           ctaLabel: "Contact Sales",      ctaHref: "/support?subject=Enterprise"   },
};

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="w-5 h-5 text-green-400 mx-auto" aria-label="Included" />;
  if (value === false) return <X     className="w-4 h-4 text-slate-600 mx-auto" aria-label="Not included" />;
  return <span className="text-sm font-semibold text-sky-300">{value}</span>;
}

export default async function TiersPage() {
  const tiers = getTierDefinitions();

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]
                          bg-gradient-radial from-violet-600/20 via-blue-600/10 to-transparent" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                        bg-violet-900/40 border border-violet-700/50 text-violet-300
                        text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Every feature, every plan
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
          Plans & Features
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
          Compare everything — no surprises. Every feature across every tier, side by side.
        </p>

        {/* Quick pricing bar */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {tiers.map((t) => {
            const meta = TIER_META[t.tier];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <Link
                key={t.tier}
                href={meta.ctaHref}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold
                            text-sm transition-all hover:scale-105 ${meta.badgeCls}`}
              >
                <Icon className={`w-4 h-4 ${meta.accent}`} />
                {t.label}
                <span className="ml-1 opacity-75">
                  {t.priceMonthlyUsd === 0 ? "Free" : `$${t.priceMonthlyUsd}/mo`}
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400
                     hover:text-white transition-colors"
        >
          See pricing cards <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* ── Feature matrix (desktop: table, mobile: card stack) ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">

        {/* Sticky header (desktop) */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0
                        sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b
                        border-slate-800 mb-0 rounded-t-2xl overflow-hidden">
          <div className="py-4 px-6 text-sm text-slate-500 font-medium">Feature</div>
          {tiers.map((t) => {
            const meta = TIER_META[t.tier];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={t.tier} className="py-4 px-4 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${meta.accent}`} />
                <div className="text-sm font-bold text-white">{t.label}</div>
                <div className="text-xs text-slate-500">
                  {t.priceMonthlyUsd === 0 ? "Free" : `$${t.priceMonthlyUsd}/mo`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature groups */}
        {FEATURE_GROUPS.map((group, gi) => (
          <div key={group.group} className={`border border-slate-800 ${gi > 0 ? "border-t-0" : ""} 
                                            ${gi === 0 ? "rounded-tl-none rounded-tr-none" : ""}
                                            ${gi === FEATURE_GROUPS.length - 1 ? "rounded-b-2xl" : ""}
                                            overflow-hidden`}>
            {/* Group header */}
            <div className="flex items-center gap-2.5 px-6 py-3
                            bg-slate-900/60 border-b border-slate-800">
              <group.icon className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                {group.group}
              </span>
            </div>

            {/* Feature rows */}
            {group.features.map((feat, fi) => (
              <div key={feat.label}
                   className={`${fi % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"}
                               border-b border-slate-800/50 last:border-0`}>

                {/* Desktop row */}
                <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0
                                items-center px-0 py-3">
                  <div className="px-6 text-sm text-slate-300">{feat.label}</div>
                  {tiers.map((t) => (
                    <div key={t.tier} className="px-4 text-center">
                      <FeatureValue value={feat[t.tier as keyof typeof feat] as boolean | string} />
                    </div>
                  ))}
                </div>

                {/* Mobile card */}
                <div className="lg:hidden px-4 py-4">
                  <p className="text-sm font-medium text-white mb-3">{feat.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {tiers.map((t) => {
                      const meta = TIER_META[t.tier];
                      const val  = feat[t.tier as keyof typeof feat] as boolean | string;
                      return (
                        <div key={t.tier}
                             className="flex items-center justify-between px-3 py-2
                                        rounded-lg bg-slate-800/50 text-xs">
                          <span className="text-slate-400">{t.label}</span>
                          <FeatureValue value={val} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* CTA row */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0
                        border border-t-0 border-slate-800 rounded-b-2xl
                        overflow-hidden bg-slate-900/60 px-0 py-6 mt-0">
          <div />
          {tiers.map((t) => {
            const meta = TIER_META[t.tier];
            if (!meta) return null;
            const isPro = t.tier === "pro";
            return (
              <div key={t.tier} className="px-4 text-center">
                <Link
                  href={meta.ctaHref}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
                              text-sm font-semibold transition-all hover:scale-105
                              ${isPro
                                ? "bg-violet-600 hover:bg-violet-500 text-white"
                                : "bg-slate-700 hover:bg-slate-600 text-white"}`}
                >
                  {meta.ctaLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Mobile CTAs */}
        <div className="lg:hidden mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiers.map((t) => {
            const meta = TIER_META[t.tier];
            if (!meta) return null;
            const Icon = meta.icon;
            const isPro = t.tier === "pro";
            return (
              <Link
                key={t.tier}
                href={meta.ctaHref}
                className={`flex items-center justify-between px-5 py-4 rounded-xl
                            border font-semibold transition-all hover:scale-[1.02]
                            ${isPro
                              ? "bg-violet-600/20 border-violet-500 text-violet-200"
                              : "bg-slate-800/50 border-slate-700 text-white"}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${meta.accent}`} />
                  <span>{t.label}</span>
                  <span className="text-sm opacity-70">
                    {t.priceMonthlyUsd === 0 ? "Free" : `$${t.priceMonthlyUsd}/mo`}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-60" />
              </Link>
            );
          })}
        </div>

      </section>

      {/* ── FAQ strip ── */}
      <section className="border-t border-slate-800 bg-slate-900/40 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Still have questions?</h2>
          <p className="text-slate-400 mb-8">
            Credits never expire on paid plans. Downgrade anytime. No contracts.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                         bg-white/10 hover:bg-white/20 text-white font-semibold
                         transition-all"
            >
              View Pricing Cards
            </Link>
            <Link
              href="/support?subject=Billing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                         border border-slate-700 hover:border-slate-500 text-slate-300
                         font-semibold transition-all"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
