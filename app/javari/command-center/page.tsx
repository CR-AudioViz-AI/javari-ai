// app/javari/command-center/page.tsx
// Purpose: Javari Mission Control — real-time investor-grade operational dashboard.
//          Polls /api/javari/dashboard every 5 seconds.
//          No static numbers. All data live from Supabase via API.
// Date: 2026-03-10

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ProgressGauge }  from "@/components/dashboard/ProgressGauge"
import { ExecutionStats } from "@/components/dashboard/ExecutionStats"
import { CategoryChart }  from "@/components/dashboard/CategoryChart"
import { ArtifactPanel }  from "@/components/dashboard/ArtifactPanel"
import { WorkerTable }    from "@/components/dashboard/WorkerTable"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  ok:          boolean
  generatedAt: string
  queryMs:     number
  progress: {
    total:      number
    completed:  number
    pending:    number
    running:    number
    verifying:  number
    blocked:    number
    retry:      number
    remaining:  number
    pct:        number
    queueHealthy: boolean
  }
  execution: {
    tasksLastHour:   number
    tasksLastDay:    number
    etaMinutes:      number | null
    velocityBuckets: number[]
  }
  categories: Array<{
    id:        string
    label:     string
    total:     number
    completed: number
    pct:       number
  }>
  artifacts: {
    total:      number
    aiOutputs:  number
    commits:    number
    migrations: number
    deploys:    number
    patches:    number
  }
  sources: Record<string, number>
  workers: Array<{
    cycleId:    string
    executedAt: string
    cost:       number
    durationMs: number
    status:     string
    lastActive: string
  }>
  activity: Array<{
    id:      string
    title:   string
    phase:   string
    source:  string
    elapsed: string
  }>
}

// ── Animated Counter ──────────────────────────────────────────────────────────

function AnimCounter({
  value,
  color = "#00ff88",
  size  = "2rem",
}: {
  value: number
  color?: string
  size?:  string
}) {
  const [n, setN]     = useState(value)
  const fromRef       = useRef(value)
  const rafRef        = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const to    = value
    if (from === to) return
    const dur   = 700
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setN(Math.round(from + (to - from) * e))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize:   size,
      fontWeight: "700",
      color,
      lineHeight: 1,
      textShadow: `0 0 20px ${color}50`,
    }}>
      {n.toLocaleString()}
    </span>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#00ff88" }: { data: number[]; color?: string }) {
  if (!data?.length) return null
  const max  = Math.max(...data, 1)
  const w    = 120
  const h    = 32
  const pts  = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - (v / max) * h}`
  ).join(" ")
  return (
    <svg width={w} height={h} style={{ overflow: "visible", opacity: 0.7 }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ label, status }: { label: string; status?: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      paddingBottom: "0.6rem",
      marginBottom: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ width: "2px", height: "14px", background: "#00ff88", boxShadow: "0 0 6px #00ff88" }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize:   "0.6rem",
          letterSpacing: "0.2em",
          color:      "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
        }}>
          {label}
        </span>
      </div>
      {status && (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize:   "0.55rem",
          letterSpacing: "0.12em",
          color: "#00ff8870",
          textTransform: "uppercase",
        }}>
          {status}
        </span>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function Panel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#0a0a0f",
      border: "1px solid rgba(255,255,255,0.07)",
      padding: "1.25rem",
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {/* Corner accent */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: "24px", height: "2px",
        background: "linear-gradient(90deg, #00ff88, transparent)",
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: "2px", height: "24px",
        background: "linear-gradient(180deg, #00ff88, transparent)",
      }} />
      {children}
    </div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({ items }: { items: DashboardData["activity"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {items.slice(0, 7).map((item, i) => (
        <div key={item.id} style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "0.55rem 0",
          borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
        }}>
          <div style={{
            width: "4px", height: "4px", borderRadius: "50%",
            background: item.source === "planner" ? "#818cf8" : "#00ff88",
            boxShadow: `0 0 4px ${item.source === "planner" ? "#818cf8" : "#00ff88"}`,
            marginTop: "5px",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              color: "rgba(255,255,255,0.6)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {item.title}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.15rem" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                color: "rgba(255,255,255,0.2)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {item.phase.replace(/_/g, " ")}
              </span>
              <span style={{ color: "rgba(255,255,255,0.1)", fontSize: "0.55rem" }}>·</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                color: "rgba(255,255,255,0.2)",
              }}>
                {item.elapsed}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<string>("")
  const [refreshCount, setRefreshCount] = useState(0)
  const [pulse, setPulse] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_data = useCallback(async () => {
    try {
      const res  = await fetch("/api/javari/dashboard", { cache: "no-store" })
      const json = await res.json() as DashboardData
      if (json.ok !== false) {
        setData(json)
        setError(null)
        setRefreshCount(c => c + 1)
        setLastRefresh(new Date().toLocaleTimeString("en-US", {
          hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
        }))
        setPulse(true)
        setTimeout(() => setPulse(false), 400)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_data()
    intervalRef.current = setInterval(fetch_data, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetch_data])

  const d = data

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#060609",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#00ff88",
        flexDirection: "column",
        gap: "1rem",
      }}>
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.3em", opacity: 0.7 }}>
          INITIALIZING MISSION CONTROL
        </div>
        <div style={{
          width: "160px", height: "2px",
          background: "rgba(0,255,136,0.15)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "-100%", bottom: 0, width: "60%",
            background: "linear-gradient(90deg, transparent, #00ff88, transparent)",
            animation: "scan 1.2s linear infinite",
          }} />
        </div>
        <style>{`@keyframes scan { to { left: 200% } }`}</style>
      </div>
    )
  }

  const pct         = d?.progress.pct         ?? 0
  const total       = d?.progress.total       ?? 0
  const completed   = d?.progress.completed   ?? 0
  const remaining   = d?.progress.remaining   ?? 0
  const running     = d?.progress.running     ?? 0
  const pending     = d?.progress.pending     ?? 0
  const verifying   = d?.progress.verifying   ?? 0
  const blocked     = d?.progress.blocked     ?? 0
  const lastHour    = d?.execution.tasksLastHour ?? 0
  const etaMins     = d?.execution.etaMinutes    ?? null
  const velocity    = d?.execution.velocityBuckets ?? []
  const cats        = d?.categories              ?? []
  const artifacts   = d?.artifacts               ?? { total:0,aiOutputs:0,commits:0,migrations:0,deploys:0,patches:0 }
  const workers     = d?.workers                 ?? []
  const activity    = d?.activity                ?? []
  const sources     = d?.sources                 ?? {}
  const queryMs     = d?.queryMs                 ?? 0
  const plannerTasks = sources.planner            ?? 0
  const roadmapTasks = sources.roadmap            ?? 0

  const etaLabel = etaMins == null
    ? remaining === 0 ? "COMPLETE" : "CALCULATING"
    : etaMins < 60
      ? `~${etaMins}m`
      : `~${(etaMins / 60).toFixed(1)}h`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #060609;
          color: #e2e8f0;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060609; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); border-radius: 2px; }

        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.15 } }
        @keyframes slideIn {
          from { opacity:0; transform: translateY(4px) }
          to   { opacity:1; transform: translateY(0)   }
        }

        .dashboard-grid {
          display: grid;
          gap: 1px;
          background: rgba(255,255,255,0.04);
        }

        @media (max-width: 900px) {
          .cat-grid { grid-template-columns: 1fr !important; }
          .main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#060609",
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,255,136,0.04) 0%, transparent 70%),
          linear-gradient(rgba(0,255,136,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.015) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        fontFamily: "'JetBrains Mono', monospace",
        padding: "1.25rem",
        maxWidth: "1600px",
        margin: "0 auto",
      }}>

        {/* ── TOPBAR ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "1.05rem",
                fontWeight: "800",
                letterSpacing: "0.06em",
                color: "#ffffff",
                lineHeight: 1,
              }}>
                JAVARI <span style={{ color: "#00ff88" }}>MISSION CONTROL</span>
              </div>
              <div style={{
                fontSize: "0.55rem",
                letterSpacing: "0.25em",
                color: "rgba(255,255,255,0.25)",
                marginTop: "0.2rem",
                textTransform: "uppercase",
              }}>
                CR AudioViz AI — Autonomous Operations Dashboard
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {/* Live indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{
                width: "5px", height: "5px", borderRadius: "50%",
                background: "#00ff88",
                boxShadow: "0 0 8px #00ff88",
                animation: "blink 1.8s ease-in-out infinite",
                display: "inline-block",
              }} />
              <span style={{
                fontSize: "0.55rem",
                letterSpacing: "0.2em",
                color: "#00ff8880",
                textTransform: "uppercase",
              }}>
                LIVE · 5s REFRESH
              </span>
            </div>

            {/* Last refresh */}
            <div style={{
              fontSize: "0.6rem",
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.06em",
              transition: "opacity 0.3s",
              opacity: pulse ? 1 : 0.6,
            }}>
              {lastRefresh || "—"}
            </div>

            {/* Query time */}
            <div style={{
              fontSize: "0.55rem",
              color: queryMs < 300 ? "#00ff8840" : "#fbbf2440",
              letterSpacing: "0.1em",
            }}>
              {queryMs}ms
            </div>
          </div>
        </div>

        {/* ── ROW 1: GLOBAL PROGRESS ─────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
          gap: "1px",
          background: "rgba(255,255,255,0.04)",
          marginBottom: "1px",
        }}>
          {/* Gauge */}
          <Panel>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem" }}>
              <ProgressGauge pct={pct} size={160} sublabel={`${completed.toLocaleString()} / ${total.toLocaleString()}`} />
            </div>
          </Panel>

          {/* Completed */}
          <Panel>
            <SectionHeader label="Tasks Completed" />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <AnimCounter value={completed} color="#00ff88" size="2.5rem" />
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
                of {total.toLocaleString()} total tasks
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Sparkline data={velocity} color="#00ff88" />
            </div>
          </Panel>

          {/* Remaining */}
          <Panel>
            <SectionHeader label="Remaining" />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <AnimCounter value={remaining} color={remaining === 0 ? "#00ff88" : "#fbbf24"} size="2.5rem" />
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}>
                tasks in queue
              </div>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { label: "ROADMAP", value: roadmapTasks, color: "#60a5fa" },
                { label: "PLANNER", value: plannerTasks, color: "#818cf8" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${s.color}22`,
                  padding: "0.25rem 0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}>
                  <span style={{ fontSize: "0.55rem", color: s.color, letterSpacing: "0.1em" }}>{s.label}</span>
                  <span style={{ fontWeight: "700", fontSize: "0.65rem", color: "rgba(255,255,255,0.6)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Tasks per hour */}
          <Panel>
            <SectionHeader label="Velocity" status="REAL-TIME" />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <AnimCounter value={lastHour} color="#60a5fa" size="2.5rem" />
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}>
                tasks completed / hour
              </div>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
                LAST 24H: {d?.execution.tasksLastDay ?? 0} TASKS
              </div>
            </div>
          </Panel>

          {/* ETA */}
          <Panel>
            <SectionHeader label="Est. Completion" />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize:   remaining === 0 ? "1.4rem" : "2.5rem",
                fontWeight: "700",
                color:      remaining === 0 ? "#00ff88" : "#f97316",
                lineHeight: 1,
                textShadow: `0 0 20px ${remaining === 0 ? "#00ff88" : "#f97316"}50`,
              }}>
                {etaLabel}
              </span>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}>
                {remaining === 0 ? "all tasks resolved" : "at current velocity"}
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{
                fontSize: "0.55rem",
                color: d?.progress.queueHealthy ? "#00ff8840" : "#f8717140",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                ● QUEUE {d?.progress.queueHealthy ? "HEALTHY" : "ATTENTION REQUIRED"}
              </div>
            </div>
          </Panel>
        </div>

        {/* ── ROW 2: EXECUTION STATE ──────────────────────────────────────── */}
        <div style={{ marginBottom: "1px" }}>
          <div style={{ padding: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "0.75rem" }}>
            <div style={{ width: "2px", height: "12px", background: "#00ff88" }} />
            <span style={{ fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              Execution State
            </span>
          </div>
          <ExecutionStats
            running={running}
            pending={pending}
            verifying={verifying}
            blocked={blocked}
            completed={completed}
            total={total}
          />
        </div>

        {/* ── ROW 3+4: CATEGORIES + ACTIVITY ──────────────────────────────── */}
        <div
          className="main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: "1px",
            background: "rgba(255,255,255,0.04)",
            marginBottom: "1px",
            marginTop: "1px",
          }}
        >
          <Panel style={{ minHeight: "300px" }}>
            <SectionHeader label="Category Progress" status={`${cats.length} ACTIVE CATEGORIES`} />
            <CategoryChart categories={cats} />
          </Panel>

          <Panel>
            <SectionHeader label="Recent Activity" status="LIVE FEED" />
            <ActivityFeed items={activity} />
          </Panel>
        </div>

        {/* ── ROW 5: ARTIFACTS ────────────────────────────────────────────── */}
        <div style={{ paddingTop: "0.75rem" }}>
          <div style={{ padding: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "2px", height: "12px", background: "#00ff88" }} />
            <span style={{ fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              Artifact Production
            </span>
            <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.15)", marginLeft: "0.5rem" }}>
              {artifacts.total.toLocaleString()} TOTAL
            </span>
          </div>
          <ArtifactPanel artifacts={artifacts} />
        </div>

        {/* ── ROW 6: WORKER PERFORMANCE ───────────────────────────────────── */}
        <div style={{ marginTop: "1px", paddingTop: "0.75rem" }}>
          <div style={{ padding: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "2px", height: "12px", background: "#00ff88" }} />
            <span style={{ fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              Worker Performance
            </span>
          </div>
          <WorkerTable
            workers={workers}
            tasksLastHour={lastHour}
            etaMinutes={etaMins}
          />
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: "1.5rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
            CR AUDIOVIZ AI, LLC  ·  EIN 39-3646201  ·  FORT MYERS, FLORIDA
          </div>
          <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.1)", letterSpacing: "0.06em" }}>
            JAVARI OS v4.0  ·  REFRESH #{refreshCount}  ·  {error ? `⚠ ${error}` : "ALL SYSTEMS NOMINAL"}
          </div>
        </div>
      </div>
    </>
  )
}
