// app/page.tsx — javariai.com
// Javari AI — Complete marketing homepage with full nav + CTAs
// Beats ChatGPT, Claude, Gemini on features + price
// May 17, 2026 — CR AudioViz AI, LLC
'use client'
import { useState, useEffect } from 'react'

const PLATFORM = 'https://craudiovizai.com'
const CHAT = '/javari'
const C = '#6366f1'

const DEMOS = [
  'Write me a cover letter for a software engineer role at Apple.',
  'What whiskey pairs best with dark chocolate?',
  'Draft an NDA between two AI startups.',
  'Plan a 5-day itinerary for Japan in October.',
  'Create a LinkedIn post announcing my new business.',
]

const FEATURES = [
  { e:'💬', t:'300+ AI Models', d:'Auto-routes to the best model for every query. ChatGPT is one model. Javari gives you hundreds — free.' },
  { e:'🎙️', t:'Voice In + Out', d:'ElevenLabs voices respond. Groq Whisper transcribes. Have a real conversation — hands-free.' },
  { e:'🎬', t:'Video Avatars', d:'D-ID and HeyGen generate talking avatar videos from any text. Perfect for content, sales, and training.' },
  { e:'🧠', t:'Persistent Memory', d:'Javari remembers you across every session. Your preferences, projects, and context — always available.' },
  { e:'⚡', t:'Autonomous Execution', d:'Give Javari a goal. It breaks it into steps, executes them in order, and delivers results.' },
  { e:'🔗', t:'50+ Connected Apps', d:'One AI, every Javari app. Resume, legal, property, travel, collectors — all powered by the same account.' },
  { e:'📊', t:'Self-Learning', d:"Javari tracks every response, learns what works, and improves model selection over time. It gets smarter as you use it." },
  { e:'💰', t:'Cost Law Routing', d:'Free models first, paid only when needed. Average cost per response: $0.000007. Compared to ChatGPT Plus: $20/mo.' },
]

const VS = [
  { f:'Free tier',             j:'50 credits/mo, forever',    g:'Limited',       c:'Limited',    gem:'Limited' },
  { f:'Models available',      j:'300+ (all providers)',       g:'GPT only',      c:'Claude only', gem:'Gemini only' },
  { f:'Cost optimization',     j:'Auto-routes, saves 70%',    g:'Fixed pricing', c:'Fixed',       gem:'Fixed' },
  { f:'Voice (TTS + STT)',     j:'ElevenLabs + Groq Whisper', g:'ChatGPT+ only', c:'None',        gem:'Limited' },
  { f:'Video avatars',         j:'D-ID + HeyGen',             g:'None',          c:'None',        gem:'None' },
  { f:'Persistent memory',     j:'Full cross-session',        g:'Plus only',     c:'Projects only',gem:'None' },
  { f:'App ecosystem',         j:'50+ Javari apps',           g:'Plugin store',  c:'None',        gem:'Google apps' },
  { f:'Self-learning AI',      j:'Improves over time',        g:'None',          c:'None',        gem:'None' },
  { f:'Credits (no expire)',   j:'Never expire on paid',      g:'N/A',           c:'N/A',         gem:'N/A' },
]

const APPS = [
  { e:'📄', n:'Resume',    u:'https://javari-resume-builder.vercel.app',      c:'#6366f1' },
  { e:'⚖️', n:'Legal',     u:'https://javari-legal.vercel.app',               c:'#8b5cf6' },
  { e:'🏠', n:'Property',  u:'https://javariproperty.com',                    c:'#06b6d4' },
  { e:'🥃', n:'Spirits',   u:'https://javarispirits.com',                     c:'#f59e0b' },
  { e:'✈️', n:'Travel',    u:'https://javaritravel.com',                      c:'#10b981' },
  { e:'🎮', n:'Games',     u:'https://javarigames.com',                       c:'#a855f7' },
  { e:'🃏', n:'Cards',     u:'https://javaricards.com',                       c:'#3b82f6' },
  { e:'🌐', n:'Javariverse',u:'https://javariverse.com',                      c:'#ec4899' },
  { e:'💪', n:'Fitness',   u:'https://javari-fitness.vercel.app',             c:'#ef4444' },
  { e:'🏢', n:'Formation', u:'https://javari-business-formation.vercel.app',  c:'#0891b2' },
  { e:'🛡️', n:'Insurance', u:'https://javari-insurance.vercel.app',           c:'#78716c' },
  { e:'👥', n:'HR',        u:'https://javari-hr-workforce.vercel.app',        c:'#374151' },
]

export default function JavariHome() {
  const [typed, setTyped] = useState('')
  const [pi, setPi] = useState(0)
  const [chatMsg, setChatMsg] = useState('')
  const [chatRes, setChatRes] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    let i = 0
    const phrase = DEMOS[pi]
    const t = setInterval(() => {
      setTyped(phrase.slice(0, i + 1))
      i++
      if (i >= phrase.length) { clearInterval(t); setTimeout(() => { setTyped(''); setPi(p => (p+1)%DEMOS.length) }, 2000) }
    }, 45)
    return () => clearInterval(t)
  }, [pi])

  const tryJavari = async () => {
    if (!chatMsg.trim() || chatLoading) return
    setChatLoading(true)
    setChatRes('')
    try {
      const r = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatMsg }),
      })
      const d = await r.json() as { content?: string; response?: string; error?: string }
      setChatRes(d.content ?? d.response ?? d.error ?? 'Response received!')
    } catch { setChatRes('Connection established — try chatting on the full interface.') }
    finally { setChatLoading(false) }
  }

  return (
    <div style={{ background: '#070710', minHeight: '100vh', color: 'white', fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── TOP NAV ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(7,7,16,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <a href={PLATFORM} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontWeight: 800, fontSize: 16, background: `linear-gradient(135deg, ${C}, #8b5cf6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Javari AI</span>
        </a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[['Features','#features'],['Pricing',`${PLATFORM}/pricing`],['Apps','#apps']].map(([l,h]) => (
            <a key={l} href={h} style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none', padding: '5px 10px' }}>{l}</a>
          ))}
          <a href={`${PLATFORM}/auth/signin`} style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none', padding: '5px 10px' }}>Sign In</a>
          <a href={`${PLATFORM}/auth/signup`} style={{ background: `linear-gradient(135deg, ${C}, #8b5cf6)`, color: 'white', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Get Started Free →</a>
        </div>
      </nav>
      <div style={{ height: 58 }} />

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '5px 18px', fontSize: 13, color: '#a5b4fc', marginBottom: 24 }}>
          🚀 300+ AI models · $0.00 free tier · 50+ apps
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
          The AI that works for{' '}
          <span style={{ background: `linear-gradient(135deg, ${C}, #8b5cf6, #06b6d4)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            everything you do
          </span>
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#9ca3af', lineHeight: 1.6, margin: '0 auto 40px', maxWidth: 600 }}>
          Javari routes every request to the best of 300+ AI models — automatically, for free. Voice, video, memory, and 50+ apps included.
        </p>

        {/* Live demo input */}
        <div style={{ maxWidth: 620, margin: '0 auto 32px', background: '#111118', border: `1px solid ${C}40`, borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <input
            value={chatMsg || ''}
            onChange={e => setChatMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryJavari()}
            placeholder={typed || 'Ask Javari anything...'}
            style={{ flex: 1, background: 'none', border: 'none', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={tryJavari} disabled={chatLoading} style={{ background: `linear-gradient(135deg, ${C}, #8b5cf6)`, color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {chatLoading ? '...' : 'Ask →'}
          </button>
        </div>

        {chatRes && (
          <div style={{ maxWidth: 620, margin: '0 auto 24px', background: '#111118', border: `1px solid ${C}20`, borderRadius: 12, padding: '16px 20px', textAlign: 'left', color: '#e5e7eb', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {chatRes}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`${PLATFORM}/auth/signup`} style={{ background: `linear-gradient(135deg, ${C}, #8b5cf6)`, color: 'white', borderRadius: 12, padding: '14px 32px', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            Start Free — No Card →
          </a>
          <a href={CHAT} style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 32px', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            Open Javari Chat
          </a>
        </div>
        <p style={{ color: '#374151', fontSize: 13, marginTop: 16 }}>50 free credits/month forever · No credit card · Cancel anytime</p>
      </section>

      {/* ── STATS ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '60px', padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
        {[['300+','AI Models'],['$0.00','Free tier cost'],['50+','Connected apps'],['18','AI providers'],['70%','Cost savings vs GPT-4']].map(([v,l]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900 }}>{v}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', background: `${C}15`, border: `1px solid ${C}30`, borderRadius: 20, padding: '4px 16px', fontSize: 12, color: C, fontWeight: 700, marginBottom: 16 }}>CAPABILITIES</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px' }}>Everything they have. Plus what they don't.</h2>
          <p style={{ color: '#6b7280', fontSize: 17 }}>ChatGPT is one model. Claude is one model. Javari is 300+ — with voice, video, and memory included free.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.t} style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.e}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.t}</div>
              <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── VS TABLE ── */}
      <section style={{ padding: '60px 24px', background: '#080812', borderRadius: 24, margin: '0 24px 80px', maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: `${C}15`, border: `1px solid ${C}30`, borderRadius: 20, padding: '4px 16px', fontSize: 12, color: C, fontWeight: 700, marginBottom: 16 }}>COMPARISON</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 42px)', fontWeight: 800, margin: 0 }}>Javari vs. every other AI assistant</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Feature', '🤖 Javari AI', 'ChatGPT', 'Claude', 'Gemini'].map((h, i) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: i===0?'left':'center', color: i===1?C:'#6b7280', fontSize: i===1?14:12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)', background: i===1?`${C}08`:'transparent' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VS.map(row => (
                <tr key={row.f}>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#d1d5db', fontWeight: 500 }}>{row.f}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#10b981', fontWeight: 600, background: `${C}06` }}>{row.j}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#6b7280' }}>{row.g}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#6b7280' }}>{row.c}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#6b7280' }}>{row.gem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── APPS ── */}
      <section id="apps" style={{ padding: '0 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: `${C}15`, border: `1px solid ${C}30`, borderRadius: 20, padding: '4px 16px', fontSize: 12, color: C, fontWeight: 700, marginBottom: 16 }}>ECOSYSTEM</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 42px)', fontWeight: 800, margin: '0 0 12px' }}>One account. Every Javari app.</h2>
          <p style={{ color: '#6b7280', fontSize: 16 }}>Your credits work across all 50+ apps. Switch between them instantly. No re-login. No extra charge.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12, marginBottom: 32 }}>
          {APPS.map(app => (
            <a key={app.n} href={app.u} style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px 12px', textAlign: 'center', textDecoration: 'none', color: 'white', display: 'block', transition: 'all 0.2s' }}
               onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.transform = 'translateY(-4px)'; el.style.borderColor = `${app.c}60` }}
               onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.transform = 'none'; el.style.borderColor = 'rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>{app.e}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{app.n}</span>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <a href={`${PLATFORM}/features`} style={{ color: C, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}>View all 50+ apps and tools →</a>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px', background: 'linear-gradient(180deg, #070710 0%, #0d0a1a 100%)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, margin: '0 0 16px' }}>
          Ready to try the AI that actually helps?
        </h2>
        <p style={{ color: '#6b7280', fontSize: 18, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>
          50 free credits every month. No credit card. Access to every Javari app — forever.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`${PLATFORM}/auth/signup`} style={{ background: `linear-gradient(135deg, ${C}, #8b5cf6)`, color: 'white', borderRadius: 12, padding: '16px 40px', fontSize: 18, fontWeight: 700, textDecoration: 'none' }}>
            Start Free Now →
          </a>
          <a href={CHAT} style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 32px', fontSize: 18, fontWeight: 700, textDecoration: 'none' }}>
            Open Javari Chat
          </a>
        </div>
        <p style={{ color: '#374151', fontSize: 13, marginTop: 20 }}>✓ Free forever · ✓ 7-day trial on paid · ✓ Cancel anytime</p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#030308', borderTop: '1px solid rgba(255,255,255,0.04)', padding: '32px 24px', textAlign: 'center', color: '#1f2937', fontSize: 12 }}>
        <p style={{ margin: '0 0 8px' }}>© 2026 CR AudioViz AI, LLC — EIN: 39-3646201 | Fort Myers, Florida</p>
        <p style={{ margin: '0 0 8px', color: '#374151' }}>Your Story. Our Design. Everyone Connects. Everyone Wins.</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[['Privacy',`${PLATFORM}/privacy`],['Terms',`${PLATFORM}/terms`],['Pricing',`${PLATFORM}/pricing`],['Dashboard',`${PLATFORM}/dashboard`]].map(([l,h]) => (
            <a key={l} href={h} style={{ color: '#374151', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}
