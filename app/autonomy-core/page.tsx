// app/autonomy-core/page.tsx
// CR AudioViz AI — Autonomy Core Admin Dashboard
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode

import { Metadata } from "next";
import {
  Activity, AlertCircle, CheckCircle, Clock, Code2,
  Eye, RefreshCw, Shield, Zap, XCircle, Info, ToggleLeft
} from "lucide-react";

export const metadata: Metadata = {
  title: "Autonomy Core — CRAudioVizAI",
  description: "Javari autonomous self-healing ecosystem — cycle monitoring, patch history, ring controls.",
};

// ── Static data shapes (live data served by /api/autonomy-core/status) ────────

interface FlagRow { key: string; default: string; description: string; }
const ENV_FLAGS: FlagRow[] = [
  { key: "AUTONOMOUS_CORE_ENABLED",             default: "false",      description: "Master on/off switch" },
  { key: "AUTONOMOUS_CORE_MODE",                default: "continuous", description: "continuous | manual | dry_run" },
  { key: "AUTONOMOUS_CORE_RING",                default: "2",          description: "1=log-only | 2=auto-fix safe | 3=all" },
  { key: "AUTONOMOUS_CORE_SCOPE",               default: "core_only",  description: "Always core_only for STEP 11" },
  { key: "AUTONOMOUS_CORE_INTERVAL_MINUTES",    default: "15",         description: "Minutes between cron cycles" },
  { key: "AUTONOMOUS_CORE_MAX_PATCHES_PER_CYCLE", default: "3",        description: "Ceiling on auto-applied patches" },
  { key: "AUTONOMOUS_CORE_KILL_SWITCH",         default: "false",      description: "true → halt all loops immediately" },
  { key: "AUTONOMOUS_CORE_REQUIRE_VALIDATOR",   default: "true",       description: "Validate patch before applying" },
  { key: "AUTONOMOUS_CORE_DEGRADED_ON_ANOMALY", default: "true",       description: "Halt Ring 2 if critical anomaly found" },
];

interface RingRow { ring: number; label: string; behavior: string; autoApply: boolean; }
const RINGS: RingRow[] = [
  { ring: 1, label: "Observe",       behavior: "Detect & log anomalies only. No code changes.",                    autoApply: false },
  { ring: 2, label: "Auto-Fix Safe", behavior: "Apply pre-approved, reversible fixes: runtime declarations, remove console.log, add dynamic export.", autoApply: true },
  { ring: 3, label: "Structural",    behavior: "Larger refactors & logic changes. Always requires validator + manual review. (Not active in STEP 11)", autoApply: false },
];

interface FixTypeRow { type: string; description: string; ring: number; safe: boolean; }
const FIX_TYPES: FixTypeRow[] = [
  { type: "add_runtime_declaration", description: "Add `export const runtime = 'nodejs'` to API route",     ring: 2, safe: true },
  { type: "add_dynamic_export",      description: "Add `export const dynamic = 'force-dynamic'`",           ring: 2, safe: true },
  { type: "remove_console_log",      description: "Strip console.log() calls from production code",         ring: 2, safe: true },
  { type: "add_cache_header_comment",description: "Add Cache-Control TODO comment near GET handler",        ring: 2, safe: true },
  { type: "wrap_promise_catch",      description: "Wrap bare fetch() in try/catch (Ring 3 — not applied)", ring: 3, safe: false },
  { type: "add_error_boundary_comment", description: "Add error boundary reminder comment",                 ring: 3, safe: false },
];

// ── Components ─────────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: "green" | "amber" | "red" | "blue" | "slate" }) {
  const cls = {
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/15  text-amber-300  border-amber-500/30",
    red:   "bg-red-500/15    text-red-300    border-red-500/30",
    blue:  "bg-blue-500/15   text-blue-300   border-blue-500/30",
    slate: "bg-slate-700     text-slate-300  border-slate-600",
  }[color];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function AutonomyCorePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-950/80 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Autonomy Core</h1>
              <p className="text-xs text-slate-400">Javari self-healing ecosystem — STEP 11</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge label="FLAGGED OFF BY DEFAULT" color="amber" />
            <Badge label="Ring 2 — Safe Auto-Fix" color="blue" />
            <Badge label="Scope: core_only" color="slate" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Safety callout */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Safety-First Design</p>
            <p className="text-xs text-amber-400/80 mt-1">
              Autonomy Core is <strong>disabled by default</strong> via <code className="font-mono bg-amber-500/10 px-1 rounded">AUTONOMOUS_CORE_ENABLED=false</code>.
              Ring 2 only applies pre-approved, fully reversible fixes. No billing, no DB schema, no auth, no permissions, no marketplace changes — ever.
              Every action is immutably logged to audit_log. Kill switch halts all loops instantly.
            </p>
          </div>
        </div>

        {/* Live status panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: ToggleLeft, label: "Master Switch",   value: "OFF",        sub: "AUTONOMOUS_CORE_ENABLED",  color: "amber" },
            { icon: Activity,   label: "Ring Level",      value: "Ring 2",     sub: "Safe auto-fix",            color: "blue"  },
            { icon: Clock,      label: "Interval",        value: "15 min",     sub: "Cron cadence (when ON)",   color: "slate" },
            { icon: Shield,     label: "Validator",       value: "Required",   sub: "Score ≥ 75 to apply",     color: "green" },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} className="rounded-xl bg-slate-900 border border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* Environment flags */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <SectionHeader icon={Code2} title="Feature Flags" sub="Set in Vercel environment variables" />
            </div>
            <div className="divide-y divide-slate-800">
              {ENV_FLAGS.map((f) => (
                <div key={f.key} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs font-mono text-blue-300">{f.key}</code>
                    <span className="text-xs font-mono text-slate-400">
                      default: <span className="text-emerald-400">{f.default}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ring definitions */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <SectionHeader icon={Shield} title="Ring Architecture" sub="Escalating automation levels" />
            </div>
            <div className="divide-y divide-slate-800">
              {RINGS.map((r) => (
                <div key={r.ring} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r.ring === 2 ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                      {r.ring}
                    </span>
                    <span className="text-sm font-medium text-white">{r.label}</span>
                    {r.ring === 2 && <Badge label="ACTIVE" color="blue" />}
                    {r.ring === 3 && <Badge label="NOT IN STEP 11" color="slate" />}
                    {r.autoApply ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{r.behavior}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Approved fix types */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <SectionHeader icon={RefreshCw} title="Approved Fix Types" sub="Ring 2 will only apply these deterministic, safe transforms" />
          </div>
          <div className="divide-y divide-slate-800">
            {FIX_TYPES.map((ft) => (
              <div key={ft.type} className="px-5 py-3 flex items-center gap-4">
                <div className="shrink-0">
                  {ft.safe ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono text-blue-300">{ft.type}</code>
                  <p className="text-xs text-slate-500 mt-0.5">{ft.description}</p>
                </div>
                <div className="shrink-0">
                  <Badge
                    label={ft.safe ? `Ring ${ft.ring} ✓` : `Ring ${ft.ring} — blocked`}
                    color={ft.safe ? "green" : "slate"}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API endpoints */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <SectionHeader icon={Activity} title="API Endpoints" sub="Protected by AUTONOMY_CORE_ADMIN_SECRET" />
          </div>
          <div className="divide-y divide-slate-800">
            {[
              { method: "GET",  path: "/api/autonomy-core/run",      desc: "Config + flag status" },
              { method: "POST", path: "/api/autonomy-core/run",      desc: "Trigger cycle (add ?dry=1 for dry run, ?force=1 to bypass enabled flag)" },
              { method: "GET",  path: "/api/autonomy-core/status",   desc: "Recent cycles + patches from Supabase" },
              { method: "POST", path: "/api/autonomy-core/rollback", desc: "Roll back a specific applied patch" },
            ].map((ep) => (
              <div key={`${ep.method}${ep.path}`} className="px-5 py-3 flex items-center gap-4">
                <span className={`text-xs font-mono font-bold w-10 shrink-0 ${ep.method === "GET" ? "text-emerald-400" : "text-blue-400"}`}>
                  {ep.method}
                </span>
                <code className="text-xs font-mono text-slate-300 flex-1">{ep.path}</code>
                <p className="text-xs text-slate-500 hidden sm:block">{ep.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rollback plan */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <SectionHeader icon={Info} title="Rollback Plan" sub="How to undo any Ring 2 patch" />
          <div className="space-y-2 text-xs text-slate-400">
            <p><span className="text-white font-medium">Option 1 — API:</span> POST /api/autonomy-core/rollback with <code className="font-mono bg-slate-800 px-1 rounded">patchId</code> + admin secret. Restores oldContent to GitHub via PUT.</p>
            <p><span className="text-white font-medium">Option 2 — Git:</span> <code className="font-mono bg-slate-800 px-1 rounded">git revert &lt;commit-sha&gt;</code> — every Ring 2 commit is clearly labelled <code className="font-mono">fix(autonomy-ring2): ...</code>.</p>
            <p><span className="text-white font-medium">Option 3 — Kill switch:</span> Set <code className="font-mono bg-slate-800 px-1 rounded">AUTONOMOUS_CORE_KILL_SWITCH=true</code> in Vercel env → halts all cycles immediately.</p>
            <p><span className="text-white font-medium">Option 4 — Disable:</span> Set <code className="font-mono bg-slate-800 px-1 rounded">AUTONOMOUS_CORE_ENABLED=false</code> → all cycles return status=halted.</p>
          </div>
        </div>

        {/* Live data notice */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-600">
            Live cycle data available at{" "}
            <a href="/api/autonomy-core/status" className="text-blue-500 hover:underline font-mono">/api/autonomy-core/status</a>.
            This dashboard shows static configuration — connect to status endpoint for real-time data.
          </p>
        </div>

      </div>
    </div>
  );
}
