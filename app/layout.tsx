/**
 * Javari AI - Root Layout (App Shell)
 * SPEC 03 — Canonical Application Shell
 * Updated: Integrated SPEC 02 Navigation System + Javari OS Immersive Mode
 * 
 * Defines the semantic structure for all pages:
 * - Skip-to-content link (accessibility)
 * - Header slot (empty placeholder)
 * - Navigation slot (TopNav + MobileNav from SPEC 02)
 * - Main content area (children)
 * - Footer slot (empty placeholder)
 * - System overlay slot (empty placeholder)
 * 
 * JAVARI OS IMMERSIVE MODE:
 * - Routes starting with /javari/* render WITHOUT global navigation
 * - Provides full-screen OS experience for Javari interface
 * - All other routes render with normal site navigation
 * 
 * @version 1.2.0
 * @spec SPEC 03 + SPEC 02 + Javari OS Mode
 * @timestamp Monday, February 24, 2026 at 12:58 AM EST
 */

import type { Metadata } from 'next'
import './globals.css'
import { LayoutWrapper } from './LayoutWrapper'

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
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  )
}
