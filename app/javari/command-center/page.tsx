// app/javari/command-center/page.tsx
// Purpose: Javari Enterprise Mission Control — unified, investor-grade operational dashboard.
//          7 rows: Global Progress · AI Execution · Platform Build · Category Execution
//          Artifact Output · System Performance · Live Activity
//          Single source of truth. Polls /api/javari/dashboard every 5 seconds.
//          Zero placeholders. Zero hardcoded values.
// Date: 2026-03-10

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { InfoTooltip } from "@/components/ui/InfoTooltip"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Phase    { id: string; label: string; total: number; completed: number; pct: number }
interface Category { id: string; label: string; total: number; completed: number; pct: number }
interface Worker   { cycleId: string; executedAt: string; executed: number; cost: string; durationMs: number; status: string; lastActive: string }
interface Activity { id: string; title: string; phase: string; source: string; elapsed: string }

interface DashData {
  ok:          boolean
  generatedAt: string
  queryMs:     number
  progress: {
    total: number; completed: number; pending: number; running: number
    verifying: number; blocked: number; retry: number; remaining: number
    pct: number; queueHealthy: boolean
  }
  velocity: {
    tasksLastHour: number; tasksLastDay: number; peakHour: number
    etaMinutes: number | null; velocityBuckets: number[]
  }
  // backward compat alias
  execution?: {
    tasksLastHour: number; tasksLastDay: number
    etaMinutes: number | null; velocityBuckets: number[]
  }
  categories:    Category[]
  roadmapPhases: Phase[]
  artifacts: {
    total: number; aiOutputs: number; commits: number
    migrations: number; deploys: number; patches: number; reports: number
    byType: Record<string, number>
  }
  planner: {
    tasksGenerated: number; roadmapIngested: number
    discoveryTasks: number; totalSources: number
    sourceBreakdown: Array<{ source: string; count: number }>
  }
  sources: Record<string, number>
  workers: {
    cycles:       Worker[]
    totalCycles:  number
    totalCostUsd: number
    cronSchedule: string
  } | Worker[]  // handle old shape too
  systemHealth: {
    queueHealthy: boolean; verificationGateActive: boolean
    tasksVerified: number; tasksBlocked: number; tasksRetrying: number
    artifactCoverage: string; plannerActive: boolean
    cronSchedule: string; maxTasksPerCycle: number; plannerTriggerAt: number
  }
  recentActivity: Activity[]
  activity?:      Activity[]  // backward compat
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }

/** Animate a number from its previous value to target */
function useCount(target: number, ms = 700) {
  const [val, setVal]  = useState(target)
  const fromRef        = useRef(target)
  const rafRef         = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    if (from === target) return
    const start = performance.now()
    const tick  = (now: number) => {
      const t = Math.min((now - start) / ms, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(from + (target - from) * e))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else       fromRef.current = target
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, ms])

  return val
}

function N({ v, color = "#e2e8f0", size = "1.8rem" }: { v: number; color?: string; size?: string }) {
  const n = useCount(v)
  return (
    <span style={{ ...MONO, fontSize: size, fontWeight: 700, color, lineHeight: 1, textShadow: `0 0 16px ${color}40` }}>
      {n.toLocaleString()}
    </span>
  )
}

function Dot({ color, blink = false }: { color: string; blink?: boolean }) {
  const [on, set] = useState(true)
  useEffect(() => {
    if (!blink) return
    const id = setInterval(() => set(x => !x), 900)
    return () => clearInterval(id)
  }, [blink])
  return (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: color, boxShadow: `0 0 6px ${color}`,
      opacity: blink ? (on ? 1 : 0.1) : 0.9,
      transition: "opacity 0.3s", flexShrink: 0,
    }} />
  )
}

function Bar({ pct, color, h = 5 }: { pct: number; color: string; h?: number }) {
  const [w, setW]  = useState(0)
  const fromRef    = useRef(0)
  const rafRef     = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const start = performance.now()
    const tick  = (now: number) => {
      const t = Math.min((now - start) / 900, 1)
      const e = 1 - Math.pow(1 - t, 4)
      setW(from + (pct - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else       fromRef.current = pct
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  return (
    <div style={{ position: "relative", height: h, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${w}%`,
        background: `linear-gradient(90deg, ${color}99, ${color})`,
        boxShadow: w > 2 ? `0 0 8px ${color}50` : "none",
        transition: "box-shadow 0.3s",
      }} />
    </div>
  )
}

function Spark({ data, color = "#00ff88", w = 200, h = 40 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (!data?.length) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) =>
    `${(i / Math.max(data.length - 1, 1)) * w},${h - Math.round((v / max) * (h - 3)) - 2}`
  ).join(" ")
  const area = `${pts} ${w},${h} 0,${h}`
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={`sg${color.replace(/#/g,"")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg${color.replace(/#/g,"")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}

function Gauge({ pct, size = 160 }: { pct: number; size?: number }) {
  const [p, setP]  = useState(0)
  const fromRef    = useRef(0)
  const rafRef     = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const start = performance.now()
    const tick  = (now: number) => {
      const t = Math.min((now - start) / 1200, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setP(from + (pct - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else       fromRef.current = pct
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  const stroke = 11
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (p / 100) * circ
  const cx     = size / 2
  const cy     = size / 2
  const color  = p >= 90 ? "#00ff88" : p >= 60 ? "#fbbf24" : "#f87171"

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <defs>
        <filter id="gg">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, filter: "url(#gg)" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
        fontFamily="'JetBrains Mono',monospace" fontWeight="700" fontSize={size * 0.2}
        style={{ filter: "url(#gg)" }}>
        {Math.round(p)}%
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="rgba(255,255,255,0.28)"
        fontFamily="'JetBrains Mono',monospace" fontSize={size * 0.072} letterSpacing="0.1em">
        COMPLETE
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function RowLabel({ n, label }: { n: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      marginBottom: "0.5rem", marginTop: "1.4rem",
    }}>
      <span style={{ ...MONO, fontSize: "0.48rem", color: "rgba(0,255,136,0.4)", letterSpacing: "0.1em" }}>
        §{n}
      </span>
      <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />
      <span style={{ ...MONO, fontSize: "0.52rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
    </div>
  )
}

function SHead({ label, badge }: { label: string; badge?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.6rem 0.9rem",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <div style={{ width: 2, height: 12, background: "#00ff88", boxShadow: "0 0 5px #00ff88" }} />
        <span style={{ ...MONO, fontSize: "0.57rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      {badge && (
        <span style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.1em", color: "rgba(0,255,136,0.45)", textTransform: "uppercase" }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Cell({ children, span = 1, style: s = {} }: {
  children: React.ReactNode; span?: number; style?: React.CSSProperties
}) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      background: "#0a0a0f",
      border: "1px solid rgba(255,255,255,0.07)",
      position: "relative", overflow: "hidden",
      ...s,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 18, height: 2, background: "linear-gradient(90deg,rgba(0,255,136,0.3),transparent)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: 18, background: "linear-gradient(180deg,rgba(0,255,136,0.3),transparent)" }} />
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "0.9rem 1rem 1rem" }}>{children}</div>
}

function Lbl({ children, tip, dim }: { children: React.ReactNode; tip?: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem" }}>
      <span style={{ ...MONO, fontSize: "0.56rem", letterSpacing: "0.16em", textTransform: "uppercase", color: dim ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.38)" }}>
        {children}
      </span>
      {tip && <InfoTooltip text={tip} size={10} />}
    </div>
  )
}

function tierColor(pct: number) {
  if (pct >= 90) return "#00ff88"
  if (pct >= 70) return "#34d399"
  if (pct >= 50) return "#fbbf24"
  if (pct >= 25) return "#f97316"
  return "#f87171"
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 1 — GLOBAL ROADMAP PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

function Row1GlobalProgress({ d }: { d: DashData }) {
  const p   = d.progress
  const vel = d.velocity ?? d.execution
  const eta = vel?.etaMinutes
  const etaLabel = eta == null
    ? p.remaining === 0 ? "—" : "∞"
    : eta < 60 ? `~${eta}m` : `~${(eta / 60).toFixed(1)}h`

  return (
    <>
      {/* Gauge */}
      <Cell span={2}>
        <SHead label="Global Progress" badge={`${p.pct}% COMPLETE`} />
        <P>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem 0" }}>
            <Gauge pct={p.pct} size={150} />
          </div>
        </P>
      </Cell>

      {/* Counts */}
      <Cell span={2}>
        <SHead label="Task Counts" />
        <P>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div>
              <Lbl tip="Tasks that passed the verification gate and are marked complete.">Completed</Lbl>
              <N v={p.completed} color="#00ff88" size="2.2rem" />
            </div>
            <div>
              <Lbl tip="Total tasks remaining across all phases." dim>Remaining</Lbl>
              <N v={p.remaining} color={p.remaining === 0 ? "#00ff88" : "#fbbf24"} size="1.6rem" />
            </div>
            <div>
              <Lbl tip="Total tracked tasks across all roadmap phases and sources." dim>Total</Lbl>
              <N v={p.total} color="rgba(255,255,255,0.45)" size="1.1rem" />
            </div>
          </div>
        </P>
      </Cell>

      {/* Velocity + sparkline */}
      <Cell span={4}>
        <SHead label="Execution Velocity" badge="24H CHART" />
        <P>
          <Spark data={vel?.velocityBuckets ?? []} color="#00ff88" w={320} h={50} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", marginBottom: "0.8rem" }}>
            <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.18)" }}>24H AGO</span>
            <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.18)" }}>NOW</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
            {[
              { label: "/ HOUR",   v: vel?.tasksLastHour ?? 0, color: "#60a5fa",
                tip: "Tasks completed in the past 60 minutes." },
              { label: "/ DAY",    v: vel?.tasksLastDay  ?? 0, color: "#34d399",
                tip: "Tasks completed in the past 24 hours." },
              { label: "PEAK HR",  v: vel?.peakHour      ?? Math.max(...(vel?.velocityBuckets ?? [0])), color: "#818cf8",
                tip: "Highest hourly task completion rate in the last 24 hours." },
            ].map(s => (
              <div key={s.label}>
                <Lbl tip={s.tip}>{s.label}</Lbl>
                <N v={s.v} color={s.color} size="1.5rem" />
              </div>
            ))}
          </div>
        </P>
      </Cell>

      {/* ETA + health */}
      <Cell span={4}>
        <SHead label="Completion Forecast" />
        <P>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div>
              <Lbl tip="Estimated time to complete all remaining tasks at current hourly velocity.">Est. Completion</Lbl>
              <span style={{ ...MONO, fontSize: "2rem", fontWeight: 700, color: p.remaining === 0 ? "#00ff88" : "#f97316", textShadow: `0 0 16px ${p.remaining === 0 ? "#00ff88" : "#f97316"}50` }}>
                {etaLabel}
              </span>
            </div>
            <div>
              <Lbl tip="Number of unique sources that contributed tasks: roadmap, planner, discovery, etc.">Task Sources</Lbl>
              <N v={Object.keys(d.sources ?? {}).length} color="#818cf8" size="1.6rem" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
              <Dot color={p.queueHealthy ? "#00ff88" : "#f87171"} />
              <span style={{ ...MONO, fontSize: "0.6rem", color: p.queueHealthy ? "#00ff88" : "#f87171", letterSpacing: "0.1em" }}>
                QUEUE {p.queueHealthy ? "HEALTHY" : "NEEDS ATTENTION"}
              </span>
            </div>
          </div>
        </P>
      </Cell>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 2 — AI EXECUTION STATUS
// ─────────────────────────────────────────────────────────────────────────────

function Row2Execution({ d }: { d: DashData }) {
  const p = d.progress
  const states = [
    { label: "Running",   v: p.running,   color: "#00ff88", blink: p.running   > 0,
      tip: "Tasks actively being processed by the Javari worker right now." },
    { label: "Pending",   v: p.pending,   color: "#fbbf24", blink: false,
      tip: "Tasks queued for the next worker cycle. Planner fires when this hits 0." },
    { label: "Verifying", v: p.verifying, color: "#60a5fa", blink: p.verifying > 0,
      tip: "Tasks that have executed and are passing through the verification gate." },
    { label: "Blocked",   v: p.blocked,   color: "#f87171", blink: p.blocked   > 0,
      tip: "Tasks that failed verification and cannot auto-recover. Require manual review." },
    { label: "Retry",     v: p.retry,     color: "#f97316", blink: false,
      tip: "Tasks that failed once and are queued for a second execution attempt." },
    { label: "Completed", v: p.completed, color: "#34d399", blink: false,
      tip: "Tasks fully verified and complete. This count only increases." },
  ]

  return (
    <>
      {states.map(s => (
        <Cell key={s.label} span={2}>
          <P>
            <Lbl tip={s.tip}>{s.label}</Lbl>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.5rem" }}>
              <Dot color={s.color} blink={s.blink} />
              <N v={s.v} color={s.color} size="2.2rem" />
            </div>
            <Bar pct={p.total > 0 ? Math.round((s.v / p.total) * 100) : 0} color={s.color} h={3} />
            <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.18)", marginTop: "0.2rem", display: "block" }}>
              {p.total > 0 ? `${Math.round((s.v / p.total) * 100)}%` : "—"} of total
            </span>
          </P>
        </Cell>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 3 — PLATFORM BUILD PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

function Row3PlatformBuild({ d }: { d: DashData }) {
  // Use roadmapPhases if populated, fall back to top categories
  const phases: Phase[] = d.roadmapPhases?.filter(p => p.total > 0).length > 0
    ? d.roadmapPhases
    : d.categories.slice(0, 7)

  return (
    <Cell span={12}>
      <SHead label="Platform Build Progress" badge={`${phases.length} PILLARS`} />
      <P>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.7rem 3rem" }}>
          {phases.map(ph => {
            const color = tierColor(ph.pct)
            return (
              <div key={ph.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span style={{ ...MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {ph.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ ...MONO, fontSize: "0.56rem", color: "rgba(255,255,255,0.2)" }}>
                      {ph.completed}/{ph.total}
                    </span>
                    <span style={{ ...MONO, fontSize: "0.65rem", fontWeight: 700, color, minWidth: "2.8rem", textAlign: "right", textShadow: `0 0 8px ${color}50` }}>
                      {ph.pct}%
                    </span>
                  </div>
                </div>
                <Bar pct={ph.pct} color={color} h={6} />
              </div>
            )
          })}
        </div>
      </P>
    </Cell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 4 — CATEGORY EXECUTION (bar chart)
// ─────────────────────────────────────────────────────────────────────────────

function Row4CategoryExecution({ d }: { d: DashData }) {
  // Show top 16 by task count
  const cats = d.categories.slice(0, 16)
  const maxTotal = Math.max(...cats.map(c => c.total), 1)

  return (
    <Cell span={12}>
      <SHead label="Category Execution" badge={`${d.categories.length} CATEGORIES`} />
      <P>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {cats.map(cat => {
            const color = tierColor(cat.pct)
            return (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: "200px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cat.label}
                </span>
                {/* Completion bar (width proportional to completed/maxTotal) */}
                <div style={{ flex: 1, position: "relative", height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0,
                    width: `${(cat.completed / maxTotal) * 100}%`,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    boxShadow: `0 0 6px ${color}40`,
                    borderRadius: 2,
                    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                  {/* Total shadow bar */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0,
                    width: `${(cat.total / maxTotal) * 100}%`,
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 2,
                  }} />
                </div>
                <span style={{ ...MONO, fontSize: "0.58rem", color, fontWeight: 700, minWidth: "3rem", textAlign: "right", textShadow: `0 0 6px ${color}50` }}>
                  {cat.pct}%
                </span>
                <span style={{ ...MONO, fontSize: "0.54rem", color: "rgba(255,255,255,0.2)", minWidth: "4.5rem", textAlign: "right" }}>
                  {cat.completed}/{cat.total}
                </span>
              </div>
            )
          })}
        </div>
      </P>
    </Cell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 5 — ARTIFACT OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

function Row5Artifacts({ d }: { d: DashData }) {
  const art = d.artifacts
  const byType = art?.byType ?? {}

  const fixed = [
    { key: "aiOutputs",  label: "AI Outputs",      color: "#818cf8", icon: "◈",
      val: art?.aiOutputs  ?? byType.ai_output ?? 0,
      tip: "AI-generated output artifacts created during task execution." },
    { key: "commits",    label: "Code Commits",    color: "#00ff88", icon: "⬡",
      val: art?.commits    ?? byType.commit ?? 0,
      tip: "Git commits pushed to the codebase as task deliverables." },
    { key: "migrations", label: "DB Migrations",   color: "#fbbf24", icon: "⬢",
      val: art?.migrations ?? byType.sql_migration ?? 0,
      tip: "Database migration scripts generated and applied." },
    { key: "deploys",    label: "Deployments",     color: "#60a5fa", icon: "▲",
      val: art?.deploys    ?? byType.deploy_proof ?? 0,
      tip: "Vercel deployment verification receipts." },
    { key: "patches",    label: "Repair Patches",  color: "#f97316", icon: "⊛",
      val: art?.patches    ?? byType.repair_patch ?? 0,
      tip: "Code repair patches applied by the autonomous repair engine." },
    { key: "reports",    label: "Reports",         color: "#34d399", icon: "≡",
      val: art?.reports    ?? (byType.verification_report ?? 0) + (byType.ecosystem_report ?? 0),
      tip: "Verification and ecosystem analysis reports produced." },
  ]

  return (
    <>
      {/* Total */}
      <Cell span={2}>
        <SHead label="Artifact Output" />
        <P>
          <Lbl tip="Total artifacts produced as proof of task execution across all types.">Total Produced</Lbl>
          <N v={art?.total ?? 0} color="#818cf8" size="2.5rem" />
          <div style={{ marginTop: "0.75rem" }}>
            <Lbl tip="Average artifacts generated per completed task." dim>Avg / Task</Lbl>
            <span style={{ ...MONO, fontSize: "1.3rem", fontWeight: 700, color: "#34d399", textShadow: "0 0 12px #34d39940" }}>
              {art?.total && d.progress.completed > 0
                ? (art.total / d.progress.completed).toFixed(2)
                : "—"}
            </span>
          </div>
        </P>
      </Cell>

      {/* Per-type cards */}
      {fixed.map(f => (
        <Cell key={f.key} span={Math.floor(10 / fixed.length) as 1 | 2}>
          <P>
            <div style={{ ...MONO, fontSize: "1rem", color: `${f.color}60`, marginBottom: "0.35rem" }}>
              {f.icon}
            </div>
            <Lbl tip={f.tip}>{f.label}</Lbl>
            <N v={f.val} color={f.color} size="1.8rem" />
          </P>
        </Cell>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 6 — SYSTEM PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────

function Row6Performance({ d, queryMs, refreshCount }: { d: DashData; queryMs: number; refreshCount: number }) {
  const vel = d.velocity ?? d.execution
  const sh  = d.systemHealth
  const ws  = Array.isArray(d.workers) ? { cycles: d.workers, totalCycles: 0, totalCostUsd: 0, cronSchedule: "60s" } : d.workers
  const cycles = ws?.cycles ?? []

  const formatMs = (ms: number) => {
    if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`
    if (ms > 1000)  return `${(ms / 1000).toFixed(1)}s`
    return `${ms}ms`
  }

  const kpis = [
    { label: "Tasks / Hour",  v: vel?.tasksLastHour ?? 0,   color: "#60a5fa",
      tip: "Tasks completed in the last 60 minutes." },
    { label: "Tasks / Day",   v: vel?.tasksLastDay  ?? 0,   color: "#34d399",
      tip: "Tasks completed in the last 24 hours." },
    { label: "Worker Cycles", v: ws?.totalCycles    ?? cycles.length, color: "#818cf8",
      tip: "Total worker execution cycles logged." },
    { label: "Planner Runs",  v: d.planner?.tasksGenerated ?? 0, color: "#e879f9",
      tip: "Tasks autonomously generated by Javari AI Planner." },
  ]

  return (
    <>
      {/* KPI cards */}
      {kpis.map(k => (
        <Cell key={k.label} span={2}>
          <P>
            <Lbl tip={k.tip}>{k.label}</Lbl>
            <N v={k.v} color={k.color} size="2rem" />
          </P>
        </Cell>
      ))}

      {/* System health indicators */}
      <Cell span={2}>
        <SHead label="System Health" />
        <P>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {[
              { label: "Queue",      ok: sh?.queueHealthy,            tip: "No permanently blocked tasks." },
              { label: "Verifier",   ok: sh?.verificationGateActive,  tip: "Verification gate enforced on all tasks." },
              { label: "Planner",    ok: sh?.plannerActive,           tip: "Autonomous planner has generated tasks this session." },
              { label: "Dashboard",  ok: queryMs < 500,               tip: `API response time: ${queryMs}ms. Target <500ms.` },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Dot color={s.ok ? "#00ff88" : "#f87171"} />
                  <span style={{ ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
                    {s.label}
                  </span>
                  <InfoTooltip text={s.tip} size={9} />
                </div>
                <span style={{ ...MONO, fontSize: "0.58rem", color: s.ok ? "#00ff88" : "#f87171" }}>
                  {s.ok ? "NOMINAL" : "CHECK"}
                </span>
              </div>
            ))}
            <div style={{ marginTop: "0.2rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.4rem" }}>
              <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.2)" }}>
                API {queryMs}ms · #{refreshCount} refresh
              </span>
            </div>
          </div>
        </P>
      </Cell>

      {/* Worker cycle table */}
      <Cell span={4}>
        <SHead label="Worker Cycle Log" badge={`${cycles.length} RECENT`} />
        {cycles.length === 0 ? (
          <P>
            <span style={{ ...MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}>
              No cycle data in execution log. Cycles appear after the first successful cron tick.
            </span>
          </P>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1.2fr", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
              {["Cycle ID", "Status", "Duration", "Executed", "When"].map(h => (
                <div key={h} style={{ padding: "0.35rem 0.6rem", ...MONO, fontSize: "0.5rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
                  {h}
                </div>
              ))}
            </div>
            {cycles.slice(0, 5).map((w, i) => (
              <div key={w.cycleId} style={{
                display: "grid", gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1.2fr",
                borderBottom: i < cycles.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                background: i % 2 === 0 ? "#0a0a0f" : "#0d0d14",
              }}>
                <div style={{ padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.56rem", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.cycleId?.slice(0, 22) ?? "—"}
                </div>
                <div style={{ padding: "0.45rem 0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Dot color={w.status === "success" ? "#00ff88" : "#f87171"} />
                </div>
                <div style={{ padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>
                  {formatMs(w.durationMs)}
                </div>
                <div style={{ padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>
                  {w.executed ?? "—"}
                </div>
                <div style={{ padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.54rem", color: "rgba(255,255,255,0.22)" }}>
                  {w.lastActive}
                </div>
              </div>
            ))}
          </>
        )}
      </Cell>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW 7 — LIVE ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

function Row7Activity({ d }: { d: DashData }) {
  const items = (d.recentActivity ?? d.activity ?? []).slice(0, 12)
  const srcColor: Record<string, string> = {
    planner:  "#818cf8",
    roadmap:  "#00ff88",
    discovery:"#67e8f9",
    intelligence: "#e879f9",
  }

  return (
    <Cell span={12}>
      <SHead label="Live Activity Feed" badge={`${items.length} RECENT COMPLETIONS · 5S REFRESH`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)" }}>
        {items.map(item => {
          const sc = srcColor[item.source] ?? "#6b7280"
          return (
            <div key={item.id} style={{ background: "#0a0a0f", padding: "0.65rem 0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                <Dot color={sc} />
                <span style={{ ...MONO, fontSize: "0.5rem", color: sc, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {item.source}
                </span>
                <span style={{ ...MONO, fontSize: "0.48rem", color: "rgba(255,255,255,0.15)", marginLeft: "auto" }}>
                  {item.elapsed}
                </span>
              </div>
              <div style={{ ...MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.68)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.15rem" }}>
                {item.title}
              </div>
              <div style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {item.phase.replace(/_/g, " ")}
              </div>
            </div>
          )
        })}
      </div>
    </Cell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gap: "1px",
      background: "rgba(255,255,255,0.05)",
      marginBottom: "1px",
    }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const [data,         setData]         = useState<DashData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [queryMs,      setQueryMs]      = useState(0)
  const [lastRefresh,  setLastRefresh]  = useState("")
  const [refreshCount, setRefreshCount] = useState(0)
  const [pulse,        setPulse]        = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/javari/dashboard", { cache: "no-store" })
      const json = (await res.json()) as DashData
      if (json.ok !== false) {
        setData(json)
        setError(null)
        setQueryMs(json.queryMs ?? 0)
        setRefreshCount(c => c + 1)
        setLastRefresh(new Date().toLocaleTimeString("en-US", { hour12: false }))
        setPulse(true)
        setTimeout(() => setPulse(false), 500)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timer.current = setInterval(load, 5000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [load])

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060609", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.2rem" }}>
      <style>{`@keyframes scan{to{left:200%}}`}</style>
      <div style={{ ...MONO, fontSize: "0.62rem", letterSpacing: "0.3em", color: "#00ff88", opacity: 0.7 }}>INITIALIZING MISSION CONTROL</div>
      <div style={{ width: 180, height: 2, background: "rgba(0,255,136,0.1)", position: "relative", overflow: "hidden", borderRadius: 1 }}>
        <div style={{ position: "absolute", top: 0, left: "-100%", bottom: 0, width: "55%", background: "linear-gradient(90deg,transparent,#00ff88,transparent)", animation: "scan 1.1s linear infinite" }} />
      </div>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "#060609", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ ...MONO, fontSize: "0.7rem", color: "#f87171" }}>DASHBOARD UNAVAILABLE{error ? `: ${error}` : ""}</span>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#060609;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-track{background:#060609;}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.2);border-radius:2px;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.12}}
        @keyframes ttfade{from{opacity:0;transform:translateX(-50%) translateY(4px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#060609",
        backgroundImage: `
          radial-gradient(ellipse 65% 30% at 50% 0%, rgba(0,255,136,0.03) 0%, transparent 60%),
          linear-gradient(rgba(0,255,136,0.01) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.01) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        padding: "1rem 1.25rem 2rem",
        maxWidth: 1720,
        margin: "0 auto",
      }}>

        {/* ── TOPBAR ─────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: "0.85rem", marginBottom: "0.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.07em", color: "#fff", lineHeight: 1 }}>
              JAVARI <span style={{ color: "#00ff88" }}>MISSION CONTROL</span>
            </div>
            <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", marginTop: "0.18rem", textTransform: "uppercase" }}>
              CR AudioViz AI, LLC · Fort Myers, FL · Unified Enterprise Operations Dashboard
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 7px #00ff88", animation: "blink 1.8s infinite", display: "inline-block" }} />
              <span style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.18em", color: "rgba(0,255,136,0.55)", textTransform: "uppercase" }}>LIVE · 5S</span>
            </div>
            <span style={{ ...MONO, fontSize: "0.55rem", color: pulse ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)", transition: "color 0.3s" }}>
              {lastRefresh}
            </span>
            <span style={{ ...MONO, fontSize: "0.5rem", color: queryMs < 500 ? "rgba(0,255,136,0.38)" : "rgba(251,191,36,0.5)" }}>
              {queryMs}ms
            </span>
            <span style={{ ...MONO, fontSize: "0.48rem", color: "rgba(255,255,255,0.12)" }}>#{refreshCount}</span>
            {error && <span style={{ ...MONO, fontSize: "0.5rem", color: "#f87171" }}>⚠ {error}</span>}
          </div>
        </div>

        {/* ── ROW 1: GLOBAL ROADMAP PROGRESS ──────────────────────────── */}
        <RowLabel n="01" label="Global Roadmap Progress" />
        <Grid><Row1GlobalProgress d={data} /></Grid>

        {/* ── ROW 2: AI EXECUTION STATUS ───────────────────────────────── */}
        <RowLabel n="02" label="AI Execution Status" />
        <Grid><Row2Execution d={data} /></Grid>

        {/* ── ROW 3: PLATFORM BUILD PROGRESS ──────────────────────────── */}
        <RowLabel n="03" label="Platform Build Progress" />
        <Grid><Row3PlatformBuild d={data} /></Grid>

        {/* ── ROW 4: CATEGORY EXECUTION ────────────────────────────────── */}
        <RowLabel n="04" label="Category Execution" />
        <Grid><Row4CategoryExecution d={data} /></Grid>

        {/* ── ROW 5: ARTIFACT OUTPUT ───────────────────────────────────── */}
        <RowLabel n="05" label="Artifact Output" />
        <Grid><Row5Artifacts d={data} /></Grid>

        {/* ── ROW 6: SYSTEM PERFORMANCE ───────────────────────────────── */}
        <RowLabel n="06" label="System Performance" />
        <Grid><Row6Performance d={data} queryMs={queryMs} refreshCount={refreshCount} /></Grid>

        {/* ── ROW 7: LIVE ACTIVITY ─────────────────────────────────────── */}
        <RowLabel n="07" label="Live Activity" />
        <Grid><Row7Activity d={data} /></Grid>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <div style={{
          marginTop: "1.5rem", paddingTop: "0.65rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ ...MONO, fontSize: "0.48rem", color: "rgba(255,255,255,0.1)", letterSpacing: "0.08em" }}>
            CR AUDIOVIZ AI, LLC · EIN 39-3646201 · FORT MYERS, FL
          </span>
          <span style={{ ...MONO, fontSize: "0.48rem", color: "rgba(255,255,255,0.1)" }}>
            JAVARI OS v4.0 · /javari/command-center · {data.progress.pct}% COMPLETE
          </span>
        </div>
      </div>
    </>
  )
}
