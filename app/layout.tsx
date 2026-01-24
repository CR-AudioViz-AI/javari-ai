/**
 * Javari AI - Root Layout (App Shell)
 * SPEC 03 — Canonical Application Shell
 * Updated: Integrated SPEC 02 Navigation System
 * 
 * Defines the semantic structure for all pages:
 * - Skip-to-content link (accessibility)
 * - Header slot (empty placeholder)
 * - Navigation slot (TopNav + MobileNav from SPEC 02)
 * - Main content area (children)
 * - Footer slot (empty placeholder)
 * - System overlay slot (empty placeholder)
 * 
 * Server Component - renders without JavaScript
 * Navigation components handle their own client state
 * 
 * @version 1.1.0
 * @spec SPEC 03 + SPEC 02
 * @timestamp Tuesday, January 28, 2025 at 11:28 AM EST
 */

import type { Metadata } from 'next'
import './globals.css'
import { TopNav, MobileNav } from '@/components/navigation'

export const metadata: Metadata = {
  metadataBase: new URL('https://javariai.com'),
  title: {
    default: 'Javari AI - Your AI Business Partner',
    template: '%s | Javari AI'
  },
  description: 'Javari AI - Your autonomous business partner for managing revenue, users, deployments, and more.',
  keywords: ['AI assistant', 'business automation', 'Javari AI'],
  authors: [{ name: 'CR AudioViz AI, LLC' }],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Skip-to-content link for keyboard navigation */}
        <a 
          href="#main-content" 
          className="skip-to-content"
          style={{
            position: 'absolute',
            left: '-9999px',
            zIndex: 999,
            padding: '1rem',
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.left = '1rem';
            e.currentTarget.style.top = '1rem';
          }}
          onBlur={(e) => {
            e.currentTarget.style.left = '-9999px';
            e.currentTarget.style.top = 'auto';
          }}
        >
          Skip to main content
        </a>

        {/* Header slot - EMPTY placeholder for future implementation */}
        <header role="banner">
          {/* Header content will be added in future steps */}
        </header>

        {/* Navigation slot - Canonical Navigation System (SPEC 02) */}
        <TopNav />
        <MobileNav />

        {/* Main content area - where page children render */}
        <main role="main" id="main-content">
          {children}
        </main>

        {/* Footer slot - EMPTY placeholder for future implementation */}
        <footer role="contentinfo">
          {/* Footer content will be added in future steps */}
        </footer>

        {/* System overlay slot - EMPTY placeholder for modals, toasts, etc. */}
        <div role="region" aria-live="polite" aria-atomic="true">
          {/* System overlays (modals, toasts) will be added in future steps */}
        </div>
      </body>
    </html>
  )
}
