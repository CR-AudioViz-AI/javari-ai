// app/store/[module]/page.tsx
// Javari Module Store — Module Detail Page
// 2026-02-20 — STEP 6 Productization
//
// Server Component — shows full module spec, file tree preview, features, and install CTA.
// Install = triggers /api/factory with the module blueprint (placeholder confirmation).

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Package, Star, Download, ArrowLeft, ArrowRight,
  Clock, Code2, Database, FileCode2, Layers,
  CheckCircle, Zap, Crown, Shield, Users,
  Sparkles, ExternalLink, Tag, Globe,
} from "lucide-react";
import {
  MODULE_REGISTRY,
  type ModuleRegistryEntry,
} from "@/lib/javari/store/registry";

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ module: string }> }
): Promise<Metadata> {
  const { module: slug } = await params;
  const mod = MODULE_REGISTRY.find((m) => m.id === slug);
  if (!mod) return { title: "Module Not Found — Javari Store" };
  return {
    title:       `${mod.name} — Javari Module Store`,
    description: mod.tagline,
  };
}

// ── Static params (for SSG) ───────────────────────────────────────────────────

export function generateStaticParams() {
  return MODULE_REGISTRY.map((m) => ({ module: m.id }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILE_CATEGORY_ICONS: Record<string, React.ElementType> = {
  page:      Globe,
  layout:    Layers,
  api_route: Code2,
  component: FileCode2,
  hook:      Zap,
  util:      Package,
  type:      Tag,
  schema:    Database,
  test:      CheckCircle,
  config:    Shield,
  index:     FileCode2,
};

const TIER_LABELS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  free:       { label: "Free",       icon: Zap,       cls: "text-slate-300 bg-slate-700"    },
  creator:    { label: "Creator",    icon: Star,       cls: "text-sky-300 bg-sky-900/60"    },
  pro:        { label: "Pro",        icon: Crown,      cls: "text-violet-300 bg-violet-900/60" },
  enterprise: { label: "Enterprise", icon: Users,      cls: "text-amber-300 bg-amber-900/60" },
};

const COMPLEXITY_LABELS: Record<string, string> = {
  minimal:  "Minimal — ~4–6 files",
  standard: "Standard — ~8–12 files",
  full:     "Full — ~14–20 files",
};

const STATUS_COLORS: Record<string, string> = {
  stable:      "text-green-400  bg-green-900/40  border-green-700/50",
  beta:        "text-yellow-400 bg-yellow-900/40 border-yellow-700/50",
  preview:     "text-sky-400    bg-sky-900/40    border-sky-700/50",
  coming_soon: "text-slate-400  bg-slate-800     border-slate-700",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rating: ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-slate-600"}`}
        />
      ))}
      <span className="text-sm text-slate-400 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Related modules ──────────────────────────────────────────────────────────

function RelatedModules({ current }: { current: ModuleRegistryEntry }) {
  const related = MODULE_REGISTRY
    .filter((m) => m.id !== current.id && m.category === current.category)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-4">Related Modules</h2>
      <div className="space-y-3">
        {related.map((m) => (
          <Link
            key={m.id}
            href={`/store/${m.id}`}
            className="flex items-center justify-between px-4 py-3 rounded-xl
                       bg-slate-800/50 border border-slate-700/50 hover:border-slate-600
                       transition-all group"
          >
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                {m.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{m.tagline}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default async function ModuleDetailPage(
  { params }: { params: Promise<{ module: string }> }
) {
  const { module: slug } = await params;
  const mod = MODULE_REGISTRY.find((m) => m.id === slug);
  if (!mod) notFound();

  const tierInfo  = TIER_LABELS[mod.requiredTier] ?? TIER_LABELS.free;
  const TierIcon  = tierInfo.icon;
  const statusCls = STATUS_COLORS[mod.status] ?? STATUS_COLORS.stable;
  const totalLines = mod.fileTree.reduce((s, f) => s + (f.lines ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Breadcrumb ── */}
      <div className="border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-slate-400">
          <Link href="/store" className="hover:text-white transition-colors flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            Module Store
          </Link>
          <span>/</span>
          <span className="text-white font-medium">{mod.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">

          {/* ── Main content ── */}
          <div className="space-y-10">

            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                                  text-xs font-semibold border uppercase tracking-wider
                                  ${statusCls}`}>
                  {mod.status.replace("_", " ")}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                                  text-xs font-semibold ${tierInfo.cls}`}>
                  <TierIcon className="w-3.5 h-3.5" />
                  Requires {tierInfo.label}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium
                                 bg-slate-800 text-slate-300 border border-slate-700">
                  {mod.category}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
                {mod.name}
              </h1>
              <p className="text-xl text-slate-300 mb-4">{mod.tagline}</p>
              <p className="text-slate-400 leading-relaxed">{mod.description}</p>

              <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-slate-400">
                <StarRating rating={mod.rating} />
                <span className="flex items-center gap-1.5">
                  <Download className="w-4 h-4" />
                  {mod.installs.toLocaleString()} installs
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  ~{mod.installTimeSec}s to generate
                </span>
                <span className="flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  v{mod.version}
                </span>
              </div>
            </div>

            {/* Features */}
            <section>
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                What&apos;s Included
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mod.features.map((feat) => (
                  <div key={feat}
                       className="flex items-start gap-3 px-4 py-3 rounded-xl
                                  bg-slate-800/50 border border-slate-700/50">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-200">{feat}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* File tree preview */}
            <section>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-sky-400" />
                Generated File Structure
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                {mod.fileTree.length} files · ~{totalLines.toLocaleString()} lines of production-ready TypeScript
              </p>
              <div className="rounded-xl bg-slate-900 border border-slate-700/60 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-700/50
                                flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="text-red-400">●</span>
                  <span className="text-yellow-400">●</span>
                  <span className="text-green-400">●</span>
                  <span className="ml-2">project root</span>
                </div>
                <div className="p-4 space-y-1.5">
                  {mod.fileTree.map((file, i) => {
                    const Icon = FILE_CATEGORY_ICONS[file.category] ?? Package;
                    const depth = (file.path.match(/\//g) || []).length;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm font-mono"
                        style={{ paddingLeft: `${depth * 16}px` }}
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-sky-300">{file.path.split("/").pop()}</span>
                        <span className="text-slate-600 text-xs ml-auto">
                          {file.path.split("/").slice(0, -1).join("/")}/
                        </span>
                        {file.lines && (
                          <span className="text-slate-500 text-xs ml-2">~{file.lines}L</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Tags */}
            {mod.tags.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-slate-400 mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {mod.tags.map((tag) => (
                    <span key={tag}
                          className="px-3 py-1 rounded-full text-xs font-medium
                                     bg-slate-800 text-slate-300 border border-slate-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-6">

            {/* Install card */}
            <div className="sticky top-6 rounded-2xl border border-slate-700/60
                            bg-slate-900 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl font-extrabold text-white">Free to Install</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${tierInfo.cls}`}>
                    {tierInfo.label}+ plan
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-6">
                  Credits consumed per install: ~{Math.ceil(mod.fileTree.length * 2.5)}
                </p>

                {/* Install CTA */}
                <Link
                  href={`/javari?mode=module_factory&module=${encodeURIComponent(mod.id)}&name=${encodeURIComponent(mod.name)}`}
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-6
                             rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold
                             text-sm transition-all hover:scale-[1.02] active:scale-[0.98]
                             shadow-lg shadow-violet-900/40"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate &amp; Install
                </Link>

                <p className="text-xs text-center text-slate-500 mt-3">
                  Uses Javari AI Module Factory · ~{mod.installTimeSec}s
                </p>

                {/* Stats */}
                <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Complexity</p>
                    <p className="text-white font-medium capitalize">{mod.complexity}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Auth</p>
                    <p className="text-white font-medium capitalize">{mod.auth.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Files</p>
                    <p className="text-white font-medium">{mod.fileTree.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Author</p>
                    <p className="text-white font-medium truncate">{mod.author}</p>
                  </div>
                </div>
              </div>

              {/* Demo link */}
              {mod.demoUrl && (
                <div className="px-6 pb-6">
                  <a
                    href={mod.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                               border border-slate-700 hover:border-slate-500 text-slate-300
                               text-sm font-medium transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Live Demo
                  </a>
                </div>
              )}
            </div>

            {/* Related */}
            <RelatedModules current={mod} />

            {/* Back */}
            <Link
              href="/store"
              className="flex items-center gap-2 text-sm text-slate-400
                         hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Module Store
            </Link>
          </aside>

        </div>
      </div>
    </main>
  );
}
