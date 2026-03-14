// app/javari/chat/page.tsx
// Javari AI Chat Interface — single chat + multi-AI team + roadmap execution
// Saturday, March 14, 2026
'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Cpu, Users, Map, Zap, ChevronDown, X } from 'lucide-react'

type Mode = 'single' | 'team' | 'roadmap'
type Role = 'user' | 'assistant' | 'system'

interface Message {
  id:      string
  role:    Role
  content: string
  model?:  string
  tier?:   string
  ts:      number
}

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'single',  label: 'Single AI',   icon: <Cpu  className="w-4 h-4" />, desc: 'Cost-optimised single model' },
  { id: 'team',    label: 'AI Team',     icon: <Users className="w-4 h-4" />, desc: 'Multi-model ensemble' },
  { id: 'roadmap', label: 'Execute',     icon: <Map  className="w-4 h-4" />, desc: 'Dispatch to roadmap queue' },
]

export default function JavariChatPage() {
  const [mode, setMode] = useState<Mode>('single')
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'system', content: 'Javari AI — execution layer online.', ts: Date.now() }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [stats,   setStats]   = useState<{ model?: string; tier?: string; cost?: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, ts: Date.now() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    setStats(null)

    try {
      const endpoint =
        mode === 'single'  ? '/api/javari/chat'            :
        mode === 'team'    ? '/api/javari/team'             :
                             '/api/javari/orchestrator/run'

      if (mode === 'roadmap') {
        // Dispatch to orchestrator queue
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ task: input, priority: 'normal' }),
        })
        const data = await res.json()
        setMessages(m => [...m, {
          id: Date.now().toString(), role: 'assistant', ts: Date.now(),
          content: data.job_id
            ? `✅ Task queued\nJob ID: ${data.job_id}\nStatus: ${data.status}\nThe worker will execute this autonomously.`
            : `Response: ${JSON.stringify(data)}`,
        }])
      } else {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ message: input, mode, history: messages.slice(-8) }),
        })
        const data = await res.json()
        if (data.content) {
          setMessages(m => [...m, {
            id: Date.now().toString(), role: 'assistant', ts: Date.now(),
            content: data.content, model: data.model, tier: data.tier,
          }])
          setStats({ model: data.model, tier: data.tier })
        } else {
          throw new Error(data.error ?? 'No response')
        }
      }
    } catch (err: unknown) {
      setMessages(m => [...m, {
        id: Date.now().toString(), role: 'assistant', ts: Date.now(),
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">Javari AI</span>
          <a href="https://craudiovizai.com" className="text-xs text-gray-500 hover:text-gray-400">← Platform</a>
        </div>

        {/* Mode selector */}
        <div className="flex bg-gray-900 rounded-lg p-1 gap-1">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                mode === m.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`} title={m.desc}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {stats && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-800 px-2 py-1 rounded">{stats.model?.split('-').slice(-2).join('-')}</span>
            <span className={`px-2 py-1 rounded ${
              stats.tier === 'free' ? 'bg-green-900 text-green-300' :
              stats.tier === 'low'  ? 'bg-blue-900 text-blue-300'  :
                                       'bg-yellow-900 text-yellow-300'
            }`}>{stats.tier}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'system' ? (
              <div className="text-xs text-gray-600 italic">{msg.content}</div>
            ) : (
              <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}>
                {msg.content}
                {msg.model && (
                  <div className="mt-2 pt-2 border-t border-gray-700 flex items-center gap-2 text-xs text-gray-400">
                    <Cpu className="w-3 h-3" /> {msg.model}
                    <span className={`px-1.5 rounded ${
                      msg.tier === 'free' ? 'text-green-400' :
                      msg.tier === 'low'  ? 'text-blue-400'  : 'text-yellow-400'
                    }`}>{msg.tier}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex items-end gap-2 bg-gray-900 rounded-2xl border border-gray-700 p-2">
          <textarea
            className="flex-1 bg-transparent resize-none text-sm text-white placeholder-gray-500 outline-none max-h-32 px-2 py-1"
            placeholder={
              mode === 'roadmap'
                ? 'Describe a task for Javari to execute autonomously...'
                : 'Message Javari AI...'
            }
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40
                       disabled:cursor-not-allowed flex items-center justify-center transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">
          {mode === 'single' && 'Free → Low → Moderate routing'}
          {mode === 'team'   && 'Multi-model ensemble — best answer wins'}
          {mode === 'roadmap'&& 'Task queued to javari_jobs — autonomous execution'}
        </p>
      </div>
    </div>
  )
}
