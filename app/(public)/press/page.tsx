// app/(public)/press/page.tsx
// CR AudioViz AI — Press Kit
// 2026-02-21 — STEP 8 Go-Live

import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, Zap, Mail, ExternalLink, Sparkles } from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title: "Press Kit — CR AudioViz AI",
  description: "Brand story, assets, and media inquiries for CR AudioViz AI — the AI creative platform for creators and enterprises.",
};

const PRESS_ASSETS = [
  { name: "Logo Pack (SVG + PNG)",     href: "/press/assets/cr-audiovizai-logos.zip",    size: "~2 MB" },
  { name: "Brand Guidelines PDF",      href: "/press/assets/brand-guidelines.pdf",        size: "~4 MB" },
  { name: "Product Screenshots",       href: "/press/assets/screenshots.zip",             size: "~12 MB" },
  { name: "Executive Headshots",       href: "/press/assets/headshots.zip",               size: "~8 MB" },
  { name: "Fact Sheet (One-Pager)",    href: "/press/assets/cr-audiovizai-factsheet.pdf", size: "~1 MB" },
];

const KEY_FACTS = [
  { label: "Founded",    value: "2025" },
  { label: "HQ",        value: "Fort Myers, Florida, USA" },
  { label: "Stage",     value: "Public Beta" },
  { label: "Platform",  value: "Javari AI + Module Factory" },
  { label: "Mission",   value: "Your Story. Our Design." },
  { label: "EIN",       value: "39-3646201" },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Nav ── */}
      <div className="border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold">{BRAND_IDENTITY.name}</span>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* ── Header ── */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                          bg-blue-900/40 border border-blue-700/50 text-blue-300
                          text-xs font-semibold mb-6">
            <Sparkles className="w-3 h-3" />
            Media Resources
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            Press Kit
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
            Everything journalists and content creators need to cover CR AudioViz AI and Javari.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12">

          {/* ── Left column ── */}
          <div className="space-y-12">

            {/* Brand Story */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Brand Story</h2>
              <div className="space-y-4 text-slate-300 leading-relaxed">
                <p>
                  CR AudioViz AI was founded on a simple belief: <strong className="text-white">
                  every creator deserves enterprise-grade AI tools</strong> — without the
                  enterprise price tag or the enterprise complexity.
                </p>
                <p>
                  Based in Fort Myers, Florida, CR AudioViz AI built Javari — an autonomous AI
                  business partner that doesn&apos;t just answer questions, but takes action.
                  Javari can generate complete production-ready software modules, orchestrate
                  multi-agent AI teams, manage subscriptions and billing, and autonomously monitor
                  platform health — all through a unified, credit-based system.
                </p>
                <p>
                  The platform is built on the philosophy of <em>&ldquo;Your Story. Our Design&rdquo;</em> —
                  a commitment to helping creators, businesses, and enterprises tell their stories through
                  AI-powered tools that are as powerful as they are accessible. Credits never expire on
                  paid plans. Code you generate is yours. Build here, host anywhere.
                </p>
                <p>
                  In public beta since early 2026, CR AudioViz AI is targeting $1M ARR within its
                  first year, with diversified revenue across SaaS subscriptions, creator marketplace,
                  white-label enterprise, and grant funding for social impact programs serving
                  veterans, first responders, and underserved communities.
                </p>
              </div>
            </section>

            {/* Key Facts */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Key Facts</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {KEY_FACTS.map((fact) => (
                  <div key={fact.label}
                       className="px-4 py-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {fact.label}
                    </p>
                    <p className="text-sm font-semibold text-white">{fact.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Product Overview */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Product Overview</h2>
              <div className="space-y-4">
                {[
                  { name: "Javari AI", desc: "Autonomous AI business partner. Handles multi-agent orchestration, platform management, and complex task execution without requiring human step-by-step guidance." },
                  { name: "Module Factory", desc: "Generates complete production-ready software modules using multi-agent AI. A developer-level capability accessible to non-technical creators." },
                  { name: "CRAIverse", desc: "Planned virtual world platform with avatar-based AI interfaces, virtual real estate, and 20 social impact modules for underserved communities." },
                  { name: "Javari Spirits / Affiliates", desc: "Integrated affiliate marketplace with 300+ alcohol, finance, and lifestyle programs, plus trending product merchandising." },
                ].map((p) => (
                  <div key={p.name}
                       className="px-5 py-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <p className="font-bold text-white mb-1">{p.name}</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Boilerplate */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">About CR AudioViz AI (Boilerplate)</h2>
              <div className="px-5 py-4 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-300 leading-relaxed italic">
                CR AudioViz AI, LLC is an AI-powered creative platform company headquartered in Fort Myers,
                Florida. Founded by Roy and Cindy Henderson, the company builds Javari AI — an autonomous
                business partner that helps creators, businesses, and enterprises design, build, and scale
                their stories through AI. Operating under the mission &ldquo;Your Story. Our Design,&rdquo;
                CR AudioViz AI offers a comprehensive platform including AI chat, autonomous task execution,
                module generation, and an extensive affiliate ecosystem. The platform is currently in public
                beta. For more information, visit {BRAND_IDENTITY.url}.
              </div>
            </section>

          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-6">

            {/* Media contact */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Media Inquiries
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Contact</p>
                  <p className="text-white font-medium">Cindy Henderson, CMO</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Email</p>
                  <a href={`mailto:${BRAND_IDENTITY.support}`}
                     className="text-blue-400 hover:text-blue-300 transition-colors">
                    {BRAND_IDENTITY.support}
                  </a>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Response Time</p>
                  <p className="text-slate-300">Within 24 hours on business days</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Website</p>
                  <a href={BRAND_IDENTITY.url} target="_blank" rel="noopener noreferrer"
                     className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                    {BRAND_IDENTITY.url} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Download assets */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-400" />
                Press Assets
              </h3>
              <div className="space-y-2">
                {PRESS_ASSETS.map((asset) => (
                  <a key={asset.name} href={asset.href}
                     className="flex items-center justify-between px-3 py-2.5 rounded-lg
                                bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50
                                hover:border-slate-600 transition-all group">
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                      {asset.name}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {asset.size}
                      <Download className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-600">
                All assets are free to use for press coverage with attribution.
              </p>
            </div>

            {/* Social */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
              <h3 className="font-semibold text-white mb-3 text-sm">Follow Us</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Twitter / X</span>
                  <span className="text-blue-400">{BRAND_IDENTITY.twitter}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
