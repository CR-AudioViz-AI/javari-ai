// app/layout.tsx — javariai.com
// CR AudioViz AI · EIN: 39-3646201 · May 2026
import type { Metadata } from 'next'
import './globals.css'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Javari AI — Your Intelligent AI Assistant',
  description: 'Javari AI: 300+ models, voice, avatar, vision. Free to start. By CR AudioViz AI, EIN 39-3646201.',
  openGraph: { title: 'Javari AI', description: '300+ AI models. Voice. Avatar. Vision. Free to start.', type: 'website' },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200 }}>
          <a href="https://craudiovizai.com" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <span>🤖</span>
            <span style={{ color: '#6366f1' }}>Javari AI</span>
            <span style={{ color: '#374151', fontSize: 11, marginLeft: 4 }}>· CR AudioViz AI · EIN 39-3646201</span>
          </a>
          <a href="https://craudiovizai.com/auth/signup" style={{ background: '#6366f1', color: '#fff', borderRadius: 6, padding: '4px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            Free to Start →
          </a>
        </div>
        {children}
        <footer style={{ background: '#050608', borderTop: '1px solid rgba(99,102,241,0.08)', padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ color: '#1f2937', fontSize: 11, margin: 0 }}>
            © 2026 CR AudioViz AI, LLC — EIN: 39-3646201 · Fort Myers, Florida · Your Story. Our Design. ·{' '}
            <a href="https://craudiovizai.com" style={{ color: '#374151', textDecoration: 'none' }}>craudiovizai.com</a>
            {' '}·{' '}
            <a href="https://craudiovizai.com/auth/signup" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Sign Up Free</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
