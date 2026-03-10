// components/dashboard/ProgressGauge.tsx
// Purpose: Animated circular SVG progress gauge for roadmap completion.
// Date: 2026-03-10
"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  pct:       number   // 0–100
  size?:     number
  stroke?:   number
  color?:    string
  label?:    string
  sublabel?: string
}

export function ProgressGauge({
  pct,
  size     = 180,
  stroke   = 12,
  color    = "#00ff88",
  label    = "Complete",
  sublabel,
}: Props) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (displayed / 100) * circ
  const cx     = size / 2
  const cy     = size / 2

  useEffect(() => {
    const from  = fromRef.current
    const to    = pct
    const dur   = 900
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + (to - from) * e)
      setDisplayed(v)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [pct])

  const glowId  = `glow-${label.replace(/\s/g, "")}`
  const trackId = `track-${label.replace(/\s/g, "")}`

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={trackId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Track ring */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />

        {/* Arc fill */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={`url(#${trackId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${cx}px ${cy}px`,
            transition: "stroke-dashoffset 0.05s linear",
            filter: `url(#${glowId})`,
          }}
        />

        {/* Center text */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          fill={color}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fontSize={size * 0.2}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        >
          {displayed}%
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontFamily="'JetBrains Mono', monospace"
          fontSize={size * 0.075}
          letterSpacing="0.1em"
          textTransform="uppercase"
        >
          {label.toUpperCase()}
        </text>
      </svg>
      {sublabel && (
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: 0,
        }}>
          {sublabel}
        </p>
      )}
    </div>
  )
}
