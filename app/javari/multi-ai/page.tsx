// app/javari/multi-ai/page.tsx
// Javari AI — Multi-AI Command Chat Interface
// Created: 2026-03-10

"use client"

import { useState, useRef, useEffect, useCallback } from "react"

type Mode = "single" | "team" | "auto"
type MessageRole = "user" | "javari" | "planner" | "worker" | "repair" | "system"

interface Message {
  id: number
  role: MessageRole
  content: string
  model?: string
  ts: string
  typing?: boolean
}

const MODE_CONFIG: Record<Mode, {
  label: string
  description: string
  color: string
  agents: string[]
}> = {
  single: {
    label: "SINGLE AI",
    description: "Direct channel to Javari Core",
    color: "#00ff88",
    agents: ["javari-core"],
  },
  team: {
    label: "TEAM MODE",
    description: "Planner + Worker + Javari Core collaborate",
    color: "#4488ff",
    agents: ["javari-core", "javari-planner", "javari-worker"],
  },
  auto: {
    label: "AUTONOMOUS",
    description: "Full autonomy — Javari executes without confirmation",
    color: "#ff9900",
    agents: ["javari-core", "javari-planner", "javari-worker", "javari-repair"],
  },
}

const ROLE_COLOR: Record<MessageRole, string> = {
  user:    "#888888",
  javari:  "#00ff88",
  planner: "#4488ff",
  worker:  "#aa44ff",
  repair:  "#ff9900",
  system:  "#333333",
}

const ROLE_PREFIX: Record<MessageRole, string> = {
  user:    "YOU",
  javari:  "JAVARI",
  planner: "PLANNER",
  worker:  "WORKER",
  repair:  "REPAIR",
  system:  "SYS",
}

// Simulated streaming responses per mode
const SIM_RESPONSES: Record<Mode, Array<{ role: MessageRole; content: string; model?: string }[]>> = {
  single: [
    [{ role: "javari", content: "Acknowledged. Processing your directive through Javari Core. All subsystems nominal. Ready for next instruction.", model: "claude-sonnet-4-20250514" }],
    [{ role: "javari", content: "Task queued and assigned to the execution pipeline. Estimated completion: next worker cycle. Monitoring for anomalies.", model: "claude-sonnet-4-20250514" }],
    [{ role: "javari", content: "Vector memory consulted. 3 relevant context fragments retrieved. Response synthesized from platform knowledge base.", model: "claude-sonnet-4-20250514" }],
  ],
  team: [
    [
      { role: "planner", content: "Decomposing directive into subtasks. Identified 3 execution units.", model: "gpt-4o" },
      { role: "worker",  content: "Subtask 1 accepted. Executing against Supabase schema.", model: "claude-haiku-4-5-20251001" },
      { role: "javari",  content: "Synthesis complete. All worker outputs merged. Delivering consolidated result.", model: "claude-sonnet-4-20250514" },
    ],
    [
      { role: "planner", content: "Dependency graph analyzed. No blockers detected. Proceeding.", model: "gpt-4o" },
      { role: "javari",  content: "Team cycle complete. 2 tasks promoted to DONE. 1 task remains pending external signal.", model: "claude-sonnet-4-20250514" },
    ],
  ],
  auto: [
    [
      { role: "planner", content: "Autonomous mode active. Generating execution plan without human confirmation gates.", model: "gpt-4o" },
      { role: "worker",  content: "Execution begun. Writing artifacts to R2. No intervention required.", model: "claude-haiku-4-5-20251001" },
      { role: "repair",  content: "Pre-flight check passed. Rollback triggers armed. Proceeding.", model: "gpt-4o-mini" },
      { role: "javari",  content: "Autonomous cycle complete. 4 artifacts generated. 0 errors. 0 human decisions required.", model: "claude-sonnet-4-20250514" },
    ],
  ],
}

let msgIdCounter = 0
function nextId() { return ++msgIdCounter }

function formatTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: "3px", alignItems: "center", marginLeft: "4px" }}>
      {[0,1,2].map(i => (
        <span
          key={i}
          style={{
            width: "4px", height: "4px", borderRadius: "50%",
            background: color,
            display: "inline-block",
            animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  )
}

export default function MultiAIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      role: "system",
      content: "Javari AI OS initialized. Select a mode and send a directive.",
      ts: formatTime(),
    }
  ])
  const [input, setInput] = useState("")
  const [mode, setMode] = useState<Mode>("team")
  const [sending, setSending] = useState(false)
  const [streamingIds, setStreamingIds] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const simIndex = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Simulate character-by-character streaming for a message
  async function streamMessage(id: number, fullText: string, delayMs = 18) {
    setStreamingIds(prev => new Set(prev).add(id))
    let current = ""
    for (let i = 0; i < fullText.length; i++) {
      current += fullText[i]
      const chunk = current
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: chunk, typing: true } : m))
      await new Promise(r => setTimeout(r, delayMs + Math.random() * 12))
    }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, typing: false } : m))
    setStreamingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const send = useCallback(async () => {
    if (!input.trim() || sending) return
    const userText = input.trim()
    setInput("")
    setSending(true)

    // Add user message
    const userMsg: Message = {
      id: nextId(), role: "user", content: userText, ts: formatTime()
    }
    setMessages(prev => [...prev, userMsg])

    // Try real API first
    let agentReplies: Array<{ role: MessageRole; content: string; model?: string }> | null = null
    try {
      const res = await fetch("/api/javari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: [{ role: "user", content: userText }] }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.reply) {
          agentReplies = [{ role: "javari", content: data.reply, model: data.model }]
        } else if (data.messages) {
          agentReplies = data.messages
        }
      }
    } catch { /* fall through to simulation */ }

    // Fallback to simulation
    if (!agentReplies) {
      const pool = SIM_RESPONSES[mode]
      agentReplies = pool[simIndex.current % pool.length]
      simIndex.current++
    }

    // Stream each agent response with staggered delays
    for (let i = 0; i < agentReplies.length; i++) {
      const reply = agentReplies[i]
      await new Promise(r => setTimeout(r, i === 0 ? 400 : 600))

      const msgId = nextId()
      const newMsg: Message = {
        id: msgId,
        role: reply.role as MessageRole,
        content: "",
        model: reply.model,
        ts: formatTime(),
        typing: true,
      }
      setMessages(prev => [...prev, newMsg])
      await streamMessage(msgId, reply.content)
    }

    setSending(false)
  }, [input, sending, mode])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }, [send])

  const cfg = MODE_CONFIG[mode]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mac-root {
          min-height: 100vh;
          max-height: 100vh;
          background: #050505;
          display: flex;
          flex-direction: column;
          font-family: 'JetBrains Mono', monospace;
          color: #c0c0c0;
          position: relative;
          overflow: hidden;
        }

        .mac-root::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,255,136,0.009) 2px, rgba(0,255,136,0.009) 4px
          );
          pointer-events: none; z-index: 0;
        }

        .mac-header {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 2rem;
          border-bottom: 1px solid #111;
          background: rgba(5,5,5,0.97);
          flex-shrink: 0;
        }

        .mac-title {
          font-family: 'Syne', sans-serif;
          font-size: 0.95rem; font-weight: 800;
          letter-spacing: 0.28em;
          color: #00ff88;
          text-transform: uppercase;
          text-shadow: 0 0 20px rgba(0,255,136,0.3);
        }

        .mac-subtitle {
          font-size: 0.55rem; letter-spacing: 0.18em;
          color: #222; margin-top: 0.2rem; text-transform: uppercase;
        }

        .mode-tabs {
          display: flex; gap: 0.5rem;
        }

        .mode-tab {
          padding: 0.35rem 0.85rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.15em;
          text-transform: uppercase;
          border: 1px solid #1a1a1a;
          background: transparent;
          color: #333;
          cursor: pointer;
          transition: all 0.15s;
        }

        .mode-tab:hover { color: #666; border-color: #333; }

        .mode-tab.active {
          color: var(--mode-color);
          border-color: var(--mode-color);
          background: color-mix(in srgb, var(--mode-color) 8%, transparent);
          box-shadow: 0 0 12px color-mix(in srgb, var(--mode-color) 20%, transparent);
        }

        .mode-bar {
          position: relative; z-index: 10;
          display: flex; align-items: center; gap: 1rem;
          padding: 0.5rem 2rem;
          border-bottom: 1px solid #0d0d0d;
          background: #030303;
          flex-shrink: 0;
          font-size: 0.58rem; letter-spacing: 0.12em;
        }

        .mode-agents {
          display: flex; gap: 0.5rem; margin-left: auto;
        }

        .agent-badge {
          padding: 0.15rem 0.5rem;
          border: 1px solid #1a1a1a;
          font-size: 0.55rem; letter-spacing: 0.1em;
          color: #333; text-transform: uppercase;
        }

        .agent-badge.active {
          color: var(--mode-color);
          border-color: color-mix(in srgb, var(--mode-color) 40%, transparent);
        }

        .mac-messages {
          flex: 1; overflow-y: auto;
          padding: 1.5rem 2rem;
          position: relative; z-index: 1;
          scrollbar-width: thin;
          scrollbar-color: #1a1a1a transparent;
        }
        .mac-messages::-webkit-scrollbar { width: 3px; }
        .mac-messages::-webkit-scrollbar-thumb { background: #1a1a1a; }

        .msg-row {
          display: flex; gap: 1rem;
          margin-bottom: 1.25rem;
          animation: msgIn 0.2s ease;
        }

        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .msg-gutter {
          flex-shrink: 0; width: 5rem; text-align: right;
          padding-top: 0.05rem;
        }

        .msg-role {
          font-size: 0.6rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
        }

        .msg-ts {
          font-size: 0.5rem; color: #1e1e1e;
          margin-top: 0.2rem; letter-spacing: 0.05em;
        }

        .msg-body {
          flex: 1; font-size: 0.78rem; line-height: 1.65;
          color: #999; padding-top: 0.05rem;
        }

        .msg-body.user { color: #ccc; }
        .msg-body.system { color: #2a2a2a; font-style: italic; }

        .msg-model {
          font-size: 0.5rem; color: #1e1e1e;
          letter-spacing: 0.1em; margin-top: 0.3rem;
          text-transform: uppercase;
        }

        .msg-divider {
          border: none; border-top: 1px solid #0d0d0d;
          margin: 0.75rem 0;
        }

        .mac-input-area {
          position: relative; z-index: 10;
          border-top: 1px solid #111;
          background: #030303;
          padding: 1rem 2rem;
          flex-shrink: 0;
        }

        .input-row {
          display: flex; gap: 0.75rem; align-items: flex-end;
        }

        .input-prefix {
          font-size: 0.7rem; color: #00ff88; padding-bottom: 0.6rem;
          flex-shrink: 0; opacity: 0.6;
        }

        .mac-textarea {
          flex: 1;
          background: #080808;
          border: 1px solid #1a1a1a;
          color: #ccc;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          padding: 0.6rem 0.75rem;
          resize: none;
          outline: none;
          line-height: 1.5;
          max-height: 120px;
          transition: border-color 0.15s;
        }

        .mac-textarea:focus { border-color: #2a2a2a; }
        .mac-textarea::placeholder { color: #1e1e1e; }

        .send-btn {
          padding: 0.6rem 1.25rem;
          background: transparent;
          border: 1px solid #00ff8833;
          color: #00ff8877;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          border-color: #00ff88;
          color: #00ff88;
          box-shadow: 0 0 12px rgba(0,255,136,0.15);
        }

        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .input-hint {
          font-size: 0.5rem; color: #161616; letter-spacing: 0.1em;
          margin-top: 0.4rem; text-align: right;
        }

        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30%            { transform: translateY(-3px); opacity: 1; }
        }

        .cursor-blink {
          display: inline-block; width: 7px; height: 0.85em;
          background: currentColor; margin-left: 1px;
          animation: blink 0.9s step-end infinite;
          vertical-align: text-bottom;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0; }
        }
      `}</style>

      <div className="mac-root">

        {/* Header */}
        <div className="mac-header">
          <div>
            <div className="mac-title">Javari Multi-AI Command</div>
            <div className="mac-subtitle">AI OS · Unified agent interface</div>
          </div>
          <div className="mode-tabs">
            {(["single","team","auto"] as Mode[]).map(m => (
              <button
                key={m}
                className={`mode-tab${mode === m ? " active" : ""}`}
                style={{ "--mode-color": MODE_CONFIG[m].color } as React.CSSProperties}
                onClick={() => setMode(m)}
              >
                {MODE_CONFIG[m].label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode bar */}
        <div
          className="mode-bar"
          style={{ "--mode-color": cfg.color } as React.CSSProperties}
        >
          <span style={{ color: cfg.color, fontWeight: 700, letterSpacing: "0.15em" }}>
            {cfg.label}
          </span>
          <span style={{ color: "#222" }}>{cfg.description}</span>
          <div className="mode-agents">
            {cfg.agents.map(a => (
              <span
                key={a}
                className="agent-badge active"
                style={{ "--mode-color": cfg.color } as React.CSSProperties}
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="mac-messages">
          {messages.map((msg, idx) => {
            const color = ROLE_COLOR[msg.role]
            const isStreaming = streamingIds.has(msg.id)
            return (
              <div key={msg.id}>
                {idx > 0 && msg.role === "user" && <hr className="msg-divider" />}
                <div className="msg-row">
                  <div className="msg-gutter">
                    <div className="msg-role" style={{ color }}>{ROLE_PREFIX[msg.role]}</div>
                    <div className="msg-ts">{msg.ts}</div>
                  </div>
                  <div className={`msg-body ${msg.role}`}>
                    {msg.content}
                    {isStreaming && (
                      <span className="cursor-blink" style={{ color }} />
                    )}
                    {msg.model && !isStreaming && (
                      <div className="msg-model">via {msg.model}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {sending && streamingIds.size === 0 && (
            <div className="msg-row">
              <div className="msg-gutter">
                <div className="msg-role" style={{ color: cfg.color }}>
                  {mode === "single" ? "JAVARI" : "PLANNER"}
                </div>
              </div>
              <div className="msg-body">
                <TypingIndicator color={cfg.color} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="mac-input-area">
          <div className="input-row">
            <span className="input-prefix">›</span>
            <textarea
              ref={inputRef}
              className="mac-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Send directive to Javari..."
              rows={1}
              disabled={sending}
            />
            <button
              className="send-btn"
              onClick={send}
              disabled={sending || !input.trim()}
            >
              {sending ? "Running" : "Execute"}
            </button>
          </div>
          <div className="input-hint">
            ENTER to send · SHIFT+ENTER for newline · mode: {cfg.label}
          </div>
        </div>

      </div>
    </>
  )
}
