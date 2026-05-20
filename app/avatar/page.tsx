// app/avatar/page.tsx — javariai.com/avatar
// Javari Avatar System — create and customize your CRAIverse identity
// Backed by /api/avatar (GET/PATCH) + user_avatars Supabase table
// CR AudioViz AI · EIN 39-3646201 · May 2026
'use client'
import { useState, useEffect, useRef } from 'react'

const STYLES = [
  { id: 'professional', label: 'Professional', emoji: '💼', desc: 'Sharp, executive look' },
  { id: 'casual',       label: 'Casual',       emoji: '😊', desc: 'Relaxed and friendly' },
  { id: 'creative',     label: 'Creative',     emoji: '🎨', desc: 'Bold and expressive' },
  { id: 'mission',      label: 'Mission',      emoji: '🌟', desc: 'Purpose-driven' },
  { id: 'gamer',        label: 'Gamer',        emoji: '🎮', desc: 'Ready to play' },
  { id: 'builder',      label: 'Builder',      emoji: '🔨', desc: 'Maker mindset' },
]
const PERSONALITIES = ['helpful','bold','calm','energetic','wise','playful']
const VOICES       = ['warm','direct','formal','friendly','inspirational']
const COLORS       = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4']

export default function AvatarPage() {
  const [avatar, setAvatar]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [name, setName]           = useState('')
  const [bio, setBio]             = useState('')
  const [style, setStyle]         = useState('professional')
  const [personality, setPersonality] = useState('helpful')
  const [voice, setVoice]         = useState('warm')
  const [color, setColor]         = useState('#6366f1')
  const [tab, setTab]             = useState('identity')

  useEffect(() => {
    fetch('/api/avatar')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.avatar) {
          const av = data.avatar
          setAvatar(av)
          setName(av.display_name || '')
          setBio(av.bio || '')
          setStyle(av.avatar_style || 'professional')
          setPersonality(av.personality || 'helpful')
          setVoice(av.voice_style || 'warm')
          setColor(av.background_color || '#6366f1')
        }
        setLoading(false)
      })
      .catch(() => { setLoading(false); setError('Sign in to create your avatar') })
  }, [])

  async function save() {
    setSaving(true); setSaved(false); setError('')
    try {
      const res = await fetch('/api/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, bio, avatar_style: style, personality, voice_style: voice, background_color: color }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setAvatar(data.avatar)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const previewStyle = STYLES.find(s => s.id === style)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <p>Loading your avatar...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ background: 'rgba(10,10,15,0.97)', borderBottom: '1px solid rgba(99,102,241,0.15)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/javari" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontWeight: 800, color: '#6366f1', fontSize: 15 }}>Javari AI</span>
          <span style={{ color: '#374151', fontSize: 12, marginLeft: 4 }}>/ Avatar</span>
        </a>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/javari" style={{ color: '#6b7280', fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>← Chat</a>
          <a href="https://craudiovizai.com" style={{ color: '#6b7280', fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>Platform</a>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 80px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT: Preview card */}
        <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 20, overflow: 'hidden', position: 'sticky', top: 80 }}>
          {/* Avatar visual */}
          <div style={{ background: color, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
            {previewStyle?.emoji || '🤖'}
          </div>
          <div style={{ padding: '20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
              {name || 'Your Name'}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6366f1', fontWeight: 600 }}>
              {previewStyle?.label || 'Professional'} · {personality}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
              {bio || 'Your bio will appear here. Tell the community who you are.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Voice: {voice}</span>
              <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{previewStyle?.desc}</span>
            </div>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.05)' }}>
            <button onClick={save} disabled={saving}
              style={{ width: '100%', background: saving ? '#1e1e2e' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: saving ? '#374151' : 'white', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Avatar'}
            </button>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{error}</p>}
            {!error && !avatar && (
              <p style={{ color: '#6b7280', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                <a href="https://craudiovizai.com/auth/signin" style={{ color: '#6366f1' }}>Sign in</a> to save your avatar
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Editor */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
            {['identity','style','personality'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                  background: tab === t ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  color: tab === t ? '#818cf8' : '#6b7280' }}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'identity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: '20px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Display Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name in the Javari community"
                  style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: '20px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the community who you are and what you create..."
                  rows={4}
                  style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: '20px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Avatar Color</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      style={{ width: 40, height: 40, borderRadius: '50%', background: c, border: color === c ? '3px solid white' : '3px solid transparent', cursor: 'pointer', outline: 'none' }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'style' && (
            <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: '20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Avatar Style</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    style={{ padding: '14px 16px', borderRadius: 12, border: style === s.id ? '2px solid #6366f1' : '2px solid rgba(99,102,241,0.1)', background: style === s.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'personality' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: '20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Personality</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PERSONALITIES.map(p => (
                    <button key={p} onClick={() => setPersonality(p)}
                      style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                        borderColor: personality === p ? '#6366f1' : 'rgba(99,102,241,0.2)',
                        background: personality === p ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: personality === p ? '#818cf8' : '#6b7280' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: '#111118', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, padding: '20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>AI Voice Style</div>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>How Javari AI speaks to you and represents you in conversations.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {VOICES.map(v => (
                    <button key={v} onClick={() => setVoice(v)}
                      style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                        borderColor: voice === v ? '#6366f1' : 'rgba(99,102,241,0.2)',
                        background: voice === v ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: voice === v ? '#818cf8' : '#6b7280' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
