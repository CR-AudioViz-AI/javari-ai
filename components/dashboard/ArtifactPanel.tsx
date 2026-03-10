// components/dashboard/ArtifactPanel.tsx
// Purpose: Artifact production metrics — cards per artifact type.
// Date: 2026-03-10
"use client"

import { useEffect, useRef, useState } from "react"

function AnimCounter({ value, color }: { value: number; color: string }) {
  const [n, setN] = useState(value)
  const fromRef = useRef(value)
  const rafRef  = useRef<number | null>(null)

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
      fontSize: "1.75rem",
      fontWeight: "700",
      color,
      lineHeight: 1,
      textShadow: `0 0 16px ${color}60`,
    }}>
      {n.toLocaleString()}
    </span>
  )
}

interface ArtifactDef {
  key:    string
  label:  string
  icon:   string
  color:  string
}

const ARTIFACT_DEFS: ArtifactDef[] = [
  { key: "aiOutputs",  label: "AI Outputs",      icon: "◈", color: "#818cf8" },
  { key: "commits",    label: "Commits Pushed",   icon: "⬡", color: "#00ff88" },
  { key: "migrations", label: "DB Migrations",    icon: "⬢", color: "#fbbf24" },
  { key: "deploys",    label: "Deploys Verified", icon: "▲", color: "#60a5fa" },
  { key: "patches",    label: "Repair Patches",   icon: "⊛", color: "#f97316" },
]

interface ArtifactData {
  total:      number
  aiOutputs:  number
  commits:    number
  migrations: number
  deploys:    number
  patches:    number
}

interface Props {
  artifacts: ArtifactData
}

export function ArtifactPanel({ artifacts }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: "1px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {ARTIFACT_DEFS.map(def => {
        const value = artifacts[def.key as keyof ArtifactData] ?? 0
        return (
          <div key={def.key} style={{
            background: "#0a0a0f",
            padding: "1.25rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "2px",
              background: value > 0
                ? `linear-gradient(90deg, ${def.color}, ${def.color}00)`
                : "rgba(255,255,255,0.04)",
            }} />

            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.1rem",
              color: `${def.color}80`,
            }}>
              {def.icon}
            </div>

            <AnimCounter value={value} color={def.color} />

            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
            }}>
              {def.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
