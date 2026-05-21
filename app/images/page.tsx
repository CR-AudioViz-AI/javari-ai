// app/images/page.tsx — Javari AI Image Generator
// DALL-E 3 + OpenRouter image models — beats Midjourney on value
// Free: 3 images/day | Pro: unlimited | All styles supported
// CR AudioViz AI · EIN 39-3646201 · May 2026
'use client'
import { useState } from 'react'

const STYLES = [
  { id: 'photorealistic', label: 'Photorealistic', desc: 'DALL-E 3 quality photography', emoji: '📸' },
  { id: 'digital-art',   label: 'Digital Art',    desc: 'Vivid, stylized illustration', emoji: '🎨' },
  { id: 'oil-painting',  label: 'Oil Painting',   desc: 'Classic artistic style',       emoji: '🖼️' },
  { id: 'anime',         label: 'Anime / Manga',  desc: 'Japanese animation style',     emoji: '✨' },
  { id: '3d-render',     label: '3D Render',      desc: 'Cinema-quality 3D art',        emoji: '💎' },
  { id: 'sketch',        label: 'Sketch',         desc: 'Hand-drawn pencil style',      emoji: '✏️' },
  { id: 'watercolor',    label: 'Watercolor',     desc: 'Soft, flowing colors',         emoji: '🌊' },
  { id: 'comic',         label: 'Comic Book',     desc: 'Bold lines, vibrant color',    emoji: '💥' },
]

const RATIOS = [
  { id: '1:1',  label: 'Square',    w: 1024, h: 1024 },
  { id: '16:9', label: 'Landscape', w: 1792, h: 1024 },
  { id: '9:16', label: 'Portrait',  w: 1024, h: 1792 },
]

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photorealistic')
  const [ratio, setRatio] = useState('1:1')
  const [quality, setQuality] = useState('standard')
  const [generating, setGenerating] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [count, setCount] = useState(1)

  async function generate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError('')
    setImages([])

    const selectedStyle = STYLES.find(s => s.id === style)
    const selectedRatio = RATIOS.find(r => r.id === ratio)
    const fullPrompt = `${prompt}. Style: ${selectedStyle?.label || style}. ${quality === 'hd' ? 'Ultra-detailed, high quality.' : ''}`

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          n: count,
          size: `${selectedRatio?.w}x${selectedRatio?.h}`,
          quality,
          style: style === 'photorealistic' ? 'natural' : 'vivid',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const urls = data.images || data.data?.map((d: any) => d.url) || []
      setImages(urls)
    } catch (e: any) {
      setError(e.message || 'Generation failed. Please try again.')
    }
    setGenerating(false)
  }

  const selectedStyle = STYLES.find(s => s.id === style)
  const selectedRatio = RATIOS.find(r => r.id === ratio)

  return (
    <div style={{ minHeight: '100vh', background: '#080812', color: '#e2e8f0', fontFamily: 'system-ui' }}>
      <nav style={{ background: 'rgba(8,8,18,0.97)', borderBottom: '1px solid rgba(99,102,241,0.12)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/javari" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>🎨</span>
          <span style={{ fontWeight: 800, color: '#818cf8', fontSize: 15 }}>Javari Images</span>
        </a>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/javari" style={{ color: '#6b7280', fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>← Chat</a>
          <a href="https://craudiovizai.com/auth/signup" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Get Credits</a>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, margin: '0 0 12px' }}>
            Generate any image with <span style={{ color: '#818cf8' }}>Javari AI</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15 }}>DALL-E 3 quality. Every style. Credits never expire.</p>
        </div>

        {/* Main input */}
        <div style={{ background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your image... Be as detailed as you want. Example: 'A golden retriever puppy playing in autumn leaves, soft morning light, photorealistic'"
            rows={4}
            style={{ width: '100%', background: '#080812', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 16px', color: '#e2e8f0', fontSize: 15, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui', lineHeight: 1.6 }} />
          
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Ratio */}
            <div style={{ display: 'flex', gap: 6 }}>
              {RATIOS.map(r => (
                <button key={r.id} onClick={() => setRatio(r.id)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    borderColor: ratio === r.id ? '#6366f1' : 'rgba(99,102,241,0.2)',
                    background: ratio === r.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: ratio === r.id ? '#818cf8' : '#6b7280' }}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Quality */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[['standard', 'Standard'], ['hd', 'HD ✨']].map(([v, l]) => (
                <button key={v} onClick={() => setQuality(v)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    borderColor: quality === v ? '#a855f7' : 'rgba(99,102,241,0.2)',
                    background: quality === v ? 'rgba(168,85,247,0.12)' : 'transparent',
                    color: quality === v ? '#c084fc' : '#6b7280' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Count */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 4].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    borderColor: count === n ? '#10b981' : 'rgba(99,102,241,0.2)',
                    background: count === n ? 'rgba(16,185,129,0.1)' : 'transparent',
                    color: count === n ? '#34d399' : '#6b7280' }}>
                  {n}x
                </button>
              ))}
            </div>

            <button onClick={generate} disabled={generating || !prompt.trim()}
              style={{ marginLeft: 'auto', background: generating || !prompt.trim() ? '#1e1e2e' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: generating || !prompt.trim() ? '#374151' : 'white',
                border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700,
                cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer', minWidth: 140 }}>
              {generating ? '🎨 Generating...' : '✨ Generate'}
            </button>
          </div>
        </div>

        {/* Style grid */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Style</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  borderColor: style === s.id ? '#6366f1' : 'rgba(99,102,241,0.15)',
                  background: style === s.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                  color: style === s.id ? '#818cf8' : '#6b7280' }}>
                <span>{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 14 }}>
            {error}
            {error.includes('credits') && (
              <a href="https://craudiovizai.com/auth/signup" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600, marginLeft: 8 }}>Get credits →</a>
            )}
          </div>
        )}

        {/* Generated images */}
        {images.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(images.length, 2)}, 1fr)`, gap: 16 }}>
              {images.map((url, i) => (
                <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.15)', position: 'relative' }}>
                  <img src={url} alt={`Generated ${i+1}`}
                    style={{ width: '100%', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 8 }}>
                    <a href={url} download={`javari-image-${i+1}.png`} target="_blank" rel="noreferrer"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      ⬇️ Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 12 }}>
              You own these images. Use them anywhere.
              <a href="https://craudiovizai.com/auth/signup" style={{ color: '#6366f1', textDecoration: 'none', marginLeft: 8 }}>Sign up to save to your library →</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
