/**
 * JAVARI OS - DEDICATED ROOT LAYOUT
 * 
 * This layout completely overrides the global app layout for all /javari/* routes.
 * NO global navigation, NO header, NO footer - pure full-screen OS experience.
 * 
 * By having a layout.tsx in /app/javari/, Next.js will use THIS layout
 * instead of /app/layout.tsx for all routes under /javari/*.
 * 
 * Architecture:
 * - Server-side rendering (SSR) - no FOUC
 * - No TopNav/MobileNav imports
 * - Full-screen immersive interface
 * - Providers for Javari-specific state
 * 
 * Result: Clean server render, no flash of unwanted content
 * 
 * @version 2.0.0
 * @timestamp Monday, February 24, 2026 at 1:03 AM EST
 */

import type { Metadata } from 'next'
import '../globals.css'
import { UserProfileProvider } from '@/components/user-profile/user-profile-context'
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context'

export const metadata: Metadata = {
  title: 'Javari OS - Your AI Operating System',
  description: 'Full-screen immersive AI interface powered by Javari OS',
  robots: {
    index: true,
    follow: true,
  },
}

export default function JavariRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="overflow-hidden">
        <UserProfileProvider>
          <SplitScreenProvider>
            {/* NO TopNav, NO MobileNav, NO global site navigation */}
            {/* Pure Javari OS full-screen experience */}
            <main role="main" className="w-full h-screen">
              {children}
            </main>
          </SplitScreenProvider>
        </UserProfileProvider>
      </body>
    </html>
  )
}

