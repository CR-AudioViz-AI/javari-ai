// app/features/page.tsx
// CR AudioViz AI — Features Showcase Page
// 2026-02-20 — STEP 6 Productization

import { Metadata } from "next";
import Link from "next/link";
import {
  Bot, Layers, Cpu, ShieldCheck, Zap, BarChart3,
  GitBranch, Package, Sparkles, ArrowRight, Globe,
  Lock, RefreshCw, DollarSign
} from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title:       "Features — CR AudioViz AI",
  description: "Explore the full feature set of the CR AudioViz AI platform powered by Javari AI.",
};

const FEATURES = [
  {
    icon:        Bot,
    title:       "Javari AI Assistant",
    description: "Your autonomous business partner — answers questions, executes goals, manages workflows, and learns from every interaction.",
    tier:        "free",
    highlight:   false,
  },
  {
    icon:        Cpu,
    title:       "Multi-AI Team Mode",
    description: "Dispatch ChatGPT, Claude, Llama, Mistral, and Grok as specialized agents — architect, engineer, validator — working in parallel.",
    tier:        "creator",
    highlight:   true,
  },
  {
    icon:        Package,
    title:       "Module Factory",
    description: "Generate complete Next.js modules — pages, APIs, components, DB schemas — with a single description. Ready to commit.",
    tier:        "creator",
    highlight:   true,
  },
  {
    icon:        GitBranch,
    title:       "Autonomous Planner",
    description: "Break any goal into a TaskGraph, execute each step across agents, validate outputs, and persist results automatically.",
    tier:        "pro",
    highlight:   false,
  },
  {
    icon:        Layers,
    title:       "Intelligent Routing",
    description: "6-layer routing engine matches every request to the optimal model based on cost, latency, capability, and context.",
    tier:        "free",
    highlight:   false,
  },
  {
    icon:        ShieldCheck,
    title:       "Output Validator",
    description: "Every AI response is scored 0–100. Failed outputs are auto-retried with corrective prompts before reaching you.",
    tier:        "creator",
    highlight:   false,
  },
  {
    icon:        BarChart3,
    title:       "Usage Analytics",
    description: "Real-time credit consumption, model cost breakdown, daily usage trends, and Stripe-ready billing summaries.",
    tier:        "creator",
    highlight:   false,
  },
  {
    icon:        DollarSign,
    title:       "Credit System",
    description: "Transparent credit-per-operation model. Estimated cost shown before execution. Credits never expire on paid plans.",
    tier:        "free",
    highlight:   false,
  },
  {
    icon:        Lock,
    title:       "Entitlement Engine",
    description: "Fine-grained feature access control tied to subscription tier. Upgrade instantly to unlock advanced capabilities.",
    tier:        "creator",
    highlight:   false,
  },
  {
    icon:        RefreshCw,
    title:       "Self-Healing System",
    description: "Heartbeat monitoring, automatic error recovery, fallback chains, and 9 autonomous bots keep the platform running 24/7.",
    tier:        "pro",
    highlight:   false,
  },
  {
    icon:        Globe,
    title:       "Module Marketplace",
    description: "Browse, install, and publish pre-built modules for your platform. One-click installation into your project.",
    tier:        "creator",
    highlight:   false,
  },
  {
    icon:        Zap,
    title:       "SSE Live Streaming",
    description: "Watch multi-agent work happen in real time — every task start, agent output, validation pass, and final merge — live.",
    tier:        "free",
    highlight:   false,
  },
];

const TIER_LABELS: Record<string, { label: string; class: string }> = {
  free:       { label: "Free",       class: "bg-slate-700 text-slate-300" },
  creator:    { label: "Creator+",   class: "bg-blue-900/60 text-blue-300 border border-blue-700/40" },
  pro:        { label: "Pro+",       class: "bg-purple-900/60 text-purple-300 border border-purple-700/40" },
  enterprise: { label: "Enterprise", class: "bg-gradient-to-r from-blue-900/60 to-purple-900/60 text-white border border-blue-600/40" },
};

export default function FeaturesPage() {
  const highlighted = FEATURES.filter((f) => f.highlight);
  const rest        = FEATURES.filter((f) => !f.highlight);

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-purple-600/8 blur-[140px] rounded-full" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/40 text-purple-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            Full platform overview
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              build & ship faster
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
            {BRAND_IDENTITY.description}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/pricing" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-6 py-3 transition-all shadow-lg shadow-blue-900/30">
              See Pricing <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/auth/signup" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl px-6 py-3 transition-all border border-white/20">
              Start Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Highlighted features ── */}
      {highlighted.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8 text-slate-200">Signature Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {highlighted.map((feat) => {
                const Icon     = feat.icon;
                const tierInfo = TIER_LABELS[feat.tier];
                return (
                  <div key={feat.title} className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-700/30 rounded-2xl p-8 hover:border-blue-600/50 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                        <Icon className="w-6 h-6 text-blue-400" />
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tierInfo.class}`}>
                        {tierInfo.label}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{feat.title}</h3>
                    <p className="text-slate-400">{feat.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── All features grid ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-slate-200">All Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((feat) => {
              const Icon     = feat.icon;
              const tierInfo = TIER_LABELS[feat.tier];
              return (
                <div key={feat.title} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-400" />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierInfo.class}`}>
                      {tierInfo.label}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1.5">{feat.title}</h3>
                  <p className="text-slate-400 text-sm">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 bg-gradient-to-br from-blue-950/40 to-purple-950/30 border-t border-slate-800">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Start building with Javari AI</h2>
          <p className="text-slate-400 mb-6 text-sm">Free forever. No credit card required.</p>
          <Link href="/auth/signup" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-8 py-4 transition-all">
            <Sparkles className="w-5 h-5" />
            Get Started Free
          </Link>
        </div>
      </section>
    </main>
  );
}
