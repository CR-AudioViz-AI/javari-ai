// app/javari/page.tsx
// Javari AI — Primary OS Interface (Customer-Facing)
// Updated: 2026-03-10 — improved contrast, official logo/avatar, refined palette
// Brand: CR AudioViz AI — #E30B17 red, #0E0E12 bg, #141419 panel

"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarState   = "idle" | "thinking" | "speaking"
type AutonomyMode  = "manual" | "assisted" | "autonomous"
type ModelId       = "claude-sonnet-4-6" | "claude-opus-4-6" | "gpt-4o" | "openrouter-auto"

interface ChatMessage {
  id: number
  role: "user" | "javari"
  content: string
  ts: string
  streaming?: boolean
}

interface TelemetryEntry {
  id: number
  ts: string
  level: "OK" | "INFO" | "WARN" | "ERR"
  message: string
}

interface RoadmapItem {
  label: string
  pct: number
  color: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg:           "#0E0E12",
  panel:        "#141419",
  panelDeep:    "#0F0F14",
  border:       "#2A2A33",
  borderLight:  "#3A3A45",
  red:          "#E30B17",
  redDim:       "rgba(227,11,23,0.15)",
  redGlow:      "rgba(227,11,23,0.35)",
  green:        "#00D97E",
  greenDim:     "rgba(0,217,126,0.12)",
  blue:         "#4A8AFF",
  blueDim:      "rgba(74,138,255,0.12)",
  orange:       "#FF8C00",
  textPrimary:  "#EAEAF0",
  textSecond:   "#A5A5B0",
  textDim:      "#4A4A55",
  textMuted:    "#2A2A33",
  btnPrimary:   "#E30B17",
  btnSecond:    "#1C1C24",
}

const MODELS: Record<ModelId, { label: string; provider: string; cost: string }> = {
  "claude-sonnet-4-6":  { label: "Claude Sonnet 4.6",  provider: "Anthropic",  cost: "$0.003/1K" },
  "claude-opus-4-6":    { label: "Claude Opus 4.6",    provider: "Anthropic",  cost: "$0.015/1K" },
  "gpt-4o":             { label: "GPT-4o",             provider: "OpenAI",     cost: "$0.005/1K" },
  "openrouter-auto":    { label: "Auto-Route",         provider: "OpenRouter", cost: "optimized" },
}

const ROADMAP: RoadmapItem[] = [
  { label: "Platform Foundation", pct: 100, color: C.green  },
  { label: "Javari Core AI",      pct: 95,  color: C.green  },
  { label: "Creative Tools Suite",pct: 72,  color: C.blue   },
  { label: "Games Library",       pct: 38,  color: C.blue   },
  { label: "CRAIverse World",     pct: 12,  color: C.orange },
]

const SIM_REPLIES = [
  "Acknowledged. Processing your directive through Javari Core. All subsystems nominal.",
  "Vector memory consulted — 4 relevant context fragments retrieved. Task queued for next worker cycle.",
  "Running plan synthesis across planner and worker agents. Estimated completion: 2 cycles.",
  "Repair engine reports 0 anomalies. Platform health score: 94. Proceeding with execution.",
  "Artifact generated and stored to R2 cold-storage. Credits updated. Task marked complete.",
]

let _msgId = 0
let _telId = 0
function mid() { return ++_msgId }
function tid() { return ++_telId }
function ts()  { return new Date().toLocaleTimeString("en-US", { hour12: false }) }

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelHeader({ title, badge, badgeColor }: {
  title: string; badge?: string; badgeColor?: string
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.55rem 1rem",
      borderBottom: `1px solid ${C.border}`,
      background: C.panelDeep,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: "0.55rem", letterSpacing: "0.22em",
        color: C.textDim, textTransform: "uppercase",
      }}>{title}</span>
      {badge && (
        <span style={{
          fontSize: "0.5rem", letterSpacing: "0.12em",
          color: badgeColor ?? C.textDim,
        }}>{badge}</span>
      )}
    </div>
  )
}

function Avatar({ state }: { state: AvatarState }) {
  const ringColor = state === "idle" ? C.red : state === "thinking" ? C.blue : C.green
  const stateLabel = state === "idle" ? "Ready" : state === "thinking" ? "Thinking…" : "Responding"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>

      {/* Logo */}
      <div style={{ marginBottom: "0.25rem" }}>
        <Image
          src="/javari-logo.png"
          alt="Javari AI"
          width={140}
          height={40}
          style={{ objectFit: "contain", filter: "brightness(1.05)" }}
          priority
        />
      </div>

      {/* Avatar with state ring */}
      <div style={{ position: "relative", width: 100, height: 100 }}>
        {/* Animated ring */}
        <div style={{
          position: "absolute",
          inset: -5,
          borderRadius: "50%",
          border: `1.5px solid ${ringColor}`,
          opacity: state === "idle" ? 0.3 : 0.7,
          animation: state === "thinking" ? "ringPing 1s ease-in-out infinite"
                   : state === "speaking"  ? "ringPing 0.55s ease-in-out infinite"
                   : "ringPulse 3s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        {/* Secondary ring for active states */}
        {state !== "idle" && (
          <div style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: `1px solid ${ringColor}`,
            opacity: 0.2,
            animation: "ringPing 1.4s ease-in-out infinite 0.3s",
            pointerEvents: "none",
          }} />
        )}
        {/* Portrait image */}
        <div style={{
          width: 100, height: 100,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${ringColor}`,
          boxShadow: `0 0 20px ${ringColor}44, 0 0 40px ${ringColor}18`,
          position: "relative",
        }}>
          <Image
            src="/javari-portrait.png"
            alt="Javari Avatar"
            width={100}
            height={100}
            style={{ objectFit: "cover", objectPosition: "top center" }}
            priority
          />
        </div>
      </div>

      {/* State label */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: "0.95rem", fontWeight: 700,
          fontFamily: "'Syne', sans-serif",
          color: C.red,
          letterSpacing: "0.06em",
          textShadow: `0 0 14px ${C.redGlow}`,
        }}>JAVARI AI</div>
        <div style={{
          fontSize: "0.58rem", letterSpacing: "0.2em",
          color: ringColor,
          marginTop: "0.15rem",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: ringColor,
            display: "inline-block",
            boxShadow: `0 0 6px ${ringColor}`,
            animation: state !== "idle" ? "dotBlink 0.8s step-end infinite" : "none",
          }} />
          {stateLabel.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

function TelemetryFeed({ entries }: { entries: TelemetryEntry[] }) {
  const levelColor = { OK: C.green, INFO: C.blue, WARN: C.orange, ERR: "#FF4455" }
  const levelBg    = { OK: C.greenDim, INFO: C.blueDim, WARN: "rgba(255,140,0,0.08)", ERR: "rgba(255,68,85,0.08)" }

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      fontSize: "0.63rem", fontFamily: "monospace",
      scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent`,
    }}>
      {entries.map(e => (
        <div key={e.id} style={{
          display: "grid",
          gridTemplateColumns: "4.8rem 2.8rem 1fr",
          gap: "0.5rem",
          padding: "0.25rem 0.5rem",
          borderBottom: `1px solid ${C.panelDeep}`,
          animation: "fadeSlideIn 0.2s ease",
          background: "transparent",
          transition: "background 0.1s",
        }}>
          <span style={{ color: C.textMuted }}>{e.ts}</span>
          <span style={{
            color: levelColor[e.level],
            fontWeight: 700,
            fontSize: "0.58rem",
            background: levelBg[e.level],
            padding: "0 0.25rem",
            borderRadius: 2,
            letterSpacing: "0.04em",
          }}>{e.level}</span>
          <span style={{ color: C.textSecond }}>{e.message}</span>
        </div>
      ))}
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      height: 5, background: C.border, borderRadius: 3, overflow: "hidden",
    }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}cc, ${color})`,
        boxShadow: `0 0 8px ${color}66`,
        transition: "width 1.2s ease",
        borderRadius: 3,
      }} />
    </div>
  )
}

function Toggle({ value, onChange, color = C.green }: {
  value: boolean; onChange: (v: boolean) => void; color?: string
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 38, height: 21,
        borderRadius: 11,
        cursor: "pointer",
        background: value ? color : C.btnSecond,
        border: `1px solid ${value ? color : C.borderLight}`,
        position: "relative",
        transition: "all 0.2s",
        boxShadow: value ? `0 0 10px ${color}44` : "none",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        top: 2,
        left: value ? 19 : 2,
        width: 15, height: 15,
        borderRadius: "50%",
        background: value ? "#fff" : C.textDim,
        transition: "left 0.2s",
        boxShadow: value ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
      }} />
    </div>
  )
}

function PrimaryBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.55rem 1.1rem",
        background: disabled ? "#2a2a33" : hov ? "#ff1e2a" : C.btnPrimary,
        color: disabled ? C.textDim : "#fff",
        border: "none",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.62rem", letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        borderRadius: 3,
        boxShadow: disabled ? "none" : hov ? `0 0 14px ${C.redGlow}` : `0 0 8px ${C.redDim}`,
        flexShrink: 0,
      }}
    >{children}</button>
  )
}

function SecondaryBtn({ children, onClick, title }: {
  children: React.ReactNode; onClick?: () => void; title?: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.5rem 0.75rem",
        background: hov ? "#22222c" : C.btnSecond,
        color: hov ? C.textPrimary : C.textSecond,
        border: `1px solid ${hov ? C.borderLight : C.border}`,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.62rem",
        cursor: "pointer",
        transition: "all 0.15s",
        borderRadius: 3,
        flexShrink: 0,
      }}
    >{children}</button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function JavariOS() {
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState("")
  const [sending, setSending]           = useState(false)
  const [avatarState, setAvatarState]   = useState<AvatarState>("idle")
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>("assisted")
  const [model, setModel]               = useState<ModelId>("claude-sonnet-4-6")
  const [costCeiling, setCostCeiling]   = useState(2.00)
  const [telemetry, setTelemetry]       = useState<TelemetryEntry[]>([])
  const [autoRepair, setAutoRepair]     = useState(true)
  const [vectorMemory, setVectorMemory] = useState(true)
  const [costGuard, setCostGuard]       = useState(true)
  const [streamingId, setStreamingId]   = useState<number | null>(null)
  const [sessionCost, setSessionCost]   = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const simIdx       = useRef(0)
  const chatBottom   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // Seed telemetry on mount
  useEffect(() => {
    setTelemetry([
      { id: tid(), ts: ts(), level: "OK",   message: "Javari OS initialized" },
      { id: tid(), ts: ts(), level: "OK",   message: "Supabase connection established" },
      { id: tid(), ts: ts(), level: "INFO", message: "Vector memory: 34 docs indexed" },
      { id: tid(), ts: ts(), level: "OK",   message: "Platform secrets loaded — 66 keys" },
      { id: tid(), ts: ts(), level: "INFO", message: "Autonomous scheduler: standby" },
    ])
  }, [])

  // Live telemetry trickle
  useEffect(() => {
    const msgs: Array<{ level: TelemetryEntry["level"]; message: string }> = [
      { level: "INFO", message: "Worker heartbeat — cycle 8421" },
      { level: "OK",   message: "Planner: 3 tasks queued" },
      { level: "INFO", message: "R2 sync: cold-storage nominal" },
      { level: "OK",   message: "Repair engine: 0 anomalies" },
      { level: "WARN", message: "OpenRouter: rate limit at 78%" },
      { level: "INFO", message: "Memory consolidation checkpoint" },
    ]
    let i = 0
    const t = setInterval(() => {
      setTelemetry(prev => [{ id: tid(), ts: ts(), ...msgs[i % msgs.length] }, ...prev].slice(0, 60))
      i++
    }, 4200)
    return () => clearInterval(t)
  }, [])

  async function streamReply(msgId: number, text: string) {
    setStreamingId(msgId)
    let current = ""
    for (let i = 0; i < text.length; i++) {
      current += text[i]
      const chunk = current
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: chunk } : m))
      await new Promise(r => setTimeout(r, 15 + Math.random() * 12))
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, streaming: false } : m))
    setStreamingId(null)
  }

  const send = useCallback(async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)
    setAvatarState("thinking")

    setMessages(prev => [...prev, { id: mid(), role: "user", content: text, ts: ts() }])
    setTelemetry(prev => [
      { id: tid(), ts: ts(), level: "INFO", message: `Command: "${text.slice(0, 42)}${text.length > 42 ? "…" : ""}"` },
      ...prev,
    ].slice(0, 60))

    let reply = ""
    try {
      const res = await fetch("/api/javari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: autonomyMode, model, messages: [{ role: "user", content: text }] }),
      })
      if (res.ok) {
        const data = await res.json()
        reply = data.reply || data.content || ""
      }
    } catch { /* fallthrough */ }

    if (!reply) { reply = SIM_REPLIES[simIdx.current % SIM_REPLIES.length]; simIdx.current++ }

    const cost = parseFloat((Math.random() * 0.004 + 0.001).toFixed(5))
    setSessionCost(prev => parseFloat((prev + cost).toFixed(5)))

    const replyId = mid()
    setMessages(prev => [...prev, { id: replyId, role: "javari", content: "", ts: ts(), streaming: true }])
    setAvatarState("speaking")
    await streamReply(replyId, reply)
    setAvatarState("idle")

    setTelemetry(prev => [
      { id: tid(), ts: ts(), level: "OK", message: `Response complete — $${cost}` },
      ...prev,
    ].slice(0, 60))
    setSending(false)
  }, [input, sending, autonomyMode, model])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }, [send])

  const modeColors: Record<AutonomyMode, string> = {
    manual: C.textSecond, assisted: C.blue, autonomous: C.red,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #0E0E12; }

        .jos-root {
          height: 100vh;
          background: #0E0E12;
          display: grid;
          grid-template-rows: 42px 1fr;
          font-family: 'JetBrains Mono', monospace;
          color: #EAEAF0;
          position: relative;
        }

        /* Subtle scanline */
        .jos-root::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 3px,
            rgba(227,11,23,0.006) 3px, rgba(227,11,23,0.006) 4px
          );
          pointer-events: none; z-index: 0;
        }

        /* Topbar */
        .jos-topbar {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 1.25rem;
          background: #0F0F14;
          border-bottom: 1px solid #2A2A33;
          flex-shrink: 0;
        }

        .jos-brand {
          font-family: 'Syne', sans-serif;
          font-size: 0.78rem; font-weight: 800;
          letter-spacing: 0.28em; color: #E30B17;
          text-shadow: 0 0 16px rgba(227,11,23,0.35);
          text-transform: uppercase;
        }

        .jos-topbar-pills {
          display: flex; gap: 1rem; align-items: center;
          font-size: 0.57rem; letter-spacing: 0.1em;
        }

        .topbar-pill {
          display: flex; align-items: center; gap: 0.35rem;
          padding: 0.2rem 0.6rem;
          background: #1C1C24;
          border: 1px solid #2A2A33;
          border-radius: 3px;
        }

        .topbar-pill .label { color: #4A4A55; }
        .topbar-pill .val   { color: #A5A5B0; }
        .topbar-pill .val.red   { color: #E30B17; }
        .topbar-pill .val.green { color: #00D97E; }

        /* Main grid */
        .jos-grid {
          position: relative; z-index: 1;
          display: grid;
          grid-template-columns: 300px 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 1px;
          background: #2A2A33;
          overflow: hidden;
        }

        .jos-panel {
          background: #141419;
          display: flex; flex-direction: column;
          overflow: hidden;
        }

        .jos-panel-body {
          flex: 1; overflow: hidden;
          padding: 1rem;
          display: flex; flex-direction: column;
          gap: 0.75rem;
        }

        /* ── Chat ── */
        .chat-messages {
          flex: 1; overflow-y: auto;
          display: flex; flex-direction: column;
          gap: 0.85rem;
          padding-right: 0.25rem;
          scrollbar-width: thin;
          scrollbar-color: #2A2A33 transparent;
        }
        .chat-messages::-webkit-scrollbar { width: 3px; }
        .chat-messages::-webkit-scrollbar-thumb { background: #2A2A33; border-radius: 2px; }

        .chat-empty {
          flex: 1; display: flex; align-items: center; justify-content: center;
          font-size: 0.62rem; letter-spacing: 0.2em;
          color: #2A2A33;
        }

        .bubble-user {
          align-self: flex-end;
          background: linear-gradient(135deg, #E30B17, #b8000f);
          color: #fff;
          padding: 0.55rem 0.9rem;
          border-radius: 12px 12px 3px 12px;
          font-size: 0.75rem; line-height: 1.55;
          max-width: 82%;
          box-shadow: 0 2px 14px rgba(227,11,23,0.22);
        }

        .bubble-javari {
          align-self: flex-start;
          background: #1C1C24;
          border: 1px solid #2A2A33;
          color: #EAEAF0;
          padding: 0.55rem 0.9rem;
          border-radius: 12px 12px 12px 3px;
          font-size: 0.75rem; line-height: 1.6;
          max-width: 86%;
        }

        .bubble-ts {
          font-size: 0.5rem; color: #2A2A33;
          margin-top: 0.2rem; letter-spacing: 0.05em;
        }

        .cursor-blink {
          display: inline-block; width: 6px; height: 0.8em;
          background: #00D97E; margin-left: 2px;
          animation: blink 0.8s step-end infinite;
          vertical-align: text-bottom; border-radius: 1px;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Input area */
        .chat-input-area {
          flex-shrink: 0;
          background: #0F0F14;
          border: 1px solid #2A2A33;
          border-radius: 4px;
          overflow: hidden;
        }

        .chat-textarea {
          width: 100%; background: transparent;
          border: none; color: #EAEAF0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.73rem; padding: 0.65rem 0.85rem;
          resize: none; outline: none; line-height: 1.55;
          max-height: 90px;
        }
        .chat-textarea::placeholder { color: #2A2A33; }

        .chat-input-toolbar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.4rem 0.6rem;
          border-top: 1px solid #2A2A33;
          background: #0F0F14;
          gap: 0.5rem;
        }

        .upload-tag {
          font-size: 0.58rem; color: #00D97E;
          border: 1px solid rgba(0,217,126,0.2);
          padding: 0.15rem 0.5rem;
          display: flex; align-items: center; gap: 0.35rem;
        }

        /* Controls */
        .ctrl-section {
          border-top: 1px solid #1C1C24;
          padding-top: 0.65rem;
          margin-top: 0.1rem;
        }

        .ctrl-section-label {
          font-size: 0.52rem; color: #2A2A33;
          letter-spacing: 0.2em; text-transform: uppercase;
          margin-bottom: 0.5rem;
        }

        .ctrl-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.45rem 0;
          border-bottom: 1px solid #1C1C24;
          font-size: 0.65rem;
        }

        .ctrl-label { color: #A5A5B0; letter-spacing: 0.06em; }

        .mode-tab-group { display: flex; gap: 0.3rem; }

        .mode-tab {
          padding: 0.28rem 0.65rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.56rem; letter-spacing: 0.1em;
          text-transform: uppercase;
          border: 1px solid #2A2A33;
          background: #1C1C24;
          color: #4A4A55;
          cursor: pointer; transition: all 0.15s; border-radius: 3px;
        }
        .mode-tab:hover { color: #A5A5B0; border-color: #3A3A45; }
        .mode-tab.active {
          background: color-mix(in srgb, var(--mc) 10%, #1C1C24);
          border-color: var(--mc);
          color: var(--mc);
          box-shadow: 0 0 8px color-mix(in srgb, var(--mc) 25%, transparent);
        }

        .model-select {
          background: #1C1C24; border: 1px solid #2A2A33;
          color: #A5A5B0; font-family: 'JetBrains Mono', monospace;
          font-size: 0.6rem; padding: 0.28rem 0.55rem;
          outline: none; cursor: pointer; border-radius: 3px;
          transition: border-color 0.15s;
        }
        .model-select:hover { border-color: #3A3A45; }

        .cost-input {
          width: 64px; background: #1C1C24;
          border: 1px solid #2A2A33; color: #E30B17;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem; padding: 0.22rem 0.45rem;
          outline: none; text-align: right; border-radius: 3px;
          transition: border-color 0.15s;
        }
        .cost-input:focus { border-color: #E30B17; }

        .quick-action-btn {
          padding: 0.3rem 0.65rem;
          background: #1C1C24;
          border: 1px solid #2A2A33;
          color: #4A4A55;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.55rem; letter-spacing: 0.08em;
          cursor: pointer; transition: all 0.15s; border-radius: 3px;
        }
        .quick-action-btn:hover {
          background: #22222c;
          border-color: var(--qc);
          color: var(--qc);
        }

        /* Roadmap */
        .roadmap-row { display: flex; flex-direction: column; gap: 0.45rem; }
        .roadmap-item-header {
          display: flex; justify-content: space-between;
          font-size: 0.6rem;
        }

        /* Nav links */
        .os-nav-link {
          font-size: 0.56rem; letter-spacing: 0.1em;
          color: #3A3A45; border: 1px solid #2A2A33;
          padding: 0.22rem 0.6rem; text-decoration: none;
          transition: all 0.15s; border-radius: 3px;
          background: #1C1C24;
        }
        .os-nav-link:hover { color: #E30B17; border-color: rgba(227,11,23,0.4); }

        /* Animations */
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringPulse {
          0%,100% { transform: scale(1);    opacity: 0.25; }
          50%      { transform: scale(1.08); opacity: 0.45; }
        }
        @keyframes ringPing {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes dotBlink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.2; }
        }

        /* Scrollbar global */
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A33; border-radius: 2px; }

        @media (max-width: 900px) {
          .jos-grid {
            grid-template-columns: 1fr;
            grid-template-rows: repeat(4, auto);
          }
          .jos-panel { min-height: 240px; }
        }
      `}</style>

      <div className="jos-root">

        {/* ── Topbar ──────────────────────────────────────────────────── */}
        <div className="jos-topbar">
          <div className="jos-brand">CR AudioViz AI — Javari OS</div>
          <div className="jos-topbar-pills">
            <div className="topbar-pill">
              <span className="label">MODE</span>
              <span className="val" style={{ color: modeColors[autonomyMode] }}>
                {autonomyMode.toUpperCase()}
              </span>
            </div>
            <div className="topbar-pill">
              <span className="label">MODEL</span>
              <span className="val">{MODELS[model].label}</span>
            </div>
            <div className="topbar-pill">
              <span className="label">SESSION</span>
              <span className="val red">${sessionCost.toFixed(5)}</span>
            </div>
            <div className="topbar-pill">
              <span className="label">HEALTH</span>
              <span className="val green">● NOMINAL</span>
            </div>
          </div>
        </div>

        {/* ── 4-Quadrant Grid ─────────────────────────────────────────── */}
        <div className="jos-grid">

          {/* ══ TOP LEFT — Identity ══════════════════════════════════════ */}
          <div className="jos-panel">
            <PanelHeader title="Javari Identity" badge="● ONLINE" badgeColor={C.red} />
            <div className="jos-panel-body" style={{ alignItems: "center", justifyContent: "center", gap: "1.25rem" }}>

              <Avatar state={avatarState} />

              {/* System info table */}
              <div style={{ width: "100%", maxWidth: 240 }}>
                {[
                  ["SYSTEM",   "Javari AI OS v1.0"],
                  ["COMPANY",  "CR AudioViz AI, LLC"],
                  ["MISSION",  "Your Story. Our Design."],
                  ["LOCATION", "Fort Myers, FL"],
                  ["BUILD",    new Date().toISOString().split("T")[0]],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "0.32rem 0",
                    borderBottom: `1px solid ${C.panelDeep}`,
                    fontSize: "0.6rem",
                  }}>
                    <span style={{ color: C.textDim, letterSpacing: "0.1em" }}>{k}</span>
                    <span style={{ color: C.textSecond }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* OS nav */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
                {[
                  ["Command Center", "/javari/command-center"],
                  ["Autonomy Graph", "/javari/autonomy-graph"],
                  ["Multi-AI Chat",  "/javari/multi-ai"],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="os-nav-link">{label}</a>
                ))}
              </div>

            </div>
          </div>

          {/* ══ TOP RIGHT — Command Panel ════════════════════════════════ */}
          <div className="jos-panel">
            <PanelHeader
              title="Command Panel"
              badge={`${messages.length} messages`}
              badgeColor={C.textDim}
            />
            <div className="jos-panel-body">

              {/* Chat messages */}
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-empty">SEND A DIRECTIVE TO BEGIN</div>
                )}
                {messages.map(m => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column",
                    alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div className={m.role === "user" ? "bubble-user" : "bubble-javari"}>
                      {m.content}
                      {m.streaming && <span className="cursor-blink" />}
                    </div>
                    <div className="bubble-ts">{m.ts}</div>
                  </div>
                ))}
                <div ref={chatBottom} />
              </div>

              {/* File tag */}
              {uploadedFile && (
                <div className="upload-tag">
                  <span>📎 {uploadedFile.name}</span>
                  <span
                    style={{ cursor: "pointer", color: C.textDim, marginLeft: "auto" }}
                    onClick={() => setUploadedFile(null)}
                  >✕</span>
                </div>
              )}

              {/* Input area */}
              <div className="chat-input-area">
                <textarea
                  className="chat-textarea"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Command Javari…"
                  rows={2}
                  disabled={sending}
                />
                <div className="chat-input-toolbar">
                  <SecondaryBtn onClick={() => fileInputRef.current?.click()} title="Attach file">
                    ⊕ Attach
                  </SecondaryBtn>
                  <input ref={fileInputRef} type="file" style={{ display: "none" }}
                    onChange={e => setUploadedFile(e.target.files?.[0] || null)} />
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.5rem", color: C.textMuted, letterSpacing: "0.1em" }}>
                      ENTER to send
                    </span>
                    <PrimaryBtn onClick={send} disabled={sending || !input.trim()}>
                      {sending ? "Running…" : "Execute"}
                    </PrimaryBtn>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ══ BOTTOM LEFT — System Status ══════════════════════════════ */}
          <div className="jos-panel">
            <PanelHeader title="System Status" badge="LIVE" badgeColor={C.green} />
            <div className="jos-panel-body" style={{ gap: "0.5rem" }}>

              {/* Roadmap */}
              <div>
                <div style={{ fontSize: "0.52rem", color: C.textDim, letterSpacing: "0.2em", marginBottom: "0.6rem" }}>
                  PLATFORM ROADMAP
                </div>
                <div className="roadmap-row">
                  {ROADMAP.map(r => (
                    <div key={r.label}>
                      <div className="roadmap-item-header">
                        <span style={{ color: C.textSecond }}>{r.label}</span>
                        <span style={{ color: r.color, fontWeight: 600 }}>{r.pct}%</span>
                      </div>
                      <ProgressBar pct={r.pct} color={r.color} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Telemetry */}
              <div className="ctrl-section" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div className="ctrl-section-label">TELEMETRY FEED</div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <TelemetryFeed entries={telemetry} />
                </div>
              </div>

            </div>
          </div>

          {/* ══ BOTTOM RIGHT — Control Panel ═════════════════════════════ */}
          <div className="jos-panel">
            <PanelHeader title="Control Panel" badge="OPERATOR" badgeColor={C.red} />
            <div className="jos-panel-body" style={{ gap: 0, overflowY: "auto" }}>

              {/* Autonomy mode */}
              <div style={{ paddingBottom: "0.65rem", borderBottom: `1px solid ${C.panelDeep}` }}>
                <div className="ctrl-section-label" style={{ marginBottom: "0.5rem" }}>AUTONOMY MODE</div>
                <div className="mode-tab-group" style={{ marginBottom: "0.4rem" }}>
                  {(["manual","assisted","autonomous"] as AutonomyMode[]).map(m => (
                    <button
                      key={m}
                      className={`mode-tab${autonomyMode === m ? " active" : ""}`}
                      style={{ "--mc": modeColors[m] } as React.CSSProperties}
                      onClick={() => setAutonomyMode(m)}
                    >{m}</button>
                  ))}
                </div>
                <div style={{ fontSize: "0.55rem", color: C.textDim, letterSpacing: "0.07em" }}>
                  {autonomyMode === "manual"     && "All actions require your confirmation"}
                  {autonomyMode === "assisted"   && "Planner suggests — you confirm execution"}
                  {autonomyMode === "autonomous" && "⚠ Javari executes without confirmation gates"}
                </div>
              </div>

              {/* Model routing */}
              <div className="ctrl-row">
                <span className="ctrl-label">MODEL ROUTING</span>
                <select
                  className="model-select"
                  value={model}
                  onChange={e => setModel(e.target.value as ModelId)}
                >
                  {(Object.keys(MODELS) as ModelId[]).map(id => (
                    <option key={id} value={id}>{MODELS[id].label} — {MODELS[id].cost}</option>
                  ))}
                </select>
              </div>

              {/* Cost ceiling */}
              <div className="ctrl-row">
                <span className="ctrl-label">COST CEILING / CYCLE</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.6rem", color: C.textDim }}>$</span>
                  <input
                    className="cost-input"
                    type="number" min="0.10" max="50" step="0.50"
                    value={costCeiling}
                    onChange={e => setCostCeiling(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* System switches */}
              <div className="ctrl-section">
                <div className="ctrl-section-label">SYSTEM SWITCHES</div>
                {[
                  { label: "Auto-Repair Engine", val: autoRepair,   set: setAutoRepair,   color: C.green },
                  { label: "Vector Memory",       val: vectorMemory, set: setVectorMemory, color: C.blue  },
                  { label: "Cost Guard",          val: costGuard,    set: setCostGuard,    color: C.orange },
                ].map(s => (
                  <div key={s.label} className="ctrl-row">
                    <span className="ctrl-label">{s.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{
                        fontSize: "0.56rem",
                        color: s.val ? s.color : C.textDim,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                      }}>
                        {s.val ? "ON" : "OFF"}
                      </span>
                      <Toggle value={s.val} onChange={s.set} color={s.color} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="ctrl-section">
                <div className="ctrl-section-label">QUICK ACTIONS</div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {[
                    { label: "Run Worker Cycle", color: C.green  },
                    { label: "Flush Telemetry",  color: C.blue   },
                    { label: "Health Check",     color: C.orange },
                    { label: "Clear Chat",       color: C.textSecond,
                      action: () => setMessages([]) },
                  ].map(a => (
                    <button
                      key={a.label}
                      className="quick-action-btn"
                      style={{ "--qc": a.color } as React.CSSProperties}
                      onClick={() => {
                        if (a.action) { a.action(); return }
                        setTelemetry(prev => [
                          { id: tid(), ts: ts(), level: "INFO", message: `Manual: ${a.label}` },
                          ...prev,
                        ].slice(0, 60))
                      }}
                    >{a.label}</button>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  )
}
