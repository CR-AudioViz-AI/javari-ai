// app/javari/page.tsx — javariai.com
// Full Javari AI chat interface — Fortune 50 quality
// Beats ChatGPT, Claude.ai, Gemini in UX and features
// May 18, 2026 — CR AudioViz AI, LLC
"use client"
import { useState, useEffect, useRef, useCallback } from "react"

const PLATFORM = "https://craudiovizai.com"
const C = "#6366f1"

interface Msg {
  id: string; role: "user"|"assistant"; content: string
  model?: string; cost?: string; ts: number
}

const QUICK_PROMPTS = [
  "Write me a professional cover letter for a software engineer role",
  "Draft an NDA for two companies sharing AI code",
  "Plan a 5-day trip to Japan in October",
  "Analyze this business idea: AI-powered resume builder",
  "Write a LinkedIn post about launching a new product",
  "Create a workout plan for someone who can only exercise 30 min/day",
]

export default function JavariChat() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState("auto")
  const [totalCost, setTotalCost] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  const send = useCallback(async (text?: string) => {
    const message = text || input.trim()
    if (!message || loading) return
    setInput("")

    const userMsg: Msg = { id: Date.now().toString(), role: "user", content: message, ts: Date.now() }
    setMsgs(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch("/api/javari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model: model !== "auto" ? model : undefined }),
      })
      if (res.ok) {
        const d = await res.json() as { content?: string; response?: string; model?: string; cost_usd?: number }
        const reply = d.content ?? d.response ?? "Response received."
        const cost = d.cost_usd ?? 0
        setTotalCost(prev => prev + cost)
        setMsgs(prev => [...prev, {
          id: (Date.now()+1).toString(),
          role: "assistant", content: reply,
          model: d.model, cost: cost === 0 ? "$0.00" : "$"+cost.toFixed(6),
          ts: Date.now()
        }])
      }
    } catch { 
      setMsgs(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: "Connection error — please try again.", ts: Date.now() }])
    } finally { setLoading(false) }
  }, [input, loading, model])

  const isEmpty = msgs.length === 0

  return (
    <div style={{ display: "flex", height: "100vh", background: "#070710", fontFamily: "Inter, system-ui, sans-serif", color: "white" }}>
      
      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ width: 260, background: "#0d0d1a", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 16px 0" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span style={{ fontWeight: 800, fontSize: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Javari AI</span>
            </a>
            <button onClick={() => setMsgs([])} style={{ width: "100%", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 14px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", gap: 8, alignItems: "center", fontFamily: "inherit" }}>
              ✏️ New Chat
            </button>
          </div>
          
          <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
            <div style={{ color: "#4b5563", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Quick Start</div>
            {QUICK_PROMPTS.slice(0, 5).map(p => (
              <button key={p} onClick={() => send(p)} style={{ width: "100%", background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", textAlign: "left", padding: "7px 8px", borderRadius: 6, lineHeight: 1.4, marginBottom: 2, fontFamily: "inherit" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "white" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#6b7280" }}>
                {p.length > 48 ? p.slice(0, 46) + "…" : p}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ color: "#4b5563", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Ecosystem</div>
            {[["📄","Resume","https://javari-resume-builder.vercel.app"],["⚖️","Legal","https://javari-legal.vercel.app"],["✈️","Travel","https://javaritravel.com"],["🏠","Property","https://javariproperty.com"]].map(([e,n,u]) => (
              <a key={n} href={u} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", color: "#6b7280", textDecoration: "none", fontSize: 12, borderRadius: 6 }}
                 onMouseEnter={ev => { (ev.currentTarget as HTMLAnchorElement).style.color = "white" }}
                 onMouseLeave={ev => { (ev.currentTarget as HTMLAnchorElement).style.color = "#6b7280" }}>
                <span>{e}</span><span>{n}</span>
              </a>
            ))}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 11, color: "#374151" }}>Session cost: <span style={{ color: totalCost === 0 ? "#10b981" : "#f59e0b" }}>${totalCost.toFixed(6)}</span></div>
            <a href={PLATFORM+"/dashboard"} style={{ display: "block", marginTop: 8, color: "#6366f1", fontSize: 12, textDecoration: "none" }}>⚡ Dashboard →</a>
          </div>
        </div>
      )}

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}>☰</button>
            <span style={{ fontSize: 14, color: "#9ca3af" }}>Javari AI Chat</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>
              <option value="auto">Auto (best model)</option>
              <option value="groq-llama">Groq Llama 70b (Free)</option>
              <option value="deepseek">DeepSeek R1 (Free)</option>
              <option value="gpt-4o-mini">GPT-4o mini</option>
            </select>
            <a href="/" style={{ color: "#6b7280", fontSize: 12, textDecoration: "none" }}>← Home</a>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
          {isEmpty ? (
            <div style={{ textAlign: "center", maxWidth: 640, margin: "60px auto 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>What can I help you with?</h2>
              <p style={{ color: "#6b7280", marginBottom: 32 }}>Ask anything — I use 300+ AI models to give you the best answer, free.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {QUICK_PROMPTS.slice(0, 4).map(p => (
                  <button key={p} onClick={() => send(p)} style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", color: "#d1d5db", fontSize: 13, cursor: "pointer", textAlign: "left", lineHeight: 1.4, fontFamily: "inherit" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f140" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)" }}>
                    {p.length > 55 ? p.slice(0, 53) + "…" : p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {msgs.map(msg => (
                <div key={msg.id} style={{ marginBottom: 20, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ background: msg.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#111118", border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.06)" : "none", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && msg.model && (
                      <div style={{ fontSize: 11, color: "#374151" }}>
                        {msg.model} · {msg.cost}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 20 }}>
                  <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px", padding: "12px 16px", color: "#6b7280", fontSize: 14 }}>
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={bottom} />
            </>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Message Javari… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{ flex: 1, background: "none", border: "none", color: "white", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 24, maxHeight: 200, overflow: "hidden" }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={{ background: input.trim() && !loading ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1a1a2e", border: "none", borderRadius: 10, width: 38, height: 38, color: "white", cursor: input.trim() ? "pointer" : "default", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ↑
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#1f2937" }}>
            Javari AI — 300+ models · Free tier: 50 credits/month · <a href={PLATFORM+"/pricing"} style={{ color: "#374151" }}>Upgrade</a>
          </div>
        </div>
      </div>
    </div>
  )
}
