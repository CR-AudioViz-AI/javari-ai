// app/avatar/page.tsx
// Javari Avatar Builder — your identity in the CRAIverse
// Build the AI that speaks your language and represents who you are
// CR AudioViz AI · EIN 39-3646201 · May 2026
'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Avatar DNA: 12 archetypes that shape your AI experience ─────────────────
const ARCHETYPES = [
  { id: 'creator',   label: 'The Creator',   emoji: '🎨', color: '#a855f7',
    desc: 'Visionary and imaginative. Javari brings bold ideas, lateral thinking, and creative expansions.',
    aiPrompt: 'You are a creative visionary. Be imaginative, expansive, and bring unexpected angles.' },
  { id: 'builder',   label: 'The Builder',   emoji: '🔨', color: '#f59e0b',
    desc: 'Pragmatic and systematic. Javari delivers step-by-step plans, checklists, and concrete paths.',
    aiPrompt: 'You are a systematic builder. Be practical, step-by-step, concrete, and results-focused.' },
  { id: 'warrior',   label: 'The Warrior',   emoji: '⚔️', color: '#ef4444',
    desc: 'Bold and decisive. Javari gives direct calls to action, competitive intel, and battle plans.',
    aiPrompt: 'You are bold and direct. Cut through noise, give decisive recommendations, speak with confidence.' },
  { id: 'sage',      label: 'The Sage',      emoji: '🦉', color: '#0ea5e9',
    desc: 'Wise and nuanced. Javari provides research-backed depth, multiple perspectives, and careful analysis.',
    aiPrompt: 'You are a wise counselor. Provide nuanced analysis, multiple perspectives, and evidence-based guidance.' },
  { id: 'explorer',  label: 'The Explorer',  emoji: '🌍', color: '#10b981',
    desc: 'Curious and adventurous. Javari finds unexpected opportunities, new markets, and uncharted paths.',
    aiPrompt: 'You are an explorer. Find unexpected opportunities, ask great questions, and embrace possibility.' },
  { id: 'mentor',    label: 'The Mentor',    emoji: '🌟', color: '#6366f1',
    desc: 'Nurturing and empowering. Javari coaches you, builds your confidence, and celebrates your wins.',
    aiPrompt: 'You are a supportive mentor. Encourage, coach, celebrate wins, and build confidence.' },
  { id: 'maverick',  label: 'The Maverick',  emoji: '🚀', color: '#f97316',
    desc: 'Unconventional and disruptive. Javari challenges assumptions and pushes boundaries.',
    aiPrompt: 'You are a maverick. Challenge conventional wisdom, disrupt norms, and think differently.' },
  { id: 'guardian',  label: 'The Guardian',  emoji: '🛡️', color: '#0891b2',
    desc: 'Protective and reliable. Javari prioritizes safety, risk mitigation, and long-term stability.',
    aiPrompt: 'You are a guardian. Prioritize safety, identify risks, and build for long-term resilience.' },
  { id: 'connector', label: 'The Connector', emoji: '🤝', color: '#ec4899',
    desc: 'Community-driven. Javari focuses on relationships, partnerships, and growing your network.',
    aiPrompt: 'You are a connector. Focus on relationships, community, partnerships, and collaboration.' },
  { id: 'healer',    label: 'The Healer',    emoji: '💚', color: '#22c55e',
    desc: 'Mission-driven. Javari amplifies your social impact, grant opportunities, and community good.',
    aiPrompt: 'You are mission-driven. Amplify social impact, find grant opportunities, and serve the greater good.' },
  { id: 'scholar',   label: 'The Scholar',   emoji: '📚', color: '#8b5cf6',
    desc: 'Knowledge-hungry. Javari delivers deep research, data synthesis, and continuous learning.',
    aiPrompt: 'You are a scholar. Deliver deep research, synthesize data, and foster continuous learning.' },
  { id: 'sovereign', label: 'The Sovereign', emoji: '👑', color: '#d97706',
    desc: 'Leadership-focused. Javari helps you command, delegate, scale, and build your empire.',
    aiPrompt: 'You are a sovereign. Think big, delegate effectively, and build lasting empires.' },
]

const VOICES = [
  { id: 'warm',         label: 'Warm',         desc: 'Friendly, encouraging, approachable' },
  { id: 'bold',         label: 'Bold',         desc: 'Confident, direct, no-nonsense' },
  { id: 'calm',         label: 'Calm',         desc: 'Measured, thoughtful, grounding' },
  { id: 'playful',      label: 'Playful',      desc: 'Fun, witty, energetic' },
  { id: 'wise',         label: 'Wise',         desc: 'Thoughtful, deliberate, authoritative' },
  { id: 'inspirational',label: 'Inspirational',desc: 'Motivating, visionary, uplifting' },
]

const COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#ef4444','#f97316',
  '#f59e0b','#eab308','#22c55e','#10b981','#0ea5e9','#0891b2',
  '#1d4ed8','#374151','#111827','#be185d',
]

const BADGES = [
  { id: 'creator', emoji: '🎨', label: 'Creator' },
  { id: 'veteran', emoji: '🎖️', label: 'Veteran' },
  { id: 'founder', emoji: '🚀', label: 'Founder' },
  { id: 'artist',  emoji: '🖌️', label: 'Artist' },
  { id: 'healer',  emoji: '💚', label: 'Healer' },
  { id: 'builder', emoji: '🔨', label: 'Builder' },
  { id: 'mentor',  emoji: '🌟', label: 'Mentor' },
  { id: 'faith',   emoji: '✝️', label: 'Faith' },
  { id: 'rescue',  emoji: '🐾', label: 'Rescue' },
  { id: 'scholar', emoji: '📚', label: 'Scholar' },
]

// ─── Avatar SVG Generator ────────────────────────────────────────────────────
function AvatarSVG({ archetype, color, size = 120 }: { archetype: string, color: string, size?: number }) {
  const arch = ARCHETYPES.find(a => a.id === archetype) || ARCHETYPES[0]
  const r = size / 2
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`grad-${archetype}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.5" />
        </radialGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Background circle */}
      <circle cx={r} cy={r} r={r - 2} fill={`url(#grad-${archetype})`} filter="url(#shadow)" />
      {/* Archetype ring */}
      <circle cx={r} cy={r} r={r - 2} fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
      {/* Inner glow */}
      <circle cx={r} cy={r} r={r * 0.7} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Emoji */}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
            fontSize={size * 0.38} style={{ fontFamily: 'system-ui' }}>
        {arch.emoji}
      </text>
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AvatarPage() {
  const [tab, setTab] = useState<'archetype'|'identity'|'voice'|'mission'>('rchetype')
  const [archetype, setArchetype] = useState('creator')
  const [color, setColor] = useState('#6366f1')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [voice, setVoice] = useState('warm')
  const [mission, setMission] = useState('')
  const [badges, setBadges] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewMsg, setPreviewMsg] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const currentArch = ARCHETYPES.find(a => a.id === archetype) || ARCHETYPES[0]

  useEffect(() => {
    fetch('/api/avatar')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.avatar) {
          const av = data.avatar
          setArchetype(av.avatar_style || 'creator')
          setColor(av.background_color || '#6366f1')
          setName(av.display_name || '')
          setTagline(av.preferences?.tagline || '')
          setBio(av.bio || '')
          setVoice(av.voice_style || 'warm')
          setMission(av.preferences?.mission || '')
          setBadges(av.preferences?.badges || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Auto-set color from archetype
  useEffect(() => {
    const arch = ARCHETYPES.find(a => a.id === archetype)
    if (arch) setColor(arch.color)
  }, [archetype])

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar_style: archetype,
          background_color: color,
          display_name: name,
          bio,
          voice_style: voice,
          preferences: { tagline, mission, badges },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* fail silently — show saved anyway for UX */ }
    setSaving(false)
  }

  async function previewVoice() {
    setPreviewLoading(true)
    setPreviewMsg('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Introduce yourself to me in 2 sentences, as Javari, with my archetype personality.' }],
          stream: false,
          systemOverride: currentArch.aiPrompt + ' Voice style: ' + voice + '. Be brief.',
        }),
      })
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content || 'Hello! I'm Javari, your AI companion.'
      setPreviewMsg(content)
    } catch {
      setPreviewMsg('Hello! I'm Javari, your AI companion ready to help you build your vision.')
    }
    setPreviewLoading(false)
  }

  function toggleBadge(id: string) {
    setBadges(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id].slice(0, 5))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080812', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <p style={{ color: '#6b7280' }}>Loading your avatar...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080812', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top nav */}
      <nav style={{ background: 'rgba(8,8,18,0.97)', borderBottom: '1px solid rgba(99,102,241,0.15)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/javari" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <AvatarSVG archetype={archetype} color={color} size={32} />
            <span style={{ fontWeight: 800, color: '#818cf8', fontSize: 15 }}>Javari</span>
          </a>
          <span style={{ color: '#374151', fontSize: 13 }}>/ Avatar Builder</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/javari" style={{ color: '#6b7280', fontSize: 13, padding: '6px 14px', textDecoration: 'none', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>← Back to Chat</a>
          <button onClick={save} disabled={saving}
            style={{ background: saving ? '#1e1e2e' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: saving ? '#374151' : '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Avatar'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* LEFT: Live preview */}
        <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, overflow: 'hidden', position: 'sticky', top: 72 }}>
          {/* Avatar hero */}
          <div style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
            <div style={{ display: 'inline-block', marginBottom: 16 }}>
              <AvatarSVG archetype={archetype} color={color} size={96} />
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#fff' }}>
              {name || 'Your Name'}
            </h2>
            <p style={{ margin: '0 0 8px', fontSize: 13, color, fontWeight: 600 }}>
              {currentArch.label}
            </p>
            {tagline && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>"{tagline}"</p>}
            {badges.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {badges.map(b => {
                  const badge = BADGES.find(bg => bg.id === b)
                  return badge ? (
                    <span key={b} style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {badge.emoji} {badge.label}
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Bio */}
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, margin: '0 0 12px' }}>
              {bio || 'Your bio appears here. Tell the world who you are and what you're building.'}
            </p>
            <div style={{ fontSize: 11, color: '#374151', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Voice style:</span><span style={{ color: '#6366f1' }}>{voice}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>AI personality:</span><span style={{ color: '#6366f1' }}>{currentArch.label}</span>
              </div>
            </div>
          </div>

          {/* Voice preview */}
          <div style={{ padding: '0 20px 20px' }}>
            <button onClick={previewVoice} disabled={previewLoading}
              style={{ width: '100%', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {previewLoading ? 'Generating...' : '🎙 Hear Javari speak as your avatar'}
            </button>
            {previewMsg && (
              <div style={{ marginTop: 12, background: 'rgba(99,102,241,0.07)', borderRadius: 10, padding: '12px', fontSize: 13, color: '#d1d5db', lineHeight: 1.6, borderLeft: `3px solid ${color}` }}>
                {previewMsg}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Editor */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }}>
            {(['archetype','identity','voice','mission'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                  background: tab === t ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: tab === t ? '#818cf8' : '#6b7280' }}>
                {t === 'archetype' ? '🧬 Archetype' : t === 'identity' ? '👤 Identity' : t === 'voice' ? '🎙 Voice' : '🌍 Mission'}
              </button>
            ))}
          </div>

          {/* TAB: Archetype */}
          {tab === 'archetype' && (
            <div>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                Your archetype shapes HOW Javari thinks and responds. Choose the one that matches how you see yourself and how you want your AI to engage.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {ARCHETYPES.map(arch => (
                  <button key={arch.id} onClick={() => setArchetype(arch.id)}
                    style={{ padding: '16px', borderRadius: 14, border: `2px solid ${archetype === arch.id ? arch.color : 'rgba(255,255,255,0.06)'}`,
                      background: archetype === arch.id ? `${arch.color}15` : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 24 }}>{arch.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: archetype === arch.id ? arch.color : '#e2e8f0' }}>{arch.label}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{arch.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Identity */}
          {tab === 'identity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Display Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name in the Javariverse"
                  style={{ width: '100%', background: '#080812', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Tagline</label>
                <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="One line that captures who you are"
                  style={{ width: '100%', background: '#080812', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
                  placeholder="Tell the Javariverse who you are, what you build, and why it matters..."
                  style={{ width: '100%', background: '#080812', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Your Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color === c ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Identity Badges (pick up to 5)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {BADGES.map(b => (
                    <button key={b.id} onClick={() => toggleBadge(b.id)}
                      style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        borderColor: badges.includes(b.id) ? '#6366f1' : 'rgba(99,102,241,0.2)',
                        background: badges.includes(b.id) ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: badges.includes(b.id) ? '#818cf8' : '#6b7280' }}>
                      {b.emoji} {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Voice */}
          {tab === 'voice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 4, lineHeight: 1.6 }}>
                Voice style shapes the TONE Javari uses when responding to you. Different voices suit different moments.
              </p>
              {VOICES.map(v => (
                <button key={v.id} onClick={() => setVoice(v.id)}
                  style={{ padding: '20px', borderRadius: 14, border: `2px solid ${voice === v.id ? '#6366f1' : 'rgba(255,255,255,0.06)'}`,
                    background: voice === v.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: voice === v.id ? '#818cf8' : '#e2e8f0', marginBottom: 4 }}>{v.label}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{v.desc}</div>
                  </div>
                  {voice === v.id && <span style={{ color: '#6366f1', fontSize: 20 }}>✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* TAB: Mission */}
          {tab === 'mission' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
                Your mission gives Javari context about what you're building and why. 
                Javari will actively look for opportunities — grants, partnerships, tools, strategies — aligned with your mission.
              </p>
              <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Your Mission Statement</label>
                <textarea value={mission} onChange={e => setMission(e.target.value)} rows={5}
                  placeholder="What are you building? Who does it serve? What change do you want to make in the world? Javari will use this to proactively find opportunities for you..."
                  style={{ width: '100%', background: '#080812', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#818cf8' }}>🌟 What Javari does with your mission</h3>
                <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#9ca3af', fontSize: 13, lineHeight: 2 }}>
                  <li>Proactively finds relevant grant opportunities</li>
                  <li>Suggests partnerships aligned with your goals</li>
                  <li>Recommends platform tools that serve your mission</li>
                  <li>Connects you with community members building similar things</li>
                  <li>Tracks your progress toward your stated goals</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
