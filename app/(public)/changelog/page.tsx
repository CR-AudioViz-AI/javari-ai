// app/(public)/changelog/page.tsx
// CR AudioViz AI — Version Changelog Page
// 2026-02-21 — STEP 9 Official Launch

import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Zap, Star, Wrench, Shield, AlertTriangle } from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";
import { CHANGELOG, type ChangeType } from "@/lib/launch/changelog";

export const metadata: Metadata = {
  title:       `Changelog — ${BRAND_IDENTITY.name}`,
  description: "Version history and release notes for CRAudioVizAI. See what's new, improved, and fixed.",
};

function TypeIcon({ type }: { type: ChangeType }) {
  switch (type) {
    case "feature":     return <Star      className="w-4 h-4 text-blue-400" />;
    case "improvement": return <Zap       className="w-4 h-4 text-violet-400" />;
    case "fix":         return <Wrench    className="w-4 h-4 text-emerald-400" />;
    case "security":    return <Shield    className="w-4 h-4 text-amber-400" />;
    case "breaking":    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  }
}

const TYPE_LABELS: Record<ChangeType, string> = {
  feature:     "Feature",
  improvement: "Improvement",
  fix:         "Fix",
  security:    "Security",
  breaking:    "Breaking",
};

const TYPE_COLORS: Record<ChangeType, string> = {
  feature:     "bg-blue-500/10 text-blue-300 border-blue-500/20",
  improvement: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  fix:         "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  security:    "bg-amber-500/10 text-amber-300 border-amber-500/20",
  breaking:    "bg-red-500/10 text-red-300 border-red-500/20",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white
                                   text-sm mb-10 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-3">Changelog</h1>
          <p className="text-slate-400 text-lg">
            What&apos;s new in {BRAND_IDENTITY.name}. Full version history and release notes.
          </p>
        </div>

        {/* Entries */}
        <div className="space-y-12">
          {CHANGELOG.map((entry, idx) => (
            <div key={entry.id} className="relative">
              {/* Timeline dot */}
              {idx < CHANGELOG.length - 1 && (
                <div className="absolute left-[11px] top-8 bottom-0 w-px bg-slate-800" />
              )}
              <div className="flex gap-5">
                <div className="shrink-0 mt-1 w-6 h-6 rounded-full bg-slate-800 border-2
                                border-slate-700 flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>

                <div className="flex-1 min-w-0 pb-2">
                  {/* Date + type */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <time className="text-sm text-slate-500 font-mono">{entry.date}</time>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
                                     text-xs font-medium border ${TYPE_COLORS[entry.type]}`}>
                      <TypeIcon type={entry.type} />
                      {TYPE_LABELS[entry.type]}
                    </span>
                    {idx === 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10
                                       text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Version + title */}
                  <div className="mb-1 text-xs font-mono text-slate-500">{entry.version}</div>
                  <h2 className="text-xl font-bold text-white mb-2">{entry.title}</h2>
                  <p className="text-slate-400 leading-relaxed mb-4">{entry.summary}</p>

                  {/* Highlights */}
                  {entry.highlights && (
                    <ul className="space-y-1.5">
                      {entry.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-sm">
            Questions?{" "}
            <a href="mailto:support@craudiovizai.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
