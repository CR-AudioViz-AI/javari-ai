"use client"

// app/admin/javari/page.tsx
// Purpose: Javari Admin Dashboard — includes roadmap execution panel with live polling.
// Date: 2026-03-07 — updated: roadmap execution status panel added

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Bot, Brain, TrendingUp, MessageSquare, Video, Mic,
  Server, Database, Lightbulb, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, ArrowRight, Settings, Activity,
  Cpu, Layers, Shield, Clock, BarChart3, Zap
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

interface RoadmapStatus {
  ok          : boolean
  progress    : { total: number; completed: number; remaining: number; percentComplete: string; queueHealthy: boolean }
  lifecycle   : { pending: number; in_progress: number; verifying: number; completed: number; retry: number; blocked: number; failed: number; total: number }
  byType      : Record<string, { total: number; completed: number; pending: number; retry: number }>
  verificationGate : { gateEnforced: boolean; tasksVerified: number; tasksRetrying: number; tasksBlocked: number; falseCompletionsBlocked: number; artifactsCoverage: string }
  artifacts   : { total: number; tasksWithProof: number; byType: Record<string, number> }
  recentActivity: Array<{ id: string; title: string; status: string; updatedAt: string; type: string }>
  workerCycles: Array<{ cycleId: string; executedAt: string; cost: string; durationMs: number; status: string }>
  cronSchedule: Array<{ path: string; schedule: string; description: string }>
  generatedAt : string
  queryMs     : number
}

interface SystemHealth { mainSite: string; javariAI: string; vercel: string; database: string }
interface LearningStats { totalPatterns: number; knowledgeEntries: number; feedbackCount: number; helpfulRate: string }

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === "completed") return "text-green-400"
  if (s === "in_progress" || s === "verifying") return "text-blue-400"
  if (s === "retry") return "text-yellow-400"
  if (s === "blocked" || s === "failed") return "text-red-400"
  return "text-gray-400"
}

function statusIcon(s: string) {
  if (s === "completed")   return "✅"
  if (s === "verifying")   return "🔍"
  if (s === "in_progress") return "⚙️"
  if (s === "retry")       return "⚠️"
  if (s === "blocked")     return "🔴"
  if (s === "failed")      return "❌"
  return "⏳"
}

// ── Roadmap Panel ──────────────────────────────────────────────────────────

function RoadmapPanel({ data, loading }: { data: RoadmapStatus | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="animate-pulse text-gray-500">Loading roadmap status...</div>
      </div>
    )
  }
  if (!data) return null

  const p  = data.progress
  const lc = data.lifecycle
  const vg = data.verificationGate
  const pct = parseInt(p.percentComplete)

  return (
    <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-6 col-span-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Roadmap Execution</h2>
            <p className="text-xs text-gray-500">Updated {data.generatedAt.slice(11,19)} UTC · {data.queryMs}ms · polls every 10s</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${p.queueHealthy ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
          <span className="text-sm text-gray-400">{p.queueHealthy ? "Healthy" : "Check queue"}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">{p.completed} / {p.total} tasks complete</span>
          <span className="font-semibold text-purple-400">{p.percentComplete}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>0</span>
          <span>{p.remaining} remaining</span>
        </div>
      </div>

      {/* Lifecycle grid */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2 mb-5">
        {[
          { label: "Pending",     val: lc.pending,     color: "bg-gray-700"   },
          { label: "Running",     val: lc.in_progress, color: "bg-blue-500/30" },
          { label: "Verifying",   val: lc.verifying,   color: "bg-cyan-500/30" },
          { label: "Completed",   val: lc.completed,   color: "bg-green-500/30"},
          { label: "Retry",       val: lc.retry,       color: "bg-yellow-500/30"},
          { label: "Blocked",     val: lc.blocked,     color: "bg-red-500/30"  },
          { label: "Failed",      val: lc.failed,      color: "bg-red-700/30"  },
        ].map(({ label, val, color }) => (
          <div key={label} className={`${color} rounded-lg p-2 text-center border border-white/5`}>
            <div className="text-xl font-bold">{val}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Verification gate */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">Verification Gate</span>
            {vg.gateEnforced && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">ACTIVE</span>}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Verified complete</span>
              <span className="text-green-400">{vg.tasksVerified}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Retrying</span>
              <span className="text-yellow-400">{vg.tasksRetrying}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">False completions blocked</span>
              <span className="text-red-400">{vg.falseCompletionsBlocked}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Artifact coverage</span>
              <span className="text-purple-400">{vg.artifactsCoverage}</span>
            </div>
          </div>
        </div>

        {/* Task types */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">By Type</span>
          </div>
          <div className="space-y-1.5 text-sm">
            {Object.entries(data.byType).slice(0, 5).map(([type, counts]) => {
              const pct2 = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0
              return (
                <div key={type}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-gray-400 truncate">{type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-gray-500 ml-2">{counts.completed}/{counts.total}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${pct2}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium">Recent Activity</span>
          </div>
          <div className="space-y-1.5">
            {data.recentActivity.slice(0, 6).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span>{statusIcon(t.status)}</span>
                <span className={`${statusColor(t.status)} truncate flex-1`}>{t.title}</span>
                <span className="text-gray-600 shrink-0">{t.updatedAt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Worker cycles */}
      {data.workerCycles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">Recent Worker Cycles</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {data.workerCycles.map(w => (
              <div key={w.cycleId} className={`text-xs px-2 py-1 rounded border ${
                w.status === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}>
                {w.status === "success" ? "✅" : "❌"} {w.cost} · {w.durationMs}ms
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cron schedule */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400">Cron Schedule</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {data.cronSchedule.map(c => (
            <div key={c.path} className="text-xs text-gray-500">
              <span className="text-purple-400 font-mono">{c.schedule}</span> → {c.path}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function JavariAdmin() {
  const [roadmap,       setRoadmap]       = useState<RoadmapStatus | null>(null)
  const [roadmapLoading,setRoadmapLoading] = useState(true)
  const [systemHealth,  setSystemHealth]  = useState<SystemHealth | null>(null)
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null)
  const [voiceStatus,   setVoiceStatus]   = useState<{ ttsEnabled: boolean } | null>(null)
  const [suggestions,   setSuggestions]   = useState<Array<{ priority: string; type: string; message: string }>>([])
  const [isLoading,     setIsLoading]     = useState(true)
  const [lastRefresh,   setLastRefresh]   = useState<Date>(new Date())

  // Roadmap polls every 10 seconds independently
  const fetchRoadmap = useCallback(async () => {
    try {
      const res = await fetch("/api/javari/roadmap-status", { cache: "no-store" })
      const d   = await res.json()
      setRoadmap(d)
    } catch { /* non-blocking */ }
    finally { setRoadmapLoading(false) }
  }, [])

  useEffect(() => {
    fetchRoadmap()
    const t = setInterval(fetchRoadmap, 10_000)
    return () => clearInterval(t)
  }, [fetchRoadmap])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [healthRes, learnRes, voiceRes, suggestRes] = await Promise.all([
        fetch("/api/javari/business", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "Check system health" }),
        }),
        fetch("/api/javari/learn", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stats" }),
        }),
        fetch("/api/javari/voice", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        }),
        fetch("/api/javari/learn", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suggestions" }),
        }),
      ])
      const [hd, ld, vd, sd] = await Promise.all([
        healthRes.json().catch(() => ({})),
        learnRes.json().catch(() => ({})),
        voiceRes.json().catch(() => ({})),
        suggestRes.json().catch(() => ({})),
      ])
      if (hd.result?.services)  setSystemHealth(hd.result.services)
      if (ld.stats)             setLearningStats(ld.stats)
      setVoiceStatus(vd)
      setSuggestions(sd.suggestions ?? [])
    } catch { /* non-blocking */ }
    finally { setIsLoading(false); setLastRefresh(new Date()) }
  }, [])

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 30_000)
    return () => clearInterval(t)
  }, [loadData])

  const getStatusIcon = (status: string) => {
    if (status?.includes("✅") || status?.includes("Healthy"))
      return <CheckCircle className="w-5 h-5 text-green-500" />
    if (status?.includes("❌") || status?.includes("Down"))
      return <XCircle className="w-5 h-5 text-red-500" />
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Javari Admin Dashboard</h1>
              <p className="text-gray-400">Autonomous AI COO — Roadmap Execution Center</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MessageSquare, label: "Command Console", href: "/command",       color: "blue"   },
            { icon: Zap,           label: "Run Worker Now",  href: "#",              color: "purple", onClick: async () => { await fetch("/api/javari/start-roadmap", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({userId:"manual",maxTasks:5}) }); fetchRoadmap() } },
            { icon: Bot,           label: "Javari Hub",      href: "/javari",        color: "purple" },
            { icon: Settings,      label: "Autopilot",       href: "/admin/autopilot", color: "green" },
          ].map((link, i) => (
            link.onClick ? (
              <button
                key={i}
                onClick={link.onClick}
                className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500/50 transition text-left w-full"
              >
                <link.icon className="w-6 h-6 text-purple-400" />
                <span>{link.label}</span>
                <Zap className="w-4 h-4 ml-auto text-purple-400" />
              </button>
            ) : (
              <Link
                key={i}
                href={link.href}
                className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500/50 transition"
              >
                <link.icon className="w-6 h-6 text-purple-400" />
                <span>{link.label}</span>
                <ArrowRight className="w-4 h-4 ml-auto text-gray-500" />
              </Link>
            )
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ROADMAP EXECUTION PANEL — full width, top of grid */}
          <RoadmapPanel data={roadmap} loading={roadmapLoading} />

          {/* System Health */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              System Health
            </h2>
            {systemHealth ? (
              <div className="space-y-3">
                {Object.entries(systemHealth).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(String(value))}
                      <span className="text-sm">{String(value).includes("✅") ? "Healthy" : String(value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-500">Loading...</p>}
          </div>

          {/* Learning Stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Learning Progress
            </h2>
            {learningStats ? (
              <div className="space-y-4">
                {[
                  ["Patterns Learned",  learningStats.totalPatterns],
                  ["Knowledge Entries", learningStats.knowledgeEntries],
                  ["Feedback Received", learningStats.feedbackCount],
                  ["Helpful Rate",      learningStats.helpfulRate],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className={`font-medium ${label === "Helpful Rate" ? "text-green-400" : ""}`}>{String(val)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-500">Loading...</p>}
          </div>

          {/* Voice/Video */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              Voice &amp; Video
            </h2>
            <div className="space-y-4">
              {[
                ["Voice (ElevenLabs)", !!voiceStatus?.ttsEnabled],
                ["Video (D-ID)",       true],
                ["Video (HeyGen)",     true],
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <span className="text-gray-400">{label}</span>
                  <div className="flex items-center gap-2">
                    {ok
                      ? <CheckCircle className="w-5 h-5 text-green-500" />
                      : <XCircle    className="w-5 h-5 text-red-500" />}
                    <span>{ok ? "Ready" : "Not configured"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Improvement Suggestions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Improvement Suggestions
            </h2>
            {suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        s.priority === "high"   ? "bg-red-500/20 text-red-400" :
                        s.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>{s.priority}</span>
                      <span className="text-sm font-medium">{s.type.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{s.message}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-500">No suggestions. Keep using Javari to generate learning data.</p>}
          </div>

        </div>

        <p className="text-xs text-gray-700 mt-6 text-center">
          Last full refresh: {lastRefresh.toLocaleTimeString()} · Roadmap panel polls every 10s automatically
        </p>
      </div>
    </div>
  )
}
