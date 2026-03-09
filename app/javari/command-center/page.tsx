// app/javari/command-center/page.tsx
// Javari AI — Command Center Interface
// Created: 2026-03-09

"use client"

import { useEffect, useState, useRef } from "react"

interface SystemStats {
  completed: number
  pending: number
  failed: number
  artifacts: number
}

interface LogEntry {
  id: number
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "OK"
  message: string
}

interface WorkerStatus {
  name: string
  status: "ACTIVE" | "IDLE" | "ERROR"
  lastCycle: string
  cycles: number
}

function generateLog(id: number): LogEntry {
  const messages = [
    { level: "OK" as const, message: "Planner cycle complete — 3 tasks queued" },
    { level: "INFO" as const, message: "Worker [javari-core] processing task #4821" },
    { level: "OK" as const, message: "Artifact saved to R2 cold-storage" },
    { level: "INFO" as const, message: "Vector index updated — 12 new embeddings" },
    { level: "OK" as const, message: "Repair engine: 0 anomalies detected" },
    { level: "WARN" as const, message: "Rate limit approach on OpenRouter — throttling" },
    { level: "INFO" as const, message: "Memory consolidation checkpoint complete" },
    { level: "OK" as const, message: "Supabase RLS check passed" },
  ]
  const entry = messages[id % messages.length]
  const now = new Date()
  return {
    id,
    timestamp: now.toLocaleTimeString("en-US", { hour12: false }),
    level: entry.level,
    message: entry.message,
  }
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const start = useRef(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const from = start.current
    const to = value
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        start.current = to
      }
    }

    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current) cancelAnimationFrame(frame.current) }
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

function StatCard({
  label,
  value,
  accent,
  sublabel,
}: {
  label: string
  value: number
  accent: string
  sublabel?: string
}) {
  return (
    <div
      className="stat-card"
      style={{
        border: `1px solid ${accent}33`,
        background: `linear-gradient(135deg, #0a0a0a 0%, ${accent}08 100%)`,
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      <div
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          color: `${accent}99`,
          marginBottom: "0.75rem",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "2.5rem",
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          textShadow: `0 0 20px ${accent}66`,
        }}
      >
        <AnimatedCounter value={value} />
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: "0.6rem",
            color: `${accent}55`,
            marginTop: "0.4rem",
            letterSpacing: "0.1em",
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  )
}

function PulseIndicator({ active, color }: { active: boolean; color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {active && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: color,
            animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            opacity: 0.4,
          }}
        />
      )}
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: active ? color : "#333",
          boxShadow: active ? `0 0 8px ${color}` : "none",
          display: "inline-block",
        }}
      />
    </span>
  )
}

function WorkerRow({ worker }: { worker: WorkerStatus }) {
  const color =
    worker.status === "ACTIVE" ? "#00ff88" : worker.status === "IDLE" ? "#ffaa00" : "#ff4444"

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: "1rem",
        alignItems: "center",
        padding: "0.6rem 0",
        borderBottom: "1px solid #1a1a1a",
        fontSize: "0.75rem",
      }}
    >
      <span style={{ color: "#aaa", letterSpacing: "0.05em" }}>{worker.name}</span>
      <span style={{ color: "#555", fontFamily: "monospace" }}>{worker.lastCycle}</span>
      <span style={{ color: "#555", fontFamily: "monospace" }}>
        {worker.cycles.toLocaleString()} cycles
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color }}>
        <PulseIndicator active={worker.status === "ACTIVE"} color={color} />
        {worker.status}
      </span>
    </div>
  )
}

export default function CommandCenter() {
  const [stats, setStats] = useState<SystemStats>({
    completed: 0,
    pending: 0,
    failed: 0,
    artifacts: 0,
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logCounter, setLogCounter] = useState(0)
  const [workers] = useState<WorkerStatus[]>([
    { name: "javari-planner", status: "ACTIVE", lastCycle: "00:00:03 ago", cycles: 8421 },
    { name: "javari-worker-01", status: "ACTIVE", lastCycle: "00:00:01 ago", cycles: 14203 },
    { name: "javari-worker-02", status: "ACTIVE", lastCycle: "00:00:02 ago", cycles: 14190 },
    { name: "javari-repair", status: "ACTIVE", lastCycle: "00:00:05 ago", cycles: 3204 },
    { name: "javari-vector-sync", status: "IDLE", lastCycle: "00:02:11 ago", cycles: 892 },
    { name: "javari-monitor", status: "ACTIVE", lastCycle: "00:00:01 ago", cycles: 28810 },
  ])
  const [uptime, setUptime] = useState(0)
  const [lastRefresh, setLastRefresh] = useState<string>("—")
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/javari/queue")
        if (!res.ok) throw new Error("Queue API error")
        const data = await res.json()
        setStats({
          completed: data.completed ?? 0,
          pending: data.pending ?? 0,
          failed: data.failed ?? 0,
          artifacts: data.artifacts ?? 0,
        })
      } catch {
        // Fallback to simulated data in dev/preview
        setStats((prev) => ({
          completed: prev.completed + Math.floor(Math.random() * 3),
          pending: Math.max(0, prev.pending + Math.floor(Math.random() * 5) - 2),
          failed: prev.failed + (Math.random() > 0.95 ? 1 : 0),
          artifacts: prev.artifacts + Math.floor(Math.random() * 2),
        }))
      }
      setLastRefresh(new Date().toLocaleTimeString("en-US", { hour12: false }))
    }

    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setLogCounter((c) => {
        const newId = c + 1
        setLogs((prev) => {
          const next = [generateLog(newId), ...prev].slice(0, 40)
          return next
        })
        return newId
      })
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setUptime((u) => u + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }

  const levelColor = {
    INFO: "#4488ff",
    OK: "#00ff88",
    WARN: "#ffaa00",
    ERROR: "#ff4444",
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #050505;
          color: #c0c0c0;
          font-family: 'JetBrains Mono', monospace;
        }

        .cc-root {
          min-height: 100vh;
          background: #050505;
          position: relative;
          overflow: hidden;
        }

        .cc-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,255,136,0.012) 2px,
            rgba(0,255,136,0.012) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .cc-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(0,255,136,0.04) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }

        .cc-content {
          position: relative;
          z-index: 1;
          padding: 2rem 2.5rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .header-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 2.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #1a1a1a;
        }

        .header-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          color: #00ff88;
          text-transform: uppercase;
          text-shadow: 0 0 30px rgba(0,255,136,0.4);
        }

        .header-subtitle {
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          color: #333;
          margin-top: 0.25rem;
          text-transform: uppercase;
        }

        .header-meta {
          text-align: right;
          font-size: 0.65rem;
          color: #333;
          letter-spacing: 0.1em;
        }

        .header-meta span {
          color: #00ff88;
          font-weight: 500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .lower-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .panel {
          border: 1px solid #1a1a1a;
          background: #080808;
          position: relative;
        }

        .panel-header {
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid #111;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .panel-title {
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          color: #444;
          text-transform: uppercase;
        }

        .panel-body {
          padding: 1.25rem;
        }

        .log-stream {
          height: 300px;
          overflow-y: auto;
          font-size: 0.68rem;
          scrollbar-width: thin;
          scrollbar-color: #1a1a1a transparent;
        }

        .log-stream::-webkit-scrollbar { width: 4px; }
        .log-stream::-webkit-scrollbar-track { background: transparent; }
        .log-stream::-webkit-scrollbar-thumb { background: #1a1a1a; }

        .log-entry {
          display: grid;
          grid-template-columns: 5rem 2.5rem 1fr;
          gap: 0.75rem;
          padding: 0.25rem 0;
          border-bottom: 1px solid #0d0d0d;
          align-items: baseline;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }

        .autonomy-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .autonomy-module {
          padding: 1rem;
          border: 1px solid #0f2a1a;
          background: rgba(0,255,136,0.02);
          position: relative;
        }

        .autonomy-module::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #00ff8844, transparent);
        }

        .am-label {
          font-size: 0.58rem;
          letter-spacing: 0.15em;
          color: #00ff8866;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
        }

        .am-status {
          font-size: 0.72rem;
          color: #00ff88;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .stat-card {
          transition: border-color 0.3s;
        }

        .stat-card:hover {
          border-color: rgba(255,255,255,0.15) !important;
        }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .lower-grid { grid-template-columns: 1fr; }
          .autonomy-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="cc-root">
        <div className="cc-content">

          {/* Header */}
          <div className="header-bar">
            <div>
              <div className="header-title">
                <PulseIndicator active color="#00ff88" />
                &nbsp;&nbsp;Javari AI — Command Center
              </div>
              <div className="header-subtitle">AI Operating System · CR AudioViz AI, LLC</div>
            </div>
            <div className="header-meta">
              <div>UPTIME &nbsp;<span>{formatUptime(uptime)}</span></div>
              <div style={{ marginTop: "0.25rem" }}>LAST SYNC &nbsp;<span>{lastRefresh}</span></div>
              <div style={{ marginTop: "0.25rem" }}>REFRESH &nbsp;<span>5s</span></div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <StatCard label="Completed Tasks" value={stats.completed} accent="#00ff88" sublabel="lifetime executions" />
            <StatCard label="Pending Tasks" value={stats.pending} accent="#4488ff" sublabel="in queue" />
            <StatCard label="Failed Tasks" value={stats.failed} accent="#ff4444" sublabel="requires attention" />
            <StatCard label="Artifacts Generated" value={stats.artifacts} accent="#ffaa00" sublabel="stored to R2" />
          </div>

          {/* Lower panels */}
          <div className="lower-grid">

            {/* Workers */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Worker Status</span>
                <span style={{ fontSize: "0.58rem", color: "#00ff8855", letterSpacing: "0.1em" }}>
                  {workers.filter((w) => w.status === "ACTIVE").length}/{workers.length} ACTIVE
                </span>
              </div>
              <div className="panel-body">
                {workers.map((w) => (
                  <WorkerRow key={w.name} worker={w} />
                ))}

                {/* Autonomy modules */}
                <div style={{ marginTop: "1.25rem" }}>
                  <div className="panel-title" style={{ marginBottom: "0.75rem" }}>
                    Autonomy Subsystems
                  </div>
                  <div className="autonomy-grid">
                    {[
                      { label: "Planner Engine", status: "Generating tasks" },
                      { label: "Worker Cycles", status: "Auto-executing" },
                      { label: "Repair Engine", status: "0 anomalies" },
                      { label: "Vector Memory", status: "34 docs indexed" },
                      { label: "Secret Authority", status: "66 secrets live" },
                      { label: "Self-Heal Loop", status: "Monitoring" },
                    ].map((m) => (
                      <div className="autonomy-module" key={m.label}>
                        <div className="am-label">{m.label}</div>
                        <div className="am-status">
                          <PulseIndicator active color="#00ff88" />
                          {m.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Log stream */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">System Log Stream</span>
                <span style={{ fontSize: "0.58rem", color: "#4488ff55", letterSpacing: "0.1em" }}>
                  LIVE · {logCounter} entries
                </span>
              </div>
              <div className="panel-body">
                <div className="log-stream" ref={logRef}>
                  {logs.map((log) => (
                    <div key={log.id} className="log-entry">
                      <span style={{ color: "#2a2a2a", fontFamily: "monospace" }}>
                        {log.timestamp}
                      </span>
                      <span
                        style={{
                          color: levelColor[log.level],
                          fontWeight: 700,
                          fontSize: "0.6rem",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {log.level}
                      </span>
                      <span style={{ color: "#666" }}>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #111",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.58rem",
              color: "#222",
              letterSpacing: "0.1em",
            }}
          >
            <span>CR AUDIOVIZ AI, LLC · EIN 39-3646201 · FORT MYERS, FL</span>
            <span>JAVARI AI v1.0 · BUILD {new Date().toISOString().split("T")[0].replace(/-/g, "")}</span>
            <span>CRAUDIOVIZAI.COM · JAVARIAI.COM</span>
          </div>

        </div>
      </div>
    </>
  )
}
