// app/(public)/launch/page.tsx
// CR AudioViz AI — Official Public Launch Landing Page
// 2026-02-21 — STEP 9 Official Launch

import { Metadata } from "next";
import Link from "next/link";
import {
  Zap, Sparkles, ArrowRight, Check, Bot, Package,
  BarChart3, Shield, Globe, Rocket, Star, Users,
} from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title:       `${BRAND_IDENTITY.name} — Now Live | AI-Powered Creative Platform`,
  description: "CRAudioVizAI is officially live. Build with Javari AI — autonomous creation, comprehensive module library, and enterprise-grade reliability. Join today.",
  openGraph: {
    title:       "CRAudioVizAI is Live 🚀",
    description: "The most complete AI creative platform. Build, automate, and scale with Javari.",
    type:        "website",
    images: [{ url: "/og-launch.png", width: 1200, height: 630, alt: "CRAudioVizAI Official Launch" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "CRAudioVizAI is Live 🚀",
    description: "Javari AI + Module Factory + Multi-AI team routing. Now open for everyone.",
  },
};

const FEATURES = [
  { icon: Bot,      label: "Javari AI",         desc: "Autonomous AI assistant that builds, fixes, and ships for you." },
  { icon: Package,  label: "Module Factory",     desc: "Generate production-ready modules in seconds — full stack." },
  { icon: Users,    label: "Multi-AI Routing",   desc: "Anthropic, OpenAI, Google — best model for every task." },
  { icon: BarChart3,label: "Usage Analytics",    desc: "Real-time dashboards, credit tracking, and cost forecasting." },
  { icon: Shield,   label: "Enterprise Security",desc: "OWASP Top 10, RLS, rate limiting, and audit logs." },
  { icon: Globe,    label: "Deploy Anywhere",    desc: "Build here, host anywhere. Full code ownership." },
];

const PLANS = [
  { name: "Free",       price: "$0",   tag: "Start free",      color: "slate",  cta: "Get Started" },
  { name: "Creator",    price: "$19",  tag: "Most popular",    color: "blue",   cta: "Start Creating" },
  { name: "Pro",        price: "$49",  tag: "Full power",      color: "violet", cta: "Go Pro" },
  { name: "Enterprise", price: "$199", tag: "Unlimited scale", color: "amber",  cta: "Contact Sales" },
];

export default function LaunchPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Launch Banner ──────────────────────────────────────────────────── */}
      <div className="bg-blue-600 text-white text-center py-2.5 px-4 text-sm font-medium">
        🎉 CRAudioVizAI is officially live — <Link href="/pricing" className="underline font-bold">See plans</Link>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 px-6">
        {/* Gradient glow */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37,99,235,0.25) 0%, transparent 70%)" }} />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                          bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm font-medium">
            <Rocket className="w-4 h-4" />
            Official Public Launch — {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
            <span className="text-white">Build with</span>{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Javari AI
            </span>
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            The complete AI creative ecosystem. Generate full-stack modules, automate your workflow,
            and ship production-ready software — powered by the best AI models in the world.
          </p>

          <p className="text-sm text-blue-300 font-medium italic">
            &ldquo;{BRAND_IDENTITY.tagline}&rdquo;
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl
                             bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg
                             transition-all hover:scale-[1.02] shadow-xl shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
              Start Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl
                             border border-slate-700 hover:border-slate-500 text-slate-300
                             font-bold text-lg transition-all">
              View Pricing
            </Link>
            <Link href="/store"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl
                             border border-slate-700 hover:border-slate-500 text-slate-300
                             font-bold text-lg transition-all">
              <Package className="w-5 h-5" />
              Explore Modules
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 pt-2">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Free tier forever</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Credits never expire</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Full code ownership</span>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Everything you need to build</h2>
            <p className="text-slate-400 text-lg">One platform. Comprehensive tools. Zero compromise.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label}
                   className="p-6 rounded-2xl bg-slate-900 border border-slate-800
                              hover:border-slate-700 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20
                                flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-all">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{label}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Teaser ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-slate-900/50">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-slate-400 text-lg mb-12">Start free. Scale as you grow.</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map(({ name, price, tag, color, cta }) => (
              <div key={name}
                   className={`p-5 rounded-2xl border transition-all text-left ${
                     color === "violet"
                       ? "bg-violet-950/50 border-violet-700/50 ring-1 ring-violet-500/30"
                       : "bg-slate-900 border-slate-800 hover:border-slate-700"
                   }`}>
                <div className="text-xs font-medium text-slate-500 mb-1">{tag}</div>
                <div className="text-2xl font-extrabold text-white mb-0.5">{price}</div>
                <div className="text-xs text-slate-400 mb-4">/month</div>
                <div className="font-semibold text-white text-sm mb-4">{name}</div>
                <Link href="/pricing"
                      className={`block text-center px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        color === "violet"
                          ? "bg-violet-600 hover:bg-violet-500 text-white"
                          : "border border-slate-700 hover:border-slate-500 text-slate-300"
                      }`}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link href="/tiers"
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
              Compare all features →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
          <h2 className="text-4xl font-extrabold text-white">Ready to build something great?</h2>
          <p className="text-slate-400 text-lg">Join CRAudioVizAI today. Your first module is free.</p>
          <Link href="/auth/signup"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl
                           bg-gradient-to-r from-blue-600 to-violet-600
                           hover:from-blue-500 hover:to-violet-500
                           text-white font-bold text-lg transition-all
                           shadow-2xl shadow-blue-500/25 hover:scale-[1.02]">
            <Zap className="w-5 h-5" />
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

    </main>
  );
}
