// app/pricing/page.tsx
// CR AudioViz AI — Public Pricing Page
// 2026-02-20 — STEP 6 Productization
//
// Server Component — pulls tier data from subscriptions.ts
// Mobile-first, fully accessible, feature comparison table

import { Metadata } from "next";
import Link from "next/link";
import { Check, X, Zap, Star, Crown, Building2, ArrowRight, Sparkles } from "lucide-react";
import { getTierDefinitions } from "@/lib/javari/revenue/subscriptions";
import { TIER_FEATURES } from "@/lib/javari/revenue/entitlements";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title:       "Pricing — CR AudioViz AI",
  description: "Choose the plan that grows with your business. Free forever, upgrade when ready.",
};

// ── Feature comparison matrix ─────────────────────────────────────────────────

const FEATURE_MATRIX = [
  { label: "AI Chat & Assistance",          free: true,  creator: true,  pro: true,  enterprise: true  },
  { label: "Basic Autonomy",                free: true,  creator: true,  pro: true,  enterprise: true  },
  { label: "Credit Rollover",               free: false, creator: true,  pro: true,  enterprise: true  },
  { label: "Multi-AI Team Mode",            free: false, creator: true,  pro: true,  enterprise: true  },
  { label: "Module Factory",                free: false, creator: true,  pro: true,  enterprise: true  },
  { label: "Advanced Autonomy",             free: false, creator: false, pro: true,  enterprise: true  },
  { label: "DB Schema Generation",          free: false, creator: false, pro: true,  enterprise: true  },
  { label: "Priority Model Routing",        free: false, creator: false, pro: true,  enterprise: true  },
  { label: "White-Label",                   free: false, creator: false, pro: false, enterprise: true  },
  { label: "SLA & Dedicated Support",       free: false, creator: false, pro: false, enterprise: true  },
  { label: "Custom Integrations",           free: false, creator: false, pro: false, enterprise: true  },
  { label: "Unlimited Team Members",        free: false, creator: false, pro: false, enterprise: true  },
];

const TIER_ICONS: Record<string, React.ElementType> = {
  free:       Zap,
  creator:    Star,
  pro:        Crown,
  enterprise: Building2,
};

const TIER_POPULAR: Record<string, boolean> = {
  free: false, creator: false, pro: true, enterprise: false,
};

// ── Component ────────────────────────────────────────────────────────────────

export default async function PricingPage() {
  // Server-side: tiers are pure TypeScript constants — no DB call needed
  const tiers = getTierDefinitions();

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/40 text-blue-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            No credit card required — free forever
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6">
            Simple, transparent{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              pricing
            </span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto">
            {BRAND_IDENTITY.description} Start free, scale as you grow.
            Credits never expire on paid plans.
          </p>
        </div>
      </section>

      {/* ── Pricing Cards ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {tiers.map((tier) => {
              const Icon    = TIER_ICONS[tier.tier] ?? Zap;
              const popular = TIER_POPULAR[tier.tier];
              const isFree  = tier.priceMonthlyUsd === 0;

              return (
                <div
                  key={tier.tier}
                  className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all duration-300 ${
                    popular
                      ? "bg-gradient-to-br from-blue-900/60 to-purple-900/40 border-blue-500/60 shadow-2xl shadow-blue-900/30 scale-[1.02]"
                      : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                      Most Popular
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                      popular ? "bg-blue-600/30" : "bg-slate-800"
                    }`}>
                      <Icon className={`w-5 h-5 ${popular ? "text-blue-300" : "text-slate-400"}`} />
                    </div>
                    <h2 className="text-xl font-bold mb-1">{tier.label}</h2>
                    <p className="text-slate-400 text-sm">{tier.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-black">
                        {isFree ? "Free" : `$${tier.priceMonthlyUsd}`}
                      </span>
                      {!isFree && (
                        <span className="text-slate-400 text-sm mb-1.5">/month</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                      {tier.creditsPerCycle.toLocaleString()} credits/month
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 flex-1 mb-8">
                    {(TIER_FEATURES[tier.tier as keyof typeof TIER_FEATURES] ?? []).map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <span className="text-slate-300">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={isFree ? "/auth/signup" : `/auth/signup?plan=${tier.tier}`}
                    className={`w-full text-center font-semibold rounded-xl px-6 py-3 transition-all text-sm ${
                      popular
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-900/40"
                        : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    {isFree ? "Get Started Free" : `Start ${tier.label}`}
                    <ArrowRight className="inline-block w-4 h-4 ml-1.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Feature Comparison Table ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
            Full Feature Comparison
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="text-left p-4 text-slate-400 font-medium w-1/2">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.tier} className="p-4 text-center font-semibold capitalize">
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row, idx) => (
                  <tr
                    key={row.label}
                    className={`border-b border-slate-800/50 ${idx % 2 === 0 ? "bg-slate-900/20" : ""}`}
                  >
                    <td className="p-4 text-slate-300">{row.label}</td>
                    {(["free", "creator", "pro", "enterprise"] as const).map((tier) => (
                      <td key={tier} className="p-4 text-center">
                        {row[tier] ? (
                          <Check className="w-4 h-4 text-blue-400 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-700 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Credits row */}
                <tr className="border-b border-slate-800/50 bg-slate-900/20">
                  <td className="p-4 text-slate-300 font-medium">Credits/Month</td>
                  {tiers.map((t) => (
                    <td key={t.tier} className="p-4 text-center text-blue-300 font-semibold">
                      {t.creditsPerCycle.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24 border-t border-slate-800">
        <div className="max-w-3xl mx-auto pt-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Common Questions</h2>
          <div className="space-y-6">
            {[
              { q: "What is a credit?", a: "One credit = one standard AI operation. Complex tasks (multi-agent, module generation) use more credits. Credits are shown before every operation." },
              { q: "Do credits expire?", a: "On paid plans, credits never expire. On the free tier, credits reset monthly." },
              { q: "Can I upgrade at any time?", a: "Yes. Upgrades take effect immediately. You'll receive a prorated credit grant for the new tier." },
              { q: "What happens if I run out of credits?", a: "Operations pause gracefully — we never cut you off mid-task. You can purchase additional credits or wait for your next cycle." },
              { q: "Is there a free trial for paid plans?", a: "Yes — paid plans include a 14-day full-feature trial with no credit card required." },
            ].map(({ q, a }) => (
              <div key={q} className="border border-slate-800 rounded-xl p-6 bg-slate-900/50">
                <h3 className="font-semibold mb-2">{q}</h3>
                <p className="text-slate-400 text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 bg-gradient-to-br from-blue-950/40 to-purple-950/30 border-t border-slate-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-slate-400 mb-8">{BRAND_IDENTITY.tagline}</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-8 py-4 transition-all shadow-lg shadow-blue-900/30"
          >
            <Sparkles className="w-5 h-5" />
            Start Free — No Card Required
          </Link>
        </div>
      </section>
    </main>
  );
}
