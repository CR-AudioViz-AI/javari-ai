// app/(public)/legal/LegalLayout.tsx
// CR AudioViz AI — Shared Legal Page Layout
// 2026-02-21 — STEP 8 Go-Live

import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

interface LegalLayoutProps {
  title:       string;
  lastUpdated: string;
  children:    React.ReactNode;
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Top nav strip ── */}
      <div className="border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">{BRAND_IDENTITY.name}</span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10 pb-8 border-b border-slate-800">
          <p className="text-sm text-slate-500 mb-2">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{title}</h1>
          <p className="text-sm text-slate-500">Last updated: {lastUpdated}</p>
        </div>

        {/* Legal content styles */}
        <div className="
          prose prose-invert prose-slate max-w-none
          prose-h2:text-xl prose-h2:font-bold prose-h2:text-white prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-base prose-h3:font-semibold prose-h3:text-slate-200 prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
          prose-ul:text-slate-300 prose-ul:space-y-2 prose-ul:my-4
          prose-li:leading-relaxed
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-white
          [&_section]:mb-8
        ">
          {children}
        </div>

        {/* ── Footer nav ── */}
        <div className="mt-16 pt-8 border-t border-slate-800">
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/legal/terms"   className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/legal/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
            <Link href="/support"       className="hover:text-white transition-colors">Contact Support</Link>
          </div>
          <p className="mt-4 text-xs text-slate-600">
            © {new Date().getFullYear()} {BRAND_IDENTITY.name}. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
