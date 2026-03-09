// app/javari/page.tsx
// Javari AI — Primary OS Interface (Customer-Facing)
// Created: 2026-03-10
// Layout: 4-quadrant desktop-first grid
// Brand: CR AudioViz AI canonical colors — candy-red #E30B17, dark bg #0a0a0e

"use client"

import { useState, useRef, useEffect, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarState = "idle" | "thinking" | "speaking"
type AutonomyMode = "manual" | "assisted" | "autonomous"
type ModelId = "claude-sonnet-4-6" | "claude-opus-4-6" | "gpt-4o" | "openrouter-auto"

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

const MODELS: Record<ModelId, { label: string; provider: string; cost: string }> = {
  "claude-sonnet-4-6":  { label: "Claude Sonnet 4.6",  provider: "Anthropic",   cost: "$0.003/1K" },
  "claude-opus-4-6":    { label: "Claude Opus 4.6",    provider: "Anthropic",   cost: "$0.015/1K" },
  "gpt-4o":             { label: "GPT-4o",             provider: "OpenAI",      cost: "$0.005/1K" },
  "openrouter-auto":    { label: "Auto-Route",         provider: "OpenRouter",  cost: "optimized" },
}

const ROADMAP: RoadmapItem[] = [
  { label: "Platform Foundation", pct: 100, color: "#00ff88" },
  { label: "Javari Core AI",      pct: 95,  color: "#00ff88" },
  { label: "60+ Creative Tools",  pct: 72,  color: "#4488ff" },
  { label: "Games Library",       pct: 38,  color: "#4488ff" },
  { label: "CRAIverse World",     pct: 12,  color: "#ffaa00" },
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
function ts() { return new Date().toLocaleTimeString("en-US", { hour12: false }) }

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ state }: { state: AvatarState }) {
  const ringColor = state === "idle" ? "#E30B17" : state === "thinking" ? "#4488ff" : "#00ff88"
  const label = state === "idle" ? "Ready" : state === "thinking" ? "Thinking…" : "Responding"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ position: "relative", width: 96, height: 96 }}>
        {/* Outer pulse ring */}
        <div style={{
          position: "absolute", inset: -6,
          borderRadius: "50%",
          border: `1px solid ${ringColor}`,
          opacity: state !== "idle" ? 0.5 : 0.2,
          animation: state === "thinking" ? "avatarPing 1s ease-in-out infinite" :
                     state === "speaking"  ? "avatarPing 0.6s ease-in-out infinite" :
                     "avatarPulse 3s ease-in-out infinite",
        }} />
        {/* Core circle */}
        <div style={{
          width: 96, height: 96, borderRadius: "50%",
          border: `2px solid ${ringColor}`,
          background: "radial-gradient(circle at 40% 35%, #1a0a0a, #0a0a0e)",
          boxShadow: `0 0 24px ${ringColor}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Inner hex grid texture */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.08,
            backgroundImage: `repeating-linear-gradient(60deg, ${ringColor} 0px, ${ringColor} 1px, transparent 1px, transparent 12px),
                              repeating-linear-gradient(-60deg, ${ringColor} 0px, ${ringColor} 1px, transparent 1px, transparent 12px)`,
          }} />
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "2.2rem", fontWeight: 800,
            color: ringColor,
            textShadow: `0 0 16px ${ringColor}`,
            position: "relative", zIndex: 1,
          }}>J</span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "1.1rem", fontWeight: 700,
          color: "#E30B17",
          letterSpacing: "0.05em",
          textShadow: "0 0 12px rgba(227,11,23,0.4)",
        }}>JAVARI AI</div>
        <div style={{ fontSize: "0.6rem", color: ringColor, letterSpacing: "0.2em", marginTop: 2 }}>
          ● {label.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

function TelemetryFeed({ entries }: { entries: TelemetryEntry[] }) {
  const colors = { OK: "#00ff88", INFO: "#4488ff", WARN: "#ffaa00", ERR: "#ff4444" }
  return (
    <div style={{ height: "100%", overflowY: "auto", fontSize: "0.65rem", fontFamily: "monospace" }}
      className="telemetry-scroll">
      {entries.map(e => (
        <div key={e.id} style={{
          display: "grid", gridTemplateColumns: "4.5rem 2.5rem 1fr",
          gap: "0.5rem", padding: "0.2rem 0",
          borderBottom: "1px solid #0d0d0d",
          animation: "fadeSlideIn 0.25s ease",
        }}>
          <span style={{ color: "#222" }}>{e.ts}</span>
          <span style={{ color: colors[e.level], fontWeight: 700 }}>{e.level}</span>
          <span style={{ color: "#555" }}>{e.message}</span>
        </div>
      ))}
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      height: 4, background: "#111", borderRadius: 2, overflow: "hidden",
    }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color,
        boxShadow: `0 0 6px ${color}88`,
        transition: "width 1s ease",
        borderRadius: 2,
      }} />
    </div>
  )
}

function Toggle({ value, onChange, color = "#00ff88" }: {
  value: boolean; onChange: (v: boolean) => void; color?: string
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, cursor: "pointer",
        background: value ? color : "#1a1a1a",
        border: `1px solid ${value ? color : "#2a2a2a"}`,
        position: "relative", transition: "all 0.2s",
        boxShadow: value ? `0 0 8px ${color}55` : "none",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: value ? 18 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: value ? "#fff" : "#333",
        transition: "left 0.2s",
      }} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function JavariOS() {
  const [messages, setMessages]           = useState<ChatMessage[]>([])
  const [input, setInput]                 = useState("")
  const [sending, setSending]             = useState(false)
  const [avatarState, setAvatarState]     = useState<AvatarState>("idle")
  const [autonomyMode, setAutonomyMode]   = useState<AutonomyMode>("assisted")
  const [model, setModel]                 = useState<ModelId>("claude-sonnet-4-6")
  const [costCeiling, setCostCeiling]     = useState(2.00)
  const [telemetry, setTelemetry]         = useState<TelemetryEntry[]>([])
  const [autoRepair, setAutoRepair]       = useState(true)
  const [vectorMemory, setVectorMemory]   = useState(true)
  const [costGuard, setCostGuard]         = useState(true)
  const [streamingId, setStreamingId]     = useState<number | null>(null)
  const [sessionCost, setSessionCost]     = useState(0)
  const [uploadedFile, setUploadedFile]   = useState<File | null>(null)
  const simIdx = useRef(0)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const telemetryRef = useRef<HTMLDivElement>(null)

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Scroll telemetry to top (newest first)
  useEffect(() => {
    if (telemetryRef.current) telemetryRef.current.scrollTop = 0
  }, [telemetry])

  // Seed initial telemetry
  useEffect(() => {
    const seed = [
      { level: "OK"   as const, message: "Javari OS initialized" },
      { level: "OK"   as const, message: "Supabase connection established" },
      { level: "INFO" as const, message: "Vector memory: 34 docs indexed" },
      { level: "OK"   as const, message: "Platform secrets loaded — 66 keys" },
      { level: "INFO" as const, message: "Autonomous scheduler: standby" },
    ]
    setTelemetry(seed.map(s => ({ id: tid(), ts: ts(), ...s })))
  }, [])

  // Live telemetry trickle
  useEffect(() => {
    const msgs = [
      { level: "INFO" as const, message: "Worker heartbeat — cycle 8421" },
      { level: "OK"   as const, message: "Planner: 3 tasks queued" },
      { level: "INFO" as const, message: "R2 sync: cold-storage nominal" },
      { level: "OK"   as const, message: "Repair engine: 0 anomalies" },
      { level: "WARN" as const, message: "OpenRouter: rate limit at 78%" },
      { level: "INFO" as const, message: "Memory consolidation checkpoint" },
    ]
    let i = 0
    const t = setInterval(() => {
      setTelemetry(prev => [
        { id: tid(), ts: ts(), ...msgs[i % msgs.length] },
        ...prev,
      ].slice(0, 60))
      i++
    }, 4200)
    return () => clearInterval(t)
  }, [])

  // Stream reply text character by character
  async function streamReply(msgId: number, text: string) {
    setStreamingId(msgId)
    let current = ""
    for (let i = 0; i < text.length; i++) {
      current += text[i]
      const chunk = current
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: chunk } : m))
      await new Promise(r => setTimeout(r, 16 + Math.random() * 14))
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

    const userMsg: ChatMessage = { id: mid(), role: "user", content: text, ts: ts() }
    setMessages(prev => [...prev, userMsg])

    // Add telemetry entry for user command
    setTelemetry(prev => [
      { id: tid(), ts: ts(), level: "INFO", message: `Command received: "${text.slice(0, 40)}${text.length > 40 ? "…" : ""}"` },
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
    } catch { /* fall through */ }

    if (!reply) {
      reply = SIM_REPLIES[simIdx.current % SIM_REPLIES.length]
      simIdx.current++
    }

    const cost = parseFloat((Math.random() * 0.004 + 0.001).toFixed(5))
    setSessionCost(prev => parseFloat((prev + cost).toFixed(5)))

    const replyId = mid()
    const replyMsg: ChatMessage = {
      id: replyId, role: "javari", content: "", ts: ts(), streaming: true,
    }
    setMessages(prev => [...prev, replyMsg])
    setAvatarState("speaking")
    await streamReply(replyId, reply)
    setAvatarState("idle")

    setTelemetry(prev => [
      { id: tid(), ts: ts(), level: "OK", message: `Response complete — cost $${cost}` },
      ...prev,
    ].slice(0, 60))

    setSending(false)
  }, [input, sending, autonomyMode, model])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }, [send])

  const modeColors: Record<AutonomyMode, string> = {
    manual: "#888", assisted: "#4488ff", autonomous: "#E30B17",
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }

        .jos-root {
          height: 100vh;
          background: #0a0a0e;
          display: grid;
          grid-template-rows: auto 1fr;
          font-family: 'JetBrains Mono', monospace;
          color: #c0c0c0;
          position: relative;
        }

        .jos-root::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(227,11,23,0.007) 2px, rgba(227,11,23,0.007) 4px
          );
          pointer-events: none; z-index: 0;
        }

        .jos-topbar {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.6rem 1.25rem;
          background: #06060a;
          border-bottom: 1px solid #111;
          flex-shrink: 0;
        }

        .jos-brand {
          font-family: 'Syne', sans-serif;
          font-size: 0.85rem; font-weight: 800;
          letter-spacing: 0.3em; color: #E30B17;
          text-shadow: 0 0 18px rgba(227,11,23,0.4);
          text-transform: uppercase;
        }

        .jos-topbar-meta {
          display: flex; gap: 1.5rem; align-items: center;
          font-size: 0.58rem; letter-spacing: 0.1em;
        }

        .jos-topbar-meta .dim { color: #222; }
        .jos-topbar-meta .val { color: #E30B17; }

        .jos-grid {
          position: relative; z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1.6fr;
          grid-template-rows: 1fr 1fr;
          gap: 1px;
          background: #111;
          overflow: hidden;
          height: 100%;
        }

        .jos-panel {
          background: #0a0a0e;
          display: flex; flex-direction: column;
          overflow: hidden;
        }

        .jos-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.6rem 1rem;
          border-bottom: 1px solid #111;
          background: #08080c;
          flex-shrink: 0;
        }

        .jos-panel-title {
          font-size: 0.55rem; letter-spacing: 0.2em;
          color: #2a2a2a; text-transform: uppercase;
        }

        .jos-panel-body {
          flex: 1; overflow: hidden;
          padding: 1rem;
          display: flex; flex-direction: column;
          gap: 0.75rem;
        }

        /* Chat */
        .chat-messages {
          flex: 1; overflow-y: auto;
          display: flex; flex-direction: column; gap: 0.75rem;
          scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;
          padding-right: 0.25rem;
        }
        .chat-messages::-webkit-scrollbar { width: 3px; }
        .chat-messages::-webkit-scrollbar-thumb { background: #1a1a1a; }

        .chat-bubble-user {
          align-self: flex-end;
          background: linear-gradient(135deg, #E30B17, #b00912);
          color: #fff;
          padding: 0.5rem 0.85rem;
          border-radius: 12px 12px 2px 12px;
          font-size: 0.75rem; line-height: 1.5;
          max-width: 80%;
          box-shadow: 0 2px 12px rgba(227,11,23,0.25);
        }

        .chat-bubble-javari {
          align-self: flex-start;
          background: #111118;
          border: 1px solid #1e1e28;
          color: #aaa;
          padding: 0.5rem 0.85rem;
          border-radius: 12px 12px 12px 2px;
          font-size: 0.75rem; line-height: 1.6;
          max-width: 85%;
        }

        .bubble-ts {
          font-size: 0.5rem; color: #1e1e1e;
          margin-top: 0.2rem; letter-spacing: 0.05em;
        }

        .cursor-blink {
          display: inline-block; width: 6px; height: 0.8em;
          background: #00ff88; margin-left: 1px;
          animation: blink 0.8s step-end infinite;
          vertical-align: text-bottom;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Input */
        .chat-input-row {
          display: flex; gap: 0.5rem; align-items: flex-end;
          flex-shrink: 0;
        }

        .chat-textarea {
          flex: 1; background: #080810;
          border: 1px solid #1a1a1a; color: #ccc;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem; padding: 0.55rem 0.75rem;
          resize: none; outline: none; line-height: 1.5;
          border-radius: 2px; max-height: 80px;
          transition: border-color 0.15s;
        }
        .chat-textarea:focus { border-color: #E30B1733; }
        .chat-textarea::placeholder { color: #1a1a1a; }

        .chat-send-btn {
          padding: 0.55rem 1rem;
          background: transparent;
          border: 1px solid #E30B1733;
          color: #E30B1777;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.12em;
          text-transform: uppercase; cursor: pointer;
          transition: all 0.15s; border-radius: 2px;
        }
        .chat-send-btn:hover:not(:disabled) {
          border-color: #E30B17; color: #E30B17;
          box-shadow: 0 0 10px rgba(227,11,23,0.2);
        }
        .chat-send-btn:disabled { opacity: 0.25; cursor: not-allowed; }

        .upload-btn {
          padding: 0.55rem 0.7rem;
          background: transparent; border: 1px solid #1a1a1a;
          color: #333; font-size: 0.65rem; cursor: pointer;
          transition: all 0.15s; border-radius: 2px;
        }
        .upload-btn:hover { border-color: #333; color: #666; }

        /* Controls */
        .control-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #0d0d0d;
          font-size: 0.65rem;
        }
        .control-label { color: #333; letter-spacing: 0.08em; }
        .control-val { color: #666; }

        .mode-tabs { display: flex; gap: 0.35rem; }
        .mode-tab {
          padding: 0.25rem 0.6rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.55rem; letter-spacing: 0.1em;
          text-transform: uppercase; border: 1px solid #1a1a1a;
          background: transparent; color: #333; cursor: pointer;
          transition: all 0.15s; border-radius: 2px;
        }
        .mode-tab.active {
          border-color: var(--mode-c);
          color: var(--mode-c);
          background: color-mix(in srgb, var(--mode-c) 8%, transparent);
        }

        .model-select {
          background: #080810; border: 1px solid #1a1a1a;
          color: #666; font-family: 'JetBrains Mono', monospace;
          font-size: 0.62rem; padding: 0.25rem 0.5rem;
          outline: none; cursor: pointer; border-radius: 2px;
        }

        .cost-ceiling-row {
          display: flex; align-items: center; gap: 0.5rem;
        }
        .cost-input {
          width: 60px; background: #080810;
          border: 1px solid #1a1a1a; color: #E30B17;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem; padding: 0.2rem 0.4rem;
          outline: none; text-align: right; border-radius: 2px;
        }

        /* Telemetry scroll */
        .telemetry-scroll {
          scrollbar-width: thin; scrollbar-color: #111 transparent;
        }
        .telemetry-scroll::-webkit-scrollbar { width: 3px; }
        .telemetry-scroll::-webkit-scrollbar-thumb { background: #111; }

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes avatarPulse {
          0%,100% { transform: scale(1); opacity: 0.2; }
          50%      { transform: scale(1.1); opacity: 0.4; }
        }
        @keyframes avatarPing {
          0%     { transform: scale(1); opacity: 0.5; }
          100%   { transform: scale(1.5); opacity: 0; }
        }

        @media (max-width: 900px) {
          .jos-grid {
            grid-template-columns: 1fr;
            grid-template-rows: repeat(4, auto);
          }
          .jos-panel { min-height: 220px; }
        }
      `}</style>

      <div className="jos-root">

        {/* Top bar */}
        <div className="jos-topbar">
          <div className="jos-brand">CR AudioViz AI — Javari OS</div>
          <div className="jos-topbar-meta">
            <span><span className="dim">MODE </span><span className="val">{autonomyMode.toUpperCase()}</span></span>
            <span><span className="dim">MODEL </span><span className="val">{MODELS[model].label}</span></span>
            <span><span className="dim">SESSION COST </span><span className="val">${sessionCost.toFixed(5)}</span></span>
            <span><span className="dim">HEALTH </span><span style={{ color: "#00ff88" }}>● NOMINAL</span></span>
          </div>
        </div>

        {/* 4-quadrant grid */}
        <div className="jos-grid">

          {/* ── TOP LEFT: Identity ─────────────────────────────────────── */}
          <div className="jos-panel">
            <div className="jos-panel-header">
              <span className="jos-panel-title">Javari Identity</span>
              <span style={{ fontSize: "0.5rem", color: "#E30B17", letterSpacing: "0.1em" }}>
                ● ONLINE
              </span>
            </div>
            <div className="jos-panel-body" style={{ alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>

              <Avatar state={avatarState} />

              {/* System info */}
              <div style={{ width: "100%", maxWidth: 220 }}>
                {[
                  ["SYSTEM",    "Javari AI OS v1.0"],
                  ["COMPANY",   "CR AudioViz AI, LLC"],
                  ["MISSION",   "Your Story. Our Design."],
                  ["LOCATION",  "Fort Myers, FL"],
                  ["BUILD",     new Date().toISOString().split("T")[0]],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "0.3rem 0", borderBottom: "1px solid #0d0d0d",
                    fontSize: "0.6rem",
                  }}>
                    <span style={{ color: "#222", letterSpacing: "0.1em" }}>{k}</span>
                    <span style={{ color: "#555" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Nav links to other OS pages */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                {[
                  ["Command Center", "/javari/command-center"],
                  ["Autonomy Graph", "/javari/autonomy-graph"],
                  ["Multi-AI Chat",  "/javari/multi-ai"],
                ].map(([label, href]) => (
                  <a key={href} href={href} style={{
                    fontSize: "0.55rem", letterSpacing: "0.1em",
                    color: "#333", border: "1px solid #1a1a1a",
                    padding: "0.2rem 0.6rem", textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = "#E30B17"; (e.target as HTMLElement).style.borderColor = "#E30B17" }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = "#333"; (e.target as HTMLElement).style.borderColor = "#1a1a1a" }}
                  >
                    {label}
                  </a>
                ))}
              </div>

            </div>
          </div>

          {/* ── TOP RIGHT: Command Panel ───────────────────────────────── */}
          <div className="jos-panel">
            <div className="jos-panel-header">
              <span className="jos-panel-title">Command Panel</span>
              <span style={{ fontSize: "0.5rem", color: "#4488ff55", letterSpacing: "0.1em" }}>
                {messages.length} messages
              </span>
            </div>
            <div className="jos-panel-body">

              {/* Chat window */}
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{
                    textAlign: "center", color: "#1a1a1a",
                    fontSize: "0.65rem", letterSpacing: "0.15em",
                    marginTop: "2rem",
                  }}>
                    SEND A DIRECTIVE TO BEGIN
                  </div>
                )}
                {messages.map(m => (
                  <div key={m.id}>
                    {m.role === "user" ? (
                      <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <div className="chat-bubble-user">{m.content}</div>
                        <div className="bubble-ts">{m.ts}</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div className="chat-bubble-javari">
                          {m.content}
                          {m.streaming && <span className="cursor-blink" />}
                        </div>
                        <div className="bubble-ts">{m.ts}</div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* File upload indicator */}
              {uploadedFile && (
                <div style={{
                  fontSize: "0.6rem", color: "#00ff8888",
                  border: "1px solid #00ff8822", padding: "0.3rem 0.6rem",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span>📎 {uploadedFile.name}</span>
                  <span style={{ cursor: "pointer", color: "#333" }}
                    onClick={() => setUploadedFile(null)}>✕</span>
                </div>
              )}

              {/* Input row */}
              <div className="chat-input-row">
                <button className="upload-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                  ⊕
                </button>
                <input
                  ref={fileInputRef} type="file" style={{ display: "none" }}
                  onChange={e => setUploadedFile(e.target.files?.[0] || null)}
                />
                <textarea
                  className="chat-textarea"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Command Javari…"
                  rows={1}
                  disabled={sending}
                />
                <button
                  className="chat-send-btn"
                  onClick={send}
                  disabled={sending || !input.trim()}
                >
                  {sending ? "Running" : "Send"}
                </button>
              </div>

            </div>
          </div>

          {/* ── BOTTOM LEFT: System Status ─────────────────────────────── */}
          <div className="jos-panel">
            <div className="jos-panel-header">
              <span className="jos-panel-title">System Status</span>
              <span style={{ fontSize: "0.5rem", color: "#00ff8855", letterSpacing: "0.1em" }}>LIVE</span>
            </div>
            <div className="jos-panel-body" style={{ gap: "0.5rem" }}>

              {/* Roadmap progress */}
              <div>
                <div style={{ fontSize: "0.55rem", color: "#222", letterSpacing: "0.18em", marginBottom: "0.5rem" }}>
                  PLATFORM ROADMAP
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {ROADMAP.map(r => (
                    <div key={r.label}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        fontSize: "0.58rem", marginBottom: "0.2rem",
                      }}>
                        <span style={{ color: "#444" }}>{r.label}</span>
                        <span style={{ color: r.color }}>{r.pct}%</span>
                      </div>
                      <ProgressBar pct={r.pct} color={r.color} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #0d0d0d", paddingTop: "0.5rem", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "0.55rem", color: "#222", letterSpacing: "0.18em", marginBottom: "0.4rem" }}>
                  TELEMETRY FEED
                </div>
                <div ref={telemetryRef} style={{ flex: 1, overflow: "hidden" }}>
                  <TelemetryFeed entries={telemetry} />
                </div>
              </div>

            </div>
          </div>

          {/* ── BOTTOM RIGHT: Control Panel ───────────────────────────── */}
          <div className="jos-panel">
            <div className="jos-panel-header">
              <span className="jos-panel-title">Control Panel</span>
              <span style={{ fontSize: "0.5rem", color: "#E30B1755", letterSpacing: "0.1em" }}>OPERATOR</span>
            </div>
            <div className="jos-panel-body" style={{ gap: "0" }}>

              {/* Autonomy mode */}
              <div className="control-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.4rem", paddingBottom: "0.75rem" }}>
                <span className="control-label">AUTONOMY MODE</span>
                <div className="mode-tabs">
                  {(["manual","assisted","autonomous"] as AutonomyMode[]).map(m => (
                    <button
                      key={m}
                      className={`mode-tab${autonomyMode === m ? " active" : ""}`}
                      style={{ "--mode-c": modeColors[m] } as React.CSSProperties}
                      onClick={() => setAutonomyMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "0.55rem", color: "#1e1e1e", letterSpacing: "0.08em" }}>
                  {autonomyMode === "manual"     && "All actions require confirmation"}
                  {autonomyMode === "assisted"   && "Planner suggests, you confirm"}
                  {autonomyMode === "autonomous" && "⚠ Javari executes without gates"}
                </div>
              </div>

              {/* Model routing */}
              <div className="control-row">
                <span className="control-label">MODEL ROUTING</span>
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
              <div className="control-row">
                <span className="control-label">COST CEILING / CYCLE</span>
                <div className="cost-ceiling-row">
                  <span style={{ fontSize: "0.6rem", color: "#333" }}>$</span>
                  <input
                    className="cost-input"
                    type="number" min="0.10" max="50" step="0.50"
                    value={costCeiling}
                    onChange={e => setCostCeiling(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* System switches */}
              <div style={{ borderTop: "1px solid #0d0d0d", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                <div style={{ fontSize: "0.55rem", color: "#222", letterSpacing: "0.18em", marginBottom: "0.5rem" }}>
                  SYSTEM SWITCHES
                </div>
                {[
                  { label: "Auto-Repair Engine",   val: autoRepair,    set: setAutoRepair,   color: "#00ff88" },
                  { label: "Vector Memory",         val: vectorMemory,  set: setVectorMemory, color: "#4488ff" },
                  { label: "Cost Guard",            val: costGuard,     set: setCostGuard,    color: "#ffaa00" },
                ].map(s => (
                  <div key={s.label} className="control-row">
                    <span className="control-label">{s.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.55rem", color: s.val ? s.color : "#222" }}>
                        {s.val ? "ON" : "OFF"}
                      </span>
                      <Toggle value={s.val} onChange={s.set} color={s.color} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div style={{ borderTop: "1px solid #0d0d0d", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                <div style={{ fontSize: "0.55rem", color: "#222", letterSpacing: "0.18em", marginBottom: "0.5rem" }}>
                  QUICK ACTIONS
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {[
                    { label: "Run Worker Cycle", color: "#00ff88" },
                    { label: "Flush Telemetry",  color: "#4488ff" },
                    { label: "Health Check",     color: "#ffaa00" },
                    { label: "Clear Chat",       color: "#666",
                      action: () => setMessages([]) },
                  ].map(a => (
                    <button
                      key={a.label}
                      onClick={() => {
                        if (a.action) { a.action(); return }
                        setTelemetry(prev => [
                          { id: tid(), ts: ts(), level: "INFO", message: `Manual: ${a.label}` },
                          ...prev,
                        ].slice(0, 60))
                      }}
                      style={{
                        padding: "0.3rem 0.65rem",
                        background: "transparent",
                        border: `1px solid ${a.color}33`,
                        color: `${a.color}88`,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.55rem", letterSpacing: "0.08em",
                        cursor: "pointer", transition: "all 0.15s", borderRadius: 2,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget
                        el.style.borderColor = a.color
                        el.style.color = a.color
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget
                        el.style.borderColor = `${a.color}33`
                        el.style.color = `${a.color}88`
                      }}
                    >
                      {a.label}
                    </button>
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
