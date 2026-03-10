// components/ui/InfoTooltip.tsx
// Purpose: Hover/click tooltip for explaining dashboard metrics.
//          Zero dependencies — pure CSS + React state.
//          Accessible: keyboard focusable, role="tooltip", aria-describedby.
// Date: 2026-03-10

"use client"

import { useState, useRef, useId } from "react"

interface Props {
  text: string
  size?: number
}

export function InfoTooltip({ text, size = 12 }: Props) {
  const [visible, setVisible] = useState(false)
  const [above,   setAbove]   = useState(false)
  const wrapRef  = useRef<HTMLSpanElement>(null)
  const id       = useId()

  function show() {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      setAbove(rect.bottom + 120 > window.innerHeight)
    }
    setVisible(true)
  }
  function hide() { setVisible(false) }
  function toggle() { visible ? hide() : show() }

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Icon button */}
      <button
        type="button"
        aria-describedby={id}
        aria-label="More information"
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width:  size + 4,
          height: size + 4,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.18)",
          background: "transparent",
          cursor: "help",
          padding: 0,
          flexShrink: 0,
          color: "rgba(255,255,255,0.35)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: size * 0.75,
          fontWeight: "700",
          lineHeight: 1,
          transition: "border-color 0.15s, color 0.15s",
          outline: "none",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,136,0.6)"
          ;(e.currentTarget as HTMLButtonElement).style.color = "#00ff88"
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)"
          ;(e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"
        }}
      >
        ?
      </button>

      {/* Tooltip bubble */}
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            [above ? "bottom" : "top"]: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "#111118",
            border: "1px solid rgba(0,255,136,0.25)",
            borderRadius: "2px",
            padding: "0.5rem 0.65rem",
            width: "200px",
            maxWidth: "min(200px, 80vw)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem",
            lineHeight: "1.55",
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.02em",
            boxShadow: "0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,136,0.08)",
            pointerEvents: "none",
            whiteSpace: "normal",
            // animate in
            animation: "ttfade 0.12s ease-out",
          }}
        >
          {/* Arrow */}
          <span style={{
            position: "absolute",
            [above ? "bottom" : "top"]: "-4px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "6px",
            height: "6px",
            background: "#111118",
            border: "1px solid rgba(0,255,136,0.25)",
            borderRight: "none",
            borderBottom: above ? "none" : undefined,
            borderTop: above ? undefined : "none",
            rotate: above ? "225deg" : "45deg",
          }} />
          {text}
        </span>
      )}

      <style>{`@keyframes ttfade { from { opacity:0; transform:translateX(-50%) translateY(4px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </span>
  )
}
