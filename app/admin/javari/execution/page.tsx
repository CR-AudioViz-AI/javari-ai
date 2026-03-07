"use client"

// app/admin/javari/execution/page.tsx
// Purpose: Live Javari execution monitor — industrial mission-control aesthetic.
//          Polls /api/javari/roadmap-status every 10s.
//          "Run Worker Now" fires POST /api/javari/queue directly.
// Date: 2026-03-07

import { useState, useEffect, useRef, useCallback } from "react"

// ── Types ────────────────────────────────────────────────────────────────────

interface Lifecycle {
  pending: number; in_progress: number; verifying: number
  completed: number; retry: number; blocked: number; failed: number; total: number
}
interface Progress {
  total: number; completed: number; remaining: number
  percentComplete: string; queueHealthy: boolean
}
interface VGate {
  gateEnforced: boolean; tasksVerified: number; tasksRetrying: number
  tasksBlocked: number; falseCompletionsBlocked: number; artifactsCoverage: string
}
interface Artifacts { total: number; tasksWithProof: number; byType: Record<string,number> }
interface ActivityItem {
  id: string; title: string; status: string; updatedAt: string; type: string
}
interface WorkerCycle {
  cycleId: string; executedAt: string; cost: string; durationMs: number; status: string
}
interface CronEntry { path: string; schedule: string; description: string }
interface RoadmapStatus {
  ok: boolean; generatedAt: string; queryMs: number
  progress: Progress; lifecycle: Lifecycle
  byType: Record<string,{total:number;completed:number;pending:number;retry:number}>
  verificationGate: VGate; artifacts: Artifacts
  recentActivity: ActivityItem[]; workerCycles: WorkerCycle[]
  cronSchedule: CronEntry[]
}
interface LogEntry { time: string; msg: string; kind: "ok"|"warn"|"info"|"err"|"worker" }

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_GLYPH: Record<string,string> = {
  completed:"▣", in_progress:"▶", verifying:"◈", retry:"↺", blocked:"✕", failed:"✕", pending:"○"
}
const STATUS_COLOR: Record<string,string> = {
  completed:"#39ff6a", in_progress:"#00d4ff", verifying:"#00d4ff",
  retry:"#ffd700", blocked:"#ff4444", failed:"#ff4444", pending:"#556655"
}
function ts() {
  return new Date().toISOString().slice(11,23)
}
function pct(n: number) { return Math.min(100, Math.max(0, n)) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExecutionMonitor() {
  const [data,    setData]    = useState<RoadmapStatus | null>(null)
  const [log,     setLog]     = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)
  const [tick,    setTick]    = useState(0)
  const [pulse,   setPulse]   = useState(false)
  const [pollMs,  setPollMs]  = useState<number|null>(null)
  const logRef   = useRef<HTMLDivElement>(null)
  const prevRef  = useRef<RoadmapStatus|null>(null)

  const addLog = useCallback((msg: string, kind: LogEntry["kind"] = "info") => {
    setLog(prev => {
      const next = [...prev, { time: ts(), msg, kind }]
      return next.slice(-200) // keep last 200 lines
    })
  }, [])

  const fetchStatus = useCallback(async () => {
    const t0 = Date.now()
    try {
      const res = await fetch("/api/javari/roadmap-status", { cache: "no-store" })
      if (!res.ok) { addLog(`status ${res.status}`, "err"); return }
      const d: RoadmapStatus = await res.json()
      const ms = Date.now() - t0
      setPollMs(ms)
      setPulse(p => !p)

      // Diff vs previous — log changes
      const prev = prevRef.current
      if (prev) {
        const newCompleted = d.lifecycle.completed - prev.lifecycle.completed
        const newRetry     = d.lifecycle.retry     - prev.lifecycle.retry
        if (newCompleted > 0) addLog(`+${newCompleted} task(s) completed → ${d.lifecycle.completed}/${d.lifecycle.total}`, "ok")
        if (newRetry > 0)     addLog(`+${newRetry} task(s) sent to retry`, "warn")
        if (!prev.progress.queueHealthy && d.progress.queueHealthy)
          addLog("queue health restored", "ok")
      } else {
        addLog(`connected — ${d.lifecycle.completed}/${d.lifecycle.total} complete (${d.progress.percentComplete})`, "ok")
      }

      prevRef.current = d
      setData(d)
      setTick(t => t + 1)
    } catch(e) {
      addLog(`poll error: ${(e as Error).message}`, "err")
    }
  }, [addLog])

  // Initial load + 10s interval
  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 10_000)
    return () => clearInterval(t)
  }, [fetchStatus])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const runWorker = async () => {
    if (running) return
    setRunning(true)
    addLog("▶ dispatching worker cycle via /api/javari/queue …", "worker")
    try {
      const res  = await fetch("/api/javari/queue", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ maxTasks: 5, userId: "manual" }),
      })
      const d = await res.json()
      if (d.ok || d.executed !== undefined) {
        addLog(`worker cycle done — executed=${d.executed ?? "?"} succeeded=${d.succeeded ?? "?"} failed=${d.failed ?? "?"}`, "ok")
      } else {
        addLog(`worker returned: ${JSON.stringify(d).slice(0,120)}`, "warn")
      }
      await fetchStatus()
    } catch(e) {
      addLog(`worker error: ${(e as Error).message}`, "err")
    } finally {
      setRunning(false)
    }
  }

  const p   = data?.progress
  const lc  = data?.lifecycle
  const vg  = data?.verificationGate
  const art = data?.artifacts
  const pctNum = p ? parseInt(p.percentComplete) : 0

  return (
    <div style={styles.root}>
      {/* Scanline overlay */}
      <div style={styles.scanlines} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⬡ JAVARI</span>
          <span style={styles.logoSub}>EXECUTION MONITOR</span>
        </div>
        <div style={styles.headerCenter}>
          <span style={{...styles.dot, background: data ? (p?.queueHealthy ? "#39ff6a" : "#ffd700") : "#444"}} />
          <span style={styles.statusLabel}>
            {data ? (p?.queueHealthy ? "QUEUE HEALTHY" : "CHECK QUEUE") : "CONNECTING"}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.clockLabel}>TICK {tick.toString().padStart(4,"0")}</span>
          {pollMs !== null && <span style={styles.msLabel}>{pollMs}ms</span>}
        </div>
      </header>

      {/* Main grid */}
      <div style={styles.grid}>

        {/* Progress panel */}
        <section style={{...styles.panel, gridArea:"prog"}}>
          <div style={styles.panelTitle}>ROADMAP PROGRESS</div>
          <div style={styles.bigPct}>{p ? p.percentComplete : "—"}</div>
          <div style={styles.progressTrack}>
            <div style={{...styles.progressFill, width:`${pctNum}%`}} />
            {pctNum > 0 && <div style={{...styles.progressGlow, width:`${pctNum}%`}} />}
          </div>
          <div style={styles.progressLabels}>
            <span style={styles.green}>{lc?.completed ?? "—"} DONE</span>
            <span style={styles.dim}>{lc?.pending ?? "—"} PENDING</span>
            <span style={styles.dim}>{p ? `${p.total} TOTAL` : ""}</span>
          </div>
        </section>

        {/* Lifecycle counts */}
        <section style={{...styles.panel, gridArea:"life"}}>
          <div style={styles.panelTitle}>LIFECYCLE</div>
          <div style={styles.lifecycleGrid}>
            {lc && Object.entries(lc).filter(([k]) => k !== "total").map(([k,v]) => (
              <div key={k} style={styles.lcCell}>
                <span style={{...styles.lcGlyph, color: STATUS_COLOR[k] ?? "#888"}}>
                  {STATUS_GLYPH[k] ?? "?"}
                </span>
                <span style={styles.lcNum}>{String(v)}</span>
                <span style={styles.lcLabel}>{k.replace("_"," ").toUpperCase()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Type breakdown */}
        <section style={{...styles.panel, gridArea:"types"}}>
          <div style={styles.panelTitle}>BY TYPE</div>
          {data && Object.entries(data.byType).map(([type, counts]) => {
            const p2 = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0
            return (
              <div key={type} style={styles.typeRow}>
                <div style={styles.typeLabel}>{type.replace(/_/g," ").toUpperCase()}</div>
                <div style={styles.typeMeta}>{counts.completed}/{counts.total}</div>
                <div style={styles.typeTrack}>
                  <div style={{...styles.typeFill, width:`${p2}%`,
                    background: p2 === 100 ? "#39ff6a" : p2 > 0 ? "#00d4ff" : "#1a2a1a"}} />
                </div>
                <div style={{...styles.typePct, color: p2===100?"#39ff6a":p2>0?"#00d4ff":"#556655"}}>
                  {Math.round(p2)}%
                </div>
              </div>
            )
          })}
        </section>

        {/* Verification gate */}
        <section style={{...styles.panel, gridArea:"gate"}}>
          <div style={styles.panelTitle}>VERIFICATION GATE</div>
          {vg && (
            <div style={styles.gateGrid}>
              <div style={styles.gateStat}>
                <span style={{...styles.gateNum, color:"#39ff6a"}}>{vg.tasksVerified}</span>
                <span style={styles.gateLabel}>VERIFIED</span>
              </div>
              <div style={styles.gateStat}>
                <span style={{...styles.gateNum, color:"#ffd700"}}>{vg.tasksRetrying}</span>
                <span style={styles.gateLabel}>RETRYING</span>
              </div>
              <div style={styles.gateStat}>
                <span style={{...styles.gateNum, color:"#ff4444"}}>{vg.falseCompletionsBlocked}</span>
                <span style={styles.gateLabel}>BLOCKED</span>
              </div>
              <div style={styles.gateStat}>
                <span style={{...styles.gateNum, color:"#00d4ff"}}>{vg.artifactsCoverage}</span>
                <span style={styles.gateLabel}>COVERAGE</span>
              </div>
            </div>
          )}
          <div style={styles.gateStatus}>
            <span style={styles.dot2} />
            {vg?.gateEnforced ? "GATE ACTIVE — NO FALSE COMPLETIONS" : "GATE INACTIVE"}
          </div>
        </section>

        {/* Artifacts */}
        <section style={{...styles.panel, gridArea:"art"}}>
          <div style={styles.panelTitle}>ARTIFACTS</div>
          {art && (
            <>
              <div style={styles.artBig}>{art.total}</div>
              <div style={styles.artSub}>{art.tasksWithProof} tasks with proof</div>
              <div style={styles.artTypes}>
                {Object.entries(art.byType).map(([k,v]) => (
                  <div key={k} style={styles.artType}>
                    <span style={styles.artTypeName}>{k}</span>
                    <span style={styles.artTypeCount}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Worker control */}
        <section style={{...styles.panel, gridArea:"ctrl"}}>
          <div style={styles.panelTitle}>WORKER CONTROL</div>
          <button
            onClick={runWorker}
            disabled={running}
            style={{...styles.runBtn, opacity: running ? 0.5 : 1, cursor: running ? "not-allowed" : "pointer"}}
          >
            {running ? "▶ RUNNING…" : "▶ RUN WORKER NOW"}
          </button>
          <div style={styles.ctrlMeta}>Fires POST /api/javari/queue · max 5 tasks</div>
          <div style={styles.ctrlCron}>
            {data?.cronSchedule.map(c => (
              <div key={c.path} style={styles.cronRow}>
                <span style={styles.cronSched}>{c.schedule}</span>
                <span style={styles.cronPath}>{c.path.replace("/api/javari/","")}</span>
              </div>
            ))}
          </div>
          {data?.workerCycles.slice(0,3).map(w => (
            <div key={w.cycleId} style={styles.cycleRow}>
              <span style={{color: w.status==="success"?"#39ff6a":"#ff4444"}}>
                {w.status==="success"?"▣":"✕"}
              </span>
              <span style={styles.cycleData}>{w.cost} · {w.durationMs}ms</span>
              <span style={styles.cycleTime}>{w.executedAt.slice(11,19)}</span>
            </div>
          ))}
        </section>

        {/* Activity log */}
        <section style={{...styles.panel, ...styles.logPanel, gridArea:"log"}}>
          <div style={styles.panelTitle}>
            ACTIVITY LOG
            <span style={styles.logCount}>{log.length} lines</span>
          </div>
          <div ref={logRef} style={styles.logScroll}>
            {log.map((entry, i) => (
              <div key={i} style={styles.logLine}>
                <span style={styles.logTime}>{entry.time}</span>
                <span style={{...styles.logMsg, color:
                  entry.kind==="ok"     ? "#39ff6a" :
                  entry.kind==="err"    ? "#ff4444" :
                  entry.kind==="warn"   ? "#ffd700" :
                  entry.kind==="worker" ? "#00d4ff" :
                  "#7a9a7a"
                }}>{entry.msg}</span>
              </div>
            ))}
            {log.length === 0 && <div style={styles.logEmpty}>waiting for first poll…</div>}
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>CR AUDIOVIZ AI · JAVARI EXECUTION MONITOR</span>
        <span style={styles.footerMid}>POLLING EVERY 10s · AUTO-SCROLL ACTIVE</span>
        <span style={styles.dim}>{data?.generatedAt?.slice(0,19).replace("T"," ")} UTC</span>
      </footer>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FONT = "'Courier New', 'Lucida Console', monospace"
const GREEN  = "#39ff6a"
const CYAN   = "#00d4ff"
const DIM    = "#445544"
const BG     = "#030d05"
const PANEL  = "#050f06"
const BORDER = "#0d2b10"

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh", background: BG, color: "#7ab87a",
    fontFamily: FONT, fontSize: 12, position: "relative", overflow: "hidden",
    display: "flex", flexDirection: "column",
  },
  scanlines: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderBottom: `1px solid ${BORDER}`, padding: "12px 24px",
    background: "#020b03",
  },
  headerLeft:   { display: "flex", flexDirection: "column", gap: 2 },
  logo:         { fontSize: 18, fontWeight: 700, color: GREEN, letterSpacing: 4 },
  logoSub:      { fontSize: 10, color: DIM, letterSpacing: 6 },
  headerCenter: { display: "flex", alignItems: "center", gap: 8 },
  dot: {
    width: 10, height: 10, borderRadius: "50%",
    boxShadow: "0 0 8px currentColor", flexShrink: 0,
  },
  statusLabel: { fontSize: 11, letterSpacing: 3, color: "#7ab87a" },
  headerRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },
  clockLabel:  { fontSize: 11, color: DIM, letterSpacing: 2 },
  msLabel:     { fontSize: 10, color: DIM },
  grid: {
    flex: 1, display: "grid", gap: 1, padding: 1,
    gridTemplate: `
      "prog prog life life life life" auto
      "types types gate gate art ctrl" auto
      "log log log log log log" 1fr
    ` ,
    gridTemplateColumns: "repeat(6, 1fr)",
  },
  panel: {
    background: PANEL, border: `1px solid ${BORDER}`, padding: "14px 16px",
    position: "relative",
  },
  panelTitle: {
    fontSize: 10, letterSpacing: 4, color: DIM, marginBottom: 12,
    borderBottom: `1px solid ${BORDER}`, paddingBottom: 6,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  // Progress
  bigPct:     { fontSize: 48, fontWeight: 700, color: GREEN, lineHeight: 1, marginBottom: 10, textShadow: `0 0 20px ${GREEN}` },
  progressTrack: { height: 8, background: "#0a1a0b", border: `1px solid ${BORDER}`, position: "relative", marginBottom: 8 },
  progressFill:  { position: "absolute", top: 0, left: 0, height: "100%", background: GREEN, transition: "width 0.8s ease" },
  progressGlow:  { position: "absolute", top: -4, left: 0, height: 16, background: `${GREEN}22`, transition: "width 0.8s ease" },
  progressLabels:{ display: "flex", gap: 16, fontSize: 11, letterSpacing: 1 },
  green:         { color: GREEN },
  dim:           { color: DIM },
  // Lifecycle
  lifecycleGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  lcCell:        { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px" },
  lcGlyph:       { fontSize: 16 },
  lcNum:         { fontSize: 22, fontWeight: 700, color: "#c8e8c8" },
  lcLabel:       { fontSize: 9, color: DIM, letterSpacing: 1, textAlign: "center" as const },
  // Type breakdown
  typeRow:   { display: "grid", gridTemplateColumns: "1fr auto 100px auto", gap: 8, alignItems: "center", marginBottom: 10 },
  typeLabel: { fontSize: 10, letterSpacing: 1, color: "#7ab87a" },
  typeMeta:  { fontSize: 10, color: DIM, whiteSpace: "nowrap" as const },
  typeTrack: { height: 4, background: "#0a1a0b", border: `1px solid ${BORDER}`, position: "relative" as const },
  typeFill:  { position: "absolute" as const, top: 0, left: 0, height: "100%", transition: "width 0.8s ease" },
  typePct:   { fontSize: 10, fontWeight: 700, textAlign: "right" as const, minWidth: 32 },
  // Gate
  gateGrid:  { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 },
  gateStat:  { display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "8px 4px", border: `1px solid ${BORDER}` },
  gateNum:   { fontSize: 28, fontWeight: 700, lineHeight: 1 },
  gateLabel: { fontSize: 9, color: DIM, letterSpacing: 2, marginTop: 4 },
  gateStatus:{ fontSize: 10, color: DIM, letterSpacing: 2, display: "flex", alignItems: "center", gap: 6, borderTop: `1px solid ${BORDER}`, paddingTop: 8 },
  dot2:      { width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}`, flexShrink: 0 },
  // Artifacts
  artBig:    { fontSize: 42, fontWeight: 700, color: CYAN, lineHeight: 1, textShadow: `0 0 16px ${CYAN}` },
  artSub:    { fontSize: 10, color: DIM, letterSpacing: 1, marginBottom: 10 },
  artTypes:  { display: "flex", flexDirection: "column" as const, gap: 6 },
  artType:   { display: "flex", justifyContent: "space-between" },
  artTypeName: { fontSize: 10, color: "#7ab87a" },
  artTypeCount:{ fontSize: 10, color: CYAN, fontWeight: 700 },
  // Control
  runBtn: {
    width: "100%", padding: "10px 0", background: "transparent",
    border: `1px solid ${GREEN}`, color: GREEN,
    fontFamily: FONT, fontSize: 12, letterSpacing: 3,
    textTransform: "uppercase" as const, marginBottom: 8,
    transition: "all 0.2s", boxShadow: `0 0 10px ${GREEN}22`,
  },
  ctrlMeta:  { fontSize: 10, color: DIM, marginBottom: 10, letterSpacing: 1 },
  ctrlCron:  { borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginBottom: 8 },
  cronRow:   { display: "flex", gap: 8, fontSize: 10, marginBottom: 4 },
  cronSched: { color: CYAN, minWidth: 80, fontFamily: FONT },
  cronPath:  { color: DIM },
  cycleRow:  { display: "flex", alignItems: "center", gap: 8, fontSize: 10, marginBottom: 3 },
  cycleData: { color: "#7ab87a", flex: 1 },
  cycleTime: { color: DIM },
  // Log
  logPanel:  { display: "flex", flexDirection: "column" as const },
  logCount:  { fontSize: 9, color: DIM, letterSpacing: 2 },
  logScroll: {
    flex: 1, overflowY: "auto" as const, background: "#020b03",
    border: `1px solid ${BORDER}`, padding: "8px 10px", height: 200,
    scrollbarWidth: "thin" as const, scrollbarColor: `${BORDER} transparent`,
  },
  logLine:   { display: "flex", gap: 12, marginBottom: 2, lineHeight: 1.5 },
  logTime:   { color: DIM, flexShrink: 0, fontSize: 11 },
  logMsg:    { fontSize: 11 },
  logEmpty:  { color: DIM, fontSize: 11 },
  // Footer
  footer: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    borderTop: `1px solid ${BORDER}`, padding: "8px 24px",
    fontSize: 10, color: DIM, letterSpacing: 2, background: "#020b03",
  },
  footerMid: { color: "#334433" },
}
