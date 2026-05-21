// app/javariverse/page.tsx — The Javariverse World Map
// A connected universe of AI tools, communities, and opportunities
// CR AudioViz AI · EIN 39-3646201 · May 2026
'use client'
import { useState } from 'react'

const WORLDS = [
  {
    id: 'creative', label: 'Creative Studio', emoji: '🎨', color: '#a855f7',
    desc: 'Images, video, music, writing, design — everything creative built with AI.',
    apps: ['AI Images','AI Video','AI Music','Writing Studio','Logo Studio','PDF Builder'],
    href: '/javari'
  },
  {
    id: 'business', label: 'Business Hub', emoji: '🏢', color: '#3b82f6',
    desc: 'Contracts, invoices, HR, compliance, and operations for serious builders.',
    apps: ['Legal Docs','Invoice Pro','HR Workforce','Business Admin','Market Oracle'],
    href: '/javari'
  },
  {
    id: 'commerce', label: 'Commerce Engine', emoji: '🚀', color: '#f59e0b',
    desc: 'Storefronts, affiliate links, revenue tools, and monetization strategies.',
    apps: ['Spirits','Cards Vault','Sneaker Stash','Collectibles','Partners Portal'],
    href: '/javari'
  },
  {
    id: 'community', label: 'Community Grid', emoji: '🤝', color: '#10b981',
    desc: 'Forums, events, collaboration spaces, and mentorship networks.',
    apps: ['Veterans Connect','Nonprofits','Faith Communities','Senior Living','LGBTQ+'],
    href: '/javari'
  },
  {
    id: 'knowledge', label: 'Learn Academy', emoji: '📚', color: '#0ea5e9',
    desc: 'Courses, skill trees, mentors, and everything you need to grow.',
    apps: ['Books','Education','Resume Builder','Ebook Studio','News Compare'],
    href: '/javari'
  },
  {
    id: 'impact', label: 'Mission Center', emoji: '💚', color: '#22c55e',
    desc: 'Grants, nonprofits, impact tracking, and tools for changemakers.',
    apps: ['Grant Discovery','Animal Rescue','First Responders','Community Services'],
    href: '/grants'
  },
  {
    id: 'lifestyle', label: 'Lifestyle & Fun', emoji: '🌟', color: '#ec4899',
    desc: 'Travel, entertainment, hobbies, food, fashion — life beyond work.',
    apps: ['Travel','Orlando','Outdoors','Pets','Boating','Automotive'],
    href: '/javari'
  },
  {
    id: 'intelligence', label: 'Intelligence Layer', emoji: '🧠', color: '#6366f1',
    desc: 'The AI brain of the Javariverse — routing, memory, and orchestration.',
    apps: ['Javari AI','Market Intelligence','News Analysis','Research Tools'],
    href: '/javari'
  },
]

export default function JavariversePage() {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#040408', color: '#e2e8f0', fontFamily: 'system-ui' }}>
      
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🌌</div>
        <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, margin: '0 0 20px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
          Welcome to the <span style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Javariverse</span>
        </h1>
        <p style={{ fontSize: 18, color: '#6b7280', lineHeight: 1.65, maxWidth: 600, margin: '0 auto 32px' }}>
          A fully connected world where your avatar, your AI, and your community come together. Every tool you need. Every dream supported. One universe. Unlimited possibilities.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/avatar" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, padding: '14px 28px', fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
            Build Your Avatar →
          </a>
          <a href="https://craudiovizai.com/auth/signup" style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 28px', fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
            Join Free
          </a>
        </div>
      </div>

      {/* World Map */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 32 }}>
          8 Worlds · {WORLDS.reduce((a,w) => a+w.apps.length,0)}+ Apps · One Universe
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {WORLDS.map(world => (
            <a key={world.id} href={world.href}
              onMouseEnter={() => setHovered(world.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ background: hovered === world.id ? `${world.color}12` : '#0a0a14',
                border: `1px solid ${hovered === world.id ? world.color : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 18, padding: '24px', textDecoration: 'none', display: 'block',
                transition: 'all 0.2s', cursor: 'pointer' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{world.emoji}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: hovered === world.id ? world.color : '#e2e8f0' }}>
                {world.label}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                {world.desc}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {world.apps.map(app => (
                  <span key={app} style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', borderRadius: 8, padding: '2px 8px', fontSize: 11 }}>
                    {app}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Mission statement */}
      <div style={{ background: 'linear-gradient(135deg,#6366f110,#a855f710)', borderTop: '1px solid rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.1)', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(22px,3vw,36px)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.2 }}>
            "Your Story. Our Design. Everyone Connects. Everyone Wins."
          </h2>
          <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7, marginBottom: 28 }}>
            We're building a platform where veterans start businesses, artists reach audiences, creators monetize their work, communities connect, and dreamers find their path — all powered by AI that actually works for you.
          </p>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[{n:'159+',l:'Live Apps'},{n:'300+',l:'AI Models'},{n:'$600M+',l:'Grant Pipeline'},{n:'Always Free',l:'for Missions'}].map(s => (
              <div key={s.n} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#818cf8' }}>{s.n}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#1f2937', fontSize: 11, margin: 0 }}>
          © 2026 CR AudioViz AI, LLC — EIN: 39-3646201 · Fort Myers, Florida · <a href="https://craudiovizai.com" style={{ color: '#374151', textDecoration: 'none' }}>craudiovizai.com</a> · <a href="https://craudiovizai.com/auth/signup" style={{ color: '#6366f1', textDecoration: 'none' }}>Sign Up Free</a>
        </p>
      </footer>
    </div>
  )
}
