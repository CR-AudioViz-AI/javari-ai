// app/store/page.tsx
// Javari Module Store — Browse Page
// 2026-02-20 — STEP 6 Productization
//
// Server Component — lists all available modules from registry

import { Metadata } from "next";
import Link from "next/link";
import { Package, Star, Download, ArrowRight, Sparkles, Search } from "lucide-react";
import {
  MODULE_REGISTRY,
  getStats,
  type ModuleCategory,
  type ModuleRegistryEntry,
} from "@/lib/javari/store/registry";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title:       "Module Store — Javari AI",
  description: "Browse and install pre-built modules for your platform. One-click generation.",
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  stable:      { label: "Stable",      class: "bg-green-900/50 text-green-300 border border-green-700/40" },
  beta:        { label: "Beta",        class: "bg-amber-900/50 text-amber-300 border border-amber-700/40" },
  preview:     { label: "Preview",     class: "bg-blue-900/50 text-blue-300 border border-blue-700/40" },
  coming_soon: { label: "Coming Soon", class: "bg-slate-700 text-slate-400" },
};

const TIER_BADGE: Record<string, { label: string; class: string }> = {
  free:       { label: "Free",       class: "bg-slate-700 text-slate-300" },
  creator:    { label: "Creator+",   class: "bg-blue-900/50 text-blue-300 border border-blue-700/30" },
  pro:        { label: "Pro+",       class: "bg-purple-900/50 text-purple-300 border border-purple-700/30" },
  enterprise: { label: "Enterprise", class: "bg-gradient-to-r from-blue-900/50 to-purple-900/50 text-white border border-blue-600/30" },
};

function ModuleCard({ module: m }: { module: ModuleRegistryEntry }) {
  const statusBadge = STATUS_BADGE[m.status] ?? STATUS_BADGE.stable;
  const tierBadge   = TIER_BADGE[m.requiredTier] ?? TIER_BADGE.free;

  return (
    <Link
      href={`/store/${m.id}`}
      className="group flex flex-col bg-slate-900/70 border border-slate-800 hover:border-blue-700/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/10"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-slate-800 group-hover:bg-blue-900/30 rounded-xl flex items-center justify-center transition-colors">
          <Package className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.class}`}>
            {statusBadge.label}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierBadge.class}`}>
            {tierBadge.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <h3 className="font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">{m.name}</h3>
      <p className="text-slate-400 text-sm mb-4 flex-1 line-clamp-2">{m.tagline}</p>

      {/* File count */}
      <p className="text-xs text-slate-500 mb-4">
        {m.fileTree.length} files · {m.installTimeSec}s install
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" />
            {m.rating}
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            {m.installs.toLocaleString()}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

export default function StorePage() {
  const stats      = getStats();
  const categories = [...new Set(MODULE_REGISTRY.map((m) => m.category))];

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/3 w-[600px] h-[300px] bg-blue-600/8 blur-[100px] rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/40 text-blue-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Package className="w-4 h-4" />
            {stats.totalModules} modules · {stats.totalInstalls.toLocaleString()} installs
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Module{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Store
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mb-8">
            Browse and install pre-built modules. Javari AI generates the full codebase —
            pages, APIs, components, and database schemas — ready to commit.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 text-sm">
            {[
              { label: "Modules",     value: stats.totalModules  },
              { label: "Installs",    value: stats.totalInstalls.toLocaleString() },
              { label: "Avg Rating",  value: `${stats.avgRating} ⭐` },
              { label: "Categories",  value: stats.categories    },
            ].map((s) => (
              <div key={s.label}>
                <span className="font-bold text-white">{s.value}</span>{" "}
                <span className="text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category filter + grid */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-5xl mx-auto">

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            {(["all", ...categories] as const).map((cat) => (
              <span
                key={cat}
                className={`text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-all capitalize ${
                  cat === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cat === "all" ? "All Modules" : cat.replace(/-/g, " ")}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULE_REGISTRY.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 bg-gradient-to-br from-blue-950/40 to-purple-950/30 border-t border-slate-800">
        <div className="max-w-2xl mx-auto text-center">
          <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Don&apos;t see what you need?</h2>
          <p className="text-slate-400 mb-6 text-sm">
            Use the Module Factory to generate a custom module from a description.
            Javari AI builds the full codebase in seconds.
          </p>
          <Link
            href="/javari?mode=module_factory"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-6 py-3 transition-all"
          >
            <Package className="w-5 h-5" />
            Generate Custom Module
          </Link>
        </div>
      </section>
    </main>
  );
}
