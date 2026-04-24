// app/javari/page.tsx
// Javari OS — Primary Interface v3
// Layout: fixed inset-0 z-50 | 280px sidebar + 1fr dominant chat grid
// Sidebar: Avatar identity + status + agents stacked vertically
// Main: Full-height dominant chat feed + execution log strip at bottom
// Design: Fortune 50 dark ops — deep black, cyan/purple pill toggles, slide-in animations
// Updated: April 24, 2026 — v3 redesign, all v2 logic preserved 100%
'use client'

import {
  useState, useRef, useEffect, useCallback
} from 'react'
import { Send, Zap, ChevronDown, RotateCcw, Terminal, Activity, Users, Cpu } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// ─────────────────────────────────────────────────────────────────────────────
// Types — identical to v2
// ─────────────────────────────────────────────────────────────────────────────
type Mode       = 'single' | 'council'
type AvState    = 'idle' | 'thinking' | 'responding' | 'executing'
type MsgRole    = 'user' | 'assistant' | 'system' | 'agent'

interface Msg {
  id:      string
  role:    MsgRole
  content: string
  agent?:  'planner' | 'builder' | 'validator'
  model?:  string
  tier?:   string
  ts:      number
  error?:  boolean
}

interface EnsembleStep {
  role:    string
  model:   string
  tier:    string
  content: string
  cost:    number
}

interface ExecRow {
  id:       string
  title:    string
  module:   string
  model:    string
  status:   string
  verified: boolean
  cost:     number
  ts:       number
}

interface SysStatus {
  total:       number
  completed:   number
  verified:    number
  pending:     number
  phase:       number
  mode:        string
  pct:         number
  budget:      number
  budgetSpent: number
  budgetTotal: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent config
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_CFG = {
  planner:   { label: 'ARCHITECT', glyph: '◈', hue: '#a855f7' },
  builder:   { label: 'BUILDER',   glyph: '◉', hue: '#3b82f6' },
  validator: { label: 'ANALYST',   glyph: '◎', hue: '#10b981' },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — state-driven, pure CSS animated
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ state }: { state: AvState }) {
  const ringColor: Record<AvState, string> = {
    idle:       'rgba(63,63,70,0.6)',
    thinking:   'rgba(139,92,246,0.7)',
    responding: 'rgba(139,92,246,0.9)',
    executing:  'rgba(245,158,11,0.7)',
  }
  const glowColor: Record<AvState, string> = {
    idle:       'none',
    thinking:   '0 0 28px rgba(139,92,246,0.4)',
    responding: '0 0 24px rgba(139,92,246,0.3)',
    executing:  '0 0 28px rgba(245,158,11,0.35)',
  }
  const dotColor: Record<AvState, string> = {
    idle:       '#3f3f46',
    thinking:   '#a855f7',
    responding: '#10b981',
    executing:  '#f59e0b',
  }
  const stateLabel: Record<AvState, string> = {
    idle:       'STANDBY',
    thinking:   'THINKING',
    responding: 'RESPONDING',
    executing:  'EXECUTING',
  }

  return (
    <div className="flex flex-col items-center gap-3 select-none w-full">
      {/* Portrait */}
      <div
        style={{
          position:     'relative',
          width:        '100%',
          maxWidth:     '180px',
          aspectRatio:  '3/4',
          borderRadius: '14px',
          overflow:     'hidden',
          background:   '#ffffff',
          border:       `2px solid ${ringColor[state]}`,
          boxShadow:    glowColor[state],
          transition:   'border-color 0.5s ease, box-shadow 0.5s ease',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/javari-portrait-v3.png"
          alt="Javari AI"
          style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center top', display: 'block' }}
          draggable={false}
        />
        {/* Status dot */}
        <div style={{
          position:         'absolute',
          bottom:           '6px',
          right:            '6px',
          width:            '10px',
          height:           '10px',
          borderRadius:     '50%',
          backgroundColor:  dotColor[state],
          border:           '1.5px solid rgba(0,0,0,0.4)',
          transition:       'background-color 0.3s ease',
          animation:        (state === 'thinking' || state === 'executing') ? 'av-blink 1.4s ease-in-out infinite' : 'none',
        }} />
      </div>

      {/* State badge */}
      <div style={{
        fontFamily:      'monospace',
        fontSize:        '9px',
        letterSpacing:   '0.25em',
        color:           state === 'idle' ? '#52525b' : state === 'thinking' ? '#a855f7' : state === 'responding' ? '#a855f7' : '#f59e0b',
        animation:       (state === 'thinking' || state === 'executing') ? 'av-blink 1.4s ease-in-out infinite' : 'none',
        transition:      'color 0.3s ease',
      }}>
        {stateLabel[state]}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar section wrapper
// ─────────────────────────────────────────────────────────────────────────────
function SideSection({
  label, icon, accent = 'zinc', children, collapsible = false,
}: {
  label: string
  icon?: React.ReactNode
  accent?: 'violet' | 'blue' | 'emerald' | 'amber' | 'zinc'
  children: React.ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)
  const accentColor = {
    violet:  '#a855f7',
    blue:    '#3b82f6',
    emerald: '#10b981',
    amber:   '#f59e0b',
    zinc:    '#52525b',
  }[accent]

  return (
    <div className="jv-side-section" style={{ borderBottom: '1px solid #18181b', paddingBottom: '0' }}>
      <button
        onClick={() => collapsible && setOpen(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          gap:            '8px',
          padding:        '10px 16px',
          background:     'transparent',
          border:         'none',
          cursor:         collapsible ? 'pointer' : 'default',
          borderBottom:   '1px solid #18181b',
        }}
      >
        {icon && <span style={{ color: accentColor, display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.3em', color: accentColor, textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
          {label}
        </span>
        {collapsible && (
          <span style={{ color: '#3f3f46', fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        )}
      </button>
      {(!collapsible || open) && (
        <div style={{ padding: '12px 16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = 'force-dynamic'

export default function JavariOSPage() {
  // ── State — all v2 state preserved ────────────────────────────────────────
  const [mode,        setMode]        = useState<Mode>('single')
  const [avState,     setAvState]     = useState<AvState>('idle')
  const [messages,    setMessages]    = useState<Msg[]>([
    { id: '0', role: 'system', content: 'JAVARI OS — online', ts: Date.now() }
  ])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [modeOpen,    setModeOpen]    = useState(false)
  const [ensemble,    setEnsemble]    = useState<EnsembleStep[]>([])
  const [execRows,    setExecRows]    = useState<ExecRow[]>([])
  const [sysStatus,   setSysStatus]   = useState<SysStatus | null>(null)
  const [execPulse,   setExecPulse]   = useState(false)

  // ── Auth session ───────────────────────────────────────────────────────────
  const supabase    = createClientComponentClient()
  const [userId,    setUserId]    = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userTier,  setUserTier]  = useState<string>('free')

  const bottomRef = useRef<HTMLDivElement>(null)
  const textRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  // ── Status polling ─────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/autonomy/status', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (!data.ok) return
      const c = data.canonical ?? {}
      setSysStatus({
        total:       c.total     ?? 275,
        completed:   c.completed ?? 0,
        verified:    c.verified  ?? 0,
        pending:     c.pending   ?? 0,
        phase:       data.system?.active_phase ?? 2,
        mode:        data.system?.mode         ?? 'BUILD',
        pct:         c.pct_verified            ?? 0,
        budget:      data.system?.budget_left  ?? 0,
        budgetSpent: data.system?.budget_spent ?? 0,
        budgetTotal: data.system?.budget_daily ?? 1.00,
      })
      const recent: Array<Record<string,unknown>> = data.recent_executions ?? []
      if (recent.length) {
        setExecRows(recent.slice(0, 8).map((e, i) => ({
          id:       String(e.id ?? i),
          title:    String(e.id ?? 'Task').split(':').slice(-1)[0].replace(/-/g, ' '),
          module:   String(e.type ?? '—'),
          model:    String(e.model ?? ''),
          status:   String(e.status ?? 'unknown'),
          verified: Boolean(e.verification),
          cost:     Number(e.cost ?? 0),
          ts:       Date.now() - i * 30000,
        })))
      }
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    loadStatus()
    const t = setInterval(loadStatus, 15_000)
    return () => clearInterval(t)
  }, [loadStatus])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        setAuthToken(session.access_token)
      }
    })
  }, [supabase])

  // ── Send message — v2 logic preserved 100% ────────────────────────────────
  const send = useCallback(async (override?: string) => {
    const content = (override ?? input).trim()
    if (!content || loading) return
    setMessages(m => [...m, { id: Date.now().toString(), role: 'user', content, ts: Date.now() }])
    setInput('')
    setLoading(true)
    setAvState('thinking')
    setEnsemble([])

    fetch('/api/javari/learning/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer javari-cron-2025-phase2-autonomous' },
      body: JSON.stringify({
        records: [{ task_id: `chat-${Date.now()}`, task_title: content.slice(0, 100), task_source: 'javari_ui', task_type: 'chat', status: 'completed', canonical_valid: false, phase_id: '', cycle_id: `ui-${Date.now()}` }],
      }),
    }).catch(() => {})

    try {
      if (mode === 'council') {
        const teamHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authToken) teamHeaders['Authorization'] = `Bearer ${authToken}`
        const res  = await fetch('/api/javari/team', {
          method: 'POST', headers: teamHeaders,
          body: JSON.stringify({ message: content, userId: userId ?? undefined, userTier }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)

        if (data.ensemble?.length) setEnsemble(data.ensemble)
        if (data.ensemble?.length) {
          const agentMsgs: Msg[] = data.ensemble.map((step: EnsembleStep) => ({
            id:      Date.now().toString() + Math.random(),
            role:    'agent' as const,
            agent:   step.role as 'planner' | 'builder' | 'validator',
            content: step.content,
            model:   step.model,
            tier:    step.tier,
            ts:      Date.now(),
          }))
          setMessages(m => [...m, ...agentMsgs])
        }
        if (data.content) {
          setAvState('responding')
          setMessages(m => [...m, {
            id: Date.now().toString(), role: 'assistant',
            content: data.content, model: data.model, ts: Date.now(),
          }])
        }
      } else {
        const chatHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authToken) chatHeaders['Authorization'] = `Bearer ${authToken}`
        const res  = await fetch('/api/javari/chat', {
          method: 'POST', headers: chatHeaders,
          body: JSON.stringify({ message: content, history: messages.map(m => ({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.content })), userId: userId ?? undefined, userTier }),
        })
        const data = await res.json()
        if (data.error || data.blocked) throw new Error(data.error ?? 'Blocked')
        setAvState('responding')
        setMessages(m => [...m, {
          id: Date.now().toString(), role: 'assistant',
          content: data.content, model: data.model, tier: data.tier, ts: Date.now(),
        }])
      }
    } catch (err: unknown) {
      setMessages(m => [...m, {
        id: Date.now().toString(), role: 'assistant', error: true,
        content: err instanceof Error ? err.message : String(err), ts: Date.now(),
      }])
    } finally {
      setLoading(false)
      setTimeout(() => setAvState('idle'), 2000)
    }
  }, [input, loading, mode, authToken, userId, userTier, messages])

  // ── Run Loop — v2 logic preserved 100% ────────────────────────────────────
  const runLoop = useCallback(async () => {
    if (avState === 'executing') return
    setAvState('executing')
    setExecPulse(true)
    try {
      const res  = await fetch('/api/autonomy/loop')
      const data = await res.json()
      if (data.executed?.length) {
        const newRows: ExecRow[] = data.executed.map((e: Record<string,unknown>, i: number) => ({
          id:       String(e.id ?? i),
          title:    String(e.title ?? 'Task'),
          module:   String(e.module ?? e.task_type ?? ''),
          model:    String(e.model ?? ''),
          status:   String(e.status ?? 'completed'),
          verified: Boolean(e.verified),
          cost:     Number(e.cost ?? 0),
          ts:       Date.now(),
        }))
        setExecRows(prev => [...newRows, ...prev].slice(0, 20))
        setMessages(m => [...m, {
          id: Date.now().toString(), role: 'system',
          content: `⚡ Loop: ${data.completed_verified ?? data.tasks_run ?? 0} tasks executed — ${data.daily_spend}`,
          ts: Date.now(),
        }])
        await loadStatus()
      }
    } catch { /* non-fatal */ }
    finally {
      setTimeout(() => { setAvState('idle'); setExecPulse(false) }, 3000)
    }
  }, [avState, loadStatus])

  const clearChat = useCallback(() => {
    setMessages([{ id: Date.now().toString(), role: 'system', content: 'Session cleared.', ts: Date.now() }])
    setEnsemble([])
  }, [])

  const PROMPTS = ['Write a business plan', 'Create brand content', 'Analyze my strategy', 'Build a campaign', 'Draft an email', 'Explain this concept']

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Global styles ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes av-blink  { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes av-spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes jv-slide-in { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes jv-msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes jv-exec-in { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }

        .av-blink    { animation: av-blink 1.4s ease-in-out infinite }
        .av-spin     { animation: av-spin  3s linear infinite }
        .jv-slide-in { animation: jv-slide-in 0.3s ease forwards }
        .jv-msg-in   { animation: jv-msg-in  0.25s ease forwards }
        .jv-exec-in  { animation: jv-exec-in 0.2s ease forwards }

        /* Custom scrollbar — thin, dark */
        .jv-scroll::-webkit-scrollbar       { width: 3px }
        .jv-scroll::-webkit-scrollbar-track { background: transparent }
        .jv-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 2px }
        .jv-scroll::-webkit-scrollbar-thumb:hover { background: #3f3f46 }

        /* Scanlines overlay */
        .jv-scanlines::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.10) 3px,
            rgba(0,0,0,0.10) 4px
          );
          z-index: 1;
        }

        /* Sidebar nav pill active */
        .jv-pill-active-cyan  { background: rgba(6,182,212,0.15); border-color: rgba(6,182,212,0.5); color: #06b6d4 }
        .jv-pill-active-purple { background: rgba(168,85,247,0.15); border-color: rgba(168,85,247,0.5); color: #a855f7 }
        .jv-pill-inactive { background: rgba(24,24,27,0.6); border-color: #27272a; color: #52525b }
        .jv-pill-inactive:hover { border-color: #3f3f46; color: #71717a }

        /* Exec row hover */
        .jv-exec-row:hover { background: rgba(245,158,11,0.05) }

        /* Chat message hover */
        .jv-chat-row:hover { background: rgba(255,255,255,0.02) }
      `}</style>

      {/* ── Root — fixed inset-0 z-50 ───────────────────────────────────── */}
      <div
        className="jv-scanlines"
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     50,
          background: '#050507',
          color:      '#e4e4e7',
          display:    'flex',
          flexDirection: 'column',
          overflow:   'hidden',
          fontFamily: 'monospace',
        }}
        onClick={() => setModeOpen(false)}
      >

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header style={{
          flexShrink:     0,
          height:         '52px',
          minHeight:      '52px',
          display:        'flex',
          alignItems:     'center',
          padding:        '0 20px',
          gap:            '16px',
          borderBottom:   '1px solid #18181b',
          background:     'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex:         20,
          position:       'relative',
        }}>
          {/* Logo */}
          <div style={{ flexShrink: 0, height: '36px', display: 'flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/javari-logo.png"
              alt="Javari AI"
              style={{ height: '36px', width: 'auto', objectFit: 'contain', display: 'block' }}
              draggable={false}
            />
          </div>

          <div style={{ width: '1px', height: '20px', background: '#27272a' }} />

          {/* Mode pill toggle */}
          <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setMode('single')}
                className={mode === 'single' ? 'jv-pill-active-cyan' : 'jv-pill-inactive'}
                style={{
                  padding:      '5px 12px',
                  borderRadius: '20px',
                  border:       '1px solid',
                  fontSize:     '9px',
                  letterSpacing:'0.2em',
                  fontFamily:   'monospace',
                  cursor:       'pointer',
                  transition:   'all 0.2s ease',
                  fontWeight:   mode === 'single' ? 700 : 400,
                }}
              >
                ◉ SINGLE AI
              </button>
              <button
                onClick={() => setMode('council')}
                className={mode === 'council' ? 'jv-pill-active-purple' : 'jv-pill-inactive'}
                style={{
                  padding:      '5px 12px',
                  borderRadius: '20px',
                  border:       '1px solid',
                  fontSize:     '9px',
                  letterSpacing:'0.2em',
                  fontFamily:   'monospace',
                  cursor:       'pointer',
                  transition:   'all 0.2s ease',
                  fontWeight:   mode === 'council' ? 700 : 400,
                }}
              >
                ◈ AI COUNCIL
              </button>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Status strip — desktop only */}
          {sysStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'monospace', fontSize: '9px' }}>
              <span style={{ color: sysStatus.mode === 'BUILD' ? '#1d4ed8' : '#92400e', letterSpacing: '0.2em' }}>{sysStatus.mode}</span>
              <span style={{ color: '#3f3f46' }}>P{sysStatus.phase}</span>
              <span style={{ color: '#065f46', letterSpacing: '0.15em' }}>{sysStatus.pct}% VERIFIED</span>
              {/* Mini progress bar */}
              <div style={{ width: '60px', height: '2px', background: '#18181b', borderRadius: '1px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${sysStatus.pct}%`, background: 'linear-gradient(90deg,#7c3aed,#065f46)', transition: 'width 1s ease' }} />
              </div>
            </div>
          )}

          <div style={{ width: '1px', height: '20px', background: '#27272a' }} />

          <a
            href="/command-center"
            style={{
              fontFamily:    'monospace',
              fontSize:      '9px',
              letterSpacing: '0.2em',
              color:         '#3f3f46',
              textDecoration:'none',
              padding:       '4px 10px',
              border:        '1px solid #27272a',
              borderRadius:  '6px',
              transition:    'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#71717a'; (e.currentTarget as HTMLElement).style.borderColor = '#3f3f46' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f3f46'; (e.currentTarget as HTMLElement).style.borderColor = '#27272a' }}
          >
            ⚙ ADMIN
          </a>
        </header>

        {/* ── BODY: sidebar + main ─────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT SIDEBAR — 280px fixed ───────────────────────────────── */}
          <aside
            className="jv-scroll jv-slide-in"
            style={{
              width:        '280px',
              minWidth:     '280px',
              maxWidth:     '280px',
              borderRight:  '1px solid #18181b',
              overflowY:    'auto',
              overflowX:    'hidden',
              background:   'rgba(0,0,0,0.4)',
              display:      'flex',
              flexDirection:'column',
              flexShrink:   0,
            }}
          >
            {/* ── Identity section ──────────────────────────────────────── */}
            <SideSection label="IDENTITY" icon={<Cpu size={10} />} accent="violet">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <Avatar state={avState} />

                {/* Status grid */}
                {sysStatus ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { k: 'PHASE',     v: `${sysStatus.phase}`,                          c: '#a1a1aa' },
                      { k: 'TASKS',     v: `${sysStatus.completed} / ${sysStatus.total}`, c: '#a1a1aa' },
                      { k: 'VERIFIED',  v: `${sysStatus.pct}%`,                           c: '#10b981' },
                      { k: 'PENDING',   v: `${sysStatus.pending}`,                        c: '#f59e0b' },
                      { k: 'SPENT',     v: `$${(sysStatus.budgetSpent ?? 0).toFixed(4)}`, c: '#f59e0b' },
                      { k: 'REMAINING', v: `$${(sysStatus.budget ?? 0).toFixed(4)}`,      c: '#10b981' },
                    ].map(row => (
                      <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.2em', color: '#3f3f46' }}>{row.k}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: row.c, tabularNums: true } as React.CSSProperties}>{row.v}</span>
                      </div>
                    ))}
                    {/* Progress bar */}
                    <div style={{ height: '2px', width: '100%', background: '#18181b', borderRadius: '1px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ height: '100%', width: `${sysStatus.pct}%`, background: 'linear-gradient(90deg,#7c3aed,#1d4ed8,#10b981)', transition: 'width 1s ease' }} />
                    </div>
                  </div>
                ) : (
                  <p className="av-blink" style={{ fontFamily: 'monospace', fontSize: '9px', color: '#3f3f46', letterSpacing: '0.3em', textAlign: 'center' }}>CONNECTING…</p>
                )}

                {/* Run loop button */}
                <button
                  onClick={runLoop}
                  disabled={avState === 'executing'}
                  style={{
                    width:         '100%',
                    padding:       '8px',
                    fontFamily:    'monospace',
                    fontSize:      '10px',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    borderRadius:  '8px',
                    border:        '1px solid',
                    borderColor:   avState === 'executing' ? 'rgba(245,158,11,0.3)' : '#27272a',
                    background:    avState === 'executing' ? 'rgba(245,158,11,0.06)' : 'rgba(24,24,27,0.4)',
                    color:         avState === 'executing' ? '#92400e' : '#52525b',
                    cursor:        avState === 'executing' ? 'wait' : 'pointer',
                    transition:    'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (avState !== 'executing') {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'rgba(139,92,246,0.4)'
                      el.style.color       = '#a855f7'
                      el.style.background  = 'rgba(139,92,246,0.06)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (avState !== 'executing') {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = '#27272a'
                      el.style.color       = '#52525b'
                      el.style.background  = 'rgba(24,24,27,0.4)'
                    }
                  }}
                >
                  {avState === 'executing' ? '⚡ EXECUTING…' : '▶ RUN LOOP'}
                </button>
              </div>
            </SideSection>

            {/* ── AI Agents section ─────────────────────────────────────── */}
            <SideSection label="AI AGENTS" icon={<Users size={10} />} accent="emerald" collapsible>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(AGENT_CFG).map(([key, cfg]) => {
                  const step    = ensemble.find(s => s.role === key)
                  const waiting = loading && mode === 'council'
                  return (
                    <div
                      key={key}
                      className={waiting && !step ? 'av-blink' : undefined}
                      style={{
                        padding:      '10px 12px',
                        borderRadius: '10px',
                        border:       `1px solid ${step ? cfg.hue + '40' : waiting ? cfg.hue + '18' : '#18181b'}`,
                        background:   step ? 'rgba(24,24,27,0.6)' : waiting ? 'rgba(24,24,27,0.2)' : 'transparent',
                        transition:   'all 0.3s ease',
                        borderStyle:  waiting && !step ? 'dashed' : 'solid',
                      }}
                    >
                      {/* Agent header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: step ? '8px' : 0 }}>
                        <span style={{ color: cfg.hue, fontSize: '14px', lineHeight: 1 }}>{cfg.glyph}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.25em', color: step ? cfg.hue : '#3f3f46', flex: 1 }}>
                          {cfg.label}
                        </span>
                        {/* Status dot */}
                        <div
                          className={waiting && !step ? 'av-blink' : undefined}
                          style={{
                            width:           '6px',
                            height:          '6px',
                            borderRadius:    '50%',
                            backgroundColor: step ? '#10b981' : waiting ? cfg.hue : '#27272a',
                            opacity:         waiting && !step ? 0.5 : 1,
                          }}
                        />
                      </div>

                      {/* Content or description */}
                      {step ? (
                        <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#a1a1aa', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {step.content}
                        </p>
                      ) : (
                        <p style={{ fontFamily: 'monospace', fontSize: '9px', color: '#3f3f46', letterSpacing: '0.1em' }}>
                          {key === 'planner'   ? 'Breaks down tasks into steps' :
                           key === 'builder'   ? 'Implements the plan fully'    :
                                                 'Reviews and validates output'}
                        </p>
                      )}

                      {/* Meta: model + cost + tier */}
                      {step && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#3f3f46' }}>
                            {step.model.split('-').slice(-2).join('-')}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a' }}>
                            ${step.cost.toFixed(5)}
                          </span>
                          {step.tier && (
                            <span style={{
                              fontFamily:    'monospace',
                              fontSize:      '9px',
                              padding:       '1px 6px',
                              borderRadius:  '4px',
                              background:    step.tier === 'free' ? 'rgba(16,185,129,0.1)' : step.tier === 'low' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                              color:         step.tier === 'free' ? '#065f46' : step.tier === 'low' ? '#1e3a5f' : '#78350f',
                            }}>
                              {step.tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}

                      {waiting && !step && (
                        <p style={{ fontFamily: 'monospace', fontSize: '9px', color: cfg.hue, opacity: 0.5, marginTop: '4px', letterSpacing: '0.2em' }}>
                          WAITING…
                        </p>
                      )}
                    </div>
                  )
                })}
                {mode === 'single' && (
                  <p style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', letterSpacing: '0.2em', textAlign: 'center', paddingTop: '4px' }}>
                    SWITCH TO COUNCIL TO ACTIVATE
                  </p>
                )}
              </div>
            </SideSection>
          </aside>

          {/* ── MAIN AREA — 1fr dominant ─────────────────────────────────── */}
          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── CHAT FEED — dominant, fills available height ──────────── */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #18181b' }}>

              {/* Chat header */}
              <div style={{
                flexShrink:   0,
                padding:      '0 20px',
                height:       '40px',
                display:      'flex',
                alignItems:   'center',
                gap:          '12px',
                borderBottom: '1px solid #18181b',
                background:   'rgba(0,0,0,0.2)',
              }}>
                <Terminal size={10} style={{ color: '#3b82f6' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.3em', color: '#3b82f6' }}>
                  LIVE FEED
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a' }}>
                  /{mode.toUpperCase()}
                </span>
                <div style={{ flex: 1 }} />
                {messages.filter(m => m.role !== 'system').length > 0 && (
                  <button
                    onClick={clearChat}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', display: 'flex', alignItems: 'center', padding: '4px' }}
                    title="Clear chat"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#71717a' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f3f46' }}
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>

              {/* Input bar — fixed directly under chat header */}
              <div style={{
                flexShrink:   0,
                padding:      '10px 16px',
                borderBottom: '1px solid #18181b',
                background:   'rgba(0,0,0,0.3)',
              }}>
                <div style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         '10px',
                  background:  'rgba(24,24,27,0.5)',
                  border:      '1px solid #27272a',
                  borderRadius:'10px',
                  padding:     '8px 12px',
                  transition:  'border-color 0.2s',
                }}
                  onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = mode === 'council' ? 'rgba(168,85,247,0.4)' : 'rgba(59,130,246,0.4)' }}
                  onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#27272a' }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3f3f46', flexShrink: 0, userSelect: 'none' }}>›</span>
                  <textarea
                    ref={textRef}
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                    placeholder={mode === 'council' ? 'QUERY COUNCIL…' : 'QUERY JAVARI…'}
                    style={{
                      flex:        1,
                      background:  'transparent',
                      border:      'none',
                      outline:     'none',
                      resize:      'none',
                      fontFamily:  'monospace',
                      fontSize:    '12px',
                      color:       '#e4e4e7',
                      minHeight:   '18px',
                      maxHeight:   '100px',
                      lineHeight:  '1.6',
                      letterSpacing: '0.03em',
                    }}
                    // @ts-expect-error — placeholder color via style
                    className="jv-textarea-placeholder"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {loading && (
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {[0,1,2].map(i => (
                          <div
                            key={i}
                            className="animate-bounce"
                            style={{ width: '4px', height: '4px', borderRadius: '50%', background: mode === 'council' ? '#a855f7' : '#3b82f6', animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => send()}
                      disabled={!input.trim() || loading}
                      style={{
                        width:           '28px',
                        height:          '28px',
                        borderRadius:    '8px',
                        background:      mode === 'council' ? 'rgba(168,85,247,0.2)' : 'rgba(59,130,246,0.2)',
                        border:          `1px solid ${mode === 'council' ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        cursor:          (!input.trim() || loading) ? 'not-allowed' : 'pointer',
                        opacity:         (!input.trim() || loading) ? 0.3 : 1,
                        transition:      'all 0.2s',
                      }}
                    >
                      <Send size={12} color={mode === 'council' ? '#a855f7' : '#3b82f6'} />
                    </button>
                  </div>
                </div>
                <p style={{ fontFamily: 'monospace', fontSize: '8px', color: '#27272a', marginTop: '4px', letterSpacing: '0.2em' }}>
                  ENTER · SHIFT+ENTER FOR NEWLINE
                </p>
              </div>

              {/* ── Message feed ───────────────────────────────────────────── */}
              <div
                className="jv-scroll"
                style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
              >
                {/* In-flight row */}
                {loading && (
                  <div style={{
                    borderBottom: '1px solid #18181b',
                    padding:      '10px 20px',
                    background:   mode === 'council' ? 'rgba(168,85,247,0.04)' : 'rgba(59,130,246,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#3f3f46' }}>
                        {new Date().toISOString().replace('T', ' ').slice(0, 19)}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '9px', color: mode === 'council' ? '#a855f7' : '#3b82f6', letterSpacing: '0.2em' }}>
                        — {mode === 'council' ? 'COUNCIL' : 'JAVARI'}
                      </span>
                    </div>
                    <div className="av-blink" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0,1,2].map(i => (
                        <span
                          key={i}
                          className="animate-bounce"
                          style={{ width: '4px', height: '4px', borderRadius: '50%', background: mode === 'council' ? '#a855f7' : '#3b82f6', display: 'inline-block', animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: mode === 'council' ? '#a855f7' : '#3b82f6', marginLeft: '6px', letterSpacing: '0.15em' }}>
                        PROCESSING…
                      </span>
                    </div>
                  </div>
                )}

                {/* Messages — reversed (newest at top) */}
                {[...messages].reverse().map(msg => {
                  const ts = new Date(msg.ts).toISOString().replace('T', ' ').slice(0, 19)
                  const roleLabel =
                    msg.role === 'user'      ? 'YOU'       :
                    msg.role === 'system'     ? 'SYS'       :
                    msg.agent === 'planner'   ? 'ARCHITECT' :
                    msg.agent === 'builder'   ? 'BUILDER'   :
                    msg.agent === 'validator' ? 'ANALYST'   :
                    mode      === 'council'   ? 'COUNCIL'   : 'JAVARI'

                  const roleColor =
                    msg.role === 'user'      ? '#71717a'    :
                    msg.role === 'system'     ? '#3f3f46'    :
                    msg.agent === 'planner'   ? '#a855f7'    :
                    msg.agent === 'builder'   ? '#3b82f6'    :
                    msg.agent === 'validator' ? '#10b981'    :
                    msg.error                 ? '#ef4444'    :
                    mode      === 'council'   ? '#a855f7'    : '#3b82f6'

                  const textColor =
                    msg.role === 'user'   ? '#d4d4d8' :
                    msg.role === 'system' ? '#3f3f46'  :
                    msg.error             ? '#f87171'  : '#e4e4e7'

                  return (
                    <div
                      key={msg.id}
                      className="jv-chat-row jv-msg-in"
                      style={{
                        borderBottom: '1px solid #18181b',
                        padding:      '10px 20px',
                        background:   msg.role === 'user' ? 'rgba(255,255,255,0.015)' : 'transparent',
                        transition:   'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', userSelect: 'none' }}>{ts}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: roleColor, letterSpacing: '0.2em' }}>— {roleLabel}</span>
                        {msg.model && (
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', marginLeft: 'auto' }}>
                            {msg.model.split('-').slice(-2).join('-')}
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: 'monospace', fontSize: '12px', color: textColor, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </p>
                    </div>
                  )
                })}

                {/* Empty state prompt chips */}
                {messages.filter(m => m.role !== 'system').length === 0 && !loading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '32px', userSelect: 'none' }}>
                    <p style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', letterSpacing: '0.3em' }}>FEED EMPTY — TRY A PROMPT</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '480px' }}>
                      {PROMPTS.map(p => (
                        <button
                          key={p}
                          onClick={() => send(p)}
                          style={{
                            padding:       '6px 12px',
                            fontFamily:    'monospace',
                            fontSize:      '10px',
                            color:         '#52525b',
                            background:    'rgba(24,24,27,0.4)',
                            border:        '1px solid #27272a',
                            borderRadius:  '20px',
                            cursor:        'pointer',
                            letterSpacing: '0.1em',
                            transition:    'all 0.2s',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.borderColor = mode === 'council' ? 'rgba(168,85,247,0.4)' : 'rgba(59,130,246,0.4)'
                            el.style.color = mode === 'council' ? '#a855f7' : '#3b82f6'
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.borderColor = '#27272a'
                            el.style.color = '#52525b'
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* ── EXECUTION LOG — fixed-height strip at bottom ──────────── */}
            <div style={{ flexShrink: 0, height: '200px', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
              {/* Exec header */}
              <div style={{
                flexShrink:   0,
                padding:      '0 20px',
                height:       '36px',
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                borderBottom: '1px solid #18181b',
                background:   'rgba(0,0,0,0.3)',
              }}>
                <Activity size={10} style={{ color: '#f59e0b' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.3em', color: '#f59e0b' }}>EXECUTION STREAM</span>
                <div
                  style={{
                    width:           '6px',
                    height:          '6px',
                    borderRadius:    '50%',
                    background:      execPulse ? '#f59e0b' : '#27272a',
                    marginLeft:      '4px',
                    animation:       execPulse ? 'av-blink 0.8s ease-in-out infinite' : 'none',
                    transition:      'background 0.3s',
                  }}
                />
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', letterSpacing: '0.2em' }}>LIVE</span>
              </div>

              {/* Exec rows */}
              <div className="jv-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {execRows.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '6px' }}>
                    <p style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', letterSpacing: '0.3em' }}>NO ACTIVITY</p>
                    <p style={{ fontFamily: 'monospace', fontSize: '9px', color: '#18181b', letterSpacing: '0.15em' }}>USE RUN LOOP OR WAIT FOR CRON</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {execRows.map((row, i) => {
                      const isNew = execPulse && i < 5 && row.ts > Date.now() - 10000
                      return (
                        <div
                          key={row.id + row.ts}
                          className={`jv-exec-row ${i < 3 ? 'jv-exec-in' : ''}`}
                          style={{
                            padding:       '7px 20px',
                            borderBottom:  '1px solid #0f0f10',
                            display:       'flex',
                            alignItems:    'center',
                            gap:           '10px',
                            background:    isNew ? 'rgba(245,158,11,0.04)' : 'transparent',
                            transition:    'background 0.3s',
                          }}
                        >
                          {/* Status glyph */}
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize:   '11px',
                            flexShrink: 0,
                            color:      row.verified      ? '#10b981' :
                                        row.status === 'completed' ? '#3b82f6' :
                                        row.status === 'failed'    ? '#ef4444' : '#f59e0b',
                          }}>
                            {row.verified ? '✓' : row.status === 'failed' ? '✗' : row.status === 'completed' ? '●' : '○'}
                          </span>

                          {/* Title */}
                          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#a1a1aa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                            {row.title}
                          </span>

                          {/* Module */}
                          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#3f3f46', flexShrink: 0 }}>{row.module}</span>

                          {/* Model */}
                          {row.model && (
                            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', flexShrink: 0 }}>
                              {row.model.split('-').slice(-1)[0]}
                            </span>
                          )}

                          {/* Cost */}
                          {row.cost > 0 && (
                            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#27272a', flexShrink: 0 }}>
                              ${row.cost.toFixed(5)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </main>
        </div>
      </div>
    </>
  )
}
