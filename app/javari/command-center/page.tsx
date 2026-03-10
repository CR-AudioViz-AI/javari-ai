// app/javari/command-center/page.tsx
// Purpose: Unified Javari Mission Control dashboard.
//          6 sections: Global Progress · AI Execution Status · Platform Build Progress
//          Artifact Output · System Performance · Live Activity
//          Polls /api/javari/dashboard every 5 seconds. Zero static values.
// Date: 2026-03-10

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { InfoTooltip } from "@/components/ui/InfoTooltip"

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardData {
  ok:          boolean
  generatedAt: string
  queryMs:     number
  progress: {
    total:        number
    completed:    number
    pending:      number
    running:      number
    verifying:    number
    blocked:      number
    retry:        number
    remaining:    number
    pct:          number
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
    byType:     Record<string, number>
  }
  sources:  Record<string, number>
  workers:  Array<{
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

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function useAnimCounter(target: number, duration = 700) {
  const [val, setVal] = useState(target)
  const fromRef = useRef(target)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const to    = target
    if (from === to) return
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(from + (to - from) * e))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return val
}

function Num({
  n, color = "#e2e8f0", size = "1.8rem", mono = true
}: { n: number; color?: string; size?: string; mono?: boolean }) {
  const v = useAnimCounter(n)
  return (
    <span style={{
      fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
      fontSize: size,
      fontWeight: 700,
      color,
      lineHeight: 1,
      textShadow: `0 0 18px ${color}40`,
    }}>
      {v.toLocaleString()}
    </span>
  )
}

// Blink pulse dot
function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    if (!pulse) return
    const id = setInterval(() => setOn(x => !x), 900)
    return () => clearInterval(id)
  }, [pulse])
  return (
    <span style={{
      display: "inline-block",
      width: 6, height: 6,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}`,
      opacity: pulse ? (on ? 1 : 0.15) : 0.85,
      transition: "opacity 0.3s",
      flexShrink: 0,
    }} />
  )
}

// Animated horizontal bar
function Bar({ pct, color, height = 5 }: { pct: number; color: string; height?: number }) {
  const [w, setW] = useState(0)
  const fromRef   = useRef(0)
  const rafRef    = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const to    = pct
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / 900, 1)
      const e = 1 - Math.pow(1 - t, 4)
      setW(from + (to - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  return (
    <div style={{ position: "relative", height, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${w}%`,
        background: `linear-gradient(90deg, ${color}bb, ${color})`,
        borderRadius: 2,
        boxShadow: w > 2 ? `0 0 8px ${color}50` : "none",
      }} />
    </div>
  )
}

// Inline SVG sparkline
function Spark({ data, color = "#00ff88", w = 140, h = 32 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (!data?.length) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) =>
    `${(i / Math.max(data.length - 1, 1)) * w},${h - Math.round((v / max) * (h - 2)) - 1}`
  ).join(" ")
  const area = pts + ` ${w},${h} 0,${h}`
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  )
}

// Circular arc gauge (SVG)
function Gauge({ pct, size = 140 }: { pct: number; size: number }) {
  const [p, setP] = useState(0)
  const fromRef   = useRef(0)
  const rafRef    = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const to    = pct
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / 1100, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setP(from + (to - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  const stroke = 10
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (p / 100) * circ
  const cx = size / 2, cy = size / 2
  const color = p >= 90 ? "#00ff88" : p >= 60 ? "#fbbf24" : "#f87171"

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <defs>
        <filter id="gauge-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, filter: "url(#gauge-glow)" }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color}
        fontFamily="'JetBrains Mono', monospace" fontWeight="700" fontSize={size * 0.2}
        style={{ filter: "url(#gauge-glow)" }}>
        {Math.round(p)}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.3)"
        fontFamily="'JetBrains Mono', monospace" fontSize={size * 0.072} letterSpacing="0.1em">
        COMPLETE
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }

function Label({ children, tip, dim = false }: {
  children: React.ReactNode; tip?: string; dim?: boolean
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.4rem" }}>
      <span style={{
        ...MONO,
        fontSize: "0.57rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: dim ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.4)",
      }}>
        {children}
      </span>
      {tip && <InfoTooltip text={tip} size={10} />}
    </div>
  )
}

function SectionTitle({ children, badge }: { children: React.ReactNode; badge?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.65rem 1rem",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ width: 2, height: 13, background: "#00ff88", boxShadow: "0 0 5px #00ff88" }} />
        <span style={{ ...MONO, fontSize: "0.6rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>
          {children}
        </span>
      </div>
      {badge && (
        <span style={{ ...MONO, fontSize: "0.52rem", letterSpacing: "0.12em", color: "rgba(0,255,136,0.5)", textTransform: "uppercase" }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Cell({ children, span = 1, style = {} }: {
  children: React.ReactNode; span?: number; style?: React.CSSProperties
}) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      background: "#0b0b10",
      border: "1px solid rgba(255,255,255,0.07)",
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {/* corner accent */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 20, height: 2, background: "linear-gradient(90deg,#00ff8830,transparent)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: 20, background: "linear-gradient(180deg,#00ff8830,transparent)" }} />
      {children}
    </div>
  )
}

function Pad({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "1rem 1rem 1.1rem" }}>{children}</div>
}

// Tier color by pct
function tierColor(pct: number) {
  if (pct >= 90) return "#00ff88"
  if (pct >= 70) return "#34d399"
  if (pct >= 50) return "#fbbf24"
  if (pct >= 25) return "#f97316"
  return "#f87171"
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: GLOBAL PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

function SectionGlobalProgress({ d }: { d: DashboardData }) {
  const p    = d.progress
  const exec = d.execution
  const totalSources = Object.values(d.sources).reduce((a, b) => a + b, 0)

  const etaLabel = exec.etaMinutes == null
    ? p.remaining === 0 ? "—" : "∞"
    : exec.etaMinutes < 60
      ? `${exec.etaMinutes}m`
      : `${(exec.etaMinutes / 60).toFixed(1)}h`

  const sourceColors: Record<string, string> = {
    roadmap:           "#60a5fa",
    planner:           "#818cf8",
    master_roadmap_v4: "#34d399",
    roadmap_v4:        "#fbbf24",
    master_roadmap_v1: "#f97316",
    intelligence:      "#e879f9",
    discovery:         "#67e8f9",
  }

  return (
    <>
      {/* Gauge + total */}
      <Cell span={2}>
        <SectionTitle>Global Progress</SectionTitle>
        <Pad>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Gauge pct={p.pct} size={130} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div>
                <Label tip="Total roadmap tasks tracked across all phases and sources.">Total Tasks</Label>
                <Num n={p.total} color="#e2e8f0" size="1.9rem" />
              </div>
              <div>
                <Label tip="Tasks that passed the verification gate and are marked complete.">Completed</Label>
                <Num n={p.completed} color="#00ff88" size="1.9rem" />
              </div>
              <div>
                <Label tip="Tasks not yet executed. Planner auto-generates 50 more when this hits 0." dim>Remaining</Label>
                <Num n={p.remaining} color={p.remaining === 0 ? "#00ff88" : "#fbbf24"} size="1.4rem" />
              </div>
            </div>
          </div>
        </Pad>
      </Cell>

      {/* Velocity */}
      <Cell span={2}>
        <SectionTitle badge="REAL-TIME">Execution Velocity</SectionTitle>
        <Pad>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <Label tip="Tasks verified complete in the past 60 minutes.">Tasks / Hour</Label>
              <Num n={exec.tasksLastHour} color="#60a5fa" size="2.2rem" />
            </div>
            <div>
              <Label tip="Tasks completed in the past 24 hours.">Tasks / Day</Label>
              <Num n={exec.tasksLastDay} color="#60a5fa" size="1.5rem" />
            </div>
            <div>
              <Label tip="Estimated time to complete remaining tasks at current hourly rate. Shows ∞ if no activity in last hour.">
                ETA
              </Label>
              <span style={{ ...MONO, fontSize: "1.5rem", fontWeight: 700, color: "#f97316", textShadow: "0 0 14px #f9731640" }}>
                {etaLabel}
              </span>
            </div>
          </div>
        </Pad>
      </Cell>

      {/* 24h sparkline */}
      <Cell span={3}>
        <SectionTitle badge="LAST 24H">Completion Velocity</SectionTitle>
        <Pad>
          <Label tip="Number of tasks completed per hour, charted over the last 24 hours. Each bar = 1 hour.">
            Hourly Throughput
          </Label>
          <Spark data={exec.velocityBuckets} color="#00ff88" w={260} h={52} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
            <span style={{ ...MONO, fontSize: "0.52rem", color: "rgba(255,255,255,0.2)" }}>24H AGO</span>
            <span style={{ ...MONO, fontSize: "0.52rem", color: "rgba(255,255,255,0.2)" }}>NOW</span>
          </div>
          <div style={{ marginTop: "0.9rem" }}>
            <Label tip="Max tasks completed in any single hour in the past 24 hours.">Peak Hour</Label>
            <Num n={Math.max(...(exec.velocityBuckets ?? [0]))} color="#34d399" size="1.5rem" />
          </div>
        </Pad>
      </Cell>

      {/* Source breakdown */}
      <Cell span={5}>
        <SectionTitle>Task Origin Breakdown</SectionTitle>
        <Pad>
          <Label tip="How tasks entered the system: 'roadmap' = manually ingested phases, 'planner' = autonomously generated by Javari AI, others = historical sources.">
            Source Distribution
          </Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.3rem" }}>
            {Object.entries(d.sources)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([src, count]) => {
                const pct = totalSources > 0 ? Math.round((count / totalSources) * 100) : 0
                const col = sourceColors[src] ?? "#6b7280"
                return (
                  <div key={src} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", minWidth: "140px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {src.replace(/_/g, " ")}
                    </span>
                    <div style={{ flex: 1 }}>
                      <Bar pct={pct} color={col} height={4} />
                    </div>
                    <span style={{ ...MONO, fontSize: "0.62rem", color: col, minWidth: "34px", textAlign: "right" }}>
                      {count}
                    </span>
                  </div>
                )
              })}
          </div>
        </Pad>
      </Cell>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: AI EXECUTION STATUS
// ─────────────────────────────────────────────────────────────────────────────

function SectionAIExecution({ d }: { d: DashboardData }) {
  const p = d.progress
  const [tick, setTick] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setTick(t => !t), 1000)
    return () => clearInterval(id)
  }, [])

  const states = [
    { key: "running",   label: "Running",   value: p.running,   color: "#00ff88",
      tip: "Tasks actively being executed by the Javari worker right now." },
    { key: "pending",   label: "Pending",   value: p.pending,   color: "#fbbf24",
      tip: "Tasks queued and waiting for the next worker cycle. Planner fires when this hits 0." },
    { key: "verifying", label: "Verifying", value: p.verifying, color: "#60a5fa",
      tip: "Tasks that have executed and are awaiting verification gate confirmation." },
    { key: "blocked",   label: "Blocked",   value: p.blocked,   color: "#f87171",
      tip: "Tasks that failed verification and cannot proceed. Require manual review." },
    { key: "retry",     label: "Retry",     value: p.retry,     color: "#f97316",
      tip: "Tasks that failed verification once and are queued for re-execution." },
    { key: "completed", label: "Completed", value: p.completed, color: "#34d399",
      tip: "Tasks fully verified and complete. This count only goes up." },
  ]

  return (
    <>
      {states.map(s => (
        <Cell key={s.key} span={2}>
          <Pad>
            <Label tip={s.tip}>{s.label}</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <Dot color={s.color} pulse={s.value > 0 && (s.key === "running" || s.key === "verifying")} />
              <Num n={s.value} color={s.color} size="2rem" />
            </div>
            <div style={{ marginTop: "0.6rem" }}>
              <Bar pct={p.total > 0 ? Math.round((s.value / p.total) * 100) : 0} color={s.color} height={3} />
              <span style={{ ...MONO, fontSize: "0.52rem", color: "rgba(255,255,255,0.2)", marginTop: "0.2rem", display: "block" }}>
                {p.total > 0 ? `${Math.round((s.value / p.total) * 100)}% of total` : "—"}
              </span>
            </div>
          </Pad>
        </Cell>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: PLATFORM BUILD PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

function SectionBuildProgress({ d }: { d: DashboardData }) {
  // Show top 12 categories by total task count
  const cats = [...d.categories]
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  return (
    <Cell span={12}>
      <SectionTitle badge={`${d.categories.length} CATEGORIES`}>Platform Build Progress</SectionTitle>
      <Pad>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "0.6rem 2.5rem",
        }}>
          {cats.map(cat => {
            const color = tierColor(cat.pct)
            return (
              <div key={cat.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ ...MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {cat.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.2)" }}>
                      {cat.completed}/{cat.total}
                    </span>
                    <span style={{ ...MONO, fontSize: "0.65rem", fontWeight: 700, color, minWidth: "2.8rem", textAlign: "right", textShadow: `0 0 8px ${color}60` }}>
                      {cat.pct}%
                    </span>
                  </div>
                </div>
                <Bar pct={cat.pct} color={color} height={5} />
              </div>
            )
          })}
        </div>
      </Pad>
    </Cell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ARTIFACT OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

function SectionArtifacts({ d }: { d: DashboardData }) {
  const art = d.artifacts
  const byType = art.byType ?? {}
  const total  = art.total ?? 0

  // Dynamic from byType
  const allTypes = Object.entries(byType).sort((a, b) => b[1] - a[1])

  const typeColors: Record<string, string> = {
    ai_output:            "#818cf8",
    commit:               "#00ff88",
    sql_migration:        "#fbbf24",
    deploy_proof:         "#60a5fa",
    repair_patch:         "#f97316",
    verification_report:  "#34d399",
    repair_commit:        "#e879f9",
    brand_fix:            "#f43f5e",
    ux_analysis:          "#67e8f9",
    ecosystem_report:     "#84cc16",
    model_consensus:      "#fb923c",
  }
  const typeLabels: Record<string, string> = {
    ai_output:            "AI Outputs",
    commit:               "Code Commits",
    sql_migration:        "DB Migrations",
    deploy_proof:         "Deploy Proofs",
    repair_patch:         "Repair Patches",
    verification_report:  "Verify Reports",
    repair_commit:        "Repair Commits",
    brand_fix:            "Brand Fixes",
    ux_analysis:          "UX Analyses",
    ecosystem_report:     "Ecosystem Reports",
    model_consensus:      "Model Consensus",
  }
  const typeTips: Record<string, string> = {
    ai_output:            "Raw AI-generated output artifacts produced by task execution.",
    commit:               "Git commits pushed to the codebase as task deliverables.",
    sql_migration:        "Database migration scripts generated and applied.",
    deploy_proof:         "Vercel deployment verification receipts.",
    repair_patch:         "Code repair patches applied by the autonomous repair engine.",
    verification_report:  "Structured verification gate reports per task.",
  }

  return (
    <>
      {/* Total */}
      <Cell span={2}>
        <SectionTitle>Artifact Output</SectionTitle>
        <Pad>
          <Label tip="Total artifacts produced by all task executions. Each completed task generates at minimum one proof artifact.">
            Total Artifacts
          </Label>
          <Num n={total} color="#818cf8" size="2.4rem" />
          <div style={{ marginTop: "0.75rem" }}>
            <Label tip="Percentage of tasks that generated at least one artifact (proof of execution).">Coverage</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
              <span style={{ ...MONO, fontSize: "1.3rem", fontWeight: 700, color: "#34d399" }}>
                {total > 0 && d.progress.completed > 0
                  ? `${Math.round((total / d.progress.completed) * 100)}%`
                  : "—"}
              </span>
              <span style={{ ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.25)" }}>avg/task</span>
            </div>
          </div>
        </Pad>
      </Cell>

      {/* By type — dynamic */}
      <Cell span={10}>
        <SectionTitle>Artifact Types</SectionTitle>
        <Pad>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1px",
            background: "rgba(255,255,255,0.05)",
          }}>
            {allTypes.slice(0, 11).map(([type, count]) => {
              const color = typeColors[type] ?? "#6b7280"
              const label = typeLabels[type] ?? type.replace(/_/g, " ")
              const tip   = typeTips[type]
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={type} style={{ background: "#0b0b10", padding: "0.7rem 0.8rem" }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg,${color},${color}00)`, marginBottom: "0.5rem", borderRadius: 1 }} />
                  <Label tip={tip}>{label}</Label>
                  <Num n={count} color={color} size="1.4rem" />
                  <div style={{ marginTop: "0.3rem" }}>
                    <Bar pct={pct} color={color} height={3} />
                  </div>
                </div>
              )
            })}
          </div>
        </Pad>
      </Cell>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: SYSTEM PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────

function SectionPerformance({ d, queryMs, refreshCount }: {
  d: DashboardData; queryMs: number; refreshCount: number
}) {
  const workers = d.workers ?? []

  function fmtMs(ms: number) {
    if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`
    if (ms > 1000)  return `${(ms / 1000).toFixed(1)}s`
    return `${ms}ms`
  }

  function fmtDate(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    } catch { return iso }
  }

  const health = [
    { label: "Queue Health",      value: d.progress.queueHealthy ? "NOMINAL" : "ATTENTION",
      color: d.progress.queueHealthy ? "#00ff88" : "#f87171",
      tip: "Queue is healthy when there are no permanently blocked tasks." },
    { label: "Dashboard Latency", value: `${queryMs}ms`,
      color: queryMs < 400 ? "#00ff88" : queryMs < 800 ? "#fbbf24" : "#f87171",
      tip: "Time to aggregate all metrics from Supabase. Target: <400ms." },
    { label: "Refresh Cycles",    value: refreshCount.toLocaleString(),
      color: "#60a5fa",
      tip: "Number of 5-second polling cycles since this page loaded." },
    { label: "Cron Schedule",     value: "60s",
      color: "#818cf8",
      tip: "Vercel cron triggers /api/javari/worker-cycle every 60 seconds." },
    { label: "Planner Threshold", value: "< 10",
      color: "#fbbf24",
      tip: "Autonomous Planner fires when pending tasks drop below 10, generating 50 new tasks via AI." },
    { label: "Max Tasks/Cycle",   value: "20",
      color: "#34d399",
      tip: "Maximum tasks the worker executes per 60-second cron cycle." },
  ]

  return (
    <>
      {/* Health indicators */}
      <Cell span={4}>
        <SectionTitle>System Health</SectionTitle>
        <Pad>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {health.map(h => (
              <div key={h.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Dot color={h.color} />
                  <Label tip={h.tip}>{h.label}</Label>
                </div>
                <span style={{ ...MONO, fontSize: "0.72rem", fontWeight: 700, color: h.color, textShadow: `0 0 10px ${h.color}50` }}>
                  {h.value}
                </span>
              </div>
            ))}
          </div>
        </Pad>
      </Cell>

      {/* Worker cycles */}
      <Cell span={8}>
        <SectionTitle badge={`${workers.length} RECENT CYCLES`}>Worker Cycle Log</SectionTitle>
        {workers.length === 0 ? (
          <Pad>
            <span style={{ ...MONO, fontSize: "0.62rem", color: "rgba(255,255,255,0.2)" }}>
              No worker cycles in execution log yet. Cycles appear after the first cron tick.
            </span>
          </Pad>
        ) : (
          <div>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1.2fr",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.025)",
            }}>
              {["Cycle ID", "Status", "Duration", "Cost", "Executed At"].map(h => (
                <div key={h} style={{ padding: "0.4rem 0.75rem", ...MONO, fontSize: "0.52rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
                  {h}
                </div>
              ))}
            </div>
            {workers.slice(0, 6).map((w, i) => (
              <div key={w.cycleId} style={{
                display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1.2fr",
                borderBottom: i < workers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                background: i % 2 === 0 ? "#0b0b10" : "#0e0e16",
              }}>
                <div style={{ padding: "0.5rem 0.75rem", ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.cycleId?.slice(0, 28) ?? "—"}
                </div>
                <div style={{ padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Dot color={w.status === "success" ? "#00ff88" : "#f87171"} />
                  <span style={{ ...MONO, fontSize: "0.58rem", color: w.status === "success" ? "#00ff88" : "#f87171" }}>
                    {w.status}
                  </span>
                </div>
                <div style={{ padding: "0.5rem 0.75rem", ...MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.38)" }}>
                  {fmtMs(w.durationMs)}
                </div>
                <div style={{ padding: "0.5rem 0.75rem", ...MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.38)" }}>
                  ${(w.cost ?? 0).toFixed(4)}
                </div>
                <div style={{ padding: "0.5rem 0.75rem", ...MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.25)" }}>
                  {fmtDate(w.executedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Cell>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: LIVE ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

function SectionLiveActivity({ d }: { d: DashboardData }) {
  const items = d.activity ?? []

  const sourceColor: Record<string, string> = {
    planner:  "#818cf8",
    roadmap:  "#00ff88",
  }

  return (
    <Cell span={12}>
      <SectionTitle badge="5s REFRESH">Live Activity Feed</SectionTitle>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1px",
        background: "rgba(255,255,255,0.05)",
      }}>
        {items.slice(0, 8).map(item => {
          const sc = sourceColor[item.source] ?? "#6b7280"
          return (
            <div key={item.id} style={{ background: "#0b0b10", padding: "0.75rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Dot color={sc} />
                <span style={{ ...MONO, fontSize: "0.52rem", color: sc, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {item.source}
                </span>
                <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>
                  {item.elapsed}
                </span>
              </div>
              <div style={{ ...MONO, fontSize: "0.62rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ ...MONO, fontSize: "0.52rem", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const [data,         setData]         = useState<DashboardData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [lastRefresh,  setLastRefresh]  = useState("")
  const [queryMs,      setQueryMs]      = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)
  const [pulse,        setPulse]        = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/javari/dashboard", { cache: "no-store" })
      const json = (await res.json()) as DashboardData
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
      setError(e instanceof Error ? e.message : "fetch error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#060609", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1.2rem" }}>
        <style>{`@keyframes scan{to{left:200%}}`}</style>
        <div style={{ ...MONO, fontSize: "0.65rem", letterSpacing: "0.3em", color: "#00ff88", opacity: 0.8 }}>
          INITIALIZING MISSION CONTROL
        </div>
        <div style={{ width: 180, height: 2, background: "rgba(0,255,136,0.12)", position: "relative", overflow: "hidden", borderRadius: 1 }}>
          <div style={{ position: "absolute", top: 0, left: "-100%", bottom: 0, width: "55%", background: "linear-gradient(90deg,transparent,#00ff88,transparent)", animation: "scan 1.1s linear infinite" }} />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#060609", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ ...MONO, fontSize: "0.7rem", color: "#f87171" }}>
          DASHBOARD UNAVAILABLE{error ? `: ${error}` : ""}
        </span>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060609; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #060609; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.18); border-radius: 2px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.12} }
        @keyframes ttfade { from{opacity:0;transform:translateX(-50%) translateY(4px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#060609",
        backgroundImage: `
          radial-gradient(ellipse 70% 35% at 50% 0%, rgba(0,255,136,0.035) 0%, transparent 65%),
          linear-gradient(rgba(0,255,136,0.012) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.012) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        padding: "1rem 1.25rem 2rem",
        maxWidth: 1680,
        margin: "0 auto",
      }}>

        {/* ── TOP BAR ──────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: "0.9rem",
          marginBottom: "0.9rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.07em", color: "#fff", lineHeight: 1 }}>
              JAVARI <span style={{ color: "#00ff88" }}>MISSION CONTROL</span>
            </div>
            <div style={{ ...MONO, fontSize: "0.52rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.22)", marginTop: "0.2rem", textTransform: "uppercase" }}>
              CR AudioViz AI, LLC · Fort Myers, FL · Unified Operational Dashboard
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 7px #00ff88", animation: "blink 1.8s infinite", display: "inline-block" }} />
              <span style={{ ...MONO, fontSize: "0.52rem", letterSpacing: "0.18em", color: "rgba(0,255,136,0.6)", textTransform: "uppercase" }}>
                LIVE · 5S
              </span>
            </div>
            <span style={{ ...MONO, fontSize: "0.58rem", color: pulse ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.22)", transition: "color 0.3s" }}>
              {lastRefresh}
            </span>
            <span style={{ ...MONO, fontSize: "0.52rem", color: queryMs < 400 ? "rgba(0,255,136,0.4)" : "rgba(251,191,36,0.5)" }}>
              {queryMs}ms
            </span>
            <span style={{ ...MONO, fontSize: "0.52rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>
              #{refreshCount}
            </span>
            {error && (
              <span style={{ ...MONO, fontSize: "0.55rem", color: "#f87171" }}>⚠ {error}</span>
            )}
          </div>
        </div>

        {/* ── SECTION: GLOBAL PROGRESS ──────────────────────────────────── */}
        <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
          § 01 — Global Progress
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)", marginBottom: "1px" }}>
          <SectionGlobalProgress d={data} />
        </div>

        {/* ── SECTION: AI EXECUTION STATUS ─────────────────────────────── */}
        <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginTop: "1.25rem", marginBottom: "0.4rem" }}>
          § 02 — AI Execution Status
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)", marginBottom: "1px" }}>
          <SectionAIExecution d={data} />
        </div>

        {/* ── SECTION: PLATFORM BUILD PROGRESS ─────────────────────────── */}
        <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginTop: "1.25rem", marginBottom: "0.4rem" }}>
          § 03 — Platform Build Progress
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)", marginBottom: "1px" }}>
          <SectionBuildProgress d={data} />
        </div>

        {/* ── SECTION: ARTIFACT OUTPUT ─────────────────────────────────── */}
        <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginTop: "1.25rem", marginBottom: "0.4rem" }}>
          § 04 — Artifact Output
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)", marginBottom: "1px" }}>
          <SectionArtifacts d={data} />
        </div>

        {/* ── SECTION: SYSTEM PERFORMANCE ──────────────────────────────── */}
        <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginTop: "1.25rem", marginBottom: "0.4rem" }}>
          § 05 — System Performance
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)", marginBottom: "1px" }}>
          <SectionPerformance d={data} queryMs={queryMs} refreshCount={refreshCount} />
        </div>

        {/* ── SECTION: LIVE ACTIVITY ────────────────────────────────────── */}
        <div style={{ ...MONO, fontSize: "0.5rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginTop: "1.25rem", marginBottom: "0.4rem" }}>
          § 06 — Live Activity
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1px", background: "rgba(255,255,255,0.05)" }}>
          <SectionLiveActivity d={data} />
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: "1.5rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.12)", letterSpacing: "0.08em" }}>
            CR AUDIOVIZ AI, LLC · EIN 39-3646201 · FORT MYERS, FLORIDA
          </span>
          <span style={{ ...MONO, fontSize: "0.5rem", color: "rgba(255,255,255,0.1)", letterSpacing: "0.06em" }}>
            JAVARI OS v4.0 · /javari/command-center · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </>
  )
}
