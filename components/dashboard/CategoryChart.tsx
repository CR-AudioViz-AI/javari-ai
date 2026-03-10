// components/dashboard/CategoryChart.tsx
// Purpose: Horizontal bar chart showing completion percentage by category.
//          Bars animate on data change. Color mapped by completion tier.
// Date: 2026-03-10
"use client"

import { useEffect, useRef, useState } from "react"

interface Category {
  id:        string
  label:     string
  total:     number
  completed: number
  pct:       number
}

interface Props {
  categories: Category[]
}

function AnimBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0)
  const rafRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    const from  = fromRef.current
    const to    = pct
    const dur   = 800
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 4)
      setWidth(from + (to - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  return (
    <div style={{
      position: "relative",
      height: "6px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: "2px",
      overflow: "hidden",
      flex: 1,
    }}>
      <div style={{
        position: "absolute",
        top: 0, left: 0, bottom: 0,
        width: `${width}%`,
        background: `linear-gradient(90deg, ${color}cc, ${color})`,
        borderRadius: "2px",
        boxShadow: width > 0 ? `0 0 8px ${color}60` : "none",
        transition: "box-shadow 0.3s",
      }} />
    </div>
  )
}

function tierColor(pct: number): string {
  if (pct >= 90) return "#00ff88"
  if (pct >= 70) return "#34d399"
  if (pct >= 50) return "#fbbf24"
  if (pct >= 25) return "#f97316"
  return "#f87171"
}

export function CategoryChart({ categories }: Props) {
  if (!categories?.length) {
    return (
      <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "monospace", fontSize: "0.75rem", padding: "1rem" }}>
        NO CATEGORY DATA
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {categories.map(cat => {
        const color = tierColor(cat.pct)
        return (
          <div key={cat.id} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                minWidth: "180px",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {cat.label}
              </span>

              <AnimBar pct={cat.pct} color={color} />

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.7rem",
                  color,
                  minWidth: "3rem",
                  textAlign: "right",
                  fontWeight: "600",
                  textShadow: `0 0 8px ${color}60`,
                }}>
                  {cat.pct}%
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  color: "rgba(255,255,255,0.2)",
                  minWidth: "4.5rem",
                  textAlign: "right",
                }}>
                  {cat.completed}/{cat.total}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
