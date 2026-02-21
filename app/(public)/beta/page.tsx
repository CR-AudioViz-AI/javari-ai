// app/(public)/beta/page.tsx
// CR AudioViz AI — Public Beta Landing Page
// 2026-02-20 — STEP 8 Go-Live

import { Metadata } from "next";
import { Zap, Sparkles, ArrowRight, Check, Users, Bot, Package, BarChart3 } from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";
import BetaWaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title:       "Join the Beta — CR AudioViz AI",
  description: "Be among the first to experience the AI creative platform that builds, automates, and scales with you. Join our public beta today.",
  openGraph: {
    title:       "CR AudioViz AI — Public Beta",
    description: "Your Story. Our Design. Join the beta.",
    url:         "https://craudiovizai.com/beta",
  },
};

const BETA_FEATURES = [
  { icon: Bot,      label: "Javari AI Assistant",  desc: "Autonomous AI that builds, deploys, and manages your platform" },
  { icon: Package,  label: "Module Factory",        desc: "Generate production-ready modules in seconds with multi-agent AI" },
  { icon: BarChart3,label: "Usage Dashboard",       desc: "Real-time metrics, credit tracking, and AI cost transparency" },
  { icon: Users,    label: "Multi-AI Team Mode",    desc: "Specialist AI agents collaborate to solve complex problems" },
];

const BETA_INCLUDES = [
  "100 free AI credits to start",
  "Access to Javari AI assistant",
  "Module Factory (generate full apps)",
  "Usage dashboard & analytics",
  "Priority support during beta",
  "Free plan, forever — upgrade when ready",
];

export default function BetaPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white overflow-hidden">

      {/* ── Beta announcement banner ── */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 px-4 text-center">
        <p className="text-sm font-semibold text-white">
          🎉 Public Beta is now open — limited spots available.{" "}
          <a href="#waitlist" className="underline underline-offset-2 hover:no-underline">
            Claim your spot →
          </a>
        </p>
      </div>

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Background mesh */}
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px]
                          rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-60 right-0 w-[400px] h-[400px]
                          rounded-full bg-violet-600/10 blur-[80px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]"
               style={{
                 backgroundImage: "linear-gradient(#60a5fa 1px, transparent 1px), linear-gradient(90deg, #60a5fa 1px, transparent 1px)",
                 backgroundSize:  "60px 60px",
               }} />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                          bg-blue-900/40 border border-blue-700/50 text-blue-300
                          text-sm font-semibold mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Public Beta — Now Open
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight
                         text-white mb-6 leading-[1.05]">
            Your Story.{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400
                             bg-clip-text text-transparent">
              Our Design.
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 mb-4 max-w-2xl mx-auto leading-relaxed">
            The AI creative platform that builds, automates, and scales with you.
          </p>
          <p className="text-slate-500 mb-10 max-w-xl mx-auto">
            Javari AI + Module Factory + Multi-Agent Orchestration — all in one platform.
            Free to join. No credit card required.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <a
              href="#waitlist"
              className="inline-flex items-center justify-center gap-2 px-8 py-4
                         rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600
                         hover:from-blue-500 hover:to-violet-500 text-white font-bold
                         text-lg shadow-2xl shadow-blue-900/40 transition-all
                         hover:scale-[1.02] active:scale-[0.98]"
            >
              <Zap className="w-5 h-5" />
              Join the Beta
            </a>
            <a
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4
                         rounded-2xl border border-slate-700 hover:border-blue-500
                         text-slate-300 hover:text-white font-semibold text-lg
                         transition-all"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <p className="text-xs text-slate-600">
            Already have access?{" "}
            <a href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              Go to Dashboard →
            </a>
          </p>
        </div>
      </section>

      {/* ── Beta includes ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800/60">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">What's in the Beta</h2>
          <p className="text-slate-400">Everything you need to start building with AI — at no cost.</p>
        </div>
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BETA_INCLUDES.map((item) => (
            <div key={item} className="flex items-center gap-3 px-4 py-3 rounded-xl
                                       bg-slate-900/60 border border-slate-800">
              <Check className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-sm text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature highlights ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Built for the next generation of creators
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BETA_FEATURES.map((f) => (
              <div key={f.label}
                   className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800
                              hover:border-blue-700/50 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-blue-800/50
                                flex items-center justify-center mb-4 group-hover:bg-blue-800/60
                                transition-colors">
                  <f.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{f.label}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist form ── */}
      <section id="waitlist" className="py-20 px-4 sm:px-6 lg:px-8 scroll-mt-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">Join the Beta</h2>
            <p className="text-slate-400">
              Get instant access. No waitlist — just sign up and start building.
            </p>
          </div>
          <BetaWaitlistForm />
        </div>
      </section>

      {/* ── Footer strip ── */}
      <footer className="border-t border-slate-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center
                        justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>{BRAND_IDENTITY.name} © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/legal/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/legal/terms"   className="hover:text-white transition-colors">Terms</a>
            <a href="/legal/cookies" className="hover:text-white transition-colors">Cookies</a>
            <a href="/support"       className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
