// app/enterprise/admin/page.tsx
// CR AudioViz AI — Enterprise Admin Dashboard
// 2026-02-21 — STEP 10 Enterprise

import { Metadata } from "next";
import Link from "next/link";
import {
  Building2, Users, CreditCard, Key, ShieldCheck, BarChart3,
  Settings, AlertCircle, CheckCircle, Clock, Activity
} from "lucide-react";

export const metadata: Metadata = {
  title: "Enterprise Admin — CRAudioVizAI",
  description: "Enterprise organization management, workspace controls, audit logs, and billing.",
};

// ── Static mock data (replaced by real data with auth context in production) ──

const MOCK_ORG = {
  name:       "Acme Corporation",
  plan:       "Enterprise",
  seats:      { used: 42, total: 100 },
  credits:    { used: 124500, total: 250000 },
  status:     "active",
};

const MOCK_WORKSPACES = [
  { name: "Engineering",  type: "engineering",  members: 18, creditsUsed: 62000, creditQuota: 100000 },
  { name: "Marketing",    type: "marketing",    members: 12, creditsUsed: 38500, creditQuota: 80000  },
  { name: "Operations",   type: "ops",          members:  8, creditsUsed: 15000, creditQuota: 40000  },
  { name: "Support",      type: "support",      members:  4, creditsUsed:  9000, creditQuota: 30000  },
];

const MOCK_AUDIT = [
  { action: "user.sso_login",      user: "alice@acme.com",   time: "2 min ago",   severity: "info"     },
  { action: "module.generated",    user: "bob@acme.com",     time: "5 min ago",   severity: "info"     },
  { action: "billing.plan_changed",user: "admin@acme.com",   time: "1 hour ago",  severity: "warn"     },
  { action: "admin.kill_switch",   user: "admin@acme.com",   time: "2 hours ago", severity: "critical" },
  { action: "workspace.member_added",user:"carol@acme.com",  time: "3 hours ago", severity: "info"     },
];

const MOCK_PARTNER_KEYS = [
  { prefix: "pk_live_AbC12", scopes: ["modules:read", "ai:chat"], active: true,  created: "2026-01-15" },
  { prefix: "pk_live_XyZ98", scopes: ["modules:write"],           active: false, created: "2026-01-08" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "blue" }: {
  label: string; value: string; sub: string; icon: React.ElementType; color?: string
}) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-500/10 text-blue-400",
    violet: "bg-violet-500/10 text-violet-400",
    emerald:"bg-emerald-500/10 text-emerald-400",
    amber:  "bg-amber-500/10 text-amber-400",
  };
  return (
    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info:     "bg-slate-700 text-slate-300",
    warn:     "bg-amber-500/20 text-amber-300",
    critical: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[severity] ?? map.info}`}>
      {severity}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EnterpriseAdminPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">{MOCK_ORG.name}</h1>
              <p className="text-xs text-slate-400">{MOCK_ORG.plan} Plan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Active
            </span>
            <Link href="/api/health/ready" target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500
                             text-xs text-slate-400 transition-all">
              System Health
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stat overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}      label="Seats"       value={`${MOCK_ORG.seats.used}/${MOCK_ORG.seats.total}`}          sub="42% utilization"       color="blue"    />
          <StatCard icon={CreditCard} label="Credits"     value={`${(MOCK_ORG.credits.used/1000).toFixed(0)}K`}             sub={`of ${MOCK_ORG.credits.total/1000}K pool`} color="violet" />
          <StatCard icon={Building2}  label="Workspaces"  value={String(MOCK_WORKSPACES.length)}                             sub="4 active teams"        color="emerald" />
          <StatCard icon={ShieldCheck}label="Audit Events"value="127"                                                        sub="Last 7 days"           color="amber"   />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* Workspace list */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm">Workspaces</h2>
              <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                + Add workspace
              </button>
            </div>
            <div className="divide-y divide-slate-800">
              {MOCK_WORKSPACES.map((ws) => {
                const pct = Math.round((ws.creditsUsed / ws.creditQuota) * 100);
                return (
                  <div key={ws.name} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{ws.name}</p>
                      <p className="text-xs text-slate-500">{ws.members} members · {ws.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{(ws.creditsUsed/1000).toFixed(0)}K / {(ws.creditQuota/1000).toFixed(0)}K</p>
                      <div className="w-24 h-1.5 rounded-full bg-slate-700 mt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct > 80 ? "bg-red-400" : pct > 60 ? "bg-amber-400" : "bg-blue-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit log */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm">Audit Log</h2>
              <span className="text-xs text-slate-500">Recent events</span>
            </div>
            <div className="divide-y divide-slate-800">
              {MOCK_AUDIT.map((ev, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="shrink-0">
                    {ev.severity === "critical" ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : ev.severity === "warn" ? (
                      <Clock className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Activity className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-300 truncate">{ev.action}</p>
                    <p className="text-xs text-slate-500">{ev.user}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <SeverityBadge severity={ev.severity} />
                    <p className="text-xs text-slate-600 mt-1">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-800">
              <Link href="/api/enterprise/audit" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View full audit log →
              </Link>
            </div>
          </div>
        </div>

        {/* Partner keys */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-400" />
              Partner API Keys
            </h2>
            <Link href="/api/partners"
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500
                             text-white font-medium transition-all">
              + Generate Key
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {MOCK_PARTNER_KEYS.map((k, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded">{k.prefix}…</code>
                  <div className="flex gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${k.active ? "text-emerald-400" : "text-slate-500"}`}>
                    {k.active ? "Active" : "Revoked"}
                  </span>
                  <span className="text-xs text-slate-600">{k.created}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "SSO Config",       href: "/enterprise/sso",     icon: ShieldCheck },
            { label: "Seat Management",  href: "/enterprise/seats",   icon: Users       },
            { label: "Billing",          href: "/account/billing",    icon: CreditCard  },
            { label: "Settings",         href: "/enterprise/settings",icon: Settings    },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href}
                  className="flex items-center gap-2 p-4 rounded-xl border border-slate-800
                             hover:border-slate-700 bg-slate-900 text-sm text-slate-300
                             hover:text-white transition-all">
              <Icon className="w-4 h-4 text-slate-500" />
              {label}
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
