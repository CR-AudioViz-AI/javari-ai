// components/dashboard/WorkerTable.tsx
// Purpose: Worker cycle history table with status indicators.
// Date: 2026-03-10
"use client"

import { useState, useEffect } from "react"

interface WorkerCycle {
  cycleId:    string
  executedAt: string
  cost:       number
  durationMs: number
  status:     string
  lastActive: string
}

interface Props {
  workers: WorkerCycle[]
  tasksLastHour: number
  etaMinutes:    number | null
}

function StatusDot({ status }: { status: string }) {
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 900)
    return () => clearInterval(id)
  }, [])
  const color = status === "success" ? "#00ff88" : status === "running" ? "#fbbf24" : "#f87171"
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        opacity: status === "running" ? (pulse ? 1 : 0.2) : 0.9,
        transition: "opacity 0.3s",
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.6rem",
        color,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>
        {status}
      </span>
    </span>
  )
}

export function WorkerTable({ workers, tasksLastHour, etaMinutes }: Props) {
  const formatMs = (ms: number) => {
    if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`
    if (ms > 1000)  return `${(ms / 1000).toFixed(1)}s`
    return `${ms}ms`
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Summary row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "1px",
        background: "rgba(255,255,255,0.06)",
        marginBottom: "1px",
      }}>
        {[
          { label: "TASKS / HOUR",   value: tasksLastHour.toString(),                           color: "#00ff88" },
          { label: "ETA",            value: etaMinutes != null ? `${etaMinutes}m` : "∞",        color: "#60a5fa" },
          { label: "CYCLE CADENCE",  value: "60s",                                               color: "#818cf8" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#0a0a0f",
            padding: "0.75rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.55rem",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
            }}>{s.label}</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.4rem",
              fontWeight: "700",
              color: s.color,
              textShadow: `0 0 12px ${s.color}60`,
            }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      {workers.length === 0 ? (
        <div style={{
          background: "#0a0a0f",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.1em",
        }}>
          NO WORKER CYCLES LOGGED YET
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            background: "rgba(255,255,255,0.04)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            {["CYCLE ID", "STATUS", "DURATION", "LAST ACTIVE"].map(h => (
              <div key={h} style={{
                padding: "0.5rem 0.75rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                letterSpacing: "0.15em",
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
              }}>
                {h}
              </div>
            ))}
          </div>

          {workers.slice(0, 5).map((w, i) => (
            <div key={w.cycleId} style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              borderBottom: i < workers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              background: i % 2 === 0 ? "#0a0a0f" : "#0d0d14",
            }}>
              <div style={{ padding: "0.6rem 0.75rem" }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.62rem",
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.04em",
                }}>
                  {w.cycleId?.slice(0, 24) ?? "—"}
                </span>
              </div>
              <div style={{ padding: "0.6rem 0.75rem" }}>
                <StatusDot status={w.status} />
              </div>
              <div style={{
                padding: "0.6rem 0.75rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.4)",
              }}>
                {formatMs(w.durationMs)}
              </div>
              <div style={{
                padding: "0.6rem 0.75rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.62rem",
                color: "rgba(255,255,255,0.3)",
              }}>
                {w.lastActive}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
