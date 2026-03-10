// components/dashboard/ExecutionStats.tsx
// Purpose: Four-up execution state cards with animated counters and live pulse.
// Date: 2026-03-10
"use client"

import { useEffect, useRef, useState } from "react"

function AnimCounter({ value, color }: { value: number; color: string }) {
  const [n, setN] = useState(value)
  const fromRef   = useRef(value)
  const rafRef    = useRef<number | null>(null)

  useEffect(() => {
    const from  = fromRef.current
    const to    = value
    if (from === to) return
    const dur   = 600
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
      fontSize: "2.5rem",
      fontWeight: "700",
      color,
      lineHeight: 1,
      textShadow: `0 0 20px ${color}80`,
    }}>
      {n.toLocaleString()}
    </span>
  )
}

interface StatDef {
  label:  string
  value:  number
  color:  string
  pulse?: boolean
}

interface Props {
  running:    number
  pending:    number
  verifying:  number
  blocked:    number
  completed:  number
  total:      number
}

export function ExecutionStats({ running, pending, verifying, blocked, completed, total }: Props) {
  const [tick, setTick] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick(t => !t), 1200)
    return () => clearInterval(id)
  }, [])

  const stats: StatDef[] = [
    { label: "RUNNING",   value: running,   color: "#00ff88", pulse: running > 0 },
    { label: "PENDING",   value: pending,   color: "#fbbf24", pulse: false },
    { label: "VERIFYING", value: verifying, color: "#60a5fa", pulse: verifying > 0 },
    { label: "BLOCKED",   value: blocked,   color: "#f87171", pulse: blocked > 0 },
  ]

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "1px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: "#0a0a0f",
          padding: "1.25rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: s.value > 0
              ? `linear-gradient(90deg, ${s.color}, ${s.color}00)`
              : "transparent",
            transition: "background 0.4s",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {s.pulse && (
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: s.color,
                boxShadow: `0 0 8px ${s.color}`,
                opacity: tick ? 1 : 0.2,
                transition: "opacity 0.3s",
                flexShrink: 0,
              }} />
            )}
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
            }}>
              {s.label}
            </span>
          </div>

          <AnimCounter value={s.value} color={s.color} />

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem",
            color: "rgba(255,255,255,0.2)",
          }}>
            {total > 0 ? `${Math.round((s.value / total) * 100)}% of queue` : "—"}
          </div>
        </div>
      ))}
    </div>
  )
}
