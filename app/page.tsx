// app/(site)/page.tsx  (or app/page.tsx with redirect removed)
// Javari AI — Marketing Homepage
// Better than ChatGPT, Claude, Gemini — here's why
// May 17, 2026 — CR AudioViz AI, LLC
'use client'
import { useState, useEffect } from 'react'

const PLATFORM = 'https://craudiovizai.com'
const CHAT_URL  = '/javari'

const STATS = [
  { value: '300+', label: 'AI Models' },
  { value: '$0.00', label: 'Cost per chat (free tier)' },
  { value: '50+', label: 'Javari Apps' },
  { value: '18', label: 'AI Providers' },
]

const VS_COMPARISON = [
  { feature: 'Free tier',              javari: '✓ Always free',       chatgpt: '✓ Limited',  claude: '✓ Limited', gemini: '✓ Limited' },
  { feature: '300+ AI models',         javari: '✓ Yes',               chatgpt: '✗ GPT only', claude: '✗ Claude only', gemini: '✗ Gemini only' },
  { feature: 'Auto cost optimization', javari: '✓ COST LAW routing',  chatgpt: '✗ No',       claude: '✗ No',       gemini: '✗ No' },
  { feature: 'Voice (TTS + STT)',      javari: '✓ ElevenLabs + Groq', chatgpt: '✓ ChatGPT+', claude: '✗ No',       gemini: '✓ Limited' },
  { feature: 'Video avatar',           javari: '✓ D-ID + HeyGen',     chatgpt: '✗ No',       claude: '✗ No',       gemini: '✗ No' },
  { feature: 'Persistent memory',      javari: '✓ Across sessions',   chatgpt: '✓ Plus only', claude: '✗ No',      gemini: '✗ No' },
  { feature: '50+ connected apps',     javari: '✓ Full ecosystem',    chatgpt: '✓ Plugins',  claude: '✗ No',       gemini: '✓ Google apps' },
  { feature: 'Credit-based pricing',   javari: '✓ Never expire',      chatgpt: '✗ Message limits', claude: '✗ Message limits', gemini: '✗ Message limits' },
  { feature: 'Self-healing AI',        javari: '✓ Auto-switches models', chatgpt: '✗ No',    claude: '✗ No',       gemini: '✗ No' },
]

const CAPABILITIES = [
  { emoji: '💬', title: 'Unlimited Chat', desc: 'Talk to 300+ AI models. Javari picks the best one for your query and switches automatically if one fails.' },
  { emoji: '🎙️', title: 'Voice Conversations', desc: 'Speak naturally. ElevenLabs voices respond, Groq Whisper transcribes. No typing required.' },
  { emoji: '🎬', title: 'Video Avatar', desc: 'Have Javari deliver your message as a talking avatar. Perfect for content creation and presentations.' },
  { emoji: '🧠', title: 'Persistent Memory', desc: 'Javari remembers your preferences, projects, and history across every conversation.' },
  { emoji: '⚡', title: 'Multi-Agent Execution', desc: 'Give Javari a task and it breaks it into steps, executes autonomously, and delivers results.' },
  { emoji: '🔗', title: 'Ecosystem Integration', desc: 'One AI assistant connected to every Javari app. Resume, legal, property, travel — all in one.' },
]

const APPS_PREVIEW = [
  { emoji: '📄', name: 'Resume Builder', href: 'https://javari-resume-builder.vercel.app', color: '#6366f1' },
  { emoji: '⚖️', name: 'Legal Docs', href: 'https://javari-legal.vercel.app', color: '#8b5cf6' },
  { emoji: '🏠', name: 'Real Estate', href: 'https://javariproperty.com', color: '#06b6d4' },
  { emoji: '🥃', name: 'Spirits', href: 'https://javarispirits.com', color: '#f59e0b' },
  { emoji: '✈️', name: 'Travel', href: 'https://javaritravel.com', color: '#10b981' },
  { emoji: '🎮', name: 'Games', href: 'https://javarigames.com', color: '#ec4899' },
  { emoji: '🃏', name: 'Cards', href: 'https://javaricards.com', color: '#3b82f6' },
  { emoji: '🌐', name: 'Javariverse', href: 'https://javariverse.com', color: '#a855f7' },
]

export default function JavariHomepage() {
  const [typed, setTyped] = useState('')
  const PHRASES = ['What is the best whiskey under $50?', 'Write me a cover letter for a tech job.', 'Plan a 5-day trip to Japan.', 'Draft an NDA for my startup.', 'Create a workout plan for beginners.']
  const [phraseIdx, setPhraseIdx] = useState(0)

  useEffect(() => {
    let i = 0; const phrase = PHRASES[phraseIdx]
    const timer = setInterval(() => {
      setTyped(phrase.slice(0, i + 1))
      i++
      if (i >= phrase.length) { clearInterval(timer); setTimeout(() => { setTyped(''); setPhraseIdx(p => (p + 1) % PHRASES.length) }, 2000) }
    }, 50)
    return () => clearInterval(timer)
  }, [phraseIdx])

  const C = '#6366f1'
  const S = {
    page: { background: '#0a0a0f', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: 'white' },
    // Hero
    hero: { textAlign: 'center' as const, padding: '100px 24px 80px', maxWidth: 900, margin: '0 auto' },
    badge: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#a5b4fc', marginBottom: 24 },
    h1: { fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 24px', letterSpacing: '-0.02em' },
    gradient: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    sub: { fontSize: 'clamp(16px, 2vw, 20px)', color: '#9ca3af', lineHeight: 1.6, margin: '0 auto 40px', maxWidth: 600 },
    // Demo input
    demoBox: { maxWidth: 600, margin: '0 auto 48px', background: '#111118', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' },
    demoText: { flex: 1, color: '#e5e7eb', fontSize: 15, minHeight: 24 },
    demoCursor: { display: 'inline-block', width: 2, height: 18, background: C, animation: 'blink 1s infinite', verticalAlign: 'middle' },
    demoBtn: { background: `linear-gradient(135deg, ${C}, #8b5cf6)`, color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const },
    // CTAs
    ctaRow: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const, marginBottom: 48 },
    ctaPrimary: { background: `linear-gradient(135deg, ${C}, #8b5cf6)`, color: 'white', border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 17, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
    ctaSecondary: { background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 32px', fontSize: 17, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
    // Stats
    statsRow: { display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap' as const, padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    stat: { textAlign: 'center' as const },
    statVal: { fontSize: 32, fontWeight: 900, color: 'white' },
    statLbl: { fontSize: 13, color: '#6b7280' },
    // Sections
    section: { padding: '80px 24px', maxWidth: 1200, margin: '0 auto' },
    sectionHead: { textAlign: 'center' as const, marginBottom: 48 },
    sectionBadge: { display: 'inline-block', background: `${C}20`, border: `1px solid ${C}40`, borderRadius: 20, padding: '4px 14px', fontSize: 12, color: C, fontWeight: 700, marginBottom: 16 },
    sectionH2: { fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '0 0 16px' },
    sectionSub: { color: '#6b7280', fontSize: 17 },
    // Capabilities grid
    capGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 },
    capCard: { background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', transition: 'border-color 0.2s' },
    capEmoji: { fontSize: 32, marginBottom: 12 },
    capTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
    capDesc: { color: '#6b7280', fontSize: 14, lineHeight: 1.6 },
    // Comparison table
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
    th: { padding: '12px 16px', textAlign: 'left' as const, color: '#6b7280', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    td: { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' },
    tdJavari: { color: '#10b981', fontWeight: 600 },
    tdOther: { color: '#6b7280' },
    // Apps grid
    appsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 },
    appCard: { background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' as const, textDecoration: 'none', color: 'white', transition: 'transform 0.2s, border-color 0.2s', display: 'block' },
    appEmoji: { fontSize: 28, display: 'block', marginBottom: 6 },
    appName: { fontSize: 12, color: '#9ca3af', fontWeight: 600 },
  }

  return (
    <div style={S.page}>
      <style>{`@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }`}</style>

      {/* HERO */}
      <div style={S.hero}>
        <div style={S.badge}>
          🤖 Powered by 300+ AI Models · $0.00 cost on free tier
        </div>
        <h1 style={S.h1}>
          The AI that{' '}
          <span style={S.gradient}>actually works</span>
          {' '}for your whole life
        </h1>
        <p style={S.sub}>
          Javari AI combines 300+ models, voice, video, memory, and 50+ apps
          into one ecosystem. ChatGPT for chat. We built everything else too.
        </p>

        {/* Typing demo */}
        <div style={S.demoBox}>
          <span style={S.demoText}>
            {typed}<span style={S.demoCursor} />
          </span>
          <a href={CHAT_URL} style={S.demoBtn}>Ask Javari →</a>
        </div>

        <div style={S.ctaRow}>
          <a href={CHAT_URL} style={S.ctaPrimary}>Start Chatting Free →</a>
          <a href={`${PLATFORM}/pricing`} style={S.ctaSecondary}>See Pricing</a>
        </div>

        <p style={{ color: '#374151', fontSize: 13 }}>No credit card · 50 free credits/month · Access to every Javari app</p>
      </div>

      {/* STATS */}
      <div style={S.statsRow}>
        {STATS.map(s => (
          <div key={s.label} style={S.stat}>
            <div style={S.statVal}>{s.value}</div>
            <div style={S.statLbl}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* CAPABILITIES */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <div style={S.sectionBadge}>CAPABILITIES</div>
          <h2 style={S.sectionH2}>Everything ChatGPT does, plus what it can't</h2>
          <p style={S.sectionSub}>Javari routes every request to the best model for it — automatically, for free.</p>
        </div>
        <div style={S.capGrid}>
          {CAPABILITIES.map(cap => (
            <div key={cap.title} style={S.capCard}>
              <div style={S.capEmoji}>{cap.emoji}</div>
              <div style={S.capTitle}>{cap.title}</div>
              <div style={S.capDesc}>{cap.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* VS COMPARISON */}
      <div style={{ ...S.section, background: '#080810', borderRadius: 24, padding: '60px 40px' }}>
        <div style={S.sectionHead}>
          <div style={S.sectionBadge}>COMPARISON</div>
          <h2 style={S.sectionH2}>Javari vs. the competition</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Feature</th>
                <th style={{ ...S.th, color: C }}>🤖 Javari AI</th>
                <th style={S.th}>ChatGPT</th>
                <th style={S.th}>Claude</th>
                <th style={S.th}>Gemini</th>
              </tr>
            </thead>
            <tbody>
              {VS_COMPARISON.map(row => (
                <tr key={row.feature}>
                  <td style={S.td}>{row.feature}</td>
                  <td style={{ ...S.td, ...S.tdJavari }}>{row.javari}</td>
                  <td style={{ ...S.td, ...S.tdOther }}>{row.chatgpt}</td>
                  <td style={{ ...S.td, ...S.tdOther }}>{row.claude}</td>
                  <td style={{ ...S.td, ...S.tdOther }}>{row.gemini}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ECOSYSTEM */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <div style={S.sectionBadge}>ECOSYSTEM</div>
          <h2 style={S.sectionH2}>One account. Every Javari app.</h2>
          <p style={S.sectionSub}>Your credits work across all 50+ apps. Build a resume, plan a trip, collect spirits — all in one place.</p>
        </div>
        <div style={S.appsGrid}>
          {APPS_PREVIEW.map(app => (
            <a key={app.name} href={app.href} style={S.appCard}
               onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = `${app.color}60` }}
               onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.06)' }}>
              <span style={S.appEmoji}>{app.emoji}</span>
              <span style={S.appName}>{app.name}</span>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a href={`${PLATFORM}/features`} style={{ color: C, fontSize: 14, textDecoration: 'none' }}>
            View all 50+ apps →
          </a>
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{ textAlign: 'center', padding: '80px 24px', background: 'linear-gradient(180deg, #0a0a0f 0%, #0d0a1a 100%)' }}>
        <h2 style={{ ...S.sectionH2, marginBottom: 16 }}>Ready to talk to an AI that actually gets things done?</h2>
        <p style={{ color: '#6b7280', fontSize: 17, marginBottom: 32 }}>Start free. No credit card. 50 credits/month forever.</p>
        <a href={CHAT_URL} style={{ ...S.ctaPrimary, fontSize: 18, padding: '16px 40px' }}>
          Start Talking to Javari →
        </a>
      </div>
    </div>
  )
}
